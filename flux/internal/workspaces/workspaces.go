// Package workspaces manages the workspace index: a registry of named,
// folder-backed workspaces. Each workspace is a self-contained directory
// (collections.json, environments.json, history.json, workspace.json).
// The index file lives in AppDir so the machine knows where each workspace
// folder is; the workspace.json inside each folder is the portable metadata
// that travels with the folder to any cloud-sync target (Dropbox, Drive…).
package workspaces

import (
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/google/uuid"

	"flux/internal/storage"
)

const indexFile = "workspaces.json"
const metaFile = "workspace.json"

// Meta is the portable workspace descriptor stored inside the workspace folder.
type Meta struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Color       string `json:"color"`
	CreatedAt   string `json:"createdAt"`
}

// Entry is a row in the local machine index.
type Entry struct {
	ID           string `json:"id"`
	DataDir      string `json:"dataDir"`
	LastOpenedAt string `json:"lastOpenedAt"`
}

// Info is the combined view returned to the frontend.
type Info struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Description  string `json:"description"`
	Color        string `json:"color"`
	DataDir      string `json:"dataDir"`
	CreatedAt    string `json:"createdAt"`
	LastOpenedAt string `json:"lastOpenedAt"`
}

type indexWrapper struct {
	Active     string  `json:"active"`
	Workspaces []Entry `json:"workspaces"`
}

type Store struct {
	mu         sync.Mutex
	entries    []Entry
	active     string
	loaded     bool
}

func NewStore() *Store { return &Store{} }

func (s *Store) loadIndex() error {
	if s.loaded {
		return nil
	}
	w := indexWrapper{}
	if err := storage.Load(indexFile, &w); err != nil {
		return err
	}
	if w.Workspaces == nil {
		w.Workspaces = []Entry{}
	}
	s.entries = w.Workspaces
	s.active = w.Active
	s.loaded = true
	return nil
}

func (s *Store) saveIndex() error {
	return storage.Save(indexFile, indexWrapper{Active: s.active, Workspaces: s.entries})
}

func readMeta(dir string) (Meta, error) {
	data, err := os.ReadFile(filepath.Join(dir, metaFile))
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return Meta{}, nil
		}
		return Meta{}, err
	}
	var m Meta
	if err := json.Unmarshal(data, &m); err != nil {
		return Meta{}, err
	}
	return m, nil
}

func writeMeta(dir string, m Meta) error {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	data, _ := json.MarshalIndent(m, "", "  ")
	return os.WriteFile(filepath.Join(dir, metaFile), data, 0o644)
}

func (s *Store) toInfo(e Entry) (Info, error) {
	meta, err := readMeta(e.DataDir)
	if err != nil {
		return Info{}, err
	}
	return Info{
		ID:           e.ID,
		Name:         meta.Name,
		Description:  meta.Description,
		Color:        meta.Color,
		DataDir:      e.DataDir,
		CreatedAt:    meta.CreatedAt,
		LastOpenedAt: e.LastOpenedAt,
	}, nil
}

// GetAll returns workspace info for all registered workspaces.
func (s *Store) GetAll() ([]Info, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.loadIndex(); err != nil {
		return nil, err
	}
	out := make([]Info, 0, len(s.entries))
	for _, e := range s.entries {
		info, err := s.toInfo(e)
		if err != nil {
			continue // skip unreadable workspaces rather than failing
		}
		out = append(out, info)
	}
	return out, nil
}

// GetActive returns the active workspace ID and its info.
func (s *Store) GetActive() (string, Info, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.loadIndex(); err != nil {
		return "", Info{}, err
	}
	if s.active == "" {
		return "", Info{}, nil
	}
	for _, e := range s.entries {
		if e.ID == s.active {
			info, err := s.toInfo(e)
			return s.active, info, err
		}
	}
	return "", Info{}, nil
}

// ActiveDir returns the data directory of the currently active workspace.
// Returns ("", nil) if no workspace is active.
func (s *Store) ActiveDir() (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.loadIndex(); err != nil {
		return "", err
	}
	for _, e := range s.entries {
		if e.ID == s.active {
			return e.DataDir, nil
		}
	}
	return "", nil
}

// Create makes a new workspace with a subfolder inside AppDir/workspaces/.
func (s *Store) Create(name, description, color string) (Info, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.loadIndex(); err != nil {
		return Info{}, err
	}

	appDir, err := storage.AppDir()
	if err != nil {
		return Info{}, err
	}

	id := uuid.NewString()
	dir := filepath.Join(appDir, "workspaces", id)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return Info{}, err
	}

	now := time.Now().UTC().Format(time.RFC3339)
	meta := Meta{ID: id, Name: name, Description: description, Color: color, CreatedAt: now}
	if err := writeMeta(dir, meta); err != nil {
		return Info{}, err
	}

	entry := Entry{ID: id, DataDir: dir, LastOpenedAt: now}
	s.entries = append(s.entries, entry)
	if s.active == "" {
		s.active = id
	}
	if err := s.saveIndex(); err != nil {
		return Info{}, err
	}

	return Info{
		ID: id, Name: name, Description: description, Color: color,
		DataDir: dir, CreatedAt: now, LastOpenedAt: now,
	}, nil
}

// Switch marks a workspace as active and updates its LastOpenedAt.
func (s *Store) Switch(id string) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.loadIndex(); err != nil {
		return "", err
	}
	for i, e := range s.entries {
		if e.ID == id {
			s.entries[i].LastOpenedAt = time.Now().UTC().Format(time.RFC3339)
			s.active = id
			if err := s.saveIndex(); err != nil {
				return "", err
			}
			return e.DataDir, nil
		}
	}
	return "", errors.New("workspace not found")
}

// Rename updates the workspace name in its meta file.
func (s *Store) Rename(id, name string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.loadIndex(); err != nil {
		return err
	}
	for _, e := range s.entries {
		if e.ID == id {
			meta, err := readMeta(e.DataDir)
			if err != nil {
				return err
			}
			meta.Name = name
			return writeMeta(e.DataDir, meta)
		}
	}
	return errors.New("workspace not found")
}

// UpdateDescription updates the workspace description.
func (s *Store) UpdateDescription(id, description string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.loadIndex(); err != nil {
		return err
	}
	for _, e := range s.entries {
		if e.ID == id {
			meta, err := readMeta(e.DataDir)
			if err != nil {
				return err
			}
			meta.Description = description
			return writeMeta(e.DataDir, meta)
		}
	}
	return errors.New("workspace not found")
}

// Delete removes a workspace from the index. The folder is NOT deleted so
// the user's data is safe. They can re-link it later via OpenFromFolder.
func (s *Store) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.loadIndex(); err != nil {
		return err
	}
	for i, e := range s.entries {
		if e.ID == id {
			s.entries = append(s.entries[:i], s.entries[i+1:]...)
			if s.active == id {
				s.active = ""
				if len(s.entries) > 0 {
					s.active = s.entries[0].ID
				}
			}
			return s.saveIndex()
		}
	}
	return errors.New("workspace not found")
}

// Relocate changes the local path a workspace entry points to. Use this when
// the user has moved their workspace folder (e.g. into Dropbox).
func (s *Store) Relocate(id, newDir string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.loadIndex(); err != nil {
		return err
	}
	for i, e := range s.entries {
		if e.ID == id {
			// Verify the folder has a workspace.json that matches this ID.
			meta, err := readMeta(newDir)
			if err != nil {
				return errors.New("target folder does not contain a valid workspace")
			}
			if meta.ID != "" && meta.ID != id {
				return errors.New("target folder belongs to a different workspace")
			}
			s.entries[i].DataDir = newDir
			return s.saveIndex()
		}
	}
	return errors.New("workspace not found")
}

// OpenFromFolder registers a folder as a workspace. If the folder has a
// workspace.json we use its metadata; otherwise we create one with the folder
// name as the workspace name. Returns the resulting Info.
func (s *Store) OpenFromFolder(dir string) (Info, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.loadIndex(); err != nil {
		return Info{}, err
	}

	// Check if already registered.
	for _, e := range s.entries {
		if e.DataDir == dir {
			info, err := s.toInfo(e)
			return info, err
		}
	}

	meta, err := readMeta(dir)
	if err != nil {
		return Info{}, err
	}

	now := time.Now().UTC().Format(time.RFC3339)
	if meta.ID == "" {
		// No workspace.json — create one using the folder name.
		meta = Meta{
			ID:        uuid.NewString(),
			Name:      filepath.Base(dir),
			Color:     "#3B82F6",
			CreatedAt: now,
		}
		if err := writeMeta(dir, meta); err != nil {
			return Info{}, err
		}
	}

	entry := Entry{ID: meta.ID, DataDir: dir, LastOpenedAt: now}
	s.entries = append(s.entries, entry)
	if err := s.saveIndex(); err != nil {
		return Info{}, err
	}

	return Info{
		ID: meta.ID, Name: meta.Name, Description: meta.Description,
		Color: meta.Color, DataDir: dir, CreatedAt: meta.CreatedAt, LastOpenedAt: now,
	}, nil
}

// Migrate checks if this is a fresh workspaces setup on a machine that already
// has legacy flat data (collections.json directly in AppDir). If so, it
// creates a "Default" workspace that points at AppDir itself so existing data
// is preserved seamlessly.
func (s *Store) Migrate() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.loadIndex(); err != nil {
		return err
	}
	if len(s.entries) > 0 {
		return nil // already set up
	}

	appDir, err := storage.AppDir()
	if err != nil {
		return err
	}

	// Only migrate if legacy data exists.
	legacyFile := filepath.Join(appDir, "collections.json")
	if _, err := os.Stat(legacyFile); errors.Is(err, fs.ErrNotExist) {
		// Fresh install — no migration needed, Create will be called from UI.
		return nil
	}

	now := time.Now().UTC().Format(time.RFC3339)
	id := uuid.NewString()
	meta := Meta{ID: id, Name: "Default", Color: "#3B82F6", CreatedAt: now}
	if err := writeMeta(appDir, meta); err != nil {
		return err
	}

	s.entries = []Entry{{ID: id, DataDir: appDir, LastOpenedAt: now}}
	s.active = id
	return s.saveIndex()
}
