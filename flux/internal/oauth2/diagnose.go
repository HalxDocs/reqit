package oauth2

import (
	"context"
	"fmt"
	"net/http"
	"time"
)

// LoopbackDiagnostics is the result of the one-click browser-to-loopback
// connectivity check. Success means a real HTTP request from the OS default
// browser reached a freshly bound loopback listener — the exact path an OAuth
// callback takes. When it fails, Detail explains what to check (proxy,
// firewall, launcher) rather than leaving the user staring at "This site
// can't be reached".
//
// Findings contains environment pre-flight observations (proxy settings,
// firewall rules, Reason Cybersecurity, IPv6 availability) collected before
// the browser test runs. The UI should display these as a checklist so the
// user can act on specific, actionable items rather than guessing.
type LoopbackDiagnostics struct {
	URL      string       // the test URL that was opened in the browser
	Success  bool         // whether the browser actually connected back
	Detail   string       // human-readable outcome
	Findings []EnvFinding // environment pre-flight observations
}

// defaultDiagnoseTimeout bounds the wait for the browser to connect back.
const defaultDiagnoseTimeout = 12 * time.Second

// DiagnoseLoopback verifies browser → loopback connectivity end to end: it
// binds a fresh ephemeral listener on 127.0.0.1:0 (RFC 8252 §7.3), opens the
// test URL in the OS default browser, and reports whether a request arrived
// before the deadline. This is the exact path an OAuth callback takes, so a
// successful run means loopback sign-in will work; a failure isolates
// proxy/firewall/launcher issues from OAuth configuration problems.
func DiagnoseLoopback(ctx context.Context, timeout time.Duration) (*LoopbackDiagnostics, error) {
	if timeout <= 0 {
		timeout = defaultDiagnoseTimeout
	}
	waitCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	l, err := NewLoopback(LoopbackOptions{})
	if err != nil {
		return nil, err
	}
	defer l.Close()

	testURL := l.URL() + "/diagnose"
	hit := make(chan struct{}, 1)
	go func() { _ = l.Serve(http.HandlerFunc(diagnoseHandler(l.Port(), hit))) }()

	// Run environment pre-flight checks before the browser test.
	env := checkEnvironment()

	if err := OpenURL(testURL); err != nil {
		return &LoopbackDiagnostics{
			URL:      testURL,
			Success:  false,
			Detail:   fmt.Sprintf("The browser could not be launched: %v. Copy the URL and open it manually to retry.", err),
			Findings: env.Findings,
		}, nil
	}

	select {
	case <-hit:
		detail := "The browser reached the loopback listener — OAuth callbacks will work."
		if env.HasWarnings() {
			detail += "\n\nEnvironment notes:\n" + env.SummarizeFindings()
		}
		return &LoopbackDiagnostics{
			URL:      testURL,
			Success:  true,
			Detail:   detail,
			Findings: env.Findings,
		}, nil
	case <-waitCtx.Done():
		// Build a specific failure message incorporating findings.
		detail := "The browser never connected back to the loopback listener."
		if env.HasWarnings() {
			detail += "\n\nThe following issues were detected in your environment:\n\n"
			detail += env.SummarizeFindings()
			detail += "\nAddress the issues above and retry, or try the manual paste-back fallback."
		} else {
			detail += " No proxy or firewall issues were detected. " +
				"The browser may have been blocked by security software or a VPN. " +
				"Try the manual paste-back fallback: copy the authorize URL and paste the redirect URL back."
		}
		return &LoopbackDiagnostics{
			URL:      testURL,
			Success:  false,
			Detail:   detail,
			Findings: env.Findings,
		}, nil
	}
}

// diagnoseHandler serves the test page once and signals that the browser
// connected. Host is hardened exactly like the OAuth callback handler.
func diagnoseHandler(port int, hit chan<- struct{}) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/diagnose" {
			http.NotFound(w, r)
			return
		}
		if !isLoopbackHost(r.Host, port) {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		select {
		case hit <- struct{}{}:
		default:
		}
		writeHTML(w, renderStatusPage("Loopback connectivity verified", "#00D9FF",
			"reqit reached the local loopback listener — OAuth sign-in will work. You can close this tab and return to the app."))
	}
}
