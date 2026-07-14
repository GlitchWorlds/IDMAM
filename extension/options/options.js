'use strict';

/**
 * IDMAM Extension — Options Page Script.
 *
 * Uses IDMAM_API from lib/api-client.js for settings persistence.
 * Settings are stored under the 'idmam_settings' key in chrome.storage.local.
 */

// ─── DOM references ────────────────────────────────────────────────

const $serverUrl = document.getElementById('server-url');
const $serverStatus = document.getElementById('server-status');
const $btnTestConnection = document.getElementById('btn-test-connection');
const $extEnabled = document.getElementById('ext-enabled');
const $maxThreads = document.getElementById('max-threads');
const $defaultSavePath = document.getElementById('default-save-path');
const $minSize = document.getElementById('min-size');
const $btnSave = document.getElementById('btn-save');
const $btnReset = document.getElementById('btn-reset');
const $saveStatus = document.getElementById('save-status');

// Intercept toggles
const $interceptToggles = {
  video:    document.getElementById('intercept-video'),
  audio:    document.getElementById('intercept-audio'),
  archive:  document.getElementById('intercept-archive'),
  software: document.getElementById('intercept-software'),
  document: document.getElementById('intercept-document'),
};

// Map category names to settings keys
const CATEGORY_KEY_MAP = {
  video: 'interceptVideo',
  audio: 'interceptAudio',
  archive: 'interceptArchive',
  software: 'interceptSoftware',
  document: 'interceptDocument',
};

// ─── Initialization ────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await loadSettings();
  testConnection();
});

// ─── Event listeners ───────────────────────────────────────────────

function setupEventListeners() {
  $btnSave.addEventListener('click', saveSettings);
  $btnReset.addEventListener('click', resetSettings);
  $btnTestConnection.addEventListener('click', testConnection);

  $serverUrl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') testConnection();
  });
}

// ─── Load settings from storage ────────────────────────────────────

async function loadSettings() {
  const settings = await IDMAM_API.getSettings();

  $serverUrl.value = settings.serverUrl || 'http://127.0.0.1:9977';
  $extEnabled.checked = settings.enabled !== false;
  $maxThreads.value = settings.maxThreads || 8;
  $defaultSavePath.value = settings.defaultSavePath || '';
  $minSize.value = String(settings.interceptMinSize || 5 * 1024 * 1024);

  // Intercept toggles
  for (const [category, toggle] of Object.entries($interceptToggles)) {
    if (toggle) {
      const key = CATEGORY_KEY_MAP[category];
      toggle.checked = settings[key] !== false;
    }
  }
}

// ─── Save settings to storage ──────────────────────────────────────

async function saveSettings() {
  const settings = {
    serverUrl: $serverUrl.value.trim().replace(/\/+$/, '') || 'http://127.0.0.1:9977',
    enabled: $extEnabled.checked,
    maxThreads: clamp(parseInt($maxThreads.value, 10) || 8, 1, 64),
    defaultSavePath: $defaultSavePath.value.trim(),
    interceptMinSize: parseInt($minSize.value, 10) || (5 * 1024 * 1024),
  };

  // Build intercept toggles
  for (const [category, toggle] of Object.entries($interceptToggles)) {
    if (toggle) {
      settings[CATEGORY_KEY_MAP[category]] = toggle.checked;
    }
  }

  await IDMAM_API.saveSettings(settings);

  // Update API client's cached server URL
  await IDMAM_API.refreshServerUrl();

  // Notify background to reload settings
  try {
    await sendMessage({ type: 'SETTINGS_UPDATED' });
  } catch {
    // Background may not be ready
  }

  showSaveStatus('Settings saved!', false);
}

// ─── Reset to defaults ─────────────────────────────────────────────

async function resetSettings() {
  if (!confirm('Reset all settings to defaults?')) return;

  const defaults = IDMAM_API.defaultSettings();
  await IDMAM_API.saveSettings(defaults);
  await loadSettings();

  try {
    await sendMessage({ type: 'SETTINGS_UPDATED' });
  } catch {
    // OK
  }

  showSaveStatus('Settings reset to defaults', false);
}

// ─── Connection test ───────────────────────────────────────────────

async function testConnection() {
  $serverStatus.textContent = 'Checking...';
  $serverStatus.className = 'status-indicator checking';

  const url = $serverUrl.value.trim().replace(/\/+$/, '') || 'http://127.0.0.1:9977';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${url}/api/health`, { signal: controller.signal });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      $serverStatus.textContent = `Online (v${data.version || '?'})`;
      $serverStatus.className = 'status-indicator online';
    } else {
      $serverStatus.textContent = `Error (${response.status})`;
      $serverStatus.className = 'status-indicator offline';
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      $serverStatus.textContent = 'Timeout';
    } else {
      $serverStatus.textContent = 'Offline';
    }
    $serverStatus.className = 'status-indicator offline';
  }
}

// ─── Message helper ────────────────────────────────────────────────

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

// ─── UI helpers ────────────────────────────────────────────────────

function showSaveStatus(text, isError) {
  $saveStatus.textContent = text;
  $saveStatus.className = isError ? 'save-status error' : 'save-status';
  setTimeout(() => {
    $saveStatus.textContent = '';
  }, 3000);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
