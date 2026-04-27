package requester

import (
	"encoding/base64"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"flux/internal/models"
)

func TestExecute_GETWithParamsAndHeaders(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.URL.Query().Get("foo"); got != "bar" {
			t.Errorf("expected query foo=bar, got %q", got)
		}
		if got := r.Header.Get("X-Test"); got != "abc" {
			t.Errorf("expected header X-Test=abc, got %q", got)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(200)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer ts.Close()

	res := Execute(models.RequestPayload{
		Method: "GET",
		URL:    ts.URL,
		Params: []models.Header{{Key: "foo", Value: "bar", Enabled: true}, {Key: "skipped", Value: "x", Enabled: false}},
		Headers: []models.Header{{Key: "X-Test", Value: "abc", Enabled: true}},
	})

	if res.Error != "" {
		t.Fatalf("unexpected error: %s", res.Error)
	}
	if res.StatusCode != 200 {
		t.Fatalf("expected 200, got %d", res.StatusCode)
	}
	if res.Body != `{"ok":true}` {
		t.Errorf("unexpected body: %q", res.Body)
	}
	if res.Headers["Content-Type"] != "application/json" {
		t.Errorf("expected Content-Type application/json, got %q", res.Headers["Content-Type"])
	}
}

func TestExecute_PostJSONBody(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		if string(body) != `{"a":1}` {
			t.Errorf("expected json body, got %q", string(body))
		}
		if r.Header.Get("Content-Type") != "application/json" {
			t.Errorf("expected Content-Type application/json, got %q", r.Header.Get("Content-Type"))
		}
		w.WriteHeader(201)
	}))
	defer ts.Close()

	res := Execute(models.RequestPayload{
		Method:   "POST",
		URL:      ts.URL,
		BodyType: "json",
		Body:     `{"a":1}`,
	})

	if res.StatusCode != 201 {
		t.Fatalf("expected 201, got %d (err=%s)", res.StatusCode, res.Error)
	}
}

func TestExecute_BasicAuth(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		want := "Basic " + base64.StdEncoding.EncodeToString([]byte("alice:secret"))
		if auth != want {
			t.Errorf("expected %q, got %q", want, auth)
		}
		w.WriteHeader(200)
	}))
	defer ts.Close()

	res := Execute(models.RequestPayload{
		Method:    "GET",
		URL:       ts.URL,
		AuthType:  "basic",
		AuthValue: "alice:secret",
	})
	if res.StatusCode != 200 {
		t.Fatalf("expected 200, got %d (err=%s)", res.StatusCode, res.Error)
	}
}

func TestExecute_BearerAuth(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "Bearer xyz" {
			t.Errorf("expected Bearer xyz, got %q", got)
		}
		w.WriteHeader(200)
	}))
	defer ts.Close()

	res := Execute(models.RequestPayload{
		Method:    "GET",
		URL:       ts.URL,
		AuthType:  "bearer",
		AuthValue: "xyz",
	})
	if res.StatusCode != 200 {
		t.Fatalf("expected 200, got %d (err=%s)", res.StatusCode, res.Error)
	}
}

func TestExecute_FormBody(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		if !strings.Contains(string(body), "name=alice") {
			t.Errorf("expected form body to contain name=alice, got %q", string(body))
		}
		if r.Header.Get("Content-Type") != "application/x-www-form-urlencoded" {
			t.Errorf("expected urlencoded Content-Type, got %q", r.Header.Get("Content-Type"))
		}
		w.WriteHeader(200)
	}))
	defer ts.Close()

	res := Execute(models.RequestPayload{
		Method:   "POST",
		URL:      ts.URL,
		BodyType: "urlencoded",
		BodyForm: []models.Header{{Key: "name", Value: "alice", Enabled: true}},
	})
	if res.StatusCode != 200 {
		t.Fatalf("expected 200, got %d (err=%s)", res.StatusCode, res.Error)
	}
}

func TestExecute_EmptyURLReturnsError(t *testing.T) {
	res := Execute(models.RequestPayload{Method: "GET", URL: ""})
	if res.Error == "" {
		t.Fatalf("expected error for empty URL, got result %+v", res)
	}
}
