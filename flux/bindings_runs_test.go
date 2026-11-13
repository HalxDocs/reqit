package main

import (
	"testing"

	"flux/internal/trust"
)

func TestRunReceiptBindingsReadAndVerify(t *testing.T) {
	store := trust.NewStore(t.TempDir())
	// Tests never read or create the user's signing key; an unsigned receipt
	// is valid and is reported as such.
	store.SetSigningKey(nil)

	r := &trust.Receipt{
		Version:  trust.ReceiptVersion,
		Kind:     "run",
		Time:     "2026-01-01T00:00:00Z",
		Source:   "app",
		Request:  trust.RequestRecord{Method: "GET", URL: "https://api.example.com/users"},
		Response: trust.ResponseRecord{StatusCode: 200, Status: "200 OK"},
	}
	if err := store.Write(r); err != nil {
		t.Fatalf("Write: %v", err)
	}

	app := &App{trustStore: store}

	runs, err := app.ListRuns(10)
	if err != nil {
		t.Fatalf("ListRuns: %v", err)
	}
	if len(runs) != 1 || runs[0].ID != r.ID {
		t.Fatalf("unexpected runs: %+v", runs)
	}

	got, err := app.GetRun(r.ID)
	if err != nil {
		t.Fatalf("GetRun: %v", err)
	}
	if got.Request.URL != "https://api.example.com/users" {
		t.Errorf("GetRun returned %q", got.Request.URL)
	}

	report, err := app.VerifyRuns()
	if err != nil {
		t.Fatalf("VerifyRuns: %v", err)
	}
	if report.Checked != 1 || report.Unsigned != 1 || report.Signed != 0 {
		t.Errorf("unexpected report: %+v", report)
	}
}

func TestRunReceiptBindingsWithoutWorkspace(t *testing.T) {
	app := &App{}
	if runs, err := app.ListRuns(10); err != nil || len(runs) != 0 {
		t.Fatalf("ListRuns without a workspace = %v, %v", runs, err)
	}
	if _, err := app.GetRun("missing"); err == nil {
		t.Error("GetRun without a workspace should fail")
	}
	if _, err := app.VerifyRuns(); err == nil {
		t.Error("VerifyRuns without a workspace should fail")
	}
}
