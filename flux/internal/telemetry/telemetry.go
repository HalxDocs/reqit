package telemetry

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// Opt-in telemetry engine — zero-default, completely transparent.
// No data is ever collected unless the user explicitly enables it.

// EventType enumerates telemetry event categories.
type EventType string

const (
	EventLaunch      EventType = "launch"
	EventRequest     EventType = "request"
	EventFeature     EventType = "feature"
	EventError       EventType = "error"
	EventCollection  EventType = "collection"
	EventExport      EventType = "export"
	EventIntegration EventType = "integration"
)

// Event is a single telemetry event.
type Event struct {
	Type      EventType              `json:"type"`
	Name      string                 `json:"name"`
	Timestamp int64                  `json:"ts"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// Config holds the persistent telemetry configuration.
type Config struct {
	Enabled   bool   `json:"enabled"`
	SessionID string `json:"sessionId"`
}

// Store manages telemetry events with opt-in semantics.
type Store struct {
	mu       sync.RWMutex
	dataDir  string
	config   Config
	events   []Event
	maxLocal int
}

// New creates a telemetry store. Data is stored under dataDir/telemetry/.
func New(dataDir string) *Store {
	s := &Store{
		dataDir:  dataDir,
		maxLocal: 5000,
	}
	_ = s.loadConfig()
	return s
}

// IsEnabled returns whether telemetry is opted in.
func (s *Store) IsEnabled() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.config.Enabled
}

// SetEnabled toggles telemetry on or off. When turning on, creates a session ID.
func (s *Store) SetEnabled(on bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.config.Enabled = on
	if on && s.config.SessionID == "" {
		s.config.SessionID = fmt.Sprintf("ses_%d", time.Now().UnixNano())
	}
	_ = s.saveConfig()
}

// GetConfig returns the current telemetry config (no session ID).
func (s *Store) GetConfig() Config {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return Config{Enabled: s.config.Enabled}
}

// Track records a telemetry event. No-op if telemetry is disabled.
func (s *Store) Track(typ EventType, name string, metadata map[string]interface{}) {
	if !s.IsEnabled() {
		return
	}
	evt := Event{
		Type:      typ,
		Name:      name,
		Timestamp: time.Now().UnixMilli(),
		Metadata:  metadata,
	}
	s.mu.Lock()
	s.events = append(s.events, evt)
	if len(s.events) > s.maxLocal {
		// Rotate: keep the last maxLocal/s events and flush
		keep := s.events[len(s.events)-s.maxLocal/2:]
		_ = s.flushLocked(s.events[:len(s.events)-len(keep)])
		s.events = keep
	} else {
		_ = s.flushLocked([]Event{evt})
	}
	s.mu.Unlock()
}

// GetRecentEvents returns the last N events for the local viewer.
func (s *Store) GetRecentEvents(n int) []Event {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if n <= 0 || n > len(s.events) {
		n = len(s.events)
	}
	if n > 100 {
		n = 100
	}
	result := make([]Event, n)
	start := len(s.events) - n
	if start < 0 {
		start = 0
	}
	copy(result, s.events[start:])
	return result
}

// Preview returns a human-readable summary of what data would be sent.
func (s *Store) Preview() string {
	return `reqit Telemetry — Opt-In Only

What is tracked:
- Application launches and version
- Request count (method, host — NOT URL paths or parameters)
- Feature usage (which panels/features are used)
- Error types and counts (not stack traces)
- Integration usage (CI/CD, registry, git, interceptor)
- Export type counts

What is NOT tracked:
- Request URLs, paths, query parameters, headers, or bodies
- Collection names or contents
- Environment variable values
- File paths or system information
- Personally identifiable information

Data is stored locally and only sent if you explicitly enable telemetry.
You can view all collected events at any time.
`
}

func (s *Store) loadConfig() error {
	if s.dataDir == "" {
		return nil
	}
	data, err := os.ReadFile(filepath.Join(s.dataDir, "telemetry", "config.json"))
	if err != nil {
		return nil
	}
	return json.Unmarshal(data, &s.config)
}

func (s *Store) saveConfig() error {
	if s.dataDir == "" {
		return nil
	}
	dir := filepath.Join(s.dataDir, "telemetry")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	data, _ := json.MarshalIndent(s.config, "", "  ")
	return os.WriteFile(filepath.Join(dir, "config.json"), data, 0600)
}

func (s *Store) flushLocked(evts []Event) error {
	if s.dataDir == "" || len(evts) == 0 {
		return nil
	}
	dir := filepath.Join(s.dataDir, "telemetry")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	f, err := os.OpenFile(filepath.Join(dir, "events.jsonl"), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	defer f.Close()
	for _, evt := range evts {
		line, _ := json.Marshal(evt)
		_, _ = f.Write(line)
		_, _ = f.Write([]byte("\n"))
	}
	return nil
}
