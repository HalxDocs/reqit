package testbuilder

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"

	"github.com/google/uuid"
	"flux/internal/models"
)

const testSuitesFile = "testsuites.json"

type Store struct {
	mu   sync.Mutex
	dir  string
	data []models.TestSuite
}

func NewStore(dir string) *Store {
	s := &Store{dir: dir}
	_ = s.load()
	return s
}

func (s *Store) load() error {
	if s.dir == "" {
		s.data = nil
		return nil
	}
	p := filepath.Join(s.dir, testSuitesFile)
	b, err := os.ReadFile(p)
	if err != nil {
		if os.IsNotExist(err) {
			s.data = nil
			return nil
		}
		return err
	}
	return json.Unmarshal(b, &s.data)
}

func (s *Store) save() error {
	if s.dir == "" {
		return nil
	}
	p := filepath.Join(s.dir, testSuitesFile)
	b, err := json.MarshalIndent(s.data, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(p, b, 0644)
}

func (s *Store) GetAll() []models.TestSuite {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.data == nil {
		return nil
	}
	out := make([]models.TestSuite, len(s.data))
	copy(out, s.data)
	return out
}

func (s *Store) Create(name, description, collID string) (models.TestSuite, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	ts := models.TestSuite{
		ID:          uuid.New().String(),
		Name:        name,
		Description: description,
		CollID:      collID,
	}
	s.data = append(s.data, ts)
	return ts, s.save()
}

func (s *Store) Update(ts models.TestSuite) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i := range s.data {
		if s.data[i].ID == ts.ID {
			s.data[i] = ts
			return s.save()
		}
	}
	return nil
}

func (s *Store) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i := range s.data {
		if s.data[i].ID == id {
			s.data = append(s.data[:i], s.data[i+1:]...)
			return s.save()
		}
	}
	return nil
}

func (s *Store) AddGroup(suiteID, parentID string, group models.TestGroup) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i := range s.data {
		if s.data[i].ID != suiteID {
			continue
		}
		if parentID == "" {
			s.data[i].Groups = append(s.data[i].Groups, group)
		} else {
			addChild(&s.data[i].Groups, parentID, group)
		}
		return s.save()
	}
	return nil
}

func (s *Store) UpdateGroup(suiteID string, group models.TestGroup) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i := range s.data {
		if s.data[i].ID != suiteID {
			continue
		}
		updateInPlace(&s.data[i].Groups, group)
		return s.save()
	}
	return nil
}

func (s *Store) DeleteGroup(suiteID, groupID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i := range s.data {
		if s.data[i].ID != suiteID {
			continue
		}
		s.data[i].Groups = removeGroup(s.data[i].Groups, groupID)
		return s.save()
	}
	return nil
}

func addChild(groups *[]models.TestGroup, parentID string, child models.TestGroup) {
	for i := range *groups {
		if (*groups)[i].ID == parentID {
			(*groups)[i].Children = append((*groups)[i].Children, child)
			return
		}
		if len((*groups)[i].Children) > 0 {
			addChild(&(*groups)[i].Children, parentID, child)
		}
	}
}

func updateInPlace(groups *[]models.TestGroup, updated models.TestGroup) {
	for i := range *groups {
		if (*groups)[i].ID == updated.ID {
			(*groups)[i] = updated
			return
		}
		if len((*groups)[i].Children) > 0 {
			updateInPlace(&(*groups)[i].Children, updated)
		}
	}
}

func removeGroup(groups []models.TestGroup, id string) []models.TestGroup {
	var out []models.TestGroup
	for _, g := range groups {
		if g.ID == id {
			continue
		}
		if len(g.Children) > 0 {
			g.Children = removeGroup(g.Children, id)
		}
		out = append(out, g)
	}
	return out
}
