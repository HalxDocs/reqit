package updater

import (
	"archive/tar"
	"archive/zip"
	"bytes"
	"compress/gzip"
	"os"
	"path/filepath"
	"testing"
)

// These tests run the archive handling against archives shaped exactly like the
// ones the release workflow publishes.
//
//   Linux:   reqit-linux-amd64.tar.gz  containing reqit-linux-amd64,
//            reqit.desktop and reqit.png
//   macOS:   reqit-macos-universal.zip containing reqit.app
//
// A zip cannot be handed to selfupdate, which expects a raw executable, so
// the macOS archive needs its own handling.

func TestExtractExecutableFromTarGzLikeTheLinuxRelease(t *testing.T) {
	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gz)

	// A fake ELF-ish payload, with the same names the release uses.
	exe := []byte("\x7fELF fake linux executable")
	for _, f := range []struct {
		name    string
		content []byte
	}{
		{"reqit.desktop", []byte("[Desktop Entry]\n")},
		{"reqit.png", []byte("\x89PNG")},
		{"reqit-linux-amd64", exe},
	} {
		if err := writeTarFile(tw, f.name, f.content); err != nil {
			t.Fatal(err)
		}
	}
	if err := tw.Close(); err != nil {
		t.Fatal(err)
	}
	if err := gz.Close(); err != nil {
		t.Fatal(err)
	}

	got, err := extractExecutableFromTarGz(buf.Bytes())
	if err != nil {
		t.Fatalf("extractExecutableFromTarGz: %v", err)
	}
	if !bytes.Equal(got, exe) {
		t.Errorf("extracted the wrong file: %q", got)
	}
}

// The tarball holds a desktop file and an icon before the executable. The
// extractor must pick the executable, not the first file it sees.
func TestExtractExecutablePrefersTheBinary(t *testing.T) {
	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gz)
	for _, name := range []string{"reqit.desktop", "reqit.png", "reqit-linux-amd64"} {
		content := []byte("content of " + name)
		if name == "reqit-linux-amd64" {
			content = []byte("\x7fELF the real binary")
		}
		if err := writeTarFile(tw, name, content); err != nil {
			t.Fatal(err)
		}
	}
	if err := tw.Close(); err != nil {
		t.Fatal(err)
	}
	if err := gz.Close(); err != nil {
		t.Fatal(err)
	}

	got, err := extractExecutableFromTarGz(buf.Bytes())
	if err != nil {
		t.Fatalf("extractExecutableFromTarGz: %v", err)
	}
	if string(got) != "\x7fELF the real binary" {
		t.Errorf("picked the wrong file: %q", got)
	}
}

func TestExtractExecutableIgnoresANonRegularEntry(t *testing.T) {
	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gz)

	// A symlink must not be treated as the executable.
	if err := tw.WriteHeader(&tar.Header{
		Name:     "reqit-linux-amd64",
		Typeflag: tar.TypeSymlink,
		Linkname: "/etc/passwd",
		Mode:     0o777,
	}); err != nil {
		t.Fatal(err)
	}
	if err := tw.Close(); err != nil {
		t.Fatal(err)
	}
	if err := gz.Close(); err != nil {
		t.Fatal(err)
	}

	// Nothing usable in the archive, so it must not report success.
	if _, err := extractExecutableFromTarGz(buf.Bytes()); err == nil {
		t.Error("expected an error when the archive holds no regular file")
	}
}

// The macOS release is a zip. It has to be unpacked before it can be applied,
// because selfupdate expects a raw executable and a zip is not one.
func TestExtractAppFromZipLikeTheMacOSRelease(t *testing.T) {
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)

	exeName := "reqit.app/Contents/MacOS/reqit"
	f, err := zw.Create(exeName)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.Write([]byte("\xcf\xfa\xed\xfe fake mach-o")); err != nil {
		t.Fatal(err)
	}
	if _, err := zw.Create("reqit.app/Contents/Info.plist"); err != nil {
		t.Fatal(err)
	}
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}

	dir := t.TempDir()
	got, err := extractAppFromZip(buf.Bytes(), dir)
	if err != nil {
		t.Fatalf("extractAppFromZip: %v", err)
	}
	if string(got) != "\xcf\xfa\xed\xfe fake mach-o" {
		t.Errorf("extracted the wrong file: %q", got)
	}
	if _, err := os.Stat(filepath.Join(dir, "reqit.app", "Contents", "Info.plist")); err != nil {
		t.Errorf("the rest of the bundle was not unpacked: %v", err)
	}
}

func TestExtractAppFromZipRejectsAPathTraversal(t *testing.T) {
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	f, err := zw.Create("../../escape")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.Write([]byte("nope")); err != nil {
		t.Fatal(err)
	}
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}

	dir := t.TempDir()
	if _, err := extractAppFromZip(buf.Bytes(), dir); err == nil {
		t.Error("expected an error for an archive with a traversing path")
	}
	if _, err := os.Stat(filepath.Join(filepath.Dir(dir), "escape")); err == nil {
		t.Error("a file was written outside the destination directory")
	}
}

// A zip is not a gzip, so the archive detection must tell them apart.
func TestIsZipDetectsTheMacOSArchive(t *testing.T) {
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	f, _ := zw.Create("reqit.app/Contents/MacOS/reqit")
	_, _ = f.Write([]byte("x"))
	_ = zw.Close()

	if !isZip(buf.Bytes()) {
		t.Error("expected the zip to be detected")
	}
	if isGzip(buf.Bytes()) {
		t.Error("a zip must not be detected as gzip")
	}
}

func writeTarFile(tw *tar.Writer, name string, content []byte) error {
	if err := tw.WriteHeader(&tar.Header{
		Name: name,
		Mode: 0o755,
		Size: int64(len(content)),
	}); err != nil {
		return err
	}
	_, err := tw.Write(content)
	return err
}
