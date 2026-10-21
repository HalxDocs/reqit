package git

import (
	"os"
	"path/filepath"
	"testing"

	"flux/internal/keyring"
)

func newRepo(t *testing.T) *Store {
	t.Helper()
	dir := t.TempDir()
	s, err := Open(dir)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	return s
}

func TestCommitAllThenHasChanges(t *testing.T) {
	s := newRepo(t)

	if err := os.WriteFile(filepath.Join(s.dir, "a.txt"), []byte("hi"), 0o644); err != nil {
		t.Fatal(err)
	}
	if !s.HasChanges() {
		t.Fatal("untracked file should report as a change")
	}
	if err := s.CommitAll("add a", "Tester", "t@example.com"); err != nil {
		t.Fatalf("CommitAll: %v", err)
	}
	if s.HasChanges() {
		t.Fatal("worktree should be clean after commit")
	}
}

func TestLastCommitTime(t *testing.T) {
	s := newRepo(t)

	if _, err := s.LastCommitTime(); err == nil {
		t.Fatal("expected an error with no commits yet")
	}
	if err := os.WriteFile(filepath.Join(s.dir, "a.txt"), []byte("hi"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := s.CommitAll("add a", "Tester", "t@example.com"); err != nil {
		t.Fatalf("CommitAll: %v", err)
	}
	when, err := s.LastCommitTime()
	if err != nil {
		t.Fatalf("LastCommitTime: %v", err)
	}
	if when.IsZero() {
		t.Fatal("expected a non-zero commit time")
	}
}

// A workspace with local commits but no remote must report unpushed work rather
// than looking safely backed up.
func TestHasUnpushedCommitsNoRemote(t *testing.T) {
	s := newRepo(t)

	if err := os.WriteFile(filepath.Join(s.dir, "a.txt"), []byte("hi"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := s.CommitAll("add a", "Tester", "t@example.com"); err != nil {
		t.Fatalf("CommitAll: %v", err)
	}

	unpushed, err := s.HasUnpushedCommits()
	if err == nil {
		t.Fatal("expected an error when no origin remote is configured")
	}
	// The error path must still be conservative: report unpushed work.
	if !unpushed {
		t.Fatal("must report unpushed commits when the remote cannot be checked")
	}
}

func TestHasUnpushedCommitsEmptyRepo(t *testing.T) {
	s := newRepo(t)

	unpushed, _ := s.HasUnpushedCommits()
	if !unpushed {
		t.Fatal("a repo with no remote must never report as safely backed up")
	}
}

func TestRemoteURLRoundTrip(t *testing.T) {
	s := newRepo(t)

	if got := s.GetRemote(); got != "" {
		t.Fatalf("expected empty remote, got %q", got)
	}
	if err := s.SetRemote("https://example.com/repo.git"); err != nil {
		t.Fatalf("SetRemote: %v", err)
	}
	if got := s.GetRemote(); got != "https://example.com/repo.git" {
		t.Fatalf("GetRemote = %q", got)
	}
}

func TestSaveConfigExcludesPAT(t *testing.T) {
	dir := t.TempDir()
	const secret = "ghp_supersecrettoken"

	if err := SaveConfig(dir, "https://example.com/repo.git", secret); err != nil {
		t.Fatalf("SaveConfig: %v", err)
	}

	// The token must never be written to disk in the config file.
	data, err := os.ReadFile(filepath.Join(dir, ".flux-git.json"))
	if err != nil {
		t.Fatal(err)
	}
	if stringContains(string(data), secret) {
		t.Fatal("PAT must not be persisted in .flux-git.json")
	}

	// The PAT is only ever recoverable from the OS keyring.
	keyring.Delete(keyringSvc, dir)

	cfg, err := LoadConfig(dir)
	if err != nil {
		t.Fatalf("LoadConfig: %v", err)
	}
	if cfg.RemoteURL != "https://example.com/repo.git" {
		t.Fatalf("RemoteURL = %q", cfg.RemoteURL)
	}
	if got := LoadPAT(dir); got != "" {
		t.Fatalf("expected no PAT from keyring in tests, got %q", got)
	}
}

func stringContains(haystack, needle string) bool {
	return len(needle) > 0 && len(haystack) >= len(needle) &&
		func() bool {
			for i := 0; i+len(needle) <= len(haystack); i++ {
				if haystack[i:i+len(needle)] == needle {
					return true
				}
			}
			return false
		}()
}
