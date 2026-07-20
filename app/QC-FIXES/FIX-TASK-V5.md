# IDMM v5  User Bug Fixes

> Bob reported: 2026-07-15 22:00 WIB
> Source: QC-V5-REPORT.md + manual code inspection

## BUG LIST

### B1: Save Path not applied during download 
Root cause: `popup.js:addDownload()` calls `IDMM_API.startDownload({ url })` without `save_to`.
Settings save correctly in chrome.storage.local but are NEVER READ when starting downloads.
Fix: In addDownload(), read settings, pass `save_to: settings.defaultSavePath` to startDownload().

### B2: Download Threads not applied during download 
Root cause: Same as B1. `addDownload()` doesn't pass `threads` from settings.
Fix: In addDownload(), pass `threads: settings.maxThreads` to startDownload().

### B3: Server URL still showing 
Root cause: User says server URL still visible in settings. Check if options.html still has it or if Chrome cached old extension. Also check api-client.js defaultSettings still has serverUrl.
Fix: Remove serverUrl from defaultSettings in api-client.js. Make sure options.html is clean. Tell user to reload extension.

### B4: Tab memory missing 
Root cause: `currentFilter` is volatile JS variable, resets to 'active' on every popup open.
Fix: Save last selected tab to chrome.storage.local on tab click. Load on popup open.

### B5: No "Open Folder" button 
Root cause: Completed downloads only have "Remove" button. No open-folder action.
Fix: Add " Open Folder" button for completed downloads. Use chrome.downloads.showDefaultFolder() or open file location via native messaging. Server already returns save_to in download data.
Note: chrome.downloads API can open folder with chrome.downloads.show(id)  but we need the Chrome download ID. Alternative: use shell.openPath() via native messaging. Simplest: copy path to clipboard.

### B6: Extension intercept behavior (Chrome download then transfer)
Root cause: This is by design  chrome.downloads API intercepts, cancels browser download, sends to IDMM server. The "disappear and transfer" is expected.
Fix: No code fix needed. But improve UX: show notification "Download intercepted by IDMM" when transfer happens.

## THEME / VISUAL FIXES

### T1: Active tab highlight
When user clicks Settings gear icon and goes back, tab should stay on last selected.
Fix: Part of B4 (tab memory).

### T2: Popup always opens to "Active"
Fix: Part of B4.

## OUTPUT CONTRACT
1. Fix B1-B6, T1-T2
2. After fixes: no server URL anywhere in user-facing UI
3. Settings (save path, threads) must be applied when starting downloads
4. Tab memory must persist across popup opens
5. Completed downloads must have "Open Folder" button
6. Report: files changed per fix

