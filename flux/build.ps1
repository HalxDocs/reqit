$tag = git describe --tags --abbrev=0 2>$null
if (-not $tag) { $tag = "v0.7.0" }
Write-Host "Building reqit $tag ..."
wails build -ldflags "-s -w -X 'flux/internal/updater.CurrentVersion=$tag'"
