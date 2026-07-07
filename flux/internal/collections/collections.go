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

func (s *Store) UpdateRequestScripts(reqID string, preSetVars []models.PreSetVar, extractRules []models.ExtractRule) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	for i := range s.collections {
		for j := range s.collections[i].Requests {
			if s.collections[i].Requests[j].ID == reqID {
				s.collections[i].Requests[j].PreSetVars = preSetVars
				s.collections[i].Requests[j].ExtractRules = extractRules
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

// ReorderCollection moves a collection to a new position in the list.
func (s *Store) ReorderCollection(id string, newIndex int) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	old := -1
	for i := range s.collections {
		if s.collections[i].ID == id {
			old = i
			break
		}
	}
	if old == -1 {
		return errors.New("collection not found")
	}
	if newIndex < 0 || newIndex >= len(s.collections) {
		return errors.New("new index out of range")
	}
	if old == newIndex {
		return nil
	}
	c := s.collections[old]
	s.collections = append(s.collections[:old], s.collections[old+1:]...)
	s.collections = append(s.collections[:newIndex], append([]models.Collection{c}, s.collections[newIndex:]...)...)
	return s.save()
}

// ReorderRequest moves a request within a collection to a new position.
func (s *Store) ReorderRequest(collID, reqID string, newIndex int) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	for i := range s.collections {
		if s.collections[i].ID != collID {
			continue
		}
		old := -1
		for j := range s.collections[i].Requests {
			if s.collections[i].Requests[j].ID == reqID {
				old = j
				break
			}
		}
		if old == -1 {
			return errors.New("request not found")
		}
		if newIndex < 0 || newIndex >= len(s.collections[i].Requests) {
			return errors.New("new index out of range")
		}
		if old == newIndex {
			return nil
		}
		req := s.collections[i].Requests[old]
		s.collections[i].Requests = append(s.collections[i].Requests[:old], s.collections[i].Requests[old+1:]...)
		s.collections[i].Requests = append(s.collections[i].Requests[:newIndex], append([]models.SavedRequest{req}, s.collections[i].Requests[newIndex:]...)...)
		return s.save()
	}
	return errors.New("collection not found")
}

// MoveRequest transfers a request from its current collection to a different one.
func (s *Store) MoveRequest(reqID, targetCollID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	var req *models.SavedRequest
	srcIdx := -1
	reqIdx := -1
	for i := range s.collections {
		for j := range s.collections[i].Requests {
			if s.collections[i].Requests[j].ID == reqID {
				srcIdx = i
				reqIdx = j
				req = new(models.SavedRequest)
				*req = s.collections[i].Requests[j]
				break
			}
		}
		if req != nil {
			break
		}
	}
	if req == nil {
		return errors.New("request not found")
	}
	dstIdx := -1
	for i := range s.collections {
		if s.collections[i].ID == targetCollID {
			dstIdx = i
			break
		}
	}
	if dstIdx == -1 {
		return errors.New("target collection not found")
	}
	if srcIdx == dstIdx {
		return nil
	}
	req.CollID = targetCollID
	s.collections[srcIdx].Requests = append(s.collections[srcIdx].Requests[:reqIdx], s.collections[srcIdx].Requests[reqIdx+1:]...)
	s.collections[dstIdx].Requests = append(s.collections[dstIdx].Requests, *req)
	return s.save()
}

// DeleteRequests removes multiple requests by ID in a single save operation.
func (s *Store) DeleteRequests(ids []string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	idSet := make(map[string]bool, len(ids))
	for _, id := range ids {
		idSet[id] = true
	}
	for i := range s.collections {
		filtered := s.collections[i].Requests[:0]
		for _, req := range s.collections[i].Requests {
			if !idSet[req.ID] {
				filtered = append(filtered, req)
			}
		}
		s.collections[i].Requests = filtered
	}
	return s.save()
}

// SetSpec links an OpenAPI spec file path (relative to workspace) to a collection.
func (s *Store) SetSpec(collID, specPath string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	for i := range s.collections {
		if s.collections[i].ID == collID {
			s.collections[i].SpecPath = specPath
			return s.save()
		}
	}
	return errors.New("collection not found")
}

// SetSavedResponse stores a captured response on a saved request for mock replay.
func (s *Store) SetSavedResponse(colID, reqID string, resp models.SavedResponse) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	for i := range s.collections {
		if s.collections[i].ID == colID {
			for j := range s.collections[i].Requests {
				if s.collections[i].Requests[j].ID == reqID {
					s.collections[i].Requests[j].SavedResponse = &resp
					return s.save()
				}
			}
		}
	}
	return errors.New("request not found")
}

// SetCollectionVariables updates the variables for a collection.
func (s *Store) SetCollectionVariables(collID string, vars []models.EnvVar) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	for i := range s.collections {
		if s.collections[i].ID == collID {
			s.collections[i].Variables = vars
			return s.save()
		}
	}
	return errors.New("collection not found")
}

// SetMockOverride updates the mock override settings for a saved request.
func (s *Store) SetMockOverride(colID, reqID string, o models.MockOverride) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	for i := range s.collections {
		if s.collections[i].ID == colID {
			for j := range s.collections[i].Requests {
				if s.collections[i].Requests[j].ID == reqID {
					s.collections[i].Requests[j].MockOverride = &o
					return s.save()
				}
			}
		}
	}
	return errors.New("request not found")
}
