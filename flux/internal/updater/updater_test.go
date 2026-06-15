package updater

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"runtime"
	"testing"
)

func TestAssetForCurrentPlatform(t *testing.T) {
	m := &UpdateManifest{
		Platforms: map[string]PlatformAsset{
			"linux-amd64":    {URL: "https://example.com/linux.zip", SHA256: "abc"},
			"darwin-arm64":   {URL: "https://example.com/mac.zip", SHA256: "def"},
			"windows-amd64":  {URL: "https://example.com/win.zip", SHA256: "ghi"},
		},
	}
	key := runtime.GOOS + "-" + runtime.GOARCH
	asset, ok := m.AssetForCurrentPlatform()
	if !ok {
		t.Fatalf("no asset for current platform %s", key)
	}
	if asset.SHA256 == "" {
		t.Error("asset should have a SHA256")
	}
}

func TestAssetForCurrentPlatform_Missing(t *testing.T) {
	m := &UpdateManifest{Platforms: map[string]PlatformAsset{}}
	_, ok := m.AssetForCurrentPlatform()
	if ok {
		t.Error("should return false for empty platforms")
	}
}

func TestAssetName(t *testing.T) {
	name := assetName()
	expected := runtime.GOOS + "-" + runtime.GOARCH
	if name != expected {
		t.Errorf("got %s, want %s", name, expected)
	}
}

func TestCheckInBackground_NewerVersion(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		m := UpdateManifest{
			Version: "v2.0.0",
			Notes:   "Major release",
			Platforms: map[string]PlatformAsset{
				assetName(): {URL: "https://example.com/reqit.zip", SHA256: "abc123"},
			},
		}
		json.NewEncoder(w).Encode(m)
	}))
	defer srv.Close()

	originalURL := manifestURL
	manifestURL = srv.URL + "/latest.json"
	defer func() { manifestURL = originalURL }()

	var foundManifest *UpdateManifest
	u := &Updater{
		CurrentVersion: "v1.0.0",
		OnUpdateFound: func(m UpdateManifest) {
			foundManifest = &m
		},
	}

	u.CheckInBackground(context.Background())
	if foundManifest == nil {
		t.Fatal("OnUpdateFound should have been called")
	}
	if foundManifest.Version != "v2.0.0" {
		t.Errorf("got version %s, want v2.0.0", foundManifest.Version)
	}
}

func TestCheckInBackground_SameVersion(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		m := UpdateManifest{
			Version:   "v1.0.0",
			Platforms: map[string]PlatformAsset{assetName(): {URL: "", SHA256: ""}},
		}
		json.NewEncoder(w).Encode(m)
	}))
	defer srv.Close()

	originalURL := manifestURL
	manifestURL = srv.URL + "/latest.json"
	defer func() { manifestURL = originalURL }()

	called := false
	u := &Updater{
		CurrentVersion: "v1.0.0",
		OnUpdateFound: func(m UpdateManifest) {
			called = true
		},
	}

	u.CheckInBackground(context.Background())
	if called {
		t.Error("OnUpdateFound should NOT be called when versions match")
	}
}

func TestCheckInBackground_OlderVersion(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		m := UpdateManifest{
			Version:   "v0.9.0",
			Platforms: map[string]PlatformAsset{assetName(): {URL: "", SHA256: ""}},
		}
		json.NewEncoder(w).Encode(m)
	}))
	defer srv.Close()

	originalURL := manifestURL
	manifestURL = srv.URL + "/latest.json"
	defer func() { manifestURL = originalURL }()

	called := false
	u := &Updater{
		CurrentVersion: "v1.0.0",
		OnUpdateFound: func(m UpdateManifest) {
			called = true
		},
	}

	u.CheckInBackground(context.Background())
	if called {
		t.Error("OnUpdateFound should NOT be called when server version is older")
	}
}

func TestCheckInBackground_NetworkError(t *testing.T) {
	// Point to a non-routable address — should fail silently
	originalURL := manifestURL
	manifestURL = "http://127.0.0.1:19999/nonexistent"
	defer func() { manifestURL = originalURL }()

	called := false
	u := &Updater{
		CurrentVersion: "v1.0.0",
		OnUpdateFound: func(m UpdateManifest) {
			called = true
		},
	}

	u.CheckInBackground(context.Background())
	if called {
		t.Error("OnUpdateFound should NOT be called on network error")
	}
}

func TestApply_ChecksumMismatch(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("not-a-valid-binary"))
	}))
	defer srv.Close()

	manifest := UpdateManifest{
		Version: "v2.0.0",
		Platforms: map[string]PlatformAsset{
			assetName(): {URL: srv.URL + "/reqit.zip", SHA256: "badbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbad1"},
		},
	}

	u := &Updater{CurrentVersion: "v1.0.0"}
	err := u.Apply(context.Background(), manifest)
	if err == nil {
		t.Error("expected checksum mismatch error")
	}
}

func TestApply_MissingPlatform(t *testing.T) {
	manifest := UpdateManifest{
		Version:   "v2.0.0",
		Platforms: map[string]PlatformAsset{},
	}

	u := &Updater{CurrentVersion: "v1.0.0"}
	err := u.Apply(context.Background(), manifest)
	if err == nil {
		t.Error("expected error for missing platform asset")
	}
}

func TestFetchManifest_ValidJSON(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"version":"v1.2.0","notes":"Test","pub_date":"2025-01-01","platforms":{"linux-amd64":{"url":"https://ex.com/f","sha256":"abc"}}}`))
	}))
	defer srv.Close()

	originalURL := manifestURL
	manifestURL = srv.URL
	defer func() { manifestURL = originalURL }()

	u := &Updater{}
	m, err := u.FetchManifest(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if m.Version != "v1.2.0" {
		t.Errorf("got version %s", m.Version)
	}
}

func TestFetchManifest_BadJSON(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`not json`))
	}))
	defer srv.Close()

	originalURL := manifestURL
	manifestURL = srv.URL
	defer func() { manifestURL = originalURL }()

	u := &Updater{}
	_, err := u.FetchManifest(context.Background())
	if err == nil {
		t.Error("expected error for bad JSON")
	}
}
