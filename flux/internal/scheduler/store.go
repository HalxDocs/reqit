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
