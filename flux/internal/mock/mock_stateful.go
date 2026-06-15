package mock

import (
	"fmt"
	"sync"
)

// StateStore provides per-route and per-session counters for stateful mock behaviour.
type StateStore struct {
	mu       sync.RWMutex
	counters map[string]int
	sessions map[string]map[string]int
}

func NewStateStore() *StateStore {
	return &StateStore{
		counters: make(map[string]int),
		sessions: make(map[string]map[string]int),
	}
}

func (s *StateStore) Next(routeKey string) int {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.counters[routeKey]++
	return s.counters[routeKey]
}

func (s *StateStore) Reset(routeKey string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.counters, routeKey)
}

func (s *StateStore) Get(routeKey string) int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.counters[routeKey]
}

func (s *StateStore) Sequence(routeKey string, values []int) (int, bool) {
	c := s.Next(routeKey)
	if c > len(values) {
		return values[len(values)-1], true
	}
	return values[c-1], true
}

// SessionNext increments a counter scoped to a session ID (e.g. from a cookie or header).
func (s *StateStore) SessionNext(sessionID, routeKey string) int {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.sessions[sessionID] == nil {
		s.sessions[sessionID] = make(map[string]int)
	}
	s.sessions[sessionID][routeKey]++
	return s.sessions[sessionID][routeKey]
}

// ErrUnsupportedState indicates a state feature is not yet implemented.
var ErrUnsupportedState = fmt.Errorf("unsupported state operation")
