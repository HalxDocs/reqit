package main

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	onceo "github.com/HalxDocs/onceo-core"
)

const testSecret = "noop"

func fixturePath(t *testing.T, name string) string {
	t.Helper()
	p := filepath.Join("..", "..", "providers", "bachs", "testdata", name)
	if _, err := os.Stat(p); err != nil {
		t.Skipf("fixture not found: %v", err)
	}
	return p
}

func TestVerifyCmdFlagsAfterFile(t *testing.T) {
	fixture := fixturePath(t, "collection_succeeded.json")
	if err := verifyCmd([]string{fixture, "--provider", "bachs", "--secret", testSecret}); err != nil {
		t.Fatalf("verifyCmd with flags after file failed: %v", err)
	}
}

func TestVerifyCmdFlagsFirst(t *testing.T) {
	fixture := fixturePath(t, "collection_succeeded.json")
	if err := verifyCmd([]string{"--provider=bachs", "--secret=" + testSecret, fixture}); err != nil {
		t.Fatalf("verifyCmd with flags first failed: %v", err)
	}
}

func TestVerifyCmdMissingFile(t *testing.T) {
	if err := verifyCmd([]string{"--provider=bachs", "--secret=noop"}); err == nil {
		t.Fatal("expected usage error when no file is given")
	}
}

func TestVerifyCmdUnknownProvider(t *testing.T) {
	fixture := fixturePath(t, "collection_succeeded.json")
	err := verifyCmd([]string{fixture, "--provider=doesnotexist", "--secret=noop"})
	if !errors.Is(err, onceo.ErrUnknownProvider) {
		t.Fatalf("got %v, want ErrUnknownProvider", err)
	}
}

func TestNewProviderAll(t *testing.T) {
	// 32+ bytes: mpesa rejects callback tokens shorter than 32 bytes.
	const secret = "0123456789abcdef0123456789abcdef"
	for _, name := range []string{"paystack", "flutterwave", "opay", "mpesa", "svix", "bachs"} {
		p, err := newProvider(name, secret)
		if err != nil {
			t.Fatalf("newProvider(%q) failed: %v", name, err)
		}
		if p == nil || p.Name() != name {
			t.Errorf("newProvider(%q) = %v, want Name %q", name, p, name)
		}
	}
	if _, err := newProvider("nope", "x"); err == nil {
		t.Error("expected error for unknown provider")
	}
}

func TestBuildHeaders(t *testing.T) {
	body := []byte(`{"id":"evt_1","type":"collection.succeeded"}`)
	tests := []struct {
		provider string
		want     string
	}{
		{"paystack", "X-Paystack-Signature"},
		{"flutterwave", "Verif-Hash"},
		{"opay", "Authorization"},
		{"mpesa", "X-Onceo-Mpesa-Callback-Token"},
		{"svix", "svix-signature"},
		{"bachs", "X-Bachs-Signature"},
	}
	for _, tt := range tests {
		h := buildHeaders(tt.provider, "s3cret", body)
		if h.Get(tt.want) == "" {
			t.Errorf("buildHeaders(%q) missing %s", tt.provider, tt.want)
		}
	}
	// No secret => no headers (caller's responsibility).
	if got := buildHeaders("paystack", "", body); len(got) != 0 {
		t.Errorf("buildHeaders without secret = %v, want empty", got)
	}
}

func TestProviderWrapperNormalizeTypeMismatch(t *testing.T) {
	p, err := newProvider("bachs", "s3cret")
	if err != nil {
		t.Fatalf("newProvider failed: %v", err)
	}
	// Feed the wrapper a parsed value of the wrong concrete type.
	if _, err := p.Normalize("not a bachs payload"); !errors.Is(err, onceo.ErrEventParseFailed) {
		t.Errorf("got %v, want ErrEventParseFailed", err)
	}
}
