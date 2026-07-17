const { contextBridge, ipcRenderer } = require('electron');
const path = require('node:path');

// Read version from package.json
let appVersion = '1.2.0';
try {
  const pkg = require(path.join(__dirname, 'package.json'));
  appVersion = pkg.version || appVersion;
} catch { /* use fallback */ }

// Expose protected API to renderer
contextBridge.exposeInMainWorld('idmm', {
  platform: process.platform,
  version: appVersion,
  apiUrl: 'http://127.0.0.1:9977',
});
