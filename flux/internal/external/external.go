package external

import (
	"encoding/json"
	"fmt"
	"html"
	"os"
	"path/filepath"
	"strings"
	"text/template"
	"time"

	"flux/internal/models"
)

const playwrightTemplate = `// Auto-generated Playwright test from reqit collection: {{.Name}}
// Generated at {{.Timestamp}}
import {{ if .IsTS }} { test, expect } from '@playwright/test';{{ else }}const { test, expect } = require('@playwright/test');{{ end }}

{{range .Requests}}
test('{{.Name}}', async ({ request }) => {
  const resp = await request.{{.Method | lower}}({{.URL | printf "%q"}}{{if .Body}}, {
    data: {{.Body}},
    headers: {{.HeadersJSON}}
  }{{end}});
  {{range .Assertions}}
  {{.}}
  {{end}}
});
{{end}}
`

const jestTemplate = `// Auto-generated Jest test from reqit collection: {{.Name}}
// Generated at {{.Timestamp}}
{{ if .IsTS }}import axios, { AxiosResponse } from 'axios';{{ else }}const axios = require('axios');{{ end }}

describe('{{.Name}}', () => {
{{range .Requests}}
  test('{{.Name}}', async () => {
    try {
      const resp = await axios{{if eq .Method "GET"}}.get{{else if eq .Method "POST"}}.post{{else if eq .Method "PUT"}}.put{{else if eq .Method "PATCH"}}.patch{{else if eq .Method "DELETE"}}.delete{{end}}({{.URL | printf "%q"}}{{if .Body}}, {{.Body}}{{end}}{{if .Headers}}, { headers: {{.HeadersJSON}} }{{end}});
      {{range .Assertions}}
      {{.}}
      {{end}}
    } catch (e) {
      // Assertions on error response
      {{range .Assertions}}
      {{.}}
      {{end}}
    }
  });
{{end}}
});
`

type templateData struct {
	Name      string
	Timestamp string
	IsTS      bool
	Requests  []templateRequest
}

type templateRequest struct {
	Name         string
	Method       string
	URL          string
	Body         string
	HeadersJSON  string
	Headers      map[string]string
	Assertions   []string
}

func GeneratePlaywrightTest(collection models.Collection, requests []models.SavedRequest, assertions map[string][]models.Assertion, useTS bool) (string, error) {
	data := templateData{
		Name:      collection.Name,
		Timestamp: time.Now().Format(time.RFC3339),
		IsTS:      useTS,
	}

	for _, req := range requests {
		tr := templateRequest{
			Name:    req.Name,
			Method:  req.Payload.Method,
			URL:     req.Payload.URL,
			Headers: make(map[string]string),
		}
		for _, h := range req.Payload.Headers {
			if h.Enabled {
				tr.Headers[h.Key] = h.Value
			}
		}
		hJSON, _ := json.Marshal(tr.Headers)
		tr.HeadersJSON = string(hJSON)

		if req.Payload.Body != "" && req.Payload.BodyType != "none" {
			tr.Body = req.Payload.Body
		}

		for _, a := range assertions[req.ID] {
			tr.Assertions = append(tr.Assertions, assertionToPlaywright(a))
		}

		data.Requests = append(data.Requests, tr)
	}

	return executeTemplate(playwrightTemplate, data)
}

func GenerateJestTest(collection models.Collection, requests []models.SavedRequest, assertions map[string][]models.Assertion, useTS bool) (string, error) {
	data := templateData{
		Name:      collection.Name,
		Timestamp: time.Now().Format(time.RFC3339),
		IsTS:      useTS,
	}

	for _, req := range requests {
		tr := templateRequest{
			Name:    req.Name,
			Method:  req.Payload.Method,
			URL:     req.Payload.URL,
			Headers: make(map[string]string),
		}
		for _, h := range req.Payload.Headers {
			if h.Enabled {
				tr.Headers[h.Key] = h.Value
			}
		}

		if req.Payload.Body != "" && req.Payload.BodyType != "none" {
			tr.Body = req.Payload.Body
		}

		for _, a := range assertions[req.ID] {
			tr.Assertions = append(tr.Assertions, assertionToJest(a))
		}

		data.Requests = append(data.Requests, tr)
	}

	return executeTemplate(jestTemplate, data)
}

func SaveTestFile(content, dir, filename string) (string, error) {
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", err
	}
	p := filepath.Join(dir, filename)
	return p, os.WriteFile(p, []byte(content), 0644)
}

func assertionToPlaywright(a models.Assertion) string {
	switch a.Type {
	case models.AssertStatusCode:
		code := a.Target
		if code == "" {
			code = "200"
		}
		return fmt.Sprintf("  expect(resp.status()).toBe(%s);", code)
	case models.AssertBodyContains:
		return fmt.Sprintf("  expect(await resp.text()).toContain(%q);", a.Target)
	case models.AssertBodyMatch:
		return fmt.Sprintf("  expect(await resp.text()).toMatch(/%s/);", a.Target)
	case models.AssertHeader:
		return fmt.Sprintf("  expect(resp.headers()%s).toBe(%q);", headerChain(a.Target), a.Value)
	case models.AssertJSONPath:
		return fmt.Sprintf("  expect(await resp.json()%s).toBe(%q);", jsonPathChain(a.Target), a.Value)
	case models.AssertJSONSchema:
		return fmt.Sprintf("  // JSON Schema validation for %s", a.Target)
	default:
		return fmt.Sprintf("  // Assertion: %s %s %s", a.Type, a.Target, a.Value)
	}
}

func assertionToJest(a models.Assertion) string {
	switch a.Type {
	case models.AssertStatusCode:
		code := a.Target
		if code == "" {
			code = "200"
		}
		return fmt.Sprintf("      expect(resp.status).toBe(%s);", code)
	case models.AssertBodyContains:
		return fmt.Sprintf("      expect(resp.data).toContain(%q);", a.Target)
	case models.AssertBodyMatch:
		return fmt.Sprintf("      expect(resp.data).toMatch(/%s/);", a.Target)
	case models.AssertHeader:
		return fmt.Sprintf("      expect(resp.headers%q).toBe(%q);", a.Target, a.Value)
	case models.AssertJSONPath:
		return fmt.Sprintf("      expect(%s).toBe(%q);", jsonPathChain(a.Target), a.Value)
	default:
		return fmt.Sprintf("      // Assertion: %s %s %s", a.Type, a.Target, a.Value)
	}
}

func headerChain(key string) string {
	return fmt.Sprintf("[%q]", key)
}

func jsonPathChain(path string) string {
	parts := strings.Split(path, ".")
	chain := ""
	for _, p := range parts {
		chain += fmt.Sprintf("[%q]", p)
	}
	return chain
}

func executeTemplate(tpl string, data templateData) (string, error) {
	funcMap := template.FuncMap{
		"lower": strings.ToLower,
		"printf": fmt.Sprintf,
	}
	t, err := template.New("test").Funcs(funcMap).Parse(tpl)
	if err != nil {
		return "", fmt.Errorf("template parse error: %w", err)
	}
	var buf strings.Builder
	if err := t.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("template execute error: %w", err)
	}
	return buf.String(), nil
}

// CLI integration: generate a standalone executable runner
func GenerateCLIRunner(collection models.Collection, requests []models.SavedRequest) (string, error) {
	var b strings.Builder
	b.WriteString("#!/usr/bin/env node\n")
	b.WriteString("// reqit CLI runner: " + html.EscapeString(collection.Name) + "\n")
	b.WriteString("// Generated at " + time.Now().Format(time.RFC3339) + "\n\n")
	b.WriteString("const https = require('https');\n")
	b.WriteString("const http = require('http');\n\n")

	for _, req := range requests {
		b.WriteString(fmt.Sprintf("// %s - %s %s\n", req.Name, req.Payload.Method, req.Payload.URL))
		b.WriteString(fmt.Sprintf("async function run_%s() {\n", sanitizeID(req.ID)))
		b.WriteString(fmt.Sprintf("  const url = new URL(%q);\n", req.Payload.URL))
		b.WriteString("  return new Promise((resolve, reject) => {\n")
		b.WriteString(fmt.Sprintf("    const options = { method: %q, hostname: url.hostname, port: url.port, path: url.pathname + url.search };\n", req.Payload.Method))
		b.WriteString("    const proto = url.protocol === 'https:' ? https : http;\n")
		b.WriteString("    const req = proto.request(options, (resp) => {\n")
		b.WriteString("      let data = '';\n")
		b.WriteString("      resp.on('data', (chunk) => data += chunk);\n")
		b.WriteString("      resp.on('end', () => resolve({ status: resp.statusCode, headers: resp.headers, body: data }));\n")
		b.WriteString("    });\n")
		b.WriteString("    req.on('error', reject);\n")
		if req.Payload.Body != "" && req.Payload.BodyType != "none" {
			b.WriteString(fmt.Sprintf("    req.write(%s);\n", jsonStr(req.Payload.Body)))
		}
		b.WriteString("    req.end();\n")
		b.WriteString("  });\n")
		b.WriteString("}\n\n")
	}

	b.WriteString("async function main() {\n")
	b.WriteString("  const results = [];\n")
	for _, req := range requests {
		b.WriteString(fmt.Sprintf("  try { results.push(await run_%s()); } catch(e) { results.push({ error: e.message }); }\n", sanitizeID(req.ID)))
	}
	b.WriteString("  console.log(JSON.stringify(results, null, 2));\n")
	b.WriteString("}\n\n")
	b.WriteString("main().catch(console.error);\n")

	return b.String(), nil
}

const githubActionsTemplate = `# Auto-generated GitHub Actions workflow from reqit collection: {{.Name}}
# Generated at {{.Timestamp}}
name: API Tests - {{.Name}}

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]

jobs:
  api-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 18

      - name: Install dependencies
        run: npm ci || npm install

      - name: Run API tests
        run: node {{.RunnerFilename}}
`

const gitlabCITemplate = `# Auto-generated GitLab CI pipeline from reqit collection: {{.Name}}
# Generated at {{.Timestamp}}
stages:
  - test

api-tests:
  stage: test
  image: node:18
  script:
    - npm ci || npm install
    - node {{.RunnerFilename}}
  only:
    - main
    - master
    - merge_requests
`

type cicdData struct {
	Name           string
	Timestamp      string
	RunnerFilename string
}

func GenerateGitHubAction(collection models.Collection, runnerFilename string) (string, error) {
	data := cicdData{
		Name:           collection.Name,
		Timestamp:      time.Now().Format(time.RFC3339),
		RunnerFilename: runnerFilename,
	}
	return executeStepTemplate(githubActionsTemplate, data)
}

func GenerateGitLabCI(collection models.Collection, runnerFilename string) (string, error) {
	data := cicdData{
		Name:           collection.Name,
		Timestamp:      time.Now().Format(time.RFC3339),
		RunnerFilename: runnerFilename,
	}
	return executeStepTemplate(gitlabCITemplate, data)
}

func executeStepTemplate(tpl string, data cicdData) (string, error) {
	t, err := template.New("cicd").Parse(tpl)
	if err != nil {
		return "", fmt.Errorf("template parse error: %w", err)
	}
	var buf strings.Builder
	if err := t.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("template execute error: %w", err)
	}
	return buf.String(), nil
}

func sanitizeID(id string) string {
	s := strings.NewReplacer("-", "_", " ", "_").Replace(id)
	if len(s) > 0 && s[0] >= '0' && s[0] <= '9' {
		s = "_" + s
	}
	return s
}

func jsonStr(s string) string {
	b, _ := json.Marshal(s)
	return string(b)
}
