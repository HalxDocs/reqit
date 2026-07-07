package html

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"flux/internal/models"
)

type Generator struct {
	opts ExportOptions
}

func New(opts ExportOptions) *Generator {
	return &Generator{opts: opts}
}

func (g *Generator) Generate(col *models.Collection) (string, error) {
	var page strings.Builder

	g.writeHead(&page, col)
	g.writeBody(&page, col)
	g.writeScript(&page)

	return page.String(), nil
}

func (g *Generator) writeHead(b *strings.Builder, col *models.Collection) {
	bg := "#0f1117"
	surface := "#1a1d27"
	border := "#2a2d3a"
	text := "#e1e4ed"
	subtext := "#8b8fa3"
	tertiary := "#5a5e72"
	cyan := "#22d3ee"
	green := "#4ade80"
	amber := "#fbbf24"
	red := "#f87171"

	if !g.opts.DarkMode {
		bg = "#ffffff"
		surface = "#f5f6fa"
		border = "#e2e4eb"
		text = "#1a1d27"
		subtext = "#6b6f82"
		tertiary = "#9ca0b4"
		cyan = "#0891b2"
		green = "#16a34a"
		amber = "#d97706"
		red = "#dc2626"
	}

	fmt.Fprintf(b, `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>%s — API Documentation</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: %s;
      color: %s;
      line-height: 1.6;
    }
    .container { max-width: 960px; margin: 0 auto; padding: 0 24px; }
    header {
      background: %s;
      border-bottom: 1px solid %s;
      padding: 32px 0 24px;
      margin-bottom: 32px;
    }
    header h1 { font-size: 28px; font-weight: 700; margin-bottom: 4px; }
    header .desc { color: %s; font-size: 14px; }
    header .meta { color: %s; font-size: 12px; margin-top: 8px; }
    nav.toc {
      background: %s;
      border: 1px solid %s;
      border-radius: 8px;
      padding: 20px 24px;
      margin-bottom: 32px;
    }
    nav.toc h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: %s; margin-bottom: 8px; }
    nav.toc a {
      display: block;
      padding: 4px 0;
      color: %s;
      text-decoration: none;
      font-size: 14px;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    }
    nav.toc a:hover { color: %s; }
    .endpoint {
      background: %s;
      border: 1px solid %s;
      border-radius: 8px;
      margin-bottom: 20px;
      overflow: hidden;
    }
    .endpoint-head {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 20px;
      border-bottom: 1px solid %s;
      cursor: pointer;
      user-select: none;
    }
    .endpoint-head:hover { background: %s; }
    .method {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      min-width: 52px;
      text-align: center;
    }
    .method.get { background: %s; color: #0f1117; }
    .method.post { background: %s; color: #0f1117; }
    .method.put { background: %s; color: #0f1117; }
    .method.patch { background: %s; color: #0f1117; }
    .method.delete { background: %s; color: #0f1117; }
    .method.head { background: %s; color: #0f1117; }
    .method.options { background: %s; color: #0f1117; }
    .url { font-size: 13px; font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; color: %s; word-break: break-all; }
    .name { font-size: 14px; font-weight: 600; color: %s; margin-left: auto; }
    .endpoint-body { padding: 16px 20px; display: none; }
    .endpoint.open .endpoint-body { display: block; }
    .endpoint-body h3 {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: %s;
      margin: 16px 0 6px;
    }
    .endpoint-body h3:first-child { margin-top: 0; }
    table { width: 100%%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid %s; }
    th { color: %s; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; }
    td { color: %s; font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; font-size: 12px; word-break: break-all; }
    pre {
      background: %s;
      border: 1px solid %s;
      border-radius: 4px;
      padding: 12px 14px;
      font-size: 12px;
      overflow-x: auto;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      line-height: 1.5;
      color: %s;
    }
    .meta-row { display: flex; gap: 16px; flex-wrap: wrap; font-size: 12px; color: %s; }
    .meta-row span { display: flex; align-items: center; gap: 4px; }
    .badge {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: 600;
    }
    .badge-green { background: %s; color: #0f1117; }
    .badge-blue { background: %s; color: #0f1117; }
    .badge-amber { background: %s; color: #0f1117; }
    .badge-red { background: %s; color: #0f1117; }
    .tag {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 3px;
      font-size: 10px;
      background: %s;
      color: %s;
      margin-right: 4px;
    }
    footer {
      margin-top: 48px;
      padding: 24px 0 48px;
      border-top: 1px solid %s;
      text-align: center;
      font-size: 12px;
      color: %s;
    }
    @media (max-width: 640px) {
      .container { padding: 0 16px; }
      .endpoint-head { flex-wrap: wrap; }
      .name { width: 100%%; margin-left: 0; }
    }
  </style>
</head>
<body>
`, escapeHTML(col.Name), bg, text, surface, border, subtext, tertiary, surface, border, tertiary, cyan, cyan, surface, border, border, surface, cyan, green, amber, red, red, cyan, green, text, text, tertiary, border, tertiary, text, surface, border, text, subtext, green, cyan, amber, red, border, text, border, tertiary)
}

func (g *Generator) writeBody(b *strings.Builder, col *models.Collection) {
	// Header
	fmt.Fprintf(b, `<header>
  <div class="container">
    <h1>%s</h1>
`, escapeHTML(col.Name))
	if col.Description != "" {
		fmt.Fprintf(b, `    <p class="desc">%s</p>`, escapeHTML(col.Description))
	}
	if g.opts.BaseURL != "" {
		fmt.Fprintf(b, `    <p class="meta">Base URL: <code>%s</code></p>`, escapeHTML(g.opts.BaseURL))
	}
	if g.opts.Timestamp {
		fmt.Fprintf(b, `    <p class="meta">Generated: %s</p>`, time.Now().UTC().Format("January 2, 2006 at 15:04 UTC"))
	}
	fmt.Fprintf(b, `  </div>
</header>
<div class="container">
`)

	// Table of Contents
	if len(col.Requests) > 0 {
		b.WriteString(`  <nav class="toc">
    <h2>Endpoints</h2>
`)
		for _, req := range col.Requests {
			anchor := anchorName(req.Name, req.Payload.Method)
			method := strings.ToLower(req.Payload.Method)
			fmt.Fprintf(b, `    <a href="#%s"><span class="method %s">%s</span> %s</a>
`, anchor, method, escapeHTML(req.Payload.Method), escapeHTML(req.Payload.URL))
		}
		b.WriteString(`  </nav>
`)
	}

	// Endpoints
	for _, req := range col.Requests {
		g.writeEndpoint(b, req)
	}

	b.WriteString("</div>\n")
}

func (g *Generator) writeEndpoint(b *strings.Builder, r models.SavedRequest) {
	p := r.Payload
	anchor := anchorName(r.Name, p.Method)
	methodLower := strings.ToLower(p.Method)

	fmt.Fprintf(b, `  <div class="endpoint" id="%s">
    <div class="endpoint-head" onclick="this.parentElement.classList.toggle('open')">
      <span class="method %s">%s</span>
      <span class="url">%s</span>
      <span class="name">%s</span>
    </div>
    <div class="endpoint-body">
`, anchor, methodLower, escapeHTML(p.Method), escapeHTML(p.URL), escapeHTML(r.Name))

	// Toggle hint
	b.WriteString(`      <div class="meta-row"><span>Click to toggle details</span></div>
`)

	// Auth
	if p.AuthType != "" && p.AuthType != "none" {
		fmt.Fprintf(b, `      <h3>Authentication</h3>
      <table>
        <tr><th>Type</th><td>%s</td></tr>
      </table>
`, escapeHTML(p.AuthType))
	}

	// Headers
	if g.opts.IncludeHeaders && len(p.Headers) > 0 {
		b.WriteString(`      <h3>Headers</h3>
      <table>
        <tr><th>Key</th><th>Value</th></tr>
`)
		for _, h := range p.Headers {
			if !h.Enabled {
				continue
			}
			fmt.Fprintf(b, `        <tr><td>%s</td><td>%s</td></tr>
`, escapeHTML(h.Key), escapeHTML(h.Value))
		}
		b.WriteString("      </table>\n")
	}

	// Query params
	if g.opts.IncludeHeaders && len(p.Params) > 0 {
		enabled := 0
		for _, pp := range p.Params {
			if pp.Enabled {
				enabled++
			}
		}
		if enabled > 0 {
			b.WriteString(`      <h3>Query Parameters</h3>
      <table>
        <tr><th>Key</th><th>Value</th></tr>
`)
			for _, pp := range p.Params {
				if !pp.Enabled {
					continue
				}
				fmt.Fprintf(b, `        <tr><td>%s</td><td>%s</td></tr>
`, escapeHTML(pp.Key), escapeHTML(pp.Value))
			}
			b.WriteString("      </table>\n")
		}
	}

	// Body
	if g.opts.IncludeBody && p.Body != "" && p.BodyType != "none" {
		fmt.Fprintf(b, `      <h3>Request Body (%s)</h3>
      <pre>%s</pre>
`, escapeHTML(p.BodyType), escapeHTML(p.Body))
	}

	// Saved response example
	if g.opts.IncludeExamples && r.SavedResponse != nil {
		sr := r.SavedResponse
		statusClass := "badge-green"
		if sr.StatusCode >= 400 {
			statusClass = "badge-red"
		} else if sr.StatusCode >= 300 {
			statusClass = "badge-amber"
		} else if sr.StatusCode >= 200 {
			statusClass = "badge-blue"
		}
		fmt.Fprintf(b, `      <h3>Example Response</h3>
      <div class="meta-row">
        <span>Status: <span class="badge %s">%d</span></span>
      </div>
`, statusClass, sr.StatusCode)
		if len(sr.Headers) > 0 {
			b.WriteString(`      <h3>Response Headers</h3>
      <table>
        <tr><th>Header</th><th>Value</th></tr>
`)
			for k, v := range sr.Headers {
				fmt.Fprintf(b, `        <tr><td>%s</td><td>%s</td></tr>
`, escapeHTML(k), escapeHTML(v))
			}
			b.WriteString("      </table>\n")
		}
		if sr.Body != "" {
			prettyBody := sr.Body
			var parsed interface{}
			if json.Unmarshal([]byte(sr.Body), &parsed) == nil {
				if pretty, err := json.MarshalIndent(parsed, "", "  "); err == nil {
					prettyBody = string(pretty)
				}
			}
			fmt.Fprintf(b, `      <pre>%s</pre>
`, escapeHTML(prettyBody))
		}
	}

	b.WriteString(`    </div>
  </div>
`)
}

func (g *Generator) writeScript(b *strings.Builder) {
	b.WriteString(`<script>
  // Open first endpoint by default
  document.addEventListener("DOMContentLoaded", function() {
    var first = document.querySelector(".endpoint");
    if (first) first.classList.add("open");
  });
</script>
</body>
</html>`)
}

func escapeHTML(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, "\"", "&quot;")
	return s
}

func anchorName(name, method string) string {
	s := strings.ToLower(method + "-" + name)
	s = strings.ReplaceAll(s, " ", "-")
	s = strings.ReplaceAll(s, "/", "-")
	s = strings.ReplaceAll(s, ".", "-")
	return s
}
