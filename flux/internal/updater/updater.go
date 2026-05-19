package updater

import (
	"encoding/json"
	"fmt"
	"net/http"
	"runtime"
	"strings"
	"time"
)

const CurrentVersion = "v0.3.0"

const releaseAPI = "https://api.github.com/repos/HalxDocs/reqit/releases/latest"

type Release struct {
	TagName string  `json:"tag_name"`
	HTMLURL string  `json:"html_url"`
	Assets  []Asset `json:"assets"`
}

type Asset struct {
	Name               string `json:"name"`
	BrowserDownloadURL string `json:"browser_download_url"`
}

type UpdateInfo struct {
	Version     string `json:"version"`
	DownloadURL string `json:"downloadUrl"`
	ReleaseURL  string `json:"releaseUrl"`
}

func Check() (UpdateInfo, bool, error) {
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(releaseAPI)
	if err != nil {
		return UpdateInfo{}, false, err
	}
	defer resp.Body.Close()

	var rel Release
	if err := json.NewDecoder(resp.Body).Decode(&rel); err != nil {
		return UpdateInfo{}, false, err
	}

	if !isNewer(rel.TagName, CurrentVersion) {
		return UpdateInfo{}, false, nil
	}

	info := UpdateInfo{
		Version:    rel.TagName,
		ReleaseURL: rel.HTMLURL,
	}
	target := assetName()
	for _, a := range rel.Assets {
		if a.Name == target {
			info.DownloadURL = a.BrowserDownloadURL
			break
		}
	}
	if info.DownloadURL == "" {
		info.DownloadURL = rel.HTMLURL
	}
	return info, true, nil
}

func isNewer(latest, current string) bool {
	latest = strings.TrimPrefix(latest, "v")
	current = strings.TrimPrefix(current, "v")
	lp := versionParts(latest)
	cp := versionParts(current)
	for i := 0; i < 3; i++ {
		if lp[i] > cp[i] {
			return true
		}
		if lp[i] < cp[i] {
			return false
		}
	}
	return false
}

func versionParts(v string) [3]int {
	var major, minor, patch int
	fmt.Sscanf(v, "%d.%d.%d", &major, &minor, &patch)
	return [3]int{major, minor, patch}
}

func assetName() string {
	switch runtime.GOOS {
	case "windows":
		return "reqit-windows-amd64.exe"
	case "darwin":
		return "reqit-macos-universal.zip"
	default:
		return "reqit-linux-amd64"
	}
}
