package graphqlpkg

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

// Request represents a GraphQL request.
type Request struct {
	URL         string `json:"url"`
	Query       string `json:"query"`
	Variables   string `json:"variables,omitempty"` // JSON object string
	OperationName string `json:"operationName,omitempty"`
	Headers     map[string]string `json:"headers,omitempty"`
}

// Response represents a GraphQL response.
type Response struct {
	Data       json.RawMessage `json:"data,omitempty"`
	Errors     []GraphQLError  `json:"errors,omitempty"`
	StatusCode int             `json:"statusCode"`
	TimingMs   int64           `json:"timingMs"`
}

// GraphQLError represents a single GraphQL error.
type GraphQLError struct {
	Message    string          `json:"message"`
	Locations  []ErrorLocation `json:"locations,omitempty"`
	Path       []interface{}   `json:"path,omitempty"`
	Extensions map[string]interface{} `json:"extensions,omitempty"`
}

// ErrorLocation represents a location in the query.
type ErrorLocation struct {
	Line   int `json:"line"`
	Column int `json:"column"`
}

// SubscriptionMessage represents a message over the WebSocket subscription.
type SubscriptionMessage struct {
	Type    string          `json:"type"`
	ID      string          `json:"id,omitempty"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

// Execute runs a GraphQL query or mutation via HTTP POST.
func Execute(req Request) Response {
	start := time.Now()

	bodyMap := map[string]interface{}{
		"query": req.Query,
	}
	if req.Variables != "" {
		var vars interface{}
		if err := json.Unmarshal([]byte(req.Variables), &vars); err == nil {
			bodyMap["variables"] = vars
		}
	}
	if req.OperationName != "" {
		bodyMap["operationName"] = req.OperationName
	}

	bodyBytes, _ := json.Marshal(bodyMap)
	httpReq, err := http.NewRequest("POST", req.URL, bytes.NewReader(bodyBytes))
	if err != nil {
		return Response{
			Errors:     []GraphQLError{{Message: fmt.Sprintf("Failed to create request: %v", err)}},
			StatusCode: 0,
			TimingMs:   time.Since(start).Milliseconds(),
		}
	}
	httpReq.Header.Set("Content-Type", "application/json")

	for k, v := range req.Headers {
		httpReq.Header.Set(k, v)
	}

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return Response{
			Errors:     []GraphQLError{{Message: fmt.Sprintf("Request failed: %v", err)}},
			StatusCode: 0,
			TimingMs:   time.Since(start).Milliseconds(),
		}
	}
	defer resp.Body.Close()

	respBytes, _ := io.ReadAll(resp.Body)

	var gqlResp struct {
		Data   json.RawMessage `json:"data"`
		Errors []GraphQLError  `json:"errors"`
	}
	_ = json.Unmarshal(respBytes, &gqlResp)

	return Response{
		Data:       gqlResp.Data,
		Errors:     gqlResp.Errors,
		StatusCode: resp.StatusCode,
		TimingMs:   time.Since(start).Milliseconds(),
	}
}

// Introspect performs a full GraphQL schema introspection.
func Introspect(url string, headers map[string]string) ([]byte, error) {
	introspectionQuery := `
	query IntrospectionQuery {
		__schema {
			queryType { name }
			mutationType { name }
			subscriptionType { name }
			types {
				kind
				name
				description
				fields(includeDeprecated: true) {
					name
					description
					args {
						name
						description
						type { ...TypeRef }
						defaultValue
					}
					type { ...TypeRef }
					isDeprecated
					deprecationReason
				}
				inputFields {
					name
					description
					type { ...TypeRef }
					defaultValue
				}
				interfaces { ...TypeRef }
				enumValues(includeDeprecated: true) {
					name
					description
					isDeprecated
					deprecationReason
				}
				possibleTypes { ...TypeRef }
			}
			directives {
				name
				description
				locations
				args {
					name
					description
					type { ...TypeRef }
					defaultValue
				}
			}
		}
	}
	fragment TypeRef on __Type {
		kind
		name
		ofType {
			kind
			name
			ofType {
				kind
				name
				ofType {
					kind
					name
				}
			}
		}
	}`

	bodyMap := map[string]interface{}{"query": introspectionQuery}
	bodyBytes, _ := json.Marshal(bodyMap)

	httpReq, err := http.NewRequest("POST", url, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("introspect: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		httpReq.Header.Set(k, v)
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("introspect: %w", err)
	}
	defer resp.Body.Close()

	return io.ReadAll(resp.Body)
}

// Subscribe initiates a GraphQL subscription over WebSocket using the graphql-ws protocol.
// It returns a channel of subscription messages and a close function.
func Subscribe(url string, query string, variables string, headers map[string]string) (<-chan SubscriptionMessage, func(), error) {
	dialer := websocket.DefaultDialer
	if headers != nil {
		dialer.Subprotocols = []string{"graphql-transport-ws"}
	}

	conn, _, err := dialer.Dial(url, nil)
	if err != nil {
		// Fallback: try without subprotocol
		dialer2 := websocket.DefaultDialer
		conn2, _, err2 := dialer2.Dial(url, nil)
		if err2 != nil {
			return nil, nil, fmt.Errorf("graphql subscription dial error: %v (tried subprotocol: %v)", err2, err)
		}
		conn = conn2
	}

	msgCh := make(chan SubscriptionMessage, 64)

	// Send init message
	initPayload := map[string]interface{}{}
	for k, v := range headers {
		if k == "Authorization" || k == "authorization" {
			initPayload["Authorization"] = v
		}
	}
	initMsg := SubscriptionMessage{
		Type: "connection_init",
	}
	if len(initPayload) > 0 {
		payloadBytes, _ := json.Marshal(initPayload)
		initMsg.Payload = payloadBytes
	}
	if err := conn.WriteJSON(initMsg); err != nil {
		conn.Close()
		close(msgCh)
		return nil, nil, fmt.Errorf("graphql ws init: %w", err)
	}

	// Subscribe
	subID := "1"
	var vars interface{}
	if variables != "" {
		_ = json.Unmarshal([]byte(variables), &vars)
	}
	subPayload := map[string]interface{}{
		"query":     query,
		"variables": vars,
	}
	subPayloadBytes, _ := json.Marshal(subPayload)
	subMsg := SubscriptionMessage{
		Type:    "subscribe",
		ID:      subID,
		Payload: subPayloadBytes,
	}
	if err := conn.WriteJSON(subMsg); err != nil {
		conn.Close()
		close(msgCh)
		return nil, nil, fmt.Errorf("graphql ws subscribe: %w", err)
	}

	// Read loop
	go func() {
		defer close(msgCh)
		defer conn.Close()

		for {
			var msg SubscriptionMessage
			if err := conn.ReadJSON(&msg); err != nil {
				return
			}

			select {
			case msgCh <- msg:
			default:
			}

			if msg.Type == "complete" || msg.Type == "error" {
				return
			}
		}
	}()

	closeFn := func() {
		doneMsg := SubscriptionMessage{
			Type: "complete",
			ID:   subID,
		}
		_ = conn.WriteJSON(doneMsg)
		conn.Close()
	}

	return msgCh, closeFn, nil
}

// Marshal helpers for Wails
type MarshalResult struct {
	Data   json.RawMessage `json:"data"`
	Errors []GraphQLError  `json:"errors"`
	Status int             `json:"statusCode"`
	Timing int64           `json:"timingMs"`
}

func MarshalResponse(resp Response) (string, error) {
	b, err := json.Marshal(resp)
	return string(b), err
}
