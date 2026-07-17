package registry

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type SwaggerHubClient struct {
	BaseURL  string
	APIKey   string
	Owner    string
	Repo     string
	Version  string
	HTTP     *http.Client
}

type SwaggerHubPushResult struct {
	URL        string `json:"url"`
	Version    string `json:"version"`
	Definition string `json:"definition"`
}

func NewSwaggerHubClient(apiKey, owner, repo string) *SwaggerHubClient {
	return &SwaggerHubClient{
		BaseURL: "https://api.swaggerhub.com",
		APIKey:  apiKey,
		Owner:   owner,
		Repo:    repo,
		Version: "1.0.0",
		HTTP:    &http.Client{Timeout: 30 * time.Second},
	}
}

// Push uploads an OpenAPI spec to SwaggerHub.
func (c *SwaggerHubClient) Push(specJSON []byte) (*SwaggerHubPushResult, error) {
	url := fmt.Sprintf("%s/apis/%s/%s", c.BaseURL, c.Owner, c.Repo)
	req, err := http.NewRequest("PUT", url, bytes.NewReader(specJSON))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("SWAGGER-HUB-API-VERSION", c.Version)
	q := req.URL.Query()
	q.Set("version", c.Version)
	q.Set("force", "true")
	req.URL.RawQuery = q.Encode()
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("swaggerhub push: read body: %w", err)
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("swaggerhub push: %s: %s", resp.Status, string(body))
	}
	var result SwaggerHubPushResult
	_ = json.Unmarshal(body, &result)
	if result.URL == "" {
		result.URL = fmt.Sprintf("https://app.swaggerhub.com/apis/%s/%s/%s", c.Owner, c.Repo, c.Version)
	}
	return &result, nil
}

// Pull downloads the latest version of an OpenAPI spec from SwaggerHub.
func (c *SwaggerHubClient) Pull() ([]byte, error) {
	url := fmt.Sprintf("%s/apis/%s/%s/%s", c.BaseURL, c.Owner, c.Repo, c.Version)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("Accept", "application/json")
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("swaggerhub pull: %s: %s", resp.Status, string(body))
	}
	return body, nil
}

// SetVersion updates the version string for subsequent pushes.
func (c *SwaggerHubClient) SetVersion(v string) {
	c.Version = v
}
