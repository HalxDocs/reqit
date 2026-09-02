package testutil

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/base64"
	"encoding/hex"
	"strings"
)

// SignSvix returns the "v1,<signature>" header value for a Svix-style
// delivery. The signing key is the base64-decoded remainder of the secret
// (after any "whsec_" prefix); if that fails, the raw secret bytes are used.
func SignSvix(secret, msgID, timestamp string, body []byte) string {
	raw := strings.TrimPrefix(secret, "whsec_")
	key, err := base64.StdEncoding.DecodeString(raw)
	if err != nil || len(key) == 0 {
		key = []byte(secret)
	}
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(msgID))
	mac.Write([]byte("."))
	mac.Write([]byte(timestamp))
	mac.Write([]byte("."))
	mac.Write(body)
	return "v1," + base64.StdEncoding.EncodeToString(mac.Sum(nil))
}

// SignBachs returns the hex-encoded HMAC-SHA256 of "{timestamp}.{body}" with
// the given secret, matching Bachs' webhook signing scheme.
func SignBachs(secret, timestamp string, body []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(timestamp))
	mac.Write([]byte("."))
	mac.Write(body)
	return hex.EncodeToString(mac.Sum(nil))
}

func SignHMACSHA512(secret []byte, body []byte) string {
	mac := hmac.New(sha512.New, secret)
	mac.Write(body)
	return hex.EncodeToString(mac.Sum(nil))
}

func SignHMACSHA256(secret []byte, body []byte) string {
	mac := hmac.New(sha256.New, secret)
	mac.Write(body)
	return hex.EncodeToString(mac.Sum(nil))
}

// HashSHA256 returns the hex-encoded SHA-256 digest of data.
// Flutterwave's Verif-Hash is SHA256(secretHash), NOT an HMAC.
func HashSHA256(data []byte) string {
	h := sha256.Sum256(data)
	return hex.EncodeToString(h[:])
}
