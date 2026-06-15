package profile

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

// AirGapConfig controls network isolation for air-gapped deployments.
type AirGapConfig struct {
	NetworkDisabled        bool `json:"networkDisabled"`
	UpdateCheckDisabled   bool `json:"updateCheckDisabled"`
	PluginDownloadsDisabled bool `json:"pluginDownloadsDisabled"`
	RegistrySyncDisabled  bool `json:"registrySyncDisabled"`
	TelemetryDisabled     bool `json:"telemetryDisabled"`
	InterceptorDisabled   bool `json:"interceptorDisabled"`
	VaultAccessDisabled   bool `json:"vaultAccessDisabled"`
	SSODisabled           bool `json:"ssoDisabled"`
}

const airgapFileName = "airgap.json"

// AirGapStore manages the air-gapped configuration.
type AirGapStore struct {
	mu     sync.Mutex
	dir    string
	config AirGapConfig
}

// NewAirGap creates an air-gap config store.
func NewAirGap(appDataDir string) *AirGapStore {
	s := &AirGapStore{dir: appDataDir}
	_ = s.load()
	return s
}

func (s *AirGapStore) load() error {
	data, err := os.ReadFile(filepath.Join(s.dir, airgapFileName))
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	return json.Unmarshal(data, &s.config)
}

func (s *AirGapStore) save() error {
	data, err := json.MarshalIndent(s.config, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(s.dir, airgapFileName), data, 0600)
}

// Get returns the current air-gap config.
func (s *AirGapStore) Get() AirGapConfig {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.config
}

// Set updates the air-gap config.
func (s *AirGapStore) Set(cfg AirGapConfig) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.config = cfg
	return s.save()
}

// IsNetworkDisabled is a convenience check.
func (s *AirGapStore) IsNetworkDisabled() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.config.NetworkDisabled
}

// MarshalAirGap serialises the config to JSON.
func MarshalAirGap(cfg AirGapConfig) (string, error) {
	data, err := json.Marshal(cfg)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// UnmarshalAirGap deserialises the config from JSON.
func UnmarshalAirGap(data string) (AirGapConfig, error) {
	var cfg AirGapConfig
	return cfg, json.Unmarshal([]byte(data), &cfg)
}
