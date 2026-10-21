package main

import (
	"flux/internal/updater"
	"github.com/blang/semver/v4"
)

func (a *App) CheckForUpdates() *updater.UpdateManifest {
	m, err := (&updater.Updater{CurrentVersion: updater.CurrentVersion}).FetchManifest(a.ctx)
	if err != nil {
		return nil
	}
	current, _ := semver.ParseTolerant(updater.CurrentVersion)
	latest, _ := semver.ParseTolerant(m.Version)
	if latest.GT(current) {
		return m
	}
	return nil
}

func (a *App) GetVersion() string {
	return updater.CurrentVersion
}

func (a *App) InstallUpdate(manifest updater.UpdateManifest) error {
	u := &updater.Updater{CurrentVersion: updater.CurrentVersion}
	return u.Apply(a.ctx, manifest)
}

func (a *App) RestartApp() error {
	return updater.RestartApp()
}

// mountWorkspace reinitializes the scoped stores with a new data directory.
