package registry

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type StoplightClient struct {
	BaseURL     string
	APIToken    string
	ProjectSlug string
	HTTP        *http.Client
}

type StoplightPushResult struct {
	URL  string `json:"url"`
	Slug string `json:"slug"`
}

func NewStoplightClient(apiToken, projectSlug string) *StoplightClient {
	return &StoplightClient{
		BaseURL:     "https://api.stoplight.io/v1",
		APIToken:    apiToken,
		ProjectSlug: projectSlug,
		HTTP:        &http.Client{Timeout: 30 * time.Second},
	}
}

// Push uploads an OpenAPI spec to Stoplight.
func (c *StoplightClient) Push(specJSON []byte) (*StoplightPushResult, error) {
	url := fmt.Sprintf("%s/projects/%s/versions/default/apis", c.BaseURL, c.ProjectSlug)
	var payload map[string]interface{}
	_ = json.Unmarshal(specJSON, &payload)
	body, _ := json.Marshal(map[string]interface{}{
		"name":        fmt.Sprintf("reqit-export-%d", time.Now().Unix()),
		"content":     payload,
		"contentType": "application/vnd.oai.openapi+json",
	})
	req, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.APIToken)
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("stoplight push: %s: %s", resp.Status, string(respBody))
	}
	var result StoplightPushResult
	_ = json.Unmarshal(respBody, &result)
	return &result, nil
}

// Pull downloads the latest spec from Stoplight.
func (c *StoplightClient) Pull() ([]byte, error) {
	url := fmt.Sprintf("%s/projects/%s/versions/default/apis?limit=1", c.BaseURL, c.ProjectSlug)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.APIToken)
	req.Header.Set("Accept", "application/json")
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("stoplight pull: %s: %s", resp.Status, string(body))
	}
	var apis []struct {
		Content json.RawMessage `json:"content"`
	}
	_ = json.Unmarshal(body, &apis)
	if len(apis) == 0 {
		return nil, fmt.Errorf("stoplight: no APIs found in project")
	}
	return json.Marshal(apis[0].Content)
}
