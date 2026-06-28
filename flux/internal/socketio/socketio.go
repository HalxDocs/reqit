package socketio

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"

	"flux/internal/models"
)

const maxMessages = 500

// Client implements the Engine.IO v4 protocol (polling → WebSocket upgrade)
// and the Socket.IO v4 protocol on top.
type Client struct {
	mu       sync.Mutex
	status   string // "disconnected" | "connecting" | "connected" | "error"
	url      string
	sid      string
	cookies  string // raw cookie header value
	headers  map[string]string
	pingInt  time.Duration
	pingTout time.Duration

	pollCancel context.CancelFunc
	wsConn     *websocket.Conn
	wsCancel   context.CancelFunc

	messages []models.SocketMessage
	onEvent  func(models.SocketMessage)
	onStatus func(string)
	cbMu     sync.RWMutex
}

// NewClient creates a new Socket.IO client.
func NewClient() *Client {
	return &Client{status: "disconnected"}
}

func (c *Client) OnEvent(fn func(models.SocketMessage)) {
	c.cbMu.Lock()
	c.onEvent = fn
	c.cbMu.Unlock()
}

func (c *Client) OnStatus(fn func(string)) {
	c.cbMu.Lock()
	c.onStatus = fn
	c.cbMu.Unlock()
}

func (c *Client) emitEvent(msg models.SocketMessage) {
	c.cbMu.RLock()
	fn := c.onEvent
	c.cbMu.RUnlock()
	if fn != nil {
		fn(msg)
	}
}

func (c *Client) emitStatus(status string) {
	c.cbMu.RLock()
	fn := c.onStatus
	c.cbMu.RUnlock()
	if fn != nil {
		fn(status)
	}
}

func (c *Client) appendMessage(entry models.SocketMessage) {
	c.mu.Lock()
	if len(c.messages) >= maxMessages {
		c.messages = append(c.messages[:0], c.messages[1:]...)
	}
	c.messages = append(c.messages, entry)
	c.mu.Unlock()
}

func (c *Client) State() models.SocketState {
	c.mu.Lock()
	defer c.mu.Unlock()
	msgs := make([]models.SocketMessage, len(c.messages))
	copy(msgs, c.messages)
	proto := "socketio"
	return models.SocketState{
		Status:   c.status,
		Protocol: proto,
		URL:      c.url,
		Messages: msgs,
	}
}

// Connect performs the Engine.IO handshake (HTTP polling), then upgrades to WebSocket.
func (c *Client) Connect(rawURL, cookieHeader string, extraHeaders map[string]string) error {
	c.Disconnect()

	c.mu.Lock()
	c.status = "connecting"
	c.url = rawURL
	c.cookies = cookieHeader
	c.headers = extraHeaders
	c.messages = nil
	c.mu.Unlock()
	c.emitStatus("connecting")

	// Parse base URL and ensure it has a path.
	u, err := url.Parse(rawURL)
	if err != nil {
		c.setStatus("error")
		return fmt.Errorf("invalid URL: %w", err)
	}

	basePath := u.Path
	if basePath == "" || basePath == "/" {
		basePath = "/socket.io/"
	}
	if !strings.HasSuffix(basePath, "/") {
		basePath += "/"
	}

	// --- Step 1: Engine.IO handshake via HTTP long-polling ---
	handshakeURL := u.ResolveReference(&url.URL{
		Path: basePath,
		RawQuery: url.Values{
			"EIO":       {"4"},
			"transport": {"polling"},
		}.Encode(),
	}).String()

	httpClient := &http.Client{Timeout: 15 * time.Second}
	req, err := http.NewRequest("GET", handshakeURL, nil)
	if err != nil {
		c.setStatus("error")
		return err
	}
	c.applyHeaders(req)

	resp, err := httpClient.Do(req)
	if err != nil {
		c.setStatus("error")
		return fmt.Errorf("handshake failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.setStatus("error")
		return fmt.Errorf("handshake read: %w", err)
	}

	// Engine.IO returns packets prefixed by length; the open packet looks like:
	//   40{"sid":"...","upgrades":["websocket"],"pingInterval":25000,"pingTimeout":20000}
	// Strip the length prefix if present.
	raw := string(body)
	if idx := strings.Index(raw, "40"); idx >= 0 {
		raw = raw[idx:]
	}
	// Strip trailing newline or padding.
	raw = strings.TrimSpace(raw)
	// The packet content starts after the "40" packet type marker.
	if strings.HasPrefix(raw, "40") {
		raw = raw[2:]
	}
	// May be wrapped in quotes or have extra chars — find JSON object.
	if start := strings.Index(raw, "{"); start >= 0 {
		if end := strings.LastIndex(raw, "}"); end > start {
			raw = raw[start : end+1]
		}
	}

	var handshake struct {
		SID         string   `json:"sid"`
		Upgrades    []string `json:"upgrades"`
		PingInterval int    `json:"pingInterval"`
		PingTimeout  int    `json:"pingTimeout"`
	}
	if err := json.Unmarshal([]byte(raw), &handshake); err != nil {
		c.setStatus("error")
		return fmt.Errorf("handshake parse: %w (raw: %s)", err, raw)
	}

	if handshake.SID == "" {
		c.setStatus("error")
		return fmt.Errorf("no sid in handshake response")
	}

	c.mu.Lock()
	c.sid = handshake.SID
	c.pingInt = time.Duration(handshake.PingInterval) * time.Millisecond
	c.pingTout = time.Duration(handshake.PingTimeout) * time.Millisecond
	c.mu.Unlock()

	// --- Step 2: Start polling for initial messages ---
	pollCtx, pollCancel := context.WithCancel(context.Background())
	c.mu.Lock()
	c.pollCancel = pollCancel
	c.mu.Unlock()
	go c.pollLoop(pollCtx, u, basePath)

	// --- Step 3: Upgrade to WebSocket if server supports it ---
	hasWS := false
	for _, up := range handshake.Upgrades {
		if up == "websocket" {
			hasWS = true
			break
		}
	}

	if hasWS {
		wsCtx, wsCancel := context.WithCancel(context.Background())
		c.mu.Lock()
		c.wsCancel = wsCancel
		c.mu.Unlock()
		go c.wsUpgrade(wsCtx, u, basePath)
	} else {
		// Polling-only — mark connected immediately.
		c.mu.Lock()
		c.status = "connected"
		c.mu.Unlock()
		c.emitStatus("connected")
	}

	return nil
}

func (c *Client) applyHeaders(req *http.Request) {
	if c.cookies != "" {
		req.Header.Set("Cookie", c.cookies)
	}
	for k, v := range c.headers {
		if !strings.EqualFold(k, "cookie") {
			req.Header.Set(k, v)
		}
	}
}

// pollLoop reads Engine.IO packets via HTTP long-polling.
func (c *Client) pollLoop(ctx context.Context, base *url.URL, basePath string) {
	pollURL := base.ResolveReference(&url.URL{
		Path: basePath,
		RawQuery: url.Values{
			"EIO":       {"4"},
			"transport": {"polling"},
			"sid":       {c.sid},
		}.Encode(),
	}).String()

	httpClient := &http.Client{Timeout: 60 * time.Second}

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		req, err := http.NewRequest("GET", pollURL, nil)
		if err != nil {
			return
		}
		c.applyHeaders(req)

		resp, err := httpClient.Do(req)
		if err != nil {
			select {
			case <-ctx.Done():
				return
			default:
				time.Sleep(1 * time.Second)
				continue
			}
		}

		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			continue
		}

		c.handlePollPackets(string(body))
	}
}

// handlePollPackets parses Engine.IO polling response and extracts message packets.
func (c *Client) handlePollPackets(raw string) {
	// Polling responses can contain multiple packets separated by \x1e (record separator).
	// Or a single packet with length prefix.
	packets := strings.Split(raw, "\x1e")
	if len(packets) == 1 {
		// Might be a single packet with length prefix like "1234["packet"]"
		packets = []string{raw}
	}

	for _, pkt := range packets {
		pkt = strings.TrimSpace(pkt)
		if pkt == "" {
			continue
		}
		c.handleEnginePacket(pkt)
	}
}

// handleEnginePacket processes a single Engine.IO packet.
func (c *Client) handleEnginePacket(raw string) {
	if len(raw) < 1 {
		return
	}

	// Strip length prefix if present (digits followed by the actual packet).
	if i := strings.IndexFunc(raw, func(r rune) bool { return !isDigit(r) }); i > 0 {
		raw = raw[i:]
	}

	if len(raw) < 1 {
		return
	}

	pktType := raw[0]
	content := raw[1:]

	switch pktType {
	case '0': // open (already handled in handshake)
	case '1': // close
		c.Disconnect()
	case '2': // ping → send pong
		c.sendEnginePacket('3') // pong
	case '3': // pong — server acknowledged
	case '4': // message → Socket.IO message
		c.handleSocketIOMessage(content)
	case '5': // upgrade
	case '6': // noop
	}
}

// sendEnginePacket sends an Engine.IO packet over the available transport.
func (c *Client) sendEnginePacket(pktType byte, payload ...string) {
	var data string
	if len(payload) > 0 {
		data = string(pktType) + payload[0]
	} else {
		data = string(pktType)
	}

	c.mu.Lock()
	ws := c.wsConn
	sid := c.sid
	c.mu.Unlock()

	// Prefer WebSocket if connected.
	if ws != nil {
		ws.WriteMessage(websocket.TextMessage, []byte(data))
		return
	}

	// Fallback: POST over polling.
	c.sendPollMessage(data, sid)
}

func (c *Client) sendPollMessage(data, sid string) {
	c.mu.Lock()
	rawURL := c.url
	cookies := c.cookies
	headers := c.headers
	c.mu.Unlock()

	u, err := url.Parse(rawURL)
	if err != nil {
		return
	}

	basePath := u.Path
	if basePath == "" || basePath == "/" {
		basePath = "/socket.io/"
	}
	if !strings.HasSuffix(basePath, "/") {
		basePath += "/"
	}

	postURL := u.ResolveReference(&url.URL{
		Path: basePath,
		RawQuery: url.Values{
			"EIO":       {"4"},
			"transport": {"polling"},
			"sid":       {sid},
		}.Encode(),
	}).String()

	httpClient := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest("POST", postURL, strings.NewReader(data))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "text/plain;charset=UTF-8")
	if cookies != "" {
		req.Header.Set("Cookie", cookies)
	}
	for k, v := range headers {
		if !strings.EqualFold(k, "cookie") {
			req.Header.Set(k, v)
		}
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()

	// The POST response may contain packets (e.g., pong).
	body, _ := io.ReadAll(resp.Body)
	if len(body) > 0 {
		c.handlePollPackets(string(body))
	}
}

// handleSocketIOMessage processes a Socket.IO protocol message.
// Socket.IO packet types: 0=connect, 1=disconnect, 2=event, 3=ack, 4=error, 5=binary ack
func (c *Client) handleSocketIOMessage(raw string) {
	if len(raw) < 1 {
		return
	}

	// May have a Socket.IO packet type prefix (0, 1, 2, ...).
	// For messages from the server, the format is usually: 42["event", data]
	// The '4' is Engine.IO message type, then '2' is Socket.IO event type.
	pktType := raw[0]
	rest := raw[1:]

	switch pktType {
	case '0': // connect
		c.mu.Lock()
		c.status = "connected"
		c.mu.Unlock()
		c.emitStatus("connected")
		entry := models.SocketMessage{
			Timestamp: time.Now().UnixMilli(),
			Direction: "received",
			Body:      "[connected]",
		}
		c.appendMessage(entry)
		c.emitEvent(entry)

	case '1': // disconnect
		c.Disconnect()

	case '2': // event — parse JSON array ["eventName", data]
		c.handleSocketIOEvent(rest)

	case '3': // ack
	case '4': // error
		entry := models.SocketMessage{
			Timestamp: time.Now().UnixMilli(),
			Direction: "received",
			Body:      "[error] " + rest,
		}
		c.appendMessage(entry)
		c.emitEvent(entry)

	case '5': // binary ack
	}
}

// handleSocketIOEvent parses a Socket.IO event like ["message", {...}]
func (c *Client) handleSocketIOEvent(raw string) {
	raw = strings.TrimSpace(raw)
	if !strings.HasPrefix(raw, "[") {
		// Might be a namespace-prefixed message like /,"event",data
		if idx := strings.Index(raw, ",["); idx >= 0 {
			raw = raw[idx+1:]
		}
	}

	var arr []json.RawMessage
	if err := json.Unmarshal([]byte(raw), &arr); err != nil {
		entry := models.SocketMessage{
			Timestamp: time.Now().UnixMilli(),
			Direction: "received",
			Body:      raw,
		}
		c.appendMessage(entry)
		c.emitEvent(entry)
		return
	}

	if len(arr) == 0 {
		return
	}

	eventName := strings.Trim(string(arr[0]), `"`)
	var data string
	if len(arr) > 1 {
		data = string(arr[1])
	} else {
		data = "null"
	}

	// Try to pretty-print the data.
	var pretty json.RawMessage
	if json.Unmarshal([]byte(data), &pretty) == nil {
		data = string(pretty)
	}

	entry := models.SocketMessage{
		Timestamp: time.Now().UnixMilli(),
		Direction: "received",
		Body:      fmt.Sprintf("[%s] %s", eventName, data),
	}
	c.appendMessage(entry)
	c.emitEvent(entry)
}

// wsUpgrade upgrades the connection to WebSocket for bidirectional messaging.
func (c *Client) wsUpgrade(ctx context.Context, base *url.URL, basePath string) {
	wsURL := base.ResolveReference(&url.URL{
		Path: basePath,
		RawQuery: url.Values{
			"EIO":       {"4"},
			"transport": {"websocket"},
			"sid":       {c.sid},
		}.Encode(),
	}).String()

	// Convert http(s) to ws(s).
	if strings.HasPrefix(wsURL, "https://") {
		wsURL = "wss://" + wsURL[8:]
	} else if strings.HasPrefix(wsURL, "http://") {
		wsURL = "ws://" + wsURL[7:]
	}

	dialer := websocket.DefaultDialer
	header := http.Header{}
	if c.cookies != "" {
		header.Set("Cookie", c.cookies)
	}
	for k, v := range c.headers {
		if !strings.EqualFold(k, "cookie") {
			header.Set(k, v)
		}
	}

	ws, _, err := dialer.Dial(wsURL, header)
	if err != nil {
		// WebSocket upgrade failed — stay on polling.
		c.mu.Lock()
		if c.status != "connected" {
			c.status = "connected"
		}
		c.mu.Unlock()
		c.emitStatus("connected")
		return
	}

	c.mu.Lock()
	c.wsConn = ws
	c.mu.Unlock()

	// Cancel polling — we're on WebSocket now.
	c.mu.Lock()
	if c.pollCancel != nil {
		c.pollCancel()
		c.pollCancel = nil
	}
	c.mu.Unlock()

	c.mu.Lock()
	c.status = "connected"
	c.mu.Unlock()
	c.emitStatus("connected")

	c.readLoopWS(ctx, ws)
}

func (c *Client) readLoopWS(ctx context.Context, ws *websocket.Conn) {
	defer func() {
		ws.Close()
		c.mu.Lock()
		if c.wsConn == ws {
			c.wsConn = nil
			c.status = "disconnected"
		}
		c.mu.Unlock()
		c.emitStatus("disconnected")
	}()

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		_, msg, err := ws.ReadMessage()
		if err != nil {
			return
		}

		c.handleEnginePacket(string(msg))
	}
}

// Emit sends a Socket.IO event to the server.
func (c *Client) Emit(event string, data interface{}) error {
	c.mu.Lock()
	ws := c.wsConn
	sid := c.sid
	c.mu.Unlock()

	payload, err := json.Marshal([]interface{}{event, data})
	if err != nil {
		return fmt.Errorf("marshal event: %w", err)
	}

	// Socket.IO event packet: 42 + JSON
	pkt := "42" + string(payload)

	if ws != nil {
		if err := ws.WriteMessage(websocket.TextMessage, []byte(pkt)); err != nil {
			return err
		}
	} else if sid != "" {
		c.sendPollMessage(pkt, sid)
	} else {
		return fmt.Errorf("not connected")
	}

	entry := models.SocketMessage{
		Timestamp: time.Now().UnixMilli(),
		Direction: "sent",
		Body:      fmt.Sprintf("[%s] %s", event, string(payload[1:])),
	}
	c.appendMessage(entry)
	c.emitEvent(entry)
	return nil
}

// SendRaw sends a raw Socket.IO message (for custom protocols).
func (c *Client) SendRaw(msg string) error {
	// Treat raw messages as a "message" event.
	return c.Emit("message", msg)
}

// Disconnect closes the connection.
func (c *Client) Disconnect() {
	c.mu.Lock()
	pollCancel := c.pollCancel
	wsCancel := c.wsCancel
	ws := c.wsConn
	c.pollCancel = nil
	c.wsCancel = nil
	c.wsConn = nil
	c.status = "disconnected"
	c.mu.Unlock()

	if pollCancel != nil {
		pollCancel()
	}
	if wsCancel != nil {
		wsCancel()
	}
	if ws != nil {
		ws.Close()
	}

	c.emitStatus("disconnected")
}

func (c *Client) setStatus(s string) {
	c.mu.Lock()
	c.status = s
	c.mu.Unlock()
	c.emitStatus(s)
}

func isDigit(r rune) bool {
	return r >= '0' && r <= '9'
}
