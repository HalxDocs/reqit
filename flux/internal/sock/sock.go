package sock

import (
	"bufio"
	"context"
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

const maxMessages = 500

type Socket struct {
	mu         sync.Mutex
	conn       *websocket.Conn
	cancel     context.CancelFunc
	status     string
	protocol   string
	url        string
	messages   []models.SocketMessage
	onEvent    func(models.SocketMessage)
	onStatus   func(string)
	cbMu       sync.RWMutex
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

func (s *Socket) Connect(url, protocol string) error {
	s.Disconnect()

	ctx, cancel := context.WithCancel(context.Background())
	s.cancel = cancel

	s.mu.Lock()
	s.status = "connecting"
	s.protocol = protocol
	s.url = url
	s.messages = nil
	s.mu.Unlock()

	s.emitStatus("connecting")

	switch protocol {
	case "ws":
		return s.connectWS(ctx, url)
	case "sse":
		return s.connectSSE(ctx, url)
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
	s.mu.Lock()
	conn := s.conn
	s.mu.Unlock()

	if conn == nil {
		return fmt.Errorf("not connected")
	}

	if err := conn.WriteMessage(websocket.TextMessage, []byte(msg)); err != nil {
		return err
	}

	entry := models.SocketMessage{
		Timestamp: time.Now().UnixMilli(),
		Direction: "sent",
		Body:      msg,
	}

	s.appendMessage(entry)
	s.emitEvent(entry)

	return nil
}

func (s *Socket) connectWS(ctx context.Context, url string) error {
	c, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		s.mu.Lock()
		s.status = "error"
		s.mu.Unlock()
		s.emitStatus("error")
		return err
	}

	s.mu.Lock()
	s.conn = c
	s.status = "connected"
	s.mu.Unlock()
	s.emitStatus("connected")

	go s.readLoopWS(ctx, c)
	return nil
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

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		_, msg, err := c.ReadMessage()
		if err != nil {
			return
		}

		entry := models.SocketMessage{
			Timestamp: time.Now().UnixMilli(),
			Direction: "received",
			Body:      string(msg),
		}

		s.appendMessage(entry)
		s.emitEvent(entry)
	}
}

func (s *Socket) connectSSE(ctx context.Context, url string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		s.mu.Lock()
		s.status = "error"
		s.mu.Unlock()
		s.emitStatus("error")
		return err
	}
	req.Header.Set("Accept", "text/event-stream")

	sseClient := &http.Client{Timeout: 30 * time.Second}
	resp, err := sseClient.Do(req)
	if err != nil {
		s.mu.Lock()
		s.status = "error"
		s.mu.Unlock()
		s.emitStatus("error")
		return err
	}

	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		s.mu.Lock()
		s.status = "error"
		s.mu.Unlock()
		s.emitStatus("error")
		return fmt.Errorf("SSE connection returned status %d", resp.StatusCode)
	}

	s.mu.Lock()
	s.status = "connected"
	s.mu.Unlock()
	s.emitStatus("connected")

	go s.readLoopSSE(ctx, resp.Body)
	return nil
}

func (s *Socket) readLoopSSE(ctx context.Context, body io.ReadCloser) {
	defer body.Close()

	scanner := bufio.NewScanner(body)
	var buf strings.Builder
	currentEvent := ""
	currentID := ""
	currentRetry := 0

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
			Retry:     currentRetry,
		}
		currentEvent = ""
		currentRetry = 0

		s.appendMessage(entry)
		s.emitEvent(entry)
	}

	for scanner.Scan() {
		select {
		case <-ctx.Done():
			return
		default:
		}

		line := scanner.Text()

		switch {
		case strings.HasPrefix(line, "data: "):
			buf.WriteString(strings.TrimPrefix(line, "data: "))
			buf.WriteString("\n")
		case strings.HasPrefix(line, "event: "):
			currentEvent = strings.TrimSpace(strings.TrimPrefix(line, "event: "))
		case strings.HasPrefix(line, "id: "):
			currentID = strings.TrimSpace(strings.TrimPrefix(line, "id: "))
		case strings.HasPrefix(line, "retry: "):
			fmt.Sscanf(strings.TrimPrefix(line, "retry: "), "%d", &currentRetry)
		case line == "":
			flush()
		}
	}

	// Flush any remaining data on stream close
	flush()

	s.mu.Lock()
	s.status = "disconnected"
	s.mu.Unlock()
	s.emitStatus("disconnected")
}
