package main

import (
	"errors"
	"flux/internal/audit"
	"flux/internal/collections"
	"flux/internal/environments"
	"flux/internal/history"
	"flux/internal/runhistory"
	"flux/internal/sockhistory"
	"flux/internal/workspaces"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

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
	if a.audit != nil {
		_ = a.audit.Log("user", audit.ActionCreate, "workspace", info.ID, "", map[string]string{"name": name})
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
	if a.audit != nil {
		_ = a.audit.Log("user", audit.ActionDelete, "workspace", id, "", nil)
	}
	// Re-mount whatever is now active (may be empty).
	if dir, err := a.workspaces.ActiveDir(); err == nil && dir != "" {
		a.mountWorkspace(dir)
	} else {
		a.collections = collections.NewStore("")
		a.history = history.NewStore("")
		a.runHistory = runhistory.NewStore("")
		a.sockHistory = sockhistory.NewStore("")
		a.environments = environments.NewStore("", a.crypto)
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
