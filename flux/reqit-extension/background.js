// reqit Interceptor — background service worker
const REQIT_CONFIG_KEY = 'reqit_interceptor_config';

let config = { proxyHost: '127.0.0.1', proxyPort: 0, enabled: false };

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

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (!config.enabled || !config.proxyPort) return;
    // Skip requests to the proxy itself
    if (details.url.indexOf('127.0.0.1:' + config.proxyPort) !== -1) return;
    // Forward captured request to reqit proxy
    const payload = {
      method: details.method,
      url: details.url,
      requestBody: details.requestBody ? JSON.stringify(details.requestBody) : '',
      tabId: details.tabId,
      type: details.type,
      timeStamp: details.timeStamp
    };
    fetch(`http://${config.proxyHost}:${config.proxyPort}/__capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => {
      // Proxy not running — silently ignore
    });
  },
  { urls: ['<all_urls>'] },
  ['requestBody']
);
