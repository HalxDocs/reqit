package locks

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type LockInfo struct {
	User  string `json:"user"`
	Email string `json:"email"`
	Since string `json:"since"`
}

type Store struct {
	dir string
}

func New(workspaceDir string) *Store {
	dir := filepath.Join(workspaceDir, ".locks")
	_ = os.MkdirAll(dir, 0755)
	return &Store{dir: dir}
}

func (s *Store) Lock(id, user, email string) error {
	info := LockInfo{
		User:  user,
		Email: email,
		Since: time.Now().Format(time.RFC3339),
	}
	data, _ := json.MarshalIndent(info, "", "  ")
	return os.WriteFile(filepath.Join(s.dir, id+".lock"), data, 0644)
}

func (s *Store) Unlock(id string) error {
	err := os.Remove(filepath.Join(s.dir, id+".lock"))
	if os.IsNotExist(err) {
		return nil
	}
	return err
}

func (s *Store) GetAll() (map[string]LockInfo, error) {
	result := map[string]LockInfo{}
	entries, err := os.ReadDir(s.dir)
	if err != nil {
		if os.IsNotExist(err) {
			return result, nil
		}
		return nil, err
	}
	for _, e := range entries {
		if !strings.HasSuffix(e.Name(), ".lock") {
			continue
		}
		raw, err := os.ReadFile(filepath.Join(s.dir, e.Name()))
		if err != nil {
			continue
		}
		var info LockInfo
		if json.Unmarshal(raw, &info) == nil {
			result[strings.TrimSuffix(e.Name(), ".lock")] = info
		}
	}
	return result, nil
}

func (s *Store) UnlockAll(user string) {
	entries, _ := os.ReadDir(s.dir)
	for _, e := range entries {
		if !strings.HasSuffix(e.Name(), ".lock") {
			continue
		}
		raw, err := os.ReadFile(filepath.Join(s.dir, e.Name()))
		if err != nil {
			continue
		}
		var info LockInfo
		if json.Unmarshal(raw, &info) == nil && info.User == user {
			_ = os.Remove(filepath.Join(s.dir, e.Name()))
		}
	}
}
