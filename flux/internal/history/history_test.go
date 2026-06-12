package history

import (
	"os"
	"testing"

	"flux/internal/models"
)

func newTestStore(t *testing.T) *Store {
	t.Helper()
	dir, err := os.MkdirTemp("", "flux-history-test-*")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.RemoveAll(dir) })
	return NewStore(dir)
}

func TestAppendAndGetAll(t *testing.T) {
	s := newTestStore(t)
	payload := models.RequestPayload{Method: "GET", URL: "https://example.com"}
	resp := models.ResponseResult{StatusCode: 200}
	if err := s.Append(payload, resp); err != nil {
		t.Fatal(err)
	}
	entries, err := s.GetAll()
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(entries))
	}
	if entries[0].Payload.Method != "GET" {
		t.Errorf("expected GET method")
	}
	if entries[0].Response.StatusCode != 200 {
		t.Errorf("expected 200 status")
	}
}

func TestAppendMultiple(t *testing.T) {
	s := newTestStore(t)
	for i := 0; i < 3; i++ {
		p := models.RequestPayload{Method: "GET", URL: "https://example.com"}
		r := models.ResponseResult{StatusCode: 200 + i}
		if err := s.Append(p, r); err != nil {
			t.Fatal(err)
		}
	}
	entries, err := s.GetAll()
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 3 {
		t.Fatalf("expected 3 entries, got %d", len(entries))
	}
	// newest first
	if entries[0].Response.StatusCode != 202 {
		t.Errorf("expected newest first, got status %d", entries[0].Response.StatusCode)
	}
}

func TestDeleteEntry(t *testing.T) {
	s := newTestStore(t)
	p := models.RequestPayload{Method: "DELETE"}
	r := models.ResponseResult{StatusCode: 204}
	if err := s.Append(p, r); err != nil {
		t.Fatal(err)
	}
	entries, _ := s.GetAll()
	id := entries[0].ID

	if err := s.DeleteEntry(id); err != nil {
		t.Fatal(err)
	}
	entries, _ = s.GetAll()
	if len(entries) != 0 {
		t.Errorf("expected 0 entries after delete, got %d", len(entries))
	}
}

func TestDeleteEntryNotFound(t *testing.T) {
	s := newTestStore(t)
	// should silently succeed for non-existent IDs
	if err := s.DeleteEntry("non-existent-id"); err != nil {
		t.Errorf("expected no error, got %v", err)
	}
}

func TestUpdateEntryFavorite(t *testing.T) {
	s := newTestStore(t)
	if err := s.Append(models.RequestPayload{}, models.ResponseResult{}); err != nil {
		t.Fatal(err)
	}
	entries, _ := s.GetAll()
	id := entries[0].ID

	if err := s.UpdateEntry(id, map[string]interface{}{"favorite": true}); err != nil {
		t.Fatal(err)
	}
	entries, _ = s.GetAll()
	if !entries[0].Favorite {
		t.Errorf("expected favorite=true after update")
	}
}

func TestUpdateEntryTags(t *testing.T) {
	s := newTestStore(t)
	if err := s.Append(models.RequestPayload{}, models.ResponseResult{}); err != nil {
		t.Fatal(err)
	}
	entries, _ := s.GetAll()
	id := entries[0].ID

	tags := []string{"tag1", "tag2"}
	if err := s.UpdateEntry(id, map[string]interface{}{"tags": tags}); err != nil {
		t.Fatal(err)
	}
	entries, _ = s.GetAll()
	if len(entries[0].Tags) != 2 || entries[0].Tags[0] != "tag1" {
		t.Errorf("unexpected tags: %v", entries[0].Tags)
	}
}

func TestUpdateEntryNotFound(t *testing.T) {
	s := newTestStore(t)
	// should silently succeed for non-existent IDs
	if err := s.UpdateEntry("bad-id", map[string]interface{}{"favorite": true}); err != nil {
		t.Errorf("expected no error, got %v", err)
	}
}

func TestClear(t *testing.T) {
	s := newTestStore(t)
	for i := 0; i < 5; i++ {
		s.Append(models.RequestPayload{}, models.ResponseResult{})
	}
	if err := s.Clear(); err != nil {
		t.Fatal(err)
	}
	entries, _ := s.GetAll()
	if len(entries) != 0 {
		t.Errorf("expected 0 entries after clear, got %d", len(entries))
	}
}

func TestCapEnforced(t *testing.T) {
	s := newTestStore(t)
	for i := 0; i < Cap+10; i++ {
		payload := models.RequestPayload{Method: "GET", URL: "https://example.com"}
		resp := models.ResponseResult{StatusCode: 200}
		s.Append(payload, resp)
	}
	entries, _ := s.GetAll()
	if len(entries) > Cap {
		t.Errorf("entries exceed cap: %d > %d", len(entries), Cap)
	}
	if len(entries) != Cap {
		t.Errorf("expected exactly %d entries, got %d", Cap, len(entries))
	}
}

func TestPersistence(t *testing.T) {
	dir, err := os.MkdirTemp("", "flux-history-persist-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(dir)

	s1 := NewStore(dir)
	s1.Append(models.RequestPayload{Method: "GET", URL: "https://persist.com"}, models.ResponseResult{StatusCode: 200})

	s2 := NewStore(dir)
	entries, err := s2.GetAll()
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 {
		t.Fatalf("expected 1 entry from reload, got %d", len(entries))
	}
	if entries[0].Payload.URL != "https://persist.com" {
		t.Errorf("URL mismatch after reload")
	}
}
