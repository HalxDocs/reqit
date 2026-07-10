const REQIT_CONFIG_KEY = 'reqit_interceptor_config';
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const proxyPort = document.getElementById('proxyPort');
const toggleBtn = document.getElementById('toggleBtn');
const list = document.getElementById('list');
const actionBar = document.getElementById('actionBar');
const selectAllBtn = document.getElementById('selectAllBtn');
const sendBtn = document.getElementById('sendBtn');
const clearBtn = document.getElementById('clearBtn');
const countEl = document.getElementById('count');
const toast = document.getElementById('toast');

let config = { proxyHost: '127.0.0.1', proxyPort: 3100, enabled: false };
let requests = [];
let selectedIds = new Set();

function showToast(msg, color = '#22c55e') {
  toast.textContent = msg;
  toast.style.background = color;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

function updateHeader() {
  if (config.enabled) {
    statusDot.className = 'dot active';
    statusText.textContent = 'Capturing :' + config.proxyPort;
    toggleBtn.textContent = 'Stop';
    toggleBtn.className = 'btn-disconnect';
    proxyPort.disabled = true;
  } else {
    statusDot.className = 'dot';
    statusText.textContent = 'Off';
    toggleBtn.textContent = 'Start Capturing';
    toggleBtn.className = 'btn-connect';
    proxyPort.disabled = false;
  }
}

function renderList() {
  if (requests.length === 0) {
    list.innerHTML = '<div class="empty">No requests captured yet.</div>';
    actionBar.style.display = 'none';
    return;
  }
  actionBar.style.display = 'flex';
  countEl.textContent = requests.length + ' request' + (requests.length !== 1 ? 's' : '');
  selectAllBtn.textContent = selectedIds.size === requests.length ? 'Deselect all' : 'Select all';

  let html = '';
  for (const r of requests) {
    const checked = selectedIds.has(r.id) ? 'checked' : '';
    html += `<div class="req">
      <input type="checkbox" data-id="${r.id}" ${checked}>
      <span class="method ${r.method}">${r.method}</span>
      <span class="url" title="${r.url.replace(/"/g,'&quot;')}">${r.url}</span>
      <span class="type-badge">${r.type}</span>
    </div>`;
  }
  list.innerHTML = html;
  list.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) selectedIds.add(cb.dataset.id);
      else selectedIds.delete(cb.dataset.id);
      updateSendBtn();
    });
  });
}

function updateSendBtn() {
  sendBtn.disabled = selectedIds.size === 0;
}

function refreshRequests() {
  chrome.runtime.sendMessage({ type: 'getCaptured' }, (res) => {
    requests = res || [];
    selectedIds = new Set();
    renderList();
    updateSendBtn();
  });
}

selectAllBtn.addEventListener('click', () => {
  if (selectedIds.size === requests.length) {
    selectedIds = new Set();
  } else {
    selectedIds = new Set(requests.map(r => r.id));
  }
  renderList();
  updateSendBtn();
});

sendBtn.addEventListener('click', () => {
  if (selectedIds.size === 0) return;
  sendBtn.disabled = true;
  sendBtn.textContent = 'Sending...';
  chrome.runtime.sendMessage({ type: 'sendToProxy', ids: [...selectedIds] }, (res) => {
    sendBtn.textContent = 'Send to reqit';
    if (res && res.ok) {
      showToast(`Sent ${res.sent} request${res.sent !== 1 ? 's' : ''} to reqit` + (res.failed ? ` (${res.failed} failed)` : ''));
      refreshRequests();
    } else {
      showToast('Failed to send — is reqit running?', '#ef4444');
      sendBtn.disabled = false;
    }
  });
});

clearBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'clearCaptured' }, () => {
    requests = [];
    selectedIds = new Set();
    renderList();
    updateSendBtn();
  });
});

toggleBtn.addEventListener('click', () => {
  config.enabled = !config.enabled;
  if (config.enabled) config.proxyPort = parseInt(proxyPort.value, 10) || 3100;
  chrome.storage.local.set({ [REQIT_CONFIG_KEY]: config }, () => {
    updateHeader();
    if (!config.enabled) {
      requests = [];
      selectedIds = new Set();
      renderList();
      updateSendBtn();
    }
  });
});

proxyPort.addEventListener('change', () => {
  if (!config.enabled) return;
  config.proxyPort = parseInt(proxyPort.value, 10) || 3100;
  chrome.storage.local.set({ [REQIT_CONFIG_KEY]: config });
});

chrome.storage.local.get(REQIT_CONFIG_KEY, (result) => {
  if (result[REQIT_CONFIG_KEY]) config = { ...config, ...result[REQIT_CONFIG_KEY] };
  proxyPort.value = config.proxyPort;
  updateHeader();
  refreshRequests();
});

setInterval(refreshRequests, 2000);