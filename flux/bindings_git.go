package main

import (
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	gitpkg "flux/internal/git"
)

type GitStatus struct {
	Initialised   bool   `json:"initialised"`
	HasChanges    bool   `json:"hasChanges"`
	CurrentBranch string `json:"currentBranch"`
	RemoteURL     string `json:"remoteUrl"`
	AutoSync      bool   `json:"autoSync"`
}

// BackupStatus reports whether the active workspace's data is actually safe on
// a remote. Everything here is derived live from git so the UI never has to
// guess whether a backup is working.
type BackupStatus struct {
	Workspace        string `json:"workspace"`
	IsRepo           bool   `json:"isRepo"`
	HasRemote        bool   `json:"hasRemote"`
	RemoteURL        string `json:"remoteUrl"`
	HasCredentials   bool   `json:"hasCredentials"`
	Uncommitted      bool   `json:"uncommitted"`
	UnpushedCommits  bool   `json:"unpushedCommits"`
	LastPushAt       string `json:"lastPushAt"`
	LastPushError    string `json:"lastPushError"`
	LastCommitAt     string `json:"lastCommitAt"`
	AutoSyncEnabled  bool   `json:"autoSyncEnabled"`
	AutoSyncDebounce int    `json:"autoSyncDebounceMs"`
	Healthy          bool   `json:"healthy"`
	Problems         string `json:"problems"`
}

// gitSyncState records the outcome of the most recent background sync so the UI
// can warn instead of failing silently.
type gitSyncState struct {
	mu         sync.Mutex
	lastPush   time.Time
	lastErr    string
	lastCommit time.Time
}

// autoSyncDebounce coalesces bursts of mutations (e.g. a collection import that
// fires a dozen binding calls) into a single commit+push.
const autoSyncDebounce = 2 * time.Second

func (a *App) setSyncResult(pushedAt time.Time, err error) {
	a.syncState.mu.Lock()
	defer a.syncState.mu.Unlock()
	if err != nil {
		a.syncState.lastErr = err.Error()
		return
	}
	a.syncState.lastErr = ""
	a.syncState.lastPush = pushedAt
}

// scheduleAutoSync queues a debounced sync, replacing any pending one. Rapid
// mutations collapse into a single commit so importing a large collection does
// not spawn dozens of concurrent pushes.
func (a *App) scheduleAutoSync(description string) {
	a.autoSyncMu.Lock()
	defer a.autoSyncMu.Unlock()
	if !a.autoSyncOn {
		return
	}
	if a.autoSyncTimer != nil {
		a.autoSyncTimer.Stop()
	}
	a.autoSyncTimer = time.AfterFunc(autoSyncDebounce, func() {
		a.syncNow(description)
	})
}

// syncNow performs pull -> commit -> push. Safe to call when auto-sync is off,
// which is what the manual path does.
func (a *App) syncNow(description string) {
	if a.git == nil {
		return
	}
	dir, err := a.workspaces.ActiveDir()
	if err != nil || dir == "" {
		return
	}
	p, err := a.profile.Get()
	if err != nil {
		return
	}
	pat := gitpkg.LoadPAT(dir)
	if pat == "" {
		// Without credentials nothing can leave this machine. Record it so the
		// health check can say so plainly instead of looking healthy.
		a.setSyncResult(time.Time{}, errors.New("no git credentials - changes are not backed up"))
		return
	}

	if err := a.git.Pull(pat); err != nil {
		a.setSyncResult(time.Time{}, fmt.Errorf("pull: %w", err))
		return
	}
	if a.git.HasChanges() {
		if err := a.git.CommitAll("[reqit] auto-sync: "+description, p.Name, p.Email); err != nil {
			a.setSyncResult(time.Time{}, fmt.Errorf("commit: %w", err))
			return
		}
		if t, err := a.git.LastCommitTime(); err == nil {
			a.syncState.mu.Lock()
			a.syncState.lastCommit = t
			a.syncState.mu.Unlock()
		}
	}
	if err := a.git.Push(pat); err != nil {
		a.setSyncResult(time.Time{}, fmt.Errorf("push: %w", err))
		return
	}
	a.setSyncResult(time.Now(), nil)
	runtime.EventsEmit(a.ctx, "git:sync:complete", nil)
}

func (a *App) GetGitStatus() GitStatus {
	if a.git == nil {
		return GitStatus{}
	}
	a.autoSyncMu.Lock()
	as := a.autoSyncOn
	a.autoSyncMu.Unlock()
	return GitStatus{
		Initialised:   true,
		HasChanges:    a.git.HasChanges(),
		CurrentBranch: a.git.CurrentBranch(),
		RemoteURL:     a.git.GetRemote(),
		AutoSync:      as,
	}
}

func (a *App) SetAutoSync(enabled bool) {
	a.autoSyncMu.Lock()
	a.autoSyncOn = enabled
	a.autoSyncMu.Unlock()
}

func (a *App) GetAutoSync() bool {
	a.autoSyncMu.Lock()
	defer a.autoSyncMu.Unlock()
	return a.autoSyncOn
}

// autoSync is called after a mutation. It now debounces so a burst of changes
// produces one commit and one push rather than one per call.
func (a *App) autoSync(description string) {
	a.scheduleAutoSync(description)
}

// GetBackupStatus reports, for the active workspace, whether its data is
// genuinely backed up — and if not, exactly what is missing.
func (a *App) GetBackupStatus() BackupStatus {
	st := BackupStatus{
		AutoSyncDebounce: int(autoSyncDebounce / time.Millisecond),
	}
	dir, err := a.workspaces.ActiveDir()
	if err != nil || dir == "" {
		st.Problems = "no active workspace"
		return st
	}
	st.Workspace = dir
	st.IsRepo = gitpkg.IsRepo(dir)

	a.autoSyncMu.Lock()
	st.AutoSyncEnabled = a.autoSyncOn
	a.autoSyncMu.Unlock()

	a.syncState.mu.Lock()
	lastPush, lastErr, lastCommit := a.syncState.lastPush, a.syncState.lastErr, a.syncState.lastCommit
	a.syncState.mu.Unlock()

	if !lastPush.IsZero() {
		st.LastPushAt = lastPush.Format(time.RFC3339)
	}
	if !lastCommit.IsZero() {
		st.LastCommitAt = lastCommit.Format(time.RFC3339)
	}
	st.LastPushError = lastErr

	if !st.IsRepo {
		st.Problems = "this workspace is not a git repository, so nothing is backed up"
		return st
	}

	st.RemoteURL = a.git.GetRemote()
	st.HasRemote = st.RemoteURL != ""
	st.HasCredentials = gitpkg.LoadPAT(dir) != ""
	st.Uncommitted = a.git.HasChanges()
	if unpushed, err := a.git.HasUnpushedCommits(); err == nil {
		st.UnpushedCommits = unpushed
	} else if st.RemoteURL != "" {
		st.UnpushedCommits = true
	}

	var problems []string
	if !st.HasRemote {
		problems = append(problems, "no remote configured - data stays on this machine")
	}
	if !st.HasCredentials {
		problems = append(problems, "no git credentials saved - pushes are disabled")
	}
	if st.LastPushError != "" {
		problems = append(problems, "last sync failed: "+st.LastPushError)
	}
	if !st.AutoSyncEnabled {
		problems = append(problems, "auto-sync is off - changes are only saved when you push manually")
	}

	st.Problems = strings.Join(problems, "; ")
	st.Healthy = len(problems) == 0 && !st.Uncommitted && !st.UnpushedCommits
	return st
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
		a.setSyncResult(time.Time{}, fmt.Errorf("commit: %w", err))
		return err
	}
	if t, err := a.git.LastCommitTime(); err == nil {
		a.syncState.mu.Lock()
		a.syncState.lastCommit = t
		a.syncState.mu.Unlock()
	}
	pat := gitpkg.LoadPAT(dir)
	if pat == "" {
		err := errors.New("no git credentials saved - committed locally but not pushed to the remote")
		a.setSyncResult(time.Time{}, err)
		return err
	}
	if err := a.git.Push(pat); err != nil {
		a.setSyncResult(time.Time{}, fmt.Errorf("push: %w", err))
		return err
	}
	a.setSyncResult(time.Now(), nil)
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

func (a *App) GetActiveContributors() ([]gitpkg.Contributor, error) {
	if a.git == nil {
		return []gitpkg.Contributor{}, nil
	}
	return a.git.GetActiveContributors()
}
