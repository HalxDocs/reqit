package eventinspector

import (
	"errors"

	keyring "flux/internal/keyring"
)

const keyringSvc = "flux-eventinspector"
const keyringKey = "svix-secret"

// SecretStore persists the webhook signing secret in the OS keychain
// (Windows Credential Manager, macOS Keychain, Linux Secret Service). The
// secret never touches disk outside the keychain.
type SecretStore struct {
	cached string
	loaded bool
}

func NewSecretStore() *SecretStore {
	return &SecretStore{}
}

// Set stores the signing secret in the OS keychain.
func (s *SecretStore) Set(secret string) error {
	if secret == "" {
		return errors.New("eventinspector: secret must not be empty")
	}
	if err := keyring.Set(keyringSvc, keyringKey, secret); err != nil {
		return err
	}
	s.cached = secret
	s.loaded = true
	return nil
}

// Get returns the stored signing secret, or an empty string when none is set.
func (s *SecretStore) Get() string {
	if s.loaded {
		return s.cached
	}
	v, err := keyring.Get(keyringSvc, keyringKey)
	if err != nil {
		s.cached = ""
		s.loaded = true
		return ""
	}
	s.cached = v
	s.loaded = true
	return v
}

// Has reports whether a secret is configured.
func (s *SecretStore) Has() bool { return s.Get() != "" }

// Delete removes the stored secret from the OS keychain.
func (s *SecretStore) Delete() error {
	s.cached = ""
	s.loaded = true
	return keyring.Delete(keyringSvc, keyringKey)
}
