package reporter

import (
	"encoding/json"
	"fmt"
	"html"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"flux/internal/models"
)

func GenerateJSONReport(result models.CollectionRunResult) (string, error) {
	b, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func GenerateHTMLReport(result models.CollectionRunResult, loadResult *models.LoadTestResult) (string, error) {
	now := time.Now().Format("2006-01-02 15:04:05")
	passedPct := 0.0
	if result.Total > 0 {
		passedPct = float64(result.Passed) / float64(result.Total) * 100
	}

	var b strings.Builder

	b.WriteString(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Test Report</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#0f0f13; color:#e4e4e7; padding:40px; }
  h1 { font-size:28px; font-weight:700; margin-bottom:4px; }
  .meta { color:#888; font-size:13px; margin-bottom:24px; }
  .summary { display:flex; gap:20px; margin-bottom:32px; flex-wrap:wrap; }
  .stat { background:#1a1a24; border:1px solid #2a2a35; border-radius:12px; padding:16px 24px; min-width:120px; }
  .stat-label { font-size:11px; text-transform:uppercase; color:#888; letter-spacing:0.05em; }
  .stat-value { font-size:28px; font-weight:700; margin-top:4px; }
  .pass { color:#22c55e; } .fail { color:#ef4444; } .skip { color:#888; }
  .bar { height:8px; border-radius:4px; background:#2a2a35; margin-top:8px; overflow:hidden; }
  .bar-fill { height:100%; border-radius:4px; transition:width 0.3s; }
  table { width:100%; border-collapse:collapse; margin-top:16px; }
  th, td { text-align:left; padding:10px 12px; border-bottom:1px solid #2a2a35; font-size:13px; }
  th { color:#888; font-weight:600; text-transform:uppercase; font-size:11px; letter-spacing:0.05em; }
  .badge { display:inline-block; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:600; }
  .badge-pass { background:#22c55e22; color:#22c55e; }
  .badge-fail { background:#ef444422; color:#ef4444; }
  .badge-skip { background:#88888822; color:#888; }
  .errors { margin-top:4px; font-size:12px; color:#f59e0b; }
  .load-section { margin-top:40px; }
  .load-section h2 { font-size:20px; margin-bottom:16px; }
  .percentile-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px; margin-bottom:20px; }
</style></head><body>`)

	fmt.Fprintf(&b, "<h1>Test Report</h1><div class='meta'>%s | %s | %dms</div>", html.EscapeString(result.CollectionName), now, result.DurationMs)

	b.WriteString("<div class='summary'>")
	fmt.Fprintf(&b, "<div class='stat'><div class='stat-label'>Total</div><div class='stat-value'>%d</div></div>", result.Total)
	fmt.Fprintf(&b, "<div class='stat'><div class='stat-label'>Passed</div><div class='stat-value pass'>%d</div></div>", result.Passed)
	fmt.Fprintf(&b, "<div class='stat'><div class='stat-label'>Failed</div><div class='stat-value fail'>%d</div></div>", result.Failed)
	if result.Skipped > 0 {
		fmt.Fprintf(&b, "<div class='stat'><div class='stat-label'>Skipped</div><div class='stat-value skip'>%d</div></div>", result.Skipped)
	}
	fmt.Fprintf(&b, "<div class='stat'><div class='stat-label'>Pass Rate</div><div class='stat-value'>%.1f%%</div><div class='bar'><div class='bar-fill pass' style='width:%.0f%%'></div></div></div>", passedPct, passedPct)
	b.WriteString("</div>")

	b.WriteString("<table><thead><tr><th>Request</th><th>Status</th><th>Code</th><th>Timing</th><th>Size</th><th>Result</th></tr></thead><tbody>")
	for _, r := range result.Results {
		badgeClass := "badge-pass"
		label := "PASS"
		if r.Skipped {
			badgeClass = "badge-skip"
			label = "SKIP"
		} else if !r.Passed {
			badgeClass = "badge-fail"
			label = "FAIL"
		}
		fmt.Fprintf(&b, "<tr><td>%s</td><td>%s</td><td>%d</td><td>%dms</td><td>%d</td><td><span class='badge %s'>%s</span>",
			html.EscapeString(r.RequestName), html.EscapeString(r.StatusText), r.StatusCode, r.TimingMs, r.SizeBytes, badgeClass, label)
		if len(r.AssertionErrors) > 0 {
			b.WriteString("<div class='errors'>")
			for _, err := range r.AssertionErrors {
				fmt.Fprintf(&b, "• %s<br>", html.EscapeString(err))
			}
			b.WriteString("</div>")
		}
		if r.Error != "" {
			fmt.Fprintf(&b, "<div class='errors'>• %s</div>", html.EscapeString(r.Error))
		}
		b.WriteString("</td></tr>")
	}
	b.WriteString("</tbody></table>")

	if loadResult != nil {
		b.WriteString("<div class='load-section'><h2>Load Test Results</h2>")
		fmt.Fprintf(&b, "<div class='meta'>%d VUs · %ds duration · %d total requests</div>", loadResult.Config.VUs, loadResult.Config.DurationSec, loadResult.TotalReqs)
		b.WriteString("<div class='percentile-grid'>")
		fmt.Fprintf(&b, "<div class='stat'><div class='stat-label'>Avg</div><div class='stat-value'>%.1fms</div></div>", loadResult.AvgTimingMs)
		fmt.Fprintf(&b, "<div class='stat'><div class='stat-label'>P50</div><div class='stat-value'>%.1fms</div></div>", loadResult.P50TimingMs)
		fmt.Fprintf(&b, "<div class='stat'><div class='stat-label'>P95</div><div class='stat-value'>%.1fms</div></div>", loadResult.P95TimingMs)
		fmt.Fprintf(&b, "<div class='stat'><div class='stat-label'>P99</div><div class='stat-value'>%.1fms</div></div>", loadResult.P99TimingMs)
		b.WriteString("</div></div>")
	}

	b.WriteString("</body></html>")
	return b.String(), nil
}

func SaveReport(dir, name string, content []byte) (string, error) {
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", err
	}
	p := filepath.Join(dir, name)
	return p, os.WriteFile(p, content, 0644)
}

func ExportRunResultToJSON(result models.CollectionRunResult, dir string) (string, error) {
	jsonStr, err := GenerateJSONReport(result)
	if err != nil {
		return "", err
	}
	name := fmt.Sprintf("report-%s.json", time.Now().Format("20060102-150405"))
	p, err := SaveReport(dir, name, []byte(jsonStr))
	if err != nil {
		return "", err
	}
	return p, nil
}

func ExportRunResultToHTML(result models.CollectionRunResult, loadResult *models.LoadTestResult, dir string) (string, error) {
	htmlStr, err := GenerateHTMLReport(result, loadResult)
	if err != nil {
		return "", err
	}
	name := fmt.Sprintf("report-%s.html", time.Now().Format("20060102-150405"))
	p, err := SaveReport(dir, name, []byte(htmlStr))
	if err != nil {
		return "", err
	}
	return p, nil
}

func ComputePercentiles(samples []models.LoadTestSample) (avg, p50, p95, p99 float64) {
	if len(samples) == 0 {
		return 0, 0, 0, 0
	}
	timings := make([]int64, len(samples))
	sum := int64(0)
	for i, s := range samples {
		timings[i] = s.TimingMs
		sum += s.TimingMs
	}
	avg = float64(sum) / float64(len(samples))
	sort.Slice(timings, func(i, j int) bool { return timings[i] < timings[j] })
	n := len(timings)
	p50 = float64(timings[n*50/100])
	p95 = float64(timings[n*95/100])
	p99 = float64(timings[n*99/100])
	return
}
