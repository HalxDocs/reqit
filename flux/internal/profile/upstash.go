package profile

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

type upstashClient struct {
	url   string
	token string
}

func newUpstashClient() *upstashClient {
	url := os.Getenv("UPSTASH_REDIS_REST_URL")
	token := os.Getenv("UPSTASH_REDIS_REST_TOKEN")

	// Also check config file in app data directory
	if url == "" || token == "" {
		if cfgURL, cfgToken, ok := loadUpstashConfig(); ok {
			url = cfgURL
			token = cfgToken
		}
	}

	if url == "" || token == "" {
		return nil
	}
	return &upstashClient{url: strings.TrimRight(url, "/"), token: token}
}

func loadUpstashConfig() (url, token string, ok bool) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", "", false
	}

	// Try platform-specific paths
	var configDir string
	switch {
	case os.Getenv("APPDATA") != "":
		configDir = filepath.Join(os.Getenv("APPDATA"), "reqit")
	case os.Getenv("XDG_CONFIG_HOME") != "":
		configDir = filepath.Join(os.Getenv("XDG_CONFIG_HOME"), "reqit")
	default:
		configDir = filepath.Join(home, ".config", "reqit")
	}

	data, err := os.ReadFile(filepath.Join(configDir, "upstash.json"))
	if err != nil {
		return "", "", false
	}

	var cfg struct {
		URL   string `json:"url"`
		Token string `json:"token"`
	}
	if err := json.Unmarshal(data, &cfg); err != nil {
		return "", "", false
	}
	return cfg.URL, cfg.Token, cfg.URL != "" && cfg.Token != ""
}

// SaveUpstashConfig persists Upstash credentials to the app config directory.
func SaveUpstashConfig(url, token string) error {
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}

	var configDir string
	switch {
	case os.Getenv("APPDATA") != "":
		configDir = filepath.Join(os.Getenv("APPDATA"), "reqit")
	case os.Getenv("XDG_CONFIG_HOME") != "":
		configDir = filepath.Join(os.Getenv("XDG_CONFIG_HOME"), "reqit")
	default:
		configDir = filepath.Join(home, ".config", "reqit")
	}

	os.MkdirAll(configDir, 0700)

	cfg := struct {
		URL   string `json:"url"`
		Token string `json:"token"`
	}{URL: url, Token: token}

	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(configDir, "upstash.json"), data, 0600)
}

func (c *upstashClient) get(key string) (string, error) {
	req, err := http.NewRequest("GET", c.url+"/get/"+key, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("upstash GET %d: %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		Result string `json:"result"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", fmt.Errorf("decode response: %w", err)
	}
	return result.Result, nil
}

func (c *upstashClient) set(key, value string) error {
	req, err := http.NewRequest("POST", c.url+"/set/"+key, strings.NewReader(value))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return fmt.Errorf("upstash SET %d: %s", resp.StatusCode, string(respBody))
	}
	return nil
}

// PublishToUpstash stores the public profile JSON in Upstash Redis.
func PublishToUpstash(profile *PublicProfile) error {
	c := newUpstashClient()
	if c == nil {
		return fmt.Errorf("Upstash not configured — open Settings > Upstash to enter your API keys")
	}

	data, err := json.MarshalIndent(profile, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal profile: %w", err)
	}

	key := fmt.Sprintf("profile:%s", profile.Username)
	return c.set(key, string(data))
}

// FetchProfileFromUpstash retrieves a public profile from Upstash Redis.
func FetchProfileFromUpstash(username string) (*PublicProfile, error) {
	c := newUpstashClient()
	if c == nil {
		return nil, fmt.Errorf("Upstash not configured")
	}

	key := fmt.Sprintf("profile:%s", username)
	data, err := c.get(key)
	if err != nil {
		return nil, fmt.Errorf("profile not found")
	}
	if data == "" {
		return nil, fmt.Errorf("profile not found")
	}

	var profile PublicProfile
	if err := json.Unmarshal([]byte(data), &profile); err != nil {
		return nil, fmt.Errorf("decode profile: %w", err)
	}
	return &profile, nil
}

// IsUpstashConfigured returns true if Upstash credentials are available.
func IsUpstashConfigured() bool {
	return newUpstashClient() != nil
}
