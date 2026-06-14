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

	"github.com/dop251/goja"
	"flux/internal/assertions"
	"flux/internal/models"
	"flux/internal/requester"
)

var varPattern = regexp.MustCompile(`\{\{\s*([\w.-]+)\s*\}\}`)

// RunCollection runs requests with the given runner config and assertions.
// Supports retries, conditional execution, and all assertion types.
func RunCollection(reqs []models.RunnerRequest, assertionsMap map[string]models.Assertion, maxConcurrent ...int) models.CollectionRunResult {
	start := time.Now()
	results := make([]models.RequestRunResult, len(reqs))
	passed, failed, skipped := 0, 0, 0

	conc := 5
	if len(maxConcurrent) > 0 && maxConcurrent[0] > 0 {
		conc = maxConcurrent[0]
	}

	hasScripts := false
	for _, r := range reqs {
		if len(r.PreSetVars) > 0 || len(r.ExtractRules) > 0 || r.Condition != "" {
			hasScripts = true
			break
		}
	}

	if hasScripts {
		runSequential(reqs, assertionsMap, &results, &passed, &failed, &skipped)
	} else {
		runConcurrent(reqs, assertionsMap, conc, &results, &passed, &failed, &skipped)
	}

	return models.CollectionRunResult{
		CollectionID:   "",
		CollectionName: "",
		Results:        results,
		Passed:         passed,
		Failed:         failed,
		Skipped:        skipped,
		Total:          len(reqs),
		DurationMs:     time.Since(start).Milliseconds(),
	}
}

func runSequential(reqs []models.RunnerRequest, assertionsMap map[string]models.Assertion, results *[]models.RequestRunResult, passed, failed, skipped *int) {
	env := make(map[string]string)

	for i, r := range reqs {
		res := executeRequestWithRetries(r, assertionsMap, env)
		(*results)[i] = res
		if res.Skipped {
			*skipped++
		} else if res.Passed {
			*passed++
		} else {
			*failed++
		}

		if len(r.ExtractRules) > 0 && !res.Skipped {
			resp := models.ResponseResult{
				StatusCode: res.StatusCode,
				Status:     res.StatusText,
				Body:       "",
				TimingMs:   res.TimingMs,
				SizeBytes:  res.SizeBytes,
			}
			for _, rule := range r.ExtractRules {
				if rule.Source == "" || rule.Target == "" {
					continue
				}
				if val := extractValueStatic(resp, rule); val != "" {
					env[rule.Target] = val
				}
			}
		}
	}
}

func runConcurrent(reqs []models.RunnerRequest, assertionsMap map[string]models.Assertion, conc int, results *[]models.RequestRunResult, passed, failed, skipped *int) {
	var mu sync.Mutex
	sem := make(chan struct{}, conc)
	var wg sync.WaitGroup

	for i, r := range reqs {
		wg.Add(1)
		sem <- struct{}{}
		go func(idx int, req models.RunnerRequest) {
			defer wg.Done()
			defer func() { <-sem }()

			env := make(map[string]string)
			res := executeRequestWithRetries(req, assertionsMap, env)

			mu.Lock()
			(*results)[idx] = res
			if res.Skipped {
				*skipped++
			} else if res.Passed {
				*passed++
			} else {
				*failed++
			}
			mu.Unlock()
		}(i, r)
	}
	wg.Wait()
}

func executeRequestWithRetries(req models.RunnerRequest, assertionsMap map[string]models.Assertion, env map[string]string) models.RequestRunResult {
	// Check condition
	if req.Condition != "" {
		shouldRun := evaluateCondition(req.Condition, env)
		if !shouldRun {
			return models.RequestRunResult{
				RequestID:   req.ID,
				RequestName: req.Name,
				Skipped:     true,
			}
		}
	}

	// Apply pre-set vars
	for _, pv := range req.PreSetVars {
		if pv.Key != "" {
			env[pv.Key] = pv.Value
		}
	}

	retries := req.Retries
	if retries < 0 {
		retries = 0
	}

	// Build the assertion list from per-request assertions + the legacy map
	var assertionList []models.Assertion
	assertionList = append(assertionList, req.Assertions...)
	if a, ok := assertionsMap[req.ID]; ok {
		assertionList = append(assertionList, a)
	}

	var lastRes models.RequestRunResult

	for attempt := 0; attempt <= retries; attempt++ {
		payload := resolvePayload(req.Payload, env)

		resp := requester.Execute(context.Background(), payload, nil)

		lastRes = models.RequestRunResult{
			RequestID:   req.ID,
			RequestName: req.Name,
			StatusCode:  resp.StatusCode,
			StatusText:  resp.Status,
			TimingMs:    resp.TimingMs,
			SizeBytes:   resp.SizeBytes,
			Error:       resp.Error,
			Retries:     attempt,
		}

		if resp.Error == "" {
			// Evaluate assertions
			runnerReq := req
			runnerReq.Assertions = assertionList
			lastRes.AssertionErrors = assertions.Evaluate(runnerReq, resp, env)
		}

		lastRes.Passed = len(lastRes.AssertionErrors) == 0 && resp.Error == ""
		if lastRes.Passed {
			break
		}

		if attempt < retries {
			time.Sleep(500 * time.Millisecond)
		}
	}

	return lastRes
}

func evaluateCondition(condition string, env map[string]string) bool {
	vm := goja.New()
	vars := vm.NewObject()
	for k, v := range env {
		_ = vars.Set(k, v)
	}
	_ = vm.Set("vars", vars)

	script := fmt.Sprintf("(function() { return %s; })()", condition)
	val, err := vm.RunString(script)
	if err != nil {
		return true // run on error
	}
	return val.ToBoolean()
}

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

	runnerReq := req
	runnerReq.Assertions = append(runnerReq.Assertions, assertion)
	res.AssertionErrors = assertions.Evaluate(runnerReq, resp, nil)
	res.Passed = len(res.AssertionErrors) == 0 && resp.Error == ""
	return res
}

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

func extractValueStatic(resp models.ResponseResult, rule models.ExtractRule) string {
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
