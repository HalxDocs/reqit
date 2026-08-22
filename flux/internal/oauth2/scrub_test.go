package oauth2

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/zalando/go-keyring"
)

const legacyBlob = `{"accessToken":"at-secret","refreshToken":"rt-secret","expiresAt":1700000000,"tokenType":"Bearer","authUrl":"https://github.com/login/oauth/authorize","tokenUrl":"https://github.com/login/oauth/access_token","clientId":"client-1","scopes":"repo user","redirectUri":"http://127.0.0.1:7317/callback","usePkce":true}`

func blobMap(t *testing.T, s string) map[string]any {
	t.Helper()
	m := map[string]any{}
	if err := json.Unmarshal([]byte(s), &m); err != nil {
		t.Fatal(err)
	}
	return m
}

// TestMigrateAuthValueMovesSecrets: tokens leave the blob, land in the
// keychain (host-scoped), seconds-based expiry becomes ms, and the config
// fields round-trip untouched.
func TestMigrateAuthValueMovesSecrets(t *testing.T) {
	SetWorkspaceKey("ws-scrub-test")
	defer SetWorkspaceKey("")

	clean, changed, err := MigrateAuthValue(legacyBlob, "")
	if err != nil {
		t.Fatal(err)
	}
	if !changed {
		t.Fatal("expected changed=true")
	}
	if strings.Contains(clean, "at-secret") || strings.Contains(clean, "rt-secret") {
		t.Fatalf("secrets leaked into sanitized blob: %s", clean)
	}

	m := blobMap(t, clean)
	if m["clientId"] != "client-1" || m["scopes"] != "repo user" || m["usePkce"] != true {
		t.Errorf("config fields lost: %v", m)
	}
	if m["tokenUrl"] != "https://github.com/login/oauth/access_token" {
		t.Errorf("tokenUrl lost: %v", m)
	}
	ref, _ := m["tokenRef"].(string)
	if ref == "" || !strings.HasPrefix(ref, "tok_") {
		t.Fatalf("tokenRef missing/malformed: %v", m)
	}

	rec, err := LoadToken("", ref, "github.com")
	if err != nil {
		t.Fatal(err)
	}
	if rec.AccessToken != "at-secret" || rec.RefreshToken != "rt-secret" {
		t.Errorf("keychain record mismatch: %+v", rec)
	}
	if rec.ExpiresAtMs != 1700000000000 {
		t.Errorf("expiresAt should convert seconds→ms, got %d", rec.ExpiresAtMs)
	}
}

// TestMigrateAuthValuePreservesTokenRef: re-migrating keeps the same ref so
// saves don't pile up keychain entries.
func TestMigrateAuthValuePreservesTokenRef(t *testing.T) {
	SetWorkspaceKey("ws-scrub-test")
	defer SetWorkspaceKey("")

	clean1, _, err := MigrateAuthValue(legacyBlob, "")
	if err != nil {
		t.Fatal(err)
	}
	// Simulate a second save of the same (now clean) payload.
	clean2, changed, err := MigrateAuthValue(clean1, "")
	if err != nil {
		t.Fatal(err)
	}
	if changed {
		t.Error("re-migrating a clean blob should be a no-op")
	}
	if clean1 != clean2 {
		t.Error("clean blob should round-trip unchanged")
	}
	m := blobMap(t, clean1)
	ref1, _ := m["tokenRef"].(string)

	// A blob that already carries a tokenRef keeps it.
	withRef := `{"tokenRef":"` + ref1 + `","accessToken":"new-token","tokenUrl":"https://github.com/login/oauth/access_token"}`
	clean3, changed, err := MigrateAuthValue(withRef, "")
	if err != nil || !changed {
		t.Fatalf("migrate with existing ref: changed=%v err=%v", changed, err)
	}
	if got := blobMap(t, clean3)["tokenRef"]; got != ref1 {
		t.Errorf("tokenRef changed: got %v want %s", got, ref1)
	}
}

// TestMigrateAuthValueKeychainFailure: on keychain failure the blob is left
// untouched (secrets preserved) and the error is surfaced.
func TestMigrateAuthValueKeychainFailure(t *testing.T) {
	keyring.MockInitWithError(errors.New("no secret service"))
	defer keyring.MockInit()

	clean, changed, err := MigrateAuthValue(legacyBlob, "ws")
	if err == nil {
		t.Fatal("expected error when keychain is unavailable")
	}
	if changed {
		t.Error("blob should be unchanged on keychain failure")
	}
	if clean != legacyBlob {
		t.Error("secrets must not be dropped when they cannot be stored")
	}
}

// TestStripAuthValue: strips secrets without any keychain access (used by the
// save path when the keychain is unavailable).
func TestStripAuthValue(t *testing.T) {
	blob := `{"accessToken":"a","refreshToken":"r","clientSecret":"s","tokenUrl":"https://x/token","authUrl":"https://x/auth"}`
	stripped, ok := StripAuthValue(blob)
	if !ok {
		t.Fatal("expected change")
	}
	for _, secret := range []string{"\"accessToken\"", "\"refreshToken\"", "\"clientSecret\"", "a\"", "r\"", "s\""} {
		if strings.Contains(stripped, secret) {
			t.Errorf("secret %s still present: %s", secret, stripped)
		}
	}
	m := blobMap(t, stripped)
	if m["tokenUrl"] != "https://x/token" {
		t.Errorf("config lost during strip: %v", m)
	}

	if _, ok := StripAuthValue(`{"tokenUrl":"https://x/token"}`); ok {
		t.Error("blob without secrets should report no change")
	}
	if _, ok := StripAuthValue(""); ok {
		t.Error("empty blob should report no change")
	}
	if _, ok := StripAuthValue("not json"); ok {
		t.Error("unparseable blob should report no change")
	}
}

// TestRehydrateAuthValue: a clean blob with tokenRef gets its token back from
// the keychain (ms expiry), and only when it actually has a ref.
func TestRehydrateAuthValue(t *testing.T) {
	SetWorkspaceKey("ws-rehydrate-test")
	defer SetWorkspaceKey("")

	// Seed the keychain the way migration would.
	clean1, _, err := MigrateAuthValue(legacyBlob, "")
	if err != nil {
		t.Fatal(err)
	}

	out, changed := RehydrateAuthValue(clean1, "")
	if !changed {
		t.Fatal("expected rehydration")
	}
	m := blobMap(t, out)
	if m["accessToken"] != "at-secret" {
		t.Errorf("accessToken not rehydrated: %v", m)
	}
	if m["expiresAt"] != float64(1700000000000) {
		t.Errorf("expiresAt should be rehydrated in ms, got %v", m["expiresAt"])
	}
	if m["refreshToken"] != "rt-secret" {
		t.Errorf("refreshToken not rehydrated: %v", m)
	}

	// Blob already carrying a token → no-op.
	if _, changed := RehydrateAuthValue(legacyBlob, ""); changed {
		t.Error("blob with inline token should not change")
	}
	// Blob without tokenRef → no-op.
	if _, changed := RehydrateAuthValue(`{"tokenUrl":"https://x/token"}`, ""); changed {
		t.Error("blob without tokenRef should not change")
	}
	// Missing keychain entry → no-op.
	if _, changed := RehydrateAuthValue(`{"tokenRef":"tok_nonexistent","tokenUrl":"https://x/token"}`, ""); changed {
		t.Error("unresolvable ref should not change")
	}
	if _, changed := RehydrateAuthValue("", ""); changed {
		t.Error("empty blob should not change")
	}
}

// TestMigrateAuthValueRawToken: Postman imports can store the raw access
// token in AuthValue (non-JSON). It must be migrated to the keychain and the
// blob reduced to a ref-only JSON so it never reaches disk in plaintext.
func TestMigrateAuthValueRawToken(t *testing.T) {
	SetWorkspaceKey("ws-raw-test")
	defer SetWorkspaceKey("")

	clean, changed, err := MigrateAuthValue("gho_123456", "")
	if err != nil || !changed {
		t.Fatalf("changed=%v err=%v", changed, err)
	}
	m := blobMap(t, clean)
	ref, _ := m["tokenRef"].(string)
	if !strings.HasPrefix(ref, "tok_") {
		t.Fatalf("expected a ref-only blob, got %s", clean)
	}
	rec, err := LoadToken("", ref, "unknown")
	if err != nil {
		t.Fatal(err)
	}
	if rec.AccessToken != "gho_123456" {
		t.Errorf("keychain token = %q", rec.AccessToken)
	}

	// Idempotent: re-migrating the clean blob is a no-op.
	if _, changed, err := MigrateAuthValue(clean, ""); err != nil || changed {
		t.Errorf("re-migration should be a no-op: changed=%v err=%v", changed, err)
	}

	// Whitespace-only values are left alone.
	if _, changed, err := MigrateAuthValue("   ", ""); err != nil || changed {
		t.Errorf("whitespace should be a no-op: changed=%v err=%v", changed, err)
	}
}

// TestSanitizeAuthValueForExport: exports must never carry live tokens — JSON
// blobs lose their secrets (config survives), raw tokens are cleared.
func TestSanitizeAuthValueForExport(t *testing.T) {
	blob := `{"accessToken":"at-export","refreshToken":"rt-export","clientId":"c1","tokenUrl":"https://x/token"}`
	out := SanitizeAuthValueForExport(blob)
	if strings.Contains(out, "at-export") || strings.Contains(out, "rt-export") {
		t.Errorf("secrets leaked into export: %s", out)
	}
	if !strings.Contains(out, "clientId") {
		t.Errorf("config lost in export: %s", out)
	}

	clean := `{"tokenRef":"tok_x","clientId":"c1"}`
	if SanitizeAuthValueForExport(clean) != clean {
		t.Error("secret-free JSON blob should be preserved for export")
	}

	if got := SanitizeAuthValueForExport("gho_raw_secret"); got != "" {
		t.Errorf("raw token must never be exported, got %q", got)
	}
	if SanitizeAuthValueForExport("") != "" {
		t.Error("empty authValue should stay empty")
	}
}

// TestMigrateAuthValueStripsClientSecret: a blob carrying a client secret is
// scrubbed the same way as tokens.
func TestMigrateAuthValueStripsClientSecret(t *testing.T) {
	SetWorkspaceKey("ws-scrub-test")
	defer SetWorkspaceKey("")

	blob := `{"clientSecret":"super-secret","clientId":"c","tokenUrl":"https://auth0.example/oauth/token"}`
	clean, changed, err := MigrateAuthValue(blob, "")
	if err != nil || !changed {
		t.Fatalf("changed=%v err=%v", changed, err)
	}
	if strings.Contains(clean, "super-secret") {
		t.Fatalf("clientSecret leaked: %s", clean)
	}
	if m := blobMap(t, clean); m["clientId"] != "c" {
		t.Errorf("clientId lost: %v", m)
	}
}
