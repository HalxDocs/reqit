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
		wg       sync.WaitGroup
		stopCh   = make(chan struct{})
		sampleCh = make(chan models.LoadTestSample, 10000)
	)

	vus := config.VUs
	if vus < 1 {
		vus = 1
	}
	const maxVUs = 500
	if vus > maxVUs {
		vus = maxVUs
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

	// Pre-build replacer(s) once so each VU goroutine shares the same
	// compiled replacement table instead of building it per-iteration.
	envVars := config.Env
	var sharedReplacer *strings.Replacer
	if len(envVars) > 0 {
		pairs := make([]string, 0, len(envVars)*2)
		for k, v := range envVars {
			pairs = append(pairs, "{{"+k+"}}", v)
		}
		sharedReplacer = strings.NewReplacer(pairs...)
	}

	for vu := 0; vu < vus; vu++ {
		wg.Add(1)
		go func(vuID int) {
			defer wg.Done()
			defer func() {
				if r := recover(); r != nil {
					sampleCh <- models.LoadTestSample{
						TimestampMs: time.Since(start).Milliseconds(),
						Error:       true,
					}
				}
			}()

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
				if hasVars(payload) && sharedReplacer != nil {
					payload.URL = doReplace(payload.URL, sharedReplacer)
					payload.Body = doReplace(payload.Body, sharedReplacer)
					payload.AuthValue = doReplace(payload.AuthValue, sharedReplacer)
				}

				result := requester.Execute(context.Background(), payload, jar)

				sampleCh <- models.LoadTestSample{
					TimestampMs: time.Since(start).Milliseconds(),
					StatusCode:  result.StatusCode,
					TimingMs:    result.TimingMs,
					SizeBytes:   result.SizeBytes,
					Error:       result.Error != "",
				}

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
	close(sampleCh)

	samples := make([]models.LoadTestSample, 0, cap(sampleCh))
	for s := range sampleCh {
		samples = append(samples, s)
	}

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

	var sum int64
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

func hasVars(p models.RequestPayload) bool {
	return strings.Contains(p.URL, "{{") ||
		strings.Contains(p.Body, "{{") ||
		strings.Contains(p.AuthValue, "{{")
}

func doReplace(s string, r *strings.Replacer) string {
	if !strings.Contains(s, "{{") {
		return s
	}
	return r.Replace(s)
}
