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

// ToolDef describes a tool for function-calling APIs.
type ToolDef struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Parameters  map[string]any `json:"parameters"`
}

// ToolCall represents a tool invocation requested by the model.
type ToolCall struct {
	Name      string         `json:"name"`
	Arguments map[string]any `json:"arguments"`
}

// ToolCallResult is the full response from a tool-calling request.
type ToolCallResult struct {
	ToolCalls []ToolCall `json:"toolCalls"`
	Content   string     `json:"content,omitempty"`
	Raw       string     `json:"raw,omitempty"`
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

// ChatWithTools sends a tool-calling request using native function-calling APIs.
func ChatWithTools(cfg Config, messages []Message, tools []ToolDef) (ToolCallResult, error) {
	cfg = applyDefaults(cfg)
	switch cfg.Provider {
	case ProviderOpenAI:
		return chatOpenAIWithTools(cfg, messages, tools)
	case ProviderAnthropic:
		return chatAnthropicWithTools(cfg, messages, tools)
	case ProviderGemini:
		return chatGeminiWithTools(cfg, messages, tools)
	case ProviderOllama:
		return chatOllamaWithTools(cfg, messages, tools)
	default:
		return ToolCallResult{}, fmt.Errorf("unknown provider: %s", cfg.Provider)
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

	req, err := http.NewRequest("POST", cfg.BaseURL+"/v1/messages", nil)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", cfg.APIKey)
	req.Header.Set("anthropic-version", "2023-06-01")
	b, err := json.Marshal(body)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request body: %w", err)
	}
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

// --- Tool-calling implementations ---

func toolsToOpenAIFormat(tools []ToolDef) []map[string]any {
	out := make([]map[string]any, len(tools))
	for i, t := range tools {
		out[i] = map[string]any{
			"type": "function",
			"function": map[string]any{
				"name":        t.Name,
				"description": t.Description,
				"parameters":  t.Parameters,
			},
		}
	}
	return out
}

func chatOpenAIWithTools(cfg Config, messages []Message, tools []ToolDef) (ToolCallResult, error) {
	body := map[string]any{
		"model":    cfg.Model,
		"messages": messages,
		"tools":    toolsToOpenAIFormat(tools),
	}

	resp, err := postJSON(cfg.BaseURL+"/chat/completions", cfg.APIKey, body)
	if err != nil {
		return ToolCallResult{}, err
	}
	defer resp.Body.Close()

	b, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return ToolCallResult{}, fmt.Errorf("openai %d: %s", resp.StatusCode, string(b))
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content   string `json:"content"`
				ToolCalls []struct {
					Function struct {
						Name      string `json:"name"`
						Arguments string `json:"arguments"`
					} `json:"function"`
				} `json:"tool_calls"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(b, &result); err != nil {
		return ToolCallResult{}, err
	}
	if len(result.Choices) == 0 {
		return ToolCallResult{}, fmt.Errorf("no choices returned")
	}

	msg := result.Choices[0].Message
	var calls []ToolCall
	for _, tc := range msg.ToolCalls {
		var args map[string]any
		json.Unmarshal([]byte(tc.Function.Arguments), &args)
		calls = append(calls, ToolCall{Name: tc.Function.Name, Arguments: args})
	}

	return ToolCallResult{ToolCalls: calls, Content: msg.Content, Raw: string(b)}, nil
}

func chatAnthropicWithTools(cfg Config, messages []Message, tools []ToolDef) (ToolCallResult, error) {
	var systemMsg string
	var msgs []Message
	for _, m := range messages {
		if m.Role == "system" {
			systemMsg = m.Content
		} else {
			msgs = append(msgs, m)
		}
	}

	// Convert tools to Anthropic format
	toolDefs := make([]map[string]any, len(tools))
	for i, t := range tools {
		toolDefs[i] = map[string]any{
			"name":        t.Name,
			"description": t.Description,
			"input_schema": t.Parameters,
		}
	}

	body := map[string]any{
		"model":      cfg.Model,
		"messages":   msgs,
		"max_tokens": 4096,
		"tools":      toolDefs,
	}
	if systemMsg != "" {
		body["system"] = systemMsg
	}

	req, err := http.NewRequest("POST", cfg.BaseURL+"/v1/messages", nil)
	if err != nil {
		return ToolCallResult{}, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", cfg.APIKey)
	req.Header.Set("anthropic-version", "2023-06-01")
	b, err := json.Marshal(body)
	if err != nil {
		return ToolCallResult{}, fmt.Errorf("failed to marshal request body: %w", err)
	}
	req.Body = io.NopCloser(bytes.NewReader(b))

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return ToolCallResult{}, err
	}
	defer resp.Body.Close()

	rb, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return ToolCallResult{}, fmt.Errorf("anthropic %d: %s", resp.StatusCode, string(rb))
	}

	var result struct {
		Content []struct {
			Type  string `json:"type"`
			Text  string `json:"text"`
			Name  string `json:"name"`
			Input map[string]any `json:"input"`
		} `json:"content"`
	}
	if err := json.Unmarshal(rb, &result); err != nil {
		return ToolCallResult{}, err
	}

	var calls []ToolCall
	var content string
	for _, block := range result.Content {
		if block.Type == "tool_use" {
			calls = append(calls, ToolCall{Name: block.Name, Arguments: block.Input})
		} else if block.Type == "text" {
			content = block.Text
		}
	}

	return ToolCallResult{ToolCalls: calls, Content: content, Raw: string(rb)}, nil
}

func chatGeminiWithTools(cfg Config, messages []Message, tools []ToolDef) (ToolCallResult, error) {
	var contents []map[string]any
	for _, m := range messages {
		role := "user"
		if m.Role == "assistant" {
			role = "model"
		}
		if m.Role == "system" {
			contents = append(contents, map[string]any{
				"role":  "user",
				"parts": []map[string]string{{"text": m.Content}},
			})
			contents = append(contents, map[string]any{
				"role":  "model",
				"parts": []map[string]string{{"text": "Understood."}},
			})
			continue
		}
		contents = append(contents, map[string]any{
			"role":  role,
			"parts": []map[string]string{{"text": m.Content}},
		})
	}

	// Convert tools to Gemini function format
	funcDecls := make([]map[string]any, len(tools))
	for i, t := range tools {
		props := map[string]any{}
		for k, v := range t.Parameters {
			if k == "type" || k == "required" {
				continue
			}
			props[k] = v
		}
		funcDecls[i] = map[string]any{
			"name":        t.Name,
			"description": t.Description,
			"parameters": map[string]any{
				"type":       "object",
				"properties": props,
			},
		}
	}

	url := cfg.BaseURL + "/models/" + cfg.Model + ":generateContent?key=" + cfg.APIKey
	body := map[string]any{
		"contents": contents,
		"tools": []map[string]any{
			{"function_declarations": funcDecls},
		},
	}

	resp, err := postJSON(url, "", body)
	if err != nil {
		return ToolCallResult{}, err
	}
	defer resp.Body.Close()

	rb, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return ToolCallResult{}, fmt.Errorf("gemini %d: %s", resp.StatusCode, string(rb))
	}

	var result struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text           string         `json:"text"`
					FunctionCall   *struct {
						Name string         `json:"name"`
						Args map[string]any `json:"args"`
					} `json:"functionCall"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	if err := json.Unmarshal(rb, &result); err != nil {
		return ToolCallResult{}, err
	}
	if len(result.Candidates) == 0 {
		return ToolCallResult{}, fmt.Errorf("no candidates returned")
	}

	var calls []ToolCall
	var content string
	for _, part := range result.Candidates[0].Content.Parts {
		if part.FunctionCall != nil {
			calls = append(calls, ToolCall{Name: part.FunctionCall.Name, Arguments: part.FunctionCall.Args})
		}
		if part.Text != "" {
			content = part.Text
		}
	}

	return ToolCallResult{ToolCalls: calls, Content: content, Raw: string(rb)}, nil
}

func chatOllamaWithTools(cfg Config, messages []Message, tools []ToolDef) (ToolCallResult, error) {
	// Ollama uses OpenAI-compatible format
	toolDefs := toolsToOpenAIFormat(tools)
	body := map[string]any{
		"model":    cfg.Model,
		"messages": messages,
		"tools":    toolDefs,
	}

	resp, err := postJSON(cfg.BaseURL+"/api/chat", "", body)
	if err != nil {
		return ToolCallResult{}, err
	}
	defer resp.Body.Close()

	rb, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return ToolCallResult{}, fmt.Errorf("ollama %d: %s", resp.StatusCode, string(rb))
	}

	var result struct {
		Message struct {
			Content   string `json:"content"`
			ToolCalls []struct {
				Function struct {
					Name      string `json:"name"`
					Arguments string `json:"arguments"`
				} `json:"function"`
			} `json:"tool_calls"`
		} `json:"message"`
	}
	if err := json.Unmarshal(rb, &result); err != nil {
		return ToolCallResult{}, err
	}

	var calls []ToolCall
	for _, tc := range result.Message.ToolCalls {
		var args map[string]any
		json.Unmarshal([]byte(tc.Function.Arguments), &args)
		calls = append(calls, ToolCall{Name: tc.Function.Name, Arguments: args})
	}

	return ToolCallResult{ToolCalls: calls, Content: result.Message.Content, Raw: string(rb)}, nil
}
