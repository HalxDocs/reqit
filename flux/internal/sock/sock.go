package sock

import (
	"bufio"
	"context"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"

	"flux/internal/models"
)

const maxMessages = 1000

const (
	pingPeriod = 30 * time.Second
	pongWait   = 60 * time.Second
)

type Socket struct {
	mu          sync.Mutex
	conn        *websocket.Conn
	cancel      context.CancelFunc
	status      string
	protocol    string
	url         string
	headers     map[string]string
	tlsCfg      *tls.Config
	autoReconn  bool
	lastEventID string
	messages    []models.SocketMessage
	onEvent     func(models.SocketMessage)
	onStatus    func(string)
	cbMu        sync.RWMutex
}

func New() *Socket {
	return &Socket{status: "disconnected"}
}

func (s *Socket) OnEvent(fn func(models.SocketMessage)) {
	s.cbMu.Lock()
	s.onEvent = fn
	s.cbMu.Unlock()
}

func (s *Socket) OnStatus(fn func(string)) {
	s.cbMu.Lock()
	s.onStatus = fn
	s.cbMu.Unlock()
}

func (s *Socket) emitEvent(msg models.SocketMessage) {
	s.cbMu.RLock()
	fn := s.onEvent
	s.cbMu.RUnlock()
	if fn != nil {
		fn(msg)
	}
}

func (s *Socket) emitStatus(status string) {
	s.cbMu.RLock()
	fn := s.onStatus
	s.cbMu.RUnlock()
	if fn != nil {
		fn(status)
	}
}

func (s *Socket) appendMessage(entry models.SocketMessage) {
	s.mu.Lock()
	if len(s.messages) >= maxMessages {
		s.messages = append(s.messages[:0], s.messages[1:]...)
	}
	s.messages = append(s.messages, entry)
	s.mu.Unlock()
}

func (s *Socket) State() models.SocketState {
	s.mu.Lock()
	defer s.mu.Unlock()
	msgs := make([]models.SocketMessage, len(s.messages))
	copy(msgs, s.messages)
	return models.SocketState{
		Status:   s.status,
		Protocol: s.protocol,
		URL:      s.url,
		Messages: msgs,
	}
}

// SetAutoReconnect enables or disables automatic reconnection for SSE streams.
func (s *Socket) SetAutoReconnect(enabled bool) {
	s.mu.Lock()
	s.autoReconn = enabled
	s.mu.Unlock()
}

func (s *Socket) Connect(url, protocol string, headers map[string]string, tlsCfg *tls.Config) error {
	s.Disconnect()

	ctx, cancel := context.WithCancel(context.Background())
	s.cancel = cancel

	s.mu.Lock()
	s.status = "connecting"
	s.protocol = protocol
	s.url = url
	s.headers = headers
	s.tlsCfg = tlsCfg
	s.lastEventID = ""
	s.messages = nil
	s.mu.Unlock()

	s.emitStatus("connecting")

	switch protocol {
	case "ws":
		return s.connectWS(ctx, url, headers, tlsCfg)
	case "sse":
		go s.runSSE(ctx)
		return nil
	default:
		return fmt.Errorf("unsupported protocol: %s", protocol)
	}
}

func (s *Socket) Disconnect() {
	s.mu.Lock()
	cancel := s.cancel
	s.mu.Unlock()

	if cancel != nil {
		cancel()
		time.Sleep(100 * time.Millisecond)
	}

	s.mu.Lock()
	if s.conn != nil {
		s.conn.Close()
		s.conn = nil
	}
	s.status = "disconnected"
	s.mu.Unlock()

	s.emitStatus("disconnected")
}

func (s *Socket) Send(msg string) error {
	return s.sendFrame(websocket.TextMessage, []byte(msg))
}

// SendBinary sends a base64-encoded payload as a binary frame.
func (s *Socket) SendBinary(data string) error {
	raw, err := base64.StdEncoding.DecodeString(data)
	if err != nil {
		return fmt.Errorf("invalid base64 payload: %w", err)
	}
	return s.sendFrame(websocket.BinaryMessage, raw)
}

func (s *Socket) sendFrame(msgType int, payload []byte) error {
	s.mu.Lock()
	conn := s.conn
	s.mu.Unlock()

	if conn == nil {
		return fmt.Errorf("not connected")
	}

	if err := conn.WriteMessage(msgType, payload); err != nil {
		return err
	}

	body := string(payload)
	typ := "text"
	if msgType == websocket.BinaryMessage {
		body = base64.StdEncoding.EncodeToString(payload)
		typ = "binary"
	}

	entry := models.SocketMessage{
		Timestamp: time.Now().UnixMilli(),
		Direction: "sent",
		Body:      body,
		Type:      typ,
	}

	s.appendMessage(entry)
	s.emitEvent(entry)

	return nil
}

func (s *Socket) connectWS(ctx context.Context, url string, headers map[string]string, tlsCfg *tls.Config) error {
	for {
		c, err := s.dialWS(ctx, url, headers, tlsCfg)
		if err != nil {
			return err
		}

		s.mu.Lock()
		s.conn = c
		s.status = "connected"
		s.mu.Unlock()
		s.emitStatus("connected")

		go s.keepAlive(ctx, c)
		go s.readLoopWS(ctx, c)

		// readLoopWS returns only when the connection drops. If auto-reconnect
		// is enabled and we were not asked to disconnect, redial after a short
		// backoff.
		if s.autoReconn && ctx.Err() == nil {
			s.mu.Lock()
			s.status = "reconnecting"
			s.mu.Unlock()
			s.emitStatus("reconnecting")
			select {
			case <-ctx.Done():
				return nil
			case <-time.After(reconnectDelay):
			}
			continue
		}
		return nil
	}
}

// reconnectDelay is the backoff between automatic reconnection attempts.
const reconnectDelay = 3 * time.Second

func (s *Socket) dialWS(ctx context.Context, url string, headers map[string]string, tlsCfg *tls.Config) (*websocket.Conn, error) {
	httpHeader := http.Header{}
	var subprotocols []string
	for k, v := range headers {
		if strings.EqualFold(k, "Sec-WebSocket-Protocol") {
			for _, sp := range strings.Split(v, ",") {
				if sp = strings.TrimSpace(sp); sp != "" {
					subprotocols = append(subprotocols, sp)
				}
			}
			continue
		}
		httpHeader.Set(k, v)
	}

	dialer := websocket.Dialer{Subprotocols: subprotocols}
	if tlsCfg != nil {
		dialer.TLSClientConfig = tlsCfg
	}
	c, _, err := dialer.Dial(url, httpHeader)
	if err != nil {
		if ctx.Err() != nil {
			return nil, err
		}
		s.mu.Lock()
		s.status = "error"
		s.mu.Unlock()
		s.emitStatus("error")
		return nil, err
	}
	return c, nil
}

// keepAlive sends a ping frame on a fixed cadence and watches for pong replies
// (via read deadlines) so half-open connections are detected and closed,
// which in turn lets the read loop mark the socket disconnected.
func (s *Socket) keepAlive(ctx context.Context, c *websocket.Conn) {
	ticker := time.NewTicker(pingPeriod)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.mu.Lock()
			conn := s.conn
			s.mu.Unlock()
			if conn == nil || conn != c {
				return
			}
			if err := conn.WriteControl(websocket.PingMessage, nil, time.Now().Add(10*time.Second)); err != nil {
				return
			}
		}
	}
}

func (s *Socket) readLoopWS(ctx context.Context, c *websocket.Conn) {
	defer func() {
		c.Close()
		s.mu.Lock()
		if s.conn == c {
			s.conn = nil
			s.status = "disconnected"
		}
		s.mu.Unlock()
		s.emitStatus("disconnected")
	}()

	// Respond to keep-alive pings so the server keeps the connection alive.
	c.SetPongHandler(func(string) error {
		return c.SetReadDeadline(time.Now().Add(pongWait))
	})

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		_ = c.SetReadDeadline(time.Now().Add(pongWait))
		msgType, msg, err := c.ReadMessage()
		if err != nil {
			return
		}

		body := string(msg)
		typ := "text"
		if msgType == websocket.BinaryMessage {
			body = base64.StdEncoding.EncodeToString(msg)
			typ = "binary"
		}

		entry := models.SocketMessage{
			Timestamp: time.Now().UnixMilli(),
			Direction: "received",
			Body:      body,
			Type:      typ,
		}

		s.appendMessage(entry)
		s.emitEvent(entry)
	}
}

// runSSE keeps a Server-Sent Events stream open, transparently reconnecting
// with the Last-Event-ID header whenever the connection drops unexpectedly.
func (s *Socket) runSSE(ctx context.Context) {
	for {
		reconnect, retry := s.openSSE(ctx)
		if !reconnect {
			return
		}
		if s.autoReconn {
			select {
			case <-ctx.Done():
				return
			case <-time.After(retry):
			}
		} else {
			s.mu.Lock()
			s.status = "disconnected"
			s.mu.Unlock()
			s.emitStatus("disconnected")
			return
		}
	}
}

// openSSE performs a single GET and reads the stream until EOF/error.
// It returns whether a reconnect should be attempted and the retry delay.
func (s *Socket) openSSE(ctx context.Context) (bool, time.Duration) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.url, nil)
	if err != nil {
		return false, 0
	}
	for k, v := range s.headers {
		req.Header.Set(k, v)
	}
	req.Header.Set("Accept", "text/event-stream")
	s.mu.Lock()
	if s.lastEventID != "" {
		req.Header.Set("Last-Event-ID", s.lastEventID)
	}
	s.mu.Unlock()

	// No overall client timeout: SSE streams are long-lived and are closed
	// via context cancellation instead.
	client := &http.Client{}
	if s.tlsCfg != nil {
		client.Transport = &http.Transport{TLSClientConfig: s.tlsCfg}
	}
	resp, err := client.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			return false, 0
		}
		s.mu.Lock()
		s.status = "error"
		s.mu.Unlock()
		s.emitStatus("error")
		return false, 0
	}

	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		s.mu.Lock()
		s.status = "error"
		s.mu.Unlock()
		s.emitStatus("error")
		return false, 0
	}

	s.mu.Lock()
	s.status = "connected"
	s.mu.Unlock()
	s.emitStatus("connected")

	retry := s.readSSEStream(ctx, resp.Body)
	resp.Body.Close()

	if ctx.Err() != nil {
		return false, 0
	}

	if s.autoReconn {
		s.mu.Lock()
		s.status = "reconnecting"
		s.mu.Unlock()
		s.emitStatus("reconnecting")
		return true, retry
	}

	s.mu.Lock()
	s.status = "disconnected"
	s.mu.Unlock()
	s.emitStatus("disconnected")
	return false, 0
}

// readSSEStream parses events from an SSE body. It returns the last `retry:`
// hint (defaulting to 3000ms) so the caller knows how long to wait before
// reconnecting.
func (s *Socket) readSSEStream(ctx context.Context, body io.Reader) time.Duration {
	reader := bufio.NewReaderSize(body, 1<<20) // 1MB buffer, no 64KB token limit
	var buf strings.Builder
	currentEvent := ""
	currentID := ""
	retry := 3000 * time.Millisecond

	flush := func() {
		if buf.Len() == 0 {
			return
		}
		bodyText := strings.TrimSpace(buf.String())
		var data json.RawMessage
		if json.Unmarshal([]byte(bodyText), &data) == nil {
			bodyText = string(data)
		}
		buf.Reset()

		entry := models.SocketMessage{
			Timestamp: time.Now().UnixMilli(),
			Direction: "received",
			Body:      bodyText,
			EventType: currentEvent,
			EventID:   currentID,
			Retry:     int(retry.Milliseconds()),
		}
		if currentID != "" {
			s.mu.Lock()
			s.lastEventID = currentID
			s.mu.Unlock()
		}
		currentEvent = ""
		currentID = ""

		s.appendMessage(entry)
		s.emitEvent(entry)
	}

	for {
		select {
		case <-ctx.Done():
			flush()
			return retry
		default:
		}

		line, readErr := reader.ReadString('\n')
		line = strings.TrimRight(line, "\r\n")

		switch {
		case strings.HasPrefix(line, "data: "):
			buf.WriteString(strings.TrimPrefix(line, "data: "))
			buf.WriteString("\n")
		case strings.HasPrefix(line, "event: "):
			currentEvent = strings.TrimSpace(strings.TrimPrefix(line, "event: "))
		case strings.HasPrefix(line, "id: "):
			currentID = strings.TrimSpace(strings.TrimPrefix(line, "id: "))
		case strings.HasPrefix(line, "retry: "):
			var ms int
			if _, err := fmt.Sscanf(strings.TrimPrefix(line, "retry: "), "%d", &ms); err == nil && ms > 0 {
				retry = time.Duration(ms) * time.Millisecond
			}
		case line == "":
			flush()
		}

		if readErr != nil {
			// io.EOF marks the end of the stream; other errors close it too.
			flush()
			return retry
		}
	}
}
