package git

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// ReqitInit creates the .reqit/ directory structure and updates .gitignore.
// This is the Git-native onboarding moment.
func ReqitInit(repoRoot string) error {
	reqitDir := filepath.Join(repoRoot, ".reqit")
	dirs := []string{
		filepath.Join(reqitDir, "collections"),
		filepath.Join(reqitDir, "environments"),
		filepath.Join(reqitDir, "exports"),
	}

	for _, d := range dirs {
		if err := os.MkdirAll(d, 0755); err != nil {
			return fmt.Errorf("create dir %s: %w", d, err)
		}
	}

	// Write or update .gitignore
	gitignorePath := filepath.Join(repoRoot, ".gitignore")
	entry := "\n# reqit — never commit secret environments or local overrides\n.reqit/**/*.secrets.json\n.reqit/**/local.json\n"
	return appendIfMissing(gitignorePath, entry)
}

// appendIfMissing appends text to a file if it doesn't already contain it.
func appendIfMissing(path, text string) error {
	existing := ""
	if data, err := os.ReadFile(path); err == nil {
		existing = string(data)
	}

	if strings.Contains(existing, text) {
		return nil // already present
	}

	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return fmt.Errorf("open %s: %w", path, err)
	}
	defer f.Close()

	if _, err := f.WriteString(text); err != nil {
		return fmt.Errorf("write %s: %w", path, err)
	}
	return nil
}

// IsReqitRepo returns true if the repo root has a .reqit/ directory.
func IsReqitRepo(repoRoot string) bool {
	info, err := os.Stat(filepath.Join(repoRoot, ".reqit"))
	return err == nil && info.IsDir()
}
