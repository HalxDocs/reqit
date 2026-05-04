package main

import (
	"context"
	"errors"
	"sync"

	"github.com/google/uuid"
	"github.com/wailsapp/wails/v2/pkg/runtime"

	"flux/internal/collections"
	"flux/internal/environments"
	gitpkg "flux/internal/git"
	"flux/internal/history"
	"flux/internal/locks"
	"flux/internal/models"
	"flux/internal/postman"
	"flux/internal/profile"
	"flux/internal/requester"
	"flux/internal/storage"
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
	fsWatcher    *watcher.Watcher

	mu       sync.Mutex
	inflight context.CancelFunc
}

func NewApp() *App {
	return &App{
		workspaces: workspaces.NewStore(),
		profile:    profile.NewStore(),
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
}

// mountWorkspace reinitializes the scoped stores with a new data directory.
// Called at startup and whenever the user switches workspaces.
func (a *App) mountWorkspace(dir string) {
	a.collections = collections.NewStore(dir)
	a.history = history.NewStore(dir)
	a.environments = environments.NewStore(dir)
	a.locks = locks.New(dir)

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

	result := requester.Execute(ctx, payload)

	a.mu.Lock()
	if a.inflight != nil {
		a.inflight = nil
	}
	a.mu.Unlock()
	cancel()

	if a.history != nil {
		_ = a.history.Append(payload, result)
	}
	if result.Error == "" {
		_ = a.profile.IncrementRequestCount()
	}
	return result
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

var _ = uuid.NewString
