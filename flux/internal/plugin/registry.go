package plugin

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
)

// Registry discovers and manages plugins.
type Registry struct {
	dir     string
	plugins []RegisteredPlugin
}

// NewRegistry creates a plugin registry rooted at dir (e.g. ~/.reqit/plugins).
func NewRegistry(dir string) *Registry {
	return &Registry{dir: dir}
}

// Discover scans the plugin directory and loads all valid plugins.
func (r *Registry) Discover() error {
	r.plugins = nil
	entries, err := os.ReadDir(r.dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("read plugin dir: %w", err)
	}
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		p, err := loadPlugin(filepath.Join(r.dir, entry.Name()))
		if err != nil {
			continue // skip invalid plugins silently
		}
		r.plugins = append(r.plugins, *p)
	}
	sort.Slice(r.plugins, func(i, j int) bool {
		return r.plugins[i].Manifest.Name < r.plugins[j].Manifest.Name
	})
	return nil
}

// List returns all discovered plugins.
func (r *Registry) List() []RegisteredPlugin {
	return r.plugins
}

// Get returns a plugin by name.
func (r *Registry) Get(name string) (RegisteredPlugin, bool) {
	for _, p := range r.plugins {
		if p.Manifest.Name == name {
			return p, true
		}
	}
	return RegisteredPlugin{}, false
}

func loadPlugin(dir string) (*RegisteredPlugin, error) {
	manifestPath := filepath.Join(dir, "plugin.json")
	data, err := os.ReadFile(manifestPath)
	if err != nil {
		return nil, fmt.Errorf("read manifest: %w", err)
	}
	var m Manifest
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, fmt.Errorf("parse manifest: %w", err)
	}
	if m.Name == "" {
		return nil, fmt.Errorf("plugin name is required")
	}
	if m.Version == "" {
		return nil, fmt.Errorf("plugin version is required")
	}

	// Validate hook files exist
	hookFiles := []string{m.Hooks.AuthProvider, m.Hooks.Visualizer, m.Hooks.Codegen,
		m.Hooks.PreRequest, m.Hooks.PostRequest, m.Hooks.MockRule}
	for _, f := range hookFiles {
		if f == "" {
			continue
		}
		if _, err := os.Stat(filepath.Join(dir, f)); err != nil {
			return nil, fmt.Errorf("hook file %s: %w", f, err)
		}
	}

	return &RegisteredPlugin{
		Manifest: m,
		Dir:      dir,
	}, nil
}

// PluginDir returns the standard plugin directory.
func PluginDir(appDataDir string) string {
	return filepath.Join(appDataDir, "plugins")
}
