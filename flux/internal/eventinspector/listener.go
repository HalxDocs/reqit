package eventinspector

import (
	"context"
	"io"
	"log"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"flux/internal/models"
)

const maxBodySize = 1 << 20 // 1MB, matches onceo.MaxBodySize

// Listener is a local capture endpoint for webhook POSTs. It binds loopback
// only (never a routable interface) on an ephemeral port so it is not exposed
// to the LAN; a tunnel (ngrok/cloudflared) forwards external deliveries to it.
type Listener struct {
	mu       sync.Mutex
	server   *http.Server
	listener net.Listener
	port     int
	running  bool
	store    *Store
	secret   *SecretStore
	onCapture func(models.EventRecord)
}

func NewListener(store *Store, secret *SecretStore) *Listener {
	return &Listener{store: store, secret: secret}
}

// OnCapture registers a callback invoked after a webhook is captured and
// verified. It is called synchronously from the HTTP handler goroutine.
func (l *Listener) OnCapture(fn func(models.EventRecord)) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.onCapture = fn
}

// Start binds the loopback listener on an ephemeral port and begins serving.
func (l *Listener) Start() (int, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.running {
		return l.port, nil
	}
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return 0, err
	}
	l.listener = ln
	l.port = ln.Addr().(*net.TCPAddr).Port
	l.server = &http.Server{Handler: http.HandlerFunc(l.handle)}
	l.running = true
	go func() {
		if err := l.server.Serve(ln); err != nil && err != http.ErrServerClosed {
			log.Printf("eventinspector: serve error: %v", err)
		}
	}()
	return l.port, nil
}

// Stop shuts the listener down gracefully.
func (l *Listener) Stop() error {
	l.mu.Lock()
	server := l.server
	l.running = false
	l.server = nil
	l.listener = nil
	l.port = 0
	l.mu.Unlock()
	if server == nil {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return server.Shutdown(ctx)
}

// Port returns the bound port (0 when not running).
func (l *Listener) Port() int {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.port
}

// IsRunning reports whether the listener is active.
func (l *Listener) IsRunning() bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.running
}

func (l *Listener) handle(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", "POST")
		http.Error(w, "method not allowed: event inspector accepts POST only", http.StatusMethodNotAllowed)
		return
	}

	body, err := io.ReadAll(io.LimitReader(r.Body, maxBodySize+1))
	if err != nil {
		http.Error(w, "failed to read body", http.StatusBadRequest)
		return
	}
	if len(body) > maxBodySize {
		http.Error(w, "body exceeds 1MB limit", http.StatusRequestEntityTooLarge)
		return
	}

	headers := map[string]string{}
	for k, v := range r.Header {
		headers[k] = strings.Join(v, ", ")
	}

	rec := models.EventRecord{
		Method:      r.Method,
		SourceURL:   r.URL.RequestURI(),
		Headers:     headers,
		Body:        string(body),
		ContentType: r.Header.Get("Content-Type"),
		VerifyStatus: "unverified",
	}

	rec, err = l.store.Append(rec)
	if err != nil {
		http.Error(w, "failed to store event", http.StatusInternalServerError)
		return
	}

	// Verify (signature + dedupe). A missing secret leaves the event
	// "unverified" but captured — the UI prompts to configure one.
	vr := Verify(r.Header, body, l.secret.Get(), l.store)
	if err := l.store.UpdateVerify(rec.ID, vr); err != nil {
		log.Printf("eventinspector: failed to update verify status: %v", err)
	}
	rec.VerifyStatus = vr.Status
	rec.Provider = vr.Provider
	rec.ProviderEventID = vr.ProviderEventID
	rec.EventType = vr.EventType
	rec.VerifyError = vr.Error

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"ok":true}`))

	l.mu.Lock()
	cb := l.onCapture
	l.mu.Unlock()
	if cb != nil {
		cb(rec)
	}
}
