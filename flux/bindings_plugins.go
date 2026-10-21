package main

import (
	"errors"
	"flux/internal/plugin"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) GetPlugins() []plugin.RegisteredPlugin {
	if a.plugins == nil {
		return []plugin.RegisteredPlugin{}
	}
	return a.plugins.Registry.List()
}

func (a *App) InstallPlugin(sourceDir string) error {
	dataDir, err := a.AppDataDir()
	if err != nil {
		return err
	}
	if err := plugin.InstallPlugin(dataDir, sourceDir); err != nil {
		return err
	}
	if a.plugins != nil {
		if err := a.plugins.Registry.Discover(); err != nil {
			return err
		}
		runtime.EventsEmit(a.ctx, "plugins:changed", nil)
	}
	return nil
}

func (a *App) RemovePlugin(name string) error {
	if a.plugins == nil {
		return errors.New("plugin system not initialized")
	}
	if err := a.plugins.Registry.Remove(name); err != nil {
		return err
	}
	runtime.EventsEmit(a.ctx, "plugins:changed", nil)
	return nil
}
