package collections

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/zalando/go-keyring"

	"flux/internal/models"
	"flux/internal/oauth2"
)

// TestOAuthSecretsNeverReachDisk: saving a request whose OAuth2 authValue
// embeds tokens must write a secret-free collection file (config + tokenRef
// only) and put the tokens in the keychain, while the in-memory copy keeps
// the token for the current session.
func TestOAuthSecretsNeverReachDisk(t *testing.T) {
	keyring.MockInit()

	dir := t.TempDir()
	s := NewStore(dir)

	c, err := s.CreateCollection("sec")
	if err != nil {
		t.Fatal(err)
	}
	payload := models.RequestPayload{
		Method:    "GET",
		URL:       "https://api.github.com/user",
		AuthType:  "oauth2",
		AuthValue: `{"accessToken":"disk-secret","refreshToken":"disk-refresh","expiresAt":1700000000,"tokenType":"Bearer","authUrl":"https://github.com/login/oauth/authorize","tokenUrl":"https://github.com/login/oauth/access_token","clientId":"c1","scopes":"repo","redirectUri":"http://127.0.0.1:7317/callback","usePkce":true}`,
	}
	if _, err := s.AddRequest(c.ID, "r", payload); err != nil {
		t.Fatal(err)
	}

	col := readCollectionFile(t, dir, c.ID)
	authVal := col.Requests[0].Payload.AuthValue
	blob := parseBlob(t, authVal)
	for _, secret := range []string{"disk-secret", "disk-refresh"} {
		if strings.Contains(authVal, secret) {
			t.Errorf("secret %q written to collection file", secret)
		}
	}
	ref, _ := blob["tokenRef"].(string)
	if !strings.HasPrefix(ref, "tok_") {
		t.Fatalf("sanitized blob should carry a tokenRef, got %v", blob["tokenRef"])
	}
	if blob["clientId"] != "c1" || blob["tokenUrl"] != "https://github.com/login/oauth/access_token" {
		t.Errorf("config fields should round-trip to disk: %v", blob)
	}

	// In-memory copy keeps the token so the live session keeps working.
	cols, err := s.GetAll()
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(cols[0].Requests[0].Payload.AuthValue, "disk-secret") {
		t.Error("in-memory payload should keep the token for the session")
	}

	// The token landed in the keychain, keyed by provider host.
	rec, err := oauth2.LoadToken(oauth2.WorkspaceKeyFromDir(dir), ref, "github.com")
	if err != nil {
		t.Fatalf("token not in keychain: %v", err)
	}
	if rec.AccessToken != "disk-secret" {
		t.Errorf("keychain token = %q", rec.AccessToken)
	}
	if rec.ExpiresAtMs != 1700000000000 {
		t.Errorf("expiry should be ms, got %d", rec.ExpiresAtMs)
	}
}

// TestOAuthSecretsMigratedOnLoad: a pre-existing file with inline tokens is
// migrated to the keychain and rewritten without secrets when the store loads.
func TestOAuthSecretsMigratedOnLoad(t *testing.T) {
	keyring.MockInit()

	dir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(dir, "collections"), 0o755); err != nil {
		t.Fatal(err)
	}

	// Hand-craft a legacy collection file with inline tokens.
	legacy := `{
  "id": "legacy-1",
  "name": "legacy",
  "requests": [
    {
      "id": "req-1",
      "name": "r",
      "collectionId": "legacy-1",
      "createdAt": "2026-01-01T00:00:00Z",
      "payload": {
        "method": "GET",
        "url": "https://api.github.com/user",
        "authType": "oauth2",
        "authValue": "{\"accessToken\":\"legacy-secret\",\"refreshToken\":\"legacy-refresh\",\"expiresAt\":1700000000,\"tokenType\":\"Bearer\",\"tokenUrl\":\"https://github.com/login/oauth/access_token\"}"
      }
    }
  ]
}`
	if err := os.WriteFile(filepath.Join(dir, "collections", "legacy-1.json"), []byte(legacy), 0o644); err != nil {
		t.Fatal(err)
	}
	// Minimal index so the store can find the collection.
	if err := os.WriteFile(filepath.Join(dir, "collections", "index.json"), []byte(`{"collections":[{"id":"legacy-1","name":"legacy","order":0,"updatedAt":"2026-01-01T00:00:00Z"}]}`), 0o644); err != nil {
		t.Fatal(err)
	}

	s := NewStore(dir)
	cols, err := s.GetAll()
	if err != nil {
		t.Fatal(err)
	}
	if len(cols) != 1 || len(cols[0].Requests) != 1 {
		t.Fatalf("unexpected load: %+v", cols)
	}

	// Migration rewrites the file without secrets.
	col := readCollectionFile(t, dir, "legacy-1")
	authVal := col.Requests[0].Payload.AuthValue
	if strings.Contains(authVal, "legacy-secret") {
		t.Error("legacy file still contains the token after migration")
	}
	ref := oauth2TokenRef(t, authVal)

	// Token is in the keychain, and the in-memory payload is scrubbed too.
	rec, err := oauth2.LoadToken(oauth2.WorkspaceKeyFromDir(dir), ref, "github.com")
	if err != nil {
		t.Fatalf("migrated token not in keychain: %v", err)
	}
	if rec.AccessToken != "legacy-secret" {
		t.Errorf("migrated token = %q", rec.AccessToken)
	}
	if strings.Contains(cols[0].Requests[0].Payload.AuthValue, "legacy-secret") {
		t.Error("in-memory payload should be scrubbed after load migration")
	}
}

// TestRawTokenOAuthScrubbedFromDisk: Postman imports can store the raw access
// token in AuthValue (non-JSON); it must be migrated to the keychain and never
// reach the collection file in plaintext.
func TestRawTokenOAuthScrubbedFromDisk(t *testing.T) {
	keyring.MockInit()

	dir := t.TempDir()
	s := NewStore(dir)
	c, err := s.CreateCollection("sec")
	if err != nil {
		t.Fatal(err)
	}
	payload := models.RequestPayload{
		Method:    "GET",
		URL:       "https://api.github.com/user",
		AuthType:  "oauth2",
		AuthValue: "gho_raw_secret",
	}
	if _, err := s.AddRequest(c.ID, "r", payload); err != nil {
		t.Fatal(err)
	}

	authVal := readCollectionFile(t, dir, c.ID).Requests[0].Payload.AuthValue
	if strings.Contains(authVal, "gho_raw_secret") {
		t.Error("raw token written to collection file")
	}
	ref := oauth2TokenRef(t, authVal)
	rec, err := oauth2.LoadToken(oauth2.WorkspaceKeyFromDir(dir), ref, "unknown")
	if err != nil {
		t.Fatalf("raw token not in keychain: %v", err)
	}
	if rec.AccessToken != "gho_raw_secret" {
		t.Errorf("keychain token = %q", rec.AccessToken)
	}
}

// TestClientSecretNeverReachesDisk: a confidential client's secret is stored
// in the keychain, never in the collection file.
func TestClientSecretNeverReachesDisk(t *testing.T) {
	keyring.MockInit()

	dir := t.TempDir()
	s := NewStore(dir)
	c, err := s.CreateCollection("sec")
	if err != nil {
		t.Fatal(err)
	}
	payload := models.RequestPayload{
		Method:    "POST",
		URL:       "https://api.example.com/token",
		AuthType:  "oauth2",
		AuthValue: `{"clientSecret":"client-super-secret","clientId":"conf-1","tokenUrl":"https://api.example.com/oauth/token"}`,
	}
	if _, err := s.AddRequest(c.ID, "r", payload); err != nil {
		t.Fatal(err)
	}

	authVal := readCollectionFile(t, dir, c.ID).Requests[0].Payload.AuthValue
	if strings.Contains(authVal, "client-super-secret") {
		t.Error("client secret written to collection file")
	}
	ref := oauth2TokenRef(t, authVal)
	secret, err := oauth2.LoadClientSecret(oauth2.WorkspaceKeyFromDir(dir), ref, "api.example.com")
	if err != nil {
		t.Fatalf("client secret not in keychain: %v", err)
	}
	if secret != "client-super-secret" {
		t.Errorf("keychain client secret = %q", secret)
	}
}

// --- helpers ---------------------------------------------------------------

func readCollectionFile(t *testing.T, dir, id string) models.Collection {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join(dir, "collections", id+".json"))
	if err != nil {
		t.Fatal(err)
	}
	var col models.Collection
	if err := json.Unmarshal(raw, &col); err != nil {
		t.Fatal(err)
	}
	if len(col.Requests) != 1 {
		t.Fatalf("expected 1 request, got %d", len(col.Requests))
	}
	return col
}

func parseBlob(t *testing.T, authValue string) map[string]any {
	t.Helper()
	m := map[string]any{}
	if err := json.Unmarshal([]byte(authValue), &m); err != nil {
		t.Fatalf("parse authValue %q: %v", authValue, err)
	}
	return m
}

func oauth2TokenRef(t *testing.T, authValue string) string {
	t.Helper()
	ref, _ := parseBlob(t, authValue)["tokenRef"].(string)
	if !strings.HasPrefix(ref, "tok_") {
		t.Fatalf("tokenRef missing from blob: %s", authValue)
	}
	return ref
}
