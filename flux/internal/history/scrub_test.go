package history

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/zalando/go-keyring"

	"flux/internal/models"
)

// TestOAuthSecretsNeverReachHistoryFile: the send path appends the payload
// (with live tokens) to history; the on-disk history file must be scrubbed.
func TestOAuthSecretsNeverReachHistoryFile(t *testing.T) {
	keyring.MockInit()

	dir := t.TempDir()
	s := NewStore(dir)

	payload := models.RequestPayload{
		Method:    "GET",
		URL:       "https://api.github.com/user",
		AuthType:  "oauth2",
		AuthValue: `{"accessToken":"hist-secret","refreshToken":"hist-refresh","tokenType":"Bearer","tokenUrl":"https://github.com/login/oauth/access_token"}`,
	}
	if err := s.Append(payload, models.ResponseResult{StatusCode: 200}); err != nil {
		t.Fatal(err)
	}

	raw, err := os.ReadFile(filepath.Join(dir, "history.json"))
	if err != nil {
		t.Fatal(err)
	}
	text := string(raw)
	for _, secret := range []string{"hist-secret", "hist-refresh"} {
		if strings.Contains(text, secret) {
			t.Errorf("secret %q written to history file", secret)
		}
	}
	if !strings.Contains(text, "tokenRef") {
		t.Error("history file should carry a tokenRef")
	}
}
