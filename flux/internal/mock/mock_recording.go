package mock

import (
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"strings"
	"sync"
	"time"
)

// RecordingSink captures real traffic and stores it as mock responses.
type RecordingSink struct {
	registry *Registry
	mu       sync.RWMutex
	enabled  bool
}

func NewRecordingSink(reg *Registry) *RecordingSink {
	return &RecordingSink{registry: reg}
}

func (rs *RecordingSink) Enable() {
	rs.mu.Lock()
	rs.enabled = true
	rs.mu.Unlock()
}
func (rs *RecordingSink) Disable() {
	rs.mu.Lock()
	rs.enabled = false
	rs.mu.Unlock()
}
func (rs *RecordingSink) Enabled() bool {
	rs.mu.RLock()
	defer rs.mu.RUnlock()
	return rs.enabled
}

// Record captures a proxied HTTP response as a mock rule.
func (rs *RecordingSink) Record(method, path string, resp *http.Response) error {
	if !rs.enabled {
		return nil
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("record read body: %w", err)
	}

	var bodyVal interface{}
	if json.Valid(body) {
		bodyVal = json.RawMessage(body)
	} else {
		bodyVal = string(body)
	}

	hdrs := make(map[string]string)
	for k, vv := range resp.Header {
		hdrs[k] = strings.Join(vv, ", ")
	}

	mr := MockResponse{
		StatusCode: resp.StatusCode,
		Headers:    hdrs,
		Body:       bodyVal,
		DelayMs:    0,
	}
	rs.registry.Set(method, path, mr)
	return nil
}

// MockVariables replaces {{$variable}} placeholders in a response body string.
func MockVariables(body string) string {
	replacer := strings.NewReplacer(
		"{{$guid}}", newGUID(),
		"{{$timestamp}}", fmt.Sprintf("%d", time.Now().UnixMilli()),
		"{{$isoTimestamp}}", time.Now().UTC().Format(time.RFC3339),
		"{{$randomInt}}", fmt.Sprintf("%d", rand.Intn(10000)),
		"{{$randomFloat}}", fmt.Sprintf("%.2f", rand.Float64()*100),
	)
	return replacer.Replace(body)
}

func newGUID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

// RecordingProxyHandler is an http.Handler that proxies requests to a real upstream
// while recording responses into the mock registry.
type RecordingProxyHandler struct {
	Upstream string
	Sink     *RecordingSink
}

func (h *RecordingProxyHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	proxyURL := strings.TrimRight(h.Upstream, "/") + r.URL.String()
	req, err := http.NewRequestWithContext(r.Context(), r.Method, proxyURL, r.Body)
	if err != nil {
		http.Error(w, err.Error(), 502)
		return
	}
	req.Header = r.Header

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		http.Error(w, err.Error(), 502)
		return
	}
	defer resp.Body.Close()

	_ = h.Sink.Record(r.Method, r.URL.Path, resp)

	for k, vv := range resp.Header {
		for _, v := range vv {
			w.Header().Add(k, v)
		}
	}
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}
