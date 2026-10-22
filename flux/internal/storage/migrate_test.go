package storage

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDataDir(t *testing.T) {
	got := DataDir("/home/me/project")
	want := filepath.Join("/home/me/project", ".reqit")
	if got != want {
		t.Errorf("DataDir = %q, want %q", got, want)
	}
}

// Older versions wrote reqit's data at the root of the user's repository, where
// the ignore rules did not cover it — an API key in an environment was
// committed and pushed. The data has to move.
func TestMigrateToDataDirMovesRootFiles(t *testing.T) {
	ws := t.TempDir()

	// The layout an older version produced.
	if err := os.MkdirAll(filepath.Join(ws, "collections"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(ws, "collections", "index.json"), []byte("[]"), 0o644); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"environments.json", "history.json", "runhistory.json"} {
		if err := os.WriteFile(filepath.Join(ws, name), []byte("{}"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.WriteFile(filepath.Join(ws, ".reqit-cookies.json"), []byte("{}"), 0o644); err != nil {
		t.Fatal(err)
	}

	moved, err := MigrateToDataDir(ws)
	if err != nil {
		t.Fatalf("MigrateToDataDir: %v", err)
	}
	if len(moved) == 0 {
		t.Fatal("expected files to be moved")
	}

	// The root must be clean.
	if _, err := os.Stat(filepath.Join(ws, "environments.json")); !os.IsNotExist(err) {
		t.Error("environments.json is still at the repository root")
	}
	if _, err := os.Stat(filepath.Join(ws, ".reqit-cookies.json")); !os.IsNotExist(err) {
		t.Error("the cookie file is still at the repository root")
	}
	if _, err := os.Stat(filepath.Join(ws, "collections")); !os.IsNotExist(err) {
		t.Error("the collections directory is still at the repository root")
	}

	// And the data must be in its new home.
	dataDir := DataDir(ws)
	for _, name := range []string{"environments.json", "history.json", "runhistory.json", "cookies.json"} {
		if _, err := os.Stat(filepath.Join(dataDir, name)); err != nil {
			t.Errorf("%s is missing from the data directory: %v", name, err)
		}
	}
	if _, err := os.Stat(filepath.Join(dataDir, "collections", "index.json")); err != nil {
		t.Errorf("the collections index is missing from the data directory: %v", err)
	}
}

// A repository that has already been migrated must not be touched, and data
// that exists in the new location must never be overwritten.
func TestMigrateToDataDirKeepsExistingData(t *testing.T) {
	ws := t.TempDir()
	dataDir := DataDir(ws)
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dataDir, "environments.json"), []byte("new"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(ws, "environments.json"), []byte("old"), 0o644); err != nil {
		t.Fatal(err)
	}

	if _, err := MigrateToDataDir(ws); err != nil {
		t.Fatalf("MigrateToDataDir: %v", err)
	}

	got, err := os.ReadFile(filepath.Join(dataDir, "environments.json"))
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != "new" {
		t.Errorf("the existing data was overwritten: %q", got)
	}
}

func TestMigrateToDataDirIsANoOpOnACleanWorkspace(t *testing.T) {
	ws := t.TempDir()
	moved, err := MigrateToDataDir(ws)
	if err != nil {
		t.Fatalf("MigrateToDataDir: %v", err)
	}
	if len(moved) != 0 {
		t.Errorf("expected nothing to be moved, got %v", moved)
	}
}
