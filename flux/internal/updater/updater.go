package updater

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/blang/semver/v4"
	"github.com/minio/selfupdate"
)

// CurrentVersion is the running version. Override at build time:
//
//	wails build -ldflags "-X 'flux/internal/updater.CurrentVersion=v1.1.0'"
var CurrentVersion = "v0.0.0-dev"

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
	if hex.EncodeToString(sum[:]) != asset.SHA256 {
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
