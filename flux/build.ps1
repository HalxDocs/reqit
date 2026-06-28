$tag = git describe --tags --abbrev=0 2>$null
if (-not $tag) { $tag = "v0.7.0" }
Write-Host "Building reqit $tag ..."

$platform = $args[0]
if (-not $platform) { $platform = "native" }

switch ($platform) {
  "linux" {
    Write-Host "Building for Linux (webkit2_41) ..."
    wails build -platform linux/amd64 -tags webkit2_41 -ldflags "-s -w -X 'flux/internal/updater.CurrentVersion=$tag'"
  }
  "macos" {
    Write-Host "Building for macOS (universal) ..."
    wails build -platform darwin/universal -ldflags "-s -w -X 'flux/internal/updater.CurrentVersion=$tag'"
  }
  "windows" {
    Write-Host "Building for Windows ..."
    wails build -ldflags "-s -w -X 'flux/internal/updater.CurrentVersion=$tag'"
  }
  default {
    Write-Host "Building for native platform ..."
    wails build -ldflags "-s -w -X 'flux/internal/updater.CurrentVersion=$tag'"
  }
}
