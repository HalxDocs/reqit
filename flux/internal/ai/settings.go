package ai

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

type Settings struct {
	mu       sync.RWMutex
	config   Config
	filePath string
}

type StoredSettings struct {
	Enabled  bool   `json:"enabled"`
	Provider string `json:"provider"`
	APIKey   string `json:"apiKey"`
	BaseURL  string `json:"baseUrl"`
	Model    string `json:"model"`
}

func NewSettings(workspaceDir string) *Settings {
	return &Settings{
		filePath: filepath.Join(workspaceDir, ".reqit", "ai.json"),
	}
}

func (s *Settings) Load() {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := os.ReadFile(s.filePath)
	if err != nil {
		return
	}
	var stored StoredSettings
	if err := json.Unmarshal(data, &stored); err != nil {
		return
	}
	s.config = Config{
		Provider: Provider(stored.Provider),
		APIKey:   stored.APIKey,
		BaseURL:  stored.BaseURL,
		Model:    stored.Model,
	}
}

func (s *Settings) Save(cfg Config) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.config = cfg
	stored := StoredSettings{
		Enabled:  cfg.APIKey != "" || cfg.Provider == ProviderOllama,
		Provider: string(cfg.Provider),
		APIKey:   cfg.APIKey,
		BaseURL:  cfg.BaseURL,
		Model:    cfg.Model,
	}
	b, err := json.MarshalIndent(stored, "", "  ")
	if err != nil {
		return err
	}
	dir := filepath.Dir(s.filePath)
	os.MkdirAll(dir, 0755)
	return os.WriteFile(s.filePath, b, 0644)
}

func (s *Settings) Get() Config {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.config
}

func (s *Settings) IsConfigured() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.config.APIKey != "" || s.config.Provider == ProviderOllama
}
