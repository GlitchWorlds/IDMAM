# IDMM Security Audit V2  Full Report

**Date:** 2026-07-15  
**Auditor:** MANAGER-001 (automated)  
**Scope:** 7 files  server, downloader, chunk-worker, merge, resume, sqlite, extension manifest  
**Methodology:** Static code review, each file checked for its designated security concerns

---

## Summary Table

| # | File | Verdict | Issues | Findings |
|---|------|---------|--------|----------|
| 1 | `server.js` |  PASS | 0 | Path traversal guard , CORS , rate limit , WS security , settings whitelist  |
| 2 | `downloader.js` |  PASS | 0 | Double-settle guard , worker semaphore , terminated flag , resume integrity  |
| 3 | `chunk-worker.js` |  WARNING | 2 | No redirect loop cap; `process.exit()` may lose final `postMessage` |
| 4 | `merge.js` |  WARNING | 1 | No backpressure handling on `WriteStream` (memory pressure on large files) |
| 5 | `resume.js` |  WARNING | 1 | Race condition on concurrent `updateChunkState` across different download IDs sharing file I/O |
| 6 | `sqlite.js` |  PASS | 0 | Parameterized queries , no injection surface, error handling solid |
| 7 | `manifest.json` |  PASS | 0 | CSP correct, permissions minimal, `connect-src` restricted to `127.0.0.1` |

**Overall: 4 PASS / 3 WARNING / 0 FAIL**  
No critical security vulnerabilities found. All warnings are medium/low severity.

---

## Detailed Findings

---

### 1. `src\server\server.js`   PASS

#### Checks Performed

| Check | Verdict | Detail |
|-------|---------|--------|
| **Path traversal on `save_to`** |  | Lines 113128: resolves `save_to` via `path.resolve()`, checks against allowed roots (`default_save_path` + `~/Downloads`). Rejects with `403` if outside. |
| **CORS** |  | Whitelist: `localhost`, `127.0.0.1`, `chrome-extension://`, `moz-extension://`. Rejects all other origins. |
| **Rate limiter** |  | In-memory 100 req/min per IP with 429 response + `retry_after`. TTL-based eviction every 5 min prevents memory leak. |
| **WebSocket security** |  | `maxPayload: 64KB` prevents memory abuse. Origin verification on connection. Heartbeat ping/pong terminates dead clients every 30s. |
| **Auth** |  | Binds to `127.0.0.1:9977` only  not exposed to network. Accepts `X-IDMM-Token` header (ready for future auth). No open relay. |
| **Input validation** |  | URL validated via `new URL()`. Settings updates whitelisted against `allowedKeys` array. JSON body limit `1mb`. |
| **Resource cleanup** |  | `stop()` is idempotent (guards against double-call). Clears all timers, closes all WS clients, closes HTTP server. |

#### Minor Notes (not issues)

- Error messages leak `err.message` in responses (e.g., `res.status(500).json({ error: err.message })`). Acceptable for a localhost-only API, but would be a concern if ever exposed to the network.
- `contentSecurityPolicy: false` in helmet  appropriate since this is a pure API server (no HTML served).

---

### 2. `src\engine\downloader.js`   PASS

#### Checks Performed

| Check | Verdict | Detail |
|-------|---------|--------|
| **Unhandled rejections** |  | All async flows have try/catch. `_doSingleStream` has `safeResolve`/`safeReject` guard (F2 fix). `_finalizeDownload` wraps entire merge in try/catch. `_checkCompletion` guards against double finalization (`_finalizing` flag). |
| **Resource leaks** |  | Workers properly terminated on pause/cancel. `_globalWorkerSemaphore` (F11) caps total workers at 128, preventing thread exhaustion. `speedSamples` cleaned up on all exit paths. |
| **Worker safety** |  | `__terminated` flag prevents stale exit handlers from marking chunks as failed (critical for pause/resume correctness). Semaphore guards against spawning workers after download is paused/cancelled. |
| **Path traversal** |  | Download IDs are UUIDs. Chunk paths are `chunk_NNNNN.part` under UUID-named temp dirs. `saveTo` validated at server layer. `path.join` used throughout (no concatenation). |
| **Resume integrity** |  | `_buildResumeChunks` cross-validates 3 sources (DB, resume JSON, disk `.part` file sizes). Takes the maximum `downloaded` value as ground truth. |
| **Redirect handling** |  | `_probeUrl` caps redirects at 5. `_doSingleStream` follows redirects (inherits URL). |

#### Minor Notes

- `_probeUrl` resolves redirect URLs relative to the current URL (`new URL(location, url)`), which correctly handles relative redirects.
- The global semaphore uses a simple counter pattern  not a true semaphore with fairness, but adequate for this use case.

---

### 3. `src\engine\chunk-worker.js`   WARNING

#### Checks Performed

| Check | Verdict | Detail |
|-------|---------|--------|
| **Error handling** |  | File stream errors caught. HTTP timeout destroys request. Outer `.catch()` on `main()` reports fatal errors. |
| **Resource cleanup** |  | `fileStream.end()` called on both success and error paths. Request destroyed on timeout. |

####  WARNING 1: No redirect loop cap

```javascript
// Lines 88-93: redirect handling has no counter
if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
  const newUrl = new URL(res.headers.location, currentUrl).href;
  resolve(downloadChunk(attempt, newUrl)); // recursive  no depth limit
  return;
}
```

**Risk:** A malicious or misconfigured server could return infinite redirects, eventually causing a stack overflow. The parent `downloader.js` caps redirects at 5 in `_probeUrl`, but the worker does not.

**Severity:** Medium (requires attacker-controlled server or misconfiguration).

**Fix:** Add a `redirectCount` parameter, default 0, increment on each redirect, reject if > 5.

####  WARNING 2: `process.exit()` may lose final `postMessage`

```javascript
// Lines 194-195: exit immediately after report
report('chunk_done', { ... });
process.exit(0);
```

`parentPort.postMessage` is asynchronous  `process.exit(0)` may kill the worker before the message is flushed to the parent thread. If the parent never receives `chunk_done`, it may never trigger `_finalizeDownload`.

**Risk:** Low  in practice, the parent also checks completion via exit codes and file sizes. But in edge cases, a chunk could appear "stuck" at 99%.

**Severity:** Low (self-healing on app restart due to resume system).

**Fix:** Use `process.exitCode = 0` and let the event loop drain naturally, or add a small delay:
```javascript
report('chunk_done', { ... });
setTimeout(() => process.exit(0), 10);
```

---

### 4. `src\engine\merge.js`   WARNING

#### Checks Performed

| Check | Verdict | Detail |
|-------|---------|--------|
| **Atomic write** |  | Writes to `.part` temp file first, `fs.renameSync` on completion. Cleanup on rename failure. |
| **Stream cleanup** |  | `outputStream.destroy()` on errors. Temp file unlinked on all error paths. |
| **Path safety** |  | Paths derived from UUID download IDs and integer chunk indices. `outputPath` validated at server layer. |

####  WARNING 1: No backpressure on output WriteStream

```javascript
// Lines 33-36: writes chunks without checking return value
inputStream.on('data', (chunk) => {
  outputStream.write(chunk);  //  return value (backpressure signal) ignored
  bytesWritten += chunk.length;
});
```

`fs.createWriteStream` can buffer many chunks. If the input stream reads faster than the disk can write, memory usage grows unboundedly. For multi-GB files, this could cause significant memory pressure.

**Severity:** Medium (OOM possible for very large files + slow disk).

**Fix:** Check `outputStream.write(chunk)` return value. If `false`, pause the input stream and wait for `drain`:
```javascript
const canContinue = outputStream.write(chunk);
if (!canContinue) {
  inputStream.pause();
  outputStream.once('drain', () => inputStream.resume());
}
```

---

### 5. `src\engine\resume.js`   WARNING

#### Checks Performed

| Check | Verdict | Detail |
|-------|---------|--------|
| **Debouncing correctness** |  | `updateChunkState` accumulates updates in `_pendingUpdates` with 500ms debounce. `flushPending()` clears all timers and writes immediately. `saveState()` cancels pending debounce (direct save supersedes). |
| **File safety** |  | `readFileSync`/`writeFileSync` are atomic at the OS level (on the same node, no concurrent writes). State file written to UUID-named directories. |

####  WARNING 1: Race condition in `updateChunkState` debounce callback

```javascript
// Lines 148-160: debounce callback reads stale file
this._pendingTimers[key] = setTimeout(() => {
  // ...
  const state = this.loadState(downloadId);  //  reads from disk
  // ... applies pending updates from memory ...
  this.saveState(state);  //  writes back
}, 500);
```

If `saveState()` is called directly (e.g., from `pauseDownload` via `_flushChunkState`) **between** the debounce timeout firing and the disk write completing, the debounce callback's `loadState` may read stale data and overwrite the direct save.

**Current mitigations:** `saveState()` cancels pending debounce timers for the same download ID (line 39). This covers the pause/cancel case.

**Residual risk:** Two concurrent calls to `updateChunkState` for **different chunk indices** of the same download within the same 500ms window  both get batched correctly into one write, so this is actually fine.

**Severity:** Low (well-mitigated by existing code; noted for completeness).

---

### 6. `src\db\sqlite.js`   PASS

#### Checks Performed

| Check | Verdict | Detail |
|-------|---------|--------|
| **SQL injection** |  | All queries use parameterized statements (`stmt.bind(params)`). No string interpolation in SQL. Column names in `updateDownload`/`updateChunk` are from hardcoded `allowed` arrays, not user input. |
| **Error handling** |  | `_query` catches errors, returns `[]`. `_run` catches errors and re-throws. `save()` catches write errors and logs. `close()` calls `save()` before closing. |
| **Data integrity** |  | Foreign key `download_id` on chunks table. `ON DELETE CASCADE` ensures chunk cleanup. Auto-save every 5s with dirty flag minimizes data loss. |

#### Minor Notes

- `updateSettings` stores values as strings without type validation (e.g., `max_concurrent_downloads` could be set to `"abc"`). However, the downloader uses `parseInt()` with fallback defaults, so invalid values are safely ignored.
- The 5-second auto-save interval means up to 5 seconds of data could be lost on a crash. Acceptable tradeoff vs. writing on every mutation.
- `JSON.parse(row.headers)` in `getDownload` could throw if headers are corrupted in DB. Not wrapped in try/catch, but corruption would be extremely rare with sql.js.

---

### 7. `extension\manifest.json`   PASS

#### Checks Performed

| Check | Verdict | Detail |
|-------|---------|--------|
| **CSP** |  | `script-src 'self'` (no `unsafe-eval`, no `unsafe-inline` for scripts). `connect-src` restricted to `127.0.0.1` only. `style-src 'unsafe-inline'` is acceptable for popup UIs. |
| **Permissions** |  | Minimal: `downloads`, `downloads.shelf`, `activeTab`, `storage`, `contextMenus`. No `webRequest`, no `cookies`, no `tabs`. |
| **Host permissions** |  | `<all_urls>` is required for download interception  the extension must be able to intercept download events from any origin. Content script injection at `document_start` is necessary for the download interceptor to work. |
| **Manifest V3** |  | Uses `service_worker` (MV3 compliant). No `persistent: true` background page. |
| **Minimum version** |  | `109`  a recent Chrome version with full MV3 support. |

---

## Risk Summary

| Severity | Count | Description |
|----------|-------|-------------|
|  Critical | 0 | No exploitable vulnerabilities |
|  Medium | 2 | Redirect loop in worker; no backpressure in merge |
|  Low | 2 | Lost `postMessage` on `process.exit`; resume race (mitigated) |
|  Info | 3 | Error message exposure; settings type validation; 5s data loss window |

---

## Recommendations (Priority Order)

### P1  Fix redirect loop cap in chunk-worker.js
Add `redirectCount` parameter to `downloadChunk()`:
```javascript
function downloadChunk(attempt, currentUrl, redirectCount = 0) {
  // ... in redirect handler:
  if (redirectCount >= 5) {
    reject(new Error('Too many redirects in chunk worker'));
    return;
  }
  resolve(downloadChunk(attempt, newUrl, redirectCount + 1));
}
```

### P2  Add backpressure handling in merge.js
```javascript
inputStream.on('data', (chunk) => {
  const ok = outputStream.write(chunk);
  bytesWritten += chunk.length;
  if (onProgress) onProgress(bytesWritten, totalSize);
  if (!ok) {
    inputStream.pause();
    outputStream.once('drain', () => inputStream.resume());
  }
});
```

### P3  Ensure `postMessage` delivery before exit in chunk-worker.js
Replace `process.exit(0)` with:
```javascript
report('chunk_done', { ... });
// Allow message to flush before exiting
setTimeout(() => process.exit(0), 10);
```

---

## Architecture Strengths Observed

1. **Defense in depth**  Path validation at server layer + UUID-based temp paths + parameterized SQL
2. **Graceful degradation**  Single-stream fallback when Range not supported; resume from any crash state
3. **Resource management**  Global worker semaphore (128 cap), rate limiter with TTL eviction, WS heartbeat
4. **Data integrity**  Dual persistence (SQLite + JSON), cross-validation of 3 sources on resume
5. **Atomic writes**  Merge writes to temp file, renames on success; DB auto-save with dirty flag
6. **Input sanitization**  URL parsing via `new URL()`, settings whitelist, JSON body size limit

---

*End of audit. No critical findings. 4 actionable recommendations above.*

