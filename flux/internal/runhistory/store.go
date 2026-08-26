package runhistory

import (
	"sync"
	"time"

	"github.com/google/uuid"

	"flux/internal/storage"
)

const fileName = "runhistory.json"
const capRecords = 500

type RunRecord struct {
	ID           string `json:"id"`
	RequestID    string `json:"requestId"`
	RequestName  string `json:"requestName"`
	CollectionID string `json:"collectionId"`
	Timestamp    string `json:"timestamp"`
	Passed       bool   `json:"passed"`
	Retries      int    `json:"retries"`
	StatusCode   int    `json:"statusCode"`
	TimingMs     int64  `json:"timingMs"`
	Error        string `json:"error,omitempty"`
}

type wrapper struct {
	Records []RunRecord `json:"records"`
}

type Store struct {
	mu     sync.Mutex
	dir    string
	records []RunRecord
	loaded bool
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
	if w.Records == nil {
		w.Records = []RunRecord{}
	}
	s.records = w.Records
	s.loaded = true
	return nil
}

func (s *Store) save() error {
	return storage.SaveTo(s.dir, fileName, wrapper{Records: s.records})
}

// AppendRun stores one request's run result. Newest first, capped.
func (s *Store) AppendRun(r RunRecord) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return err
	}
	if r.ID == "" {
		r.ID = uuid.NewString()
	}
	if r.Timestamp == "" {
		r.Timestamp = time.Now().UTC().Format(time.RFC3339)
	}
	s.records = append([]RunRecord{r}, s.records...)
	if len(s.records) > capRecords {
		s.records = s.records[:capRecords]
	}
	return s.save()
}

func (s *Store) GetAll() ([]RunRecord, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return nil, err
	}
	out := make([]RunRecord, len(s.records))
	copy(out, s.records)
	return out, nil
}

func (s *Store) GetForRequest(requestID string) ([]RunRecord, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.load(); err != nil {
		return nil, err
	}
	var out []RunRecord
	for _, r := range s.records {
		if r.RequestID == requestID {
			out = append(out, r)
		}
	}
	return out, nil
}

func (s *Store) Clear() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.records = []RunRecord{}
	s.loaded = true
	return s.save()
}

// FlakyStats is the aggregated flake detection result for one request.
type FlakyStats struct {
	RequestID  string  `json:"requestId"`
	Total      int     `json:"total"`
	Passed     int     `json:"passed"`
	Failed     int     `json:"failed"`
	FlakyRuns  int     `json:"flakyRuns"` // passed after retry
	FlakeRate  float64 `json:"flakeRate"`
	IsFlaky    bool    `json:"isFlaky"`
}

// StatsFor computes flaky stats for requestID over its history (last 20).
func (s *Store) StatsFor(requestID string) (FlakyStats, error) {
	records, err := s.GetForRequest(requestID)
	if err != nil {
		return FlakyStats{}, err
	}
	if len(records) > 20 {
		records = records[:20]
	}
	stats := FlakyStats{RequestID: requestID, Total: len(records)}
	for _, r := range records {
		if r.Passed {
			stats.Passed++
		} else {
			stats.Failed++
		}
		if r.Retries > 0 && r.Passed {
			stats.FlakyRuns++
		}
	}
	if stats.Total > 0 {
		stats.FlakeRate = float64(stats.FlakyRuns) / float64(stats.Total)
	}
	// Flaky if at least one flaky run, or mixed pass/fail.
	stats.IsFlaky = stats.FlakyRuns > 0 || (stats.Passed > 0 && stats.Failed > 0)
	return stats, nil
}

func (s *Store) AllFlaky() ([]FlakyStats, error) {
	all, err := s.GetAll()
	if err != nil {
		return nil, err
	}
	seen := map[string]bool{}
	var out []FlakyStats
	for _, r := range all {
		if seen[r.RequestID] {
			continue
		}
		seen[r.RequestID] = true
		st, _ := s.StatsFor(r.RequestID)
		if st.IsFlaky {
			out = append(out, st)
		}
	}
	return out, nil
}
