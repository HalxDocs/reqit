package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	cookiestore "flux/internal/cookies"
	"flux/internal/eventinspector"
	"flux/internal/models"
)

func TestEventInspectorReplayEndToEnd(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "ws")
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	store := eventinspector.NewStore(dir)

	rec, err := store.Append(models.EventRecord{
		Method:      "POST",
		SourceURL:   "/webhooks/flexprice",
		ContentType: "application/json",
		Headers: map[string]string{
			"Content-Type":    "application/json",
			"Connection":      "keep-alive",
			"svix-id":         "msg_replay_1",
			"svix-timestamp":  "1700000000",
			"svix-signature":  "v1,deadbeef",
			"X-Flexprice-Key": "abc",
		},
		Body: `{"type":"invoice.paid","data":{"amount":99}}`,
	})
	if err != nil {
		t.Fatal(err)
	}

	var gotBody string
	var gotHeaders http.Header
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		gotBody = string(b)
		gotHeaders = r.Header
		w.WriteHeader(200)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer target.Close()

	a := &App{eventInspector: store, cookies: cookiestore.New(dir)}
	res, err := a.EventInspectorReplay(rec.ID, target.URL+"/hooks", false)
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != 200 {
		t.Fatalf("expected 200, got %d (%s)", res.StatusCode, res.Error)
	}

	if gotBody != rec.Body {
		t.Errorf("replayed body mismatch:\n got: %s\nwant: %s", gotBody, rec.Body)
	}
	if gotHeaders.Get("X-Flexprice-Key") != "abc" {
		t.Errorf("custom header should survive replay, got %q", gotHeaders.Get("X-Flexprice-Key"))
	}
	for _, k := range []string{"Connection", "svix-id", "svix-timestamp", "svix-signature"} {
		if gotHeaders.Get(k) != "" {
			t.Errorf("header %q should be stripped on replay, got %q", k, gotHeaders.Get(k))
		}
	}
	if gotHeaders.Get("Content-Type") != "application/json" {
		t.Errorf("content-type should survive replay, got %q", gotHeaders.Get("Content-Type"))
	}

	// Replay history must be recorded on the event.
	updated, err := store.Get(rec.ID)
	if err != nil {
		t.Fatal(err)
	}
	if updated.ReplayCount != 1 {
		t.Fatalf("expected ReplayCount 1, got %d", updated.ReplayCount)
	}
	if len(updated.Replays) != 1 {
		t.Fatalf("expected 1 replay record, got %d", len(updated.Replays))
	}
	if !strings.Contains(updated.Replays[0].TargetURL, "/hooks") {
		t.Errorf("replay target url mismatch: %q", updated.Replays[0].TargetURL)
	}
}

func TestEventInspectorReplayPreserveSvixHeaders(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "ws")
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	store := eventinspector.NewStore(dir)

	rec, err := store.Append(models.EventRecord{
		Method:      "POST",
		SourceURL:   "/hooks",
		ContentType: "application/json",
		Headers: map[string]string{
			"svix-id":        "msg_preserve_1",
			"svix-timestamp": "1700000000",
			"svix-signature": "v1,deadbeef",
		},
		Body: `{}`,
	})
	if err != nil {
		t.Fatal(err)
	}

	var gotHeaders http.Header
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotHeaders = r.Header.Clone()
		w.WriteHeader(204)
	}))
	defer target.Close()

	a := &App{eventInspector: store, cookies: cookiestore.New(dir)}
	res, err := a.EventInspectorReplay(rec.ID, target.URL+"/hooks", true)
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != 204 {
		t.Fatalf("expected 204, got %d", res.StatusCode)
	}
	if gotHeaders.Get("svix-id") != "msg_preserve_1" {
		t.Errorf("preserveSvix should keep svix-id, got %q", gotHeaders.Get("svix-id"))
	}
	if gotHeaders.Get("svix-signature") != "v1,deadbeef" {
		t.Errorf("preserveSvix should keep svix-signature, got %q", gotHeaders.Get("svix-signature"))
	}
}
