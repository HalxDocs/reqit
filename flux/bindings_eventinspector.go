package main

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/wailsapp/wails/v2/pkg/runtime"

	"flux/internal/models"
	"flux/internal/requester"
)

// --- Event Inspector: capture / verify ---

// EventInspectorStart launches the local webhook capture listener on a
// loopback-only ephemeral port and returns the bound port.
func (a *App) EventInspectorStart() (int, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.eventInspector == nil {
		return 0, errors.New("event inspector not ready")
	}
	if a.eventListener != nil && a.eventListener.IsRunning() {
		return a.eventListener.Port(), nil
	}
	port, err := a.eventListener.Start()
	if err != nil {
		return 0, err
	}
	a.emitEventInspectorChanged()
	return port, nil
}

// EventInspectorStop shuts down the capture listener.
func (a *App) EventInspectorStop() error {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.eventListener == nil {
		return nil
	}
	if err := a.eventListener.Stop(); err != nil {
		return err
	}
	a.emitEventInspectorChanged()
	return nil
}

// EventInspectorStatus reports listener state and stored event count.
func (a *App) EventInspectorStatus() models.EventInspectorStatus {
	a.mu.Lock()
	defer a.mu.Unlock()
	st := models.EventInspectorStatus{}
	if a.eventListener != nil {
		st.Running = a.eventListener.IsRunning()
		st.Port = a.eventListener.Port()
	}
	if a.eventInspector != nil {
		if n, err := a.eventInspector.Count(); err == nil {
			st.Count = n
		}
	}
	if a.eventSecret != nil {
		st.HasSecret = a.eventSecret.Has()
	}
	return st
}

// EventInspectorGetEvents lists captured events, newest first.
func (a *App) EventInspectorGetEvents() ([]models.EventRecord, error) {
	if a.eventInspector == nil {
		return nil, errors.New("event inspector not ready")
	}
	return a.eventInspector.GetAll()
}

// EventInspectorGetEvent returns a single captured event.
func (a *App) EventInspectorGetEvent(id string) (models.EventRecord, error) {
	if a.eventInspector == nil {
		return models.EventRecord{}, errors.New("event inspector not ready")
	}
	return a.eventInspector.Get(id)
}

// EventInspectorSetSecret stores the webhook signing secret in the OS keychain.
func (a *App) EventInspectorSetSecret(secret string) error {
	if a.eventSecret == nil {
		return errors.New("event inspector not ready")
	}
	if err := a.eventSecret.Set(secret); err != nil {
		return err
	}
	a.emitEventInspectorChanged()
	return nil
}

// EventInspectorHasSecret reports whether a signing secret is configured.
func (a *App) EventInspectorHasSecret() bool {
	if a.eventSecret == nil {
		return false
	}
	return a.eventSecret.Has()
}

// EventInspectorDeleteSecret removes the stored signing secret.
func (a *App) EventInspectorDeleteSecret() error {
	if a.eventSecret == nil {
		return nil
	}
	if err := a.eventSecret.Delete(); err != nil {
		return err
	}
	a.emitEventInspectorChanged()
	return nil
}

// EventInspectorDelete removes a captured event.
func (a *App) EventInspectorDelete(id string) error {
	if a.eventInspector == nil {
		return nil
	}
	if err := a.eventInspector.Delete(id); err != nil {
		return err
	}
	a.emitEventInspectorChanged()
	return nil
}

// EventInspectorClear removes all captured events.
func (a *App) EventInspectorClear() error {
	if a.eventInspector == nil {
		return nil
	}
	if err := a.eventInspector.Clear(); err != nil {
		return err
	}
	a.emitEventInspectorChanged()
	return nil
}

// --- Event Inspector: replay ---

// EventInspectorReplay resends a captured event payload to a target URL
// through the normal request pipeline. Hop-by-hop headers are stripped; Svix
// signature headers are dropped unless preserveSvix is set (they are bound to
// the original delivery and only meaningful to the original endpoint).
func (a *App) EventInspectorReplay(id, targetURL string, preserveSvix bool) (models.ResponseResult, error) {
	if a.eventInspector == nil {
		return models.ResponseResult{}, errors.New("event inspector not ready")
	}
	rec, err := a.eventInspector.Get(id)
	if err != nil {
		return models.ResponseResult{}, err
	}
	if rec.ID == "" {
		return models.ResponseResult{}, fmt.Errorf("event %q not found", id)
	}

	headers := filterReplayHeaders(rec.Headers, preserveSvix)
	payload := models.RequestPayload{
		Method:   "POST",
		URL:      targetURL,
		Body:     rec.Body,
		BodyType: "json",
	}
	for k, v := range headers {
		payload.Headers = append(payload.Headers, models.Header{Key: k, Value: v, Enabled: true})
	}
	if rec.ContentType != "" {
		payload.Headers = append(payload.Headers, models.Header{Key: "Content-Type", Value: rec.ContentType, Enabled: true})
	}

	result := requester.Execute(context.Background(), payload, a.cookies)

	replay := models.EventReplay{
		ID:        uuid.NewString(),
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		TargetURL: targetURL,
		Status:    result.StatusCode,
		Error:     result.Error,
	}
	if err := a.eventInspector.RecordReplay(id, replay); err != nil {
		return result, err
	}
	a.emitEventInspectorChanged()
	return result, nil
}

// filterReplayHeaders strips hop-by-hop headers and (optionally) Svix
// delivery headers from a captured event before replay.
func filterReplayHeaders(headers map[string]string, preserveSvix bool) map[string]string {
	hopByHop := map[string]bool{
		"connection":          true,
		"keep-alive":          true,
		"transfer-encoding":   true,
		"te":                  true,
		"trailer":             true,
		"proxy-connection":    true,
		"proxy-authorization": true,
		"upgrade":             true,
		"content-length":      true,
	}
	out := map[string]string{}
	for k, v := range headers {
		lk := strings.ToLower(strings.TrimSpace(k))
		if hopByHop[lk] {
			continue
		}
		if !preserveSvix && (lk == "svix-id" || lk == "svix-timestamp" || lk == "svix-signature") {
			continue
		}
		out[k] = v
	}
	return out
}

func (a *App) emitEventInspectorChanged() {
	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "eventinspector:changed", nil)
	}
}
