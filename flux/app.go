package main

import (
	"context"

	"flux/internal/models"
	"flux/internal/requester"
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
// to execute an HTTP request. It delegates to the requester package and returns
// a ResponseResult that is JSON-serialised across the IPC bridge.
func (a *App) SendRequest(payload models.RequestPayload) models.ResponseResult {
	return requester.Execute(payload)
}
