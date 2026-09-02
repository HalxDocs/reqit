package onceo

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/hex"
	"errors"
	"net/http"
	"testing"
)

func TestVerifyHMACSHA512(t *testing.T) {
	secret := []byte("test-secret-key")
	body := []byte(`{"event":"charge.success","data":{"id":"123"}}`)

	mac := hmac.New(sha512.New, secret)
	mac.Write(body)
	validSig := hex.EncodeToString(mac.Sum(nil))

	tests := []struct {
		name      string
		secret    []byte
		body      []byte
		signature string
		wantErr   bool
	}{
		{"valid signature", secret, body, validSig, false},
		{"wrong body", secret, []byte(`{"event":"charge.failed"}`), validSig, true},
		{"wrong secret", []byte("wrong-secret"), body, validSig, true},
		{"empty signature", secret, body, "", true},
		{"tampered signature", secret, body, "abc123", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := VerifyHMACSHA512(tt.secret, tt.body, tt.signature)
			if (err != nil) != tt.wantErr {
				t.Errorf("VerifyHMACSHA512() error = %v, wantErr %v", err, tt.wantErr)
			}
			if !tt.wantErr && err != nil {
				t.Errorf("unexpected error: %v", err)
			}
		})
	}
}

func TestVerifyHMACSHA512ConstantTime(t *testing.T) {
	secret := []byte("test-secret-key")
	body := []byte(`{"event":"charge.success"}`)

	mac := hmac.New(sha512.New, secret)
	mac.Write(body)
	validSig := hex.EncodeToString(mac.Sum(nil))

	err := VerifyHMACSHA512(secret, body, validSig)
	if err != nil {
		t.Errorf("expected no error, got %v", err)
	}
}

func TestExtractHeader(t *testing.T) {
	headers := http.Header{}
	headers.Set("X-Paystack-Signature", "test_sig")

	tests := []struct {
		name    string
		key     string
		want    string
		wantErr bool
	}{
		{"existing header", "X-Paystack-Signature", "test_sig", false},
		{"missing header", "X-Missing", "", true},
		{"case insensitive", "x-paystack-signature", "test_sig", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ExtractHeader(headers, tt.key)
			if (err != nil) != tt.wantErr {
				t.Errorf("ExtractHeader() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("ExtractHeader() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestVerifyWithExtractHeader(t *testing.T) {
	secret := []byte("sk_test_key")
	body := []byte(`{"event":"charge.success"}`)

	mac := hmac.New(sha512.New, secret)
	mac.Write(body)
	sig := hex.EncodeToString(mac.Sum(nil))

	headers := http.Header{}
	headers.Set("X-Paystack-Signature", sig)

	signature, err := ExtractHeader(headers, "X-Paystack-Signature")
	if err != nil {
		t.Fatalf("ExtractHeader failed: %v", err)
	}

	if err := VerifyHMACSHA512(secret, body, signature); err != nil {
		t.Errorf("VerifyHMACSHA512 failed: %v", err)
	}
}

func TestVerifyHMACSHA256(t *testing.T) {
	secret := []byte("test-secret-key")
	body := []byte(`{"event":"charge.completed"}`)

	mac := hmac.New(sha256.New, secret)
	mac.Write(body)
	validSig := hex.EncodeToString(mac.Sum(nil))

	if err := VerifyHMACSHA256(secret, body, validSig); err != nil {
		t.Errorf("VerifyHMACSHA256 failed: %v", err)
	}

	if err := VerifyHMACSHA256(secret, body, "too-short"); err == nil {
		t.Error("expected error for short signature")
	}
}

func TestVerifyHMACSHA512WrongLength(t *testing.T) {
	secret := []byte("key")
	body := []byte(`{}`)

	tests := []struct {
		name      string
		signature string
	}{
		{"too short", "abc"},
		{"too long", "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890xxx"},
		{"empty", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := VerifyHMACSHA512(secret, body, tt.signature); err == nil {
				t.Error("expected error for wrong-length signature")
			}
		})
	}
}

func TestVerifyHMACSHA256WrongContent(t *testing.T) {
	secret := []byte("key")
	body := []byte(`{}`)

	sig := "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	if err := VerifyHMACSHA256(secret, body, sig); err == nil {
		t.Error("expected error for wrong signature content")
	}
}

func TestVerifyHMACSHA256WrongLength(t *testing.T) {
	secret := []byte("key")
	body := []byte(`{}`)

	if err := VerifyHMACSHA256(secret, body, "short"); err == nil {
		t.Error("expected error for short signature")
	}
}

func TestSingleHeader_Missing_ReturnsErrMissingHeader(t *testing.T) {
	_, err := SingleHeader(http.Header{}, "X-Test")
	if !errors.Is(err, ErrMissingHeader) {
		t.Fatalf("expected ErrMissingHeader, got %v", err)
	}
}

func TestSingleHeader_Duplicate_ReturnsErrDuplicateHeader(t *testing.T) {
	h := http.Header{"X-Test": {"a", "b"}}
	_, err := SingleHeader(h, "X-Test")
	if !errors.Is(err, ErrDuplicateHeader) {
		t.Fatalf("expected ErrDuplicateHeader, got %v", err)
	}
}

func TestSingleHeader_Single_ReturnsValue(t *testing.T) {
	h := http.Header{}
	h.Set("X-Test", "value")
	got, err := SingleHeader(h, "X-Test")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != "value" {
		t.Fatalf("got %q, want %q", got, "value")
	}
}
