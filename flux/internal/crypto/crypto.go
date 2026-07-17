package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"

	"golang.org/x/crypto/argon2"
	"github.com/zalando/go-keyring"
)

const keyringSvc = "flux-crypto"
const saltLen = 16
const keyLen = 32 // AES-256

// Store manages E2EE keys and provides encrypt/decrypt operations.
type Store struct {
	appDataDir string
}

// New creates a crypto store.
func New(appDataDir string) *Store {
	return &Store{appDataDir: appDataDir}
}

// HasKey reports whether an encryption key exists in the OS keychain.
func (s *Store) HasKey() bool {
	_, err := keyring.Get(keyringSvc, "e2ee-key")
	return err == nil
}

// GenerateKey creates a new random key and stores it in the OS keychain.
func (s *Store) GenerateKey() error {
	key := make([]byte, keyLen)
	if _, err := rand.Read(key); err != nil {
		return fmt.Errorf("rand: %w", err)
	}
	return keyring.Set(keyringSvc, "e2ee-key", hex.EncodeToString(key))
}

// SetKey stores a user-provided passphrase-derived key.
func (s *Store) SetKey(passphrase string) error {
	salt := make([]byte, saltLen)
	if _, err := rand.Read(salt); err != nil {
		return fmt.Errorf("salt: %w", err)
	}
	key := argon2.IDKey([]byte(passphrase), salt, 1, 64*1024, 4, keyLen)
	blob, err := json.Marshal(map[string]string{
		"salt": hex.EncodeToString(salt),
		"key":  hex.EncodeToString(key),
	})
	if err != nil {
		return fmt.Errorf("failed to marshal key: %w", err)
	}
	return keyring.Set(keyringSvc, "e2ee-key", string(blob))
}

// DeleteKey removes the encryption key from the OS keychain.
func (s *Store) DeleteKey() error {
	return keyring.Delete(keyringSvc, "e2ee-key")
}

func (s *Store) loadKey() ([]byte, error) {
	raw, err := keyring.Get(keyringSvc, "e2ee-key")
	if err != nil {
		if errors.Is(err, keyring.ErrNotFound) {
			return nil, errors.New("no encryption key set — use GenerateKey or SetKey first")
		}
		return nil, err
	}
	// Try parsing as JSON blob (passphrase-derived, hex-encoded)
	var blob map[string]string
	if json.Unmarshal([]byte(raw), &blob) == nil && blob["key"] != "" {
		key, err := hex.DecodeString(blob["key"])
		if err != nil {
			return nil, fmt.Errorf("invalid key encoding: %w", err)
		}
		return key, nil
	}
	// Try hex-encoded raw key
	if key, err := hex.DecodeString(raw); err == nil && len(key) == keyLen {
		return key, nil
	}
	// Legacy: raw bytes (for backward compatibility)
	return []byte(raw), nil
}

// Encrypt encrypts plaintext using AES-256-GCM.
func (s *Store) Encrypt(plaintext []byte) ([]byte, error) {
	key, err := s.loadKey()
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}
	return gcm.Seal(nonce, nonce, plaintext, nil), nil
}

// Decrypt decrypts ciphertext using AES-256-GCM.
func (s *Store) Decrypt(ciphertext []byte) ([]byte, error) {
	key, err := s.loadKey()
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return nil, errors.New("ciphertext too short")
	}
	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	return gcm.Open(nil, nonce, ciphertext, nil)
}

// EncryptJSON marshals v to JSON, then encrypts it.
func (s *Store) EncryptJSON(v interface{}) ([]byte, error) {
	data, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	return s.Encrypt(data)
}

// DecryptJSON decrypts data and unmarshals into v.
func (s *Store) DecryptJSON(data []byte, v interface{}) error {
	plain, err := s.Decrypt(data)
	if err != nil {
		return err
	}
	return json.Unmarshal(plain, v)
}
