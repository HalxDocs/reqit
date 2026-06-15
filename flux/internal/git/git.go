package git

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	gogit "github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/config"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/object"
	githttp "github.com/go-git/go-git/v5/plumbing/transport/http"
	"github.com/zalando/go-keyring"
)

const keyringSvc = "flux-git"

type CommitInfo struct {
	Hash    string `json:"hash"`
	Message string `json:"message"`
	Author  string `json:"author"`
	When    string `json:"when"`
}

type Contributor struct {
	Name    string `json:"name"`
	Email   string `json:"email"`
	Commits int    `json:"commits"`
	LastSeen string `json:"lastSeen"`
}

type GitConfig struct {
	RemoteURL string `json:"remoteUrl"`
}

type Store struct {
	mu   sync.Mutex
	repo *gogit.Repository
	dir  string
}

// Open opens an existing git repo at dir, or initialises a new one.
func Open(dir string) (*Store, error) {
	repo, err := gogit.PlainOpen(dir)
	if err != nil {
		if !errors.Is(err, gogit.ErrRepositoryNotExists) {
			return nil, err
		}
		repo, err = gogit.PlainInit(dir, false)
		if err != nil {
			return nil, err
		}
	}
	return &Store{repo: repo, dir: dir}, nil
}

// IsRepo returns true if dir is already a git repository.
func IsRepo(dir string) bool {
	_, err := gogit.PlainOpen(dir)
	return err == nil
}

// SetRemote adds or updates the origin remote.
func (s *Store) SetRemote(url string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	_ = s.repo.DeleteRemote("origin")
	_, err := s.repo.CreateRemote(&config.RemoteConfig{
		Name: "origin",
		URLs: []string{url},
	})
	return err
}

// GetRemote returns the origin URL, or empty string if none.
func (s *Store) GetRemote() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	r, err := s.repo.Remote("origin")
	if err != nil || len(r.Config().URLs) == 0 {
		return ""
	}
	return r.Config().URLs[0]
}

// CommitAll stages everything and commits.
func (s *Store) CommitAll(message, name, email string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	w, err := s.repo.Worktree()
	if err != nil {
		return err
	}
	if err := w.AddGlob("."); err != nil {
		return err
	}
	_, err = w.Commit(message, &gogit.CommitOptions{
		Author: &object.Signature{
			Name:  name,
			Email: email,
			When:  time.Now(),
		},
		AllowEmptyCommits: false,
	})
	return err
}

// Push pushes to origin using the given PAT.
func (s *Store) Push(pat string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	err := s.repo.Push(&gogit.PushOptions{
		Auth: &githttp.BasicAuth{Username: "x", Password: pat},
	})
	if errors.Is(err, gogit.NoErrAlreadyUpToDate) {
		return nil
	}
	return err
}

// Pull pulls from origin.
func (s *Store) Pull(pat string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	w, err := s.repo.Worktree()
	if err != nil {
		return err
	}
	opts := &gogit.PullOptions{RemoteName: "origin"}
	if pat != "" {
		opts.Auth = &githttp.BasicAuth{Username: "x", Password: pat}
	}
	err = w.Pull(opts)
	if errors.Is(err, gogit.NoErrAlreadyUpToDate) {
		return nil
	}
	return err
}

// GetBranches lists all local branch names.
func (s *Store) GetBranches() ([]string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	refs, err := s.repo.Branches()
	if err != nil {
		return nil, err
	}
	var branches []string
	_ = refs.ForEach(func(r *plumbing.Reference) error {
		branches = append(branches, r.Name().Short())
		return nil
	})
	return branches, nil
}

// CurrentBranch returns the checked-out branch name.
func (s *Store) CurrentBranch() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	head, err := s.repo.Head()
	if err != nil {
		return ""
	}
	return head.Name().Short()
}

// SwitchBranch checks out an existing branch.
func (s *Store) SwitchBranch(name string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	w, err := s.repo.Worktree()
	if err != nil {
		return err
	}
	return w.Checkout(&gogit.CheckoutOptions{
		Branch: plumbing.NewBranchReferenceName(name),
		Create: false,
	})
}

// CreateBranch creates and checks out a new branch.
func (s *Store) CreateBranch(name string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	w, err := s.repo.Worktree()
	if err != nil {
		return err
	}
	return w.Checkout(&gogit.CheckoutOptions{
		Branch: plumbing.NewBranchReferenceName(name),
		Create: true,
	})
}

// GetLog returns the last n commits. Pass 0 for all.
func (s *Store) GetLog(limit int) ([]CommitInfo, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	iter, err := s.repo.Log(&gogit.LogOptions{})
	if err != nil {
		return nil, err
	}
	var commits []CommitInfo
	count := 0
	_ = iter.ForEach(func(c *object.Commit) error {
		if limit > 0 && count >= limit {
			return errors.New("stop")
		}
		msg := c.Message
		if len(msg) > 72 {
			msg = msg[:72] + "…"
		}
		commits = append(commits, CommitInfo{
			Hash:    c.Hash.String()[:7],
			Message: msg,
			Author:  c.Author.Name,
			When:    c.Author.When.Format(time.RFC3339),
		})
		count++
		return nil
	})
	return commits, nil
}

// HasChanges returns true if there are uncommitted changes.
func (s *Store) HasChanges() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	w, err := s.repo.Worktree()
	if err != nil {
		return false
	}
	status, err := w.Status()
	if err != nil {
		return false
	}
	return !status.IsClean()
}

// GetActiveContributors returns unique authors who committed within the last 24 hours.
func (s *Store) GetActiveContributors() ([]Contributor, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	iter, err := s.repo.Log(&gogit.LogOptions{})
	if err != nil {
		return nil, err
	}
	cutoff := time.Now().Add(-24 * time.Hour)
	seen := map[string]*Contributor{}
	_ = iter.ForEach(func(c *object.Commit) error {
		if c.Author.When.Before(cutoff) {
			return errors.New("stop")
		}
		key := c.Author.Email
		if existing, ok := seen[key]; ok {
			existing.Commits++
		} else {
			seen[key] = &Contributor{
				Name:     c.Author.Name,
				Email:    c.Author.Email,
				Commits:  1,
				LastSeen: c.Author.When.Format(time.RFC3339),
			}
		}
		return nil
	})
	result := make([]Contributor, 0, len(seen))
	for _, c := range seen {
		result = append(result, *c)
	}
	return result, nil
}

// SaveConfig persists remote URL (only) to a file; PAT goes to OS keychain.
func SaveConfig(dir, remoteURL, pat string) error {
	// Store PAT in OS keychain keyed by workspace dir.
	if pat != "" {
		if err := keyring.Set(keyringSvc, dir, pat); err != nil {
			return fmt.Errorf("keychain: %w", err)
		}
	}
	cfg := GitConfig{RemoteURL: remoteURL}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dir, ".flux-git.json"), data, 0600)
}

// LoadPAT retrieves the PAT for a workspace from the OS keychain.
func LoadPAT(dir string) string {
	pat, _ := keyring.Get(keyringSvc, dir)
	return pat
}

// DeletePAT removes the stored PAT from the OS keychain.
func DeletePAT(dir string) {
	_ = keyring.Delete(keyringSvc, dir)
}

// LoadConfig reads the stored git config for a workspace.
func LoadConfig(dir string) (GitConfig, error) {
	data, err := os.ReadFile(filepath.Join(dir, ".flux-git.json"))
	if err != nil {
		return GitConfig{}, err
	}
	var cfg GitConfig
	return cfg, json.Unmarshal(data, &cfg)
}

// gitExec runs a git command in the store's directory.
func (s *Store) gitExec(args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = s.dir
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("git %s: %s: %w", strings.Join(args, " "), strings.TrimSpace(string(out)), err)
	}
	return strings.TrimSpace(string(out)), nil
}

// Stash saves uncommitted changes and returns the stash description.
func (s *Store) Stash() (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.gitExec("stash", "push", "-m", "reqit auto-stash")
}

// PopStash restores the most recent stash.
func (s *Store) PopStash() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, err := s.gitExec("stash", "pop")
	return err
}

// StashEntry holds info about a stashed change.
type StashEntry struct {
	Index int    `json:"index"`
	Ref   string `json:"ref"`
	Message string `json:"message"`
}

// GetStashList returns all stash entries by parsing `git stash list`.
func (s *Store) GetStashList() ([]StashEntry, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	raw, err := s.gitExec("stash", "list", "--format=%H\t%gs")
	if err != nil {
		// No stashes is not an error.
		if strings.Contains(err.Error(), "stash") {
			return []StashEntry{}, nil
		}
		return nil, err
	}
	if raw == "" {
		return []StashEntry{}, nil
	}
	var entries []StashEntry
	for i, line := range strings.Split(raw, "\n") {
		parts := strings.SplitN(line, "\t", 2)
		ref := parts[0]
		msg := ""
		if len(parts) > 1 {
			msg = parts[1]
		}
		if len(ref) > 7 {
			ref = ref[:7]
		}
		entries = append(entries, StashEntry{Index: i, Ref: ref, Message: msg})
	}
	return entries, nil
}

// MergeBranch merges the given branch into the current branch.
func (s *Store) MergeBranch(branch string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, err := s.gitExec("merge", "--no-edit", branch)
	return err
}

// DiffEntry represents a single changed file.
type DiffEntry struct {
	Path    string `json:"path"`
	Added   int    `json:"added"`
	Deleted int    `json:"deleted"`
}

// GetDiff returns the diff between two refs. If from is empty, compares HEAD to working tree.
func (s *Store) GetDiff(from, to string) ([]DiffEntry, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	args := []string{"diff", "--numstat"}
	if from != "" {
		args = append(args, from)
		if to != "" {
			args = append(args, to)
		}
	}
	raw, err := s.gitExec(args...)
	if err != nil {
		// Try as working tree diff
		status, err := s.gitExec("status", "--porcelain")
		if err != nil {
			return nil, err
		}
		return parsePorcelain(status), nil
	}
	return parseNumStat(raw), nil
}

func parseNumStat(raw string) []DiffEntry {
	var entries []DiffEntry
	for _, line := range strings.Split(raw, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		parts := strings.Fields(line)
		if len(parts) < 3 {
			continue
		}
		added, _ := strconv.Atoi(parts[0])
		deleted, _ := strconv.Atoi(parts[1])
		entries = append(entries, DiffEntry{
			Path:    strings.Join(parts[2:], " "),
			Added:   added,
			Deleted: deleted,
		})
	}
	return entries
}

// DiffContent holds the full diff text for a single file.
type DiffContent struct {
	Path    string   `json:"path"`
	RawDiff string   `json:"rawDiff"`
	Added   int      `json:"added"`
	Deleted int      `json:"deleted"`
}

// GetDiffContent returns the full diff text for tracked file changes.
func (s *Store) GetDiffContent(path string) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.gitExec("diff", "--", path)
}

// GetConflictFiles returns paths of files with merge conflicts.
func (s *Store) GetConflictFiles() ([]string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	raw, err := s.gitExec("diff", "--name-only", "--diff-filter=U")
	if err != nil {
		// Fallback: check for conflict markers in status
		status, statusErr := s.gitExec("status", "--porcelain")
		if statusErr != nil {
			return nil, err
		}
		var conflicted []string
		for _, line := range strings.Split(status, "\n") {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "UU") || strings.HasPrefix(line, "AA") || strings.HasPrefix(line, "DD") {
				conflicted = append(conflicted, strings.TrimSpace(line[2:]))
			}
		}
		return conflicted, nil
	}
	return strings.Fields(raw), nil
}

// ResolveConflictOurs resolves a conflicted file using the "ours" version.
func (s *Store) ResolveConflictOurs(path string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, err := s.gitExec("checkout", "--ours", path)
	if err != nil {
		return fmt.Errorf("resolve --ours: %w", err)
	}
	_, err = s.gitExec("add", path)
	return err
}

// ResolveConflictTheirs resolves a conflicted file using the "theirs" version.
func (s *Store) ResolveConflictTheirs(path string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, err := s.gitExec("checkout", "--theirs", path)
	if err != nil {
		return fmt.Errorf("resolve --theirs: %w", err)
	}
	_, err = s.gitExec("add", path)
	return err
}

func parsePorcelain(raw string) []DiffEntry {
	var entries []DiffEntry
	for _, line := range strings.Split(raw, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if len(line) < 4 {
			continue
		}
		path := strings.TrimSpace(line[3:])
		entries = append(entries, DiffEntry{Path: path, Added: 0, Deleted: 0})
	}
	return entries
}
