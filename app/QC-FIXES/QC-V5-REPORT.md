# IDMM QC v5 — Bug Report

**Date:** 2026-07-15  
**Tester:** Agent (automated code review)  
**Scope:** 6 user-reported bugs

---

## Summary

| Bug | Description | Verdict |
|-----|-------------|---------|
| B1 | Save Path not working | ✅ PASS |
| B2 | Download Threads not saved | ✅ PASS |
| B3 | Server URL still showing | ✅ PASS |
| B4 | Tab memory missing | ❌ FAIL |
| B5 | No "Open Folder" button | ❌ FAIL |
| B6 | Extension settings section title | ✅ PASS |

**Result: 4 PASS / 2 FAIL**

---

## B1: Save Path not working — ✅ PASS

**Files reviewed:** `options/options.js`, `lib/api-client.js`

**Evidence:**

`options.js` saveSettings() correctly reads the input and includes it in the saved object:
```js
const settings = {
    ...
    defaultSavePath: $defaultSavePath.value.trim(),
    ...
};
await IDMM_API.saveSettings(settings);
```

`api-client.js` saveSettings() persists to chrome.storage.local:
```js
async saveSettings(settings) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ idmm_settings: settings }, resolve);
    });
},
```

`api-client.js` getSettings() reads it back:
```js
async getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get('idmm_settings', (result) => {
        resolve(result.idmm_settings || IDMM_API.defaultSettings());
      });
    });
},
```

`options.js` loadSettings() restores the value:
```js
$defaultSavePath.value = settings.defaultSavePath || '';
```

**Verdict:** Save path round-trips correctly through chrome.storage.local. No persistence bug found.

---

## B2: Download Threads not saved — ✅ PASS

**Files reviewed:** `options/options.js`, `lib/api-client.js`

**Evidence:**

`options.js` saveSettings():
```js
maxThreads: clamp(parseInt($maxThreads.value, 10) || 8, 1, 64),
```

`options.js` loadSettings():
```js
$maxThreads.value = settings.maxThreads || 8;
```

The `maxThreads` property is included in the saved settings object and read back on load. Same chrome.storage.local mechanism as B1.

**Verdict:** Threads setting persists correctly. No bug found.

---

## B3: Server URL still showing — ✅ PASS

**Files reviewed:** `options/options.html`, `options/options.js`

**Evidence:**

`options.html` section titles are:
- `📡 IDMM Status`
- `🔧 Extension`
- `📥 Auto-Intercept Rules`
- `⚙️ Download Defaults`

None expose a server URL. The status section only shows a status indicator span (`<span id="server-status">`), never a URL.

`options.js` checkStatus() displays "Connected ✓" or "Not Running ✗" — no URL:
```js
$serverStatus.textContent = 'Connected \u2713';
// or
$serverStatus.textContent = 'Not Running \u2717';
```

The code comment confirms intent: `Backend URL is hidden from users — only shows Connected/Not Running.`

**Verdict:** Server URL is not displayed anywhere in the options page. No bug found.

---

## B4: Tab memory missing — ❌ FAIL

**Files reviewed:** `popup/popup.js`

**Evidence:**

The current tab filter is initialized as a hardcoded variable:
```js
let currentFilter = 'active';
```

When a tab is clicked, the in-memory variable updates but is never persisted:
```js
tab.addEventListener('click', () => {
    $tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentFilter = tab.dataset.filter;
    renderDownloads();
});
```

There is no `localStorage.setItem()`, no `chrome.storage.local.set()`, and no save-to-storage call anywhere in the tab click handler or on popup unload. The `DOMContentLoaded` handler also has no restore logic:
```js
document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    await checkServerStatus();
    await refreshDownloads();
    refreshTimer = setInterval(refreshDownloads, 2000);
});
```

No attempt to read a saved filter and activate the corresponding tab on load.

**Root Cause:** Tab selection is stored only in a volatile JS variable (`currentFilter`). Popup close = memory lost. Next open always starts at `'active'`.

**Fix Required:** Save `currentFilter` to `localStorage` (or `chrome.storage.local`) on tab click; restore it on `DOMContentLoaded` and activate the matching tab element.

---

## B5: No "Open Folder" button — ❌ FAIL

**Files reviewed:** `popup/popup.js`, `app/src/server/server.js`

**Evidence (popup.js):**

The completed download actions only include a "Remove" button:
```js
} else if (dl.status === 'completed') {
    actionsHtml = `
      <button class="dl-btn btn-delete" data-action="delete" data-id="${dl.id}">🗑 Remove</button>
    `;
}
```

The `handleAction` switch has no `'open-folder'` case:
```js
switch (action) {
    case 'pause': ...
    case 'resume': ...
    case 'cancel': ...
    case 'delete': ...
}
```

**Evidence (server.js):**

The server returns `save_to` in download listings (`/api/downloads`), so the folder path is available to the extension. However, there is no dedicated "open folder" API endpoint, and the extension never uses the `save_to` field for this purpose.

**Root Cause:** No "Open Folder" button was implemented in the completed download action set, and no corresponding action handler exists.

**Fix Required:**
1. Add an "Open Folder" button to completed download actions in `createDownloadElement()`.
2. Implement a handler (e.g., using `chrome.downloads.showDefaultFolder()` or calling a new server endpoint like `POST /api/download/:id/open-folder`).

---

## B6: Extension settings section title — ✅ PASS

**Files reviewed:** `options/options.html`

**Evidence:**

All section titles in the HTML:
```html
<h2 class="section-title">📡 IDMM Status</h2>
<h2 class="section-title">🔧 Extension</h2>
<h2 class="section-title">📥 Auto-Intercept Rules</h2>
<h2 class="section-title">⚙️ Download Defaults</h2>
```

No "Server Connection" or similar legacy title exists.

**Verdict:** Section titles are clean. No bug found.

---

## Appendix: Files Reviewed

| File | Path |
|------|------|
| Options JS | `D:\IDMM\extension\options\options.js` |
| Options HTML | `D:\IDMM\extension\options\options.html` |
| API Client | `D:\IDMM\extension\lib\api-client.js` |
| Popup JS | `D:\IDMM\extension\popup\popup.js` |
| Server JS | `D:\IDMM\app\src\server\server.js` |
