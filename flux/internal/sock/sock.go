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
}

func New() *Socket {
	return &Socket{status: "disconnected"}
}

func (s *Socket) OnEvent(fn func(models.SocketMessage)) {
	s.onEvent = fn
}

func (s *Socket) OnStatus(fn func(string)) {
	s.onStatus = fn
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

	s.mu.Lock()
	s.messages = append(s.messages, entry)
	s.mu.Unlock()

	if s.onEvent != nil {
		s.onEvent(entry)
	}

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

		s.mu.Lock()
		s.messages = append(s.messages, entry)
		s.mu.Unlock()

		if s.onEvent != nil {
			s.onEvent(entry)
		}
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

	resp, err := http.DefaultClient.Do(req)
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

	for scanner.Scan() {
		select {
		case <-ctx.Done():
			return
		default:
		}

		line := scanner.Text()

		if strings.HasPrefix(line, "data: ") {
			buf.WriteString(strings.TrimPrefix(line, "data: "))
			buf.WriteString("\n")
		} else if line == "" && buf.Len() > 0 {
			body := strings.TrimSpace(buf.String())
			// Try to unmarshal JSON data fields for cleaner display
			var data json.RawMessage
			if json.Unmarshal([]byte(body), &data) == nil {
				body = string(data)
			}
			buf.Reset()

			entry := models.SocketMessage{
				Timestamp: time.Now().UnixMilli(),
				Direction: "received",
				Body:      body,
			}

			s.mu.Lock()
			s.messages = append(s.messages, entry)
			s.mu.Unlock()

			if s.onEvent != nil {
				s.onEvent(entry)
			}
		}
	}

	s.mu.Lock()
	s.status = "disconnected"
	s.mu.Unlock()
	s.emitStatus("disconnected")
}

func (s *Socket) emitStatus(status string) {
	if s.onStatus != nil {
		s.onStatus(status)
	}
}
