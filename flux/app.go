package main

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"sync"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"flux/internal/collections"
	"flux/internal/contract"
	cookiestore "flux/internal/cookies"
	"flux/internal/environments"
	gitpkg "flux/internal/git"
	"flux/internal/history"
	"flux/internal/locks"
	"flux/internal/mock"
	"flux/internal/models"
	"flux/internal/openapi"
	"flux/internal/postman"
	"flux/internal/profile"
	"flux/internal/requester"
	"flux/internal/storage"
	"flux/internal/runner"
	"flux/internal/sock"
	"flux/internal/updater"
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
	git          *gitpkg.Store
	locks        *locks.Store
	cookies      *cookiestore.Store
	fsWatcher    *watcher.Watcher
	mockReg      *mock.Registry
	mockServer   *mock.MockServer

	mu       sync.Mutex
	inflight context.CancelFunc

	sock *sock.Socket
}

func NewApp() *App {
	return &App{
		workspaces: workspaces.NewStore(),
		profile:    profile.NewStore(),
		sock:       sock.New(),
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	_ = a.profile.MarkLaunch()

	// Migrate legacy flat-file data into a Default workspace if needed.
	_ = a.workspaces.Migrate()

	// Re-attach scoped stores to the active workspace (if one exists).
	if dir, err := a.workspaces.ActiveDir(); err == nil && dir != "" {
		a.mountWorkspace(dir)
	}

	// Check for updates in the background — emit event if one is found.
	go func() {
		info, found, err := updater.Check()
		if err != nil || !found {
			return
		}
		runtime.EventsEmit(a.ctx, "update:available", info)
	}()

	// Wire socket event callbacks.
	a.sock.OnEvent(func(msg models.SocketMessage) {
		runtime.EventsEmit(a.ctx, "socket:message", msg)
	})
	a.sock.OnStatus(func(status string) {
		runtime.EventsEmit(a.ctx, "socket:status", status)
	})
}

func (a *App) CheckForUpdates() *updater.UpdateInfo {
	info, found, err := updater.Check()
	if err != nil || !found {
		return nil
	}
	return &info
}

func (a *App) GetVersion() string {
	return updater.CurrentVersion
}

// RunCollection executes all requests in a resolved payload set with the given
// assertions and returns pass/fail results for each request.
func (a *App) RunCollection(reqs []models.RunnerRequest, assertions map[string]models.Assertion) models.CollectionRunResult {
	return runner.RunCollection(reqs, assertions, a.cookies)
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
	a.collections = collections.NewStore(dir)
	a.history = history.NewStore(dir)
	a.environments = environments.NewStore(dir)
	a.locks = locks.New(dir)
	a.cookies = cookiestore.New(dir)

	// Stop previous watcher if any.
	if a.fsWatcher != nil {
		a.fsWatcher.Close()
		a.fsWatcher = nil
	}

	// Start file watcher — emits workspace:changed so the frontend can reload.
	if w, err := watcher.New(func(filename string) {
		runtime.EventsEmit(a.ctx, "workspace:changed", filename)
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

	result := requester.Execute(ctx, payload, a.cookies)

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

// --- Mock Server ---

// MockStatus is returned by mock server methods.
type MockStatus struct {
	Running    bool     `json:"running"`
	Port       int      `json:"port"`
	RouteCount int      `json:"routeCount"`
	BaseURL    string   `json:"baseUrl"`
	Routes     []string `json:"routes"`
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
	}
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


