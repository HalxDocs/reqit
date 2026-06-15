package plugin

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func writePlugin(t *testing.T, dir, name, version string, hooks Hooks) {
	t.Helper()
	pluginDir := filepath.Join(dir, name)
	if err := os.MkdirAll(pluginDir, 0755); err != nil {
		t.Fatal(err)
	}
	m := Manifest{
		Name:    name,
		Version: version,
		Hooks:   hooks,
	}
	data, _ := json.Marshal(m)
	if err := os.WriteFile(filepath.Join(pluginDir, "plugin.json"), data, 0644); err != nil {
		t.Fatal(err)
	}
	for _, f := range []string{hooks.AuthProvider, hooks.Visualizer, hooks.Codegen,
		hooks.PreRequest, hooks.PostRequest, hooks.MockRule} {
		if f != "" {
			os.WriteFile(filepath.Join(pluginDir, f), []byte("// stub"), 0644)
		}
	}
}

func TestDiscover_NoDir(t *testing.T) {
	reg := NewRegistry(filepath.Join(t.TempDir(), "nonexistent"))
	if err := reg.Discover(); err != nil {
		t.Fatal(err)
	}
	if len(reg.List()) != 0 {
		t.Error("expected empty list for nonexistent dir")
	}
}

func TestDiscover_EmptyDir(t *testing.T) {
	reg := NewRegistry(t.TempDir())
	if err := reg.Discover(); err != nil {
		t.Fatal(err)
	}
	if len(reg.List()) != 0 {
		t.Error("expected empty list for empty dir")
	}
}

func TestDiscover_OnePlugin(t *testing.T) {
	dir := t.TempDir()
	writePlugin(t, dir, "my-plugin", "1.0.0", Hooks{})

	reg := NewRegistry(dir)
	if err := reg.Discover(); err != nil {
		t.Fatal(err)
	}
	list := reg.List()
	if len(list) != 1 {
		t.Fatalf("got %d plugins, want 1", len(list))
	}
	if list[0].Manifest.Name != "my-plugin" {
		t.Errorf("name = %q", list[0].Manifest.Name)
	}
	if list[0].Manifest.Version != "1.0.0" {
		t.Errorf("version = %q", list[0].Manifest.Version)
	}
}

func TestDiscover_SkipsNonDirEntries(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "file.txt"), []byte("not a plugin"), 0644)

	reg := NewRegistry(dir)
	if err := reg.Discover(); err != nil {
		t.Fatal(err)
	}
	if len(reg.List()) != 0 {
		t.Error("should skip non-directory entries")
	}
}

func TestDiscover_SkipsInvalidPlugins(t *testing.T) {
	dir := t.TempDir()
	// directory with no manifest
	os.MkdirAll(filepath.Join(dir, "broken"), 0755)

	writePlugin(t, dir, "valid", "1.0.0", Hooks{})

	reg := NewRegistry(dir)
	if err := reg.Discover(); err != nil {
		t.Fatal(err)
	}
	if len(reg.List()) != 1 {
		t.Fatalf("got %d plugins, want 1 (valid only)", len(reg.List()))
	}
	if reg.List()[0].Manifest.Name != "valid" {
		t.Error("wrong plugin survived")
	}
}

func TestDiscover_WithHooks(t *testing.T) {
	dir := t.TempDir()
	writePlugin(t, dir, "authy", "2.0.0", Hooks{
		AuthProvider: "auth.js",
		PreRequest:   "before.js",
	})

	reg := NewRegistry(dir)
	if err := reg.Discover(); err != nil {
		t.Fatal(err)
	}
	p, ok := reg.Get("authy")
	if !ok {
		t.Fatal("plugin not found")
	}
	if p.Manifest.Hooks.AuthProvider != "auth.js" {
		t.Errorf("auth hook = %q", p.Manifest.Hooks.AuthProvider)
	}
}

func TestGet_Missing(t *testing.T) {
	reg := NewRegistry(t.TempDir())
	_, ok := reg.Get("nope")
	if ok {
		t.Error("should not find missing plugin")
	}
}

func TestPluginDir(t *testing.T) {
	dir := PluginDir("/some/app/data")
	if dir == "" {
		t.Error("expected non-empty path")
	}
	if filepath.Base(dir) != "plugins" {
		t.Errorf("base = %q", filepath.Base(dir))
	}
}

func TestEnsurePluginDir(t *testing.T) {
	dir := t.TempDir()
	if err := EnsurePluginDir(dir); err != nil {
		t.Fatal(err)
	}
	pluginDir := filepath.Join(dir, "plugins")
	if _, err := os.Stat(pluginDir); os.IsNotExist(err) {
		t.Error("plugins dir was not created")
	}
}

func TestInstallPlugin(t *testing.T) {
	appDir := t.TempDir()
	sourceDir := filepath.Join(t.TempDir(), "demo-plugin")
	os.MkdirAll(sourceDir, 0755)
	os.WriteFile(filepath.Join(sourceDir, "plugin.json"), []byte(`{"name":"demo","version":"1.0","hooks":{}}`), 0644)
	os.WriteFile(filepath.Join(sourceDir, "auth.js"), []byte("export default {}"), 0644)

	if err := InstallPlugin(appDir, sourceDir); err != nil {
		t.Fatal(err)
	}

	installed := filepath.Join(PluginDir(appDir), "demo-plugin")
	if _, err := os.Stat(installed); os.IsNotExist(err) {
		t.Fatal("plugin was not installed")
	}
	if _, err := os.Stat(filepath.Join(installed, "plugin.json")); os.IsNotExist(err) {
		t.Error("plugin.json not found in installed plugin")
	}
}

func TestNewManager(t *testing.T) {
	appDir := t.TempDir()
	writePlugin(t, PluginDir(appDir), "plug-a", "0.1.0", Hooks{})

	mgr, err := NewManager(appDir)
	if err != nil {
		t.Fatal(err)
	}
	if mgr == nil {
		t.Fatal("manager is nil")
	}
	list := mgr.Registry.List()
	if len(list) != 1 {
		t.Fatalf("got %d plugins, want 1", len(list))
	}
}

func TestInstallPlugin_InvalidSource(t *testing.T) {
	err := InstallPlugin(t.TempDir(), "/nonexistent/source")
	if err == nil {
		t.Error("expected error for invalid source")
	}
}
