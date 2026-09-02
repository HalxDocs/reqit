package onceo

import (
	"testing"
	"time"
)

func TestStatusString(t *testing.T) {
	tests := []struct {
		status Status
		want   string
	}{
		{StatusPending, "pending"},
		{StatusSuccess, "success"},
		{StatusFailed, "failed"},
		{StatusReversed, "reversed"},
		{Status(99), "status(99)"},
	}

	for _, tt := range tests {
		if got := tt.status.String(); got != tt.want {
			t.Errorf("Status(%d).String() = %q, want %q", tt.status, got, tt.want)
		}
	}
}

func TestStatusFromString(t *testing.T) {
	tests := []struct {
		s       string
		want    Status
		wantErr bool
	}{
		{"pending", StatusPending, false},
		{"success", StatusSuccess, false},
		{"failed", StatusFailed, false},
		{"reversed", StatusReversed, false},
		{"unknown", StatusPending, true},
		{"", StatusPending, true},
	}

	for _, tt := range tests {
		got, err := StatusFromString(tt.s)
		if (err != nil) != tt.wantErr {
			t.Errorf("StatusFromString(%q) error = %v, wantErr %v", tt.s, err, tt.wantErr)
			continue
		}
		if got != tt.want {
			t.Errorf("StatusFromString(%q) = %v, want %v", tt.s, got, tt.want)
		}
	}
}

func TestStatusJSONRoundTrip(t *testing.T) {
	tests := []Status{StatusPending, StatusSuccess, StatusFailed, StatusReversed}
	for _, s := range tests {
		data, err := s.MarshalJSON()
		if err != nil {
			t.Fatalf("MarshalJSON(%d) error: %v", s, err)
		}
		var got Status
		if err := got.UnmarshalJSON(data); err != nil {
			t.Fatalf("UnmarshalJSON(%s) error: %v", string(data), err)
		}
		if got != s {
			t.Errorf("round-trip: got %d, want %d", got, s)
		}
	}
}

func TestStatusUnmarshalInvalid(t *testing.T) {
	var s Status
	err := s.UnmarshalJSON([]byte(`"bogus"`))
	if err == nil {
		t.Fatal("expected error for unknown status string")
	}
}

func TestStatusUnmarshalNumeric(t *testing.T) {
	var s Status
	err := s.UnmarshalJSON([]byte(`0`))
	if err == nil {
		t.Fatal("expected error for numeric status")
	}
}

func TestStatusMarshalJSONInvalid(t *testing.T) {
	_, err := Status(99).MarshalJSON()
	if err == nil {
		t.Fatal("expected error for undefined Status value")
	}
}

func TestEventTimestamps(t *testing.T) {
	now := time.Now().UTC()
	e := Event{
		ID:              "evt_001",
		Provider:        "paystack",
		ProviderEventID: "pay_001",
		Type:            "charge.success",
		Status:          StatusSuccess,
		AmountMinor:     50000,
		Currency:        "NGN",
		Reference:       "ref_001",
		ReceivedAt:      now,
		ProcessedAt:     now,
	}

	if e.ReceivedAt.IsZero() {
		t.Error("ReceivedAt should not be zero")
	}
	if e.ProcessedAt.IsZero() {
		t.Error("ProcessedAt should not be zero")
	}
}
