package mcp

import (
	"encoding/json"
	"sync"
	"time"

	"github.com/google/uuid"

	"flux/internal/storage"
)

const mcpTrafficFile = "mcp_traffic.json"
const trafficCap = 1000

// TrafficEntry is one JSON-RPC frame seen on the MCP wire — a single
// request/response pair. It is intentionally flat and JSON-friendly so the
// frontend can render it with the same BodyView/HeadersView stack as HTTP.
type TrafficEntry struct {
	ID        string          `json:"id"`
	Timestamp string          `json:"timestamp"` // RFC3339
	Direction string          `json:"direction"` // "req" | "res"
	Method    string          `json:"method"`    // e.g. tools/list, tools/call, initialize
	ToolName  string          `json:"toolName,omitempty"`
	RequestID json.RawMessage `json:"requestId,omitempty"`
	Params    json.RawMessage `json:"params,omitempty"`
	Result    json.RawMessage `json:"result,omitempty"`
	Error     *RPCError       `json:"error,omitempty"`
	Status    string          `json:"status"` // "ok" | "error" | "pending"
	LatencyMs int64           `json:"latencyMs"`
	Raw       string          `json:"raw,omitempty"` // truncated JSON for search
}

type trafficWrapper struct {
	Entries []TrafficEntry `json:"entries"`
}

// TrafficStore persists MCP frames per workspace, mirroring eventinspector.Store
// and sockhistory.Store: newest-first, capped, file-backed.
type TrafficStore struct {
	mu     sync.Mutex
	dir    string
	entries []TrafficEntry
	loaded bool
}

func NewTrafficStore(dir string) *TrafficStore {
	return &TrafficStore{dir: dir}
}

func (s *TrafficStore) load() error {
	if s.loaded {
		return nil
	}
	w := trafficWrapper{}
	if err := storage.LoadFrom(s.dir, mcpTrafficFile, &w); err != nil {
		return err
	}
	if w.Entries == nil {
		w.Entries = []TrafficEntry{}
	}
	s.entries = w.Entries
	s.loaded = true
	return nil
}

func (s *TrafficStore) save() error {
	return storage.SaveTo(s.dir, mcpTrafficFile, trafficWrapper{Entries: s.entries})
}

func (s *TrafficStore) Append(e TrafficEntry) (TrafficEntry, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return TrafficEntry{}, err
	}
	if e.ID == "" {
		e.ID = uuid.NewString()
	}
	if e.Timestamp == "" {
		e.Timestamp = time.Now().UTC().Format(time.RFC3339)
	}
	s.entries = append([]TrafficEntry{e}, s.entries...)
	if len(s.entries) > trafficCap {
		s.entries = s.entries[:trafficCap]
	}
	if err := s.save(); err != nil {
		return TrafficEntry{}, err
	}
	return e, nil
}

func (s *TrafficStore) GetAll() ([]TrafficEntry, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return nil, err
	}
	out := make([]TrafficEntry, len(s.entries))
	copy(out, s.entries)
	return out, nil
}

func (s *TrafficStore) Get(id string) (TrafficEntry, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return TrafficEntry{}, err
	}
	for _, e := range s.entries {
		if e.ID == id {
			return e, nil
		}
	}
	return TrafficEntry{}, nil
}

func (s *TrafficStore) Clear() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.entries = []TrafficEntry{}
	s.loaded = true
	return s.save()
}

func (s *TrafficStore) Count() (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return 0, err
	}
	return len(s.entries), nil
}
