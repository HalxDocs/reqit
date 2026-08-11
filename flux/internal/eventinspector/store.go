// Package eventinspector implements the Event Inspector: a local capture
// listener that records webhook POSTs to the workspace, verifies Svix
// signatures via onceo-core, dedupes by svix-id, and supports replay.
package eventinspector

import (
	"sync"
	"time"

	"github.com/google/uuid"

	"flux/internal/models"
	"flux/internal/storage"
)

const fileName = "events.json"
const Cap = 1000

type wrapper struct {
	Events []models.EventRecord `json:"events"`
}

type Store struct {
	mu       sync.Mutex
	dir      string
	events   []models.EventRecord
	loaded   bool
	verified map[string]bool // provider:providerEventID keys seen (durable)
}

func NewStore(dir string) *Store {
	return &Store{dir: dir, verified: map[string]bool{}}
}

func (s *Store) load() error {
	if s.loaded {
		return nil
	}
	w := wrapper{}
	if err := storage.LoadFrom(s.dir, fileName, &w); err != nil {
		return err
	}
	if w.Events == nil {
		w.Events = []models.EventRecord{}
	}
	s.events = w.Events
	s.verified = map[string]bool{}
	for _, e := range s.events {
		if e.VerifyStatus == "verified" && e.Provider != "" && e.ProviderEventID != "" {
			s.verified[dedupeKey(e.Provider, e.ProviderEventID)] = true
		}
	}
	s.loaded = true
	return nil
}

func (s *Store) save() error {
	return storage.SaveTo(s.dir, fileName, wrapper{Events: s.events})
}

// dedupeKey joins a provider + provider event id into a stable dedupe key,
// mirroring onceo-core's scopeKey escaping rules.
func dedupeKey(provider, providerEventID string) string {
	return provider + ":" + providerEventID
}

// Append records a new captured event. Events are stored newest-first and capped.
func (s *Store) Append(rec models.EventRecord) (models.EventRecord, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return models.EventRecord{}, err
	}
	if rec.ID == "" {
		rec.ID = uuid.NewString()
	}
	if rec.ReceivedAt == "" {
		rec.ReceivedAt = time.Now().UTC().Format(time.RFC3339)
	}
	s.events = append([]models.EventRecord{rec}, s.events...)
	if len(s.events) > Cap {
		s.events = s.events[:Cap]
	}
	if err := s.save(); err != nil {
		return models.EventRecord{}, err
	}
	return rec, nil
}

// UpdateVerify applies the verification outcome to a captured event.
func (s *Store) UpdateVerify(id string, vr models.VerifyResult) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	for i := range s.events {
		if s.events[i].ID == id {
			s.events[i].VerifyStatus = vr.Status
			s.events[i].Provider = vr.Provider
			s.events[i].ProviderEventID = vr.ProviderEventID
			s.events[i].EventType = vr.EventType
			s.events[i].VerifyError = vr.Error
			if vr.Status == "verified" && vr.Provider != "" && vr.ProviderEventID != "" {
				s.verified[dedupeKey(vr.Provider, vr.ProviderEventID)] = true
			}
			break
		}
	}
	return s.save()
}

// RecordReplay appends a replay attempt to an event and bumps its counter.
func (s *Store) RecordReplay(id string, replay models.EventReplay) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	for i := range s.events {
		if s.events[i].ID == id {
			s.events[i].ReplayCount++
			s.events[i].Replays = append(s.events[i].Replays, replay)
			break
		}
	}
	return s.save()
}

// IsKnown reports whether a provider event id has already been seen as
// verified in this store (duplicate detection).
func (s *Store) IsKnown(provider, providerEventID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	_ = s.load()
	return s.verified[dedupeKey(provider, providerEventID)]
}

func (s *Store) GetAll() ([]models.EventRecord, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return nil, err
	}
	out := make([]models.EventRecord, len(s.events))
	copy(out, s.events)
	return out, nil
}

func (s *Store) Get(id string) (models.EventRecord, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return models.EventRecord{}, err
	}
	for _, e := range s.events {
		if e.ID == id {
			return e, nil
		}
	}
	return models.EventRecord{}, nil
}

func (s *Store) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	filtered := make([]models.EventRecord, 0, len(s.events))
	for _, e := range s.events {
		if e.ID != id {
			filtered = append(filtered, e)
		}
	}
	s.events = filtered
	return s.save()
}

func (s *Store) Clear() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.events = []models.EventRecord{}
	s.verified = map[string]bool{}
	s.loaded = true
	return s.save()
}

func (s *Store) Count() (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return 0, err
	}
	return len(s.events), nil
}

func (s *Store) Flush() {}
