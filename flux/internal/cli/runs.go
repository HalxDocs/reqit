package cli

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strings"
	"time"

	"flux/internal/trust"
)

// runsCommand implements `reqit runs ...`.
func runsCommand(args []string) int {
	if len(args) < 1 {
		fmt.Fprintln(os.Stderr, "Usage: reqit runs list|show|diff|verify")
		return 1
	}
	switch args[0] {
	case "list":
		return runsList(args[1:])
	case "show":
		return runsShow(args[1:])
	case "diff":
		return runsDiff(args[1:])
	case "verify":
		return runsVerify(args[1:])
	default:
		fmt.Fprintf(os.Stderr, "Unknown runs command: %s\n", args[0])
		fmt.Fprintln(os.Stderr, "Usage: reqit runs list|show|diff|verify")
		return 1
	}
}

func runsList(args []string) int {
	limit := 20
	asJSON := false
	wsID := ""
	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "--limit", "-n":
			if i+1 < len(args) {
				i++
				fmt.Sscanf(args[i], "%d", &limit)
			}
		case "--json":
			asJSON = true
		case "--workspace", "-w":
			if i+1 < len(args) {
				i++
				wsID = args[i]
			}
		}
	}

	store, code := receiptStore(wsID)
	if code != 0 {
		return code
	}
	receipts, err := store.List(limit)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error reading receipts: %v\n", err)
		return 1
	}
	if asJSON {
		return printJSON(receipts)
	}
	if len(receipts) == 0 {
		fmt.Println("No runs recorded yet. Run a request, then try again.")
		return 0
	}

	fmt.Printf("%-34s %-20s %-9s %-9s %-6s %-40s %-6s %s\n", "ID", "WHEN", "SOURCE", "KIND", "METHOD", "URL", "STATUS", "TIME")
	for _, r := range receipts {
		when := r.Time
		if t, err := time.Parse(time.RFC3339Nano, r.Time); err == nil {
			when = t.Local().Format("2006-01-02 15:04:05")
		}
		kind := r.Kind
		if kind == "" {
			kind = "run"
		}
		status := fmt.Sprintf("%d", r.Response.StatusCode)
		if kind == "loadtest" {
			status = "-"
		}
		fmt.Printf("%-34s %-20s %-9s %-9s %-6s %-40s %-6s %s\n",
			r.ID, when, r.Source, kind, r.Request.Method, truncate(r.Request.URL, 40),
			status, timingOf(r))
	}
	return 0
}

func runsShow(args []string) int {
	asJSON := false
	wsID := ""
	var id string
	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "--json":
			asJSON = true
		case "--workspace", "-w":
			if i+1 < len(args) {
				i++
				wsID = args[i]
			}
		default:
			if !strings.HasPrefix(args[i], "-") {
				id = args[i]
			}
		}
	}
	if id == "" {
		fmt.Fprintln(os.Stderr, "Usage: reqit runs show <id>")
		return 1
	}

	store, code := receiptStore(wsID)
	if code != 0 {
		return code
	}
	r, err := store.Get(id)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return 1
	}
	if asJSON {
		return printJSON(r)
	}

	fmt.Printf("Receipt %s\n", r.ID)
	fmt.Printf("  %s · %s", r.Time, r.Source)
	if r.Session != "" {
		fmt.Printf(" · session %s", r.Session)
	}
	if r.Environment != "" {
		fmt.Printf(" · env %s", r.Environment)
	}
	fmt.Println()
	fmt.Println()

	fmt.Println("Request")
	fmt.Printf("  %s %s\n", r.Request.Method, r.Request.URL)
	if r.Request.BodyType != "" && r.Request.BodyType != "none" {
		fmt.Printf("  body    %s (%d B, sha256 %.12s)\n", r.Request.BodyType, r.Request.BodyBytes, strings.TrimPrefix(r.Request.BodySHA256, "sha256:"))
	}
	if r.Request.AuthType != "" && r.Request.AuthType != "none" {
		fmt.Printf("  auth    %s\n", r.Request.AuthType)
	}
	if len(r.Resolution) > 0 {
		fmt.Println("  variables")
		for _, v := range r.Resolution {
			fmt.Printf("    %-24s %s\n", v.Name, v.Source)
		}
	}
	if len(r.Request.Headers) > 0 {
		fmt.Println("  headers")
		for _, h := range r.Request.Headers {
			value := h.Value
			if h.Redacted {
				value = "«redacted»"
			}
			fmt.Printf("    %-24s %s\n", h.Name, value)
		}
	}
	fmt.Println()

	if r.LoadTest != nil {
		fmt.Println("Load test")
		fmt.Printf("  %d VUs · %d requests · %d passed · %d failed\n", r.LoadTest.VUs, r.LoadTest.TotalReqs, r.LoadTest.Passed, r.LoadTest.Failed)
		fmt.Printf("  avg %.0fms · p50 %.0fms · p95 %.0fms · p99 %.0fms\n",
			r.LoadTest.AvgMs, r.LoadTest.P50Ms, r.LoadTest.P95Ms, r.LoadTest.P99Ms)
		if r.LoadTest.Error != "" {
			fmt.Printf("  error   %s\n", r.LoadTest.Error)
		}
		fmt.Println()
		return 0
	}

	fmt.Println("Response")
	if r.Response.Error != "" {
		fmt.Printf("  error   %s\n", r.Response.Error)
	} else {
		fmt.Printf("  %s · %s · %s\n", statusLine(r.Response), timingOf(*r), humanBytes(r.Response.BodyBytes))
	}
	if len(r.Response.Headers) > 0 {
		names := make([]string, 0, len(r.Response.Headers))
		for name := range r.Response.Headers {
			names = append(names, name)
		}
		sort.Strings(names)
		for _, name := range names {
			fmt.Printf("    %-24s %s\n", name, r.Response.Headers[name])
		}
	}
	if r.Validation != nil {
		fmt.Println()
		if r.Validation.Valid {
			fmt.Println("Validation: valid")
		} else {
			fmt.Println("Validation: invalid")
			for _, e := range r.Validation.Errors {
				fmt.Printf("  %s %s: %s\n", e.Layer, e.Field, e.Message)
			}
			if r.Validation.SkipReason != "" {
				fmt.Printf("  skipped: %s\n", r.Validation.SkipReason)
			}
		}
	}
	return 0
}

func runsDiff(args []string) int {
	wsID := ""
	var ids []string
	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "--workspace", "-w":
			if i+1 < len(args) {
				i++
				wsID = args[i]
			}
		default:
			if !strings.HasPrefix(args[i], "-") {
				ids = append(ids, args[i])
			}
		}
	}
	if len(ids) != 2 {
		fmt.Fprintln(os.Stderr, "Usage: reqit runs diff <id> <id>")
		return 1
	}

	store, code := receiptStore(wsID)
	if code != 0 {
		return code
	}
	a, err := store.Get(ids[0])
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return 1
	}
	b, err := store.Get(ids[1])
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return 1
	}

	changed := false
	same := func(label, a, b string) {
		if a == b {
			fmt.Printf("  %-12s unchanged\n", label)
			return
		}
		changed = true
		fmt.Printf("  %-12s %s\n  %-12s %s\n", label+":", a, "", b)
	}

	fmt.Printf("Comparing %s → %s\n\n", a.ID, b.ID)
	if a.LoadTest != nil || b.LoadTest != nil {
		la, lb := a.LoadTest, b.LoadTest
		if la == nil {
			la = &trust.LoadTestRecord{}
		}
		if lb == nil {
			lb = &trust.LoadTestRecord{}
		}
		same("kind", a.Kind, b.Kind)
		same("vus", fmt.Sprintf("%d", la.VUs), fmt.Sprintf("%d", lb.VUs))
		same("requests", fmt.Sprintf("%d", la.TotalReqs), fmt.Sprintf("%d", lb.TotalReqs))
		same("failed", fmt.Sprintf("%d", la.Failed), fmt.Sprintf("%d", lb.Failed))
		same("p95", fmt.Sprintf("%.0fms", la.P95Ms), fmt.Sprintf("%.0fms", lb.P95Ms))
		if changed {
			return 2
		}
		return 0
	}

	same("request", a.Request.Method+" "+a.Request.URL, b.Request.Method+" "+b.Request.URL)
	same("status", fmt.Sprintf("%d", a.Response.StatusCode), fmt.Sprintf("%d", b.Response.StatusCode))
	same("timing", timingOf(*a), timingOf(*b))
	same("body", shortHash(a.Response.BodySHA256), shortHash(b.Response.BodySHA256))
	same("size", humanBytes(a.Response.BodyBytes), humanBytes(b.Response.BodyBytes))

	av, bv := "none", "none"
	if a.Validation != nil {
		av = validity(a.Validation.Valid)
	}
	if b.Validation != nil {
		bv = validity(b.Validation.Valid)
	}
	same("validation", av, bv)

	if changed {
		return 2
	}
	return 0
}

func runsVerify(args []string) int {
	wsID := ""
	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "--workspace", "-w":
			if i+1 < len(args) {
				i++
				wsID = args[i]
			}
		}
	}

	store, code := receiptStore(wsID)
	if code != 0 {
		return code
	}
	report, err := store.VerifyChainReport()
	if err != nil {
		fmt.Fprintf(os.Stderr, "✕ %v\n", err)
		return 1
	}
	if report.Checked == 0 {
		fmt.Println("No runs recorded yet.")
		return 0
	}
	if report.Unsigned == 0 {
		fmt.Printf("✓ %d receipt%s verified — hashes, chain and signatures intact\n", report.Checked, plural(report.Checked))
	} else {
		fmt.Printf("✓ %d receipt%s verified — hashes and chain intact (%d signed, %d unsigned)\n",
			report.Checked, plural(report.Checked), report.Signed, report.Unsigned)
	}
	return 0
}

func plural(n int) string {
	if n == 1 {
		return ""
	}
	return "s"
}

func receiptStore(wsID string) (*trust.Store, int) {
	dir, err := getWorkspaceDir(wsID)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return nil, 1
	}
	return trust.NewStore(dir), 0
}

func printJSON(v any) int {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error encoding JSON: %v\n", err)
		return 1
	}
	fmt.Println(string(data))
	return 0
}

func timingOf(r trust.Receipt) string {
	if r.Timing != nil {
		return formatTiming(r.Timing.TotalMs)
	}
	return "-"
}

func validity(valid bool) string {
	if valid {
		return "valid"
	}
	return "invalid"
}

// statusLine avoids repeating the code when the status text already starts
// with it, which is the shape Go's http.Response.Status uses ("200 OK").
func statusLine(r trust.ResponseRecord) string {
	code := fmt.Sprintf("%d", r.StatusCode)
	if r.Status == "" {
		return code
	}
	if strings.HasPrefix(r.Status, code) {
		return r.Status
	}
	return code + " " + r.Status
}

func shortHash(hash string) string {
	hash = strings.TrimPrefix(hash, "sha256:")
	if len(hash) > 12 {
		return hash[:12]
	}
	return hash
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	if n <= 1 {
		return s[:n]
	}
	return s[:n-1] + "…"
}

func humanBytes(n int64) string {
	switch {
	case n < 1024:
		return fmt.Sprintf("%d B", n)
	case n < 1024*1024:
		return fmt.Sprintf("%.1f KB", float64(n)/1024)
	default:
		return fmt.Sprintf("%.1f MB", float64(n)/(1024*1024))
	}
}
