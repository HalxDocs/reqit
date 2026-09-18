package updater

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/blang/semver/v4"
	"github.com/minio/selfupdate"
)

// maxUpdateBytes caps how much update payload we buffer/extract (200 MiB).
const maxUpdateBytes = 200 << 20

// CurrentVersion is the running version. Override at build time:
//
//	wails build -ldflags "-X 'flux/internal/updater.CurrentVersion=v2.0.0'"
var CurrentVersion = "v2.0.0"

var (
	manifestURL = "https://github.com/HalxDocs/reqit/releases/latest/download/latest.json"

	httpClient = &http.Client{
		Timeout: 8 * time.Second,
	}

	downloadClient = &http.Client{
		Timeout: 5 * time.Minute,
	}
)

type Updater struct {
	CurrentVersion string
	OnUpdateFound  func(manifest UpdateManifest)
}

func (u *Updater) CheckInBackground(ctx context.Context) {
	manifest, err := u.FetchManifest(ctx)
	if err != nil {
		return
	}
	current, err := semver.ParseTolerant(u.CurrentVersion)
	if err != nil {
		return
	}
	latest, err := semver.ParseTolerant(manifest.Version)
	if err != nil {
		return
	}
	if latest.GT(current) && u.OnUpdateFound != nil {
		u.OnUpdateFound(*manifest)
	}
}

func (u *Updater) Apply(ctx context.Context, manifest UpdateManifest) error {
	asset, ok := manifest.AssetForCurrentPlatform()
	if !ok {
		return fmt.Errorf("no asset available for platform %s", assetName())
	}

	data, err := u.downloadWithChecksum(ctx, asset)
	if err != nil {
		return err
	}

	// Linux ships as a .tar.gz (exec bit would be lost on a raw download).
	// Unpack it and update from the contained executable.
	if isGzip(data) {
		data, err = extractExecutableFromTarGz(data)
		if err != nil {
			return fmt.Errorf("unpack update archive: %w", err)
		}
	}

	// On Windows, try selfupdate first; fall back to NSIS installer.
	if runtime.GOOS == "windows" {
		if err := selfupdate.Apply(bytes.NewReader(data), selfupdate.Options{}); err != nil {
			if isPermissionError(err) {
				return u.applyViaInstaller(ctx, manifest)
			}
			return fmt.Errorf("selfupdate failed: %w", err)
		}
		return nil
	}

	return selfupdate.Apply(bytes.NewReader(data), selfupdate.Options{})
}

// isGzip reports whether data starts with the gzip magic header.
func isGzip(data []byte) bool {
	return len(data) > 2 && data[0] == 0x1f && data[1] == 0x8b
}

// preferredBinaryNames are matched (by base name) when unpacking a .tar.gz
// update archive, so desktop files and icons in the same tarball are ignored.
var preferredBinaryNames = []string{"reqit-linux-amd64", "reqit"}

// extractExecutableFromTarGz unpacks a .tar.gz update archive and returns the
// bytes of the contained executable. Only regular files are considered
// (symlinks, devices, and absolute/parent paths are skipped).
func extractExecutableFromTarGz(data []byte) ([]byte, error) {
	gz, err := gzip.NewReader(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("open gzip: %w", err)
	}
	defer gz.Close()

	tr := tar.NewReader(io.LimitReader(gz, maxUpdateBytes))
	var fallback []byte
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("read tar: %w", err)
		}
		if hdr.Typeflag != tar.TypeReg {
			continue
		}
		base := path.Base(filepath.ToSlash(hdr.Name))
		if base == "." || base == "/" || base == "" {
			continue
		}
		content, err := io.ReadAll(io.LimitReader(tr, maxUpdateBytes))
		if err != nil {
			return nil, fmt.Errorf("read entry %s: %w", base, err)
		}
		for _, want := range preferredBinaryNames {
			if base == want {
				return content, nil
			}
		}
		if fallback == nil {
			fallback = content
		}
	}
	if fallback == nil {
		return nil, fmt.Errorf("no executable found in update archive")
	}
	return fallback, nil
}

// downloadWithChecksum downloads an asset and verifies its SHA256 checksum.
func (u *Updater) downloadWithChecksum(ctx context.Context, asset PlatformAsset) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, asset.URL, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	resp, err := downloadClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("download failed: %w", err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read body: %w", err)
	}

	sum := sha256.Sum256(data)
	if !strings.EqualFold(hex.EncodeToString(sum[:]), asset.SHA256) {
		return nil, fmt.Errorf("checksum mismatch — update aborted")
	}

	return data, nil
}

// applyViaInstaller downloads the NSIS installer and runs it silently with elevation.
func (u *Updater) applyViaInstaller(ctx context.Context, manifest UpdateManifest) error {
	installer, ok := manifest.InstallerAssetForCurrentPlatform()
	if !ok {
		return fmt.Errorf("no installer asset available for Windows — download manually from %s", manifestURL)
	}

	data, err := u.downloadWithChecksum(ctx, installer)
	if err != nil {
		return err
	}

	installerPath := filepath.Join(os.TempDir(), "reqit-installer.exe")
	if err := os.WriteFile(installerPath, data, 0755); err != nil {
		return fmt.Errorf("write installer: %w", err)
	}

	// Run installer silently (/S) and wait for completion.
	cmd := exec.CommandContext(ctx, installerPath, "/S")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("installer failed: %w", err)
	}

	return nil
}

func (u *Updater) FetchManifest(ctx context.Context) (*UpdateManifest, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, manifestURL, nil)
	if err != nil {
		return nil, err
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var m UpdateManifest
	if err := json.NewDecoder(resp.Body).Decode(&m); err != nil {
		return nil, err
	}
	return &m, nil
}

// RestartApp spawns a new instance of the current executable and exits.
func RestartApp() error {
	exe, err := os.Executable()
	if err != nil {
		return fmt.Errorf("get executable: %w", err)
	}
	cmd := exec.Command(exe, os.Args[1:]...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("restart: %w", err)
	}
	os.Exit(0)
	return nil
}

func isPermissionError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "permission denied") ||
		strings.Contains(msg, "access is denied") ||
		strings.Contains(msg, "access denied")
}

func assetName() string {
	return runtime.GOOS + "-" + runtime.GOARCH
}
