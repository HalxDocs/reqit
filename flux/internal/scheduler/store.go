package scheduler

import (
	"encoding/json"
	"os"
	"sync"
	"time"
)

type ScheduledRun struct {
	ID           string `json:"id"`
	CollectionID string `json:"collectionId"`
	Name         string `json:"name"`
	CronExpr     string `json:"cronExpr"`
	Enabled      bool   `json:"enabled"`
	LastRunAt    string `json:"lastRunAt,omitempty"`
	NextRunAt    string `json:"nextRunAt,omitempty"`
	CreatedAt    string `json:"createdAt"`
}

type RunRecord struct {
	ID             string `json:"id"`
	ScheduleID     string `json:"scheduleId"`
	CollectionID   string `json:"collectionId"`
	CollectionName string `json:"collectionName"`
	Passed         int    `json:"passed"`
	Failed         int    `json:"failed"`
	Total          int    `json:"total"`
	DurationMs     int64  `json:"durationMs"`
	StartedAt      string `json:"startedAt"`
	FinishedAt     string `json:"finishedAt"`
	Error          string `json:"error,omitempty"`
}

type Store struct {
	mu      sync.Mutex
	dir     string
	entries []ScheduledRun
	loaded  bool
}

func NewStore(dir string) *Store {
	return &Store{dir: dir}
}

func (s *Store) load() error {
	if s.loaded {
		return nil
	}
	s.loaded = true
	path := s.dir + "/schedules.json"
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			s.entries = nil
			return nil
		}
		return err
	}
	return json.Unmarshal(data, &s.entries)
}

func (s *Store) save() error {
	path := s.dir + "/schedules.json"
	data, err := json.MarshalIndent(s.entries, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

func (s *Store) GetAll() ([]ScheduledRun, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return nil, err
	}
	result := make([]ScheduledRun, len(s.entries))
	copy(result, s.entries)
	return result, nil
}

func (s *Store) Create(entry ScheduledRun) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	now := time.Now().UTC().Format(time.RFC3339)
	entry.CreatedAt = now
	if expr, err := ParseCron(entry.CronExpr); err == nil {
		if next := expr.NextAfter(time.Now()); !next.IsZero() {
			entry.NextRunAt = next.Format(time.RFC3339)
		}
	}
	s.entries = append(s.entries, entry)
	return s.save()
}

func (s *Store) Update(id string, patch map[string]interface{}) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	for i := range s.entries {
		if s.entries[i].ID == id {
			e := &s.entries[i]
			if v, ok := patch["name"]; ok {
				e.Name = v.(string)
			}
			if v, ok := patch["cronExpr"]; ok {
				e.CronExpr = v.(string)
				if expr, err := ParseCron(e.CronExpr); err == nil {
					if next := expr.NextAfter(time.Now()); !next.IsZero() {
						e.NextRunAt = next.Format(time.RFC3339)
					}
				}
			}
			if v, ok := patch["enabled"]; ok {
				e.Enabled = v.(bool)
			}
			if v, ok := patch["lastRunAt"]; ok {
				e.LastRunAt = v.(string)
				if expr, err := ParseCron(e.CronExpr); err == nil {
					if next := expr.NextAfter(time.Now()); !next.IsZero() {
						e.NextRunAt = next.Format(time.RFC3339)
					}
				}
			}
			return s.save()
		}
	}
	return nil
}

func (s *Store) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	for i := range s.entries {
		if s.entries[i].ID == id {
			s.entries = append(s.entries[:i], s.entries[i+1:]...)
			return s.save()
		}
	}
	return nil
}

func (s *Store) DueEntries() []ScheduledRun {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now()
	var due []ScheduledRun
	for _, e := range s.entries {
		if !e.Enabled {
			continue
		}
		expr, err := ParseCron(e.CronExpr)
		if err != nil {
			continue
		}
		if expr.Matches(now) {
			due = append(due, e)
		}
	}
	return due
}

// --- Run History ---

func historyPath(dir string) string {
	return dir + "/scheduler_history.json"
}

func (s *Store) loadHistory() ([]RunRecord, error) {
	path := historyPath(s.dir)
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	var records []RunRecord
	if err := json.Unmarshal(data, &records); err != nil {
		return nil, err
	}
	return records, nil
}

func (s *Store) saveHistory(records []RunRecord) error {
	data, err := json.MarshalIndent(records, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(historyPath(s.dir), data, 0644)
}

func (s *Store) RecordRun(rec RunRecord) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	records, err := s.loadHistory()
	if err != nil {
		return err
	}
	records = append(records, rec)
	// Keep last 200 records.
	if len(records) > 200 {
		records = records[len(records)-200:]
	}
	return s.saveHistory(records)
}

func (s *Store) GetHistory(scheduleID string, limit int) ([]RunRecord, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	records, err := s.loadHistory()
	if err != nil {
		return nil, err
	}
	if scheduleID != "" {
		var filtered []RunRecord
		for _, r := range records {
			if r.ScheduleID == scheduleID {
				filtered = append(filtered, r)
			}
		}
		records = filtered
	}
	// Newest first.
	for i, j := 0, len(records)-1; i < j; i, j = i+1, j-1 {
		records[i], records[j] = records[j], records[i]
	}
	if limit > 0 && len(records) > limit {
		records = records[:limit]
	}
	return records, nil
}
