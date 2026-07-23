package runner

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/dop251/goja"
	"flux/internal/assertions"
	"flux/internal/models"
	"flux/internal/requester"
)

var varPattern = regexp.MustCompile(`\{\{\s*([\w.-]+)\s*\}\}`)

// fakerNames are common first names for test data generation.
var fakerNames = []string{"Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace", "Hank", "Iris", "Jack", "Kate", "Liam", "Mia", "Noah", "Olivia", "Paul", "Quinn", "Rose", "Sam", "Tina", "Uma", "Vince", "Wendy", "Xander", "Yara", "Zane"}

// fakerDomains are common email domains for test data.
var fakerDomains = []string{"example.com", "test.org", "demo.dev", "sample.io", "acme.co"}

// RunCollection runs requests with the given runner config and assertions.
// Supports retries, conditional execution, and all assertion types.
func RunCollection(ctx context.Context, reqs []models.RunnerRequest, assertionsMap map[string]models.Assertion, maxConcurrent ...int) models.CollectionRunResult {
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
		runSequential(ctx, reqs, assertionsMap, &results, &passed, &failed, &skipped)
	} else {
		runConcurrent(ctx, reqs, assertionsMap, conc, &results, &passed, &failed, &skipped)
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

// RunCollectionDataDriven runs requests multiple times, once per data row.
// Each row's key-value pairs are injected as environment variables.
func RunCollectionDataDriven(ctx context.Context, reqs []models.RunnerRequest, assertionsMap map[string]models.Assertion, dataRows []map[string]string, baseEnv map[string]string) models.CollectionRunResult {
	start := time.Now()
	var allResults []models.RequestRunResult
	passed, failed, skipped := 0, 0, 0

	for rowIdx, row := range dataRows {
		if ctx.Err() != nil {
			break
		}
		// Merge base env + row data (row overrides)
		mergedEnv := make(map[string]string)
		for k, v := range baseEnv {
			mergedEnv[k] = v
		}
		for k, v := range row {
			mergedEnv[k] = v
		}
		// Inject iteration index
		mergedEnv["__row_index"] = fmt.Sprintf("%d", rowIdx)

		env := make(map[string]string)
		for _, r := range reqs {
			if ctx.Err() != nil {
				break
			}
			// Apply data row variables as pre-set vars
			dataVars := make([]models.PreSetVar, 0, len(mergedEnv)+len(r.PreSetVars))
			for k, v := range mergedEnv {
				dataVars = append(dataVars, models.PreSetVar{Key: k, Value: v})
			}
			dataVars = append(dataVars, r.PreSetVars...)

			rr := r
			rr.PreSetVars = dataVars
			res := executeRequestWithRetries(ctx, rr, assertionsMap, env)
			res.RequestName = fmt.Sprintf("%s [row %d]", r.Name, rowIdx+1)
			allResults = append(allResults, res)
			if res.Skipped {
				skipped++
			} else if res.Passed {
				passed++
			} else {
				failed++
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

	return models.CollectionRunResult{
		CollectionID:   "",
		CollectionName: "",
		Results:        allResults,
		Passed:         passed,
		Failed:         failed,
		Skipped:        skipped,
		Total:          len(allResults),
		DurationMs:     time.Since(start).Milliseconds(),
	}
}

func runSequential(ctx context.Context, reqs []models.RunnerRequest, assertionsMap map[string]models.Assertion, results *[]models.RequestRunResult, passed, failed, skipped *int) {
	env := make(map[string]string)

	for i, r := range reqs {
		if ctx.Err() != nil {
			break
		}
		res := executeRequestWithRetries(ctx, r, assertionsMap, env)
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
				Body:       res.Body,
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

func runConcurrent(ctx context.Context, reqs []models.RunnerRequest, assertionsMap map[string]models.Assertion, conc int, results *[]models.RequestRunResult, passed, failed, skipped *int) {
	var mu sync.Mutex
	sem := make(chan struct{}, conc)
	var wg sync.WaitGroup

	for i, r := range reqs {
		if ctx.Err() != nil {
			break
		}
		wg.Add(1)
		sem <- struct{}{}
		go func(idx int, req models.RunnerRequest) {
			defer wg.Done()
			defer func() { <-sem }()
			defer func() {
				if r := recover(); r != nil {
					mu.Lock()
					(*results)[idx] = models.RequestRunResult{
						RequestID:   req.ID,
						RequestName: req.Name,
						Error:       fmt.Sprintf("panic: %v", r),
					}
					*failed++
					mu.Unlock()
				}
			}()

			env := make(map[string]string)
			res := executeRequestWithRetries(ctx, req, assertionsMap, env)

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

func executeRequestWithRetries(ctx context.Context, req models.RunnerRequest, assertionsMap map[string]models.Assertion, env map[string]string) models.RequestRunResult {
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

		resp := requester.Execute(ctx, payload, nil)

		lastRes = models.RequestRunResult{
			RequestID:   req.ID,
			RequestName: req.Name,
			StatusCode:  resp.StatusCode,
			StatusText:  resp.Status,
			Body:        resp.Body,
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
	val, err := runScriptWithTimeout(vm, script)
	if err != nil {
		return false // skip on error — safer than running unconditionally
	}
	return val.ToBoolean()
}

const scriptTimeout = 10 * time.Second

func runScriptWithTimeout(vm *goja.Runtime, script string) (goja.Value, error) {
	done := make(chan struct{})
	var val goja.Value
	var err error
	go func() {
		defer close(done)
		defer func() {
			if r := recover(); r != nil {
				err = fmt.Errorf("script panic: %v", r)
			}
		}()
		val, err = vm.RunString(script)
	}()
	select {
	case <-done:
		return val, err
	case <-time.After(scriptTimeout):
		vm.Interrupt("script timeout")
		<-done
		return val, err
	}
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
		// Faker variables: {{faker.name}}, {{faker.email}}, {{faker.uuid}}, etc.
		if strings.HasPrefix(name, "faker.") {
			return resolveFaker(name[6:])
		}
		return match
	})
}

func resolveFaker(typ string) string {
	now := time.Now()
	switch strings.ToLower(typ) {
	case "name":
		return fakerNames[rand.Intn(len(fakerNames))]
	case "first_name":
		return fakerNames[rand.Intn(len(fakerNames))]
	case "last_name":
		return fakerNames[rand.Intn(len(fakerNames))]
	case "email":
		name := strings.ToLower(fakerNames[rand.Intn(len(fakerNames))])
		domain := fakerDomains[rand.Intn(len(fakerDomains))]
		return name + "@" + domain
	case "phone":
		return fmt.Sprintf("(%03d) %03d-%04d", rand.Intn(900)+100, rand.Intn(900)+100, rand.Intn(9000)+1000)
	case "uuid":
		b := make([]byte, 16)
		rand.Read(b)
		b[6] = (b[6] & 0x0f) | 0x40
		b[8] = (b[8] & 0x3f) | 0x80
		return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
	case "int", "number":
		return strconv.Itoa(rand.Intn(10000))
	case "float":
		return fmt.Sprintf("%.2f", rand.Float64()*1000)
	case "bool":
		return strconv.FormatBool(rand.Intn(2) == 0)
	case "word":
		words := []string{"alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel", "india", "juliet", "kilo", "lima", "mike", "november", "oscar", "papa", "quebec", "romeo", "sierra", "tango"}
		return words[rand.Intn(len(words))]
	case "sentence":
		return "The quick brown fox jumps over the lazy dog"
	case "date":
		return now.Format("2006-01-02")
	case "time":
		return now.Format("15:04:05")
	case "datetime":
		return now.Format("2006-01-02T15:04:05Z")
	case "timestamp":
		return strconv.FormatInt(now.Unix(), 10)
	case "url":
		return "https://example.com/resource/" + strconv.Itoa(rand.Intn(10000))
	case "color":
		colors := []string{"#FF5733", "#33FF57", "#3357FF", "#F0F033", "#FF33A1", "#33FFF0"}
		return colors[rand.Intn(len(colors))]
	case "price":
		return fmt.Sprintf("%.2f", rand.Float64()*500)
	case "country":
		countries := []string{"US", "GB", "DE", "FR", "JP", "CA", "AU", "BR", "IN", "NG"}
		return countries[rand.Intn(len(countries))]
	case "city":
		cities := []string{"New York", "London", "Berlin", "Paris", "Tokyo", "Toronto", "Sydney", "São Paulo", "Mumbai", "Lagos"}
		return cities[rand.Intn(len(cities))]
	case "zip":
		return strconv.Itoa(rand.Intn(90000) + 10000)
	default:
		return ""
	}
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
