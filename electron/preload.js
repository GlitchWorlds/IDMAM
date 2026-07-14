const { contextBridge, ipcRenderer } = require('electron');

// Expose protected API to renderer
contextBridge.exposeInMainWorld('idmam', {
  platform: process.platform,
  version: '1.0.0',
  apiUrl: 'http://127.0.0.1:9977',
});
