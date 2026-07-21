# IDMM v1.2.0

## Full QC Audit Updates
- Analyzed backend components (`downloader.js`, `chunk-worker.js`, `server.js`) and resolved memory leaks and race conditions.
- Fixed unhandled promise rejections on stream errors.
- Chrome Extension bugfixes (WebSocket reconnection and memory cleanups).
- Electron UI fixes (React unmounted state update prevention).
- Clean builds performed.

## Bugs Fixed
- `chunk-worker.js`: Handle `fileStream.on('error')` by destroying request and rejecting promise to prevent dangling streams on I/O errors.
- `Settings.jsx`: Track mounted state during `setTimeout` to prevent React memory leak warning on save.
- Extension `background.js`: Add proper `clearInterval` to avoid timer leaks.
- Extension `popup.js`: Handle `unload` cleanly.

## Cara Verifikasi
1. Start backend app: `cd app && npm start`
2. Start Electron app: `cd electron && npm start`
3. Install extension in Chrome and try downloading a file. Ensure no memory leaks are logged.
