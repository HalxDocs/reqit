// Package storage provides atomic JSON file IO scoped to the Flux app data
// directory under the OS user config dir.
package storage

import (
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"sync"
)

const appDirName = "flux"

var (
	once    sync.Once
	cached  string
	initErr error
)

// AppDir returns (and creates) the Flux app data directory.
// Windows: %APPDATA%\flux  macOS: ~/Library/Application Support/flux
// Linux: ~/.config/flux
func AppDir() (string, error) {
	once.Do(func() {
		base, err := os.UserConfigDir()
		if err != nil {
			initErr = err
			return
		}
		dir := filepath.Join(base, appDirName)
		if err := os.MkdirAll(dir, 0o755); err != nil {
			initErr = err
			return
		}
		cached = dir
	})
	return cached, initErr
}

// Load reads and JSON-decodes the named file from the app dir into out.
// Returns nil if the file does not exist (out is left untouched).
func Load(name string, out any) error {
	dir, err := AppDir()
	if err != nil {
		return err
	}
	return LoadFrom(dir, name, out)
}

// LoadFrom reads and JSON-decodes the named file from the given directory.
// Returns nil if the file does not exist (out is left untouched).
func LoadFrom(dir, name string, out any) error {
	path := filepath.Join(dir, name)
	data, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return nil
		}
		return err
	}
	if len(data) == 0 {
		return nil
	}
	return json.Unmarshal(data, out)
}

// Save JSON-encodes value and atomically writes it to the named file in the
// app dir.
func Save(name string, value any) error {
	dir, err := AppDir()
	if err != nil {
		return err
	}
	return SaveTo(dir, name, value)
}

// SaveTo JSON-encodes value and atomically writes it to the named file in the
// given directory (write to <name>.tmp then rename so a crash mid-write
// cannot truncate the prior file).
func SaveTo(dir, name string, value any) error {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	path := filepath.Join(dir, name)
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}
