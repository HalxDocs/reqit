const REQIT_CONFIG_KEY = 'reqit_interceptor_config';
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const proxyPort = document.getElementById('proxyPort');
const toggleBtn = document.getElementById('toggleBtn');

let config = { proxyPort: 0, enabled: false };

function updateUI() {
  if (config.enabled && config.proxyPort > 0) {
    statusDot.className = 'dot active';
    statusText.textContent = `Capturing on :${config.proxyPort}`;
    toggleBtn.textContent = 'Disconnect';
  } else {
    statusDot.className = 'dot';
    statusText.textContent = 'Disconnected';
    toggleBtn.textContent = 'Connect';
  }
}

chrome.storage.local.get(REQIT_CONFIG_KEY, (result) => {
  if (result[REQIT_CONFIG_KEY]) {
    config = { ...config, ...result[REQIT_CONFIG_KEY] };
    proxyPort.value = config.proxyPort;
    updateUI();
  }
});

toggleBtn.addEventListener('click', () => {
  if (config.enabled) {
    config.enabled = false;
  } else {
    config.proxyPort = parseInt(proxyPort.value, 10) || 0;
    config.enabled = true;
  }
  chrome.storage.local.set({ [REQIT_CONFIG_KEY]: config }, updateUI);
});

proxyPort.addEventListener('input', () => {
  if (config.enabled) {
    config.proxyPort = parseInt(proxyPort.value, 10) || 0;
    chrome.storage.local.set({ [REQIT_CONFIG_KEY]: config });
  }
});
