package main

import (
	"errors"

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

func (a *App) autoSync(description string) {
	a.autoSyncMu.Lock()
	enabled := a.autoSyncOn
	a.autoSyncMu.Unlock()
	if !enabled || a.git == nil {
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
		return
	}
	_ = a.git.Pull(pat)
	if a.git.HasChanges() {
		_ = a.git.CommitAll("[reqit] auto-sync: "+description, p.Name, p.Email)
		_ = a.git.Push(pat)
	}
	runtime.EventsEmit(a.ctx, "git:sync:complete", nil)
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

func (a *App) GetActiveContributors() ([]gitpkg.Contributor, error) {
	if a.git == nil {
		return []gitpkg.Contributor{}, nil
	}
	return a.git.GetActiveContributors()
}
