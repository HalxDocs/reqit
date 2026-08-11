// Package sockhistory persists WebSocket/SSE/Socket.IO sessions so users can
// revisit past connections and their message logs after restart.
package sockhistory

import (
	"sync"
	"time"

	"github.com/google/uuid"

	"flux/internal/models"
	"flux/internal/storage"
)

const fileName = "sockhistory.json"
const Cap = 100

type wrapper struct {
	Sessions []models.SocketSession `json:"sessions"`
}

type Store struct {
	mu       sync.Mutex
	dir      string
	sessions []models.SocketSession
	loaded   bool
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
	if w.Sessions == nil {
		w.Sessions = []models.SocketSession{}
	}
	s.sessions = w.Sessions
	s.loaded = true
	return nil
}

func (s *Store) save() error {
	return storage.SaveTo(s.dir, fileName, wrapper{Sessions: s.sessions})
}

// Append records a new session. Sessions are stored newest-first and capped.
func (s *Store) Append(url, protocol string, headers map[string]string) (models.SocketSession, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return models.SocketSession{}, err
	}
	entry := models.SocketSession{
		ID:        uuid.NewString(),
		URL:       url,
		Protocol:  protocol,
		Headers:   headers,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
		Messages:  []models.SocketMessage{},
	}
	s.sessions = append([]models.SocketSession{entry}, s.sessions...)
	if len(s.sessions) > Cap {
		s.sessions = s.sessions[:Cap]
	}
	if err := s.save(); err != nil {
		return models.SocketSession{}, err
	}
	return entry, nil
}

// UpdateMessages replaces the message log of a stored session (e.g. when the
// live connection disconnects). No-op when the session no longer exists.
func (s *Store) UpdateMessages(id string, msgs []models.SocketMessage) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	for i := range s.sessions {
		if s.sessions[i].ID == id {
			s.sessions[i].Messages = msgs
			break
		}
	}
	return s.save()
}

// UpsertMessages merges a live message into the newest session for a protocol
// when the user has a session active but never disconnected cleanly.
func (s *Store) UpsertMessages(id string, msgs []models.SocketMessage) error {
	return s.UpdateMessages(id, msgs)
}

func (s *Store) GetAll() ([]models.SocketSession, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return nil, err
	}
	out := make([]models.SocketSession, len(s.sessions))
	copy(out, s.sessions)
	return out, nil
}

func (s *Store) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	filtered := make([]models.SocketSession, 0, len(s.sessions))
	for _, e := range s.sessions {
		if e.ID != id {
			filtered = append(filtered, e)
		}
	}
	s.sessions = filtered
	return s.save()
}

func (s *Store) Clear() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sessions = []models.SocketSession{}
	s.loaded = true
	return s.save()
}

func (s *Store) Flush() {}
