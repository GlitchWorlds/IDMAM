/**
 * IDMM Content Script  Page context for extracting download links.
 * Minimal footprint: only responds to messages from background.js.
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSelectedLinks') {
    // Return all links on the page
    const links = Array.from(document.querySelectorAll('a[href]'))
      .map(a => ({ url: a.href, text: a.textContent?.trim() }))
      .filter(l => l.url.startsWith('http'));
    sendResponse({ links });
  }

  if (request.action === 'getPageMedia') {
    const media = [
      ...Array.from(document.querySelectorAll('video[src], video source[src]'))
        .map(el => ({ type: 'video', url: el.src })),
      ...Array.from(document.querySelectorAll('audio[src], audio source[src]'))
        .map(el => ({ type: 'audio', url: el.src })),
      ...Array.from(document.querySelectorAll('img[src]'))
        .map(el => ({ type: 'image', url: el.src })),
    ].filter(m => m.url.startsWith('http'));
    sendResponse({ media });
  }

  return true; // Keep message channel open for async response
});

// --- Gap 3: Proactive content → background communication ---
// Send page metadata to background.js so it can detect downloadable content.
(function _reportPageMetadata() {
  try {
    const metadata = {
      type: 'PAGE_METADATA',
      pageTitle: document.title || '',
      pageUrl: window.location.href || '',
      contentLength: document.documentElement?.innerHTML?.length || 0,
      // Collect all <a> hrefs that look like direct download links
      downloadLinks: Array.from(document.querySelectorAll('a[href]'))
        .map(a => ({ url: a.href, text: (a.textContent || '').trim() }))
        .filter(l => l.url.startsWith('http'))
        .slice(0, 50), // Cap at 50 to avoid huge payloads
      // Collect media elements (video/audio src)
      mediaUrls: [
        ...Array.from(document.querySelectorAll('video[src], video source[src]'))
          .map(el => el.src),
        ...Array.from(document.querySelectorAll('audio[src], audio source[src]'))
          .map(el => el.src),
      ].filter(u => u && u.startsWith('http')),
    };

    chrome.runtime.sendMessage(metadata);
  } catch {
    // Content script context may be invalidated on navigation
  }
})();

