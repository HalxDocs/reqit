package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"github.com/blang/semver/v4"

	"flux/internal/audit"
	aipkg "flux/internal/ai"
	"flux/internal/collections"
	"flux/internal/contract"
	cookiestore "flux/internal/cookies"
	"flux/internal/crypto"
	curlpkg "flux/internal/curl"
	"flux/internal/environments"
	"flux/internal/external"
	"flux/internal/export/markdown"
	gitpkg "flux/internal/git"
	graphqlpkg "flux/internal/graphqlpkg"
	"flux/internal/grpc"
	"flux/internal/growth"
	"flux/internal/history"
	"flux/internal/hoppscotch"
	"flux/internal/insomnia"
	"flux/internal/interceptor"
	"flux/internal/jwt"
	"flux/internal/loadtest"
	"flux/internal/locks"
	"flux/internal/masker"
	"flux/internal/mock"
	"flux/internal/models"
	"flux/internal/mqtt"
	"flux/internal/oauth2"
	"flux/internal/openapi"
	"flux/internal/plugin"
	"flux/internal/postman"
	"flux/internal/profile"
	regpkg "flux/internal/registry"
	"flux/internal/reporter"
	"flux/internal/requester"
	"flux/internal/rbac"
	schemapkg "flux/internal/schema"
	"flux/internal/scripting"
	"flux/internal/soap"
	"flux/internal/sso"
	"flux/internal/storage"
	"flux/internal/runner"
	"flux/internal/sock"
	"flux/internal/telemetry"
	"flux/internal/testbuilder"
	traypkg "flux/internal/tray"
	"flux/internal/updater"
	"flux/internal/vault"
	"flux/internal/watcher"
	"flux/internal/workspaces"

	agentlenspkg "flux/internal/agentlens"
)

type App struct {
	ctx          context.Context
	workspaces   *workspaces.Store
	collections  *collections.Store
	history      *history.Store
	environments *environments.Store
	profile      *profile.Store
	airgap       *profile.AirGapStore
	git          *gitpkg.Store
	locks        *locks.Store
	cookies      *cookiestore.Store
	fsWatcher    *watcher.Watcher
	mockReg      *mock.Registry
	mockServer   *mock.MockServer
	testSuites   *testbuilder.Store
	plugins      *plugin.Manager
	interceptor  *interceptor.Proxy
	telemetry    *telemetry.Store
	tray         *traypkg.Tray
	crypto       *crypto.Store
	vault        vault.Provider
	vaultCfg     vault.Config
	sso          *sso.Store
	masker       *masker.Engine
	audit        *audit.Store
	rbac         *rbac.Store
	growth       *growth.Store
	ai           *aipkg.Settings
	devProfile   *profile.DevProfileStore

	mu       sync.Mutex
	inflight context.CancelFunc

	sock       *sock.Socket
	mqttClient *mqtt.Client
}

func NewApp() *App {
	return &App{
		workspaces: workspaces.NewStore(),
		profile:    profile.NewStore(),
		sock:       sock.New(),
		tray:       traypkg.New(),
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	_ = a.profile.MarkLaunch()

	// Init air-gap config.
	if dataDir, err := a.AppDataDir(); err == nil {
		a.airgap = profile.NewAirGap(dataDir)
	}

	// Init telemetry (opt-in, defaults to off).
	if dataDir, err := a.AppDataDir(); err == nil {
		a.telemetry = telemetry.New(dataDir)
		if a.airgap == nil || !a.airgap.Get().TelemetryDisabled {
			a.telemetry.Track(telemetry.EventLaunch, "app_start", map[string]interface{}{
				"version": updater.CurrentVersion,
			})
		}
	}

	// Init interceptor (browser traffic capture proxy).
	if dataDir, err := a.AppDataDir(); err == nil {
		if a.airgap == nil || !a.airgap.Get().InterceptorDisabled {
			a.interceptor = interceptor.New(dataDir)
			a.interceptor.OnCapture(func(cr interceptor.CapturedRequest) {
				runtime.EventsEmit(a.ctx, "interceptor:captured", cr)
			})
		}
	}

	// Init security subsystems.
	if dataDir, err := a.AppDataDir(); err == nil {
		a.crypto = crypto.New(dataDir)
		a.sso = sso.New(dataDir)
		_ = a.sso.Load()
		a.masker = masker.New()
		a.audit = audit.New(dataDir)
		a.rbac = rbac.New(dataDir)
	}

	// Init growth & community subsystems.
	if dataDir, err := a.AppDataDir(); err == nil {
		a.growth = growth.New(dataDir)
	}

	// Wire tray and notify context.
	a.tray.SetContext(ctx)

	// Migrate legacy flat-file data into a Default workspace if needed.
	_ = a.workspaces.Migrate()

	// Re-attach scoped stores to the active workspace (if one exists).
	if dir, err := a.workspaces.ActiveDir(); err == nil && dir != "" {
		a.mountWorkspace(dir)
	}

	// Check for updates in the background — emit event if one is found.
	if a.airgap == nil || !a.airgap.Get().UpdateCheckDisabled {
		go func() {
			u := &updater.Updater{
				CurrentVersion: updater.CurrentVersion,
				OnUpdateFound: func(m updater.UpdateManifest) {
					runtime.EventsEmit(a.ctx, "update:available", m)
				},
			}
			u.CheckInBackground(a.ctx)
		}()
	}

	// Initialize plugin system.
	if a.airgap == nil || !a.airgap.Get().PluginDownloadsDisabled {
		if dataDir, err := a.AppDataDir(); err == nil {
			if pm, err := plugin.NewManager(dataDir); err == nil {
				a.plugins = pm
			}
		}
	}

	// Wire socket event callbacks.
	a.sock.OnEvent(func(msg models.SocketMessage) {
		runtime.EventsEmit(a.ctx, "socket:message", msg)
	})
	a.sock.OnStatus(func(status string) {
		runtime.EventsEmit(a.ctx, "socket:status", status)
	})
}

func (a *App) CheckForUpdates() *updater.UpdateManifest {
	if strings.HasPrefix(updater.CurrentVersion, "v0.0.0") {
		return nil
	}
	m, err := (&updater.Updater{CurrentVersion: updater.CurrentVersion}).FetchManifest(a.ctx)
	if err != nil {
		return nil
	}
	current, _ := semver.ParseTolerant(updater.CurrentVersion)
	latest, _ := semver.ParseTolerant(m.Version)
	if latest.GT(current) {
		return m
	}
	return nil
}

func (a *App) GetVersion() string {
	return updater.CurrentVersion
}

func (a *App) CreateSpec(title, version string) (string, error) {
	sd := openapi.NewSpecDesign(title, version)
	path := fmt.Sprintf("%s.openapi.json", strings.ReplaceAll(strings.ToLower(title), " ", "-"))
	if err := sd.Save(); err != nil {
		return "", fmt.Errorf("save spec: %w", err)
	}
	return path, nil
}

func (a *App) AddSpecEndpoint(specPath, method, path, summary string) error {
	sd, err := openapi.LoadSpecDesign(specPath)
	if err != nil {
		return err
	}
	sd.AddEndpoint(method, path, summary)
	return sd.Save()
}

func (a *App) GetSpecEndpoints(specPath string) ([]openapi.EndpointSummary, error) {
	sd, err := openapi.LoadSpecDesign(specPath)
	if err != nil {
		return nil, err
	}
	return sd.Endpoints(), nil
}

func (a *App) RemoveSpecEndpoint(specPath, method, path string) error {
	sd, err := openapi.LoadSpecDesign(specPath)
	if err != nil {
		return err
	}
	sd.RemoveEndpoint(method, path)
	return sd.Save()
}

func (a *App) GetPlugins() []plugin.RegisteredPlugin {
	if a.plugins == nil {
		return nil
	}
	return a.plugins.Registry.List()
}

func (a *App) InstallPlugin(sourceDir string) error {
	dataDir, err := a.AppDataDir()
	if err != nil {
		return err
	}
	if err := plugin.InstallPlugin(dataDir, sourceDir); err != nil {
		return err
	}
	if a.plugins != nil {
		return a.plugins.Registry.Discover()
	}
	return nil
}

func (a *App) InstallUpdate(manifest updater.UpdateManifest) error {
	u := &updater.Updater{CurrentVersion: updater.CurrentVersion}
	return u.Apply(a.ctx, manifest)
}

// RunCollection executes all requests in a resolved payload set with the given
// assertions and returns pass/fail results for each request.
func (a *App) RunCollection(reqs []models.RunnerRequest, assertions map[string]models.Assertion) models.CollectionRunResult {
	return runner.RunCollection(reqs, assertions)
}

func (a *App) RunCollectionWithConcurrency(reqs []models.RunnerRequest, assertions map[string]models.Assertion, maxConcurrent int) models.CollectionRunResult {
	return runner.RunCollection(reqs, assertions, maxConcurrent)
}

// --- OpenAPI Export ---

func (a *App) ExportOpenAPI(collectionID string) (string, error) {
	if a.collections == nil {
		return "", fmt.Errorf("no active workspace")
	}
	all, err := a.collections.GetAll()
	if err != nil {
		return "", err
	}
	for _, c := range all {
		if c.ID == collectionID {
			return openapi.Export(c)
		}
	}
	return "", fmt.Errorf("collection not found: %s", collectionID)
}

// PreviewOpenAPI exports the spec as HTML and opens it in the default browser.
func (a *App) PreviewOpenAPI(collectionID string) error {
	if a.collections == nil {
		return fmt.Errorf("no active workspace")
	}
	dir, err := a.workspaces.ActiveDir()
	if err != nil || dir == "" {
		return fmt.Errorf("no active workspace")
	}
	all, err := a.collections.GetAll()
	if err != nil {
		return err
	}
	for _, c := range all {
		if c.ID == collectionID {
			htmlPath, hErr := openapi.ExportToHTML(c, dir)
			if hErr != nil {
				return hErr
			}
			runtime.BrowserOpenURL(a.ctx, "file:///"+strings.ReplaceAll(htmlPath, "\\", "/"))
			return nil
		}
	}
	return fmt.Errorf("collection not found: %s", collectionID)
}

// ExportOpenAPIFiles writes both the JSON spec and a self-contained HTML page
// (Swagger UI embedded) to the workspace directory and returns their paths.
func (a *App) ExportOpenAPIFiles(collectionID string) (map[string]string, error) {
	if a.collections == nil {
		return nil, fmt.Errorf("no active workspace")
	}
	dir, err := a.workspaces.ActiveDir()
	if err != nil || dir == "" {
		return nil, fmt.Errorf("no active workspace")
	}
	all, err := a.collections.GetAll()
	if err != nil {
		return nil, err
	}
	for _, c := range all {
		if c.ID == collectionID {
			jsonPath, jErr := openapi.ExportToFile(c, dir)
			if jErr != nil {
				return nil, jErr
			}
			htmlPath, hErr := openapi.ExportToHTML(c, dir)
			if hErr != nil {
				return nil, hErr
			}
			return map[string]string{"json": jsonPath, "html": htmlPath}, nil
		}
	}
	return nil, fmt.Errorf("collection not found: %s", collectionID)
}

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

// mountWorkspace reinitializes the scoped stores with a new data directory.
// Called at startup and whenever the user switches workspaces.
func (a *App) mountWorkspace(dir string) {
	// Ensure .reqit/ directory structure exists for Git-native storage.
	_ = gitpkg.ReqitInit(dir)

	a.collections = collections.NewStore(dir)
	a.history = history.NewStore(dir)
	a.environments = environments.NewStore(dir)
	a.locks = locks.New(dir)
	a.cookies = cookiestore.New(dir)
	a.testSuites = testbuilder.NewStore(dir)

	// Init AI settings for this workspace.
	a.ai = aipkg.NewSettings(dir)
	a.ai.Load()

	// Init dev profile store for this workspace.
	a.devProfile = profile.NewDevProfileStore(dir)

	// Stop previous watcher if any.
	if a.fsWatcher != nil {
		a.fsWatcher.Close()
		a.fsWatcher = nil
	}

	// Start file watcher — emits workspace:changed + specific events so the frontend can reload.
	if w, err := watcher.New(func(filename string) {
		runtime.EventsEmit(a.ctx, "workspace:changed", filename)
		base := filepath.Base(filename)
		switch base {
		case "collections.json":
			runtime.EventsEmit(a.ctx, "collections:changed", nil)
		case "environments.json":
			runtime.EventsEmit(a.ctx, "environments:changed", nil)
		case "history.json":
			runtime.EventsEmit(a.ctx, "history:changed", nil)
		}
	}); err == nil {
		_ = w.Watch(dir)
		a.fsWatcher = w
	}

	// Open git repo if one exists; auto-pull if remote is configured.
	if gitpkg.IsRepo(dir) {
		if gs, err := gitpkg.Open(dir); err == nil {
			a.git = gs
			// Auto-pull on workspace mount so users start with latest changes.
			go func() {
				pat := gitpkg.LoadPAT(dir)
				if gs.GetRemote() != "" {
					_ = gs.Pull(pat)
					runtime.EventsEmit(a.ctx, "git:pull:complete", nil)
				}
			}()
		}
	} else {
		a.git = nil
	}
}

// --- Workspaces ---

func (a *App) GetWorkspaces() ([]workspaces.Info, error) {
	return a.workspaces.GetAll()
}

func (a *App) GetActiveWorkspace() (workspaces.Info, error) {
	_, info, err := a.workspaces.GetActive()
	return info, err
}

func (a *App) CreateWorkspace(name, description, color string) (workspaces.Info, error) {
	info, err := a.workspaces.Create(name, description, color)
	if err != nil {
		return workspaces.Info{}, err
	}
	a.mountWorkspace(info.DataDir)
	return info, nil
}

func (a *App) SwitchWorkspace(id string) (workspaces.Info, error) {
	dir, err := a.workspaces.Switch(id)
	if err != nil {
		return workspaces.Info{}, err
	}
	a.mountWorkspace(dir)
	_, info, err := a.workspaces.GetActive()
	return info, err
}

func (a *App) RenameWorkspace(id, name string) error {
	return a.workspaces.Rename(id, name)
}

func (a *App) DeleteWorkspace(id string) error {
	if err := a.workspaces.Delete(id); err != nil {
		return err
	}
	// Re-mount whatever is now active (may be empty).
	if dir, err := a.workspaces.ActiveDir(); err == nil && dir != "" {
		a.mountWorkspace(dir)
	} else {
		a.collections = nil
		a.history = nil
		a.environments = nil
	}
	return nil
}

func (a *App) RelocateWorkspace(id, newDir string) error {
	return a.workspaces.Relocate(id, newDir)
}

func (a *App) OpenWorkspaceFromFolder(folderPath string) (workspaces.Info, error) {
	info, err := a.workspaces.OpenFromFolder(folderPath)
	if err != nil {
		return workspaces.Info{}, err
	}
	// Auto-switch to it.
	if _, switchErr := a.workspaces.Switch(info.ID); switchErr == nil {
		a.mountWorkspace(info.DataDir)
	}
	return info, nil
}

func (a *App) PickFolder(title string) (string, error) {
	if a.ctx == nil {
		return "", errors.New("app context not ready")
	}
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{Title: title})
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
		// Log pre-script error but continue
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
		// Log post-script error but continue
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

// --- OAuth2 ---

func (a *App) OAuth2AuthorizeURL(authURL, tokenURL, clientID, clientSecret, scopes, redirectURI string, usePKCE bool) (string, string, error) {
	o := oauth2.New(oauth2.OAuth2Config{
		AuthURL:      authURL,
		TokenURL:     tokenURL,
		ClientID:     clientID,
		ClientSecret: clientSecret,
		Scopes:       scopes,
		RedirectURI:  redirectURI,
		UsePKCE:      usePKCE,
	})
	return o.AuthorizeURL()
}

func (a *App) OAuth2Exchange(authURL, tokenURL, clientID, clientSecret, scopes, redirectURI, code string, usePKCE bool) (*models.OAuth2TokenResponse, error) {
	o := oauth2.New(oauth2.OAuth2Config{
		AuthURL:      authURL,
		TokenURL:     tokenURL,
		ClientID:     clientID,
		ClientSecret: clientSecret,
		Scopes:       scopes,
		RedirectURI:  redirectURI,
		UsePKCE:      usePKCE,
	})
	token, err := o.Exchange(context.Background(), code)
	if err != nil {
		return nil, err
	}
	return &models.OAuth2TokenResponse{
		AccessToken:  token.AccessToken,
		RefreshToken: token.RefreshToken,
		TokenType:    token.TokenType,
		ExpiresIn:    token.ExpiresIn,
		ExpiresAt:    token.ExpiresAt,
	}, nil
}

func (a *App) OAuth2Refresh(authURL, tokenURL, clientID, clientSecret, scopes, redirectURI, refreshToken string, usePKCE bool) (*models.OAuth2TokenResponse, error) {
	o := oauth2.New(oauth2.OAuth2Config{
		AuthURL:      authURL,
		TokenURL:     tokenURL,
		ClientID:     clientID,
		ClientSecret: clientSecret,
		Scopes:       scopes,
		RedirectURI:  redirectURI,
		UsePKCE:      usePKCE,
	})
	token, err := o.Refresh(context.Background(), refreshToken)
	if err != nil {
		return nil, err
	}
	return &models.OAuth2TokenResponse{
		AccessToken:  token.AccessToken,
		RefreshToken: token.RefreshToken,
		TokenType:    token.TokenType,
		ExpiresIn:    token.ExpiresIn,
		ExpiresAt:    token.ExpiresAt,
	}, nil
}

// --- JWT ---

func (a *App) DecodeJWT(token string) *models.JWTDecoded {
	decoded := jwt.Decode(token)
	header := map[string]interface{}{
		"alg": decoded.Header.Alg,
		"typ": decoded.Header.Typ,
	}
	if decoded.Header.Kid != "" {
		header["kid"] = decoded.Header.Kid
	}
	return &models.JWTDecoded{
		Header:  header,
		Claims:  decoded.Claims,
		Valid:   decoded.Valid,
		Expired: decoded.Expired,
		Error:   decoded.Error,
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
	// Store MQTT client state on App struct so it persists across calls
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

// --- Collections ---

func (a *App) GetCollections() ([]models.Collection, error) {
	if a.collections == nil {
		return []models.Collection{}, nil
	}
	return a.collections.GetAll()
}

func (a *App) CreateCollection(name string) (models.Collection, error) {
	if a.collections == nil {
		return models.Collection{}, errors.New("no active workspace")
	}
	return a.collections.CreateCollection(name)
}

func (a *App) RenameCollection(id, name string) error {
	if a.collections == nil {
		return errors.New("no active workspace")
	}
	return a.collections.RenameCollection(id, name)
}

func (a *App) DeleteCollection(id string) error {
	if a.collections == nil {
		return errors.New("no active workspace")
	}
	return a.collections.DeleteCollection(id)
}

func (a *App) AddRequestToCollection(collID, name string, payload models.RequestPayload) (models.SavedRequest, error) {
	if a.collections == nil {
		return models.SavedRequest{}, errors.New("no active workspace")
	}
	return a.collections.AddRequest(collID, name, payload)
}

func (a *App) UpdateSavedRequest(reqID, name string, payload models.RequestPayload) error {
	if a.collections == nil {
		return errors.New("no active workspace")
	}
	return a.collections.UpdateRequest(reqID, name, payload)
}

func (a *App) UpdateScriptRules(reqID string, preSetVars []models.PreSetVar, extractRules []models.ExtractRule) error {
	if a.collections == nil {
		return errors.New("no active workspace")
	}
	return a.collections.UpdateRequestScripts(reqID, preSetVars, extractRules)
}

func (a *App) DeleteSavedRequest(reqID string) error {
	if a.collections == nil {
		return errors.New("no active workspace")
	}
	return a.collections.DeleteRequest(reqID)
}

func (a *App) DeleteSavedRequests(reqIDs []string) error {
	if a.collections == nil {
		return errors.New("no active workspace")
	}
	return a.collections.DeleteRequests(reqIDs)
}

func (a *App) ReorderCollection(id string, newIndex int) error {
	if a.collections == nil {
		return errors.New("no active workspace")
	}
	return a.collections.ReorderCollection(id, newIndex)
}

func (a *App) ReorderRequest(collID, reqID string, newIndex int) error {
	if a.collections == nil {
		return errors.New("no active workspace")
	}
	return a.collections.ReorderRequest(collID, reqID, newIndex)
}

func (a *App) MoveRequest(reqID, targetCollID string) error {
	if a.collections == nil {
		return errors.New("no active workspace")
	}
	return a.collections.MoveRequest(reqID, targetCollID)
}

// --- History ---

func (a *App) GetHistory() ([]models.HistoryEntry, error) {
	if a.history == nil {
		return []models.HistoryEntry{}, nil
	}
	return a.history.GetAll()
}

func (a *App) ClearHistory() error {
	if a.history == nil {
		return nil
	}
	return a.history.Clear()
}

func (a *App) DeleteHistoryEntry(id string) error {
	if a.history == nil {
		return nil
	}
	return a.history.DeleteEntry(id)
}

func (a *App) UpdateHistoryEntry(id string, patch map[string]interface{}) error {
	if a.history == nil {
		return nil
	}
	return a.history.UpdateEntry(id, patch)
}

// --- Environments ---

func (a *App) GetEnvironments() (environments.Snapshot, error) {
	if a.environments == nil {
		return environments.Snapshot{Environments: []models.Environment{}}, nil
	}
	return a.environments.Get()
}

func (a *App) CreateEnvironment(name string) (models.Environment, error) {
	if a.environments == nil {
		return models.Environment{}, errors.New("no active workspace")
	}
	return a.environments.Create(name)
}

func (a *App) UpdateEnvironment(id, name string, vars []models.EnvVar) error {
	if a.environments == nil {
		return errors.New("no active workspace")
	}
	return a.environments.Update(id, name, vars)
}

func (a *App) DeleteEnvironment(id string) error {
	if a.environments == nil {
		return errors.New("no active workspace")
	}
	return a.environments.Delete(id)
}

func (a *App) SetActiveEnvironment(id string) error {
	if a.environments == nil {
		return errors.New("no active workspace")
	}
	return a.environments.SetActive(id)
}

// SetEnvVar adds or updates a single variable in the active environment.
func (a *App) SetEnvVar(key, value string) error {
	if a.environments == nil {
		return errors.New("no active workspace")
	}
	snap, err := a.environments.Get()
	if err != nil {
		return err
	}
	if snap.Active == "" {
		return errors.New("no active environment — create one first")
	}
	for _, env := range snap.Environments {
		if env.ID == snap.Active {
			vars := env.Vars
			found := false
			for j, v := range vars {
				if v.Key == key {
					vars[j].Value = value
					vars[j].Enabled = true
					found = true
					break
				}
			}
			if !found {
				vars = append(vars, models.EnvVar{Key: key, Value: value, Enabled: true})
			}
			return a.environments.Update(snap.Active, env.Name, vars)
		}
	}
	return errors.New("active environment not found")
}

// --- Postman import ---

func (a *App) ImportPostman(targetCollID, jsonData string) (int, error) {
	if a.collections == nil {
		return 0, errors.New("no active workspace")
	}
	if targetCollID == "" {
		return 0, errors.New("target collection is required")
	}
	requests, err := postman.Parse([]byte(jsonData), targetCollID)
	if err != nil {
		return 0, err
	}
	for _, r := range requests {
		if _, err := a.collections.AddRequest(targetCollID, r.Name, r.Payload); err != nil {
			return 0, err
		}
	}
	return len(requests), nil
}

// ImportPostmanFull parses a Postman collection including variables, scripts, and collection-level auth.
func (a *App) ImportPostmanFull(jsonData, targetCollID string) (string, error) {
	if a.collections == nil {
		return "", errors.New("no active workspace")
	}
	if targetCollID == "" {
		return "", errors.New("target collection is required")
	}
	result, err := postman.ParseFull([]byte(jsonData), targetCollID)
	if err != nil {
		return "", err
	}
	for _, r := range result.Requests {
		if _, err := a.collections.AddRequest(targetCollID, r.Name, r.Payload); err != nil {
			return "", err
		}
	}
	// Transpile any pm.* scripts
	transpiled := make([]string, len(result.Scripts))
	for i, s := range result.Scripts {
		transpiled[i] = postman.TranspileScript(s)
	}
	out, _ := json.Marshal(map[string]interface{}{
		"requests":    len(result.Requests),
		"variables":   result.Variables,
		"scripts":     transpiled,
		"collectionAuth": result.Auth,
	})
	runtime.EventsEmit(a.ctx, "collections:changed")
	return string(out), nil
}

// ImportPostmanEnvironment parses a Postman environment file.
func (a *App) ImportPostmanEnvironment(jsonData, envName string) (string, error) {
	if a.environments == nil {
		return "", errors.New("no active workspace")
	}
	envData, err := postman.ParseEnvironment([]byte(jsonData))
	if err != nil {
		return "", err
	}
	name := envName
	if name == "" {
		name = envData.Name
	}
	env, err := a.environments.Create(name)
	if err != nil {
		return "", err
	}
	// Add variables to the new environment
	vars := []models.EnvVar{}
	for _, v := range envData.Values {
		if v.Enabled {
			vars = append(vars, models.EnvVar{Key: v.Key, Value: v.Value, Enabled: true})
		}
	}
	if err := a.environments.Update(env.ID, env.Name, vars); err != nil {
		return "", err
	}
	runtime.EventsEmit(a.ctx, "environments:changed")
	return name, nil
}

// ExportPostman exports collections to Postman v2.1 format.
func (a *App) ExportPostman(collID string) (string, error) {
	if a.collections == nil {
		return "", errors.New("no active workspace")
	}
	all, err := a.collections.GetAll()
	if err != nil {
		return "", err
	}
	for _, c := range all {
		if c.ID == collID {
			data, err := postman.Export(c.Requests, c.Name, "")
			if err != nil {
				return "", err
			}
			return string(data), nil
		}
	}
	return "", errors.New("collection not found")
}

// ImportInsomnia parses an Insomnia export file.
func (a *App) ImportInsomnia(jsonData, targetCollID string) (int, error) {
	if a.collections == nil {
		return 0, errors.New("no active workspace")
	}
	if targetCollID == "" {
		return 0, errors.New("target collection is required")
	}
	result, err := insomnia.Import([]byte(jsonData), targetCollID)
	if err != nil {
		return 0, err
	}
	for _, r := range result.Requests {
		if _, err := a.collections.AddRequest(targetCollID, r.Name, r.Payload); err != nil {
			return 0, err
		}
	}
	runtime.EventsEmit(a.ctx, "collections:changed")
	return len(result.Requests), nil
}

// ExportInsomnia exports collections to Insomnia JSON format.
func (a *App) ExportInsomnia(collID string) (string, error) {
	if a.collections == nil {
		return "", errors.New("no active workspace")
	}
	all, err := a.collections.GetAll()
	if err != nil {
		return "", err
	}
	for _, c := range all {
		if c.ID == collID {
			data, err := insomnia.Export(c.Requests, c.Name)
			if err != nil {
				return "", err
			}
			return string(data), nil
		}
	}
	return "", errors.New("collection not found")
}

// ImportHoppscotch parses a Hoppscotch export file.
func (a *App) ImportHoppscotch(jsonData, targetCollID string) (int, error) {
	if a.collections == nil {
		return 0, errors.New("no active workspace")
	}
	if targetCollID == "" {
		return 0, errors.New("target collection is required")
	}
	requests, err := hoppscotch.Import([]byte(jsonData), targetCollID)
	if err != nil {
		return 0, err
	}
	for _, r := range requests {
		if _, err := a.collections.AddRequest(targetCollID, r.Name, r.Payload); err != nil {
			return 0, err
		}
	}
	runtime.EventsEmit(a.ctx, "collections:changed")
	return len(requests), nil
}

// ExportHoppscotch exports collections to Hoppscotch JSON format.
func (a *App) ExportHoppscotch(collID string) (string, error) {
	if a.collections == nil {
		return "", errors.New("no active workspace")
	}
	all, err := a.collections.GetAll()
	if err != nil {
		return "", err
	}
	for _, c := range all {
		if c.ID == collID {
			data, err := hoppscotch.Export(c.Requests, c.Name)
			if err != nil {
				return "", err
			}
			return string(data), nil
		}
	}
	return "", errors.New("collection not found")
}

// ParseCurl parses a cURL command and returns the request data as JSON.
func (a *App) ParseCurl(curlCmd string) (string, error) {
	result, err := curlpkg.ParseCurlString(curlCmd)
	if err != nil {
		return "", err
	}
	payload := curlpkg.ToRequestPayload(result)
	data, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// GenerateCurl generates a cURL command from a saved request.
func (a *App) GenerateCurl(collID, reqID string) (string, error) {
	if a.collections == nil {
		return "", errors.New("no active workspace")
	}
	all, err := a.collections.GetAll()
	if err != nil {
		return "", err
	}
	for _, c := range all {
		if c.ID == collID {
			for _, r := range c.Requests {
				if r.ID == reqID {
					return curlpkg.GenerateCurl(r.Payload), nil
				}
			}
		}
	}
	return "", errors.New("request not found")
}

func (a *App) ImportOpenAPI(path string) (*openapi.ImportResult, error) {
	if a.collections == nil {
		return nil, errors.New("no active workspace")
	}
	result, err := openapi.Import(path)
	if err != nil {
		return nil, err
	}
	for _, coll := range result.Collections {
		created, cerr := a.collections.CreateCollection(coll.Name)
		if cerr != nil {
			return nil, cerr
		}
		for _, req := range coll.Requests {
			req.CollID = created.ID
			if _, aerr := a.collections.AddRequest(created.ID, req.Name, req.Payload); aerr != nil {
				return nil, aerr
			}
		}
	}

	// Save baseline snapshot for future drift detection
	if err := a.SaveSchemaSnapshot(filepath.Base(path)); err != nil {
		// Non-fatal — log but don't fail the import
		fmt.Printf("Warning: could not save schema snapshot: %v\n", err)
	}

	runtime.EventsEmit(a.ctx, "collections:changed")
	return result, nil
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

// --- Profile ---

func (a *App) GetProfile() (profile.Profile, error) {
	return a.profile.Get()
}

func (a *App) UpdateProfile(name, email string) error {
	return a.profile.Update(name, email)
}

func (a *App) AppDataDir() (string, error) {
	return storage.AppDir()
}

// --- Git ---

type GitStatus struct {
	Initialised   bool   `json:"initialised"`
	HasChanges    bool   `json:"hasChanges"`
	CurrentBranch string `json:"currentBranch"`
	RemoteURL     string `json:"remoteUrl"`
}

func (a *App) GetGitStatus() GitStatus {
	if a.git == nil {
		return GitStatus{}
	}
	return GitStatus{
		Initialised:   true,
		HasChanges:    a.git.HasChanges(),
		CurrentBranch: a.git.CurrentBranch(),
		RemoteURL:     a.git.GetRemote(),
	}
}

// InitGit initialises (or opens) a git repo in the active workspace,
// saves the remote URL and PAT, and adds the remote.
func (a *App) InitGit(remoteURL, pat string) error {
	dir, err := a.workspaces.ActiveDir()
	if err != nil || dir == "" {
		return errors.New("no active workspace")
	}
	gs, err := gitpkg.Open(dir)
	if err != nil {
		return err
	}
	a.git = gs
	if remoteURL != "" {
		if err := gs.SetRemote(remoteURL); err != nil {
			return err
		}
	}
	return gitpkg.SaveConfig(dir, remoteURL, pat)
}

func (a *App) CommitAndPush(message string) error {
	if a.git == nil {
		return errors.New("git not initialised for this workspace")
	}
	dir, _ := a.workspaces.ActiveDir()
	p, err := a.profile.Get()
	if err != nil {
		return err
	}
	if err := a.git.CommitAll(message, p.Name, p.Email); err != nil {
		return err
	}
	pat := gitpkg.LoadPAT(dir)
	if pat != "" {
		return a.git.Push(pat)
	}
	return nil
}

func (a *App) GitPull() error {
	if a.git == nil {
		return errors.New("git not initialised for this workspace")
	}
	dir, _ := a.workspaces.ActiveDir()
	pat := gitpkg.LoadPAT(dir)
	if err := a.git.Pull(pat); err != nil {
		return err
	}
	runtime.EventsEmit(a.ctx, "git:pull:complete", nil)
	return nil
}

func (a *App) GetBranches() ([]string, error) {
	if a.git == nil {
		return nil, errors.New("git not initialised")
	}
	return a.git.GetBranches()
}

func (a *App) SwitchBranch(name string) error {
	if a.git == nil {
		return errors.New("git not initialised")
	}
	return a.git.SwitchBranch(name)
}

func (a *App) CreateBranch(name string) error {
	if a.git == nil {
		return errors.New("git not initialised")
	}
	return a.git.CreateBranch(name)
}

func (a *App) GetGitLog(limit int) ([]gitpkg.CommitInfo, error) {
	if a.git == nil {
		return nil, errors.New("git not initialised")
	}
	return a.git.GetLog(limit)
}

// --- Git (advanced) ---

func (a *App) GitStash() (string, error) {
	if a.git == nil {
		return "", errors.New("git not initialised")
	}
	return a.git.Stash()
}

func (a *App) GitPopStash() error {
	if a.git == nil {
		return errors.New("git not initialised")
	}
	return a.git.PopStash()
}

func (a *App) GetGitStashList() ([]gitpkg.StashEntry, error) {
	if a.git == nil {
		return nil, errors.New("git not initialised")
	}
	return a.git.GetStashList()
}

func (a *App) GitMergeBranch(branch string) error {
	if a.git == nil {
		return errors.New("git not initialised")
	}
	return a.git.MergeBranch(branch)
}

func (a *App) GetGitDiff(from, to string) ([]gitpkg.DiffEntry, error) {
	if a.git == nil {
		return nil, errors.New("git not initialised")
	}
	return a.git.GetDiff(from, to)
}

func (a *App) GetGitDiffContent(path string) (string, error) {
	if a.git == nil {
		return "", errors.New("git not initialised")
	}
	return a.git.GetDiffContent(path)
}

func (a *App) GetGitConflictFiles() ([]string, error) {
	if a.git == nil {
		return nil, errors.New("git not initialised")
	}
	return a.git.GetConflictFiles()
}

func (a *App) GitResolveConflictOurs(path string) error {
	if a.git == nil {
		return errors.New("git not initialised")
	}
	return a.git.ResolveConflictOurs(path)
}

func (a *App) GitResolveConflictTheirs(path string) error {
	if a.git == nil {
		return errors.New("git not initialised")
	}
	return a.git.ResolveConflictTheirs(path)
}

// --- Interceptor (Browser Traffic Capture) ---

type InterceptorStatus struct {
	Running bool `json:"running"`
	Port    int  `json:"port"`
	Count   int  `json:"count"`
}

func (a *App) StartInterceptor() (int, error) {
	if a.interceptor == nil {
		return 0, errors.New("interceptor not initialised")
	}
	port, err := a.interceptor.Start()
	if err != nil {
		return 0, err
	}
	if a.telemetry != nil {
		a.telemetry.Track(telemetry.EventIntegration, "interceptor_start", nil)
	}
	return port, nil
}

func (a *App) StopInterceptor() error {
	if a.interceptor == nil {
		return errors.New("interceptor not initialised")
	}
	return a.interceptor.Stop()
}

func (a *App) GetInterceptorStatus() InterceptorStatus {
	if a.interceptor == nil {
		return InterceptorStatus{}
	}
	return InterceptorStatus{
		Running: a.interceptor.IsRunning(),
		Port:    a.interceptor.Port(),
		Count:   len(a.interceptor.GetCaptured()),
	}
}

func (a *App) GetCapturedRequests() []interceptor.CapturedRequest {
	if a.interceptor == nil {
		return nil
	}
	return a.interceptor.GetCaptured()
}

func (a *App) ClearCapturedRequests() {
	if a.interceptor != nil {
		a.interceptor.ClearCaptured()
	}
}

// ExportExtension writes the Chrome extension source to a directory.
func (a *App) ExportExtension(dir string) error {
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	// Write manifest
	if err := os.WriteFile(filepath.Join(dir, "manifest.json"), interceptor.ChromeExtensionManifest("reqit Interceptor"), 0644); err != nil {
		return err
	}
	// Write embedded assets
	if err := os.WriteFile(filepath.Join(dir, "background.js"), []byte(interceptor.BackgroundJS), 0644); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(dir, "popup.html"), []byte(interceptor.PopupHTML), 0644); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(dir, "popup.js"), []byte(interceptor.PopupJS), 0644); err != nil {
		return err
	}
	// Create icon placeholders
	iconsDir := filepath.Join(dir, "icons")
	_ = os.MkdirAll(iconsDir, 0755)
	return nil
}

// --- Telemetry ---

type TelemetryConfig struct {
	Enabled bool `json:"enabled"`
}

func (a *App) GetTelemetryConfig() TelemetryConfig {
	if a.telemetry == nil {
		return TelemetryConfig{Enabled: false}
	}
	return TelemetryConfig{Enabled: a.telemetry.IsEnabled()}
}

func (a *App) SetTelemetryEnabled(enabled bool) {
	if a.telemetry != nil {
		a.telemetry.SetEnabled(enabled)
	}
}

func (a *App) GetTelemetryPreview() string {
	if a.telemetry == nil {
		return ""
	}
	return a.telemetry.Preview()
}

func (a *App) GetTelemetryEvents(limit int) []telemetry.Event {
	if a.telemetry == nil {
		return nil
	}
	return a.telemetry.GetRecentEvents(limit)
}

// --- Notifications ---

func (a *App) SendNotification(title, message string) {
	if a.tray != nil {
		a.tray.ShowNotification(title, message)
	}
}

// --- External Registry (SwaggerHub / Stoplight) ---

type RegistryPushResult struct {
	URL string `json:"url"`
}

func (a *App) PushToSwaggerHub(specJSON, apiKey, owner, name, version string) (*RegistryPushResult, error) {
	client := regpkg.NewSwaggerHubClient(apiKey, owner, name)
	if version != "" {
		client.SetVersion(version)
	}
	result, err := client.Push([]byte(specJSON))
	if err != nil {
		return nil, err
	}
	if a.telemetry != nil {
		a.telemetry.Track(telemetry.EventIntegration, "swaggerhub_push", nil)
	}
	return &RegistryPushResult{URL: result.URL}, nil
}

func (a *App) PullFromSwaggerHub(apiKey, owner, name, version string) (string, error) {
	client := regpkg.NewSwaggerHubClient(apiKey, owner, name)
	if version != "" {
		client.SetVersion(version)
	}
	data, err := client.Pull()
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func (a *App) PushToStoplight(specJSON, apiToken, projectSlug string) (*RegistryPushResult, error) {
	client := regpkg.NewStoplightClient(apiToken, projectSlug)
	result, err := client.Push([]byte(specJSON))
	if err != nil {
		return nil, err
	}
	if a.telemetry != nil {
		a.telemetry.Track(telemetry.EventIntegration, "stoplight_push", nil)
	}
	return &RegistryPushResult{URL: result.URL}, nil
}

func (a *App) PullFromStoplight(apiToken, projectSlug string) (string, error) {
	client := regpkg.NewStoplightClient(apiToken, projectSlug)
	data, err := client.Pull()
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// --- CLI Runner Script ---

func (a *App) GenerateCLIRunnerScript(collectionName string) string {
	dir, _ := a.workspaces.ActiveDir()
	exe, _ := os.Executable()
	return traypkg.CLIRunnerTemplate(exe, dir, collectionName)
}

// --- Locks ---

func (a *App) LockCollection(id string) error {
	if a.locks == nil {
		return errors.New("no active workspace")
	}
	p, err := a.profile.Get()
	if err != nil {
		return err
	}
	if err := a.locks.Lock(id, p.Name, p.Email); err != nil {
		return err
	}
	runtime.EventsEmit(a.ctx, "lock:changed", id)
	return nil
}

func (a *App) UnlockCollection(id string) error {
	if a.locks == nil {
		return errors.New("no active workspace")
	}
	if err := a.locks.Unlock(id); err != nil {
		return err
	}
	runtime.EventsEmit(a.ctx, "lock:changed", id)
	return nil
}

func (a *App) GetLocks() (map[string]locks.LockInfo, error) {
	if a.locks == nil {
		return map[string]locks.LockInfo{}, nil
	}
	return a.locks.GetAll()
}

func (a *App) GetActiveContributors() ([]gitpkg.Contributor, error) {
	if a.git == nil {
		return []gitpkg.Contributor{}, nil
	}
	return a.git.GetActiveContributors()
}

// --- Security: E2EE Crypto ---

func (a *App) HasEncryptionKey() bool {
	if a.crypto == nil {
		return false
	}
	return a.crypto.HasKey()
}

func (a *App) GenerateEncryptionKey() error {
	if a.crypto == nil {
		return errors.New("crypto not initialised")
	}
	if a.audit != nil {
		_ = a.audit.Log("system", audit.ActionConfig, "crypto", "key", "", map[string]string{"action": "generate"})
	}
	return a.crypto.GenerateKey()
}

func (a *App) SetEncryptionPassphrase(passphrase string) error {
	if a.crypto == nil {
		return errors.New("crypto not initialised")
	}
	if a.audit != nil {
		_ = a.audit.Log("system", audit.ActionConfig, "crypto", "passphrase", "", nil)
	}
	return a.crypto.SetKey(passphrase)
}

func (a *App) DeleteEncryptionKey() error {
	if a.crypto == nil {
		return errors.New("crypto not initialised")
	}
	if a.audit != nil {
		_ = a.audit.Log("system", audit.ActionConfig, "crypto", "key", "", map[string]string{"action": "delete"})
	}
	return a.crypto.DeleteKey()
}

// --- Security: Secret Vault ---

func (a *App) ConfigureVault(cfgJSON string) error {
	if a.airgap != nil && a.airgap.Get().VaultAccessDisabled {
		return errors.New("vault access disabled by air-gap configuration")
	}
	cfg, err := vault.UnmarshalConfig(cfgJSON)
	if err != nil {
		return err
	}
	p, err := vault.New(cfg)
	if err != nil {
		return err
	}
	a.vault = p
	a.vaultCfg = cfg
	if a.audit != nil {
		_ = a.audit.Log("system", audit.ActionConfig, "vault", cfg.Type, "", nil)
	}
	return nil
}

func (a *App) GetVaultConfig() string {
	data, _ := vault.MarshalConfig(a.vaultCfg)
	return data
}

func (a *App) VaultGetSecret(path string) (string, error) {
	if a.vault == nil {
		return "", errors.New("no vault configured")
	}
	if a.airgap != nil && a.airgap.Get().VaultAccessDisabled {
		return "", errors.New("vault access disabled by air-gap configuration")
	}
	return a.vault.GetSecret(path)
}

func (a *App) VaultSetSecret(path, value string) error {
	if a.vault == nil {
		return errors.New("no vault configured")
	}
	if a.airgap != nil && a.airgap.Get().VaultAccessDisabled {
		return errors.New("vault access disabled by air-gap configuration")
	}
	return a.vault.SetSecret(path, value)
}

// --- Security: Enterprise SSO ---

func (a *App) GetSSOProviders() string {
	if a.sso == nil {
		return "[]"
	}
	providers := a.sso.List()
	data, _ := sso.MarshalProviders(providers)
	return data
}

func (a *App) AddSSOProvider(cfgJSON string) error {
	if a.sso == nil {
		return errors.New("sso not initialised")
	}
	cfg, err := sso.UnmarshalProvider(cfgJSON)
	if err != nil {
		return err
	}
	if err := a.sso.Add(cfg); err != nil {
		return err
	}
	if a.audit != nil {
		_ = a.audit.Log("system", audit.ActionConfig, "sso", cfg.ID, "", nil)
	}
	return a.sso.Save()
}

func (a *App) RemoveSSOProvider(id string) error {
	if a.sso == nil {
		return errors.New("sso not initialised")
	}
	if err := a.sso.Remove(id); err != nil {
		return err
	}
	return a.sso.Save()
}

func (a *App) ToggleSSOProvider(id string) error {
	if a.sso == nil {
		return errors.New("sso not initialised")
	}
	if err := a.sso.ToggleEnabled(id); err != nil {
		return err
	}
	return a.sso.Save()
}

func (a *App) AuthenticateSSO(providerID, emailHint string) (string, error) {
	if a.sso == nil {
		return "", errors.New("sso not initialised")
	}
	if a.airgap != nil && a.airgap.Get().SSODisabled {
		return "", errors.New("SSO disabled by air-gap configuration")
	}
	profile, err := a.sso.Authenticate(providerID, emailHint)
	if err != nil {
		return "", err
	}
	if a.audit != nil {
		_ = a.audit.Log(profile.Email, audit.ActionLogin, "sso", providerID, "", nil)
	}
	data, _ := sso.MarshalUserProfile(profile)
	return data, nil
}

// --- Security: Data Masking ---

func (a *App) GetMaskingRules() string {
	if a.masker == nil {
		return "[]"
	}
	rules := a.masker.List()
	data, _ := masker.MarshalRules(rules)
	return data
}

func (a *App) AddMaskingRule(name, pattern, replacement string) error {
	if a.masker == nil {
		return errors.New("masker not initialised")
	}
	return a.masker.AddRule(name, pattern, replacement)
}

func (a *App) RemoveMaskingRule(name string) {
	if a.masker != nil {
		a.masker.RemoveRule(name)
	}
}

func (a *App) ToggleMaskingRule(name string, enabled bool) {
	if a.masker != nil {
		a.masker.SetEnabled(name, enabled)
	}
}

func (a *App) MaskText(text string) string {
	if a.masker == nil {
		return text
	}
	return a.masker.Mask(text)
}

// --- Security: Audit Trail ---

func (a *App) QueryAuditLog(limit, offset int, actor, action, resource, workspaceID string) string {
	if a.audit == nil {
		return "[]"
	}
	entries, err := a.audit.Query(limit, offset, actor, action, resource, workspaceID)
	if err != nil {
		return "[]"
	}
	data, _ := audit.MarshalEntries(entries)
	return string(data)
}

// --- Security: RBAC ---

func (a *App) RBACCheck(userID, resourceID, resourceType, permission string) bool {
	if a.rbac == nil {
		return true
	}
	return a.rbac.Check(userID, resourceID, rbac.ResourceType(resourceType), rbac.Permission(permission))
}

func (a *App) RBACGrant(userID, resourceID, resourceType, role string) error {
	if a.rbac == nil {
		return errors.New("rbac not initialised")
	}
	return a.rbac.Grant(userID, resourceID, rbac.ResourceType(resourceType), rbac.Role(role))
}

func (a *App) RBACRevoke(userID, resourceID string) error {
	if a.rbac == nil {
		return errors.New("rbac not initialised")
	}
	return a.rbac.Revoke(userID, resourceID)
}

func (a *App) RBACList(userID, resourceID string) string {
	if a.rbac == nil {
		return "[]"
	}
	entries := a.rbac.List(userID, resourceID)
	data, _ := rbac.MarshalACEs(entries)
	return data
}

// --- Security: Air-Gapped Configuration ---

func (a *App) GetAirGapConfig() string {
	if a.airgap == nil {
		cfg := profile.AirGapConfig{}
		data, _ := profile.MarshalAirGap(cfg)
		return data
	}
	cfg := a.airgap.Get()
	data, _ := profile.MarshalAirGap(cfg)
	return data
}

func (a *App) SetAirGapConfig(cfgJSON string) error {
	if a.airgap == nil {
		return errors.New("airgap not initialised")
	}
	cfg, err := profile.UnmarshalAirGap(cfgJSON)
	if err != nil {
		return err
	}
	return a.airgap.Set(cfg)
}

// --- Cookies ---

func (a *App) GetCookies() []cookiestore.CookieInfo {
	if a.cookies == nil {
		return []cookiestore.CookieInfo{}
	}
	return a.cookies.GetAll()
}

func (a *App) ClearCookiesForDomain(domain string) {
	if a.cookies != nil {
		a.cookies.ClearDomain(domain)
	}
}

func (a *App) ClearAllCookies() {
	if a.cookies != nil {
		a.cookies.ClearAll()
	}
}

// --- Contract Testing ---

func (a *App) LinkCollectionSpec(collID, specPath string) error {
	if a.collections == nil {
		return errors.New("no active workspace")
	}
	return a.collections.SetSpec(collID, specPath)
}

func (a *App) InvalidateSpec(specPath string) {
	dir, _ := a.workspaces.ActiveDir()
	contract.Cache.Invalidate(filepath.Join(dir, specPath))
}

// FetchSpecFromURL downloads an OpenAPI spec from a URL, saves it to the
// workspace folder, and returns the relative path suitable for LinkCollectionSpec.
func (a *App) FetchSpecFromURL(rawURL string) (string, error) {
	dir, err := a.workspaces.ActiveDir()
	if err != nil {
		return "", err
	}

	// Determine filename from the URL path.
	name := "openapi-spec.json"
	if u, err2 := http.NewRequest("GET", rawURL, nil); err2 == nil {
		if p := u.URL.Path; p != "" {
			if base := filepath.Base(p); base != "." && base != "/" {
				name = base
			}
		}
	}
	// Ensure it has a valid extension.
	if !strings.HasSuffix(name, ".json") && !strings.HasSuffix(name, ".yaml") && !strings.HasSuffix(name, ".yml") {
		name += ".json"
	}

	resp, err := http.Get(rawURL) //nolint:gosec
	if err != nil {
		return "", fmt.Errorf("failed to fetch spec from URL: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("spec URL returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response body: %w", err)
	}

	// Validate that it looks like JSON or YAML (basic check).
	trimmed := strings.TrimSpace(string(body))
	if len(trimmed) == 0 {
		return "", errors.New("spec URL returned empty content")
	}
	if trimmed[0] != '{' && trimmed[0] != '[' && !strings.Contains(trimmed, "openapi") && !strings.Contains(trimmed, "swagger") {
		return "", errors.New("URL does not appear to contain an OpenAPI spec")
	}

	dst := filepath.Join(dir, name)
	if err := os.WriteFile(dst, body, 0644); err != nil {
		return "", fmt.Errorf("failed to save spec file: %w", err)
	}

	// Auto-save baseline snapshot for future drift detection
	if err := a.SaveSchemaSnapshot(name); err != nil {
		fmt.Printf("Warning: could not save schema snapshot: %v\n", err)
	}

	return name, nil
}

// SaveSchemaSnapshot captures and saves a baseline snapshot of an OpenAPI spec.
func (a *App) SaveSchemaSnapshot(specPath string) error {
	dir, err := a.workspaces.ActiveDir()
	if err != nil {
		return err
	}

	fullPath := filepath.Join(dir, specPath)
	snap, err := schemapkg.CaptureSnapshot(fullPath)
	if err != nil {
		return fmt.Errorf("failed to capture snapshot: %w", err)
	}

	return schemapkg.SaveSnapshot(dir, specPath, snap)
}

// DetectSchemaDrift compares the current spec against its saved baseline snapshot.
// Returns the drift result, or nil if no baseline exists.
func (a *App) DetectSchemaDrift(specPath string) (*schemapkg.Drift, error) {
	dir, err := a.workspaces.ActiveDir()
	if err != nil {
		return nil, err
	}

	baseline, err := schemapkg.LoadSnapshot(dir, specPath)
	if err != nil {
		// No baseline saved yet — this is the first import, no drift to detect
		return nil, nil
	}

	fullPath := filepath.Join(dir, specPath)
	current, err := schemapkg.CaptureSnapshot(fullPath)
	if err != nil {
		return nil, fmt.Errorf("failed to capture current snapshot: %w", err)
	}

	drift := schemapkg.DetectDrift(baseline, current)
	return drift, nil
}

// --- Mock Server ---

// MockStatus is returned by mock server methods.
type MockStatus struct {
	Running    bool     `json:"running"`
	Port       int      `json:"port"`
	RouteCount int      `json:"routeCount"`
	BaseURL    string   `json:"baseUrl"`
	Routes     []string `json:"routes"`
	Recording  bool     `json:"recording"`
}

func (a *App) StartMockServer(port int) (MockStatus, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.mockServer != nil {
		return MockStatus{}, errors.New("mock server already running")
	}
	cols, _ := a.GetCollections()
	a.mockReg = mock.NewRegistry()
	loadCollsIntoRegistry(a.mockReg, cols)
	a.mockServer = mock.NewMockServer(a.mockReg, port)
	a.mockServer.Start()
	s := MockStatus{
		Running:    true,
		Port:       port,
		RouteCount: a.mockReg.Count(),
		BaseURL:    fmt.Sprintf("http://localhost:%d", port),
		Routes:     a.mockReg.Routes(),
		Recording:  a.mockServer.Recording().Enabled(),
	}
	runtime.EventsEmit(a.ctx, "mock:started", s)
	return s, nil
}

func (a *App) StopMockServer() error {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.mockServer == nil {
		return nil
	}
	err := a.mockServer.Stop()
	a.mockServer = nil
	a.mockReg = nil
	runtime.EventsEmit(a.ctx, "mock:stopped", nil)
	return err
}

func (a *App) GetMockStatus() MockStatus {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.mockServer == nil {
		return MockStatus{}
	}
	return MockStatus{
		Running:    true,
		Port:       a.mockServer.Port,
		RouteCount: a.mockReg.Count(),
		BaseURL:    fmt.Sprintf("http://localhost:%d", a.mockServer.Port),
		Routes:     a.mockReg.Routes(),
		Recording:  a.mockServer.Recording().Enabled(),
	}
}

func (a *App) ToggleMockRecording(enable bool) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.mockServer == nil {
		return errors.New("mock server not running")
	}
	if enable {
		a.mockServer.Recording().Enable()
	} else {
		a.mockServer.Recording().Disable()
	}
	runtime.EventsEmit(a.ctx, "mock:updated", a.GetMockStatus())
	return nil
}

func (a *App) SetRouteOverride(colID, reqID string, o models.MockOverride) error {
	if a.collections == nil {
		return errors.New("no active workspace")
	}
	if err := a.collections.SetMockOverride(colID, reqID, o); err != nil {
		return err
	}
	a.mu.Lock()
	reg := a.mockReg
	a.mu.Unlock()
	if reg != nil {
		cols, _ := a.GetCollections()
		loadCollsIntoRegistry(reg, cols)
		runtime.EventsEmit(a.ctx, "mock:updated", a.GetMockStatus())
	}
	return nil
}

func (a *App) SaveResponseToRequest(colID, reqID string) error {
	if a.collections == nil {
		return errors.New("no active workspace")
	}
	// This is called after SendRequest; the last response is stored on a.history.
	// We'll take it from the response store — frontend passes the response explicitly.
	return nil // See SaveCapturedResponse below.
}

// --- Test Suites ---

func (a *App) CreateTestSuite(name, description, collID string) (models.TestSuite, error) {
	if a.testSuites == nil {
		return models.TestSuite{}, errors.New("no active workspace")
	}
	return a.testSuites.Create(name, description, collID)
}

func (a *App) GetTestSuites() []models.TestSuite {
	if a.testSuites == nil {
		return nil
	}
	return a.testSuites.GetAll()
}

func (a *App) UpdateTestSuite(ts models.TestSuite) error {
	if a.testSuites == nil {
		return errors.New("no active workspace")
	}
	return a.testSuites.Update(ts)
}

func (a *App) DeleteTestSuite(id string) error {
	if a.testSuites == nil {
		return errors.New("no active workspace")
	}
	return a.testSuites.Delete(id)
}

func (a *App) AddTestGroup(suiteID, parentID string, group models.TestGroup) error {
	if a.testSuites == nil {
		return errors.New("no active workspace")
	}
	return a.testSuites.AddGroup(suiteID, parentID, group)
}

func (a *App) UpdateTestGroup(suiteID string, group models.TestGroup) error {
	if a.testSuites == nil {
		return errors.New("no active workspace")
	}
	return a.testSuites.UpdateGroup(suiteID, group)
}

func (a *App) DeleteTestGroup(suiteID, groupID string) error {
	if a.testSuites == nil {
		return errors.New("no active workspace")
	}
	return a.testSuites.DeleteGroup(suiteID, groupID)
}

// --- Load Testing ---

func (a *App) RunLoadTest(config models.LoadTestConfig) models.LoadTestResult {
	return loadtest.RunLoadTest(config, a.cookies)
}

// --- Extra Runner Config / Enhanced Runner ---

func (a *App) RunCollectionWithConfig(config models.RunnerConfig) models.CollectionRunResult {
	reqs := config.Requests
	assertionsMap := make(map[string]models.Assertion)
	return runner.RunCollection(reqs, assertionsMap, config.MaxConcurrent)
}

// --- Reports ---

func (a *App) GenerateJSONReport(result models.CollectionRunResult) (string, error) {
	return reporter.GenerateJSONReport(result)
}

func (a *App) GenerateHTMLReport(result models.CollectionRunResult, loadResult *models.LoadTestResult) (string, error) {
	return reporter.GenerateHTMLReport(result, loadResult)
}

func (a *App) ExportReportAsJSON(result models.CollectionRunResult) (string, error) {
	if a.ctx == nil {
		return "", errors.New("app context not ready")
	}
	jsonStr, err := reporter.GenerateJSONReport(result)
	if err != nil {
		return "", err
	}
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Save JSON Report",
		DefaultFilename: fmt.Sprintf("report-%s.json", time.Now().Format("20060102-150405")),
		Filters:         []runtime.FileFilter{{DisplayName: "JSON", Pattern: "*.json"}},
	})
	if err != nil {
		return "", err
	}
	if path == "" {
		return "", nil // user cancelled
	}
	return path, os.WriteFile(path, []byte(jsonStr), 0644)
}

func (a *App) ExportReportAsHTML(result models.CollectionRunResult, loadResult *models.LoadTestResult) (string, error) {
	if a.ctx == nil {
		return "", errors.New("app context not ready")
	}
	htmlStr, err := reporter.GenerateHTMLReport(result, loadResult)
	if err != nil {
		return "", err
	}
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Save HTML Report",
		DefaultFilename: fmt.Sprintf("report-%s.html", time.Now().Format("20060102-150405")),
		Filters:         []runtime.FileFilter{{DisplayName: "HTML", Pattern: "*.html"}},
	})
	if err != nil {
		return "", err
	}
	if path == "" {
		return "", nil // user cancelled
	}
	return path, os.WriteFile(path, []byte(htmlStr), 0644)
}

// --- External Runner Generation ---

func (a *App) GeneratePlaywrightTest(collID string, useTS bool) (string, error) {
	if a.collections == nil {
		return "", errors.New("no active workspace")
	}
	all, err := a.collections.GetAll()
	if err != nil {
		return "", err
	}
	for _, c := range all {
		if c.ID == collID {
			return external.GeneratePlaywrightTest(c, c.Requests, nil, useTS)
		}
	}
	return "", fmt.Errorf("collection not found: %s", collID)
}

func (a *App) GenerateJestTest(collID string, useTS bool) (string, error) {
	if a.collections == nil {
		return "", errors.New("no active workspace")
	}
	all, err := a.collections.GetAll()
	if err != nil {
		return "", err
	}
	for _, c := range all {
		if c.ID == collID {
			return external.GenerateJestTest(c, c.Requests, nil, useTS)
		}
	}
	return "", fmt.Errorf("collection not found: %s", collID)
}

func (a *App) GenerateCLIRunner(collID string) (string, error) {
	if a.collections == nil {
		return "", errors.New("no active workspace")
	}
	all, err := a.collections.GetAll()
	if err != nil {
		return "", err
	}
	for _, c := range all {
		if c.ID == collID {
			return external.GenerateCLIRunner(c, c.Requests)
		}
	}
	return "", fmt.Errorf("collection not found: %s", collID)
}

func (a *App) GenerateGitHubAction(collID, runnerFilename string) (string, error) {
	if a.collections == nil {
		return "", errors.New("no active workspace")
	}
	collections, err := a.collections.GetAll()
	if err != nil {
		return "", err
	}
	for _, c := range collections {
		if c.ID == collID {
			return external.GenerateGitHubAction(c, runnerFilename)
		}
	}
	return "", errors.New("collection not found")
}

func (a *App) GenerateGitLabCI(collID, runnerFilename string) (string, error) {
	if a.collections == nil {
		return "", errors.New("no active workspace")
	}
	collections, err := a.collections.GetAll()
	if err != nil {
		return "", err
	}
	for _, c := range collections {
		if c.ID == collID {
			return external.GenerateGitLabCI(c, runnerFilename)
		}
	}
	return "", errors.New("collection not found")
}

func (a *App) GenerateJenkins(collID, runnerFilename string) (string, error) {
	if a.collections == nil {
		return "", errors.New("no active workspace")
	}
	collections, err := a.collections.GetAll()
	if err != nil {
		return "", err
	}
	for _, c := range collections {
		if c.ID == collID {
			return external.GenerateJenkins(c, runnerFilename)
		}
	}
	return "", errors.New("collection not found")
}

func (a *App) SaveGeneratedTest(content, filename string) (string, error) {
	if a.ctx == nil {
		return "", errors.New("app context not ready")
	}
	ext := filepath.Ext(filename)
	if ext == "" {
		ext = ".js"
	}
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Save Generated Test",
		DefaultFilename: filename,
		Filters:         []runtime.FileFilter{{DisplayName: "All Files", Pattern: "*" + ext}},
	})
	if err != nil {
		return "", err
	}
	if path == "" {
		return "", nil // user cancelled
	}
	return path, os.WriteFile(path, []byte(content), 0644)
}

type ExportMarkdownOpts struct {
	IncludeHeaders  bool `json:"includeHeaders"`
	IncludeBody     bool `json:"includeBody"`
	IncludeExamples bool `json:"includeExamples"`
	BaseURL         string `json:"baseUrl"`
	Timestamp       bool `json:"timestamp"`
}

func (a *App) ExportCollectionMarkdown(colID string, opts ExportMarkdownOpts) (string, error) {
	if a.collections == nil {
		return "", errors.New("no active workspace")
	}
	all, err := a.collections.GetAll()
	if err != nil {
		return "", err
	}
	var col *models.Collection
	for i := range all {
		if all[i].ID == colID {
			col = &all[i]
			break
		}
	}
	if col == nil {
		return "", errors.New("collection not found")
	}
	mo := markdown.ExportOptions{
		IncludeHeaders:   opts.IncludeHeaders,
		IncludeBody:      opts.IncludeBody,
		IncludeExamples:  opts.IncludeExamples,
		BaseURL:          opts.BaseURL,
		Timestamp:        opts.Timestamp,
	}
	g := markdown.New(mo)
	md, err := g.Generate(col)
	if err != nil {
		return "", err
	}

	if a.ctx == nil {
		return "", errors.New("app context not ready")
	}
	filename := col.Name + "_api_docs.md"
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Save Markdown API Documentation",
		DefaultFilename: filename,
		Filters:         []runtime.FileFilter{{DisplayName: "Markdown", Pattern: "*.md"}},
	})
	if err != nil {
		return "", err
	}
	if path == "" {
		return "", nil // user cancelled
	}
	return path, os.WriteFile(path, []byte(md), 0644)
}

func (a *App) SaveCapturedResponse(colID, reqID string, resp models.SavedResponse) error {
	if a.collections == nil {
		return errors.New("no active workspace")
	}
	if err := a.collections.SetSavedResponse(colID, reqID, resp); err != nil {
		return err
	}
	a.mu.Lock()
	reg := a.mockReg
	a.mu.Unlock()
	if reg != nil {
		cols, _ := a.GetCollections()
		loadCollsIntoRegistry(reg, cols)
		runtime.EventsEmit(a.ctx, "mock:updated", a.GetMockStatus())
	}
	return nil
}

func loadCollsIntoRegistry(reg *mock.Registry, cols []models.Collection) {
	for _, col := range cols {
		for _, req := range col.Requests {
			if req.SavedResponse == nil {
				continue
			}
			path := extractMockPath(req.Payload.URL)
			mr := mock.MockResponse{
				StatusCode: req.SavedResponse.StatusCode,
				Headers:    req.SavedResponse.Headers,
				Body:       req.SavedResponse.Body,
			}
			if req.MockOverride != nil && req.MockOverride.Enabled {
				mr.StatusCode = req.MockOverride.StatusCode
				mr.DelayMs = req.MockOverride.DelayMs
				mr.Body = req.MockOverride.Body
			}
			reg.Set(req.Payload.Method, path, mr)
		}
	}
}

// extractMockPath strips {{base_url}} and query strings, returns just the path.
func extractMockPath(raw string) string {
	// Replace {{base_url}} and other template vars with empty.
	s := raw
	for strings.Contains(s, "{{") {
		start := strings.Index(s, "{{")
		end := strings.Index(s, "}}")
		if end < start {
			break
		}
		s = s[:start] + s[end+2:]
	}
	if idx := strings.Index(s, "?"); idx >= 0 {
		s = s[:idx]
	}
	if !strings.HasPrefix(s, "/") {
		// Strip scheme+host if present
		if idx := strings.Index(s, "//"); idx >= 0 {
			s = s[idx+2:]
		}
		if idx := strings.Index(s, "/"); idx >= 0 {
			s = s[idx:]
		} else {
			s = "/"
		}
	}
	return s
}

// ---------------------------------------------------------------------------
// Growth & Community — Wails bindings
// ---------------------------------------------------------------------------

func (a *App) GetTiers() (string, error) {
	if a.growth == nil {
		return "", errors.New("growth not initialised")
	}
	return growth.MarshalTiers(a.growth.GetTiers())
}

func (a *App) GetTierCategories() []string {
	if a.growth == nil {
		return nil
	}
	return a.growth.GetTierCategories()
}

func (a *App) GetRecipes() (string, error) {
	if a.growth == nil {
		return "", errors.New("growth not initialised")
	}
	return growth.MarshalRecipes(a.growth.GetRecipes())
}

func (a *App) GetRecipe(id string) (string, error) {
	if a.growth == nil {
		return "", errors.New("growth not initialised")
	}
	r, ok := a.growth.GetRecipe(id)
	if !ok {
		return "", fmt.Errorf("recipe %q not found", id)
	}
	return growth.MarshalRecipe(r)
}

func (a *App) GetRecipeCategories() []string {
	if a.growth == nil {
		return nil
	}
	return a.growth.GetRecipeCategories()
}

func (a *App) GetCommunityConfig() (string, error) {
	if a.growth == nil {
		return "", errors.New("growth not initialised")
	}
	return growth.MarshalCommunityConfig(a.growth.GetCommunityConfig())
}

func (a *App) SetDiscordURL(url string) error {
	if a.growth == nil {
		return errors.New("growth not initialised")
	}
	a.growth.SetDiscordURL(url)
	a.track("community", "set_discord_url", nil)
	return nil
}

func (a *App) GetFeatureRequests() (string, error) {
	if a.growth == nil {
		return "", errors.New("growth not initialised")
	}
	return growth.MarshalFeatureRequests(a.growth.GetFeatureRequestsByVotes())
}

func (a *App) UpvoteFeatureRequest(id string) error {
	if a.growth == nil {
		return errors.New("growth not initialised")
	}
	err := a.growth.UpvoteFeatureRequest(id)
	if err == nil {
		a.track("roadmap", "upvote", map[string]interface{}{"id": id})
	}
	return err
}

func (a *App) GetBadges() (string, error) {
	if a.growth == nil {
		return "", errors.New("growth not initialised")
	}
	return growth.MarshalBadges(a.growth.GetBadges())
}

// track is an internal helper for telemetry (no-op if telemetry is nil/disabled)
func (a *App) track(category, action string, metadata map[string]interface{}) {
	if a.telemetry == nil || !a.telemetry.IsEnabled() {
		return
	}
	if a.growth == nil {
		return
	}
	a.telemetry.Track(telemetry.EventFeature, category+":"+action, metadata)
}

// --- AI ---

type AISettingsResult struct {
	Enabled  bool   `json:"enabled"`
	Provider string `json:"provider"`
	APIKey   string `json:"apiKey"`
	BaseURL  string `json:"baseUrl"`
	Model    string `json:"model"`
}

func (a *App) GetAISettings() AISettingsResult {
	if a.ai == nil {
		return AISettingsResult{}
	}
	cfg := a.ai.Get()
	return AISettingsResult{
		Enabled:  a.ai.IsConfigured(),
		Provider: string(cfg.Provider),
		APIKey:   cfg.APIKey,
		BaseURL:  cfg.BaseURL,
		Model:    cfg.Model,
	}
}

func (a *App) SaveAISettings(provider, apiKey, baseURL, model string) error {
	if a.ai == nil {
		dir, err := a.workspaces.ActiveDir()
		if err != nil {
			return err
		}
		a.ai = aipkg.NewSettings(dir)
	}
	cfg := aipkg.Config{
		Provider: aipkg.Provider(provider),
		APIKey:   apiKey,
		BaseURL:  baseURL,
		Model:    model,
	}
	return a.ai.Save(cfg)
}

func (a *App) DiagnoseWithAI(payload models.RequestPayload, response models.ResponseResult) (string, error) {
	if a.ai == nil || !a.ai.IsConfigured() {
		return "", errors.New("AI not configured — go to Settings to add your API key")
	}
	cfg := a.ai.Get()

	bodyPreview := response.Body
	if len(bodyPreview) > 2000 {
		bodyPreview = bodyPreview[:2000] + "... (truncated)"
	}

	systemMsg := `You are an API debugging assistant. Analyze the request and response, then provide a clear diagnosis. Be concise and actionable. Format your response in markdown.`

	userMsg := fmt.Sprintf(`## Request
**%s %s**

**Headers:**
%s

**Body:**
%s

## Response
**Status: %d %s**
**Time: %dms**

**Response Headers:**
%s

**Response Body:**
%s

%s

Diagnose the issue. Explain what went wrong, why, and how to fix it. If the request succeeded, confirm it looks correct and suggest any improvements.`,
		payload.Method, payload.URL,
		formatHeaders(payload.Headers),
		payload.Body,
		response.StatusCode, response.Status, response.TimingMs,
		formatResponseHeaders(response.Headers),
		bodyPreview,
		formatValidation(response.Validation),
	)

	messages := []aipkg.Message{
		{Role: "system", Content: systemMsg},
		{Role: "user", Content: userMsg},
	}

	return aipkg.Chat(cfg, messages)
}

func (a *App) GenerateAssertions(payload models.RequestPayload, response models.ResponseResult) (string, error) {
	if a.ai == nil || !a.ai.IsConfigured() {
		return "", errors.New("AI not configured — go to Settings to add your API key")
	}
	cfg := a.ai.Get()

	bodyPreview := response.Body
	if len(bodyPreview) > 3000 {
		bodyPreview = bodyPreview[:3000] + "... (truncated)"
	}

	systemMsg := `You are an API test assertion generator. Given a request and response, generate test assertions in reqit's JSON format. Return ONLY a JSON array of assertions, no explanation.

Assertion types:
- {"type":"statusCode","target":"200"} — exact status code match
- {"type":"maxTiming","target":"5000"} — max response time in ms
- {"type":"bodyContains","target":"text"} — response body contains text
- {"type":"bodyMatch","target":"regex"} — response body matches regex
- {"type":"jsonPath","target":"$.field","value":"expected"} — JSON path value check
- {"type":"header","target":"Content-Type","value":"application/json"} — header value check

Generate sensible assertions covering: status code, response time, required fields, and data types. Include edge-case assertions (error status codes, missing fields).`

	userMsg := fmt.Sprintf(`**%s %s** → **%d %s** (%dms)

Response body:
`+"```"+`
%s
`+"```"+`

Generate assertions for this endpoint.`, payload.Method, payload.URL, response.StatusCode, response.Status, response.TimingMs, bodyPreview)

	messages := []aipkg.Message{
		{Role: "system", Content: systemMsg},
		{Role: "user", Content: userMsg},
	}

	return aipkg.Chat(cfg, messages)
}

func formatHeaders(headers []models.Header) string {
	var sb strings.Builder
	for _, h := range headers {
		if !h.Enabled {
			continue
		}
		sb.WriteString(fmt.Sprintf("- **%s:** %s\n", h.Key, h.Value))
	}
	if sb.Len() == 0 {
		return "_none_"
	}
	return sb.String()
}

func formatResponseHeaders(headers map[string]string) string {
	var sb strings.Builder
	for k, v := range headers {
		sb.WriteString(fmt.Sprintf("- **%s:** %s\n", k, v))
	}
	if sb.Len() == 0 {
		return "_none_"
	}
	return sb.String()
}

func formatValidation(v *models.ValidationResult) string {
	if v == nil {
		return ""
	}
	if v.Valid {
		return "## Contract Validation\n**Status: ✓ Contract OK**"
	}
	var sb strings.Builder
	sb.WriteString("## Contract Validation\n**Status: ✗ Violations**\n\n")
	for _, e := range v.Errors {
		sb.WriteString(fmt.Sprintf("- **[%s]** %s: %s\n", e.Layer, e.Field, e.Message))
	}
	return sb.String()
}

// --- Dev Profile ---

func (a *App) GetDevProfile() (*profile.DevProfile, error) {
	if a.devProfile == nil {
		return nil, errors.New("no active workspace")
	}
	return a.devProfile.Get()
}

func (a *App) SaveDevProfile(p profile.DevProfile) error {
	if a.devProfile == nil {
		return errors.New("no active workspace")
	}
	return a.devProfile.Update(p)
}

func (a *App) SetDevProfilePublic(public bool) error {
	if a.devProfile == nil {
		return errors.New("no active workspace")
	}
	return a.devProfile.SetPublic(public)
}

func (a *App) GetPublicProfile() (*profile.PublicProfile, error) {
	if a.devProfile == nil {
		return nil, errors.New("no active workspace")
	}
	return a.devProfile.GetPublicProfile()
}

// PublishDevProfile stores the profile in Upstash Redis for instant web access.
func (a *App) PublishDevProfile() (string, error) {
	if a.devProfile == nil {
		return "", errors.New("no active workspace")
	}
	// Compute fresh stats before publishing so the live profile shows real data
	stats := a.ComputeDevStats()
	_ = a.devProfile.UpdateStats(stats)

	// Build projects from collections
	if a.collections != nil {
		colls, _ := a.collections.GetAll()
		var projects []profile.ProjectRef
		for _, c := range colls {
			proj := profile.ProjectRef{
				Name:         c.Name,
				Description:  c.Description,
				RequestCount: len(c.Requests),
				Protocols:    []string{},
				HasSpec:      c.SpecPath != "",
				Public:       true,
			}
			if c.Description == "" {
				proj.Description = fmt.Sprintf("%d requests", len(c.Requests))
			}
			protocols := map[string]bool{}
			for _, r := range c.Requests {
				if r.Payload.Method != "" {
					protocols[strings.ToUpper(r.Payload.Method)] = true
				}
			}
			for p := range protocols {
				proj.Protocols = append(proj.Protocols, p)
			}
			projects = append(projects, proj)
		}
		_ = a.devProfile.UpdateProjects(projects)
	}

	pub, err := a.devProfile.GetPublicProfile()
	if err != nil {
		return "", err
	}
	if err := profile.PublishToUpstash(pub); err != nil {
		return "", fmt.Errorf("publish profile: %w", err)
	}
	return fmt.Sprintf("https://reqit.vercel.app/%s", pub.Username), nil
}

// SaveUpstashConfig stores the Upstash API credentials locally.
func (a *App) SaveUpstashConfig(url, token string) error {
	return profile.SaveUpstashConfig(url, token)
}

// IsUpstashConfigured returns whether Upstash credentials are set.
func (a *App) IsUpstashConfigured() bool {
	return profile.IsUpstashConfigured()
}

func (a *App) ComputeDevStats() profile.DevStats {
	if a.collections == nil {
		return profile.DevStats{}
	}

	colls, _ := a.collections.GetAll()
	protos := map[string]bool{}
	auths := map[string]bool{}
	totalReqs := 0
	specsCount := 0
	passCount := 0
	totalValidated := 0
	assertionCount := 0

	for _, c := range colls {
		if c.SpecPath != "" {
			specsCount++
		}
		for _, r := range c.Requests {
			totalReqs++
			if r.Payload.Method != "" {
				protos[strings.ToUpper(r.Payload.Method)] = true
			}
			if r.Payload.AuthType != "" && r.Payload.AuthType != "none" {
				auths[r.Payload.AuthType] = true
			}
			if r.Payload.BodyType != "" {
				protos[r.Payload.BodyType] = true
			}
		}
	}

	// Count assertions from test suites
	if a.testSuites != nil {
		suites := a.testSuites.GetAll()
		for _, s := range suites {
			for _, g := range s.Groups {
				assertionCount += len(g.Assertions)
				for _, child := range g.Children {
					assertionCount += len(child.Assertions)
				}
			}
		}
	}

	// Contract pass rate from history
	if a.history != nil {
		entries, _ := a.history.GetAll()
		for _, e := range entries {
			if e.Response.Validation != nil {
				totalValidated++
				if e.Response.Validation.Valid {
					passCount++
				}
			}
		}
	}

	passRate := 0
	if totalValidated > 0 {
		passRate = (passCount * 100) / totalValidated
	}

	protoList := make([]string, 0, len(protos))
	for p := range protos {
		protoList = append(protoList, p)
	}
	authList := make([]string, 0, len(auths))
	for a := range auths {
		authList = append(authList, a)
	}

	return profile.DevStats{
		CollectionsCreated: len(colls),
		RequestsSent:       totalReqs,
		AssertionsWritten:  assertionCount,
		SpecsAuthored:      specsCount,
		MockServersCreated: 0,
		ContractPassRate:   passRate,
		ProtocolsUsed:      protoList,
		AuthTypesUsed:      authList,
	}
}

// ── Agent Lens ──────────────────────────────────────────────────────────────

// AnalyzeCollectionAgentLens scores every request in a collection for agent-readiness.
func (a *App) AnalyzeCollectionAgentLens(collID string) (agentlenspkg.CollectionScore, error) {
	if a.collections == nil {
		return agentlenspkg.CollectionScore{}, errors.New("no active workspace")
	}
	colls, err := a.collections.GetAll()
	if err != nil {
		return agentlenspkg.CollectionScore{}, err
	}
	var target *models.Collection
	for i := range colls {
		if colls[i].ID == collID {
			target = &colls[i]
			break
		}
	}
	if target == nil {
		return agentlenspkg.CollectionScore{}, errors.New("collection not found")
	}
	dir, _ := a.workspaces.ActiveDir()
	return agentlenspkg.AnalyzeCollection(*target, dir), nil
}

// AnalyzeAllCollectionsAgentLens scores all collections together (cross-collection duplicate detection).
func (a *App) AnalyzeAllCollectionsAgentLens() (agentlenspkg.CollectionScore, error) {
	if a.collections == nil {
		return agentlenspkg.CollectionScore{}, errors.New("no active workspace")
	}
	colls, err := a.collections.GetAll()
	if err != nil {
		return agentlenspkg.CollectionScore{}, err
	}
	dir, _ := a.workspaces.ActiveDir()
	return agentlenspkg.AnalyzeCollections(colls, dir), nil
}

// PreviewToolAgentLens returns the tool definition and lint score for a single request.
func (a *App) PreviewToolAgentLens(collID, requestID string) (agentlenspkg.ToolDefinition, agentlenspkg.ToolScore, error) {
	if a.collections == nil {
		return agentlenspkg.ToolDefinition{}, agentlenspkg.ToolScore{}, errors.New("no active workspace")
	}
	colls, err := a.collections.GetAll()
	if err != nil {
		return agentlenspkg.ToolDefinition{}, agentlenspkg.ToolScore{}, err
	}
	var req models.SavedRequest
	folderName := ""
	found := false
	for _, coll := range colls {
		for _, r := range coll.Requests {
			if r.ID == requestID {
				req = r
				folderName = coll.Name
				found = true
				break
			}
		}
		if found {
			break
		}
	}
	if !found {
		return agentlenspkg.ToolDefinition{}, agentlenspkg.ToolScore{}, errors.New("request not found")
	}
	dir, _ := a.workspaces.ActiveDir()
	tool, score := agentlenspkg.PreviewTool(req, folderName, colls, dir)
	return tool, score, nil
}

// RunEvalAgentLens runs all eval tasks against the configured AI provider.
func (a *App) RunEvalAgentLens() (*agentlenspkg.EvalSuiteResult, error) {
	if a.collections == nil {
		return nil, errors.New("no active workspace")
	}
	colls, err := a.collections.GetAll()
	if err != nil {
		return nil, err
	}
	dir, _ := a.workspaces.ActiveDir()
	return agentlenspkg.RunEvalSuite(dir, colls, 0.8)
}

// ExportMCPServerAgentLens generates a standalone MCP server module.
func (a *App) ExportMCPServerAgentLens() (*agentlenspkg.ExportResult, error) {
	if a.collections == nil {
		return nil, errors.New("no active workspace")
	}
	colls, err := a.collections.GetAll()
	if err != nil {
		return nil, err
	}
	dir, _ := a.workspaces.ActiveDir()
	scoreResult := agentlenspkg.AnalyzeCollections(colls, dir)
	return agentlenspkg.ExportMCPServer(dir, colls, scoreResult.Score, 1.0)
}

