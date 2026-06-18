package ai

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type Provider string

const (
	ProviderOpenAI    Provider = "openai"
	ProviderAnthropic Provider = "anthropic"
	ProviderGemini    Provider = "gemini"
	ProviderOllama    Provider = "ollama"
)

type Config struct {
	Provider Provider `json:"provider"`
	APIKey   string   `json:"apiKey"`
	BaseURL  string   `json:"baseUrl"`
	Model    string   `json:"model"`
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatRequest struct {
	Messages    []Message `json:"messages"`
	Temperature float64   `json:"temperature,omitempty"`
	MaxTokens   int       `json:"max_tokens,omitempty"`
	Stream      bool      `json:"stream"`
}

type ChatResponse struct {
	Content string `json:"content"`
	Error   string `json:"error,omitempty"`
}

var DefaultModels = map[Provider]string{
	ProviderOpenAI:    "gpt-4o",
	ProviderAnthropic: "claude-sonnet-4-20250514",
	ProviderGemini:    "gemini-2.0-flash",
	ProviderOllama:    "llama3.2",
}

var DefaultBaseURLs = map[Provider]string{
	ProviderOpenAI:    "https://api.openai.com/v1",
	ProviderAnthropic: "https://api.anthropic.com",
	ProviderGemini:    "https://generativelanguage.googleapis.com/v1beta",
	ProviderOllama:    "http://localhost:11434",
}

func Chat(cfg Config, messages []Message) (string, error) {
	cfg = applyDefaults(cfg)
	switch cfg.Provider {
	case ProviderOpenAI:
		return chatOpenAI(cfg, messages, false)
	case ProviderAnthropic:
		return chatAnthropic(cfg, messages, false)
	case ProviderGemini:
		return chatGemini(cfg, messages, false)
	case ProviderOllama:
		return chatOllama(cfg, messages, false)
	default:
		return "", fmt.Errorf("unknown provider: %s", cfg.Provider)
	}
}

func ChatStream(cfg Config, messages []Message, onChunk func(string)) error {
	cfg = applyDefaults(cfg)
	switch cfg.Provider {
	case ProviderOpenAI:
		_, err := chatOpenAI(cfg, messages, true, onChunk)
		return err
	case ProviderAnthropic:
		_, err := chatAnthropic(cfg, messages, true, onChunk)
		return err
	case ProviderGemini:
		_, err := chatGemini(cfg, messages, true, onChunk)
		return err
	case ProviderOllama:
		_, err := chatOllama(cfg, messages, true, onChunk)
		return err
	default:
		return fmt.Errorf("unknown provider: %s", cfg.Provider)
	}
}

func applyDefaults(cfg Config) Config {
	if cfg.BaseURL == "" {
		cfg.BaseURL = DefaultBaseURLs[cfg.Provider]
	}
	if cfg.Model == "" {
		cfg.Model = DefaultModels[cfg.Provider]
	}
	return cfg
}

// --- OpenAI ---

func chatOpenAI(cfg Config, messages []Message, stream bool, onChunk ...func(string)) (string, error) {
	body := map[string]interface{}{
		"model":    cfg.Model,
		"messages": messages,
		"stream":   stream,
	}
	if stream {
		body["stream_options"] = map[string]bool{"include_usage": true}
	}

	resp, err := postJSON(cfg.BaseURL+"/chat/completions", cfg.APIKey, body)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		b, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("openai %d: %s", resp.StatusCode, string(b))
	}

	if stream {
		return readSSEStream(resp.Body, onChunk[0], func(data []byte) string {
			var obj struct {
				Choices []struct {
					Delta struct {
						Content string `json:"content"`
					} `json:"delta"`
				} `json:"choices"`
			}
			if json.Unmarshal(data, &obj) == nil && len(obj.Choices) > 0 {
				return obj.Choices[0].Delta.Content
			}
			return ""
		})
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	if len(result.Choices) == 0 {
		return "", fmt.Errorf("no choices returned")
	}
	return result.Choices[0].Message.Content, nil
}

// --- Anthropic ---

func chatAnthropic(cfg Config, messages []Message, stream bool, onChunk ...func(string)) (string, error) {
	var systemMsg string
	var msgs []Message
	for _, m := range messages {
		if m.Role == "system" {
			systemMsg = m.Content
		} else {
			msgs = append(msgs, m)
		}
	}

	body := map[string]interface{}{
		"model":      cfg.Model,
		"messages":   msgs,
		"max_tokens": 4096,
		"stream":     stream,
	}
	if systemMsg != "" {
		body["system"] = systemMsg
	}

	req, _ := http.NewRequest("POST", cfg.BaseURL+"/v1/messages", nil)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", cfg.APIKey)
	req.Header.Set("anthropic-version", "2023-06-01")
	b, _ := json.Marshal(body)
	req.Body = io.NopCloser(bytes.NewReader(b))

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		rb, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("anthropic %d: %s", resp.StatusCode, string(rb))
	}

	if stream {
		return readSSEStream(resp.Body, onChunk[0], func(data []byte) string {
			var obj struct {
				Type  string `json:"type"`
				Delta struct {
					Text string `json:"text"`
				} `json:"delta"`
			}
			if json.Unmarshal(data, &obj) == nil && obj.Type == "content_block_delta" {
				return obj.Delta.Text
			}
			return ""
		})
	}

	var result struct {
		Content []struct {
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	if len(result.Content) == 0 {
		return "", fmt.Errorf("no content returned")
	}
	return result.Content[0].Text, nil
}

// --- Gemini ---

func chatGemini(cfg Config, messages []Message, stream bool, onChunk ...func(string)) (string, error) {
	var contents []map[string]interface{}
	for _, m := range messages {
		role := "user"
		if m.Role == "assistant" {
			role = "model"
		}
		if m.Role == "system" {
			contents = append(contents, map[string]interface{}{
				"role":  "user",
				"parts": []map[string]string{{"text": m.Content}},
			})
			contents = append(contents, map[string]interface{}{
				"role":  "model",
				"parts": []map[string]string{{"text": "Understood."}},
			})
			continue
		}
		contents = append(contents, map[string]interface{}{
			"role":  role,
			"parts": []map[string]string{{"text": m.Content}},
		})
	}

	url := cfg.BaseURL + "/models/" + cfg.Model + ":generateContent?key=" + cfg.APIKey
	body := map[string]interface{}{
		"contents": contents,
	}

	resp, err := postJSON(url, "", body)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		b, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("gemini %d: %s", resp.StatusCode, string(b))
	}

	var result struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	if len(result.Candidates) == 0 || len(result.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("no candidates returned")
	}
	return result.Candidates[0].Content.Parts[0].Text, nil
}

// --- Ollama ---

func chatOllama(cfg Config, messages []Message, stream bool, onChunk ...func(string)) (string, error) {
	body := map[string]interface{}{
		"model":    cfg.Model,
		"messages": messages,
		"stream":   stream,
	}

	if stream {
		resp, err := postJSON(cfg.BaseURL+"/api/chat", "", body)
		if err != nil {
			return "", err
		}
		defer resp.Body.Close()
		if resp.StatusCode != 200 {
			b, _ := io.ReadAll(resp.Body)
			return "", fmt.Errorf("ollama %d: %s", resp.StatusCode, string(b))
		}
		return readSSEStream(resp.Body, onChunk[0], func(data []byte) string {
			var obj struct {
				Message struct {
					Content string `json:"content"`
				} `json:"message"`
				Done bool `json:"done"`
			}
			if json.Unmarshal(data, &obj) == nil {
				return obj.Message.Content
			}
			return ""
		})
	}

	resp, err := postJSON(cfg.BaseURL+"/api/chat", "", body)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		b, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("ollama %d: %s", resp.StatusCode, string(b))
	}
	var result struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	return result.Message.Content, nil
}

// --- Helpers ---

func postJSON(url, apiKey string, body interface{}) (*http.Response, error) {
	b, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequest("POST", url, bytes.NewReader(b))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+apiKey)
	}
	client := &http.Client{Timeout: 120 * time.Second}
	return client.Do(req)
}

func readSSEStream(body io.ReadCloser, onChunk func(string), extract func([]byte) string) (string, error) {
	var full strings.Builder
	scanner := bufio.NewScanner(body)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			break
		}
		chunk := extract([]byte(data))
		if chunk != "" {
			full.WriteString(chunk)
			onChunk(chunk)
		}
	}
	return full.String(), nil
}
