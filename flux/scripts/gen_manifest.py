"""Generate latest.json manifest for reqit auto-updater.

Usage:
    python3 scripts/gen_manifest.py v1.2.0 > latest.json

Relies on SHA256SUMS.txt being present in the release artifacts.
"""
import hashlib
import json
import os
import sys
from collections import OrderedDict

TAG = sys.argv[1] if len(sys.argv) > 1 else "v0.0.0"
VERSION = TAG.lstrip("v")

BASE = f"https://github.com/HalxDocs/reqit/releases/download/{TAG}"

PLATFORMS = OrderedDict([
    ("linux-amd64",   f"reqit-linux-amd64.tar.gz"),
    ("darwin-amd64",  f"reqit-darwin-amd64.zip"),
    ("darwin-arm64",  f"reqit-darwin-arm64.zip"),
    ("windows-amd64", f"reqit-windows-amd64.zip"),
])

def sha256_of(filename: str) -> str:
    """Compute SHA256 of a local file, or return a placeholder."""
    if os.path.exists(filename):
        h = hashlib.sha256()
        with open(filename, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
        return h.hexdigest()
    return ""

manifest = {
    "version": TAG,
    "notes": f"See https://github.com/HalxDocs/reqit/releases/{TAG}",
    "pub_date": "",
    "platforms": {},
}

for key, filename in PLATFORMS.items():
    manifest["platforms"][key] = {
        "url": f"{BASE}/{filename}",
        "sha256": sha256_of(filename),
    }

print(json.dumps(manifest, indent=2))
