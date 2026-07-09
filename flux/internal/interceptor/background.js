// reqit Interceptor — background service worker
const REQIT_CONFIG_KEY = 'reqit_interceptor_config';

let config = { proxyHost: '127.0.0.1', proxyPort: 0, enabled: false };
let capturedRequests = [];

// Load config from storage
chrome.storage.local.get(REQIT_CONFIG_KEY, (result) => {
  if (result[REQIT_CONFIG_KEY]) {
    config = { ...config, ...result[REQIT_CONFIG_KEY] };
  }
});

// Listen for config changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes[REQIT_CONFIG_KEY]) {
    config = { ...config, ...changes[REQIT_CONFIG_KEY].newValue };
  }
});

// Capture via declarativeNetRequest
chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
  if (!config.enabled || !config.proxyPort) return;
  const req = info.request;
  if (req.url.indexOf('127.0.0.1:' + config.proxyPort) !== -1) return;

  const payload = {
    method: req.method,
    url: req.url,
    tabId: req.tabId,
    type: req.type,
    timeStamp: Date.now()
  };
  capturedRequests.push(payload);
  if (capturedRequests.length > 50) capturedRequests.shift();

  fetch(`http://${config.proxyHost}:${config.proxyPort}/__capture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(() => {});
});

// Popup gets captured requests
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'getCaptured') {
    sendResponse(capturedRequests);
  }
});