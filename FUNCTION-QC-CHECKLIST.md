# FUNCTION QC CHECKLIST — IDMAM v1.1.0
# Status: ✅ PASS | ⚠️ WARNING | ❌ FAIL | 🔄 Checking | ⬜ Not Started

## server.js (22 functions)
- ⬜ sanitizeError
- ⬜ constructor
- ⬜ _setupMiddleware
- ⬜ _setupRoutes
- ⬜ POST /api/download
- ⬜ GET /api/downloads
- ⬜ GET /api/download/:id
- ⬜ POST /api/download/:id/pause
- ⬜ POST /api/download/:id/resume
- ⬜ POST /api/download/:id/cancel
- ⬜ DELETE /api/download/:id
- ⬜ GET /api/stats
- ⬜ GET /api/settings
- ⬜ PUT /api/settings
- ⬜ GET /api/health
- ⬜ _setupWebSocket
- ⬜ _heartbeat
- ⬜ _broadcastLoop / _broadcastStates
- ⬜ _removeActiveUrl
- ⬜ _isAllowedOrigin
- ⬜ broadcast
- ⬜ start
- ⬜ stop

## downloader.js (28 functions)
- ⬜ Semaphore.acquire / release
- ⬜ constructor
- ⬜ startDownload
- ⬜ pauseDownload
- ⬜ resumeDownload
- ✅ cancelDownload (BUG FOUND + FIXED: worker.__terminated not set)
- ✅ deleteDownload (auto-cancel before delete = correct behavior)
- ⬜ getDownloadState
- ⬜ getActiveStates
- ⬜ getActiveCount
- ⬜ _probeUrl
- ⬜ _startChunkedDownload
- ⬜ _spawnWorkers
- ⬜ _spawnWorkerAsync
- ⬜ _handleWorkerMessage
- ⬜ _cancelAllWorkers
- ⬜ _buildResumeChunks
- ⬜ _getPerWorkerSpeedLimit
- ⬜ _flushChunkState
- ⬜ _startSingleStreamDownload
- ⬜ _doSingleStream
- ⬜ _resumeSingleStreamDownload
- ⬜ _resumeChunkedDownload
- ⬜ _recalcProgress
- ⬜ _checkCompletion
- ⬜ _finalizeDownload
- ⬜ _formatState

## chunk-worker.js (4 functions)
- ⬜ report
- ⬜ parseUrl
- ⬜ downloadChunk
- ⬜ main

## merge.js (3 functions)
- ⬜ mergeChunks
- ⬜ cleanupChunks
- ⬜ mergeAndVerify

## resume.js (13 functions)
- ⬜ constructor
- ⬜ _ensureDir
- ⬜ getDownloadTempDir
- ⬜ getStateFilePath
- ⬜ getChunkPath
- ⬜ saveState
- ⬜ loadState
- ⬜ validateChunks
- ⬜ cleanup
- ⬜ cleanupChunks
- ⬜ findAllStateFiles
- ⬜ updateChunkState
- ⬜ flushPending

## sqlite.js (20 functions)
- ⬜ constructor / _loadOrCreate
- ⬜ save / _markDirty
- ⬜ _query / _queryOne / _run
- ⬜ _initTables / _initSettings
- ⬜ createDownload / getDownload / listDownloads
- ⬜ updateDownload / deleteDownload
- ⬜ createChunks / getChunks / updateChunk
- ⬜ getDownloadWithChunks
- ⬜ getSetting / getSettingInt / getAllSettings
- ⬜ setSetting / updateSettings
- ⬜ getStats / getResumableDownloads
- ⬜ close

## utils/ (16 functions)
- ⬜ parseContentDisposition
- ⬜ filenameFromUrl
- ⬜ sanitizeFilename
- ⬜ resolveFilename
- ⬜ ensureUniqueFilename
- ⬜ hashFile / verifyFile
- ⬜ hashString / hashBuffer / createHasher
- ⬜ detectMime / parseContentType
- ⬜ getCategoryFromMime / resolveCategory
- ⬜ isBlockedHost / validateRedirect
