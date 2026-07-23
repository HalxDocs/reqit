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
	key := runtime.GOOS + "-" + runtime.GOARCH
	if asset, ok := m.Platforms[key]; ok {
		return asset, true
	}
	if runtime.GOOS == "darwin" {
		if asset, ok := m.Platforms["darwin-universal"]; ok {
			return asset, true
		}
	}
	return PlatformAsset{}, false
}

// InstallerAssetForCurrentPlatform returns the NSIS installer asset for Windows.
// Falls back to the regular asset on other platforms.
func (m *UpdateManifest) InstallerAssetForCurrentPlatform() (PlatformAsset, bool) {
	if runtime.GOOS != "windows" {
		return PlatformAsset{}, false
	}
	key := runtime.GOOS + "-" + runtime.GOARCH + "-installer"
	asset, ok := m.Platforms[key]
	return asset, ok
}
