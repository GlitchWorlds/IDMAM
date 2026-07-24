# Graph Report - D:/IDMM  (2026-07-24)

## Corpus Check
- 68 files · ~52,475 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 528 nodes · 723 edges · 26 communities (21 shown, 5 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 26 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Download Utils & Helpers
- Electron UI Components
- Electron Build Config
- Electron Dependencies
- Extension Manifest
- Database & Speed Tracker
- DownloadManager Core
- App Package Config
- IDMMDatabase Layer
- UI Dependencies
- Resume Manager
- HTTP Server
- Electron Main Process
- Chunk Worker & SSRF
- App Entry Point
- XPI Build Script
- Test Suite
- Icon Generator
- Deep Test Harness
- Worker Pool
- Download Queue
- Extension Background
- Patch Script
- Electron Preload

## God Nodes (most connected - your core abstractions)
1. `DownloadManager` - 35 edges
2. `IDMMDatabase` - 29 edges
3. `ResumeManager` - 16 edges
4. `nsis` - 15 edges
5. `request()` - 12 edges
6. `build` - 11 edges
7. `DownloadItem()` - 11 edges
8. `IDMMServer` - 10 edges
9. `WorkerPool` - 9 edges
10. `DownloadQueue` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Header()` --calls--> `formatSpeed()`  [EXTRACTED]
  electron/ui/src/components/Header.jsx → electron/ui/src/api.js
- `SpeedGraph()` --calls--> `formatSpeed()`  [EXTRACTED]
  electron/ui/src/components/SpeedGraph.jsx → electron/ui/src/api.js
- `downloadChunk()` --calls--> `validateRedirect()`  [EXTRACTED]
  app/src/engine/chunk-worker.js → app/src/utils/ssrf.js
- `App()` --calls--> `getDownloads()`  [EXTRACTED]
  electron/ui/src/App.jsx → electron/ui/src/api.js
- `App()` --calls--> `getStats()`  [EXTRACTED]
  electron/ui/src/App.jsx → electron/ui/src/api.js

## Import Cycles
- None detected.

## Communities (26 total, 5 thin omitted)

### Community 0 - "Download Utils & Helpers"
Cohesion: 0.05
Nodes (44): { detectMime, resolveCategory }, DownloadQueue, fs, fsp, _globalWorkerSemaphore, { hashString }, http, https (+36 more)

### Community 1 - "Electron UI Components"
Cohesion: 0.13
Nodes (27): addDownload(), cancelDownload(), deleteDownload(), formatBytes(), formatETA(), formatSpeed(), getDownload(), getDownloads() (+19 more)

### Community 2 - "Electron Build Config"
Cohesion: 0.05
Nodes (37): build, appId, asar, copyright, directories, extraResources, files, nsis (+29 more)

### Community 3 - "Electron Dependencies"
Cohesion: 0.06
Nodes (34): concurrently, electron, electron-builder, author, dependencies, cors, express, helmet (+26 more)

### Community 4 - "Extension Manifest"
Cohesion: 0.06
Nodes (32): action, default_icon, default_title, background, service_worker, browser_specific_settings, gecko, content_scripts (+24 more)

### Community 5 - "Database & Speed Tracker"
Cohesion: 0.06
Nodes (21): fs, fsp, initSqlJs, path, SpeedTracker, assert, crypto, { describe, it, before, after } (+13 more)

### Community 7 - "App Package Config"
Cohesion: 0.07
Nodes (27): author, dependencies, cors, express, helmet, sql.js, uuid, ws (+19 more)

### Community 9 - "UI Dependencies"
Cohesion: 0.08
Nodes (24): dependencies, react, react-dom, recharts, devDependencies, tailwindcss, @tailwindcss/vite, vite (+16 more)

### Community 10 - "Resume Manager"
Cohesion: 0.17
Nodes (4): fs, fsp, path, ResumeManager

### Community 11 - "HTTP Server"
Cohesion: 0.19
Nodes (9): cors, express, helmet, http, IDMMServer, path, SAFE_ERROR_PATTERNS, sanitizeError() (+1 more)

### Community 12 - "Electron Main Process"
Cohesion: 0.11
Nodes (14): { app, BrowserWindow, Tray, Menu, nativeImage, shell, dialog, ipcMain }, APP_DIR, DATA_DIR, DB_PATH, DEFAULT_SAVE_PATH, DownloadManager, fs, gotLock (+6 more)

### Community 13 - "Chunk Worker & SSRF"
Cohesion: 0.18
Nodes (15): downloadChunk(), fs, http, https, main(), { parentPort, workerData }, parseUrl(), path (+7 more)

### Community 14 - "App Entry Point"
Cohesion: 0.15
Nodes (14): DATA_DIR, DB_PATH, DEFAULT_SAVE_PATH, DownloadManager, formatBytes(), fs, IDMMDatabase, IDMMServer (+6 more)

### Community 15 - "XPI Build Script"
Cohesion: 0.14
Nodes (13): buildZipManually(), crc32(), DIST_DIR, { execSync }, EXT_DIR, filesToInclude, fs, outputFile (+5 more)

### Community 16 - "Test Suite"
Cohesion: 0.22
Nodes (13): apiRequest(), cleanup(), createTestFileServer(), crypto, formatBytes(), formatSpeed(), fs, http (+5 more)

### Community 17 - "Icon Generator"
Cohesion: 0.15
Nodes (13): compressed, crc32(), fs, ico, icoDir, icoHeader, ihdr, path (+5 more)

### Community 18 - "Deep Test Harness"
Cohesion: 0.20
Nodes (11): check(), crypto, files, fs, http, os, path, run() (+3 more)

### Community 19 - "Worker Pool"
Cohesion: 0.17
Nodes (3): path, { Worker }, WorkerPool

### Community 21 - "Extension Background"
Cohesion: 0.36
Nodes (8): checkServer(), connectWebSocket(), interceptedIds, pollDownloads(), scheduleReconnect(), sendToIDMM(), updateBadge(), IDMM_API

## Knowledge Gaps
- **238 isolated node(s):** `http`, `path`, `os`, `fs`, `crypto` (+233 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `DownloadManager` connect `DownloadManager Core` to `Download Utils & Helpers`, `Chunk Worker & SSRF`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Why does `IDMMDatabase` connect `IDMMDatabase Layer` to `Database & Speed Tracker`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **What connects `http`, `path`, `os` to the rest of the system?**
  _238 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Download Utils & Helpers` be split into smaller, more focused modules?**
  _Cohesion score 0.05224963715529753 - nodes in this community are weakly interconnected._
- **Should `Electron UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.13090418353576247 - nodes in this community are weakly interconnected._
- **Should `Electron Build Config` be split into smaller, more focused modules?**
  _Cohesion score 0.05405405405405406 - nodes in this community are weakly interconnected._
- **Should `Electron Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.05714285714285714 - nodes in this community are weakly interconnected._