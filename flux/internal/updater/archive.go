package updater

import (
	"archive/zip"
	"bytes"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// isZip reports whether data starts with the zip magic header. The macOS
// release is a zip, and a zip cannot be handed to selfupdate — it expects a
// raw executable — so the archive has to be unpacked first.
func isZip(data []byte) bool {
	return len(data) > 3 && data[0] == 'P' && data[1] == 'K' &&
		(data[2] == 0x03 || data[2] == 0x05 || data[2] == 0x07)
}

// maxUnpackedSize caps how much a single archive entry may expand to, so a
// malicious archive cannot fill the disk.
const maxUnpackedSize = 512 << 20

// appBundleSuffixes are the names of a macOS application bundle.
var appBundleSuffixes = []string{".app"}

// extractAppFromZip unpacks a macOS application bundle and returns the bytes
// of the executable inside it.
//
// The bundle is written to destDir so the whole thing can replace the running
// one. Only regular files are extracted, and any path that would escape
// destDir is refused.
func extractAppFromZip(data []byte, destDir string) ([]byte, error) {
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, fmt.Errorf("open zip: %w", err)
	}

	if err := os.MkdirAll(destDir, 0o755); err != nil {
		return nil, err
	}

	var executable []byte
	found := false

	for _, entry := range zr.File {
		if entry.FileInfo().IsDir() {
			continue
		}
		// Only regular files: a symlink in the archive could point anywhere.
		if !entry.Mode().IsRegular() {
			continue
		}
		name := filepath.Clean(entry.Name)
		if name == "." || strings.HasPrefix(name, "..") || filepath.IsAbs(name) {
			continue
		}
		target := filepath.Join(destDir, name)
		// Belt and braces: the cleaned name must still be inside destDir.
		if !strings.HasPrefix(target, filepath.Clean(destDir)+string(os.PathSeparator)) {
			continue
		}

		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return nil, err
		}
		if err := extractZipEntry(entry, target); err != nil {
			return nil, err
		}

		if !found && isBundleExecutable(name) {
			content, err := os.ReadFile(target)
			if err != nil {
				return nil, err
			}
			executable = content
			found = true
		}
	}

	if !found {
		return nil, errors.New("no application bundle found in update archive")
	}
	return executable, nil
}

// isBundleExecutable reports whether a path names the executable inside a
// macOS application bundle, e.g. "reqit.app/Contents/MacOS/reqit".
func isBundleExecutable(name string) bool {
	slashed := filepath.ToSlash(name)
	for _, suffix := range appBundleSuffixes {
		if !strings.Contains(slashed, suffix+"/") {
			continue
		}
		// The executable lives in Contents/MacOS/.
		if strings.Contains(slashed, "/Contents/MacOS/") {
			return true
		}
	}
	return false
}

func extractZipEntry(entry *zip.File, target string) error {
	rc, err := entry.Open()
	if err != nil {
		return err
	}
	defer rc.Close()

	out, err := os.OpenFile(target, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o755)
	if err != nil {
		return err
	}
	defer out.Close()

	// Limit the unpacked size so a zip bomb cannot fill the disk.
	_, err = io.Copy(out, io.LimitReader(rc, maxUnpackedSize))
	return err
}
