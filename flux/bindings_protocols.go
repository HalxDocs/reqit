package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"flux/internal/contract"
	"flux/internal/grpc"
	graphqlpkg "flux/internal/graphqlpkg"
	"flux/internal/models"
	"flux/internal/mqtt"
	"flux/internal/requester"
	"flux/internal/scripting"
	"flux/internal/soap"
)

// --- WebSocket / SSE ---

func (a *App) ConnectSocket(url, protocol string) error {
	return a.sock.Connect(url, protocol)
}

func (a *App) SendSocketMessage(msg string) error {
	return a.sock.Send(msg)
}

func (a *App) DisconnectSocket() error {
	a.sock.Disconnect()
	return nil
}

func (a *App) GetSocketState() models.SocketState {
	return a.sock.State()
}

// --- Socket.IO ---

func (a *App) ConnectSocketIO(req models.SocketIOConnectRequest) error {
	return a.sockio.Connect(req.URL, req.Cookies, req.Headers)
}

func (a *App) EmitSocketIOEvent(event string, data interface{}) error {
	return a.sockio.Emit(event, data)
}

func (a *App) SendSocketIOMessage(msg string) error {
	return a.sockio.SendRaw(msg)
}

func (a *App) DisconnectSocketIO() error {
	a.sockio.Disconnect()
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

	vars, logs, pass, fail, err := scripting.RunPreScript(payload.PreScript, &payload)
	if err != nil {
		runtime.EventsEmit(a.ctx, "script:error", map[string]interface{}{"phase": "pre", "error": err.Error()})
	}
	if len(vars) > 0 && a.environments != nil {
		_ = a.environments.MergeVars(vars)
	}
	if len(logs) > 0 || pass > 0 || fail > 0 {
		runtime.EventsEmit(a.ctx, "script:result", scripting.ExtractEnv(&scripting.ScriptEnv{Vars: vars, Logs: logs, Pass: pass, Fail: fail}))
	}

	result := requester.Execute(ctx, payload, a.cookies)

	vars2, logs2, pass2, fail2, err2 := scripting.RunPostScript(payload.PostScript, &payload, &result)
	if err2 != nil {
		runtime.EventsEmit(a.ctx, "script:error", map[string]interface{}{"phase": "post", "error": err2.Error()})
	}
	if len(vars2) > 0 && a.environments != nil {
		_ = a.environments.MergeVars(vars2)
	}
	if len(logs2) > 0 || pass2 > 0 || fail2 > 0 {
		runtime.EventsEmit(a.ctx, "script:result", scripting.ExtractEnv(&scripting.ScriptEnv{Vars: vars2, Logs: logs2, Pass: pass2, Fail: fail2}))
	}

	a.mu.Lock()
	if a.inflight != nil {
		a.inflight = nil
	}
	a.mu.Unlock()
	cancel()

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
		_ = a.history.Append(payload, result)
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

func (a *App) GRPCInvoke(url, service, method, body string, headers map[string]string) *models.GRPCResponse {
	result := grpc.Invoke(context.Background(), grpc.GRPCRequest{
		URL:     url,
		Service: service,
		Method:  method,
		Body:    body,
		Headers: headers,
	})
	return &models.GRPCResponse{
		StatusCode: result.StatusCode,
		Body:       result.Body,
		Error:      result.Error,
		DurationMs: result.DurationMs,
		Headers:    result.Headers,
	}
}

func (a *App) GRPCStreamInvoke(url, service, method, body string, headers map[string]string) (string, error) {
	result := grpc.StreamInvoke(context.Background(), grpc.GRPCRequest{
		URL:     url,
		Service: service,
		Method:  method,
		Body:    body,
		Headers: headers,
	})
	b, err := json.Marshal(result)
	if err != nil {
		return "", err
	}
	return string(b), nil
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
	data, err := readFile(path)
	if err != nil {
		return "", err
	}
	return string(data), nil
}
