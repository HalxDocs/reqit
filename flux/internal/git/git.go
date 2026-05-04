package git

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
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
	_ = s.repo.DeleteRemote("origin")
	_, err := s.repo.CreateRemote(&config.RemoteConfig{
		Name: "origin",
		URLs: []string{url},
	})
	return err
}

// GetRemote returns the origin URL, or empty string if none.
func (s *Store) GetRemote() string {
	r, err := s.repo.Remote("origin")
	if err != nil || len(r.Config().URLs) == 0 {
		return ""
	}
	return r.Config().URLs[0]
}

// CommitAll stages everything and commits.
func (s *Store) CommitAll(message, name, email string) error {
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
	head, err := s.repo.Head()
	if err != nil {
		return ""
	}
	return head.Name().Short()
}

// SwitchBranch checks out an existing branch.
func (s *Store) SwitchBranch(name string) error {
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
