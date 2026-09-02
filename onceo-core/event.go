package onceo

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

type Status int

const (
	StatusPending Status = iota
	StatusSuccess
	StatusFailed
	StatusReversed
)

var statusStrings = map[Status]string{
	StatusPending:  "pending",
	StatusSuccess:  "success",
	StatusFailed:   "failed",
	StatusReversed: "reversed",
}

var statusValues = map[string]Status{
	"pending":  StatusPending,
	"success":  StatusSuccess,
	"failed":   StatusFailed,
	"reversed": StatusReversed,
}

func (s Status) String() string {
	if v, ok := statusStrings[s]; ok {
		return v
	}
	return fmt.Sprintf("status(%d)", int(s))
}

func (s Status) MarshalJSON() ([]byte, error) {
	if _, ok := statusStrings[s]; !ok {
		return nil, fmt.Errorf("unknown status value %d", int(s))
	}
	return json.Marshal(s.String())
}

func (s *Status) UnmarshalJSON(data []byte) error {
	var str string
	if err := json.Unmarshal(data, &str); err != nil {
		return fmt.Errorf("status: expected string, got %s", string(data))
	}
	v, ok := statusValues[strings.ToLower(str)]
	if !ok {
		return fmt.Errorf("unknown status: %s", str)
	}
	*s = v
	return nil
}

func StatusFromString(s string) (Status, error) {
	v, ok := statusValues[strings.ToLower(s)]
	if !ok {
		return StatusPending, fmt.Errorf("unknown status: %s", s)
	}
	return v, nil
}

type Event struct {
	ID              string    `json:"id"`
	Provider        string    `json:"provider"`
	ProviderEventID string    `json:"provider_event_id"`
	Type            string    `json:"type"`
	Status          Status    `json:"status"`
	AmountMinor     int64     `json:"amount_minor"`
	Currency        string    `json:"currency"`
	Reference       string    `json:"reference"`
	RawPayload      []byte    `json:"raw_payload,omitempty"`
	ReceivedAt      time.Time `json:"received_at"`
	ProcessedAt     time.Time `json:"processed_at"`
}
