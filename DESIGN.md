# IDMM  Internet Download Manager Max
## Full System Design Document v1.0

**Created:** 2026-07-14 | **Author:** MANAGER-001 | **Status:** DRAFT  APPROVAL

---

## 1. VISI & MISI

### Visi
Download manager gratis, open-source, tanpa trial/bayar, dengan fitur **melampaui IDM** berbayar.

### Misi
- Multi-threaded download (segmented/chunked)  kecepatan maksimal
- Chrome Extension yang auto-intercept download  IDMM
- Resume capability (lanjut download yang terputus)
- UI modern (dark mode, progress real-time)
- **100% GRATIS, tanpa iklan, tanpa tracking**

---

## 2. PERBANDINGAN FITUR: IDM vs IDMM

| Fitur | IDM (Berbayar $24.95) | IDMM (Gratis) |
|-------|----------------------|----------------|
| Multi-threaded download |  32 threads |  64 threads (default 8) |
| Resume download |  |  |
| Browser integration |  (IE/Chrome/FF) |  (Chrome Extension, FF later) |
| Speed acceleration |  5x claim |  Multi-segment + parallel |
| Video grabber |  |  (v2) |
| Scheduler |  |  (v2) |
| Anti-virus scan |  |  (v1) |
| Price | $24.95/license | **$0  Forever** |

---

## 3. ARSITEKTUR SISTEM

```

                        IDMM ECOSYSTEM                          

                                                                 
        
    Chrome Extension        IDMM Desktop App            
    (IDMM-ext)                 (Electron + Node.js)         
                                                             
     Intercept DL             
     Send to IDMM            Download Engine              
     Show badge               (Node.js Worker Threads)     
     Cookie sender                                         
                                   
          Chunk1 Chunk2 ChunkN    
                                    
           HTTP Range requests         
    Local API Server      Parallel streams            
    (localhost:9977)          Progress tracking           
                              Auto-resume                 
    REST API:                  
    POST /download                                           
    GET /status/:id            
    POST /pause/:id            File Manager                 
    POST /resume/:id          Merge chunks                 
    GET /list                  Verify integrity             
           Organize by type              
                                
                                                              
                                
                                UI (React + Tailwind)        
                               Download list                
                               Speed graph                  
                               Queue manager                
                               Settings                     
                                
                            
                                                                 
    
                      Download Folder                           
    ~/Downloads/IDMM/                                         
     Videos/          (auto-categorize by MIME)             
     Music/                                               
     Documents/                                           
     Software/                                            
     Others/                                              
    

```

---

## 4. KOMPONEN DETAIL

### 4.1 Download Engine (Core)

**Tech:** Node.js + Worker Threads + native `http`/`https`

**Alur Download:**
```
URL received
    
    
HEAD request  Get Content-Length + Accept-Ranges
    
     Accept-Ranges: bytes?  MULTI-SEGMENT MODE
       
       
       Split into N chunks (N = default 8, max 64)
       
       
       Worker Thread per chunk  HTTP Range header
       Range: bytes=start-end
       
       
       Progress callback  UI update (real-time)
       
       
       All chunks complete  MERGE  Final file
       
       
       SHA-256 verify (if checksum provided)
    
     No Range support?  SINGLE STREAM MODE
        
        
        Normal download with progress
```

**Key Features:**
- `chunk_size`: auto-calculate (file_size / threads)
- `max_concurrent_downloads`: 5 (configurable)
- `max_threads_per_download`: 64 (default 8)
- `retry_count`: 3 per chunk
- `timeout`: 30s per chunk
- `speed_limit`: configurable per download or global
- `temp_dir`: `~/.IDMM/temp/<download_id>/` (chunks stored here)

**Resume Mechanism:**
```
Each chunk file: chunk_001.part, chunk_002.part, ...
Metadata file: download.json
{
  "id": "uuid",
  "url": "https://...",
  "filename": "file.zip",
  "total_size": 1073741824,
  "chunks": [
    {"index": 0, "start": 0, "end": 134217727, "downloaded": 134217728, "status": "done"},
    {"index": 1, "start": 134217728, "end": 268435455, "downloaded": 98000000, "status": "paused"}
  ],
  "status": "paused",
  "created_at": "2026-07-14T...",
  "url_hash": "sha256-of-url"
}
```

### 4.2 Local API Server

**Tech:** Express.js on `localhost:9977`

**Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/download` | Start new download `{url, filename?, save_to?, threads?}` |
| `GET` | `/api/downloads` | List all downloads |
| `GET` | `/api/download/:id` | Get download status + progress |
| `POST` | `/api/download/:id/pause` | Pause download |
| `POST` | `/api/download/:id/resume` | Resume download |
| `POST` | `/api/download/:id/cancel` | Cancel + cleanup |
| `DELETE` | `/api/download/:id` | Delete download + files |
| `GET` | `/api/settings` | Get user settings |
| `PUT` | `/api/settings` | Update settings |
| `GET` | `/api/stats` | Speed/history statistics |
| `WS` | `/ws` | WebSocket for real-time progress |

**Security:**
- CORS: only allow `chrome-extension://<id>` and `localhost`
- Rate limit: 100 req/min
- No external access (bind to 127.0.0.1 only)

### 4.3 Chrome Extension (IDMM-ext)

**Manifest V3** (Chrome Web Store compatible)

**Components:**
```
IDMM-ext/
 manifest.json           # Manifest V3
 background.js           # Service Worker  intercept downloads
 content.js              # Content script  page context
 popup/
    popup.html          # Extension popup UI
    popup.js            # Popup logic
    popup.css           # Styles
 options/
    options.html        # Settings page
    options.js          # Settings logic
 icons/                  # Extension icons
    icon16.png
    icon48.png
    icon128.png
 lib/
     api-client.js       # Communication with IDMM app
```

**Manifest.json key permissions:**
```json
{
  "manifest_version": 3,
  "name": "IDMM Extension",
  "permissions": [
    "downloads",
    "downloads.shelf",
    "activeTab",
    "storage",
    "contextMenus",
    "webRequest",
    "webRequestBlocking"
  ],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"],
    "run_at": "document_start"
  }]
}
```

**Intercept Logic (background.js):**
```javascript
// 1. Listen for download events
chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
    // Check if file type should be intercepted
    if (shouldIntercept(item)) {
        // Cancel browser download
        chrome.downloads.cancel(item.id);
        chrome.downloads.erase({id: item.id});
        
        // Send to IDMM app
        sendToIDMM({
            url: item.finalUrl || item.url,
            filename: item.filename,
            filesize: item.totalBytes,
            cookies: item.cookie,
            referrer: item.referrer,
            mime: item.mime
        });
    }
});

// 2. Context menu: "Download with IDMM"
chrome.contextMenus.create({
    title: "Download with IDMM",
    contexts: ["link", "image", "video", "audio"],
    onclick: (info) => sendToIDMM({url: info.linkUrl || info.srcUrl})
});

// 3. Communication with IDMM app via native messaging or HTTP
async function sendToIDMM(downloadInfo) {
    const response = await fetch('http://localhost:9977/api/download', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(downloadInfo)
    });
    // Update badge with active download count
    updateBadge();
}
```

**Auto-intercept Rules (configurable):**
| File Type | Extensions | Auto-Intercept |
|-----------|-----------|----------------|
| Video | .mp4, .mkv, .avi, .mov, .webm, .flv |  Always |
| Audio | .mp3, .wav, .flac, .aac, .ogg |  Always |
| Archive | .zip, .rar, .7z, .tar, .gz |  Always |
| Software | .exe, .msi, .dmg, .deb, .rpm, .apk |  Always |
| Document | .pdf, .docx, .xlsx, .pptx |  Always |
| Image | .jpg, .png, .gif, .webp |  Browser handles |
| Small files | < 5MB |  Browser handles |
| Dynamic | .php, .asp (streaming) |  Browser handles |

### 4.4 Desktop UI

**Tech:** Electron + React 19 + Tailwind CSS + Recharts

**Layout:**
```

  IDMM v1.0                              [ Settings] [][][] 

                                                             
  [All] [Downloading] [Completed] [Paused] [Queue]    []  
                                                             
    
    ubuntu-24.04-desktop.iso                            
     67%  1.2 GB / 1.8 GB     
    12.4 MB/s  8 threads  ETA: 48s   [] []        
    
    game-setup.zip                                      
     100%  4.2 GB             
    Complete  SHA-256 verified        [] []        
    
    video-tutorial.mp4                                  
     32%  450 MB / 1.4 GB    
    Paused  4 threads  Resume available  [] []     
    
                                                             
    
    Speed Graph (last 60s)                              
                           
   Current: 12.4 MB/s  Peak: 18.7 MB/s  Avg: 10.2 MB/s  
    
                                                             
  Status: 2 active  1 paused  1 completed  Queue: 3      

```

---

## 5. STRUKTUR PROJECT

```
D:\IDMM\
 DESIGN.md                    # This file
 package.json                 # Root workspace
 app/                         # Electron Desktop App
    package.json
    main.js                  # Electron main process
    preload.js               # Preload script
    src/
       engine/              # Download Engine
          downloader.js    # Core download logic
          chunk-worker.js  # Worker thread for chunks
          merge.js         # Chunk merger
          resume.js        # Resume manager
       server/              # Local API Server
          server.js        # Express server
          routes/          # API routes
          middleware/       # Auth, rate limit
          websocket.js     # WS for real-time
       db/                  # Local database
          sqlite.js        # SQLite via better-sqlite3
          migrations/      # Schema migrations
       utils/               # Utilities
           filename.js      # Smart filename resolver
           mime.js           # MIME type detection
           hash.js          # Checksum verification
    ui/                      # React Frontend
       src/
          App.jsx
          components/
             DownloadList.jsx
             DownloadItem.jsx
             SpeedGraph.jsx
             Settings.jsx
             AddDownload.jsx
             QueueManager.jsx
          hooks/
             useWebSocket.js
          store/
              downloadStore.js
       index.html
       vite.config.js
       tailwind.config.js
       package.json
    assets/
        icon.ico
        tray-icon.png

 extension/                   # Chrome Extension
    manifest.json
    background.js
    content.js
    popup/
       popup.html
       popup.js
       popup.css
    options/
       options.html
       options.js
    icons/
    lib/
        api-client.js

 installer/                   # NSIS Installer (later)
     IDMM-setup.nsi
```

---

## 6. TECH STACK

| Component | Technology | Alasan |
|-----------|-----------|--------|
| **Desktop Shell** | Electron 35 | Cross-platform, native feel, system tray |
| **Download Engine** | Node.js Worker Threads | True parallel HTTP streams, non-blocking |
| **HTTP Client** | native `http`/`https` + `undici` | Zero dependency, full control over Range headers |
| **Local Server** | Express.js | Lightweight REST API for extension communication |
| **WebSocket** | `ws` library | Real-time progress to UI + extension |
| **Database** | SQLite (better-sqlite3) | Local, fast, zero-config, stores download history |
| **Frontend** | React 19 + Vite | Fast builds, modern UI |
| **Styling** | Tailwind CSS | Rapid UI development |
| **Charts** | Recharts | Speed graph visualization |
| **Chrome Extension** | Manifest V3 | Future-proof, Chrome Web Store ready |
| **Installer** | NSIS / Electron Builder | Windows installer |

---

## 7. DEVELOPMENT PHASES

### Phase 1: Core Engine (Week 1)
- [ ] Download engine: multi-threaded chunk download
- [ ] Single file download with 8 parallel streams
- [ ] Progress tracking (per-chunk + total)
- [ ] Pause/Resume mechanism
- [ ] File merge after completion
- [ ] Basic CLI test

### Phase 2: Local API + Extension (Week 1-2)
- [ ] Express API server (localhost:9977)
- [ ] WebSocket for real-time updates
- [ ] Chrome Extension: intercept downloads
- [ ] Extension: send to IDMM via API
- [ ] Extension: context menu "Download with IDMM"
- [ ] Extension: popup show active downloads

### Phase 3: Desktop UI (Week 2)
- [ ] Electron shell with system tray
- [ ] React UI: download list with progress bars
- [ ] Speed graph (real-time)
- [ ] Add download dialog (paste URL)
- [ ] Settings page (threads, save path, intercept rules)
- [ ] Queue manager

### Phase 4: Polish & Package (Week 2-3)
- [ ] Auto-categorize downloads by type
- [ ] Download history + search
- [ ] Keyboard shortcuts
- [ ] NSIS installer / Electron Builder
- [ ] Chrome Extension packaging for local install

---

## 8. API SPECIFICATION

### POST /api/download
```json
// Request
{
  "url": "https://example.com/file.zip",
  "filename": "file.zip",           // optional, auto-detect
  "save_to": "D:/Downloads/IDMM",  // optional, default from settings
  "threads": 8,                      // optional, default 8
  "cookies": "session=abc123",       // optional, from browser
  "referrer": "https://example.com", // optional
  "headers": {}                      // optional, custom headers
}

// Response 201
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "downloading",
  "filename": "file.zip",
  "total_size": 1073741824,
  "threads": 8,
  "created_at": "2026-07-14T14:51:00Z"
}
```

### GET /api/download/:id
```json
// Response 200
{
  "id": "550e8400-...",
  "url": "https://example.com/file.zip",
  "filename": "file.zip",
  "status": "downloading",  // downloading | paused | completed | failed
  "total_size": 1073741824,
  "downloaded": 721420288,
  "progress": 67.2,
  "speed": 13000000,        // bytes/sec
  "eta": 27,                // seconds
  "threads": 8,
  "active_threads": 8,
  "chunks": [
    {"index": 0, "progress": 100, "speed": 1625000},
    {"index": 1, "progress": 85, "speed": 1625000},
    ...
  ]
}
```

### WebSocket /ws
```json
// Server  Client (every 500ms)
{
  "type": "progress",
  "download_id": "550e8400-...",
  "downloaded": 721420288,
  "speed": 13000000,
  "progress": 67.2,
  "eta": 27,
  "active_threads": 8
}

// Server  Client (on complete)
{
  "type": "completed",
  "download_id": "550e8400-...",
  "filename": "file.zip",
  "total_size": 1073741824,
  "duration": 82,
  "average_speed": 13094415
}
```

---

## 9. KEAMANAN

| Aspek | Implementasi |
|-------|-------------|
| **API Access** | Bind 127.0.0.1 only, no external access |
| **CORS** | Whitelist: chrome-extension:// + localhost |
| **Extension Auth** | Shared secret token (generated on install) |
| **File Integrity** | SHA-256 verification after merge |
| **No Telemetry** | Zero data collection, zero phone-home |
| **Open Source** | Full source on GitHub, auditable |

---

## 10. ESTIMASI UKURAN

| Component | Est. Files | Est. Lines |
|-----------|-----------|------------|
| Download Engine | 8 | ~1,200 |
| API Server | 6 | ~800 |
| Chrome Extension | 8 | ~900 |
| Electron Shell | 4 | ~400 |
| React UI | 15 | ~2,000 |
| Config/Build | 6 | ~200 |
| **TOTAL** | **~47 files** | **~5,500 lines** |

---

## 11. CATATAN TEKNIS

### Multi-threaded Download  Cara Kerja
```
File: ubuntu.iso (1.8 GB)
Server supports: Accept-Ranges: bytes

Thread 1: Range: 0-234881023         chunk_001.part (224 MB)
Thread 2: Range: 234881024-469762047  chunk_002.part (224 MB)
Thread 3: Range: 469762048-704643071  chunk_003.part (224 MB)
...
Thread 8: Range: 1610612736-1879048191  chunk_008.part (256 MB)

All 8 download PARALEL  ~8x faster than single stream
After all complete  merge chunks  ubuntu.iso (1.8 GB)
```

### Edge Cases
1. **Server doesn't support Range**  fallback to single stream
2. **Connection drops mid-chunk**  retry that chunk (3x), then resume
3. **Server returns 416 (Range Not Satisfiable)**  chunk already complete
4. **Redirect chains**  follow up to 5 redirects, preserve cookies
5. **Cloudflare/JS challenge**  use cookies from Chrome extension
6. **Very large files (>4GB)**  use 64-bit range, no issue with Node.js streams

---

**END OF DESIGN DOCUMENT**
**Awaiting Bob's approval before Phase 1 execution.**

