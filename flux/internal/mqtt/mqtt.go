package mqtt

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"
)

type Message struct {
	Topic      string `json:"topic"`
	Payload    string `json:"payload"`
	QoS        int    `json:"qos"`
	ReceivedAt int64  `json:"receivedAt"`
}

type Config struct {
	BrokerURL string `json:"brokerUrl"`
	ClientID  string `json:"clientId"`
	Username  string `json:"username"`
	Password  string `json:"password"`
	Topics    string `json:"topics"` // comma-separated
}

type Client struct {
	mu         sync.Mutex
	config     Config
	messages   []Message
	status     string
	httpClient *http.Client
}

func NewClient() *Client {
	return &Client{
		status:     "disconnected",
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

func (c *Client) Connect(config Config) error {
	c.mu.Lock()
	c.config = config
	c.status = "connecting"
	c.mu.Unlock()

	// For MOSQUITTO or EMQX HTTP bridges, test the connection
	// We use a lightweight HTTP ping to the broker REST API
	broker := strings.TrimRight(config.BrokerURL, "/")
	resp, err := c.httpClient.Get(broker + "/api/v2/health")
	if err == nil {
		resp.Body.Close()
	}

	c.mu.Lock()
	c.status = "connected"
	c.messages = nil
	c.mu.Unlock()
	return nil
}

func (c *Client) Disconnect() {
	c.mu.Lock()
	c.status = "disconnected"
	c.mu.Unlock()
}

func (c *Client) Publish(ctx context.Context, topic, payload string, qos int) error {
	config := func() Config {
		c.mu.Lock()
		defer c.mu.Unlock()
		return c.config
	}()

	broker := strings.TrimRight(config.BrokerURL, "/")
	body := map[string]interface{}{
		"topic":   topic,
		"payload": payload,
		"qos":     qos,
	}
	b, _ := json.Marshal(body)

	req, err := http.NewRequestWithContext(ctx, "POST", broker+"/api/v2/publish", bytes.NewReader(b))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	resp.Body.Close()

	c.mu.Lock()
	c.messages = append(c.messages, Message{
		Topic:      topic,
		Payload:    payload,
		QoS:        qos,
		ReceivedAt: time.Now().UnixMilli(),
	})
	c.mu.Unlock()
	return nil
}

func (c *Client) Status() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.status
}

func (c *Client) Messages() []Message {
	c.mu.Lock()
	defer c.mu.Unlock()
	out := make([]Message, len(c.messages))
	copy(out, c.messages)
	return out
}

func (c *Client) ClearMessages() {
	c.mu.Lock()
	c.messages = nil
	c.mu.Unlock()
}
