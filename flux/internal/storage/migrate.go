package storage

import (
	"fmt"
	"os"
	"path/filepath"
)

// legacyPaths are the files reqit used to write at the root of a workspace,
// before the data moved into the .reqit directory. They are moved rather
// than copied, so a migrated repository stops carrying them at the root —
// which is where the .gitignore rules did not cover them.
var legacyPaths = []struct {
	from string // relative to the workspace root
	to   string // relative to the .reqit directory
}{
	{from: "collections", to: "collections"}, // directory
	{from: "environments.json", to: "environments.json"},
	{from: "history.json", to: "history.json"},
	{from: "runhistory.json", to: "runhistory.json"},
	{from: "sockhistory.json", to: "sockhistory.json"},
	{from: "events.json", to: "events.json"},
	{from: "mcp_traffic.json", to: "mcp_traffic.json"},
	{from: "testsuites.json", to: "testsuites.json"},
	{from: "devprofile.json", to: "devprofile.json"},
	{from: ".reqit-cookies.json", to: "cookies.json"},
}

// MigrateToDataDir moves the files reqit used to keep at the root of a
// workspace into the .reqit directory.
//
// Older versions wrote collections, environments and history straight into the
// user's repository root, where the .gitignore rules reqit writes did not
// cover them — so an API key in an environment was committed and pushed. The
// data is moved rather than copied so the root is left clean.
//
// A file is only moved when its destination does not already exist, so a
// repository that was already migrated is left alone. Returns the paths that
// were moved.
func MigrateToDataDir(workspaceDir string) ([]string, error) {
	if workspaceDir == "" {
		return nil, nil
	}
	dataDir := DataDir(workspaceDir)

	var moved []string
	for _, item := range legacyPaths {
		src := filepath.Join(workspaceDir, item.from)
		dst := filepath.Join(dataDir, item.to)

		info, err := os.Stat(src)
		if err != nil || !info.IsDir() && info.Size() == 0 {
			continue
		}
		if _, err := os.Stat(dst); err == nil {
			// The destination already exists — leave both alone rather than
			// overwriting data that is already in the new location.
			continue
		}

		if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
			return moved, fmt.Errorf("create %s: %w", filepath.Dir(dst), err)
		}
		if err := os.Rename(src, dst); err != nil {
			return moved, fmt.Errorf("move %s: %w", src, err)
		}
		moved = append(moved, item.from)
	}
	return moved, nil
}
