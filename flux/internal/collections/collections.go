// Package collections owns persistence and CRUD for user-saved API collections.
// Collections are stored as a single JSON file in the Flux app data dir so
// users can commit them to git or back them up trivially.
package collections

import (
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"

	"flux/internal/models"
	"flux/internal/storage"
)

const fileName = "collections.json"

type wrapper struct {
	Collections []models.Collection `json:"collections"`
}

type Store struct {
	mu          sync.Mutex
	dir         string
	collections []models.Collection
	loaded      bool
}

func NewStore(dir string) *Store {
	return &Store{dir: dir}
}

func (s *Store) load() error {
	if s.loaded {
		return nil
	}
	w := wrapper{}
	if err := storage.LoadFrom(s.dir, fileName, &w); err != nil {
		return err
	}
	if w.Collections == nil {
		w.Collections = []models.Collection{}
	}
	s.collections = w.Collections
	s.loaded = true
	return nil
}

func (s *Store) save() error {
	return storage.SaveTo(s.dir, fileName, wrapper{Collections: s.collections})
}

// GetAll returns the full set of collections (with their requests).
func (s *Store) GetAll() ([]models.Collection, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return nil, err
	}
	out := make([]models.Collection, len(s.collections))
	copy(out, s.collections)
	return out, nil
}

func (s *Store) CreateCollection(name string) (models.Collection, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return models.Collection{}, err
	}
	c := models.Collection{
		ID:       uuid.NewString(),
		Name:     name,
		Requests: []models.SavedRequest{},
	}
	s.collections = append(s.collections, c)
	if err := s.save(); err != nil {
		return models.Collection{}, err
	}
	return c, nil
}

func (s *Store) RenameCollection(id, name string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	for i := range s.collections {
		if s.collections[i].ID == id {
			s.collections[i].Name = name
			return s.save()
		}
	}
	return errors.New("collection not found")
}

func (s *Store) DeleteCollection(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	for i := range s.collections {
		if s.collections[i].ID == id {
			s.collections = append(s.collections[:i], s.collections[i+1:]...)
			return s.save()
		}
	}
	return errors.New("collection not found")
}

// AddRequest stores a new request inside the given collection. The request's
// ID and CreatedAt are generated server-side; the Name and Payload come from
// the caller.
func (s *Store) AddRequest(collID, name string, payload models.RequestPayload) (models.SavedRequest, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return models.SavedRequest{}, err
	}
	for i := range s.collections {
		if s.collections[i].ID == collID {
			req := models.SavedRequest{
				ID:        uuid.NewString(),
				Name:      name,
				CollID:    collID,
				Payload:   payload,
				CreatedAt: time.Now().UTC().Format(time.RFC3339),
			}
			s.collections[i].Requests = append(s.collections[i].Requests, req)
			if err := s.save(); err != nil {
				return models.SavedRequest{}, err
			}
			return req, nil
		}
	}
	return models.SavedRequest{}, errors.New("collection not found")
}

func (s *Store) UpdateRequest(reqID, name string, payload models.RequestPayload) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	for i := range s.collections {
		for j := range s.collections[i].Requests {
			if s.collections[i].Requests[j].ID == reqID {
				s.collections[i].Requests[j].Name = name
				s.collections[i].Requests[j].Payload = payload
				return s.save()
			}
		}
	}
	return errors.New("request not found")
}

func (s *Store) DeleteRequest(reqID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	for i := range s.collections {
		for j := range s.collections[i].Requests {
			if s.collections[i].Requests[j].ID == reqID {
				s.collections[i].Requests = append(
					s.collections[i].Requests[:j],
					s.collections[i].Requests[j+1:]...,
				)
				return s.save()
			}
		}
	}
	return errors.New("request not found")
}
