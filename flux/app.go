package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"github.com/blang/semver/v4"

	"flux/internal/audit"
	aipkg "flux/internal/ai"
	"flux/internal/collections"
	cookiestore "flux/internal/cookies"
	"flux/internal/crypto"
	"flux/internal/environments"
	gitpkg "flux/internal/git"
	"flux/internal/growth"
	"flux/internal/history"
	"flux/internal/interceptor"
	"flux/internal/jwt"
	"flux/internal/locks"
	"flux/internal/masker"
	"flux/internal/mock"
	"flux/internal/models"
	"flux/internal/mqtt"
	"flux/internal/oauth2"
	"flux/internal/openapi"
	"flux/internal/plugin"
	"flux/internal/profile"
	"flux/internal/rbac"
	"flux/internal/sso"
	"flux/internal/storage"
	schedpkg "flux/internal/scheduler"
	"flux/internal/sock"
	"flux/internal/socketio"
	"flux/internal/telemetry"
	"flux/internal/testbuilder"
	traypkg "flux/internal/tray"
	"flux/internal/updater"
	"flux/internal/vault"
	"flux/internal/watcher"
	"flux/internal/workspaces"

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
	sockio     *socketio.Client
	mqttClient     *mqtt.Client
	oauthState     *oauth2.State
	oauthMu        sync.Mutex
	schedulerStor  *schedpkg.Store
	schedulerExec  *schedpkg.Executor
	autoSyncOn     bool
	autoSyncMu     sync.Mutex
}

func NewApp() *App {
	return &App{
		workspaces: workspaces.NewStore(),
		profile:    profile.NewStore(),
		sock:       sock.New(),
		sockio:     socketio.NewClient(),
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

	// Wire Socket.IO event callbacks.
	a.sockio.OnEvent(func(msg models.SocketMessage) {
		runtime.EventsEmit(a.ctx, "socket:message", msg)
	})
	a.sockio.OnStatus(func(status string) {
		runtime.EventsEmit(a.ctx, "socket:status", status)
	})
}

func (a *App) shutdown(ctx context.Context) {
	if a.interceptor != nil {
		_ = a.interceptor.Stop()
	}
	if a.audit != nil {
		_ = a.audit.Close()
	}
	if a.schedulerExec != nil {
		a.schedulerExec.Stop()
	}
	if a.mockServer != nil {
		_ = a.mockServer.Stop()
	}
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
		return []plugin.RegisteredPlugin{}
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
		if err := a.plugins.Registry.Discover(); err != nil {
			return err
		}
		runtime.EventsEmit(a.ctx, "plugins:changed", nil)
	}
	return nil
}

func (a *App) RemovePlugin(name string) error {
	if a.plugins == nil {
		return errors.New("plugin system not initialized")
	}
	if err := a.plugins.Registry.Remove(name); err != nil {
		return err
	}
	runtime.EventsEmit(a.ctx, "plugins:changed", nil)
	return nil
}

func (a *App) InstallUpdate(manifest updater.UpdateManifest) error {
	u := &updater.Updater{CurrentVersion: updater.CurrentVersion}
	return u.Apply(a.ctx, manifest)
}

// mountWorkspace reinitializes the scoped stores with a new data directory.
// Called at startup and whenever the user switches workspaces.
func (a *App) mountWorkspace(dir string) {
	// Ensure .reqit/ directory structure exists for Git-native storage.
	_ = gitpkg.ReqitInit(dir)

	// Ensure .gitignore protects secret files from being committed.
	a.ensureWorkspaceGitignore(dir)

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

	// Init scheduler store + executor for this workspace.
	a.schedulerStor = schedpkg.NewStore(dir)
	if a.schedulerExec != nil {
		a.schedulerExec.Stop()
	}
	a.schedulerExec = schedpkg.NewExecutor(a.schedulerStor, a.collections)
	a.schedulerExec.OnRun(func(results []models.CollectionRunResult) {
		runtime.EventsEmit(a.ctx, "scheduler:run", results)
	})
	a.schedulerExec.Start(a.ctx)
}

// ensureWorkspaceGitignore creates a .gitignore in the workspace root that
// excludes sensitive files from being committed to git.
func (a *App) ensureWorkspaceGitignore(dir string) {
	gitignorePath := filepath.Join(dir, ".gitignore")
	secretPatterns := []byte(
		"# Protect secrets from being committed\n" +
			"*.env\n" +
			"*.env.*\n" +
			"*.key\n" +
			"*.pem\n" +
			"*.p12\n" +
			"*.pfx\n" +
			"*.cert\n" +
			"*.crt\n" +
			"**/secrets.json\n" +
			"**/credentials.json\n" +
			".reqit/ai.json\n" +
			".reqit/cookies.json\n" +
			".reqit/interceptor/\n" +
			"*.log\n",
	)
	// Only write if file doesn't exist — don't overwrite user's custom gitignore.
	if _, err := os.Stat(gitignorePath); os.IsNotExist(err) {
		_ = os.WriteFile(gitignorePath, secretPatterns, 0644)
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
		a.collections = collections.NewStore("")
		a.history = history.NewStore("")
		a.environments = environments.NewStore("")
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

// --- Scheduler ---

func (a *App) GetSchedules() ([]schedpkg.ScheduledRun, error) {
	if a.schedulerStor == nil {
		return nil, errors.New("no active workspace")
	}
	return a.schedulerStor.GetAll()
}

func (a *App) CreateSchedule(id, collectionID, name, cronExpr string, enabled bool) error {
	if a.schedulerStor == nil {
		return errors.New("no active workspace")
	}
	return a.schedulerStor.Create(schedpkg.ScheduledRun{
		ID:           id,
		CollectionID: collectionID,
		Name:         name,
		CronExpr:     cronExpr,
		Enabled:      enabled,
	})
}

func (a *App) UpdateSchedule(id string, name, cronExpr *string, enabled *bool) error {
	if a.schedulerStor == nil {
		return errors.New("no active workspace")
	}
	patch := map[string]interface{}{}
	if name != nil {
		patch["name"] = *name
	}
	if cronExpr != nil {
		patch["cronExpr"] = *cronExpr
	}
	if enabled != nil {
		patch["enabled"] = *enabled
	}
	return a.schedulerStor.Update(id, patch)
}

func (a *App) DeleteSchedule(id string) error {
	if a.schedulerStor == nil {
		return errors.New("no active workspace")
	}
	return a.schedulerStor.Delete(id)
}

func (a *App) GetSchedulerHistory(scheduleID string, limit int) string {
	if a.schedulerStor == nil {
		return "[]"
	}
	records, err := a.schedulerStor.GetHistory(scheduleID, limit)
	if err != nil {
		return "[]"
	}
	data, _ := json.Marshal(records)
	return string(data)
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
	url, state, err := o.AuthorizeURL()
	if err != nil {
		return "", "", err
	}
	a.oauthMu.Lock()
	a.oauthState = o
	a.oauthMu.Unlock()
	return url, state, nil
}

func (a *App) OAuth2Exchange(authURL, tokenURL, clientID, clientSecret, scopes, redirectURI, code string, usePKCE bool) (*models.OAuth2TokenResponse, error) {
	a.oauthMu.Lock()
	o := a.oauthState
	a.oauthMu.Unlock()
	if o == nil {
		o = oauth2.New(oauth2.OAuth2Config{
			AuthURL:      authURL,
			TokenURL:     tokenURL,
			ClientID:     clientID,
			ClientSecret: clientSecret,
			Scopes:       scopes,
			RedirectURI:  redirectURI,
			UsePKCE:      usePKCE,
		})
	}
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
	// Write icons
	iconsDir := filepath.Join(dir, "icons")
	if err := os.MkdirAll(iconsDir, 0755); err != nil {
		return err
	}
	iconFiles := []struct{ name string; data []byte }{
		{"icon16.png", interceptor.Icon16},
		{"icon48.png", interceptor.Icon48},
		{"icon128.png", interceptor.Icon128},
	}
	for _, ic := range iconFiles {
		if err := os.WriteFile(filepath.Join(iconsDir, ic.name), ic.data, 0644); err != nil {
			return err
		}
	}
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

// --- CLI Runner Script ---












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

// --- AI --- (moved to bindings_ai.go)

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
	return fmt.Sprintf("https://reqit.dev/%s", pub.Username), nil
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

// Agent Lens (moved to bindings_ai.go)

