package oauth2

import (
	"testing"
)

// rfc7636AppendixB is the worked example from RFC 7636 Appendix B: the
// verifier and the exact S256 challenge the RFC computes for it.
const (
	rfc7636Verifier  = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
	rfc7636Challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
)

// TestNewCodeVerifierConformance checks RFC 7636 §4.1: 43–128 characters,
// only unreserved characters [A-Za-z0-9-._~].
func TestNewCodeVerifierConformance(t *testing.T) {
	for i := 0; i < 100; i++ {
		v, err := NewCodeVerifier()
		if err != nil {
			t.Fatal(err)
		}
		if !IsValidVerifier(v) {
			t.Errorf("verifier %q violates RFC 7636 §4.1", v)
		}
		if len(v) != defaultVerifierLen {
			t.Errorf("len = %d, want %d", len(v), defaultVerifierLen)
		}
	}
}

// TestNewCodeVerifierWithLengthBounds verifies the 43–128 char boundary is
// enforced exactly as RFC 7636 §4.1 states.
func TestNewCodeVerifierWithLengthBounds(t *testing.T) {
	for _, n := range []int{PKCEVerifierMinLen, 64, PKCEVerifierMaxLen} {
		v, err := NewCodeVerifierWithLength(n)
		if err != nil {
			t.Fatalf("length %d should be allowed: %v", n, err)
		}
		if len(v) != n {
			t.Errorf("length %d returned %d chars", n, len(v))
		}
	}
	for _, n := range []int{PKCEVerifierMinLen - 1, 0, -5, PKCEVerifierMaxLen + 1} {
		if _, err := NewCodeVerifierWithLength(n); err == nil {
			t.Errorf("length %d should be rejected by RFC 7636 §4.1", n)
		}
	}
}

// TestNewCodeVerifierUniqueness guards against degenerate RNG output: 100
// generated verifiers must all differ.
func TestNewCodeVerifierUniqueness(t *testing.T) {
	seen := make(map[string]bool, 100)
	for i := 0; i < 100; i++ {
		v, err := NewCodeVerifier()
		if err != nil {
			t.Fatal(err)
		}
		if seen[v] {
			t.Fatalf("duplicate verifier generated: %q", v)
		}
		seen[v] = true
	}
}

// TestS256ChallengeMatchesRFC7636 proves our challenge computation against the
// worked example in RFC 7636 Appendix B.
func TestS256ChallengeMatchesRFC7636(t *testing.T) {
	got := S256Challenge(rfc7636Verifier)
	if got != rfc7636Challenge {
		t.Errorf("S256Challenge mismatch:\n got  %s\n want %s", got, rfc7636Challenge)
	}
}

// TestS256ChallengeDeterministic: same verifier, same challenge, every time.
func TestS256ChallengeDeterministic(t *testing.T) {
	v, err := NewCodeVerifier()
	if err != nil {
		t.Fatal(err)
	}
	c1, c2, c3 := S256Challenge(v), S256Challenge(v), S256Challenge(v)
	if c1 != c2 || c2 != c3 {
		t.Errorf("S256Challenge not deterministic: %s %s %s", c1, c2, c3)
	}
	if c1 == v {
		t.Error("challenge must never equal the verifier for S256")
	}
}

// TestS256ChallengeLength: BASE64URL(SHA256) is always 43 chars.
func TestS256ChallengeLength(t *testing.T) {
	for i := 0; i < 20; i++ {
		v, err := NewCodeVerifier()
		if err != nil {
			t.Fatal(err)
		}
		if got := len(S256Challenge(v)); got != 43 {
			t.Errorf("challenge length = %d, want 43", got)
		}
	}
}

// TestChallengeForPlain: the "plain" method (RFC 7636 §4.2) is the verifier
// itself.
func TestChallengeForPlain(t *testing.T) {
	v, err := NewCodeVerifier()
	if err != nil {
		t.Fatal(err)
	}
	c, err := ChallengeFor(v, PKCEPlain)
	if err != nil {
		t.Fatal(err)
	}
	if c != v {
		t.Errorf("plain challenge = %q, want verifier itself", c)
	}
}

// TestChallengeForDefaultsToS256: empty method must mean S256.
func TestChallengeForDefaultsToS256(t *testing.T) {
	v, err := NewCodeVerifier()
	if err != nil {
		t.Fatal(err)
	}
	c, err := ChallengeFor(v, "")
	if err != nil {
		t.Fatal(err)
	}
	if c != S256Challenge(v) {
		t.Error("empty method should default to S256")
	}
}

// TestChallengeForUnknownMethod rejects anything RFC 7636 does not define.
func TestChallengeForUnknownMethod(t *testing.T) {
	if _, err := ChallengeFor(rfc7636Verifier, "MD5"); err == nil {
		t.Error("unknown challenge method should error")
	}
}

// TestIsValidVerifier covers the RFC 7636 §4.1 grammar edge cases.
func TestIsValidVerifier(t *testing.T) {
	valid := []string{
		rfc7636Verifier, // the RFC's own example, exactly 43 chars
		"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~", // 66 chars, all classes
	}
	for _, v := range valid {
		if !IsValidVerifier(v) {
			t.Errorf("expected %q to be a valid verifier", v)
		}
	}
	invalid := []string{
		"",
		"short", // too short
		"a",     // too short
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~x", // 133 chars, too long
		"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~ ",                                                                   // space
		"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~+",                                                                   // '+'
		"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~/",                                                                   // '/'
		"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~=",                                                                   // '='
		"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~é",                                                                   // non-ASCII
	}
	for _, v := range invalid {
		if IsValidVerifier(v) {
			t.Errorf("expected %q to be an invalid verifier", v)
		}
	}
}
