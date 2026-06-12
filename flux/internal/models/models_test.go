package models

import (
	"encoding/json"
	"testing"
)

func TestHeaderRoundTrip(t *testing.T) {
	h := Header{Key: "Content-Type", Value: "application/json", Enabled: true, ValueType: "text"}
	b, err := json.Marshal(h)
	if err != nil {
		t.Fatal(err)
	}
	var got Header
	if err := json.Unmarshal(b, &got); err != nil {
		t.Fatal(err)
	}
	if got.Key != h.Key || got.Value != h.Value || got.Enabled != h.Enabled || got.ValueType != h.ValueType {
		t.Errorf("round trip: got %+v, want %+v", got, h)
	}
}

func TestRequestPayloadDefaults(t *testing.T) {
	p := RequestPayload{}
	if p.Method != "" {
		t.Errorf("expected empty method, got %q", p.Method)
	}
	if p.BodyType != "" {
		t.Errorf("expected empty bodyType, got %q", p.BodyType)
	}
	if len(p.Headers) != 0 {
		t.Errorf("expected nil headers, got %v", p.Headers)
	}
}

func TestTimingBreakdownZero(t *testing.T) {
	tb := TimingBreakdown{}
	if tb.TotalMs != 0 {
		t.Errorf("expected zero TotalMs")
	}
}

func TestResponseResultValidation(t *testing.T) {
	vr := ValidationResult{Valid: true}
	rr := ResponseResult{StatusCode: 200, Validation: &vr}
	if rr.StatusCode != 200 {
		t.Errorf("expected 200")
	}
	if !rr.Validation.Valid {
		t.Errorf("expected valid")
	}
}

func TestSavedRequestJSON(t *testing.T) {
	sr := SavedRequest{
		ID:   "abc-123",
		Name: "Test Request",
		Payload: RequestPayload{
			Method: "GET",
			URL:    "https://example.com",
		},
	}
	b, err := json.Marshal(sr)
	if err != nil {
		t.Fatal(err)
	}
	var decoded SavedRequest
	if err := json.Unmarshal(b, &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded.ID != sr.ID || decoded.Payload.URL != sr.Payload.URL {
		t.Errorf("round trip failed: got %+v", decoded)
	}
}

func TestCollectionRoundTrip(t *testing.T) {
	c := Collection{
		ID:   "coll-1",
		Name: "My Collection",
		Requests: []SavedRequest{
			{ID: "req-1", Name: "Req 1"},
		},
	}
	b, err := json.Marshal(c)
	if err != nil {
		t.Fatal(err)
	}
	var got Collection
	if err := json.Unmarshal(b, &got); err != nil {
		t.Fatal(err)
	}
	if len(got.Requests) != 1 {
		t.Errorf("expected 1 request, got %d", len(got.Requests))
	}
}

func TestHistoryEntryRoundTrip(t *testing.T) {
	entry := HistoryEntry{
		ID: "hist-1",
		Payload: RequestPayload{
			Method: "POST",
			URL:    "https://api.example.com/data",
		},
		Response: ResponseResult{
			StatusCode: 201,
			Status:     "201 Created",
		},
		Favorite: true,
		Tags:     []string{"important", "test"},
	}
	b, err := json.Marshal(entry)
	if err != nil {
		t.Fatal(err)
	}
	var got HistoryEntry
	if err := json.Unmarshal(b, &got); err != nil {
		t.Fatal(err)
	}
	if !got.Favorite {
		t.Errorf("expected favorite=true")
	}
	if len(got.Tags) != 2 {
		t.Errorf("expected 2 tags, got %d", len(got.Tags))
	}
}

func TestMockOverrideDefaults(t *testing.T) {
	mo := MockOverride{}
	if mo.Enabled {
		t.Errorf("expected mock disabled by default")
	}
}

func TestPreSetVarAndExtractRule(t *testing.T) {
	pv := PreSetVar{ID: "pv-1", Key: "token", Value: "abc"}
	er := ExtractRule{ID: "er-1", Type: "body_json", Source: "data.id", Target: "userId"}
	if pv.Key != "token" || er.Type != "body_json" {
		t.Errorf("unexpected field values")
	}
}

func TestRunnerRequest(t *testing.T) {
	rr := RunnerRequest{
		ID:   "run-1",
		Name: "Runner Test",
		Payload: RequestPayload{
			Method: "GET",
			URL:    "https://test.com",
		},
	}
	if rr.ID != "run-1" || rr.Payload.URL != "https://test.com" {
		t.Errorf("runner request fields mismatch")
	}
}

func TestRequestBodyFormEncoding(t *testing.T) {
	payload := RequestPayload{
		Method:   "POST",
		BodyType: "form",
		BodyForm: []Header{
			{Key: "field1", Value: "val1", Enabled: true},
			{Key: "field2", Value: "val2", Enabled: false},
		},
	}
	if len(payload.BodyForm) != 2 {
		t.Errorf("expected 2 form fields")
	}
	if !payload.BodyForm[0].Enabled || payload.BodyForm[1].Enabled {
		t.Errorf("expected only first field enabled")
	}
}
