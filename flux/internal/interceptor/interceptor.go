package interceptor

import (
	"encoding/json"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"flux/internal/models"
)

// CapturedRequest represents an HTTP request intercepted from the browser.
type CapturedRequest struct {
	ID        string            `json:"id"`
	Method    string            `json:"method"`
	URL       string            `json:"url"`
	Headers   map[string]string `json:"headers"`
	Body      string            `json:"body"`
	Timestamp int64             `json:"timestamp"`
	TabURL    string            `json:"tabUrl"`
	TabTitle  string            `json:"tabTitle"`
}

// Proxy is the browser traffic interceptor that runs an HTTP proxy.
type Proxy struct {
	mu        sync.RWMutex
	listener  net.Listener
	server    *http.Server
	running   bool
	port      int
	captured  []CapturedRequest
	onCapture func(CapturedRequest)
	dataDir   string
}

// New creates a new interceptor proxy.
func New(dataDir string) *Proxy {
	return &Proxy{
		port:    0,
		dataDir: dataDir,
	}
}

// Start launches the HTTP proxy on a random available port.
func (p *Proxy) Start() (int, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.running {
		return p.port, nil
	}
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return 0, err
	}
	p.listener = listener
	p.port = listener.Addr().(*net.TCPAddr).Port
	p.server = &http.Server{Handler: p}
	p.running = true
	go func() {
		_ = p.server.Serve(listener)
	}()
	p.loadCaptured()
	return p.port, nil
}

// Stop shuts down the proxy.
func (p *Proxy) Stop() error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if !p.running {
		return nil
	}
	p.running = false
	if p.server != nil {
		_ = p.server.Close()
	}
	if p.listener != nil {
		_ = p.listener.Close()
	}
	return nil
}

// IsRunning returns whether the proxy is active.
func (p *Proxy) IsRunning() bool {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.running
}

// Port returns the listening port.
func (p *Proxy) Port() int {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.port
}

// OnCapture sets a callback for each captured request.
func (p *Proxy) OnCapture(fn func(CapturedRequest)) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.onCapture = fn
}

// GetCaptured returns all captured requests.
func (p *Proxy) GetCaptured() []CapturedRequest {
	p.mu.RLock()
	defer p.mu.RUnlock()
	result := make([]CapturedRequest, len(p.captured))
	copy(result, p.captured)
	return result
}

// ClearCaptured clears all captured requests.
func (p *Proxy) ClearCaptured() {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.captured = nil
	_ = os.Remove(filepath.Join(p.dataDir, "captured.json"))
}

// ServeHTTP implements http.Handler — the proxy handler.
func (p *Proxy) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	cr := CapturedRequest{
		Method:    r.Method,
		URL:       r.URL.String(),
		Headers:   map[string]string{},
		Timestamp: time.Now().UnixMilli(),
	}
	for k, v := range r.Header {
		cr.Headers[k] = strings.Join(v, ", ")
	}
	if r.Body != nil {
		data, _ := io.ReadAll(r.Body)
		cr.Body = string(data)
	}
	p.mu.Lock()
	p.captured = append(p.captured, cr)
	callback := p.onCapture
	_ = p.saveCapturedLocked()
	p.mu.Unlock()
	if callback != nil {
		callback(cr)
	}
	// Forward the request to the actual destination.
	tr := &http.Transport{}
	outReq, _ := http.NewRequest(r.Method, r.URL.String(), strings.NewReader(cr.Body))
	for k, v := range r.Header {
		outReq.Header.Set(k, strings.Join(v, ", "))
	}
	resp, err := tr.RoundTrip(outReq)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()
	for k, v := range resp.Header {
		w.Header()[k] = v
	}
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}

func (p *Proxy) saveCapturedLocked() error {
	if p.dataDir == "" {
		return nil
	}
	dir := filepath.Join(p.dataDir, "interceptor")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	keep := p.captured
	if len(keep) > 1000 {
		keep = keep[len(keep)-1000:]
	}
	data, err := json.Marshal(keep)
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dir, "captured.json"), data, 0600)
}

func (p *Proxy) loadCaptured() {
	if p.dataDir == "" {
		return
	}
	data, err := os.ReadFile(filepath.Join(p.dataDir, "interceptor", "captured.json"))
	if err != nil {
		return
	}
	var captured []CapturedRequest
	if err := json.Unmarshal(data, &captured); err == nil {
		p.captured = captured
	}
}

// CapturedToRequestPayload converts a captured request to a models.RequestPayload.
func CapturedToRequestPayload(cr CapturedRequest) models.RequestPayload {
	payload := models.RequestPayload{
		Method:  cr.Method,
		URL:     cr.URL,
		Headers: []models.Header{},
	}
	if cr.Body != "" {
		payload.Body = cr.Body
		payload.BodyType = "raw"
	}
	// If body is JSON, set content-type
	if cr.Body != "" && strings.HasPrefix(cr.Body, "{") {
		payload.BodyType = "json"
	}
	for k, v := range cr.Headers {
		payload.Headers = append(payload.Headers, models.Header{
			Key:     k,
			Value:   v,
			Enabled: true,
		})
	}
	return payload
}

// ChromeExtensionManifest returns the JSON for the Chrome extension manifest.
func ChromeExtensionManifest(name string) []byte {
	m := map[string]interface{}{
		"manifest_version": 3,
		"name":             name,
		"version":          "1.0.0",
		"description":      "Capture HTTP/S requests and send them to reqit for testing.",
		"permissions":      []string{"webRequest", "storage", "tabs"},
		"host_permissions": []string{"<all_urls>"},
		"background": map[string]interface{}{
			"service_worker": "background.js",
		},
		"action": map[string]interface{}{
			"default_popup": "popup.html",
			"default_title": "reqit Interceptor",
		},
		"icons": map[string]string{
			"16":  "icons/icon16.png",
			"48":  "icons/icon48.png",
			"128": "icons/icon128.png",
		},
	}
	data, _ := json.MarshalIndent(m, "", "  ")
	return data
}
