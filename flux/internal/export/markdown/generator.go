package markdown

import (
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
	var b strings.Builder
	g.writeHeader(&b, col)

	if len(col.Requests) == 0 {
		b.WriteString("_No requests found._\n")
		return b.String(), nil
	}

	for _, req := range col.Requests {
		g.writeRequest(&b, req)
	}

	return b.String(), nil
}

func (g *Generator) writeHeader(b *strings.Builder, col *models.Collection) {
	fmt.Fprintf(b, "# %s\n\n", col.Name)
	if g.opts.BaseURL != "" {
		fmt.Fprintf(b, "**Base URL:** `%s`\n\n", g.opts.BaseURL)
	}
	if g.opts.Timestamp {
		fmt.Fprintf(b, "_Generated: %s_\n\n", time.Now().UTC().Format(time.RFC3339))
	}
	b.WriteString("---\n\n")
}

func (g *Generator) writeRequest(b *strings.Builder, r models.SavedRequest) {
	p := r.Payload

	fmt.Fprintf(b, "### %s\n\n", r.Name)
	fmt.Fprintf(b, "`%s` `%s`\n\n", p.Method, p.URL)

	if g.opts.IncludeHeaders && len(p.Headers) > 0 {
		g.writeHeaders(b, p.Headers)
	}
	if g.opts.IncludeBody && p.Body != "" && p.BodyType != "none" {
		g.writeBody(b, p.Body, p.BodyType)
	}
	if g.opts.IncludeExamples && r.SavedResponse != nil {
		g.writeExample(b, r.SavedResponse)
	}

	b.WriteString("---\n\n")
}

func (g *Generator) writeHeaders(b *strings.Builder, headers []models.Header) {
	b.WriteString("#### Headers\n\n")
	b.WriteString("| Key | Value | Required |\n")
	b.WriteString("|-----|-------|----------|\n")
	for _, h := range headers {
		if !h.Enabled {
			continue
		}
		val := h.Value
		if len(val) > 80 {
			val = val[:80] + "…"
		}
		req := "No"
		b.WriteString(fmt.Sprintf("| `%s` | `%s` | %s |\n", escapePipe(h.Key), escapePipe(val), req))
	}
	b.WriteString("\n")
}

func (g *Generator) writeBody(b *strings.Builder, body, bodyType string) {
	b.WriteString("#### Request Body\n\n")
	lang := bodyType
	if bodyType == "json" || bodyType == "graphql" {
		lang = "json"
	} else if bodyType == "form" || bodyType == "urlencoded" {
		lang = "text"
	}
	fmt.Fprintf(b, "```%s\n%s\n```\n\n", lang, body)
}

func (g *Generator) writeExample(b *strings.Builder, sr *models.SavedResponse) {
	b.WriteString("#### Example Response\n\n")
	b.WriteString(fmt.Sprintf("**Status:** %d\n\n", sr.StatusCode))
	if len(sr.Headers) > 0 {
		b.WriteString("**Headers:**\n\n")
		for k, v := range sr.Headers {
			fmt.Fprintf(b, "- `%s`: `%s`\n", escapePipe(k), escapePipe(v))
		}
		b.WriteString("\n")
	}
	if sr.Body != "" {
		b.WriteString("```json\n")
		b.WriteString(sr.Body)
		b.WriteString("\n```\n\n")
	}
}

func escapePipe(s string) string {
	return strings.ReplaceAll(s, "|", "\\|")
}
