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

