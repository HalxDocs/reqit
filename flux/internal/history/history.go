// Package history persists the last N request/response pairs to a JSON file
// in the Flux app data dir. Phase 1 caps at 50 entries; older entries are
// dropped on append.
package history

import (
	"sync"
	"time"

	"github.com/google/uuid"

	"flux/internal/models"
	"flux/internal/storage"
)

const fileName = "history.json"
const Cap = 50

type wrapper struct {
	Entries []models.HistoryEntry `json:"entries"`
}

type Store struct {
	mu      sync.Mutex
	dir     string
	entries []models.HistoryEntry
	loaded  bool
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
	if w.Entries == nil {
		w.Entries = []models.HistoryEntry{}
	}
	s.entries = w.Entries
	s.loaded = true
	return nil
}

func (s *Store) save() error {
	return storage.SaveTo(s.dir, fileName, wrapper{Entries: s.entries})
}

// Append prepends a new entry and trims to the most recent Cap entries.
func (s *Store) Append(payload models.RequestPayload, response models.ResponseResult) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	entry := models.HistoryEntry{
		ID:        uuid.NewString(),
		Payload:   payload,
		Response:  response,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
	}
	s.entries = append([]models.HistoryEntry{entry}, s.entries...)
	if len(s.entries) > Cap {
		s.entries = s.entries[:Cap]
	}
	return s.save()
}

func (s *Store) GetAll() ([]models.HistoryEntry, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return nil, err
	}
	out := make([]models.HistoryEntry, len(s.entries))
	copy(out, s.entries)
	return out, nil
}

func (s *Store) Clear() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.entries = []models.HistoryEntry{}
	s.loaded = true
	return s.save()
}
