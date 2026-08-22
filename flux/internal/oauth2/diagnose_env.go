package oauth2

import (
	"fmt"
	"net"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

// EnvFinding is a single diagnostic observation about the system environment.
// Findings are categorized as info (FYI), warning (likely issue), or
// critical (almost certainly blocking the callback).
type EnvFinding struct {
	// Severity: "info", "warning", "critical"
	Severity string
	// Short label shown in the UI, e.g. "System proxy detected"
	Label string
	// Detailed explanation with recommended fix
	Detail string
}

// EnvCheckResult holds all pre-flight environment findings collected before
// the browser-to-loopback test runs.
type EnvCheckResult struct {
	Findings []EnvFinding
}

// checkEnvironment runs all platform-specific pre-flight checks and returns
// findings that explain why a loopback callback might fail.
func checkEnvironment() *EnvCheckResult {
	r := &EnvCheckResult{}
	checkSystemProxy(r)
	checkFirewall(r)
	checkReasonSecurity(r)
	checkIPv6(r)
	return r
}

// checkSystemProxy detects system proxy settings that could intercept or
// block localhost HTTP traffic. Common on corporate machines with Zscaler,
// Cisco Umbrella, or similar proxy infrastructure.
func checkSystemProxy(r *EnvCheckResult) {
	switch runtime.GOOS {
	case "windows":
		checkWindowsProxy(r)
	case "darwin":
		checkMacProxy(r)
	case "linux":
		checkLinuxProxy(r)
	}
}

func checkWindowsProxy(r *EnvCheckResult) {
	// Check WinHTTP proxy via netsh.
	out, err := exec.Command("netsh", "winhttp", "show", "proxy").Output()
	if err != nil {
		return // netsh not available — skip
	}
	text := strings.TrimSpace(string(out))
	lower := strings.ToLower(text)

	if strings.Contains(lower, "proxy server") && !strings.Contains(lower, "direct access") {
		// Extract the proxy server address if present.
		for _, line := range strings.Split(text, "\n") {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(strings.ToLower(line), "proxy server") {
				addr := strings.TrimSpace(strings.TrimPrefix(strings.TrimPrefix(line, "Proxy Server(s)"), "Proxy server(s):"))
				addr = strings.TrimSpace(strings.TrimPrefix(strings.TrimPrefix(line, "Proxy Server(s)"), "proxy server(s):"))
				if addr != "" && addr != "(none)" {
					r.Findings = append(r.Findings, EnvFinding{
						Severity: "warning",
						Label:    "System proxy detected",
						Detail: fmt.Sprintf(
							"WinHTTP proxy is set to %q. If this proxy intercepts localhost traffic, "+
								"the OAuth callback may be blocked. Try adding 127.0.0.1 to the proxy "+
								"bypass list, or temporarily disable the proxy to test.", addr),
					})
					return
				}
			}
		}
		r.Findings = append(r.Findings, EnvFinding{
			Severity: "warning",
			Label:    "System proxy configured",
			Detail:   "WinHTTP has a proxy configured that may intercept localhost traffic. Check if 127.0.0.1 is in the bypass list.",
		})
	}

	// Also check the registry for per-connection proxy (Internet Options).
	out2, err := exec.Command("reg", "query",
		`HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings`,
		"/v", "ProxyEnable").Output()
	if err != nil {
		return
	}
	if strings.Contains(string(out2), "0x1") {
		r.Findings = append(r.Findings, EnvFinding{
			Severity: "warning",
			Label:    "IE/Edge proxy enabled",
			Detail:   "The per-connection proxy in Internet Options is enabled. Some browsers (Edge, Chrome) honor this setting. Ensure 127.0.0.1 or localhost is in the proxy bypass list.",
		})
	}
}

func checkMacProxy(r *EnvCheckResult) {
	out, err := exec.Command("networksetup", "-getwebproxy", "Wi-Fi").Output()
	if err != nil {
		return
	}
	text := strings.ToLower(string(out))
	if strings.Contains(text, "enabled: yes") {
		r.Findings = append(r.Findings, EnvFinding{
			Severity: "warning",
			Label:    "HTTP proxy enabled on Wi-Fi",
			Detail:   "macOS HTTP proxy is active. If it intercepts localhost, the OAuth callback may fail. Add 127.0.0.1 to the proxy bypass list in System Settings → Network → Wi-Fi → Proxies.",
		})
	}
}

func checkLinuxProxy(r *EnvCheckResult) {
	for _, env := range []string{"http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY"} {
		if v := strings.TrimSpace(
			func() string {
				out, err := exec.Command("printenv", env).Output()
				if err != nil {
					return ""
				}
				return string(out)
			}(),
		); v != "" && v != "http://" && v != "https://" {
			r.Findings = append(r.Findings, EnvFinding{
				Severity: "warning",
				Label:    fmt.Sprintf("Environment proxy %s is set", env),
				Detail: fmt.Sprintf(
					"%s=%s may route localhost traffic through a proxy. Add 127.0.0.1 to "+
						"NO_PROXY or unset this variable to test.", env, v),
			})
			return // one finding is enough
		}
	}
}

// checkFirewall detects firewall rules that could block loopback HTTP traffic.
func checkFirewall(r *EnvCheckResult) {
	switch runtime.GOOS {
	case "windows":
		checkWindowsFirewall(r)
		// Linux/macOS firewalls rarely block loopback — skip unless issues arise.
	}
}

func checkWindowsFirewall(r *EnvCheckResult) {
	// Check if Windows Firewall service is running (it might be blocking
	// newly-bound loopback ports).
	out, err := exec.Command("sc", "query", "MpsSvc").Output()
	if err != nil {
		return
	}
	text := strings.ToLower(string(out))
	if !strings.Contains(text, "running") {
		return // firewall service not running — can't be the issue
	}

	// Check for explicit rules blocking localhost connections.
	out2, err := exec.Command("netsh", "advfirewall", "firewall", "show", "rule",
		"name=all", "dir=in", "action=block").Output()
	if err != nil {
		return
	}
	rules := string(out2)
	// Look for rules that mention 127.0.0.1 or localhost.
	lowerRules := strings.ToLower(rules)
	if strings.Contains(lowerRules, "127.0.0.1") || strings.Contains(lowerRules, "localhost") {
		r.Findings = append(r.Findings, EnvFinding{
			Severity: "warning",
			Label:    "Windows Firewall has localhost block rules",
			Detail:   "Windows Firewall has inbound block rules mentioning 127.0.0.1 or localhost. These may block the OAuth callback. Run 'netsh advfirewall firewall show rule name=all dir=in action=block' to inspect them.",
		})
	}
}

// checkReasonSecurity detects Reason Cybersecurity EPP/EDR which can block
// localhost HTTP connections via its on-access scanning engine.
func checkReasonSecurity(r *EnvCheckResult) {
	switch runtime.GOOS {
	case "windows":
		checkReasonWindows(r)
	}
}

func checkReasonWindows(r *EnvCheckResult) {
	// Check if any Reason Cybersecurity service is running.
	services := []string{"rsEngineSvc", "rsEDRSvc", "rsClientSvc", "rsSyncSvc"}
	for _, svc := range services {
		out, err := exec.Command("sc", "query", svc).Output()
		if err != nil {
			continue
		}
		text := strings.ToLower(string(out))
		if strings.Contains(text, "running") {
			// Found a running Reason service — check its impact.
			r.Findings = append(r.Findings, EnvFinding{
				Severity: "warning",
				Label:    "Reason Cybersecurity is active",
				Detail: fmt.Sprintf(
					"Reason Cybersecurity service %s is running. Its on-access scanning engine "+
						"can intercept and block localhost HTTP connections (the exact path an OAuth "+
						"callback takes). If the browser test fails, try temporarily pausing Reason's "+
						"real-time protection or adding 127.0.0.1 to its exclusion list.", svc),
			})
			return // one finding is enough
		}
	}

	// Check if Reason is installed but not running (may restart on next boot).
	out, err := exec.Command("sc", "qc", "rsEngineSvc").Output()
	if err == nil {
		text := strings.ToLower(string(out))
		if strings.Contains(text, "demand_start") || strings.Contains(text, "auto_start") {
			r.Findings = append(r.Findings, EnvFinding{
				Severity: "info",
				Label:    "Reason Cybersecurity installed (not running)",
				Detail:   "Reason Cybersecurity is installed but its services are not running. It may start on the next reboot and could then block OAuth callbacks.",
			})
		}
	}
}

// checkIPv6 verifies the IPv6 loopback is available. Some hosts (especially
// corporate machines) disable IPv6 entirely, which can cause issues when
// browsers resolve localhost to ::1.
func checkIPv6(r *EnvCheckResult) {
	// Try to bind on [::1]:0 — if it fails, IPv6 loopback is unavailable.
	ln, err := net.Listen("tcp", "[::1]:0")
	if err != nil {
		r.Findings = append(r.Findings, EnvFinding{
			Severity: "info",
			Label:    "IPv6 loopback unavailable",
			Detail: "The IPv6 loopback ([::1]) is not available on this host. " +
				"The engine's dual-stack listener will fall back to IPv4 only. " +
				"This is fine if the browser connects via 127.0.0.1, but may " +
				"cause issues if localhost resolves to ::1 first.",
		})
		return
	}
	ln.Close()
}

// SummarizeFindings builds a human-readable summary of all findings.
func (r *EnvCheckResult) SummarizeFindings() string {
	if len(r.Findings) == 0 {
		return ""
	}
	var b strings.Builder
	b.WriteString("Environment findings:\n")
	for _, f := range r.Findings {
		icon := "ℹ️"
		switch f.Severity {
		case "warning":
			icon = "⚠️"
		case "critical":
			icon = "🔴"
		}
		fmt.Fprintf(&b, "%s %s\n   %s\n", icon, f.Label, f.Detail)
	}
	return b.String()
}

// HasWarnings reports whether any warning or critical findings exist.
func (r *EnvCheckResult) HasWarnings() bool {
	for _, f := range r.Findings {
		if f.Severity == "warning" || f.Severity == "critical" {
			return true
		}
	}
	return false
}

// TimeoutForEnvironment returns a timeout appropriate for the detected
// environment. If proxy/firewall findings suggest slower connections, the
// timeout is extended.
func (r *EnvCheckResult) TimeoutForEnvironment(base time.Duration) time.Duration {
	if r.HasWarnings() {
		// Add 50% more time when environment issues are detected — the
		// browser may need extra time to navigate through a proxy or retry.
		return time.Duration(float64(base) * 1.5)
	}
	return base
}
