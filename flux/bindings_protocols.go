package main

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"flux/internal/audit"
	"flux/internal/contract"
	"flux/internal/grpc"
	graphqlpkg "flux/internal/graphqlpkg"
	"flux/internal/models"
	"flux/internal/mqtt"
	"flux/internal/requester"
	"flux/internal/scripting"
	"flux/internal/security"
	"flux/internal/soap"
)

// --- WebSocket / SSE ---

// tlsConfigFrom builds a *tls.Config from PEM-encoded CA / client cert material.
// Returns nil when no custom material is provided (system roots + no client cert).
func tlsConfigFrom(tc models.GRPCTLSConfig) *tls.Config {
	if tc.CACert == "" && tc.ClientCert == "" {
		return nil
	}
	cfg := &tls.Config{MinVersion: tls.VersionTLS12}
	if tc.CACert != "" {
		pool := x509.NewCertPool()
		if pool.AppendCertsFromPEM([]byte(tc.CACert)) {
			cfg.RootCAs = pool
		}
	}
	if tc.ClientCert != "" && tc.ClientKey != "" {
		if cert, err := tls.X509KeyPair([]byte(tc.ClientCert), []byte(tc.ClientKey)); err == nil {
			cfg.Certificates = []tls.Certificate{cert}
		}
	}
	return cfg
}

func (a *App) ConnectSocket(url, protocol string, headers map[string]string, tc models.GRPCTLSConfig) error {
	// Record a new session for history so it can be revisited later.
	if a.sockHistory != nil {
		if entry, err := a.sockHistory.Append(url, protocol, headers); err == nil {
			a.mu.Lock()
			a.socketSessID = entry.ID
			a.mu.Unlock()
		}
	}
	err := a.sock.Connect(url, protocol, headers, tlsConfigFrom(tc))
	if err != nil {
		return err
	}
	// Push the updated session list so the UI refreshes immediately.
	if a.sockHistory != nil {
		if sessions, gerr := a.sockHistory.GetAll(); gerr == nil {
			runtime.EventsEmit(a.ctx, "sockhistory:changed", sessions)
		}
	}
	return nil
}

func (a *App) SetSocketAutoReconnect(enabled bool) {
	a.sock.SetAutoReconnect(enabled)
}

func (a *App) SendSocketMessage(msg string) error {
	return a.sock.Send(msg)
}

func (a *App) SendSocketBinary(data string) error {
	return a.sock.SendBinary(data)
}

func (a *App) DisconnectSocket() error {
	a.sock.Disconnect()
	// Persist the session's final message log.
	if a.sockHistory != nil {
		a.mu.Lock()
		id := a.socketSessID
		a.socketSessID = ""
		a.mu.Unlock()
		if id != "" {
			msgs := a.sock.State().Messages
			if len(msgs) > 0 {
				_ = a.sockHistory.UpdateMessages(id, msgs)
			}
		}
	}
	return nil
}

func (a *App) GetSocketState() models.SocketState {
	return a.sock.State()
}

// GetSocketSessions returns persisted WebSocket/SSE/Socket.IO sessions.
func (a *App) GetSocketSessions() ([]models.SocketSession, error) {
	if a.sockHistory == nil {
		return []models.SocketSession{}, nil
	}
	return a.sockHistory.GetAll()
}

// SaveSocketSession persists a session manually (used when revisiting a
// previously saved session).
func (a *App) SaveSocketSession(url, protocol string, headers map[string]string) (models.SocketSession, error) {
	if a.sockHistory == nil {
		return models.SocketSession{}, errors.New("socket history not ready")
	}
	entry, err := a.sockHistory.Append(url, protocol, headers)
	if err != nil {
		return models.SocketSession{}, err
	}
	runtime.EventsEmit(a.ctx, "sockhistory:changed", nil)
	return entry, nil
}

// UpdateSocketSessionMessages persists the message log for the given session.
func (a *App) UpdateSocketSessionMessages(id string, msgs []models.SocketMessage) error {
	if a.sockHistory == nil {
		return errors.New("socket history not ready")
	}
	return a.sockHistory.UpdateMessages(id, msgs)
}

// DeleteSocketSession removes a stored session.
func (a *App) DeleteSocketSession(id string) error {
	if a.sockHistory == nil {
		return nil
	}
	if err := a.sockHistory.Delete(id); err != nil {
		return err
	}
	runtime.EventsEmit(a.ctx, "sockhistory:changed", nil)
	return nil
}

// ClearSocketSessions removes all stored socket sessions.
func (a *App) ClearSocketSessions() error {
	if a.sockHistory == nil {
		return nil
	}
	if err := a.sockHistory.Clear(); err != nil {
		return err
	}
	runtime.EventsEmit(a.ctx, "sockhistory:changed", nil)
	return nil
}

// --- Socket.IO ---

func (a *App) ConnectSocketIO(req models.SocketIOConnectRequest) error {
	// Record a new session for history so it can be revisited later.
	if a.sockHistory != nil {
		if entry, err := a.sockHistory.Append(req.URL, "socketio", req.Headers); err == nil {
			a.mu.Lock()
			a.sockioSessID = entry.ID
			a.mu.Unlock()
		}
	}
	err := a.sockio.Connect(req.URL, req.Cookies, req.Headers)
	if err != nil {
		return err
	}
	if a.sockHistory != nil {
		if sessions, gerr := a.sockHistory.GetAll(); gerr == nil {
			runtime.EventsEmit(a.ctx, "sockhistory:changed", sessions)
		}
	}
	return nil
}

func (a *App) EmitSocketIOEvent(event string, data interface{}) error {
	return a.sockio.Emit(event, data)
}

func (a *App) SendSocketIOMessage(msg string) error {
	return a.sockio.SendRaw(msg)
}

func (a *App) DisconnectSocketIO() error {
	a.sockio.Disconnect()
	if a.sockHistory != nil {
		a.mu.Lock()
		id := a.sockioSessID
		a.sockioSessID = ""
		a.mu.Unlock()
		if id != "" {
			msgs := a.sockio.State().Messages
			if len(msgs) > 0 {
				_ = a.sockHistory.UpdateMessages(id, msgs)
			}
		}
	}
	return nil
}

func (a *App) GetSocketIOState() models.SocketState {
	return a.sockio.State()
}

// --- SendRequest / CancelRequest ---

func (a *App) SendRequest(payload models.RequestPayload) models.ResponseResult {
	ctx, cancel := context.WithCancel(context.Background())

	a.mu.Lock()
	if a.inflight != nil {
		a.inflight()
	}
	a.inflight = cancel
	a.mu.Unlock()

	a.runPreScript(&payload)

	result := requester.Execute(ctx, payload, a.cookies)
	result = a.finishRequest(&payload, result)

	a.mu.Lock()
	if a.inflight != nil {
		a.inflight = nil
	}
	a.mu.Unlock()
	cancel()
	return result
}

// runPreScript executes the pre-request script and merges produced variables.
func (a *App) runPreScript(payload *models.RequestPayload) {
	vars, logs, pass, fail, err := scripting.RunPreScript(payload.PreScript, payload)
	if err != nil {
		runtime.EventsEmit(a.ctx, "script:error", map[string]interface{}{"phase": "pre", "error": err.Error()})
	}
	if len(vars) > 0 && a.environments != nil {
		_ = a.environments.MergeVars(vars)
	}
	if len(logs) > 0 || pass > 0 || fail > 0 {
		runtime.EventsEmit(a.ctx, "script:result", scripting.ExtractEnv(&scripting.ScriptEnv{Vars: vars, Logs: logs, Pass: pass, Fail: fail}))
	}
}

// finishRequest runs post-response handling (post-script, contract validation,
// history, audit, profile counter) and returns the final response.
func (a *App) finishRequest(payload *models.RequestPayload, result models.ResponseResult) models.ResponseResult {
	vars2, logs2, pass2, fail2, err2 := scripting.RunPostScript(payload.PostScript, payload, &result)
	if err2 != nil {
		runtime.EventsEmit(a.ctx, "script:error", map[string]interface{}{"phase": "post", "error": err2.Error()})
	}
	if len(vars2) > 0 && a.environments != nil {
		_ = a.environments.MergeVars(vars2)
	}
	if len(logs2) > 0 || pass2 > 0 || fail2 > 0 {
		runtime.EventsEmit(a.ctx, "script:result", scripting.ExtractEnv(&scripting.ScriptEnv{Vars: vars2, Logs: logs2, Pass: pass2, Fail: fail2}))
	}

	// Contract validation — only when a spec path was provided by the frontend.
	if payload.SpecPath != "" && result.Error == "" {
		dir, _ := a.workspaces.ActiveDir()
		specFull := filepath.Join(dir, payload.SpecPath)
		if doc, err := contract.Cache.Load(specFull); err == nil {
			v := contract.Validate(doc, payload.Method, payload.URL, result.StatusCode, []byte(result.Body))
			result.Validation = &models.ValidationResult{
				Valid:      v.Valid,
				Errors:     toModelErrors(v.Errors),
				SkipReason: v.SkipReason,
				Endpoint:   v.Endpoint,
				Method:     v.Method,
			}
			runtime.EventsEmit(a.ctx, "contract:result", result.Validation)
		}
	}

	if a.history != nil {
		_ = a.history.Append(*payload, result)
	}
	if a.audit != nil {
		_ = a.audit.Log("user", audit.ActionRun, "request", "", "", map[string]string{
			"method": payload.Method,
			"url":    payload.URL,
			"status": fmt.Sprintf("%d", result.StatusCode),
			"error":  result.Error,
		})
	}
	if result.Error == "" {
		_ = a.profile.IncrementRequestCount()
	}
	return result
}

func toModelErrors(errs []contract.ValidationError) []models.ValidationError {
	out := make([]models.ValidationError, len(errs))
	for i, e := range errs {
		out[i] = models.ValidationError{Layer: e.Layer, Field: e.Field, Message: e.Message}
	}
	return out
}

func (a *App) CancelRequest() {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.inflight != nil {
		a.inflight()
		a.inflight = nil
	}
}

// SendRequestStream issues an HTTP request and streams Server-Sent Events back
// to the frontend live through "sse:event" runtime events keyed by the sessionID
// the caller generated. When the response is not text/event-stream it behaves
// like SendRequest and a single "sse:done" event carries the full response.
// The request is cancelled via CancelRequest.
func (a *App) SendRequestStream(sessionID string, payload models.RequestPayload) error {
	ctx, cancel := context.WithCancel(context.Background())

	a.mu.Lock()
	if a.inflight != nil {
		a.inflight()
	}
	a.inflight = cancel
	a.mu.Unlock()

	go func() {
		defer func() {
			a.mu.Lock()
			a.inflight = nil
			a.mu.Unlock()
		}()

		a.runPreScript(&payload)

		result := requester.ExecuteStream(ctx, payload, a.cookies, func(ev models.SSEEvent) {
			runtime.EventsEmit(a.ctx, "sse:event", map[string]interface{}{"sessionId": sessionID, "event": ev})
		})
		result = a.finishRequest(&payload, result)
		runtime.EventsEmit(a.ctx, "sse:done", map[string]interface{}{"sessionId": sessionID, "result": result})
	}()

	return nil
}

// --- GraphQL ---

type GraphQLRequest struct {
	URL       string            `json:"url"`
	Query     string            `json:"query"`
	Variables string            `json:"variables"`
	Headers   map[string]string `json:"headers"`
}

type GraphQLResponse struct {
	Data       interface{} `json:"data"`
	Errors     interface{} `json:"errors"`
	StatusCode int         `json:"statusCode"`
	TimingMs   int64       `json:"timingMs"`
}

func (a *App) GraphQLExecute(reqJSON string) (string, error) {
	var req GraphQLRequest
	if err := json.Unmarshal([]byte(reqJSON), &req); err != nil {
		return "", fmt.Errorf("graphql: invalid request: %w", err)
	}
	resp := graphqlpkg.Execute(graphqlpkg.Request{
		URL:       req.URL,
		Query:     req.Query,
		Variables: req.Variables,
		Headers:   req.Headers,
	})
	return graphqlpkg.MarshalResponse(resp)
}

func (a *App) GraphQLIntrospect(url string, headersJSON string) (string, error) {
	var headers map[string]string
	if err := json.Unmarshal([]byte(headersJSON), &headers); err != nil {
		headers = map[string]string{}
	}
	data, err := graphqlpkg.Introspect(url, headers)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// --- gRPC ---

func (a *App) GRPCInvoke(url, service, method, body string, headers map[string]string, tc models.GRPCTLSConfig) *models.GRPCResponse {
	result := grpc.Invoke(context.Background(), grpc.GRPCRequest{
		URL:        url,
		Service:    service,
		Method:     method,
		Body:       body,
		Headers:    headers,
		CACert:     tc.CACert,
		ClientCert: tc.ClientCert,
		ClientKey:  tc.ClientKey,
	})
	return &models.GRPCResponse{
		StatusCode: result.StatusCode,
		Body:       result.Body,
		Error:      result.Error,
		DurationMs: result.DurationMs,
		Headers:    result.Headers,
		Trailers:   result.Trailers,
		GrpcCode:   result.GrpcCode,
		GrpcStatus: result.GrpcStatus,
	}
}

func (a *App) GRPCStreamInvoke(url, service, method, body string, headers map[string]string, tc models.GRPCTLSConfig) (string, error) {
	result := grpc.StreamInvoke(context.Background(), grpc.GRPCRequest{
		URL:        url,
		Service:    service,
		Method:     method,
		Body:       body,
		Headers:    headers,
		CACert:     tc.CACert,
		ClientCert: tc.ClientCert,
		ClientKey:  tc.ClientKey,
	})
	b, err := json.Marshal(result)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func (a *App) GRPCListServices(url string, headers map[string]string, tc models.GRPCTLSConfig) ([]string, error) {
	return grpc.ListServices(context.Background(), url, headers, &models.GRPCTLSConfig{
		CACert:     tc.CACert,
		ClientCert: tc.ClientCert,
		ClientKey:  tc.ClientKey,
	})
}

func (a *App) GRPCListMethods(url, service string, headers map[string]string, tc models.GRPCTLSConfig) ([]string, error) {
	return grpc.ListMethods(context.Background(), url, service, headers, &models.GRPCTLSConfig{
		CACert:     tc.CACert,
		ClientCert: tc.ClientCert,
		ClientKey:  tc.ClientKey,
	})
}

// GRPCListProtoServices parses a local .proto file (resolving its imports) and
// returns every service/method with an automatically generated example body.
func (a *App) GRPCListProtoServices(protoPath string) ([]models.GRPCProtoService, error) {
	return grpc.ListProtoServices(protoPath)
}

// GRPCStreamOpen opens a live streaming session covering unary, server-stream,
// client-stream and bidi RPCs. Responses arrive via "grpc:session" events.
func (a *App) GRPCStreamOpen(session models.GRPCStreamRequest) (string, error) {
	return grpc.StartStream(session)
}

func (a *App) GRPCStreamSendMessage(sessionID, body string) error {
	return grpc.SendStreamMessage(sessionID, body)
}

func (a *App) GRPCStreamCloseSend(sessionID string) error {
	return grpc.CloseStreamSend(sessionID)
}

func (a *App) GRPCStreamCancel(sessionID string) {
	grpc.CancelStream(sessionID)
}

// --- MQTT ---

func (a *App) MQTTConnect(brokerURL, clientID, username, password, topics string) error {
	if a.mqttClient == nil {
		a.mqttClient = mqtt.NewClient()
	}
	return a.mqttClient.Connect(mqtt.Config{
		BrokerURL: brokerURL,
		ClientID:  clientID,
		Username:  username,
		Password:  password,
		Topics:    topics,
	})
}

func (a *App) MQTTDisconnect() {
	if a.mqttClient != nil {
		a.mqttClient.Disconnect()
	}
}

func (a *App) MQTTPublish(topic, payload string, qos int) error {
	if a.mqttClient == nil {
		return errors.New("MQTT not connected")
	}
	return a.mqttClient.Publish(context.Background(), topic, payload, qos)
}

func (a *App) MQTTStatus() string {
	if a.mqttClient == nil {
		return "disconnected"
	}
	return a.mqttClient.Status()
}

func (a *App) MQTTGetMessages() []mqtt.Message {
	if a.mqttClient == nil {
		return nil
	}
	return a.mqttClient.Messages()
}

func (a *App) MQTTClearMessages() {
	if a.mqttClient != nil {
		a.mqttClient.ClearMessages()
	}
}

// --- SOAP ---

func (a *App) BuildSOAPEnvelope(action, body, serviceURL, soapVersion string, headers map[string]string) (string, string, error) {
	env, ct := soap.BuildEnvelope(soap.SOAPRequest{
		Action:      action,
		Body:        body,
		ServiceURL:  serviceURL,
		SOAPVersion: soapVersion,
		Headers:     headers,
	})
	return env, ct, nil
}

// --- Binary Download ---

func (a *App) DownloadBinaryResponse(data []byte, filename string) error {
	if a.ctx == nil {
		return errors.New("app context not ready")
	}
	const maxSize = 50 << 20 // 50MB
	if len(data) > maxSize {
		return fmt.Errorf("response too large (%d bytes, max %d)", len(data), maxSize)
	}
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Save Binary Response",
		DefaultFilename: filename,
	})
	if err != nil {
		return err
	}
	if path == "" {
		return nil // user cancelled
	}
	return os.WriteFile(path, data, 0644)
}

// SaveTextResponse opens a native "Save As" dialog and writes the text body.
func (a *App) SaveTextResponse(body string, filename string) error {
	if a.ctx == nil {
		return errors.New("app context not ready")
	}
	const maxSize = 50 << 20
	if len(body) > maxSize {
		return fmt.Errorf("response too large (%d bytes, max %d)", len(body), maxSize)
	}
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Save Response",
		DefaultFilename: filename,
	})
	if err != nil {
		return err
	}
	if path == "" {
		return nil
	}
	return os.WriteFile(path, []byte(body), 0644)
}

// --- Native dialogs ---

func (a *App) PickFile(title string, filter string) (string, error) {
	if a.ctx == nil {
		return "", errors.New("app context not ready")
	}
	options := runtime.OpenDialogOptions{Title: title}
	if filter != "" {
		options.Filters = []runtime.FileFilter{{DisplayName: "JSON", Pattern: filter}}
	}
	return runtime.OpenFileDialog(a.ctx, options)
}

func (a *App) ReadFileText(path string) (string, error) {
	if path == "" {
		return "", errors.New("path is required")
	}
	dir, err := a.workspaces.ActiveDir()
	if err != nil {
		return "", err
	}
	if err := security.ValidatePathWithinDir(dir, path); err != nil {
		return "", err
	}
	data, err := readFile(path)
	if err != nil {
		return "", err
	}
	return string(data), nil
}
