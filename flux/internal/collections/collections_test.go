package collections

import (
	"os"
	"testing"

	"flux/internal/models"
)

func newTestStore(t *testing.T) *Store {
	t.Helper()
	dir, err := os.MkdirTemp("", "flux-collections-test-*")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.RemoveAll(dir) })
	return NewStore(dir)
}

func TestEmptyStore(t *testing.T) {
	s := newTestStore(t)
	cols, err := s.GetAll()
	if err != nil {
		t.Fatal(err)
	}
	if len(cols) != 0 {
		t.Errorf("expected empty store, got %d collections", len(cols))
	}
}

func TestCreateCollection(t *testing.T) {
	s := newTestStore(t)
	c, err := s.CreateCollection("Test Collection")
	if err != nil {
		t.Fatal(err)
	}
	if c.Name != "Test Collection" {
		t.Errorf("expected name 'Test Collection', got %q", c.Name)
	}
	if c.ID == "" {
		t.Error("expected non-empty ID")
	}
	if c.Requests == nil {
		t.Error("expected non-nil Requests slice")
	}
}

func TestCreateAndGetAll(t *testing.T) {
	s := newTestStore(t)
	s.CreateCollection("Coll 1")
	s.CreateCollection("Coll 2")
	cols, err := s.GetAll()
	if err != nil {
		t.Fatal(err)
	}
	if len(cols) != 2 {
		t.Fatalf("expected 2 collections, got %d", len(cols))
	}
}

func TestRenameCollection(t *testing.T) {
	s := newTestStore(t)
	c, _ := s.CreateCollection("Original")
	if err := s.RenameCollection(c.ID, "Renamed"); err != nil {
		t.Fatal(err)
	}
	cols, _ := s.GetAll()
	if cols[0].Name != "Renamed" {
		t.Errorf("expected 'Renamed', got %q", cols[0].Name)
	}
}

func TestRenameCollectionNotFound(t *testing.T) {
	s := newTestStore(t)
	err := s.RenameCollection("bad-id", "Whatever")
	if err == nil {
		t.Error("expected error for non-existent collection")
	}
}

func TestDeleteCollection(t *testing.T) {
	s := newTestStore(t)
	c, _ := s.CreateCollection("Delete Me")
	if err := s.DeleteCollection(c.ID); err != nil {
		t.Fatal(err)
	}
	cols, _ := s.GetAll()
	if len(cols) != 0 {
		t.Errorf("expected 0 collections after delete")
	}
}

func TestDeleteCollectionNotFound(t *testing.T) {
	s := newTestStore(t)
	err := s.DeleteCollection("bad-id")
	if err == nil {
		t.Error("expected error")
	}
}

func TestAddRequestToCollection(t *testing.T) {
	s := newTestStore(t)
	c, _ := s.CreateCollection("Coll")
	payload := models.RequestPayload{Method: "GET", URL: "https://example.com"}
	req, err := s.AddRequest(c.ID, "My Request", payload)
	if err != nil {
		t.Fatal(err)
	}
	if req.Name != "My Request" {
		t.Errorf("expected name 'My Request', got %q", req.Name)
	}
	if req.Payload.URL != "https://example.com" {
		t.Errorf("URL mismatch")
	}
	cols, _ := s.GetAll()
	if len(cols[0].Requests) != 1 {
		t.Errorf("expected 1 request in collection")
	}
}

func TestAddRequestToNotFoundCollection(t *testing.T) {
	s := newTestStore(t)
	_, err := s.AddRequest("bad-id", "Req", models.RequestPayload{})
	if err == nil {
		t.Error("expected error")
	}
}

func TestUpdateRequest(t *testing.T) {
	s := newTestStore(t)
	c, _ := s.CreateCollection("Coll")
	req, _ := s.AddRequest(c.ID, "Original", models.RequestPayload{Method: "GET"})

	newPayload := models.RequestPayload{Method: "POST", URL: "https://updated.com"}
	if err := s.UpdateRequest(req.ID, "Updated", newPayload); err != nil {
		t.Fatal(err)
	}
	cols, _ := s.GetAll()
	r := cols[0].Requests[0]
	if r.Name != "Updated" || r.Payload.Method != "POST" {
		t.Errorf("update failed: got %+v", r)
	}
}

func TestUpdateRequestScripts(t *testing.T) {
	s := newTestStore(t)
	c, _ := s.CreateCollection("Coll")
	req, _ := s.AddRequest(c.ID, "Req", models.RequestPayload{})

	vars := []models.PreSetVar{{ID: "v1", Key: "key1", Value: "val1"}}
	rules := []models.ExtractRule{{ID: "r1", Type: "header", Source: "X-Token", Target: "token"}}

	if err := s.UpdateRequestScripts(req.ID, vars, rules); err != nil {
		t.Fatal(err)
	}
	cols, _ := s.GetAll()
	r := cols[0].Requests[0]
	if len(r.PreSetVars) != 1 || r.PreSetVars[0].Key != "key1" {
		t.Errorf("preset vars not updated")
	}
	if len(r.ExtractRules) != 1 || r.ExtractRules[0].Source != "X-Token" {
		t.Errorf("extract rules not updated")
	}
}

func TestDeleteRequest(t *testing.T) {
	s := newTestStore(t)
	c, _ := s.CreateCollection("Coll")
	req, _ := s.AddRequest(c.ID, "To Delete", models.RequestPayload{})
	if err := s.DeleteRequest(req.ID); err != nil {
		t.Fatal(err)
	}
	cols, _ := s.GetAll()
	if len(cols[0].Requests) != 0 {
		t.Errorf("expected 0 requests after delete")
	}
}

func TestSetSpec(t *testing.T) {
	s := newTestStore(t)
	c, _ := s.CreateCollection("Coll")
	if err := s.SetSpec(c.ID, "openapi.yaml"); err != nil {
		t.Fatal(err)
	}
	cols, _ := s.GetAll()
	if cols[0].SpecPath != "openapi.yaml" {
		t.Errorf("expected spec path 'openapi.yaml', got %q", cols[0].SpecPath)
	}
}

func TestSetSavedResponse(t *testing.T) {
	s := newTestStore(t)
	c, _ := s.CreateCollection("Coll")
	req, _ := s.AddRequest(c.ID, "Req", models.RequestPayload{})

	resp := models.SavedResponse{StatusCode: 200, Body: `{"ok":true}`}
	if err := s.SetSavedResponse(c.ID, req.ID, resp); err != nil {
		t.Fatal(err)
	}
	cols, _ := s.GetAll()
	r := cols[0].Requests[0]
	if r.SavedResponse == nil || r.SavedResponse.StatusCode != 200 {
		t.Errorf("saved response not set correctly")
	}
}

func TestSetMockOverride(t *testing.T) {
	s := newTestStore(t)
	c, _ := s.CreateCollection("Coll")
	req, _ := s.AddRequest(c.ID, "Req", models.RequestPayload{})

	mo := models.MockOverride{Enabled: true, StatusCode: 418, DelayMs: 100}
	if err := s.SetMockOverride(c.ID, req.ID, mo); err != nil {
		t.Fatal(err)
	}
	cols, _ := s.GetAll()
	r := cols[0].Requests[0]
	if r.MockOverride == nil || !r.MockOverride.Enabled || r.MockOverride.StatusCode != 418 {
		t.Errorf("mock override not set correctly")
	}
}

func TestPersistence(t *testing.T) {
	dir, err := os.MkdirTemp("", "flux-coll-persist-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(dir)

	s1 := NewStore(dir)
	s1.CreateCollection("Persistent")
	c2, _ := s1.CreateCollection("Coll 2")
	s1.AddRequest(c2.ID, "Req A", models.RequestPayload{Method: "POST"})

	s2 := NewStore(dir)
	cols, err := s2.GetAll()
	if err != nil {
		t.Fatal(err)
	}
	if len(cols) != 2 {
		t.Fatalf("expected 2 collections after reload, got %d", len(cols))
	}
	if len(cols[1].Requests) != 1 {
		t.Errorf("expected 1 request in reloaded collection")
	}
}
