package environments

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"flux/internal/crypto"
	"flux/internal/models"
	"github.com/zalando/go-keyring"
)

func newStore(t *testing.T, withKey bool) (*Store, string) {
	t.Helper()
	keyring.MockInit()
	dir := t.TempDir()

	c := crypto.App()
	if withKey {
		if err := c.GenerateKey(); err != nil {
			t.Fatalf("GenerateKey: %v", err)
		}
	}
	return NewStore(dir, c), dir
}

func TestEnvironmentsAreStoredInTheDataDir(t *testing.T) {
	s, dir := newStore(t, false)

	if _, err := s.Create("dev"); err != nil {
		t.Fatalf("Create: %v", err)
	}

	path := filepath.Join(dir, ".reqit", "environments.json")
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("environments.json is not in the data directory: %v", err)
	}
}

func TestEnvironmentsAreEncryptedWhenAKeyIsSet(t *testing.T) {
	s, dir := newStore(t, true)

	_, err := s.Create("prod")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if err := s.Update(s.envs[0].ID, "prod", []models.EnvVar{
		{Key: "api_key", Value: "sk-live-SECRET", Enabled: true},
	}); err != nil {
		t.Fatalf("Update: %v", err)
	}

	raw, err := os.ReadFile(filepath.Join(dir, ".reqit", "environments.json"))
	if err != nil {
		t.Fatal(err)
	}

	// The secret must not be readable in the file.
	if strings.Contains(string(raw), "sk-live-SECRET") {
		t.Fatal("the environment value is stored in the clear")
	}
	if !crypto.IsEncrypted(raw) {
		t.Fatal("the environment file is not in the encrypted format")
	}
}

func TestEncryptedEnvironmentsRoundTrip(t *testing.T) {
	s, _ := newStore(t, true)

	created, err := s.Create("prod")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if err := s.Update(created.ID, "prod", []models.EnvVar{
		{Key: "api_key", Value: "sk-live-SECRET", Enabled: true},
	}); err != nil {
		t.Fatalf("Update: %v", err)
	}

	// A fresh store reads the file back with the same values.
	// s.dir is <workspace>/.reqit, so the workspace is its parent.
	fresh := NewStore(filepath.Dir(s.dir), crypto.App())
	snap, err := fresh.Get()
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if len(snap.Environments) != 1 {
		t.Fatalf("expected 1 environment, got %d", len(snap.Environments))
	}
	if len(snap.Environments[0].Vars) != 1 || snap.Environments[0].Vars[0].Value != "sk-live-SECRET" {
		t.Fatalf("value did not round-trip: %+v", snap.Environments[0].Vars)
	}
}

// A file written before encryption was enabled must still load.
func TestPlainEnvironmentsStillLoad(t *testing.T) {
	s, dir := newStore(t, false)

	plain := `{"active":"","environments":[{"id":"e1","name":"dev","vars":[{"key":"a","value":"b","enabled":true}]}]}`
	path := filepath.Join(dir, ".reqit", "environments.json")
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(plain), 0o644); err != nil {
		t.Fatal(err)
	}

	snap, err := s.Get()
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if len(snap.Environments) != 1 || snap.Environments[0].Vars[0].Value != "b" {
		t.Fatalf("plain file did not load: %+v", snap.Environments)
	}
}

// An encrypted file with no key available must report a clear error rather
// than silently returning no environments.
func TestEncryptedFileWithoutAKeyReportsAnError(t *testing.T) {
	s, dir := newStore(t, true)
	if _, err := s.Create("prod"); err != nil {
		t.Fatalf("Create: %v", err)
	}

	// A store with no key at all.
	noKey := NewStore(dir, nil)
	if _, err := noKey.Get(); err == nil {
		t.Fatal("expected an error when the file is encrypted and no key is available")
	}
}
