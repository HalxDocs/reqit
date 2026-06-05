package runner

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"flux/internal/models"
	"flux/internal/requester"
)

const maxConcurrent = 5

var varPattern = regexp.MustCompile(`\{\{\s*([\w.-]+)\s*\}\}`)

func RunCollection(reqs []models.RunnerRequest, assertions map[string]models.Assertion, jar http.CookieJar) models.CollectionRunResult {
	start := time.Now()
	results := make([]models.RequestRunResult, len(reqs))
	passed, failed := 0, 0

	// Check if any request has scripts — if so, run sequentially with env sharing.
	hasScripts := false
	for _, r := range reqs {
		if len(r.PreSetVars) > 0 || len(r.ExtractRules) > 0 {
			hasScripts = true
			break
		}
	}

	if hasScripts {
		runSequential(reqs, assertions, jar, &results, &passed, &failed)
	} else {
		runConcurrent(reqs, assertions, jar, &results, &passed, &failed)
	}

	return models.CollectionRunResult{
		CollectionID:   "",
		CollectionName: "",
		Results:        results,
		Passed:         passed,
		Failed:         failed,
		Total:          len(reqs),
		DurationMs:     time.Since(start).Milliseconds(),
	}
}

// ---- Sequential (scripting) path ----

func runSequential(reqs []models.RunnerRequest, assertions map[string]models.Assertion, jar http.CookieJar, results *[]models.RequestRunResult, passed, failed *int) {
	env := make(map[string]string)

	for i, r := range reqs {
		// Apply pre-set vars
		for _, pv := range r.PreSetVars {
			if pv.Key != "" {
				env[pv.Key] = pv.Value
			}
		}

		// Resolve variables in the payload
		payload := resolvePayload(r.Payload, env)

		resp := requester.Execute(context.Background(), payload, jar)

		// Apply extract rules
		for _, rule := range r.ExtractRules {
			if rule.Source == "" || rule.Target == "" {
				continue
			}
			if val := extractValue(resp, rule); val != "" {
				env[rule.Target] = val
			}
		}

		res := singleResult(r, resp, assertions[r.ID])
		(*results)[i] = res
		if res.Passed {
			*passed++
		} else {
			*failed++
		}
	}
}

// ---- Concurrent (no scripts) path ----

func runConcurrent(reqs []models.RunnerRequest, assertions map[string]models.Assertion, jar http.CookieJar, results *[]models.RequestRunResult, passed, failed *int) {
	var mu sync.Mutex
	sem := make(chan struct{}, maxConcurrent)
	var wg sync.WaitGroup

	for i, r := range reqs {
		wg.Add(1)
		sem <- struct{}{}
		go func(idx int, req models.RunnerRequest) {
			defer wg.Done()
			defer func() { <-sem }()

			resp := requester.Execute(context.Background(), req.Payload, jar)
			res := singleResult(req, resp, assertions[req.ID])

			mu.Lock()
			(*results)[idx] = res
			if res.Passed {
				*passed++
			} else {
				*failed++
			}
			mu.Unlock()
		}(i, r)
	}
	wg.Wait()
}

// ---- Shared helpers ----

func singleResult(req models.RunnerRequest, resp models.ResponseResult, assertion models.Assertion) models.RequestRunResult {
	res := models.RequestRunResult{
		RequestID:   req.ID,
		RequestName: req.Name,
		StatusCode:  resp.StatusCode,
		StatusText:  resp.Status,
		TimingMs:    resp.TimingMs,
		SizeBytes:   resp.SizeBytes,
		Error:       resp.Error,
	}
	res.AssertionErrors = evaluateAssertions(resp, assertion)
	res.Passed = len(res.AssertionErrors) == 0 && resp.Error == ""
	return res
}

// ---- Variable resolution ----

func resolvePayload(p models.RequestPayload, env map[string]string) models.RequestPayload {
	p.URL = resolve(p.URL, env)
	for i := range p.Headers {
		if p.Headers[i].Enabled {
			p.Headers[i].Value = resolve(p.Headers[i].Value, env)
		}
	}
	for i := range p.Params {
		if p.Params[i].Enabled {
			p.Params[i].Value = resolve(p.Params[i].Value, env)
		}
	}
	p.Body = resolve(p.Body, env)
	p.AuthValue = resolve(p.AuthValue, env)
	for i := range p.BodyForm {
		if p.BodyForm[i].Enabled {
			p.BodyForm[i].Value = resolve(p.BodyForm[i].Value, env)
		}
	}
	return p
}

func resolve(s string, env map[string]string) string {
	return varPattern.ReplaceAllStringFunc(s, func(match string) string {
		name := match[2 : len(match)-2]
		name = strings.TrimSpace(name)
		if v, ok := env[name]; ok {
			return v
		}
		return match
	})
}

// ---- Extraction ----

func extractValue(resp models.ResponseResult, rule models.ExtractRule) string {
	switch rule.Type {
	case "body_json":
		return extractJSONPath(resp.Body, rule.Source)
	case "header":
		val := resp.Headers[http.CanonicalHeaderKey(rule.Source)]
		if val == "" {
			val = resp.Headers[rule.Source]
		}
		return val
	default:
		return ""
	}
}

func extractJSONPath(body, path string) string {
	var v any
	if err := json.Unmarshal([]byte(body), &v); err != nil {
		return ""
	}
	parts := strings.Split(path, ".")
	current := v
	for _, part := range parts {
		m, ok := current.(map[string]any)
		if !ok {
			return ""
		}
		current, ok = m[part]
		if !ok {
			return ""
		}
	}
	return fmt.Sprintf("%v", current)
}

// ---- Assertions ----

func evaluateAssertions(resp models.ResponseResult, a models.Assertion) []string {
	var errs []string

	if a.StatusCode > 0 && resp.StatusCode != a.StatusCode {
		errs = append(errs, fmt.Sprintf("expected status %d, got %d", a.StatusCode, resp.StatusCode))
	}

	if a.MaxTimingMs > 0 && resp.TimingMs > a.MaxTimingMs {
		errs = append(errs, fmt.Sprintf("response too slow: %dms (max %dms)", resp.TimingMs, a.MaxTimingMs))
	}

	if a.BodyContains != "" && !strings.Contains(resp.Body, a.BodyContains) {
		errs = append(errs, fmt.Sprintf("body does not contain %q", a.BodyContains))
	}

	return errs
}
