// Package manifest provides the Chrome extension manifest.json.
package interceptor

// ManifestJSON returns the extension manifest as a byte slice.
var ManifestJSON = []byte(`{
  "manifest_version": 3,
  "name": "reqit Interceptor",
  "version": "1.0.0",
  "description": "Capture HTTP/S requests and forward them to reqit for testing and mocking.",
  "permissions": [
    "webRequest",
    "storage",
    "tabs"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup.html",
    "default_title": "reqit Interceptor"
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}`)
