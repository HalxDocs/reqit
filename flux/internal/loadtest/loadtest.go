package loadtest

import (
	"context"
	"math/rand"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"flux/internal/models"
	"flux/internal/requester"
)

func RunLoadTest(config models.LoadTestConfig, jar http.CookieJar) models.LoadTestResult {
	start := time.Now()

	var (
		mu      sync.Mutex
		samples []models.LoadTestSample
		wg      sync.WaitGroup
		stopCh  = make(chan struct{})
	)

	vus := config.VUs
	if vus < 1 {
		vus = 1
	}

	duration := time.Duration(config.DurationSec) * time.Second
	if config.DurationSec <= 0 && config.Iterations <= 0 {
		config.Iterations = 10
	}

	iterPerVU := 0
	if config.Iterations > 0 {
		iterPerVU = config.Iterations / vus
		if iterPerVU < 1 {
			iterPerVU = 1
		}
	}

	rampUp := config.RampUpSec
	var rampInterval float64
	if rampUp > 0 && vus > 1 {
		rampInterval = float64(rampUp) / float64(vus)
	}

	for vu := 0; vu < vus; vu++ {
		wg.Add(1)
		go func(vuID int) {
			defer wg.Done()

			if rampUp > 0 && vuID > 0 {
				delay := time.Duration(float64(vuID)*rampInterval*1000) * time.Millisecond
				time.Sleep(delay)
			}

			iterCount := 0
			for {
				select {
				case <-stopCh:
					return
				default:
				}

				if iterPerVU > 0 && iterCount >= iterPerVU {
					return
				}

				payload := config.Request
				payload.URL = resolveVars(payload.URL, config.Env)
				payload.Body = resolveVars(payload.Body, config.Env)
				payload.AuthValue = resolveVars(payload.AuthValue, config.Env)

				result := requester.Execute(context.Background(), payload, jar)

				sample := models.LoadTestSample{
					TimestampMs: time.Since(start).Milliseconds(),
					StatusCode:  result.StatusCode,
					TimingMs:    result.TimingMs,
					SizeBytes:   result.SizeBytes,
					Error:       result.Error != "",
				}

				mu.Lock()
				samples = append(samples, sample)
				mu.Unlock()

				iterCount++

				jitter := time.Duration(100+rand.Intn(400)) * time.Millisecond
				time.Sleep(jitter)
			}
		}(vu)
	}

	if duration > 0 {
		time.Sleep(duration)
		close(stopCh)
	}

	wg.Wait()

	elapsed := time.Since(start).Milliseconds()
	passed := 0
	failed := 0
	for _, s := range samples {
		if s.Error {
			failed++
		} else {
			passed++
		}
	}

	avg, p50, p95, p99 := computePercentiles(samples)

	return models.LoadTestResult{
		Config:      config,
		Samples:     samples,
		TotalReqs:   len(samples),
		Passed:      passed,
		Failed:      failed,
		AvgTimingMs: avg,
		P50TimingMs: p50,
		P95TimingMs: p95,
		P99TimingMs: p99,
		DurationMs:  elapsed,
	}
}

func computePercentiles(samples []models.LoadTestSample) (avg, p50, p95, p99 float64) {
	if len(samples) == 0 {
		return 0, 0, 0, 0
	}

	sum := int64(0)
	for _, s := range samples {
		sum += s.TimingMs
	}
	avg = float64(sum) / float64(len(samples))

	timings := make([]int64, len(samples))
	for i, s := range samples {
		timings[i] = s.TimingMs
	}

	sort.Slice(timings, func(i, j int) bool { return timings[i] < timings[j] })
	n := len(timings)
	p50 = float64(timings[n*50/100])
	p95 = float64(timings[n*95/100])
	p99 = float64(timings[n*99/100])
	return
}

func resolveVars(s string, env map[string]string) string {
	if env == nil {
		return s
	}
	for k, v := range env {
		pattern := "{{" + k + "}}"
		s = strings.ReplaceAll(s, pattern, v)
	}
	return s
}
