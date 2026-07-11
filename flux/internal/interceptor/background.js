// reqit Interceptor — background service worker
const REQIT_CONFIG_KEY = 'reqit_interceptor_config';
const CAPTURED_KEY = 'reqit_captured_requests';

let config = { proxyHost: '127.0.0.1', proxyPort: 3100, enabled: false };
let capturedRequests = [];

chrome.storage.local.get([REQIT_CONFIG_KEY, CAPTURED_KEY], (result) => {
  if (result[REQIT_CONFIG_KEY]) config = { ...config, ...result[REQIT_CONFIG_KEY] };
  if (result[CAPTURED_KEY]) capturedRequests = result[CAPTURED_KEY];
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes[REQIT_CONFIG_KEY]) config = { ...config, ...changes[REQIT_CONFIG_KEY].newValue };
});

// Intercept all requests for local capture
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (!config.enabled) return;
    if (details.url.indexOf('127.0.0.1:' + config.proxyPort) !== -1) return;

    capturedRequests.push({
      id: Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      method: details.method,
      url: details.url,
      tabId: details.tabId,
      type: details.type,
      timeStamp: details.timeStamp
    });
    if (capturedRequests.length > 100) capturedRequests = capturedRequests.slice(-100);
    chrome.storage.local.set({ [CAPTURED_KEY]: capturedRequests });
  },
  { urls: ['<all_urls>'] },
  []
);

// Handle popup requests
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'getCaptured') sendResponse(capturedRequests);
  if (msg.type === 'clearCaptured') {
    capturedRequests = [];
    chrome.storage.local.set({ [CAPTURED_KEY]: [] });
    sendResponse({ ok: true });
  }
  if (msg.type === 'sendToProxy') {
    const ids = new Set(msg.ids);
    const toSend = capturedRequests.filter(r => ids.has(r.id));
    const remaining = capturedRequests.filter(r => !ids.has(r.id));
    let sent = 0;
    let failed = 0;
    Promise.all(toSend.map(r =>
      fetch(`http://${config.proxyHost}:${config.proxyPort}/__capture`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: r.method, url: r.url, tabId: r.tabId, type: r.type, timeStamp: r.timeStamp })
      }).then(() => sent++).catch(() => failed++)
    )).then(() => {
      capturedRequests = remaining;
      chrome.storage.local.set({ [CAPTURED_KEY]: remaining });
      sendResponse({ ok: true, sent, failed });
    });
    return true;
  }
});