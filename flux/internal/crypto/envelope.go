package crypto

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
)

// Envelope is the on-disk format of an encrypted file. It is JSON so a reader
// can tell an encrypted file from a plain one without guessing, and so the
// format can gain fields later without breaking older files.
type Envelope struct {
	Version int    `json:"v"`
	Cipher  string `json:"cipher"`
	Data    string `json:"data"` // base64 of the ciphertext
}

// EnvelopeVersion is the current envelope format version.
const EnvelopeVersion = 1

// ErrNotEncrypted is returned when a file is not in the encrypted format.
var ErrNotEncrypted = errors.New("not an encrypted file")

// Seal encrypts v and returns the bytes to write to disk.
func (s *Store) Seal(v interface{}) ([]byte, error) {
	ciphertext, err := s.EncryptJSON(v)
	if err != nil {
		return nil, err
	}
	return json.Marshal(Envelope{
		Version: EnvelopeVersion,
		Cipher:  "aes-256-gcm",
		Data:    base64.StdEncoding.EncodeToString(ciphertext),
	})
}

// Open decrypts the bytes of an encrypted file into v.
func (s *Store) Open(data []byte, v interface{}) error {
	env, err := ParseEnvelope(data)
	if err != nil {
		return err
	}
	ciphertext, err := base64.StdEncoding.DecodeString(env.Data)
	if err != nil {
		return fmt.Errorf("decode encrypted data: %w", err)
	}
	plaintext, err := s.Decrypt(ciphertext)
	if err != nil {
		return fmt.Errorf("decrypt: %w", err)
	}
	return json.Unmarshal(plaintext, v)
}

// ParseEnvelope reports whether data is in the encrypted format and returns it.
func ParseEnvelope(data []byte) (Envelope, error) {
	var env Envelope
	if err := json.Unmarshal(data, &env); err != nil {
		return env, ErrNotEncrypted
	}
	if env.Version == 0 || env.Cipher == "" || env.Data == "" {
		return env, ErrNotEncrypted
	}
	return env, nil
}

// IsEncrypted reports whether data is in the encrypted format.
func IsEncrypted(data []byte) bool {
	_, err := ParseEnvelope(data)
	return err == nil
}
