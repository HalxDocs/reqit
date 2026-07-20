package main

import (
	"errors"
	"strconv"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	cookiestore "flux/internal/cookies"
	"flux/internal/environments"
	"flux/internal/locks"
	"flux/internal/models"
)

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
	c, err := a.collections.CreateCollection(name)
	if err == nil {
		go a.autoSync("create collection " + name)
	}
	return c, err
}

func (a *App) RenameCollection(id, name string) error {
	if a.collections == nil {
		return errors.New("no active workspace")
	}
	if err := a.collections.RenameCollection(id, name); err != nil {
		return err
	}
	go a.autoSync("rename collection to " + name)
	return nil
}

func (a *App) DeleteCollection(id string) error {
	if a.collections == nil {
		return errors.New("no active workspace")
	}
	if err := a.collections.DeleteCollection(id); err != nil {
		return err
	}
	go a.autoSync("delete collection " + id)
	return nil
}

func (a *App) AddRequestToCollection(collID, name string, payload models.RequestPayload) (models.SavedRequest, error) {
	if a.collections == nil {
		return models.SavedRequest{}, errors.New("no active workspace")
	}
	r, err := a.collections.AddRequest(collID, name, payload)
	if err == nil {
		go a.autoSync("add request " + name)
	}
	return r, err
}

func (a *App) UpdateSavedRequest(reqID, name string, payload models.RequestPayload) error {
	if a.collections == nil {
		return errors.New("no active workspace")
	}
	if err := a.collections.UpdateRequest(reqID, name, payload); err != nil {
		return err
	}
	go a.autoSync("update request " + name)
	return nil
}

func (a *App) UpdateScriptRules(reqID string, preSetVars []models.PreSetVar, extractRules []models.ExtractRule) error {
	if a.collections == nil {
		return errors.New("no active workspace")
	}
	if err := a.collections.UpdateRequestScripts(reqID, preSetVars, extractRules); err != nil {
		return err
	}
	go a.autoSync("update script rules for " + reqID)
	return nil
}

func (a *App) DeleteSavedRequest(reqID string) error {
	if a.collections == nil {
		return errors.New("no active workspace")
	}
	if err := a.collections.DeleteRequest(reqID); err != nil {
		return err
	}
	go a.autoSync("delete request " + reqID)
	return nil
}

func (a *App) DeleteSavedRequests(reqIDs []string) error {
	if a.collections == nil {
		return errors.New("no active workspace")
	}
	if err := a.collections.DeleteRequests(reqIDs); err != nil {
		return err
	}
	go a.autoSync("delete " + strconv.Itoa(len(reqIDs)) + " requests")
	return nil
}

func (a *App) ReorderCollection(id string, newIndex int) error {
	if a.collections == nil {
		return errors.New("no active workspace")
	}
	if err := a.collections.ReorderCollection(id, newIndex); err != nil {
		return err
	}
	go a.autoSync("reorder collection " + id)
	return nil
}

func (a *App) ReorderRequest(collID, reqID string, newIndex int) error {
	if a.collections == nil {
		return errors.New("no active workspace")
	}
	if err := a.collections.ReorderRequest(collID, reqID, newIndex); err != nil {
		return err
	}
	go a.autoSync("reorder request " + reqID)
	return nil
}

func (a *App) MoveRequest(reqID, targetCollID string) error {
	if a.collections == nil {
		return errors.New("no active workspace")
	}
	if err := a.collections.MoveRequest(reqID, targetCollID); err != nil {
		return err
	}
	go a.autoSync("move request " + reqID)
	return nil
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
	e, err := a.environments.Create(name)
	if err == nil {
		go a.autoSync("create environment " + name)
	}
	return e, err
}

func (a *App) UpdateEnvironment(id, name string, vars []models.EnvVar) error {
	if a.environments == nil {
		return errors.New("no active workspace")
	}
	if err := a.environments.Update(id, name, vars); err != nil {
		return err
	}
	go a.autoSync("update environment " + name)
	return nil
}

func (a *App) DeleteEnvironment(id string) error {
	if a.environments == nil {
		return errors.New("no active workspace")
	}
	if err := a.environments.Delete(id); err != nil {
		return err
	}
	go a.autoSync("delete environment " + id)
	return nil
}

func (a *App) SetActiveEnvironment(id string) error {
	if a.environments == nil {
		return errors.New("no active workspace")
	}
	if err := a.environments.SetActive(id); err != nil {
		return err
	}
	go a.autoSync("set active environment " + id)
	return nil
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

func (a *App) SetCollectionVariables(collID string, vars []models.EnvVar) error {
	if a.collections == nil {
		return errors.New("no active workspace")
	}
	if err := a.collections.SetCollectionVariables(collID, vars); err != nil {
		return err
	}
	go a.autoSync("update collection variables " + collID)
	return nil
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
