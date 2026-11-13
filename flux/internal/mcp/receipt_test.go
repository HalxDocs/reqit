package mcp

import (
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"flux/internal/collections"
	"flux/internal/models"
)

// TestRunCollectionWritesAReceipt exercises the MCP surface end to end: a real
// tool handler, a real collection, a real HTTP request — and a receipt that
// describes the templated request without holding the secret.
func TestRunCollectionWritesAReceipt(t *testing.T) {
	const sentinel = "sk_live_MCP_MUST_NOT_LEAK_123"

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		io.WriteString(w, `{"ok":true}`)
	}))
	defer srv.Close()

	ws := newWorkspace(t)
	coll := seedCollection(t, ws, "MCP receipts")
	store := collections.NewStore(ws)
	_, err := store.AddRequest(coll.ID, "Fetch", models.RequestPayload{
		Method: "GET",
		URL:    srv.URL + "/data?id=" + sentinel + "&page=2",
		Origin: &models.RequestOrigin{
			URL:        srv.URL + "/data?id={{ITEM_ID}}&page=2",
			VarSources: map[string]string{"ITEM_ID": "environment"},
		},
	})
	if err != nil {
		t.Fatalf("AddRequest: %v", err)
	}

	out := call(t, handleRunCollection(ws), map[string]any{"name": "MCP receipts"})
	if !strings.Contains(out, "1 passed, 0 failed") {
		t.Fatalf("collection did not pass: %s", out)
	}

	files, err := filepath.Glob(filepath.Join(ws, ".reqit", "runs", "*.json"))
	if err != nil || len(files) != 1 {
		t.Fatalf("want one receipt, got %v (%v)", files, err)
	}
	data, err := os.ReadFile(files[0])
	if err != nil {
		t.Fatal(err)
	}
	body := string(data)
	if !strings.Contains(body, `"source": "mcp"`) {
		t.Errorf("receipt does not name the MCP source: %s", body)
	}
	if !strings.Contains(body, "{{ITEM_ID}}") {
		t.Errorf("receipt lost the templated request: %s", body)
	}
	if strings.Contains(body, sentinel) {
		t.Errorf("the secret reached the MCP receipt: %s", body)
	}
	if !strings.Contains(body, "page=2") {
		t.Errorf("safe query values were lost: %s", body)
	}
}
