package oauth2

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"math/big"
)

// RFC 7636 §4.1: code_verifier is 43–128 characters drawn from the unreserved
// set ALPHA / DIGIT / "-" / "." / "_" / "~".
const (
	PKCEVerifierMinLen = 43
	PKCEVerifierMaxLen = 128

	// defaultVerifierLen is the generated verifier length. 64 characters is
	// comfortably inside the RFC bounds and gives 384 bits of entropy.
	defaultVerifierLen = 64
)

const pkceCharset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"

var pkceCharsetLen = big.NewInt(int64(len(pkceCharset)))

// NewCodeVerifier returns a cryptographically random code_verifier conforming
// to RFC 7636 §4.1 (43–128 chars from [A-Za-z0-9-._~], rejection-sampled from
// crypto/rand to avoid modulo bias).
func NewCodeVerifier() (string, error) {
	return NewCodeVerifierWithLength(defaultVerifierLen)
}

// NewCodeVerifierWithLength returns a verifier of exactly n characters.
// n must satisfy RFC 7636 §4.1: 43 <= n <= 128.
func NewCodeVerifierWithLength(n int) (string, error) {
	if n < PKCEVerifierMinLen || n > PKCEVerifierMaxLen {
		return "", fmt.Errorf("oauth2: code_verifier length %d out of RFC 7636 §4.1 range [%d, %d]", n, PKCEVerifierMinLen, PKCEVerifierMaxLen)
	}
	b := make([]byte, n)
	for i := range b {
		v, err := rand.Int(rand.Reader, pkceCharsetLen)
		if err != nil {
			return "", fmt.Errorf("oauth2: generate code_verifier: %w", err)
		}
		b[i] = pkceCharset[v.Int64()]
	}
	return string(b), nil
}

// S256Challenge computes BASE64URL-ENCODE(SHA256(ASCII(code_verifier))) per
// RFC 7636 §4.2. The challenge is sent in the authorize request; the raw
// verifier — never the challenge — is sent in the token exchange.
func S256Challenge(verifier string) string {
	sum := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

// ChallengeFor computes the code_challenge for verifier using method. An empty
// method defaults to S256. "plain" returns the verifier itself (RFC 7636 §4.2).
func ChallengeFor(verifier string, method PKCEMethod) (string, error) {
	switch method {
	case PKCES256, "":
		return S256Challenge(verifier), nil
	case PKCEPlain:
		return verifier, nil
	default:
		return "", fmt.Errorf("oauth2: unsupported code challenge method %q", method)
	}
}

// IsValidVerifier reports whether v conforms to RFC 7636 §4.1: length
// 43–128 and only characters from [A-Za-z0-9-._~].
func IsValidVerifier(v string) bool {
	if len(v) < PKCEVerifierMinLen || len(v) > PKCEVerifierMaxLen {
		return false
	}
	for i := 0; i < len(v); i++ {
		c := v[i]
		if !isUnreserved(c) {
			return false
		}
	}
	return true
}

func isUnreserved(c byte) bool {
	return c >= 'A' && c <= 'Z' ||
		c >= 'a' && c <= 'z' ||
		c >= '0' && c <= '9' ||
		c == '-' || c == '.' || c == '_' || c == '~'
}

// NewStateToken returns a random, unguessable state value (RFC 6749 §4.1.1)
// for binding an authorization request to its callback. base64url of 16
// random bytes: 22 URL-safe characters, ~128 bits of entropy.
func NewStateToken() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}
