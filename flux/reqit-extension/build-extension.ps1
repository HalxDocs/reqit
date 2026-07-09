# Build the Chrome extension zip for Chrome Web Store upload
$src = Join-Path $PSScriptRoot "."
$out = Join-Path $PSScriptRoot "..\..\dist\reqit-extension.zip"
$dir = Split-Path $out -Parent
if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

# Remove old zip if exists
if (Test-Path $out) { Remove-Item $out -Force }

# Create temp dir with only required files
$tmp = Join-Path $env:TEMP "reqit-extension-$(Get-Random)"
New-Item -ItemType Directory -Path $tmp -Force | Out-Null
try {
    Copy-Item -Path (Join-Path $src "manifest.json") -Destination $tmp
    Copy-Item -Path (Join-Path $src "background.js") -Destination $tmp
    Copy-Item -Path (Join-Path $src "popup.html") -Destination $tmp
    Copy-Item -Path (Join-Path $src "popup.js") -Destination $tmp
    Copy-Item -Path (Join-Path $src "rules.json") -Destination $tmp
    $icons = Join-Path $tmp "icons"
    New-Item -ItemType Directory -Path $icons -Force | Out-Null
    Copy-Item -Path (Join-Path $src "icons\icon16.png") -Destination $icons
    Copy-Item -Path (Join-Path $src "icons\icon48.png") -Destination $icons
    Copy-Item -Path (Join-Path $src "icons\icon128.png") -Destination $icons

    # Create zip
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::CreateFromDirectory($tmp, $out)
    Write-Host "Extension zip created: $out"
} finally {
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
