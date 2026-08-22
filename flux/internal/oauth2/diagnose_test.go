package oauth2

import (
	"context"
	"net/http"
	"os/exec"
	"strings"
	"testing"
	"time"
)

func TestDiagnoseLoopbackSuccess(t *testing.T) {
	old := openURLFn
	launched := make(chan string, 1)
	openURLFn = func(cmd *exec.Cmd) error {
		url := cmd.Args[len(cmd.Args)-1]
		select {
		case launched <- url:
		default:
		}
		return nil
	}
	defer func() { openURLFn = old }()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Simulate the browser: as soon as the launcher advertises the test URL,
	// GET it — that is exactly the request that proves connectivity.
	go func() {
		select {
		case url := <-launched:
			resp, err := http.Get(url)
			if err == nil {
				resp.Body.Close()
			}
		case <-ctx.Done():
		}
	}()

	res, err := DiagnoseLoopback(ctx, 5*time.Second)
	if err != nil {
		t.Fatalf("DiagnoseLoopback: %v", err)
	}
	if !res.Success {
		t.Fatalf("browser hit the listener, want success, got %+v", res)
	}
	if !strings.HasPrefix(res.URL, "http://127.0.0.1:") {
		t.Errorf("test URL %q should be a loopback URL", res.URL)
	}
	if !strings.HasSuffix(res.URL, "/diagnose") {
		t.Errorf("test URL %q should end in /diagnose", res.URL)
	}
}

func TestDiagnoseLoopbackLauncherFailure(t *testing.T) {
	old := openURLFn
	openURLFn = func(cmd *exec.Cmd) error { return &exec.Error{Name: "rundll32", Err: errLauncherBoom} }
	defer func() { openURLFn = old }()

	res, err := DiagnoseLoopback(context.Background(), 2*time.Second)
	if err != nil {
		t.Fatalf("DiagnoseLoopback: %v", err)
	}
	if res.Success {
		t.Fatal("launcher failure must report failure")
	}
	if !strings.Contains(res.Detail, "could not be launched") {
		t.Errorf("detail should explain the launcher failure, got %q", res.Detail)
	}
}

func TestDiagnoseLoopbackTimeout(t *testing.T) {
	old := openURLFn
	openURLFn = func(cmd *exec.Cmd) error { return nil } // launcher "succeeds", browser never connects
	defer func() { openURLFn = old }()

	res, err := DiagnoseLoopback(context.Background(), 200*time.Millisecond)
	if err != nil {
		t.Fatalf("DiagnoseLoopback: %v", err)
	}
	if res.Success {
		t.Fatal("no browser connection must report failure")
	}
	if !strings.Contains(res.Detail, "never connected") {
		t.Errorf("detail should point at proxy/firewall, got %q", res.Detail)
	}
}

var errLauncherBoom = &exec.ExitError{}
