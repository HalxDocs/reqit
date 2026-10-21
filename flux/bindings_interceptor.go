package main

import (
	"errors"
	"flux/internal/interceptor"
	"flux/internal/telemetry"
	"os"
	"path/filepath"
)

func (a *App) StartInterceptor() (int, error) {
	if a.interceptor == nil {
		return 0, errors.New("interceptor not initialised")
	}
	port, err := a.interceptor.Start()
	if err != nil {
		return 0, err
	}
	if a.telemetry != nil {
		a.telemetry.Track(telemetry.EventIntegration, "interceptor_start", nil)
	}
	return port, nil
}

func (a *App) StopInterceptor() error {
	if a.interceptor == nil {
		return errors.New("interceptor not initialised")
	}
	return a.interceptor.Stop()
}

func (a *App) GetInterceptorStatus() InterceptorStatus {
	if a.interceptor == nil {
		return InterceptorStatus{}
	}
	return InterceptorStatus{
		Running: a.interceptor.IsRunning(),
		Port:    a.interceptor.Port(),
		Count:   len(a.interceptor.GetCaptured()),
	}
}

func (a *App) GetCapturedRequests() []interceptor.CapturedRequest {
	if a.interceptor == nil {
		return nil
	}
	return a.interceptor.GetCaptured()
}

func (a *App) ClearCapturedRequests() {
	if a.interceptor != nil {
		a.interceptor.ClearCaptured()
	}
}

// ExportExtension writes the Chrome extension source to a directory.
func (a *App) ExportExtension(dir string) error {
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	// Write manifest
	if err := os.WriteFile(filepath.Join(dir, "manifest.json"), interceptor.ChromeExtensionManifest("reqit Interceptor"), 0644); err != nil {
		return err
	}
	// Write embedded assets
	if err := os.WriteFile(filepath.Join(dir, "background.js"), []byte(interceptor.BackgroundJS), 0644); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(dir, "popup.html"), []byte(interceptor.PopupHTML), 0644); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(dir, "popup.js"), []byte(interceptor.PopupJS), 0644); err != nil {
		return err
	}
	// Write icons
	iconsDir := filepath.Join(dir, "icons")
	if err := os.MkdirAll(iconsDir, 0755); err != nil {
		return err
	}
	iconFiles := []struct {
		name string
		data []byte
	}{
		{"icon16.png", interceptor.Icon16},
		{"icon48.png", interceptor.Icon48},
		{"icon128.png", interceptor.Icon128},
	}
	for _, ic := range iconFiles {
		if err := os.WriteFile(filepath.Join(iconsDir, ic.name), ic.data, 0644); err != nil {
			return err
		}
	}
	return nil
}

// --- Telemetry ---

type TelemetryConfig struct {
	Enabled bool `json:"enabled"`
}
