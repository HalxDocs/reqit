package main

import (
	"context"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	aipkg "flux/internal/ai"
	"flux/internal/audit"
	"flux/internal/collections"
	cookiestore "flux/internal/cookies"
	"flux/internal/crypto"
	"flux/internal/environments"
	"flux/internal/eventinspector"
	gitpkg "flux/internal/git"
	"flux/internal/growth"
	"flux/internal/grpc"
	"flux/internal/history"
	"flux/internal/interceptor"
	"flux/internal/locks"
	"flux/internal/masker"
	"flux/internal/mock"
	"flux/internal/models"
	"flux/internal/mqtt"
	"flux/internal/oauth2"
	"flux/internal/plugin"
	"flux/internal/profile"
	proxypkg "flux/internal/proxy"
	"flux/internal/rbac"
	reqpkg "flux/internal/requester"
	"flux/internal/runhistory"
	schedpkg "flux/internal/scheduler"
	"flux/internal/sock"
	"flux/internal/socketio"
	"flux/internal/sockhistory"
	"flux/internal/sso"
	"flux/internal/storage"
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
	proxyCfg     *proxypkg.Store

	mu       sync.Mutex
	inflight context.CancelFunc

	sock            *sock.Socket
	sockio          *socketio.Client
	sockHistory     *sockhistory.Store
	socketSessID    string // active raw WS/SSE session id
	sockioSessID    string // active Socket.IO session id
	mqttClient      *mqtt.Client
	oauthFlow       *oauthFlowState
	oauthFlowCancel context.CancelFunc
	oauthMu         sync.Mutex
	schedulerStor   *schedpkg.Store
	schedulerExec   *schedpkg.Executor
	autoSyncOn      bool
	autoSyncMu      sync.Mutex
	syncState       gitSyncState
	autoSyncTimer   *time.Timer
	eventInspector  *eventinspector.Store
	eventSecret     *eventinspector.SecretStore
	eventListener   *eventinspector.Listener
	runHistory      *runhistory.Store
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

	// Init proxy config.
	if dataDir, err := a.AppDataDir(); err == nil {
		a.proxyCfg = proxypkg.NewStore(dataDir)
		reqpkg.SetGlobalProxy(a.proxyCfg.Get())
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

	// Report backup health on launch so an unbacked-up workspace is visible
	// before the user has done anything, not only after a failed push.
	go func() {
		runtime.EventsEmit(a.ctx, "git:backup:status", a.GetBackupStatus())
	}()

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

	// Wire gRPC streaming session callbacks.
	grpc.SetSessionEventCallback(func(ev models.GRPCStreamEvent) {
		runtime.EventsEmit(a.ctx, "grpc:session", ev)
	})
}

func (a *App) shutdown(ctx context.Context) {
	if a.interceptor != nil {
		_ = a.interceptor.Stop()
	}
	if a.collections != nil {
		a.collections.Flush()
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
	a.cleanupOAuthFlow()
	if a.eventListener != nil {
		_ = a.eventListener.Stop()
	}
}

// Called at startup and whenever the user switches workspaces.
func (a *App) mountWorkspace(dir string) {
	// Scope OAuth keyring entries to this workspace.
	oauth2.SetWorkspaceKey(oauth2.WorkspaceKeyFromDir(dir))

	// Ensure .reqit/ directory structure exists for Git-native storage.
	_ = gitpkg.ReqitInit(dir)

	// Move data written by older versions out of the repository root and into
	// .reqit/. The ignore rules reqit writes are written for those paths, so
	// before this the files landed where they were not protected — an API key
	// in an environment was committed and pushed.
	if moved, err := storage.MigrateToDataDir(dir); err == nil && len(moved) > 0 {
		log.Printf("reqit: moved %d file(s) into .reqit/: %s", len(moved), strings.Join(moved, ", "))
	}

	// Ensure .gitignore protects secret files from being committed.
	a.ensureWorkspaceGitignore(dir)

	a.collections = collections.NewStore(dir)
	a.history = history.NewStore(dir)
	a.runHistory = runhistory.NewStore(dir)
	a.sockHistory = sockhistory.NewStore(dir)
	a.environments = environments.NewStore(dir, a.crypto)
	a.locks = locks.New(dir)
	a.cookies = cookiestore.New(dir)
	a.testSuites = testbuilder.NewStore(dir)

	// Event Inspector: workspace-scoped event store + shared secret/listener.
	a.eventInspector = eventinspector.NewStore(dir)
	a.eventSecret = eventinspector.NewSecretStore()
	if a.eventListener != nil {
		a.eventListener.Stop()
	}
	a.eventListener = eventinspector.NewListener(a.eventInspector, a.eventSecret)
	a.eventListener.OnCapture(func(rec models.EventRecord) {
		runtime.EventsEmit(a.ctx, "eventinspector:changed", rec)
	})

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
			// Environment values hold API keys, so they stay local. The
			// environment structure itself is not secret and is kept so the
			// names of the variables are shared.
			".reqit/environments.json\n" +
			// Session cookies and captured traffic are credentials.
			".reqit/cookies.json\n" +
			".reqit/interceptor/\n" +
			// AI provider keys and agent-lens configuration.
			".reqit/ai.json\n" +
			// Lock files are runtime state.
			".reqit/locks/\n" +
			"*.log\n",
	)
	// Only write if file doesn't exist — don't overwrite user's custom gitignore.
	if _, err := os.Stat(gitignorePath); os.IsNotExist(err) {
		_ = os.WriteFile(gitignorePath, secretPatterns, 0644)
	}
}

// --- Workspaces ---

func (a *App) SendNotification(title, message string) {
	if a.tray != nil {
		a.tray.ShowNotification(title, message)
	}
}

// --- CLI Runner Script ---

// ---------------------------------------------------------------------------
// Growth & Community — Wails bindings
// ---------------------------------------------------------------------------
