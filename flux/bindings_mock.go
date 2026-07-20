package main

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"flux/internal/mock"
	"flux/internal/models"
)

type MockStatus struct {
	Running    bool     `json:"running"`
	Port       int      `json:"port"`
	RouteCount int      `json:"routeCount"`
	BaseURL    string   `json:"baseUrl"`
	Routes     []string `json:"routes"`
	Recording  bool     `json:"recording"`
}

func (a *App) StartMockServer(port int) (MockStatus, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.mockServer != nil {
		return MockStatus{}, errors.New("mock server already running")
	}
	var cols []models.Collection
	if a.collections != nil {
		cols, _ = a.collections.GetAll()
	}
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
		Recording:  a.mockServer.Recording().Enabled(),
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
		Recording:  a.mockServer.Recording().Enabled(),
	}
}

func (a *App) ToggleMockRecording(enable bool) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.mockServer == nil {
		return errors.New("mock server not running")
	}
	if enable {
		a.mockServer.Recording().Enable()
	} else {
		a.mockServer.Recording().Disable()
	}
	s := MockStatus{
		Running:    true,
		Port:       a.mockServer.Port,
		RouteCount: a.mockReg.Count(),
		BaseURL:    fmt.Sprintf("http://localhost:%d", a.mockServer.Port),
		Routes:     a.mockReg.Routes(),
		Recording:  a.mockServer.Recording().Enabled(),
	}
	runtime.EventsEmit(a.ctx, "mock:updated", s)
	return nil
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
	entries, err := a.history.GetAll()
	if err != nil || len(entries) == 0 {
		return errors.New("no recent response to save")
	}
	last := entries[len(entries)-1]
	resp := models.SavedResponse{
		StatusCode: last.Response.StatusCode,
		Headers:    last.Response.Headers,
		Body:       last.Response.Body,
		CapturedAt: time.Now().Format(time.RFC3339),
	}
	return a.collections.SetSavedResponse(colID, reqID, resp)
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
