package scheduler

import (
	"context"
	"time"

	"flux/internal/collections"
	"flux/internal/models"
	"flux/internal/requester"
)

type Executor struct {
	store       *Store
	collections *collections.Store
	onRun       func([]models.CollectionRunResult)
	cancel      context.CancelFunc
}

func NewExecutor(store *Store, collections *collections.Store) *Executor {
	return &Executor{
		store:       store,
		collections: collections,
	}
}

func (e *Executor) OnRun(fn func([]models.CollectionRunResult)) {
	e.onRun = fn
}

func (e *Executor) Start(ctx context.Context) {
	ctx, cancel := context.WithCancel(ctx)
	e.cancel = cancel
	go e.loop(ctx)
}

func (e *Executor) Stop() {
	if e.cancel != nil {
		e.cancel()
	}
}

func (e *Executor) loop(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			e.tick()
		}
	}
}

func (e *Executor) tick() {
	due := e.store.DueEntries()
	if len(due) == 0 {
		return
	}

	all, err := e.collections.GetAll()
	if err != nil {
		return
	}

	colMap := make(map[string]*models.Collection)
	for i := range all {
		colMap[all[i].ID] = &all[i]
	}

	var results []models.CollectionRunResult
	start := time.Now()

	for _, sched := range due {
		col, ok := colMap[sched.CollectionID]
		if !ok {
			continue
		}

		var reqs []models.RunnerRequest
		for _, r := range col.Requests {
			reqs = append(reqs, models.RunnerRequest{
				ID:      r.ID,
				Name:    r.Name,
				Payload: r.Payload,
			})
		}

		result := models.CollectionRunResult{
			CollectionID:   col.ID,
			CollectionName: col.Name,
		}

		for _, rr := range reqs {
			resp := requester.Execute(context.Background(), rr.Payload, nil)
			passed := resp.StatusCode >= 200 && resp.StatusCode < 300
			if passed {
				result.Passed++
			} else {
				result.Failed++
			}
			result.Total++
			rrResult := models.RequestRunResult{
				RequestID:   rr.ID,
				RequestName: rr.Name,
				Passed:      passed,
				StatusCode:  resp.StatusCode,
				StatusText:  resp.Status,
				TimingMs:    resp.TimingMs,
				SizeBytes:   resp.SizeBytes,
				Error:       resp.Error,
			}
			result.Results = append(result.Results, rrResult)
		}

		result.DurationMs = time.Since(start).Milliseconds()
		results = append(results, result)

		e.store.Update(sched.ID, map[string]interface{}{
			"lastRunAt": time.Now().UTC().Format(time.RFC3339),
		})
	}

	if e.onRun != nil && len(results) > 0 {
		e.onRun(results)
	}
}
