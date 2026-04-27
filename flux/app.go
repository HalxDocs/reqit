package main

import (
	"context"
)

type App struct {
	ctx context.Context
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// SendRequest is the Wails-exported entry point that the React frontend calls
// to execute an HTTP request. Phase 1A is a placeholder; the real implementation
// lives in internal/requester (wired up in Phase 1C).
func (a *App) SendRequest(method, url string) map[string]any {
	return map[string]any{
		"status":     "200 OK",
		"statusCode": 200,
		"headers":    map[string]string{"X-Flux-Stub": "true"},
		"body":       "{\"stub\":\"placeholder\",\"method\":\"" + method + "\",\"url\":\"" + url + "\"}",
		"timingMs":   0,
		"sizeBytes":  0,
		"error":      "",
	}
}
