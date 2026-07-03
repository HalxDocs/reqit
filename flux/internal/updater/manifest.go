package updater

import "runtime"

type PlatformAsset struct {
	URL    string `json:"url"`
	SHA256 string `json:"sha256"`
}

type UpdateManifest struct {
	Version   string                    `json:"version"`
	Notes     string                    `json:"notes"`
	PubDate   string                    `json:"pub_date"`
	Platforms map[string]PlatformAsset  `json:"platforms"`
}

func (m *UpdateManifest) AssetForCurrentPlatform() (PlatformAsset, bool) {
	// Try exact match first (e.g. "windows-amd64")
	key := runtime.GOOS + "-" + runtime.GOARCH
	if asset, ok := m.Platforms[key]; ok {
		return asset, true
	}
	// macOS universal binary — release workflow publishes "darwin-universal"
	// for both amd64 and arm64 architectures.
	if runtime.GOOS == "darwin" {
		if asset, ok := m.Platforms["darwin-universal"]; ok {
			return asset, true
		}
	}
	return PlatformAsset{}, false
}
