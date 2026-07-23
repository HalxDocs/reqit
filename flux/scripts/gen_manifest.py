"""Generate latest.json manifest for reqit auto-updater.

Usage:
    # With SHA256SUMS.txt in the current directory:
    python3 scripts/gen_manifest.py v1.1.0 > latest.json

    # With explicit SHA256 hashes via stdin (one per line: key=hexhash):
    echo "windows-amd64=abc123..." | python3 scripts/gen_manifest.py v1.1.0 > latest.json

The script reads SHA256SUMS.txt first, then overlays any stdin overrides.
"""
import hashlib
import json
import os
import sys
from collections import OrderedDict

TAG = sys.argv[1] if len(sys.argv) > 1 else "v0.0.0"

BASE = f"https://github.com/HalxDocs/reqit/releases/download/{TAG}"

PLATFORMS = OrderedDict([
    ("linux-amd64",   f"reqit-linux-amd64.tar.gz"),
    ("darwin-amd64",  f"reqit-darwin-amd64.zip"),
    ("darwin-arm64",  f"reqit-darwin-arm64.zip"),
    ("windows-amd64", f"reqit-windows-amd64.zip"),
    ("windows-amd64-installer", f"reqit-windows-amd64-installer.exe"),
])


def sha256_of(filename: str) -> str:
    if os.path.exists(filename):
        h = hashlib.sha256()
        with open(filename, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
        return h.hexdigest()
    return ""


def read_sha256sums() -> dict:
    sums = {}
    sums_path = "SHA256SUMS.txt"
    if os.path.exists(sums_path):
        with open(sums_path) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                parts = line.split(None, 1)
                if len(parts) == 2:
                    h, name = parts
                    # Map filename to platform key
                    for key, fname in PLATFORMS.items():
                        if os.path.basename(fname) == name or name == fname:
                            sums[key] = h
    return sums


manifest = {
    "version": TAG,
    "notes": f"https://github.com/HalxDocs/reqit/releases/tag/{TAG}",
    "pub_date": "",
    "platforms": {},
}

# Read hashes from SHA256SUMS.txt
hashes = read_sha256sums()

# Overlay any stdin hashes (key=hexhash)
if not sys.stdin.isatty():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        if "=" in line:
            key, h = line.split("=", 1)
            hashes[key.strip()] = h.strip()

for key, filename in PLATFORMS.items():
    manifest["platforms"][key] = {
        "url": f"{BASE}/{filename}",
        "sha256": hashes.get(key) or sha256_of(filename),
    }

print(json.dumps(manifest, indent=2))
