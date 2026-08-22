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
//   - Linux/BSD: xdg-open
//
// In the Wails app the frontend uses BrowserOpenURL (the primary path); this
// is the engine-level fallback so interactive flows work headlessly and are
// testable. The launcher is spawned without waiting — browsers detach.
func OpenURL(rawURL string) error {
	name, args := openCommand(rawURL)
	cmd := exec.Command(name, args...) //nolint:gosec — args is the user/engine-built URL
	if err := openURLFn(cmd); err != nil {
		return fmt.Errorf("oauth2: open %s with %s: %w", rawURL, name, err)
	}
	return nil
}

// openCommand returns the OS-specific launcher and its arguments for a URL.
func openCommand(rawURL string) (string, []string) {
	switch runtime.GOOS {
	case "darwin":
		return "open", []string{rawURL}
	case "windows":
		return "rundll32", []string{"url.dll,FileProtocolHandler", rawURL}
	default:
		return "xdg-open", []string{rawURL}
	}
}
