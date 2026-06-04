package runner

import (
	"context"
	"net/http"
	"strings"
	"sync"
	"time"

	"flux/internal/models"
	"flux/internal/requester"
)

const maxConcurrent = 5

func RunCollection(reqs []models.RunnerRequest, assertions map[string]models.Assertion, jar http.CookieJar) models.CollectionRunResult {
	start := time.Now()
	results := make([]models.RequestRunResult, len(reqs))
	var mu sync.Mutex
	passed, failed := 0, 0

	sem := make(chan struct{}, maxConcurrent)
	var wg sync.WaitGroup

	for i, r := range reqs {
		wg.Add(1)
		sem <- struct{}{}
		go func(idx int, req models.RunnerRequest) {
			defer wg.Done()
			defer func() { <-sem }()

			res := runSingle(req, assertions[req.ID], jar)

			mu.Lock()
			results[idx] = res
			if res.Passed {
				passed++
			} else {
				failed++
			}
			mu.Unlock()
		}(i, r)
	}

	wg.Wait()

	return models.CollectionRunResult{
		Results:    results,
		Passed:     passed,
		Failed:     failed,
		Total:      len(reqs),
		DurationMs: time.Since(start).Milliseconds(),
	}
}

func runSingle(req models.RunnerRequest, assertion models.Assertion, jar http.CookieJar) models.RequestRunResult {
	ctx := context.Background()

	resp := requester.Execute(ctx, req.Payload, jar)

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

func evaluateAssertions(resp models.ResponseResult, a models.Assertion) []string {
	var errs []string

	if a.StatusCode > 0 && resp.StatusCode != a.StatusCode {
		errs = append(errs, "expected status "+itoa(a.StatusCode)+", got "+itoa(resp.StatusCode))
	}

	if a.MaxTimingMs > 0 && resp.TimingMs > a.MaxTimingMs {
		errs = append(errs, "response too slow: "+itoa64(resp.TimingMs)+"ms (max "+itoa64(a.MaxTimingMs)+"ms)")
	}

	if a.BodyContains != "" && !strings.Contains(resp.Body, a.BodyContains) {
		errs = append(errs, "body does not contain \""+a.BodyContains+"\"")
	}

	return errs
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	s := ""
	neg := n < 0
	if neg {
		n = -n
	}
	for n > 0 {
		s = string(rune('0'+n%10)) + s
		n /= 10
	}
	if neg {
		s = "-" + s
	}
	return s
}

func itoa64(n int64) string {
	if n == 0 {
		return "0"
	}
	s := ""
	neg := n < 0
	if neg {
		n = -n
	}
	for n > 0 {
		s = string(rune('0'+n%10)) + s
		n /= 10
	}
	if neg {
		s = "-" + s
	}
	return s
}
