package requester

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"flux/internal/models"
)

func TestExecuteGet(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" {
			t.Errorf("expected GET, got %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"ok":true}`))
	}))
	defer server.Close()

	result := Execute(context.Background(), models.RequestPayload{
		Method: "GET",
		URL:    server.URL,
	}, nil)

	if result.Error != "" {
		t.Fatalf("unexpected error: %s", result.Error)
	}
	if result.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", result.StatusCode)
	}
	if result.Body != `{"ok":true}` {
		t.Errorf("unexpected body: %q", result.Body)
	}
	if result.SizeBytes <= 0 {
		t.Errorf("expected positive size, got %d", result.SizeBytes)
	}
}

func TestExecutePostJSON(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if ct := r.Header.Get("Content-Type"); ct != "application/json" {
			t.Errorf("expected application/json, got %s", ct)
		}
		var body map[string]interface{}
		json.NewDecoder(r.Body).Decode(&body)
		if body["key"] != "value" {
			t.Errorf("unexpected body: %v", body)
		}
		w.WriteHeader(http.StatusCreated)
		w.Write([]byte(`{"id":1}`))
	}))
	defer server.Close()

	result := Execute(context.Background(), models.RequestPayload{
		Method:   "POST",
		URL:      server.URL,
		BodyType: "json",
		Body:     `{"key":"value"}`,
		Headers: []models.Header{
			{Key: "Content-Type", Value: "application/json", Enabled: true},
		},
	}, nil)

	if result.Error != "" {
		t.Fatalf("unexpected error: %s", result.Error)
	}
	if result.StatusCode != http.StatusCreated {
		t.Errorf("expected 201, got %d", result.StatusCode)
	}
}

func TestExecuteHeadersSent(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Custom") != "test-value" {
			t.Errorf("expected X-Custom header")
		}
		if r.Header.Get("X-Disabled") == "should-not-exist" {
			t.Errorf("disabled header should not be sent")
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	result := Execute(context.Background(), models.RequestPayload{
		Method: "GET",
		URL:    server.URL,
		Headers: []models.Header{
			{Key: "X-Custom", Value: "test-value", Enabled: true},
			{Key: "X-Disabled", Value: "should-not-exist", Enabled: false},
		},
	}, nil)

	if result.Error != "" {
		t.Fatalf("unexpected error: %s", result.Error)
	}
	if result.StatusCode != http.StatusNoContent {
		t.Errorf("expected 204, got %d", result.StatusCode)
	}
}

func TestExecuteQueryParams(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("key1") != "val1" {
			t.Errorf("expected key1=val1, got %s", r.URL.Query().Get("key1"))
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	base := server.URL + "/test"
	result := Execute(context.Background(), models.RequestPayload{
		Method: "GET",
		URL:    base,
		Params: []models.Header{
			{Key: "key1", Value: "val1", Enabled: true},
			{Key: "key2", Value: "val2", Enabled: false},
		},
	}, nil)

	if result.Error != "" {
		t.Fatalf("unexpected error: %s", result.Error)
	}
}

func TestExecuteURLWithExistingParams(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("existing") != "ok" {
			t.Errorf("expected existing param")
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	result := Execute(context.Background(), models.RequestPayload{
		Method: "GET",
		URL:    server.URL + "/path?existing=ok",
	}, nil)

	if result.Error != "" {
		t.Fatalf("unexpected error: %s", result.Error)
	}
}

func TestExecuteBearerAuth(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer my-token" {
			t.Errorf("expected Bearer auth, got %q", r.Header.Get("Authorization"))
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	result := Execute(context.Background(), models.RequestPayload{
		Method:    "GET",
		URL:       server.URL,
		AuthType:  "bearer",
		AuthValue: "my-token",
	}, nil)

	if result.Error != "" {
		t.Fatalf("unexpected error: %s", result.Error)
	}
}

func TestExecuteBasicAuth(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, pass, ok := r.BasicAuth()
		if !ok || user != "admin" || pass != "secret" {
			t.Errorf("expected basic auth admin:secret")
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	result := Execute(context.Background(), models.RequestPayload{
		Method:    "GET",
		URL:       server.URL,
		AuthType:  "basic",
		AuthValue: "admin:secret",
	}, nil)

	if result.Error != "" {
		t.Fatalf("unexpected error: %s", result.Error)
	}
}

func TestExecuteFormURLEncoded(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if ct := r.Header.Get("Content-Type"); ct != "application/x-www-form-urlencoded" {
			t.Errorf("expected urlencoded content-type, got %s", ct)
		}
		r.ParseForm()
		if r.FormValue("field1") != "val1" {
			t.Errorf("expected field1=val1")
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	result := Execute(context.Background(), models.RequestPayload{
		Method:   "POST",
		URL:      server.URL,
		BodyType: "urlencoded",
		BodyForm: []models.Header{
			{Key: "field1", Value: "val1", Enabled: true},
		},
	}, nil)

	if result.Error != "" {
		t.Fatalf("unexpected error: %s", result.Error)
	}
}

func TestExecuteTimeout(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// hangs forever — will be caught by context timeout
		select {}
	}))
	defer server.Close()

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // immediately cancelled

	result := Execute(ctx, models.RequestPayload{
		Method: "GET",
		URL:    server.URL,
	}, nil)

	if result.Error == "" {
		t.Error("expected error for cancelled context")
	}
	if result.TimingMs <= 0 && result.Timing != nil {
		// timing may vary, just ensure it didn't panic
	}
}

func TestExecuteErrorResult(t *testing.T) {
	// invalid URL
	result := Execute(context.Background(), models.RequestPayload{
		Method: "GET",
		URL:    "://invalid-url",
	}, nil)

	if result.Error == "" {
		t.Error("expected error for invalid URL")
	}
	if result.StatusCode != 0 {
		t.Errorf("expected 0 status code for error, got %d", result.StatusCode)
	}
}

func TestExecuteFormUrlEncodedViaForm(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.ParseForm()
		if r.FormValue("field1") != "val1" {
			t.Errorf("expected field1=val1, got %s", r.FormValue("field1"))
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	result := Execute(context.Background(), models.RequestPayload{
		Method:   "POST",
		URL:      server.URL,
		BodyType: "form",
		BodyForm: []models.Header{
			{Key: "field1", Value: "val1", Enabled: true, ValueType: "text"},
		},
	}, nil)

	if result.Error != "" {
		t.Fatalf("unexpected error: %s", result.Error)
	}
	if result.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", result.StatusCode)
	}
}

func TestExecuteResponseHeaders(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Response-Header", "present")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, "ok")
	}))
	defer server.Close()

	result := Execute(context.Background(), models.RequestPayload{
		Method: "GET",
		URL:    server.URL,
	}, nil)

	if result.Error != "" {
		t.Fatalf("unexpected error: %s", result.Error)
	}
	if result.Headers["X-Response-Header"] != "present" {
		t.Errorf("expected X-Response-Header in response")
	}
}

func TestExecuteTimingBreakdown(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	}))
	defer server.Close()

	result := Execute(context.Background(), models.RequestPayload{
		Method: "GET",
		URL:    server.URL,
	}, nil)

	if result.Error != "" {
		t.Fatalf("unexpected error: %s", result.Error)
	}
	if result.Timing == nil {
		t.Fatal("expected timing breakdown")
	}
	if result.Timing.TotalMs <= 0 {
		t.Errorf("expected positive total time, got %d", result.Timing.TotalMs)
	}
}
