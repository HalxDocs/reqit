package audit

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/google/uuid"
)

// Action type for audit events.
type Action string

const (
	ActionCreate Action = "create"
	ActionRead   Action = "read"
	ActionUpdate Action = "update"
	ActionDelete Action = "delete"
	ActionExport Action = "export"
	ActionImport Action = "import"
	ActionLogin  Action = "login"
	ActionRun    Action = "run"
	ActionShare  Action = "share"
	ActionConfig Action = "config"
)

// Entry is a single audit log entry.
type Entry struct {
	ID          string            `json:"id"`
	Timestamp   int64             `json:"ts"`
	Actor       string            `json:"actor"`
	Action      Action            `json:"action"`
	Resource    string            `json:"resource"`
	ResourceID  string            `json:"resourceId"`
	WorkspaceID string            `json:"workspaceId"`
	Details     map[string]string `json:"details,omitempty"`
}

// Store provides thread-safe audit trail logging.
type Store struct {
	mu      sync.Mutex
	dataDir string
	file    *os.File
}

// New creates an audit log store at dataDir/audit/.
func New(dataDir string) *Store {
	return &Store{dataDir: dataDir}
}

// openFile opens (or creates) the audit log file for appending.
func (s *Store) openFile() error {
	if s.file != nil {
		return nil
	}
	dir := filepath.Join(s.dataDir, "audit")
	if err := os.MkdirAll(dir, 0700); err != nil {
		return err
	}
	f, err := os.OpenFile(filepath.Join(dir, "audit.jsonl"), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	s.file = f
	return nil
}

// Log records an audit event.
func (s *Store) Log(actor string, action Action, resource, resourceID, workspaceID string, details map[string]string) error {
	entry := Entry{
		ID:          uuid.NewString(),
		Timestamp:   time.Now().UnixMilli(),
		Actor:       actor,
		Action:      action,
		Resource:    resource,
		ResourceID:  resourceID,
		WorkspaceID: workspaceID,
		Details:     details,
	}
	data, err := json.Marshal(entry)
	if err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.openFile(); err != nil {
		return err
	}
	_, err = s.file.Write(append(data, '\n'))
	return err
}

// Query returns audit entries matching the given filters.
func (s *Store) Query(limit, offset int, actor, action, resource, workspaceID string) ([]Entry, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	all, err := s.readAll()
	if err != nil {
		return nil, err
	}
	var filtered []Entry
	for _, e := range all {
		if actor != "" && e.Actor != actor {
			continue
		}
		if action != "" && string(e.Action) != action {
			continue
		}
		if resource != "" && e.Resource != resource {
			continue
		}
		if workspaceID != "" && e.WorkspaceID != workspaceID {
			continue
		}
		filtered = append(filtered, e)
	}
	// Reverse chronological (newest first)
	for i, j := 0, len(filtered)-1; i < j; i, j = i+1, j-1 {
		filtered[i], filtered[j] = filtered[j], filtered[i]
	}
	start := offset
	if start > len(filtered) {
		return nil, nil
	}
	end := start + limit
	if end > len(filtered) || limit <= 0 {
		end = len(filtered)
	}
	return filtered[start:end], nil
}

// Close closes the audit log file.
func (s *Store) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.file != nil {
		return s.file.Close()
	}
	return nil
}

func (s *Store) readAll() ([]Entry, error) {
	dir := filepath.Join(s.dataDir, "audit")
	data, err := os.ReadFile(filepath.Join(dir, "audit.jsonl"))
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	var entries []Entry
	for _, line := range splitLines(data) {
		var e Entry
		if err := json.Unmarshal(line, &e); err != nil {
			continue
		}
		entries = append(entries, e)
	}
	return entries, nil
}

func splitLines(data []byte) [][]byte {
	var lines [][]byte
	start := 0
	for i, b := range data {
		if b == '\n' {
			if i > start {
				lines = append(lines, data[start:i])
			}
			start = i + 1
		}
	}
	if start < len(data) {
		lines = append(lines, data[start:])
	}
	return lines
}

// Short returns a human-readable summary of an entry.
func (e Entry) Short() string {
	return fmt.Sprintf("[%s] %s %s %s/%s", formatTime(e.Timestamp), e.Actor, e.Action, e.Resource, e.ResourceID)
}

func formatTime(ts int64) string {
	return time.UnixMilli(ts).Format("2006-01-02 15:04:05")
}

// MarshalEntries serialises a slice of audit entries to JSON.
func MarshalEntries(entries []Entry) (string, error) {
	if len(entries) == 0 {
		return "[]", nil
	}
	data, err := json.Marshal(entries)
	if err != nil {
		return "", err
	}
	return string(data), nil
}
