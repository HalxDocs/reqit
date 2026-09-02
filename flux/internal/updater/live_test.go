package updater

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"runtime"
	"testing"
)

func TestLiveDownloadWithChecksum(t *testing.T) {
	// Fake binary content
	fakeBinary := []byte("fake-reqit-binary-content-for-test")
	sum := sha256.Sum256(fakeBinary)
	sha := hex.EncodeToString(sum[:])

	// Mock asset server that serves the fake binary
	assetSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write(fakeBinary)
	}))
	defer assetSrv.Close()

	// Mock manifest server
	manifestSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		m := UpdateManifest{
			Version: "v9.9.9",
			Platforms: map[string]PlatformAsset{
				assetName(): {URL: assetSrv.URL + "/binary", SHA256: sha},
			},
		}
		json.NewEncoder(w).Encode(m)
	}))
	defer manifestSrv.Close()

	originalURL := manifestURL
	manifestURL = manifestSrv.URL
	defer func() { manifestURL = originalURL }()

	u := &Updater{CurrentVersion: "v1.0.0"}
	manifest, err := u.FetchManifest(context.Background())
	if err != nil {
		t.Fatalf("FetchManifest failed: %v", err)
	}
	if manifest.Version != "v9.9.9" {
		t.Fatalf("expected v9.9.9, got %s", manifest.Version)
	}

	// Test downloadWithChecksum directly
	asset, ok := manifest.AssetForCurrentPlatform()
	if !ok {
		t.Fatalf("no asset for %s", runtime.GOOS+"-"+runtime.GOARCH)
	}
	data, err := u.downloadWithChecksum(context.Background(), asset)
	if err != nil {
		t.Fatalf("downloadWithChecksum failed: %v", err)
	}
	if string(data) != string(fakeBinary) {
		t.Fatalf("downloaded data mismatch")
	}

	// Test checksum mismatch is caught
	asset.SHA256 = "badbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbad1"
	_, err = u.downloadWithChecksum(context.Background(), asset)
	if err == nil {
		t.Fatal("expected checksum mismatch error")
	}
}

func TestLiveCheckForUpdates_FetchesManifest(t *testing.T) {
	fakeBinary := []byte("x")
	sum := sha256.Sum256(fakeBinary)
	sha := hex.EncodeToString(sum[:])

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		m := UpdateManifest{
			Version: "v1.5.0",
			Platforms: map[string]PlatformAsset{
				assetName(): {URL: "https://example.com/fake", SHA256: sha},
			},
		}
		json.NewEncoder(w).Encode(m)
	}))
	defer srv.Close()

	originalURL := manifestURL
	manifestURL = srv.URL
	defer func() { manifestURL = originalURL }()

	u := &Updater{CurrentVersion: "v1.0.0"}
	manifest, err := u.FetchManifest(context.Background())
	if err != nil {
		t.Fatalf("FetchManifest failed: %v", err)
	}
	if manifest.Version != "v1.5.0" {
		t.Errorf("got %s", manifest.Version)
	}
	// Asset should be found
	if _, ok := manifest.AssetForCurrentPlatform(); !ok {
		t.Error("asset not found")
	}
}
