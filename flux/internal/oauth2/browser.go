package oauth2

import (
	"fmt"
	"os/exec"
	"runtime"
)

// openURLFn starts the OS launcher for a URL. Injectable so tests can capture
// the command without spawning a browser.
var openURLFn = func(cmd *exec.Cmd) error { return cmd.Start() }

// OpenURL opens rawURL in the user's OS default browser:
//   - macOS:     open
//   - Windows:   rundll32 url.dll,FileProtocolHandler
//   - Linux/BSD: xdg-open (with gio open / sensible-browser fallback for
//     minimal Fedora installs or Wayland where xdg-open may not be present)
//
// In the Wails app the frontend uses BrowserOpenURL (the primary path); this
// is the engine-level fallback so interactive flows work headlessly and are
// testable. The launcher is spawned without waiting — browsers detach.
func OpenURL(rawURL string) error {
	tryCommands := openCommands(rawURL)
	var lastErr error
	for _, c := range tryCommands {
		cmd := exec.Command(c[0], c[1:]...) //nolint:gosec — args is the user/engine-built URL
		if err := openURLFn(cmd); err == nil {
			return nil
		} else {
			lastErr = err
		}
	}
	return fmt.Errorf("oauth2: open %s: %w (tried %v)", rawURL, lastErr, tryCommands)
}

// openCommand returns the primary OS-specific launcher for a URL (kept for
// tests that stub openURLFn).
func openCommand(rawURL string) (string, []string) {
	cmds := openCommands(rawURL)
	return cmds[0][0], cmds[0][1:]
}

// openCommands returns the ordered list of launchers to try on this OS.
// On Linux we try xdg-open, then gio open, then sensible-browser for
// Fedora minimal / Wayland fallbacks.
func openCommands(rawURL string) [][]string {
	switch runtime.GOOS {
	case "darwin":
		return [][]string{{"open", rawURL}}
	case "windows":
		return [][]string{{"rundll32", "url.dll,FileProtocolHandler", rawURL}}
	default:
		return [][]string{
			{"xdg-open", rawURL},
			{"gio", "open", rawURL},
			{"sensible-browser", rawURL},
			{"x-www-browser", rawURL},
		}
	}
}
