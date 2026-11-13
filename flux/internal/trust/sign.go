package trust

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"sync"
	"testing"

	"flux/internal/keyring"
)

// Receipts are signed with a key that lives outside the workspace (the OS
// keychain, with the existing 0600 file fallback). The signature covers Hash,
// so an attacker who edits a receipt and recomputes the hash still cannot
// produce a valid signature without the key. This is not tamper-proof — anyone
// who can read the key can sign anything — but it makes a receipt edited in a
// repository detectable, which is the threat that matters for shareable
// receipts.
const (
	receiptKeyService = "reqit-receipts"
	receiptKeyName    = "signing-key"
	signaturePrefix   = "hmac-sha256:"
)

var errNoSigningKey = errors.New("receipt signing key unavailable")

var (
	receiptKeyOnce sync.Once
	receiptKey     []byte
	receiptKeyErr  error
)

// loadReceiptKey returns the process-wide signing key, creating one on first
// use. Test binaries never create or read a key: tests that exercise signing
// inject one with SetSigningKey, so `go test` cannot touch the user's keychain.
func loadReceiptKey() ([]byte, error) {
	receiptKeyOnce.Do(func() {
		if testing.Testing() {
			receiptKeyErr = errNoSigningKey
			return
		}
		raw, err := keyring.Get(receiptKeyService, receiptKeyName)
		switch {
		case errors.Is(err, keyring.ErrNotFound):
			key := make([]byte, 32)
			if _, err := rand.Read(key); err != nil {
				receiptKeyErr = fmt.Errorf("trust: generate signing key: %w", err)
				return
			}
			if err := keyring.Set(receiptKeyService, receiptKeyName, hex.EncodeToString(key)); err != nil {
				receiptKeyErr = fmt.Errorf("trust: store signing key: %w", err)
				return
			}
			receiptKey = key
		case err != nil:
			receiptKeyErr = fmt.Errorf("trust: read signing key: %w", err)
		default:
			key, err := hex.DecodeString(raw)
			if err != nil || len(key) != 32 {
				receiptKeyErr = errors.New("trust: signing key is malformed")
				return
			}
			receiptKey = key
		}
	})
	return receiptKey, receiptKeyErr
}

// signingKey resolves this store's key once.
func (s *Store) signingKey() ([]byte, bool) {
	if s.signResolved {
		return s.signKey, s.signKey != nil
	}
	s.signResolved = true
	key, err := loadReceiptKey()
	if err != nil {
		return nil, false
	}
	s.signKey = key
	return key, true
}

func keyID(key []byte) string {
	sum := sha256.Sum256(key)
	return hex.EncodeToString(sum[:8])
}

func signHash(key []byte, hash string) string {
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(hash))
	return signaturePrefix + hex.EncodeToString(mac.Sum(nil))
}

// applySignature signs r in place when a key is available. An unsigned receipt
// is still useful; verification reports it separately.
func (s *Store) applySignature(r *Receipt) {
	key, ok := s.signingKey()
	if !ok {
		r.KeyID = ""
		r.Signature = ""
		return
	}
	r.KeyID = keyID(key)
	r.Signature = signHash(key, r.Hash)
}

// verifySignature checks r's signature. It returns (false, nil) for an
// unsigned receipt, so the caller can report it rather than reject it.
func (s *Store) verifySignature(r *Receipt) (bool, error) {
	if r.Signature == "" {
		return false, nil
	}
	key, ok := s.signingKey()
	if !ok {
		return false, fmt.Errorf("receipt %s is signed with key %s, but the signing key is unavailable", r.ID, r.KeyID)
	}
	if r.KeyID != keyID(key) {
		return false, fmt.Errorf("receipt %s was signed with a different key", r.ID)
	}
	want := signHash(key, r.Hash)
	if !hmac.Equal([]byte(want), []byte(r.Signature)) {
		return false, fmt.Errorf("receipt %s has an invalid signature", r.ID)
	}
	return true, nil
}
