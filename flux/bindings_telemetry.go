package main

import (
	"flux/internal/telemetry"
)

func (a *App) GetTelemetryConfig() TelemetryConfig {
	if a.telemetry == nil {
		return TelemetryConfig{Enabled: false}
	}
	return TelemetryConfig{Enabled: a.telemetry.IsEnabled()}
}

func (a *App) SetTelemetryEnabled(enabled bool) {
	if a.telemetry != nil {
		a.telemetry.SetEnabled(enabled)
	}
}

func (a *App) GetTelemetryPreview() string {
	if a.telemetry == nil {
		return ""
	}
	return a.telemetry.Preview()
}

// --- Proxy ---

func (a *App) GetTelemetryEvents(limit int) []telemetry.Event {
	if a.telemetry == nil {
		return nil
	}
	return a.telemetry.GetRecentEvents(limit)
}

// --- Notifications ---
