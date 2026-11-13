package main

import (
	"fmt"

	"flux/internal/trust"
)

// ListRuns returns the newest run receipts for the mounted workspace. The
// desktop UI uses it to show the same history `reqit runs list` prints.
func (a *App) ListRuns(limit int) ([]trust.Receipt, error) {
	if a.trustStore == nil {
		return []trust.Receipt{}, nil
	}
	receipts, err := a.trustStore.List(limit)
	if err != nil {
		return nil, fmt.Errorf("list runs: %w", err)
	}
	if receipts == nil {
		return []trust.Receipt{}, nil
	}
	return receipts, nil
}

// GetRun returns one receipt by full ID or unique prefix.
func (a *App) GetRun(id string) (trust.Receipt, error) {
	if a.trustStore == nil {
		return trust.Receipt{}, fmt.Errorf("no workspace is open")
	}
	r, err := a.trustStore.Get(id)
	if err != nil {
		return trust.Receipt{}, err
	}
	return *r, nil
}
