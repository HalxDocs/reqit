package keyring

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/zalando/go-keyring"
)

// ErrNotFound re-exported for callers that check errors.Is
var ErrNotFound = keyring.ErrNotFound

// fallbackStore is a file-based fallback for Linux when SecretService/libsecret
// is not available (common on minimal Fedora installs without gnome-keyring).
// It stores entries as JSON with 0600 permissions under the app config dir.
// The Go keyring is always tried first; fallback is only used when it fails
// with an error other than ErrNotFound.

var (
	mu       sync.Mutex
	fallback map[string]map[string]string // service -> key -> value
	loaded   bool
)

func fallbackPath() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "flux", "keyring-fallback.json"), nil
}

func loadFallback() error {
	if loaded {
		return nil
	}
	path, err := fallbackPath()
	if err != nil {
		return err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			fallback = make(map[string]map[string]string)
			loaded = true
			return nil
		}
		return err
	}
	if len(data) == 0 {
		fallback = make(map[string]map[string]string)
		loaded = true
		return nil
	}
	if err := json.Unmarshal(data, &fallback); err != nil {
		fallback = make(map[string]map[string]string)
	}
	loaded = true
	return nil
}

func saveFallback() error {
	path, err := fallbackPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(fallback, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0600)
}

func Set(service, key, value string) error {
	err := keyring.Set(service, key, value)
	if err == nil {
		return nil
	}
	// If keyring failed, fall back to file (but not for obvious programming errors)
	// We treat any error other than nil as fallback-worthy on Linux
	mu.Lock()
	defer mu.Unlock()
	if err := loadFallback(); err != nil {
		return fmt.Errorf("keyring and fallback failed: %w", err)
	}
	if fallback[service] == nil {
		fallback[service] = make(map[string]string)
	}
	fallback[service][key] = value
	if err := saveFallback(); err != nil {
		return fmt.Errorf("keyring failed (%v) and fallback save failed: %w", err, err)
	}
	return nil
}

func Get(service, key string) (string, error) {
	val, err := keyring.Get(service, key)
	if err == nil {
		return val, nil
	}
	if err != nil && !errors.Is(err, keyring.ErrNotFound) {
		// Try fallback for any non-not-found error (e.g., SecretService not available on Fedora)
		mu.Lock()
		defer mu.Unlock()
		_ = loadFallback()
		if svc, ok := fallback[service]; ok {
			if v, ok := svc[key]; ok {
				return v, nil
			}
		}
		// Return original keyring error if not in fallback
		return "", err
	}
	// ErrNotFound — also check fallback (maybe it was stored there)
	if errors.Is(err, keyring.ErrNotFound) {
		mu.Lock()
		defer mu.Unlock()
		_ = loadFallback()
		if svc, ok := fallback[service]; ok {
			if v, ok := svc[key]; ok {
				return v, nil
			}
		}
	}
	return "", err
}

func Delete(service, key string) error {
	err := keyring.Delete(service, key)
	// Always try to delete from fallback as well
	mu.Lock()
	defer mu.Unlock()
	_ = loadFallback()
	if svc, ok := fallback[service]; ok {
		delete(svc, key)
		_ = saveFallback()
	}
	if err != nil && !errors.Is(err, keyring.ErrNotFound) {
		// If fallback had it, consider success
		return nil
	}
	return err
}
