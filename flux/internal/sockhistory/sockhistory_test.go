package sockhistory

import (
	"os"
	"testing"

	"flux/internal/models"
)

func newTestStore(t *testing.T) *Store {
	t.Helper()
	dir, err := os.MkdirTemp("", "flux-sockhistory-test-*")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.RemoveAll(dir) })
	return NewStore(dir)
}

func TestAppendAndGetAll(t *testing.T) {
	s := newTestStore(t)
	entry, err := s.Append("ws://localhost:8080", "ws", map[string]string{"Origin": "http://localhost"})
	if err != nil {
		t.Fatal(err)
	}
	sessions, err := s.GetAll()
	if err != nil {
		t.Fatal(err)
	}
	if len(sessions) != 1 {
		t.Fatalf("expected 1 session, got %d", len(sessions))
	}
	if sessions[0].URL != "ws://localhost:8080" {
		t.Errorf("expected URL to match")
	}
	if sessions[0].Protocol != "ws" {
		t.Errorf("expected ws protocol")
	}
	if sessions[0].ID != entry.ID {
		t.Errorf("expected same id")
	}
}

func TestAppendNewestFirst(t *testing.T) {
	s := newTestStore(t)
	_, _ = s.Append("ws://one", "ws", nil)
	_, _ = s.Append("ws://two", "sse", nil)
	sessions, _ := s.GetAll()
	if len(sessions) != 2 {
		t.Fatalf("expected 2 sessions, got %d", len(sessions))
	}
	if sessions[0].URL != "ws://two" {
		t.Errorf("expected newest first, got %s", sessions[0].URL)
	}
}

func TestUpdateMessages(t *testing.T) {
	s := newTestStore(t)
	entry, _ := s.Append("ws://localhost:8080", "ws", nil)
	msgs := []models.SocketMessage{
		{Direction: "sent", Body: "hello"},
		{Direction: "received", Body: "world"},
	}
	if err := s.UpdateMessages(entry.ID, msgs); err != nil {
		t.Fatal(err)
	}
	sessions, _ := s.GetAll()
	if len(sessions[0].Messages) != 2 {
		t.Fatalf("expected 2 messages, got %d", len(sessions[0].Messages))
	}
	if sessions[0].Messages[1].Body != "world" {
		t.Errorf("expected world body")
	}
}

func TestUpdateMessagesNotFound(t *testing.T) {
	s := newTestStore(t)
	if err := s.UpdateMessages("nope", []models.SocketMessage{}); err != nil {
		t.Errorf("expected no error for missing session, got %v", err)
	}
}

func TestDelete(t *testing.T) {
	s := newTestStore(t)
	entry, _ := s.Append("ws://localhost:8080", "ws", nil)
	if err := s.Delete(entry.ID); err != nil {
		t.Fatal(err)
	}
	sessions, _ := s.GetAll()
	if len(sessions) != 0 {
		t.Errorf("expected 0 sessions after delete, got %d", len(sessions))
	}
}

func TestClear(t *testing.T) {
	s := newTestStore(t)
	for i := 0; i < 5; i++ {
		_, _ = s.Append("ws://localhost:8080", "ws", nil)
	}
	if err := s.Clear(); err != nil {
		t.Fatal(err)
	}
	sessions, _ := s.GetAll()
	if len(sessions) != 0 {
		t.Errorf("expected 0 sessions after clear, got %d", len(sessions))
	}
}

func TestCapEnforced(t *testing.T) {
	s := newTestStore(t)
	for i := 0; i < Cap+10; i++ {
		_, _ = s.Append("ws://localhost:8080", "ws", nil)
	}
	sessions, _ := s.GetAll()
	if len(sessions) != Cap {
		t.Errorf("expected exactly %d sessions, got %d", Cap, len(sessions))
	}
}

func TestPersistence(t *testing.T) {
	dir, err := os.MkdirTemp("", "flux-sockhistory-persist-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(dir)

	s1 := NewStore(dir)
	_, _ = s1.Append("ws://persist.com", "ws", nil)

	s2 := NewStore(dir)
	sessions, err := s2.GetAll()
	if err != nil {
		t.Fatal(err)
	}
	if len(sessions) != 1 {
		t.Fatalf("expected 1 session from reload, got %d", len(sessions))
	}
	if sessions[0].URL != "ws://persist.com" {
		t.Errorf("URL mismatch after reload")
	}
}
