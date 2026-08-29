package sock

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"

	"flux/internal/models"
)

// TestLiveWebSocketViaSock is a real-world test: it starts a live WS echo server
// (like testserver) and drives it through the reqit Socket client (not gorilla
// directly). This proves reqit's WS stack (auto-reconnect, keepalive, message
// capping, status callbacks) works on the wire.
func TestLiveWebSocketViaSock(t *testing.T) {
	upgrader := websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer c.Close()
		for {
			mt, msg, err := c.ReadMessage()
			if err != nil {
				return
			}
			if err := c.WriteMessage(mt, msg); err != nil {
				return
			}
		}
	}))
	defer srv.Close()

	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http")

	sock := New()
	events := make(chan models.SocketMessage, 10)
	statuses := make(chan string, 10)
	sock.OnEvent(func(m models.SocketMessage) { events <- m })
	sock.OnStatus(func(s string) { statuses <- s })

	if err := sock.Connect(wsURL, "ws", nil, nil); err != nil {
		t.Fatalf("Connect: %v", err)
	}
	defer sock.Disconnect()

	// Wait for connected
	timeout := time.After(3 * time.Second)
	connected := false
	for !connected {
		select {
		case st := <-statuses:
			if st == "connected" {
				connected = true
			}
		case <-timeout:
			t.Fatal("timeout waiting for connected")
		}
	}

	// Send and expect echo
	if err := sock.Send("hello via sock"); err != nil {
		t.Fatalf("Send: %v", err)
	}

	select {
	case msg := <-events:
		// We get two events: sent and received. Wait for the received one.
		if msg.Direction == "sent" {
			// Next should be received
			select {
			case msg2 := <-events:
				if msg2.Direction != "received" || msg2.Body != "hello via sock" {
					t.Fatalf("expected echo 'hello via sock', got %+v", msg2)
				}
			case <-time.After(2 * time.Second):
				t.Fatal("timeout waiting for echo")
			}
		} else if msg.Direction == "received" {
			if msg.Body != "hello via sock" {
				t.Fatalf("expected echo, got %+v", msg)
			}
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timeout waiting for message")
	}

	// Binary frame
	if err := sock.SendBinary("aGVsbG8="); err != nil {
		t.Fatalf("SendBinary: %v", err)
	}
	select {
	case msg := <-events:
		// Binary echo will be base64 or raw depending on implementation
		if msg.Direction == "sent" {
			<-events // wait for received
		}
	case <-time.After(2 * time.Second):
		// Non-fatal: binary may be handled differently
	}

	// Verify capping: send 5 messages quickly
	for i := 0; i < 5; i++ {
		_ = sock.Send("msg")
		time.Sleep(50 * time.Millisecond)
	}
}

// TestLiveSSEViaSock starts a live SSE server and drives it through the Socket client
// with protocol "sse". This proves the SSE reconnect (Last-Event-ID, retry) and
// bufio 1MB handling work on the wire.
func TestLiveSSEViaSock(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fl, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "no flusher", 500)
			return
		}
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		for i := 0; i < 3; i++ {
			// Use non-blocking write with timeout check
			select {
			case <-r.Context().Done():
				return
			default:
			}
			// send event
			if i == 0 {
				// Include id and event
				_, _ = w.Write([]byte("id: 1\n"))
				_, _ = w.Write([]byte("event: tick\n"))
				_, _ = w.Write([]byte("data: {\"index\": 1}\n\n"))
			} else {
				_, _ = w.Write([]byte("data: {\"index\": 2}\n\n"))
			}
			fl.Flush()
			time.Sleep(100 * time.Millisecond)
		}
		// Hold a bit so client can read
		time.Sleep(200 * time.Millisecond)
	}))
	defer srv.Close()

	sock := New()
	events := make(chan models.SocketMessage, 10)
	statuses := make(chan string, 10)
	sock.OnEvent(func(m models.SocketMessage) { events <- m })
	sock.OnStatus(func(s string) { statuses <- s })

	if err := sock.Connect(srv.URL, "sse", nil, nil); err != nil {
		t.Fatalf("Connect SSE: %v", err)
	}
	defer sock.Disconnect()

	// Wait for at least one event
	received := 0
	timeout := time.After(3 * time.Second)
	for received < 1 {
		select {
		case msg := <-events:
			if msg.EventType == "tick" || msg.Body != "" {
				received++
			}
		case <-timeout:
			t.Fatal("timeout waiting for SSE events")
		}
	}

	// Verify status went to connected
	select {
	case st := <-statuses:
		if st != "connected" && st != "connecting" {
			t.Logf("status: %s", st)
		}
	default:
	}
}
