package oauth2

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"
)

// TestGitHubDeviceFlowSmoke is a live smoke against GitHub's real RFC 8628
// device endpoints. Acceptance criteria:
//   - device start returns device_code / user_code / verification_uri /
//     interval from the real /login/device/code endpoint
//   - every poll comes back authorization_pending (or slow_down) without any
//     token — GitHub never issues refresh tokens, so the engine must treat
//     each pending response as a clean non-error state, never assuming a
//     token (or refresh token) is present
//
// The interactive auth-code login cannot be automated against GitHub (no test
// accounts, CAPTCHA), so the device flow is the live stand-in: it exercises
// GitHub's real token endpoint and the same no-refresh-token contract. Needs
// only a registered OAuth app's client id — no secret, no browser.
func TestGitHubDeviceFlowSmoke(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping GitHub smoke in -short mode")
	}
	clientID := os.Getenv("TEST_GITHUB_CLIENT_ID")
	if clientID == "" {
		t.Skip("TEST_GITHUB_CLIENT_ID not set — register a GitHub OAuth app (device flow needs only the client id)")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	cfg := OAuthConfig{
		GrantType: GrantDeviceCode,
		DeviceURL: "https://github.com/login/device/code",
		TokenURL:  "https://github.com/login/oauth/access_token",
		ClientID:  clientID,
	}

	start, err := StartDevice(ctx, cfg, "")
	if err != nil {
		t.Fatalf("device start: %v", err)
	}
	if start.DeviceCode == "" || start.UserCode == "" || start.VerificationURI == "" {
		t.Fatalf("device start missing fields: %+v", start)
	}
	if !strings.Contains(start.VerificationURI, "github.com/login/device") {
		t.Errorf("unexpected verification URI %q", start.VerificationURI)
	}
	if start.Interval < 1 {
		t.Errorf("interval should be positive, got %d", start.Interval)
	}
	t.Logf("device flow started: verification_uri=%s interval=%ds", start.VerificationURI, start.Interval)

	// The user never approves in CI, so each poll must come back pending —
	// each one proves the engine parses GitHub's real error-in-200 responses
	// (RFC 8628 says 400; GitHub answers 200 with error=authorization_pending)
	// without requiring a token or erroring on a missing refresh token.
	seenPending := false
	for i := 0; i < 3; i++ {
		if i > 0 {
			time.Sleep(time.Duration(start.Interval) * time.Second)
		}
		poll, err := PollDevice(ctx, cfg, "", start.DeviceCode)
		if err != nil {
			t.Fatalf("device poll %d: %v", i+1, err)
		}
		switch poll.Status {
		case DevicePollPending:
			seenPending = true
		case DevicePollSlowDown:
			// Polled faster than GitHub's interval — still a clean non-error.
		case DevicePollSuccess:
			t.Log("device flow approved out-of-band; success is acceptable but unexpected in CI")
			return
		default:
			t.Fatalf("device poll %d: status=%s error=%v", i+1, poll.Status, poll.Error)
		}
	}
	if !seenPending {
		t.Error("expected at least one authorization_pending poll")
	}
}

// TestGitHubDeviceFlowManualApproval is the interactive extension of the device
// flow smoke: when TEST_GITHUB_WAIT_APPROVAL is set, it starts a real RFC 8628
// flow against GitHub, prints the verification URI, and polls until a human
// approves it in a browser. On success it asserts the acceptance criterion
// that GitHub OAuth apps never issue a refresh token. Run with -v so the
// verification URI is visible:
//
//	TEST_GITHUB_CLIENT_ID=<id> TEST_GITHUB_WAIT_APPROVAL=1 \
//	  go test ./internal/oauth2/ -run GitHubDeviceFlowManualApproval -v
func TestGitHubDeviceFlowManualApproval(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping GitHub smoke in -short mode")
	}
	clientID := os.Getenv("TEST_GITHUB_CLIENT_ID")
	if clientID == "" {
		t.Skip("TEST_GITHUB_CLIENT_ID not set — register a GitHub OAuth app (device flow needs only the client id)")
	}
	if os.Getenv("TEST_GITHUB_WAIT_APPROVAL") == "" {
		t.Skip("TEST_GITHUB_WAIT_APPROVAL not set — manual-approval mode is opt-in (CI polls only pending)")
	}

	// GitHub device codes expire after 15 minutes; give the human room to
	// open the browser, sign in, and approve without racing the deadline.
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()
	cfg := OAuthConfig{
		GrantType: GrantDeviceCode,
		DeviceURL: "https://github.com/login/device/code",
		TokenURL:  "https://github.com/login/oauth/access_token",
		ClientID:  clientID,
	}

	start, err := StartDevice(ctx, cfg, "")
	if err != nil {
		t.Fatalf("device start: %v", err)
	}
	t.Logf("==============================================")
	t.Logf("Approve the device flow in your browser:")
	t.Logf("  %s", start.VerificationURI)
	t.Logf("  user code: %s", start.UserCode)
	deadline, _ := ctx.Deadline()
	t.Logf("Polling every %ds until approved (or %s).",
		start.Interval, deadline.Format("15:04:05"))
	t.Logf("==============================================")

	interval := start.Interval
	if interval < 1 {
		interval = 5
	}
	for {
		select {
		case <-ctx.Done():
			t.Fatalf("timed out waiting for manual device approval: %v", ctx.Err())
		default:
		}
		time.Sleep(time.Duration(interval) * time.Second)

		poll, err := PollDevice(ctx, cfg, "", start.DeviceCode)
		if err != nil {
			t.Fatalf("device poll: %v", err)
		}
		switch poll.Status {
		case DevicePollSuccess:
			if poll.Token == nil || poll.Token.AccessToken == "" {
				t.Fatal("device flow approved but no access token returned")
			}
			// GitHub's classic OAuth apps never issue a refresh token; the
			// engine must surface the token without one and without error.
			if poll.Token.RefreshToken != "" {
				t.Errorf("GitHub never issues refresh tokens, got one: %q", poll.Token.RefreshToken)
			}
			t.Logf("approved — access token issued (%.16s…), no refresh token (as expected)",
				poll.Token.AccessToken)
			return
		case DevicePollPending:
			t.Logf("pending… still waiting for approval")
		case DevicePollSlowDown:
			interval += 5 // RFC 8628 §3.5: slow_down means increase the poll interval
			t.Logf("slow_down — backing off to %ds", interval)
		case DevicePollDenied, DevicePollExpired:
			desc := ""
			if poll.Error != nil {
				desc = poll.Error.Description
			}
			t.Fatalf("device flow %s: %s", poll.Status, desc)
		default:
			desc := ""
			if poll.Error != nil {
				desc = poll.Error.Description
			}
			t.Fatalf("device poll failed (%s): %s", poll.Status, desc)
		}
	}
}

// TestGitHubNoRefreshTokenRequired is the deterministic half of the GitHub
// acceptance criterion and runs everywhere (no GitHub access needed): a
// successful exchange whose response omits refresh_token — classic GitHub
// OAuth apps never issue one — yields a usable token with an empty
// RefreshToken, and GitHub's form-encoded token response (no expires_in)
// parses without error.
func TestGitHubNoRefreshTokenRequired(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
		}
		// GitHub's token endpoint answers form-encoded; classic OAuth apps
		// return access_token + token_type + scope and no refresh_token.
		w.Header().Set("Content-Type", "application/x-www-form-urlencoded")
		_, _ = fmt.Fprintf(w, "access_token=gho_dummy&token_type=bearer&scope=repo")
	}))
	defer srv.Close()

	cfg := OAuthConfig{
		GrantType:   GrantAuthorizationCode,
		TokenURL:    srv.URL,
		ClientID:    "reqit-github-test",
		RedirectURI: "http://127.0.0.1:7317/callback",
	}
	tr, err := Exchange(context.Background(), cfg, ExchangeOptions{
		Code:        "github-code",
		RedirectURI: cfg.RedirectURI,
	})
	if err != nil {
		t.Fatalf("exchange: %v", err)
	}
	if tr.AccessToken != "gho_dummy" {
		t.Errorf("access token = %q", tr.AccessToken)
	}
	if tr.RefreshToken != "" {
		t.Errorf("no refresh token expected (GitHub classic apps issue none), got %q", tr.RefreshToken)
	}
	if tr.TokenType != "bearer" {
		t.Errorf("token type = %q", tr.TokenType)
	}
	if tr.ExpiresAtMs != 0 {
		t.Errorf("no expires_in sent — ExpiresAtMs should be 0, got %d", tr.ExpiresAtMs)
	}
}
