# IDMAM v2 — QC Audit Report (Post-Fix)

**Date:** 2026-07-15 15:15 GMT+7
**Auditor:** QC Subagent (idmam-qc-v2)
**Codebase:** D:\IDMAM\app (13 security/quality fixes applied)
**Test Result:** ✅ **9/9 PASS** — `node test.js` all green

---

## Summary

| Category | ✅ Pass | ❌ Fail | ⚠️ Warning |
|----------|---------|---------|------------|
| Previous Fixes (F1–F13) | 14 | 0 | 0 |
| New Issues Found | — | 0 | 6 |
| Cross-File Interactions | 5 | 0 | 1 |
| Edge Cases & Robustness | 8 | 0 | 2 |
| **Total** | **27** | **0** | **9** |

**Verdict: PASS — All 13 fixes are correctly implemented. No critical new issues. 9 warnings for defensive improvements.**

---

## Part 1: Previous Fixes Verification (F1–F13)

### F1: Path Traversal Validation on `save_to` (server.js)

✅ **PASS** — Lines 148–163 in server.js.

`save_to` is resolved via `path.resolve()` then checked against `allowedRoots` set (`default_save_path` + `~/Downloads`). The check uses `startsWith(root + path.sep)` to prevent prefix-matching attacks (e.g., `/home/bob/DownloadsMalicious`).

**Details:**
- `allowedRoots` is always populated (at minimum `~/Downloads` is added)
- Both `resolvedSaveTo === root` (exact match) and `resolvedSaveTo.startsWith(root + path.sep)` (subdirectory) are checked
- Returns 403 on failure

### F2: `settled` Flag for Unhandled Rejection (downloader.js)

✅ **PASS** — Lines 478–483 in downloader.js (`_doSingleStream`).

`settled` boolean guards `resolve`/`reject` against double-settlement. `safeResolve` and `safeReject` wrappers check `!settled` before calling through.

**Details:**
- Covers the case where both `res.on('error')` and `req.on('error')` fire
- Also covers timeout + error race conditions
- Single-stream and resume paths both use this guard

### F3: Resume-Already-Active Guard (downloader.js)

✅ **PASS** — Lines 207–209 in downloader.js.

`resumeDownload()` checks `this.active.has(downloadId)` first and throws `'Download already active'` if the download is already running. This prevents double-spawning workers for the same download.

### F4: `streamWrapper.exited` Flag (downloader.js)

✅ **PASS** — Lines 459, 472, 477 in downloader.js.

`streamWrapper = { terminate: () => req.destroy(), exited: false }` is created for single-stream downloads. The `exited` flag is set to `true` on both `res.on('end')` and `res.on('error')` callbacks. This prevents `_cancelAllWorkers` and `active_threads` counting from operating on finished wrappers.

### F5: `_recalcProgress` 500ms Throttle (downloader.js)

✅ **PASS** — Lines 682–688 in downloader.js.

DB writes are throttled via `state._lastDbWrite` timestamp check:
```js
if (!state._lastDbWrite || (now - state._lastDbWrite) >= 500) {
  state._lastDbWrite = now;
  this.db.updateDownload(...);
}
```
This prevents DB write storms during high-frequency progress events. Progress callback to WebSocket is still unthrottled (correct — WS broadcast already has its own 500ms interval).

### F6: WebSocket `maxPayload` (server.js)

✅ **PASS** — Line 295 in server.js.

```js
this.wss = new WebSocketServer({ server: this.server, path: '/ws', maxPayload: 64 * 1024 });
```
64KB limit prevents memory abuse from malicious client messages.

### F7: WebSocket Heartbeat (server.js)

✅ **PASS** — Lines 298–307 and 312–313 in server.js.

- 30-second interval pings all clients
- Dead connections (`isAlive === false`) are terminated and removed
- `ws.isAlive` set to `true` on connection and on `pong` event

### F8: Chunk DB ID Caching (downloader.js)

✅ **PASS** — Lines 326–330, 391–395, 447–451, 530–535 in downloader.js.

`state.chunkDbIds` is populated once from `getChunks()` after initial DB insert, then referenced via `state.chunkDbIds[chunk.index]` for all subsequent `updateChunk()` calls. This eliminates repeated `getChunks()` queries on every progress tick.

### F9: Rate Limiter TTL Eviction (server.js)

✅ **PASS** — Lines 103–110 in server.js.

`_rateLimitCleanupTimer` runs every 5 minutes and deletes entries where `now - entry.windowStart > RATE_WINDOW`. The timer is also properly cleared in `stop()`.

### F10: Duplicate URL Check (server.js)

✅ **PASS** — Lines 169–171 in server.js.

`this.activeUrls` Set tracks URLs being downloaded. POST `/api/download` checks `this.activeUrls.has(url)` and returns 409 if duplicate. Cleanup via `_removeActiveUrl()` on cancel, delete, complete, and error callbacks.

### F11: Global Worker Concurrency Semaphore (downloader.js)

✅ **PASS** — Lines 22–42 in downloader.js.

`_globalWorkerSemaphore` object with `acquire()`/`release()` methods, max 128 workers. `_spawnWorkerAsync()` awaits `acquire()` before creating Worker, and `release()` is called in `worker.on('exit')`. Guard in `_spawnWorkerAsync` checks `state.status` after semaphore acquire to handle pause/cancel during wait.

### F12: `updateChunkState` Debouncing (resume.js)

✅ **PASS** — Lines 199–230 in resume.js.

- Updates accumulated in `this._pendingUpdates[downloadId][chunkIndex]`
- 500ms debounce timer per download via `this._pendingTimers[downloadId]`
- `flushPending()` method immediately processes all pending updates (called by `_flushChunkState` before pause)
- `saveState()` cancels any pending debounced save (direct save supersedes)

### F13: Atomic Write in Merge (merge.js)

✅ **PASS** — Lines 29, 62 in merge.js.

- Writes to `outputPath + '.part'` temp file
- `fs.renameSync(tempPath, outputPath)` after successful write
- All error paths clean up temp file via `try { fs.unlinkSync(tempPath) } catch {}`
- Rename failure also triggers temp cleanup

### Bonus: `outputStream.destroy()` on Error Paths (merge.js)

✅ **PASS** — Lines 52, 58, 70 in merge.js.

All error paths in `mergeChunks()` call `outputStream.destroy()` before rejecting:
- Missing chunk file (line 52)
- Input stream error (line 58)
- Output stream error (line 70)

### Bonus: `fileStream.on('error')` in chunk-worker.js

✅ **PASS** — Line 139 in chunk-worker.js.

```js
fileStream.on('error', reject);
```
Handles disk full, permission errors, and other write failures.

### Bonus: `requestHeaders` Stored on State (downloader.js)

✅ **PASS** — Line 166 in downloader.js.

`requestHeaders` is stored as `state.requestHeaders` for the fallback-to-single-stream path when Range is not supported. Used at line 407: `requestHeaders: state.requestHeaders || {}`.

---

## Part 2: New Issues Found

### ⚠️ W1: `mergeAndVerify` Temp File Cleanup on Size/Checksum Mismatch (merge.js)

**Severity:** Warning | **File:** merge.js, lines 108–120

When `mergeChunks()` succeeds (temp file renamed to `outputPath`), but subsequent size or checksum verification fails, the partially-merged output file is left on disk. The error is thrown but the file isn't cleaned up.

**Impact:** Low. On resume, the download will restart anyway. Leftover file may confuse the user.

**Recommendation:** Consider deleting `outputPath` on verification failure in `mergeAndVerify()`.

### ⚠️ W2: `_doSingleStream` Redirect Reuses Same `resolve`/`reject` (downloader.js)

**Severity:** Warning | **File:** downloader.js, lines 505–508

On redirect (301/302/303/307/308), the method recursively calls `_doSingleStream` passing the same `resolve`/`reject` functions. However, `settled` is scoped to the inner function — each recursive call creates a new `settled` flag. If the first request's `req` errors *after* the redirect callback fires, `safeReject` from the *original* call could fire (settled is still false in the original scope), while the recursive call's promise chain also proceeds.

**Impact:** Low. The original request is destroyed on redirect, making late errors unlikely. The `settled` guard handles the common race.

**Recommendation:** Add `req.destroy()` explicitly after detecting redirect, before calling `_doSingleStream`.

### ⚠️ W3: `flushPending()` May Re-Entrant Save (resume.js)

**Severity:** Warning | **File:** resume.js, lines 235–252

`flushPending()` calls `this.loadState()` then `this.saveState()`. `saveState()` checks/clears `_pendingTimers` — but `flushPending()` already cleared them. However, if `saveState()` is called concurrently from another async path, there's a theoretical race (though unlikely in Node.js single-threaded model).

**Impact:** Negligible in practice due to Node.js event loop.

### ⚠️ W4: Rate Limiter Doesn't Respect `X-Forwarded-For` (server.js)

**Severity:** Warning | **File:** server.js, lines 83–101

Rate limiting uses `req.ip`, which by default is `127.0.0.1` when behind no proxy. Since IDMAM binds to localhost only, this is fine. But if a reverse proxy is ever added, all clients would share one rate limit bucket.

**Impact:** N/A for current architecture (localhost-only). Just a forward-looking note.

### ⚠️ W5: `_checkCompletion` Double-Finalize Guard (downloader.js)

**Severity:** Warning (positive) | **File:** downloader.js, lines 660–676

`state._finalizing` flag prevents double-finalize. However, in the `anyFailed` branch (line 670), `state._finalizing` is checked again redundantly (it was already checked at line 661). This is harmless but suggests the code was patched incrementally.

**Impact:** None. Redundant check is defensive.

### ⚠️ W6: `pauseDownload` Terminates Workers Without `await` (downloader.js)

**Severity:** Warning | **File:** downloader.js, lines 178–182

`worker.terminate()` is called synchronously but `terminate()` returns a Promise. The pause flow doesn't await termination completion before marking as paused. This is acceptable because:
1. `__terminated` flag prevents exit handler from re-marking chunks as failed
2. `_flushChunkState()` runs before terminate, capturing current progress
3. DB and resume file are updated atomically

**Impact:** None in practice. Worker threads are killed immediately by `terminate()`.

---

## Part 3: Cross-File Interaction Audit

### ✅ downloader ↔ chunk-worker Message Protocol

**PASS.** Message types are consistently used:
- `progress` — `{ downloaded, totalBytes, chunkBytes }`
- `chunk_done` — `{ downloaded, totalBytes }`
- `error` — `{ message, noRangeSupport?, exhausted? }`
- `retry` — `{ attempt, nextAttempt, delay, error }`
- `attempt` — `{ attempt, maxRetries }`

All message types are handled in `_handleWorkerMessage()`. No unmatched types.

### ✅ downloader ↔ resume State Management

**PASS.** `saveState()` is called at download start and after chunk creation. `updateChunkState()` debounces during download. `flushPending()` is called in `_flushChunkState()` before pause. `loadState()` is used in resume path. `cleanup()` is called on completion.

### ✅ server ↔ downloader API Contract

**PASS.** Server routes correctly call downloader methods:
- POST `/api/download` → `startDownload()`
- POST `:id/pause` → `pauseDownload()`
- POST `:id/resume` → `resumeDownload()`
- POST `:id/cancel` → `cancelDownload()`
- DELETE `:id` → `deleteDownload()`
- GET `:id` → `getDownloadState()`
- GET `/api/downloads` → enriched from `listDownloads()` + `getDownloadState()`

### ✅ merge Atomic Write + Cleanup

**PASS.** `mergeChunks()` uses temp file + rename. `cleanupChunks()` is called after successful merge in `mergeAndVerify()`. The `download.json` state file is cleaned up by `this.resume.cleanup()` in `_finalizeDownload()`.

### ✅ DB ↔ Download State Consistency

**PASS.** DB chunk records are updated via cached IDs (`state.chunkDbIds`). Download status transitions are consistent: downloading → paused → downloading → merging → completed/failed.

### ⚠️ W7: `onComplete`/`onError` Callback Overwrite

**Warning.** In `server.start()`, `this.downloader.onComplete` and `this.downloader.onError` are overwritten to add WebSocket broadcast + URL cleanup. If `DownloadManager` is used without the server, the original no-op callbacks from the constructor are used. This is correct but fragile — a comment would help.

---

## Part 4: Edge Cases & Robustness

### ✅ Null/Empty URL Handling

**PASS.** `startDownload()` throws if `!url`. Server validates with `new URL(url)`.

### ✅ Unicode Filename Support

**PASS.** `parseContentDisposition()` handles RFC 5987 `filename*=UTF-8''...`. `sanitizeFilename()` preserves Unicode characters while removing OS-illegal ones.

### ✅ Large File Handling

**PASS.** `hashFile()` streams file (no memory loading). Chunk downloads use append mode for resume. Merge streams chunks sequentially.

### ✅ Missing Chunk File

**PASS.** `mergeChunks()` checks `fs.existsSync(chunkPath)` before creating read stream. Returns clear error message.

### ✅ Disk Full / Permission Errors

**PASS.** `fileStream.on('error', reject)` in chunk-worker.js. `outputStream.on('error', ...)` in merge.js.

### ✅ Concurrent Download Limit

**PASS.** Server checks `getActiveCount() >= maxConcurrent` before starting download.

### ✅ DB Auto-Save

**PASS.** `_saveInterval` (5s) saves if dirty. `close()` clears interval and saves. `save()` exports WASM DB to disk.

### ✅ Worker Crash Handling

**PASS.** `worker.on('error')` marks chunk as failed. `worker.on('exit')` with non-zero code marks chunk as failed (unless `__terminated`).

### ⚠️ W8: `_probeUrl` Missing `req.destroy()` on Redirect

**Warning.** In `_probeUrl()`, when a redirect is detected, the current response is resolved from but `res.resume()` is not called before resolving the recursive call. The response body should be drained to free the socket.

**Impact:** Low. HEAD requests have no body to drain. But for edge cases where a server returns a body with a redirect, the socket could hang until timeout.

### ⚠️ W9: `ensureUniqueFilename` No Upper Bound on Counter

**Warning.** `ensureUniqueFilename()` loops `while (existsFn(...))` with no limit. If thousands of files with the same name exist, this could be slow.

**Impact:** Negligible in practice. Would need millions of files to cause issues.

---

## Part 5: Resource Management Audit

### ✅ Worker Thread Cleanup
- Workers terminated on pause (with `__terminated` flag)
- Workers terminated on cancel
- Workers removed from `state.workers` array on exit
- Global semaphore released on exit (even for crashed workers)

### ✅ Stream Cleanup
- `fileStream.end()` called on response end and error
- `outputStream.destroy()` called on merge errors
- `inputStream` errors trigger output cleanup

### ✅ DB Resource Management
- `_saveInterval` cleared on `close()`
- DB saved before close
- sql.js instance properly closed

### ✅ Timer Cleanup
- `broadcastTimer` cleared in `stop()`
- `_heartbeatTimer` cleared in `stop()`
- `_rateLimitCleanupTimer` cleared in `stop()`
- Debounce timers in resume.js managed per-download
- `flushPending()` clears all pending timers

### ✅ WebSocket Client Cleanup
- Dead connections detected and terminated via heartbeat
- `wsClients` Set cleaned on close/error events
- Bulk close in `stop()` with reason code

---

## Part 6: Test Coverage Assessment

| Test | Coverage |
|------|----------|
| Health check | Server startup, middleware |
| Download start | Probe, filename resolution, DB insert, chunk creation |
| Progress monitoring | Worker message handling, speed calc, progress callback |
| Pause | Worker termination, state flush, DB update |
| Resume | State reconstruction, chunk validation, worker re-spawn |
| Completion | Merge, verify, cleanup, DB finalization |
| File integrity | SHA-256 verification end-to-end |
| WebSocket | Connection, initial state broadcast |
| List & Stats | DB queries, active state enrichment |

**Not covered by tests** (acceptable for integration test scope):
- Path traversal rejection
- Rate limiting
- Duplicate URL rejection
- Concurrent download limit
- No-Range-support fallback (single-stream)
- Speed limiting
- Multi-redirect chains
- Unicode filenames
- Large file (>1GB) stress

---

## Final Summary

| # | Check | Result |
|---|-------|--------|
| F1 | Path traversal validation | ✅ PASS |
| F2 | `settled` flag | ✅ PASS |
| F3 | Resume-already-active guard | ✅ PASS |
| F4 | `streamWrapper.exited` flag | ✅ PASS |
| F5 | `_recalcProgress` throttle | ✅ PASS |
| F6 | WS `maxPayload` | ✅ PASS |
| F7 | WS heartbeat | ✅ PASS |
| F8 | Chunk DB ID caching | ✅ PASS |
| F9 | Rate limiter TTL eviction | ✅ PASS |
| F10 | Duplicate URL check | ✅ PASS |
| F11 | Global worker semaphore | ✅ PASS |
| F12 | `updateChunkState` debounce | ✅ PASS |
| F13 | Atomic write (temp+rename) | ✅ PASS |
| — | `outputStream.destroy()` on error | ✅ PASS |
| — | `fileStream.on('error')` handler | ✅ PASS |
| — | `requestHeaders` on state | ✅ PASS |
| — | Integration tests (9/9) | ✅ PASS |
| W1 | Merge verification file cleanup | ⚠️ WARNING |
| W2 | Redirect `settled` scope | ⚠️ WARNING |
| W3 | `flushPending` re-entrancy | ⚠️ WARNING |
| W4 | Rate limiter IP source | ⚠️ WARNING |
| W5 | Redundant `_finalizing` check | ⚠️ WARNING |
| W6 | `terminate()` not awaited | ⚠️ WARNING |
| W7 | Callback overwrite fragility | ⚠️ WARNING |
| W8 | `_probeUrl` redirect drain | ⚠️ WARNING |
| W9 | `ensureUniqueFilename` unbounded | ⚠️ WARNING |

**Overall: ✅ PASS — 0 failures, 9 warnings (all low severity, none blocking)**

All 13 security/quality fixes are correctly implemented and verified. The codebase is production-ready with the noted warnings as future improvement items.
