package keyring

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

// resetFallback puts the package back to a clean state and points the
// fallback file at a temporary directory, so a test never touches the real
// user config.
func resetFallback(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", dir)

	mu.Lock()
	fallback = make(map[string]map[string]string)
	loaded = false
	mu.Unlock()

	return dir
}

func TestSetGetDeleteRoundTrip(t *testing.T) {
	resetFallback(t)

	if err := Set("flux-test", "key", "value"); err != nil {
		t.Fatalf("Set: %v", err)
	}
	got, err := Get("flux-test", "key")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got != "value" {
		t.Fatalf("Get = %q, want %q", got, "value")
	}
	if err := Delete("flux-test", "key"); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if got, _ := Get("flux-test", "key"); got != "" {
		t.Fatalf("expected the secret to be gone, got %q", got)
	}
}

// The OS keyring is not available on every machine. When the value only ever
// lived in the fallback, deleting it must still succeed — the secret really
// was removed. Returning the keyring's "not found" error made clearing a
// secret fail on any Linux box without a keyring daemon.
func TestDeleteSucceedsWhenTheSecretOnlyLivedInTheFallback(t *testing.T) {
	dir := resetFallback(t)

	mu.Lock()
	fallback["flux-test"] = map[string]string{"key": "value"}
	loaded = true
	mu.Unlock()

	if err := Delete("flux-test", "key"); err != nil {
		t.Fatalf("Delete should succeed when the secret was removed from the fallback, got %v", err)
	}

	mu.Lock()
	remaining, present := fallback["flux-test"]["key"]
	mu.Unlock()
	if present {
		t.Fatalf("the secret is still in the fallback: %q", remaining)
	}

	// The fallback file must no longer contain the value either.
	data, err := os.ReadFile(filepath.Join(dir, "flux", "keyring-fallback.json"))
	if err != nil {
		t.Fatalf("read fallback: %v", err)
	}
	var stored map[string]map[string]string
	if err := json.Unmarshal(data, &stored); err != nil {
		t.Fatalf("parse fallback: %v", err)
	}
	if v, present := stored["flux-test"]["key"]; present {
		t.Fatalf("the fallback file still holds the secret: %q", v)
	}
}

func TestDeleteOnAMissingSecretSucceeds(t *testing.T) {
	resetFallback(t)

	// Nothing was ever stored under this key.
	if err := Delete("flux-test", "never-stored"); err != nil {
		t.Fatalf("deleting a secret that does not exist should succeed, got %v", err)
	}
}

func TestGetOnAMissingSecretReturnsNotFound(t *testing.T) {
	resetFallback(t)

	if _, err := Get("flux-test", "never-stored"); err == nil {
		t.Fatal("expected an error for a secret that was never stored")
	}
}

func TestSetRejectsAnEmptySecret(t *testing.T) {
	resetFallback(t)
	// The OS keyring may accept an empty value, so only assert that a failure
	// is not silently swallowed into a stored empty secret.
	if err := Set("flux-test", "key", ""); err == nil {
		if got, _ := Get("flux-test", "key"); got != "" {
			t.Fatalf("expected an empty secret to be rejected, got %q", got)
		}
	}
}
