package mock

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"
)

// MockResponse is what the server returns for a matched route.
type MockResponse struct {
	StatusCode int
	Headers    map[string]string
	Body       interface{}
	DelayMs    int
}

// RouteKey identifies a mock route.
type RouteKey struct{ Method, Path string }

// Registry is a thread-safe in-memory map of routes to mock responses.
type Registry struct {
	mu     sync.RWMutex
	routes map[RouteKey]MockResponse
}

func NewRegistry() *Registry {
	return &Registry{routes: make(map[RouteKey]MockResponse)}
}

func (r *Registry) Set(method, path string, resp MockResponse) {
	r.mu.Lock()
	r.routes[RouteKey{strings.ToUpper(method), path}] = resp
	r.mu.Unlock()
}

func (r *Registry) Get(method, path string) (MockResponse, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	// Exact match first.
	if v, ok := r.routes[RouteKey{strings.ToUpper(method), path}]; ok {
		return v, true
	}
	// Param match: /users/:id matches /users/123
	for key, val := range r.routes {
		if key.Method != strings.ToUpper(method) {
			continue
		}
		if matchPath(key.Path, path) {
			return val, true
		}
	}
	return MockResponse{}, false
}

func (r *Registry) Count() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.routes)
}

func (r *Registry) Routes() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]string, 0, len(r.routes))
	for k := range r.routes {
		out = append(out, k.Method+" "+k.Path)
	}
	return out
}

// matchPath returns true if pattern (e.g. /users/:id) matches actual (e.g. /users/123).
func matchPath(pattern, actual string) bool {
	pp := strings.Split(strings.Trim(pattern, "/"), "/")
	ap := strings.Split(strings.Trim(actual, "/"), "/")
	if len(pp) != len(ap) {
		return false
	}
	for i, seg := range pp {
		if strings.HasPrefix(seg, ":") {
			continue
		}
		if seg != ap[i] {
			return false
		}
	}
	return true
}

// MockServer runs a real net/http server on a local port.
type MockServer struct {
	registry *Registry
	server   *http.Server
	Port     int
}

func NewMockServer(r *Registry, port int) *MockServer {
	ms := &MockServer{registry: r, Port: port}
	mux := http.NewServeMux()
	mux.HandleFunc("/", ms.handle)
	ms.server = &http.Server{
		Addr:    fmt.Sprintf(":%d", port),
		Handler: mux,
	}
	return ms
}

func (ms *MockServer) Start() {
	go func() { _ = ms.server.ListenAndServe() }()
}

func (ms *MockServer) Stop() error {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	return ms.server.Shutdown(ctx)
}

func (ms *MockServer) handle(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "*")
	w.Header().Set("Access-Control-Allow-Headers", "*")
	if r.Method == http.MethodOptions {
		w.WriteHeader(204)
		return
	}

	resp, ok := ms.registry.Get(r.Method, r.URL.Path)
	if !ok {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(404)
		_, _ = w.Write([]byte(`{"error":"route not mocked"}`))
		return
	}

	if resp.DelayMs > 0 {
		time.Sleep(time.Duration(resp.DelayMs) * time.Millisecond)
	}

	for k, v := range resp.Headers {
		w.Header().Set(k, v)
	}
	if w.Header().Get("Content-Type") == "" {
		w.Header().Set("Content-Type", "application/json")
	}
	w.Header().Set("X-Mock-Server", "reqit")
	w.WriteHeader(resp.StatusCode)
	_ = json.NewEncoder(w).Encode(resp.Body)
}
