package grpc

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"
)

type GRPCRequest struct {
	URL       string            `json:"url"`
	Service   string            `json:"service"`
	Method    string            `json:"method"`
	Body      string            `json:"body"`
	Headers   map[string]string `json:"headers"`
}

type GRPCResponse struct {
	StatusCode int                 `json:"statusCode"`
	Body       string              `json:"body"`
	Error      string              `json:"error,omitempty"`
	DurationMs int64               `json:"durationMs"`
	Headers    map[string]string   `json:"headers"`
}

var httpClient = &http.Client{Timeout: 30 * time.Second}

func Invoke(ctx context.Context, req GRPCRequest) *GRPCResponse {
	start := time.Now()

	contentType := "application/grpc-web-text"
	if !strings.Contains(req.URL, ":") {
		req.URL = "https://" + req.URL
	}

	// Encode body as base64 for gRPC-web-text
	encodedBody := base64.StdEncoding.EncodeToString([]byte(req.Body))

	httpReq, err := http.NewRequestWithContext(ctx, "POST", req.URL, bytes.NewReader([]byte(encodedBody)))
	if err != nil {
		return &GRPCResponse{Error: err.Error(), DurationMs: time.Since(start).Milliseconds()}
	}

	httpReq.Header.Set("Content-Type", contentType)
	httpReq.Header.Set("X-Grpc-Web", "1")
	if req.Service != "" && req.Method != "" {
		httpReq.Header.Set("X-Grpc-Service", req.Service)
		httpReq.Header.Set("X-Grpc-Method", req.Method)
	}
	for k, v := range req.Headers {
		httpReq.Header.Set(k, v)
	}

	resp, err := httpClient.Do(httpReq)
	if err != nil {
		return &GRPCResponse{Error: err.Error(), DurationMs: time.Since(start).Milliseconds()}
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	duration := time.Since(start).Milliseconds()

	headers := make(map[string]string)
	for k, v := range resp.Header {
		headers[k] = strings.Join(v, ", ")
	}

	// Try to decode base64 response
	bodyStr := string(body)
	if decoded, err := base64.StdEncoding.DecodeString(strings.TrimSpace(string(body))); err == nil {
		bodyStr = string(decoded)
	}

	return &GRPCResponse{
		StatusCode: resp.StatusCode,
		Body:       bodyStr,
		Headers:    headers,
		DurationMs: duration,
	}
}

func MarshalRequest(method, service, body string) string {
	req := GRPCRequest{Method: method, Service: service, Body: body}
	b, _ := json.Marshal(req)
	return string(b)
}
