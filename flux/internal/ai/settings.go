package ai

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/zalando/go-keyring"
)

const keyringSvc = "reqit-ai"

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
	// Migrate: if key is in config file but not in keyring, move it.
	if s.config.APIKey != "" {
		if _, krErr := keyring.Get(keyringSvc, "api-key"); krErr != nil {
			keyring.Set(keyringSvc, "api-key", s.config.APIKey)
		}
	}
	// Try loading from keyring (preferred).
	if key, krErr := keyring.Get(keyringSvc, "api-key"); krErr == nil && key != "" {
		s.config.APIKey = key
	}
}

func (s *Settings) Save(cfg Config) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.config = cfg
	// Store API key in OS keyring (never in plaintext file).
	if cfg.APIKey != "" {
		if err := keyring.Set(keyringSvc, "api-key", cfg.APIKey); err != nil {
			return err
		}
	} else {
		keyring.Delete(keyringSvc, "api-key")
	}
	stored := StoredSettings{
		Enabled:  cfg.APIKey != "" || cfg.Provider == ProviderOllama,
		Provider: string(cfg.Provider),
		APIKey:   "", // never write key to disk
		BaseURL:  cfg.BaseURL,
		Model:    cfg.Model,
	}
	b, err := json.MarshalIndent(stored, "", "  ")
	if err != nil {
		return err
	}
	dir := filepath.Dir(s.filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}
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
	if s.config.Provider == ProviderOllama {
		return true
	}
	if s.config.APIKey != "" {
		return true
	}
	// Check keyring.
	_, err := keyring.Get(keyringSvc, "api-key")
	return err == nil
}
