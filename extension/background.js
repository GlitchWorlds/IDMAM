/**
 * IDMAM Chrome Extension — Background Service Worker (Manifest V3)
 *
 * 1. Intercepts browser downloads → sends to IDMAM via REST API
 * 2. Context menu: "Download with IDMAM" for links/images/video/audio
 * 3. Badge showing active download count (poll every 2s)
 * 4. Handles messages from popup and options pages
 */

importScripts('./lib/api-client.js');

// ─── State ──────────────────────────────────────────────────────

let serverOnline = false;
let activeDownloadCount = 0;
let interceptedIds = new Set(); // Track downloads we've intercepted to avoid loops

// ─── Health Check ───────────────────────────────────────────────

async function checkServer() {
  serverOnline = await IDMAM_API.healthCheck();
  updateBadge();
  return serverOnline;
}

// ─── Badge ──────────────────────────────────────────────────────

function updateBadge() {
  if (!serverOnline) {
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    return;
  }

  if (activeDownloadCount > 0) {
    chrome.action.setBadgeText({ text: String(activeDownloadCount) });
    chrome.action.setBadgeBackgroundColor({ color: '#3b82f6' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// ─── Send Download to IDMAM ─────────────────────────────────────

async function sendToIDMAM({ url, filename, filesize, cookies, referrer }) {
  if (!serverOnline) {
    console.log('[IDMAM] Server offline, skipping intercept');
    return false;
  }

  try {
    // Get extension settings for defaults
    const settings = await IDMAM_API.getSettings();

    const result = await IDMAM_API.startDownload({
      url,
      filename: filename || undefined,
      cookies: cookies || undefined,
      referrer: referrer || undefined,
      threads: settings.maxThreads || undefined,
      save_to: settings.defaultSavePath || undefined,
    });

    console.log(`[IDMAM] Download sent: ${result.filename} (${result.id})`);
    activeDownloadCount++;
    updateBadge();
    return true;
  } catch (err) {
    console.error('[IDMAM] Failed to send download:', err.message);
    return false;
  }
}

// ─── Download Interception ──────────────────────────────────────

chrome.downloads.onDeterminingFilename.addListener(async (item, suggest) => {
  // Skip if we already intercepted this (avoid loops)
  if (interceptedIds.has(item.id)) {
    interceptedIds.delete(item.id);
    return; // Let the browser handle the filename
  }

  // Check settings
  const settings = await IDMAM_API.getSettings();
  if (!settings.enabled) return;

  // Check if file should be intercepted
  const should = IDMAM_API.shouldIntercept(
    item.filename,
    item.totalBytes,
    settings
  );

  if (!should) return;

  // Send to IDMAM
  const sent = await sendToIDMAM({
    url: item.finalUrl || item.url,
    filename: item.filename,
    filesize: item.totalBytes,
    cookies: item.cookie,
    referrer: item.referrer,
  });

  if (sent) {
    // Mark and cancel browser download
    interceptedIds.add(item.id);
    try {
      await chrome.downloads.cancel(item.id);
      await chrome.downloads.erase({ id: item.id });
    } catch {
      // Download may have already been cancelled
    }
  }
});

// ─── Context Menu ───────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'idmam-download-link',
    title: 'Download with IDMAM',
    contexts: ['link'],
  });

  chrome.contextMenus.create({
    id: 'idmam-download-media',
    title: 'Download with IDMAM',
    contexts: ['image', 'video', 'audio'],
  });

  chrome.contextMenus.create({
    id: 'idmam-download-selection',
    title: 'Download selected URL with IDMAM',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  let url = null;

  switch (info.menuItemId) {
    case 'idmam-download-link':
      url = info.linkUrl;
      break;
    case 'idmam-download-media':
      url = info.srcUrl || info.linkUrl;
      break;
    case 'idmam-download-selection': {
      const text = (info.selectionText || '').trim();
      try {
        new URL(text);
        url = text;
      } catch {
        console.log('[IDMAM] Selection is not a valid URL');
      }
      break;
    }
  }

  if (!url) return;

  // Extract cookies from current tab
  let cookies = '';
  try {
    const cookieList = await chrome.cookies.getAll({ url });
    cookies = cookieList.map(c => `${c.name}=${c.value}`).join('; ');
  } catch {
    // Cookies API may not be available without permission
  }

  const sent = await sendToIDMAM({
    url,
    cookies,
    referrer: tab?.url || '',
  });

  if (sent) {
    try {
      chrome.notifications?.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'IDMAM',
        message: 'Download sent to IDMAM',
      });
    } catch { /* notifications may not be available */ }
  }
});

// ─── Polling for Active Downloads ───────────────────────────────

async function pollDownloads() {
  if (!serverOnline) return;

  try {
    const downloads = await IDMAM_API.listDownloads();
    const active = downloads.filter(d =>
      d.status === 'downloading' || d.status === 'merging'
    );
    activeDownloadCount = active.length;
    updateBadge();
  } catch {
    serverOnline = false;
    updateBadge();
  }
}

// ─── Message Handlers (popup & options communication) ───────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle async — return true to keep message channel open
  (async () => {
    switch (message.type) {
      case 'CHECK_STATUS':
        return { ok: true, online: serverOnline };

      case 'GET_DOWNLOADS':
        try {
          const downloads = await IDMAM_API.listDownloads();
          return { ok: true, downloads };
        } catch (err) {
          return { ok: false, error: err.message, downloads: [] };
        }

      case 'PAUSE_DOWNLOAD':
        try {
          const result = await IDMAM_API.pauseDownload(message.id);
          return { ok: true, result };
        } catch (err) {
          return { ok: false, error: err.message };
        }

      case 'RESUME_DOWNLOAD':
        try {
          const result = await IDMAM_API.resumeDownload(message.id);
          return { ok: true, result };
        } catch (err) {
          return { ok: false, error: err.message };
        }

      case 'CANCEL_DOWNLOAD':
        try {
          const result = await IDMAM_API.cancelDownload(message.id);
          return { ok: true, result };
        } catch (err) {
          return { ok: false, error: err.message };
        }

      case 'DELETE_DOWNLOAD':
        try {
          const result = await IDMAM_API.deleteDownload(message.id);
          return { ok: true, result };
        } catch (err) {
          return { ok: false, error: err.message };
        }

      case 'ADD_DOWNLOAD':
        try {
          const result = await IDMAM_API.startDownload(message.downloadInfo);
          return { ok: true, result };
        } catch (err) {
          return { ok: false, error: err.message };
        }

      case 'SETTINGS_UPDATED':
        return { ok: true };

      default:
        return { ok: false, error: `Unknown message type: ${message.type}` };
    }
  })().then(sendResponse).catch(err => {
    sendResponse({ ok: false, error: err.message });
  });

  return true; // Keep channel open for async response
});

// ─── Startup ────────────────────────────────────────────────────

(async function init() {
  // Initial health check
  await checkServer();

  // Periodic checks
  setInterval(checkServer, 10000); // Health check every 10s
  setInterval(pollDownloads, 2000); // Poll downloads every 2s

  console.log('[IDMAM] Extension service worker started');
})();
