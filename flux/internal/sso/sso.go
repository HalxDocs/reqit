package sso

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

// ProviderType enumerates SSO provider types.
type ProviderType string

const (
	ProviderSAML ProviderType = "saml"
	ProviderOIDC ProviderType = "oidc"
)

// SAMLConfig holds SAML 2.0 IdP configuration.
type SAMLConfig struct {
	IdPSSOURL      string `json:"idpSsoUrl"`
	IdPEntityID    string `json:"idpEntityId"`
	IdPCert        string `json:"idpCert"`
	SpEntityID     string `json:"spEntityId"`
	SpACSURL       string `json:"spAcsUrl"`
	AttributeEmail string `json:"attributeEmail"`
	AttributeName  string `json:"attributeName"`
}

// OIDCConfig holds OpenID Connect provider configuration.
type OIDCConfig struct {
	IssuerURL    string   `json:"issuerUrl"`
	ClientID     string   `json:"clientId"`
	ClientSecret string   `json:"clientSecret"`
	Scopes       []string `json:"scopes"`
	RedirectURL  string   `json:"redirectUrl"`
}

// ProviderConfig represents a configured SSO provider.
type ProviderConfig struct {
	ID      string      `json:"id"`
	Name    string      `json:"name"`
	Type    ProviderType `json:"type"`
	SAML    *SAMLConfig `json:"saml,omitempty"`
	OIDC    *OIDCConfig `json:"oidc,omitempty"`
	Enabled bool        `json:"enabled"`
	Default bool        `json:"default"`
}

// UserProfile is returned after successful SSO authentication.
type UserProfile struct {
	ProviderID string `json:"providerId"`
	ExternalID string `json:"externalId"`
	Email      string `json:"email"`
	Name       string `json:"name"`
}

// Store manages SSO provider configurations.
type Store struct {
	mu        sync.Mutex
	dataDir   string
	providers []ProviderConfig
}

// New creates an SSO store.
func New(dataDir string) *Store {
	return &Store{dataDir: dataDir}
}

// Load reads provider configs from disk.
func (s *Store) Load() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	data, err := os.ReadFile(filepath.Join(s.dataDir, "sso", "providers.json"))
	if err != nil {
		if os.IsNotExist(err) {
			s.providers = nil
			return nil
		}
		return err
	}
	return json.Unmarshal(data, &s.providers)
}

// Save writes provider configs to disk.
func (s *Store) Save() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	dir := filepath.Join(s.dataDir, "sso")
	if err := os.MkdirAll(dir, 0700); err != nil {
		return err
	}
	data, _ := json.MarshalIndent(s.providers, "", "  ")
	return os.WriteFile(filepath.Join(dir, "providers.json"), data, 0600)
}

// List returns all configured providers.
func (s *Store) List() []ProviderConfig {
	s.mu.Lock()
	defer s.mu.Unlock()
	result := make([]ProviderConfig, len(s.providers))
	copy(result, s.providers)
	return result
}

// Add creates a new provider config.
func (s *Store) Add(cfg ProviderConfig) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, p := range s.providers {
		if p.ID == cfg.ID {
			return fmt.Errorf("provider %q already exists", cfg.ID)
		}
	}
	s.providers = append(s.providers, cfg)
	return nil
}

// Remove deletes a provider config by ID.
func (s *Store) Remove(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i, p := range s.providers {
		if p.ID == id {
			s.providers = append(s.providers[:i], s.providers[i+1:]...)
			return nil
		}
	}
	return fmt.Errorf("provider %q not found", id)
}

// ToggleEnabled enables or disables a provider.
func (s *Store) ToggleEnabled(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.providers {
		if s.providers[i].ID == id {
			s.providers[i].Enabled = !s.providers[i].Enabled
			return nil
		}
	}
	return fmt.Errorf("provider %q not found", id)
}

// Authenticate performs a mock SSO authentication against a provider.
func (s *Store) Authenticate(providerID, emailHint string) (*UserProfile, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var cfg *ProviderConfig
	for i := range s.providers {
		if s.providers[i].ID == providerID {
			cfg = &s.providers[i]
			break
		}
	}
	if cfg == nil {
		return nil, fmt.Errorf("provider %q not found", providerID)
	}
	if !cfg.Enabled {
		return nil, fmt.Errorf("provider %q is disabled", providerID)
	}
	email := emailHint
	if email == "" {
		email = "user@" + cfg.ID + ".sso"
	}
	return &UserProfile{
		ProviderID: providerID,
		ExternalID: fmt.Sprintf("ext_%s_%s", cfg.ID, email),
		Email:      email,
		Name:       cfg.Name + " User",
	}, nil
}

// MarshalProviders serialises provider configs to JSON string.
func MarshalProviders(providers []ProviderConfig) (string, error) {
	data, err := json.Marshal(providers)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// UnmarshalProvider deserialises a provider config from JSON string.
func UnmarshalProvider(data string) (ProviderConfig, error) {
	var cfg ProviderConfig
	return cfg, json.Unmarshal([]byte(data), &cfg)
}

// MarshalUserProfile serialises a user profile to JSON string.
func MarshalUserProfile(p *UserProfile) (string, error) {
	data, err := json.Marshal(p)
	if err != nil {
		return "", err
	}
	return string(data), nil
}
