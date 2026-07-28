// Package storage provides atomic JSON file IO scoped to the Flux app data
// directory under the OS user config dir.
//
// Per-collection storage helpers:
//
//	CollectionDir(dir)        -> <dir>/collections/
//	CollectionFile(dir, id)   -> <dir>/collections/<id>.json
//	IndexFile(dir)            -> <dir>/collections/index.json
package storage

import (
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"sync"
	"time"
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
// CollectionDir returns the per-collection subdirectory within dir.
func CollectionDir(dir string) string {
	return filepath.Join(dir, "collections")
}

// CollectionFile returns the path of a single collection file.
func CollectionFile(dir, collID string) string {
	return filepath.Join(CollectionDir(dir), collID+".json")
}

// IndexFile returns the path of the collections index file.
func IndexFile(dir string) string {
	return filepath.Join(CollectionDir(dir), "index.json")
}

// CollectionFileExists checks whether a single collection file exists on disk.
func CollectionFileExists(dir, collID string) bool {
	_, err := os.Stat(CollectionFile(dir, collID))
	return err == nil
}

// MigrateFromOldFormat reads the legacy collections.json, writes each
// collection as an individual file + index.json, and renames the legacy file
// to collections.json.bak.  Returns true if migration happened.
func MigrateFromOldFormat(dir string) (bool, error) {
	oldPath := filepath.Join(dir, "collections.json")
	_, err := os.Stat(oldPath)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return false, nil
		}
		return false, err
	}
	// Check if new format already exists — if so, skip.
	idxPath := IndexFile(dir)
	if _, err := os.Stat(idxPath); err == nil {
		return false, nil
	}
	// Read legacy file.
	type modelsEnvVar struct {
		Key     string `json:"key"`
		Value   string `json:"value"`
		Enabled bool   `json:"enabled"`
	}
	var w struct {
		Collections []struct {
			ID          string            `json:"id"`
			Name        string            `json:"name"`
			Description string            `json:"description,omitempty"`
			SpecPath    string            `json:"spec,omitempty"`
			Public      bool              `json:"public,omitempty"`
			Variables   []modelsEnvVar    `json:"variables,omitempty"`
			PreScript   string            `json:"preScript,omitempty"`
			PostScript  string            `json:"postScript,omitempty"`
			Requests    []json.RawMessage `json:"requests"`
		} `json:"collections"`
	}
	data, err := os.ReadFile(oldPath)
	if err != nil {
		return false, err
	}
	if err := json.Unmarshal(data, &w); err != nil {
		return false, err
	}
	if len(w.Collections) == 0 {
		return false, nil
	}
	// Create collections dir.
	collDir := CollectionDir(dir)
	if err := os.MkdirAll(collDir, 0o755); err != nil {
		return false, err
	}
	// Write each collection as its own file and build index.
	var idx struct {
		Collections []struct {
			ID        string `json:"id"`
			Name      string `json:"name"`
			Order     int    `json:"order"`
			UpdatedAt string `json:"updatedAt"`
		} `json:"collections"`
	}
	for i, c := range w.Collections {
		// Preserve original content by writing the raw JSON unchanged.
		raw := map[string]interface{}{
			"id":          c.ID,
			"name":        c.Name,
			"description": c.Description,
			"spec":        c.SpecPath,
			"public":      c.Public,
			"variables":   c.Variables,
			"preScript":   c.PreScript,
			"postScript":  c.PostScript,
			"requests":    c.Requests,
		}
		cf := CollectionFile(dir, c.ID)
		rawData, err := json.MarshalIndent(raw, "", "  ")
		if err != nil {
			return false, err
		}
		if err := os.WriteFile(cf+".tmp", rawData, 0o644); err != nil {
			return false, err
		}
		if err := os.Rename(cf+".tmp", cf); err != nil {
			return false, err
		}
		idx.Collections = append(idx.Collections, struct {
			ID        string `json:"id"`
			Name      string `json:"name"`
			Order     int    `json:"order"`
			UpdatedAt string `json:"updatedAt"`
		}{
			ID:        c.ID,
			Name:      c.Name,
			Order:     i,
			UpdatedAt: timeNow().UTC().Format(time3339),
		})
	}
	idxData, err := json.MarshalIndent(idx, "", "  ")
	if err != nil {
		return false, err
	}
	if err := os.WriteFile(idxPath+".tmp", idxData, 0o644); err != nil {
		return false, err
	}
	if err := os.Rename(idxPath+".tmp", idxPath); err != nil {
		return false, err
	}
	// Rename legacy file.
	if err := os.Rename(oldPath, oldPath+".bak"); err != nil {
		return false, err
	}
	return true, nil
}

func timeNow() time.Time { return time.Now() }

const time3339 = time.RFC3339

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
