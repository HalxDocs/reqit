package plugin

import (
	"fmt"
	"os"
	"path/filepath"
)

// Manager is the top-level plugin coordinator exposed to the app.
type Manager struct {
	Registry *Registry
}

// NewManager creates a Manager and runs discovery.
func NewManager(appDataDir string) (*Manager, error) {
	reg := NewRegistry(PluginDir(appDataDir))
	if err := reg.Discover(); err != nil {
		return nil, fmt.Errorf("plugin discovery: %w", err)
	}
	return &Manager{Registry: reg}, nil
}

// EnsurePluginDir creates the plugins directory if it doesn't exist.
func EnsurePluginDir(appDataDir string) error {
	dir := PluginDir(appDataDir)
	return os.MkdirAll(dir, 0755)
}

// InstallPlugin copies a plugin directory into the plugin dir.
func InstallPlugin(appDataDir, sourceDir string) error {
	dest := filepath.Join(PluginDir(appDataDir), filepath.Base(sourceDir))
	return copyDir(sourceDir, dest)
}

func copyDir(src, dst string) error {
	if err := os.MkdirAll(dst, 0755); err != nil {
		return err
	}
	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		srcPath := filepath.Join(src, entry.Name())
		dstPath := filepath.Join(dst, entry.Name())
		if entry.IsDir() {
			if err := copyDir(srcPath, dstPath); err != nil {
				return err
			}
			continue
		}
		data, err := os.ReadFile(srcPath)
		if err != nil {
			return err
		}
		if err := os.WriteFile(dstPath, data, 0644); err != nil {
			return err
		}
	}
	return nil
}
