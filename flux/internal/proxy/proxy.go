package proxy

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

type Config struct {
	Enabled  bool   `json:"enabled"`
	URL      string `json:"url"`
	Username string `json:"username,omitempty"`
	Password string `json:"password,omitempty"`
}

const configFileName = "proxy.json"

type Store struct {
	mu     sync.Mutex
	dir    string
	config Config
}

func NewStore(appDataDir string) *Store {
	s := &Store{dir: appDataDir}
	_ = s.load()
	return s
}

func (s *Store) load() error {
	data, err := os.ReadFile(filepath.Join(s.dir, configFileName))
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	return json.Unmarshal(data, &s.config)
}

func (s *Store) save() error {
	data, err := json.MarshalIndent(s.config, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(s.dir, configFileName), data, 0600)
}

func (s *Store) Get() Config {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.config
}

func (s *Store) Set(cfg Config) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.config = cfg
	return s.save()
}

func MarshalConfig(cfg Config) (string, error) {
	data, err := json.Marshal(cfg)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func UnmarshalConfig(data string) (Config, error) {
	var cfg Config
	return cfg, json.Unmarshal([]byte(data), &cfg)
}
