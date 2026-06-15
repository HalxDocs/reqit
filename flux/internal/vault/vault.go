package vault

import (
	"encoding/json"
	"errors"
	"fmt"
	"os/exec"
	"strings"
)

// Provider is the interface for secret vault backends.
type Provider interface {
	// GetSecret retrieves a secret value by path/key.
	GetSecret(path string) (string, error)
	// SetSecret stores a secret value at the given path/key.
	SetSecret(path, value string) error
	// Name returns the provider name.
	Name() string
}

// Config holds provider-specific configuration.
type Config struct {
	Type   string `json:"type"`   // "1password", "hashicorp", "aws"
	Token  string `json:"token"`  // Vault token, AWS secret key, or 1Password service account token
	Addr   string `json:"addr"`   // Vault address (e.g. https://vault.example.com:8200)
	Region string `json:"region"` // AWS region
}

// New creates a vault provider from config.
func New(cfg Config) (Provider, error) {
	switch cfg.Type {
	case "1password":
		return NewOnePassword(cfg.Token), nil
	case "hashicorp":
		return NewHashiCorp(cfg.Token, cfg.Addr), nil
	case "aws":
		return NewAWS(cfg.Token, cfg.Region), nil
	default:
		return nil, fmt.Errorf("unknown vault type: %s", cfg.Type)
	}
}

// OnePasswordProvider talks to the 1Password CLI.
type OnePasswordProvider struct {
	token string
}

func NewOnePassword(token string) *OnePasswordProvider {
	return &OnePasswordProvider{token: token}
}

func (p *OnePasswordProvider) Name() string { return "1Password" }

func (p *OnePasswordProvider) GetSecret(path string) (string, error) {
	parts := strings.SplitN(path, "/", 2)
	if len(parts) < 2 {
		return "", errors.New("path must be vault/item")
	}
	args := []string{"read", fmt.Sprintf("op://%s/%s", parts[0], parts[1])}
	if p.token != "" {
		args = append([]string{"--account", p.token}, args...)
	}
	out, err := exec.Command("op", args...).Output()
	if err != nil {
		return "", fmt.Errorf("1password: %w", err)
	}
	return strings.TrimSpace(string(out)), nil
}

func (p *OnePasswordProvider) SetSecret(path, value string) error {
	parts := strings.SplitN(path, "/", 2)
	if len(parts) < 2 {
		return errors.New("path must be vault/item")
	}
	args := []string{"create", "item", "--vault=" + parts[0], "--title=" + parts[1],
		fmt.Sprintf("password=%s", value)}
	if p.token != "" {
		args = append([]string{"--account", p.token}, args...)
	}
	_, err := exec.Command("op", args...).Output()
	if err != nil {
		return fmt.Errorf("1password: %w", err)
	}
	return nil
}

// HashiCorpProvider talks to HashiCorp Vault KV store.
type HashiCorpProvider struct {
	token string
	addr  string
}

func NewHashiCorp(token, addr string) *HashiCorpProvider {
	return &HashiCorpProvider{token: token, addr: addr}
}

func (p *HashiCorpProvider) Name() string { return "HashiCorp Vault" }

func (p *HashiCorpProvider) GetSecret(path string) (string, error) {
	out, err := exec.Command("vault", "kv", "get",
		"-address="+p.addr, "-token="+p.token,
		"-field=value", path).Output()
	if err != nil {
		return "", fmt.Errorf("vault: %w", err)
	}
	return strings.TrimSpace(string(out)), nil
}

func (p *HashiCorpProvider) SetSecret(path, value string) error {
	_, err := exec.Command("vault", "kv", "put",
		"-address="+p.addr, "-token="+p.token,
		path, "value="+value).Output()
	if err != nil {
		return fmt.Errorf("vault: %w", err)
	}
	return nil
}

// AWSProvider talks to AWS Secrets Manager.
type AWSProvider struct {
	secretKey string
	region    string
}

func NewAWS(secretKey, region string) *AWSProvider {
	return &AWSProvider{secretKey: secretKey, region: region}
}

func (p *AWSProvider) Name() string { return "AWS Secrets Manager" }

func (p *AWSProvider) GetSecret(path string) (string, error) {
	args := []string{"secretsmanager", "get-secret-value", "--secret-id", path, "--region", p.region,
		"--query", "SecretString", "--output", "text"}
	out, err := exec.Command("aws", args...).Output()
	if err != nil {
		return "", fmt.Errorf("aws: %w", err)
	}
	return strings.TrimSpace(string(out)), nil
}

func (p *AWSProvider) SetSecret(path, value string) error {
	args := []string{"secretsmanager", "put-secret-value", "--secret-id", path,
		"--secret-string", value, "--region", p.region}
	_, err := exec.Command("aws", args...).Output()
	if err != nil {
		return fmt.Errorf("aws: %w", err)
	}
	return nil
}

// MarshalConfig serialises vault config to JSON.
func MarshalConfig(cfg Config) (string, error) {
	data, err := json.Marshal(cfg)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// UnmarshalConfig deserialises vault config from JSON.
func UnmarshalConfig(data string) (Config, error) {
	var cfg Config
	return cfg, json.Unmarshal([]byte(data), &cfg)
}
