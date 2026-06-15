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
	"runtime"
	"time"

	"github.com/blang/semver/v4"
	"github.com/minio/selfupdate"
)

// CurrentVersion is the running version. Override at build time:
//
//	wails build -ldflags "-X 'flux/internal/updater.CurrentVersion=v0.7.0'"
var CurrentVersion = "v0.0.0-dev"

var (
	manifestURL = "https://github.com/HalxDocs/reqit/releases/latest/download/latest.json"

	// Reusable HTTP client: keep-alive, connection pooling, timeout.
	httpClient = &http.Client{
		Timeout: 8 * time.Second,
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

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, asset.URL, nil)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("download failed: %w", err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read body: %w", err)
	}

	sum := sha256.Sum256(data)
	if hex.EncodeToString(sum[:]) != asset.SHA256 {
		return fmt.Errorf("checksum mismatch — update aborted")
	}

	return selfupdate.Apply(bytes.NewReader(data), selfupdate.Options{})
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

func assetName() string {
	return runtime.GOOS + "-" + runtime.GOARCH
}
