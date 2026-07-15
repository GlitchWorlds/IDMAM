/**
 * IDMAM API Client — shared between popup, background, and options.
 * Handles all communication with the IDMAM desktop app server.
 */

const IDMAM_API = {
  BASE_URL: 'http://127.0.0.1:9977',
  TIMEOUT: 5000,

  async _fetch(path, options = {}) {
    const baseUrl = IDMAM_API.BASE_URL;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), IDMAM_API.TIMEOUT);

      const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      return response.json();
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('IDMAM server timeout');
      }
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        throw new Error('IDMAM server offline');
      }
      throw err;
    }
  },

  // ─── Downloads ─────────────────────────────────────────────────

  async startDownload({ url, filename, cookies, referrer, threads, save_to, headers }) {
    return IDMAM_API._fetch('/api/download', {
      method: 'POST',
      body: JSON.stringify({ url, filename, cookies, referrer, threads, save_to, headers }),
    });
  },

  async listDownloads(status) {
    const query = status ? `?status=${status}` : '';
    return IDMAM_API._fetch(`/api/downloads${query}`);
  },

  async getDownload(id) {
    return IDMAM_API._fetch(`/api/download/${id}`);
  },

  async pauseDownload(id) {
    return IDMAM_API._fetch(`/api/download/${id}/pause`, { method: 'POST' });
  },

  async resumeDownload(id) {
    return IDMAM_API._fetch(`/api/download/${id}/resume`, { method: 'POST' });
  },

  async cancelDownload(id) {
    return IDMAM_API._fetch(`/api/download/${id}/cancel`, { method: 'POST' });
  },

  async deleteDownload(id) {
    return IDMAM_API._fetch(`/api/download/${id}`, { method: 'DELETE' });
  },

  async getServerStats() {
    return IDMAM_API._fetch('/api/stats');
  },

  async healthCheck() {
    try {
      const baseUrl = IDMAM_API.BASE_URL;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${baseUrl}/api/health`, { signal: controller.signal });
      clearTimeout(timeout);
      return res.ok;
    } catch {
      return false;
    }
  },

  // ─── Settings (chrome.storage.local) ────────────────────────────

  /**
   * Get extension settings from chrome.storage.local.
   * All settings are stored flat under the 'idmam_settings' key.
   */
  async getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get('idmam_settings', (result) => {
        resolve(result.idmam_settings || IDMAM_API.defaultSettings());
      });
    });
  },

  /**
   * Save extension settings to chrome.storage.local.
   */
  async saveSettings(settings) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ idmam_settings: settings }, resolve);
    });
  },

  /**
   * Default settings object.
   */
  defaultSettings() {
    return {
      enabled: true,
      maxThreads: 8,
      defaultSavePath: '',
      interceptMinSize: 5 * 1024 * 1024, // 5MB
      interceptVideo: true,
      interceptAudio: true,
      interceptArchive: true,
      interceptSoftware: true,
      interceptDocument: true,
    };
  },

  // ─── File Type Detection ───────────────────────────────────────

  INTERCEPT_EXTENSIONS: {
    video: ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv', '.wmv', '.m4v', '.ts', '.mpg', '.mpeg'],
    audio: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma', '.opus'],
    archive: ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.iso', '.tgz'],
    software: ['.exe', '.msi', '.dmg', '.deb', '.rpm', '.apk', '.appx', '.appimage'],
    document: ['.pdf', '.docx', '.xlsx', '.pptx', '.doc', '.xls', '.ppt', '.epub'],
  },

  /**
   * Determine if a download should be intercepted.
   * @param {string} filename
   * @param {number} fileSize - bytes, -1 if unknown
   * @param {Object} settings - from getSettings()
   * @returns {boolean}
   */
  shouldIntercept(filename, fileSize, settings) {
    if (!settings.enabled) return false;
    if (!filename) return false;

    const lower = filename.toLowerCase();

    // Size threshold — skip small files
    const minSize = settings.interceptMinSize || 0;
    if (fileSize > 0 && fileSize < minSize) return false;

    const categories = {
      video: settings.interceptVideo,
      audio: settings.interceptAudio,
      archive: settings.interceptArchive,
      software: settings.interceptSoftware,
      document: settings.interceptDocument,
    };

    for (const [category, enabled] of Object.entries(categories)) {
      if (!enabled) continue;
      const exts = IDMAM_API.INTERCEPT_EXTENSIONS[category];
      if (exts && exts.some(ext => lower.endsWith(ext))) return true;
    }

    return false;
  },

  // ─── Formatting Helpers ────────────────────────────────────────

  formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  },

  formatSpeed(bytesPerSec) {
    if (!bytesPerSec) return '0 B/s';
    return `${IDMAM_API.formatBytes(bytesPerSec)}/s`;
  },

  formatETA(seconds) {
    if (!seconds || seconds <= 0) return '--';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  },
};

if (typeof module !== 'undefined') module.exports = IDMAM_API;
