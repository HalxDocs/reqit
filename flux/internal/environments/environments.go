package environments

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/google/uuid"

	"flux/internal/crypto"
	"flux/internal/models"
	"flux/internal/storage"
)

const fileName = "environments.json"

type wrapper struct {
	Active       string               `json:"active"`
	Environments []models.Environment `json:"environments"`
}

type Store struct {
	mu     sync.Mutex
	dir    string
	crypto *crypto.Store
	envs   []models.Environment
	active string
	loaded bool
}

// NewStore returns a store for the environments in a workspace.
//
// Environment values hold API keys, so the file is excluded from git and is
// encrypted with the key held in the OS keychain when one is set. Without a
// key the file is still kept out of git, but stored as plain JSON.
func NewStore(dir string, cryptoStore *crypto.Store) *Store {
	return &Store{dir: storage.DataDir(dir), crypto: cryptoStore}
}

func (s *Store) load() error {
	if s.loaded {
		return nil
	}
	w := wrapper{}

	data, err := os.ReadFile(filepath.Join(s.dir, fileName))
	if err != nil {
		if os.IsNotExist(err) {
			s.envs = []models.Environment{}
			s.loaded = true
			return nil
		}
		return err
	}

	// A file written before encryption was enabled is plain JSON; one written
	// with a key is sealed in an envelope.
	if crypto.IsEncrypted(data) {
		if s.crypto == nil {
			return errors.New("environment file is encrypted but no encryption key is available")
		}
		if err := s.crypto.Open(data, &w); err != nil {
			return fmt.Errorf("environment file could not be decrypted: %w", err)
		}
	} else if err := json.Unmarshal(data, &w); err != nil {
		return err
	}

	if w.Environments == nil {
		w.Environments = []models.Environment{}
	}
	s.envs = w.Environments
	s.active = w.Active
	s.loaded = true
	return nil
}

func (s *Store) save() error {
	value := wrapper{Active: s.active, Environments: s.envs}

	// Encrypt when a key is available, so the values on disk are unreadable
	// without the OS keychain.
	if s.crypto != nil && s.crypto.HasKey() {
		data, err := s.crypto.Seal(value)
		if err != nil {
			return fmt.Errorf("encrypt environments: %w", err)
		}
		if err := os.MkdirAll(s.dir, 0o755); err != nil {
			return err
		}
		return atomicWrite(filepath.Join(s.dir, fileName), data)
	}
	return storage.SaveTo(s.dir, fileName, value)
} // caller must hold s.mu (except when called from MergeVars goroutine, where it's safe
// because no concurrent write will modify s.active/s.envs during the marshal)

// atomicWrite writes data to a temporary file and renames it over the target,
// so a crash mid-write cannot truncate the previous file.
func atomicWrite(path string, data []byte) error {
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

type Snapshot struct {
	Active       string               `json:"active"`
	Environments []models.Environment `json:"environments"`
}

func (s *Store) Get() (Snapshot, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return Snapshot{}, err
	}
	out := make([]models.Environment, len(s.envs))
	copy(out, s.envs)
	return Snapshot{Active: s.active, Environments: out}, nil
}

func (s *Store) Create(name string) (models.Environment, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return models.Environment{}, err
	}
	env := models.Environment{
		ID:   uuid.NewString(),
		Name: name,
		Vars: []models.EnvVar{},
	}
	s.envs = append(s.envs, env)
	if s.active == "" {
		s.active = env.ID
	}
	return env, s.save()
}

func (s *Store) Update(id, name string, vars []models.EnvVar) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	for i := range s.envs {
		if s.envs[i].ID == id {
			s.envs[i].Name = name
			s.envs[i].Vars = vars
			return s.save()
		}
	}
	return errors.New("environment not found")
}

func (s *Store) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	for i := range s.envs {
		if s.envs[i].ID == id {
			s.envs = append(s.envs[:i], s.envs[i+1:]...)
			if s.active == id {
				s.active = ""
				if len(s.envs) > 0 {
					s.active = s.envs[0].ID
				}
			}
			return s.save()
		}
	}
	return errors.New("environment not found")
}

func (s *Store) SetActive(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	if id == "" {
		s.active = ""
		return s.save()
	}
	for i := range s.envs {
		if s.envs[i].ID == id {
			s.active = id
			return s.save()
		}
	}
	return errors.New("environment not found")
}

func (s *Store) MergeVars(vars map[string]string) error {
	if len(vars) == 0 {
		return nil
	}
	s.mu.Lock()
	if err := s.load(); err != nil {
		s.mu.Unlock()
		return err
	}
	if s.active == "" {
		s.mu.Unlock()
		return nil
	}
	for i := range s.envs {
		if s.envs[i].ID != s.active {
			continue
		}
		existing := map[string]int{}
		for j, v := range s.envs[i].Vars {
			existing[v.Key] = j
		}
		for key, value := range vars {
			if idx, ok := existing[key]; ok {
				s.envs[i].Vars[idx].Value = value
				s.envs[i].Vars[idx].Enabled = true
			} else {
				s.envs[i].Vars = append(s.envs[i].Vars, models.EnvVar{
					Key:     key,
					Value:   value,
					Enabled: true,
				})
			}
		}
		s.mu.Unlock()
		go func() { _ = s.save() }()
		return nil
	}
	s.mu.Unlock()
	return nil
}

func (s *Store) Flush() {}
