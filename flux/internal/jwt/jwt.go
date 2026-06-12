package jwt

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

type Header struct {
	Alg string `json:"alg"`
	Typ string `json:"typ"`
	Kid string `json:"kid,omitempty"`
}

type Claims struct {
	Iss   string `json:"iss,omitempty"`
	Sub   string `json:"sub,omitempty"`
	Aud   string `json:"aud,omitempty"`
	Exp   int64  `json:"exp,omitempty"`
	Nbf   int64  `json:"nbf,omitempty"`
	Iat   int64  `json:"iat,omitempty"`
	JTI   string `json:"jti,omitempty"`
	Extra map[string]interface{} `json:"-"`
}

type DecodedToken struct {
	Header  Header                 `json:"header"`
	Claims  map[string]interface{} `json:"claims"`
	Valid   bool                   `json:"valid"`
	Expired bool                   `json:"expired"`
	Error   string                 `json:"error,omitempty"`
}

func pad(s string) string {
	if m := len(s) % 4; m != 0 {
		s += strings.Repeat("=", 4-m)
	}
	return s
}

func Decode(token string) *DecodedToken {
	result := &DecodedToken{}

	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		result.Error = "invalid JWT format: expected 3 parts"
		return result
	}

	// Decode header
	hBytes, err := base64.RawURLEncoding.DecodeString(pad(parts[0]))
	if err != nil {
		// try padded
		hBytes, err = base64.StdEncoding.DecodeString(parts[0])
		if err != nil {
			result.Error = "failed to decode header: " + err.Error()
			return result
		}
	}
	json.Unmarshal(hBytes, &result.Header)

	// Decode claims
	cBytes, err := base64.RawURLEncoding.DecodeString(pad(parts[1]))
	if err != nil {
		cBytes, err = base64.StdEncoding.DecodeString(parts[1])
		if err != nil {
			result.Error = "failed to decode claims: " + err.Error()
			return result
		}
	}
	json.Unmarshal(cBytes, &result.Claims)

	// Check expiration
	if exp, ok := result.Claims["exp"]; ok {
		if expFloat, ok := exp.(float64); ok {
			expTime := time.Unix(int64(expFloat), 0)
			result.Valid = time.Now().Before(expTime)
			result.Expired = !result.Valid
		}
	}

	return result
}
