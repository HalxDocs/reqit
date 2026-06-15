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
	asset, ok := m.Platforms[key]
	return asset, ok
}
