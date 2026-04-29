// Package environments persists named environments (key-value variable sets)
// to a JSON file in the Flux app data dir. Variable resolution itself happens
// on the frontend, so the active selection is also tracked here for restore
// across launches.
package environments

import (
	"errors"
	"sync"

	"github.com/google/uuid"

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
	envs   []models.Environment
	active string
	loaded bool
}

func NewStore(dir string) *Store { return &Store{dir: dir} }

func (s *Store) load() error {
	if s.loaded {
		return nil
	}
	w := wrapper{}
	if err := storage.LoadFrom(s.dir, fileName, &w); err != nil {
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
	return storage.SaveTo(s.dir, fileName, wrapper{Active: s.active, Environments: s.envs})
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
	if err := s.save(); err != nil {
		return models.Environment{}, err
	}
	return env, nil
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
