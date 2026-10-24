package updater

import (
	"os"
	"path/filepath"
	"testing"
)

// assetDir is where the real release assets can be placed for verification.
//
// The archives the release workflow publishes are the ones the updater has to
// handle, so the handling is tested against archives with the same shape and,
// when the real files are available, against the real files themselves.
const assetDir = "/tmp/relassets"

// TestRealPublishedLinuxAsset unpacks the actual tarball published for the
// current release and checks that the executable comes out of it.
func TestRealPublishedLinuxAsset(t *testing.T) {
	path := filepath.Join(assetDir, "linux.tar.gz")
	data, err := os.ReadFile(path)
	if err != nil {
		t.Skipf("release asset not available at %s: %v", path, err)
	}

	if !isGzip(data) {
		t.Fatal("the published Linux asset is not a gzip archive")
	}

	exe, err := extractExecutableFromTarGz(data)
	if err != nil {
		t.Fatalf("the published Linux asset could not be unpacked: %v", err)
	}
	if len(exe) == 0 {
		t.Fatal("the published Linux asset produced an empty executable")
	}
	// A Linux binary starts with the ELF magic.
	if len(exe) < 4 || string(exe[:4]) != "\x7fELF" {
		t.Errorf("the unpacked file is not an ELF executable: %q", exe[:min(4, len(exe))])
	}
	t.Logf("unpacked %d bytes of ELF executable from the published tarball", len(exe))
}

// TestRealPublishedMacOSAsset unpacks the actual zip published for the
// current release. Before the zip was handled, this archive went straight to
// selfupdate, which cannot apply a zip.
func TestRealPublishedMacOSAsset(t *testing.T) {
	path := filepath.Join(assetDir, "macos.zip")
	data, err := os.ReadFile(path)
	if err != nil {
		t.Skipf("release asset not available at %s: %v", path, err)
	}

	if !isZip(data) {
		t.Fatal("the published macOS asset is not a zip archive")
	}

	dir := t.TempDir()
	exe, err := extractAppFromZip(data, dir)
	if err != nil {
		t.Fatalf("the published macOS asset could not be unpacked: %v", err)
	}
	if len(exe) < 4 {
		t.Fatal("the published macOS asset produced an empty executable")
	}
	// A macOS binary starts with the Mach-O magic.
	if string(exe[:4]) != "\xcf\xfa\xed\xfe" && string(exe[:4]) != "\xca\xfe\xba\xbe" {
		t.Errorf("the unpacked file is not a Mach-O executable: %q", exe[:4])
	}

	// The bundle's Info.plist must be unpacked too, or the app would lose it.
	if _, err := os.Stat(filepath.Join(dir, "reqit.app", "Contents", "Info.plist")); err != nil {
		t.Errorf("the application bundle was not fully unpacked: %v", err)
	}
	t.Logf("unpacked %d bytes of Mach-O executable from the published zip", len(exe))
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
