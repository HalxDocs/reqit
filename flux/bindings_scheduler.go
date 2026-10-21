package main

import (
	"encoding/json"
	"errors"
	schedpkg "flux/internal/scheduler"
)

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
// OAuth2 flows live in bindings_oauth2.go (loopback callback + device grant).

// --- JWT ---
