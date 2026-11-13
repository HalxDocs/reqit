package cli

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"flux/internal/trust"
)

// TestMain points the OS config lookup at a throwaway directory before any
// test calls storage.AppDir, which caches its result for the process.
func TestMain(m *testing.M) {
	dir, err := os.MkdirTemp("", "reqit-cli-*")
	if err != nil {
		panic(err)
	}
	// XDG on Linux, HOME on macOS, AppData on Windows.
	os.Setenv("XDG_CONFIG_HOME", dir)
	os.Setenv("HOME", dir)
	os.Setenv("AppData", dir)

	code := m.Run()
	_ = os.RemoveAll(dir)
	os.Exit(code)
}

// seedWorkspace registers a workspace with the machine index and returns its
// receipt store.
func seedWorkspace(t *testing.T) (*trust.Store, string) {
	t.Helper()

	wsDir := t.TempDir()
	configDir, err := os.UserConfigDir()
	if err != nil {
		t.Fatal(err)
	}
	appDir := filepath.Join(configDir, "flux")
	if err := os.MkdirAll(appDir, 0o755); err != nil {
		t.Fatal(err)
	}

	index := map[string]any{
		"active": "ws-1",
		"workspaces": []map[string]any{{
			"id":           "ws-1",
			"dataDir":      wsDir,
			"lastOpenedAt": time.Now().UTC().Format(time.RFC3339),
		}},
	}
	data, err := json.Marshal(index)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(appDir, "workspaces.json"), data, 0o644); err != nil {
		t.Fatal(err)
	}
	return trust.NewStore(wsDir), wsDir
}

func writeReceipt(t *testing.T, store *trust.Store, status int) *trust.Receipt {
	t.Helper()
	r := &trust.Receipt{
		Source:  "test",
		Request: trust.RequestRecord{Method: "GET", URL: "https://example.test/users"},
		Response: trust.ResponseRecord{
			StatusCode: status,
			BodyBytes:  12,
		},
	}
	if err := store.Write(r); err != nil {
		t.Fatal(err)
	}
	return r
}

func TestRunsDiffExitCodes(t *testing.T) {
	store, _ := seedWorkspace(t)
	first := writeReceipt(t, store, 200)
	second := writeReceipt(t, store, 500)

	if code := runsDiff([]string{"--workspace", "ws-1", first.ID, second.ID}); code != 2 {
		t.Errorf("a differing pair should exit 2, got %d", code)
	}

	// Two receipts that agree on everything diff compares.
	third := writeReceipt(t, store, 200)
	if code := runsDiff([]string{"--workspace", "ws-1", first.ID, third.ID}); code != 0 {
		t.Errorf("an identical pair should exit 0, got %d", code)
	}

	if code := runsDiff([]string{"--workspace", "ws-1", first.ID}); code != 1 {
		t.Errorf("a missing id should exit 1, got %d", code)
	}
}

func TestRunsVerifyDetectsTampering(t *testing.T) {
	store, wsDir := seedWorkspace(t)
	first := writeReceipt(t, store, 200)
	writeReceipt(t, store, 200)

	if code := runsVerify([]string{"--workspace", "ws-1"}); code != 0 {
		t.Fatalf("an intact store should verify, got %d", code)
	}

	path := filepath.Join(wsDir, ".reqit", "runs", first.ID+".json")
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	tampered := []byte(strings.Replace(string(data), "https://example.test/users", "https://evil.test/users", 1))
	if string(tampered) == string(data) {
		t.Fatal("the test did not change the receipt")
	}
	if err := os.WriteFile(path, tampered, 0o644); err != nil {
		t.Fatal(err)
	}
	if code := runsVerify([]string{"--workspace", "ws-1"}); code != 1 {
		t.Errorf("a modified receipt should fail verification, got %d", code)
	}
}

func TestRunsShowAcceptsPrefixAndRejectsUnknown(t *testing.T) {
	store, _ := seedWorkspace(t)
	r := writeReceipt(t, store, 201)

	if code := runsShow([]string{"--workspace", "ws-1", r.ID[:10]}); code != 0 {
		t.Errorf("a prefix should resolve, got %d", code)
	}
	if code := runsShow([]string{"--workspace", "ws-1", "does-not-exist"}); code != 1 {
		t.Errorf("an unknown id should exit 1, got %d", code)
	}
}
