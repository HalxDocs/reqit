package onceo

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/sha512"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"
)

const (
	SHA512HexLength          = 128
	SHA256HexLength          = 64
	MaxBodySize              = 1 << 20
	MaxProviderEventIDLength = 256
)

func VerifyHMACSHA512(secret []byte, body []byte, signature string) error {
	if len(signature) != SHA512HexLength {
		return ErrInvalidSignature
	}
	mac := hmac.New(sha512.New, secret)
	mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))
	if subtle.ConstantTimeCompare([]byte(expected), []byte(signature)) != 1 {
		return ErrInvalidSignature
	}
	return nil
}

func VerifyHMACSHA256(secret []byte, body []byte, signature string) error {
	if len(signature) != SHA256HexLength {
		return ErrInvalidSignature
	}
	mac := hmac.New(sha256.New, secret)
	mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))
	if subtle.ConstantTimeCompare([]byte(expected), []byte(signature)) != 1 {
		return ErrInvalidSignature
	}
	return nil
}

func ExtractHeader(headers http.Header, key string) (string, error) {
	return SingleHeader(headers, key)
}

func SingleHeader(headers http.Header, key string) (string, error) {
	values := headers.Values(key)
	switch len(values) {
	case 0:
		return "", fmt.Errorf("%w: missing %s header", ErrMissingHeader, key)
	case 1:
		return strings.TrimSpace(values[0]), nil
	default:
		return "", fmt.Errorf("%w: multiple %s headers present", ErrDuplicateHeader, key)
	}
}
