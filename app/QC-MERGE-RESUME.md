# QC Audit  IDMM Engine: merge.js & resume.js

**Date:** 2026-07-15 | **Auditor:** AGENT-001 (subagent) | **Scope:** Correctness, edge cases, error handling

---

## merge.js  Chunk Merger

### `mergeChunks({ chunkPaths, outputPath, totalSize, onProgress })`

| # | Check | Verdict | Detail |
|---|-------|---------|--------|
| 1 | Sequential chunk writing |  | Correct recursive `writeNextChunk` pattern; reads ordered array sequentially |
| 2 | Output dir creation |  | `mkdirSync({ recursive: true })` before write |
| 3 | Missing chunk detection |  | Rejects immediately with descriptive error if `.part` file missing |
| 4 | Progress callback |  | Fires on every `data` event with cumulative `bytesWritten / totalSize` |
| 5 | **Output stream not closed on rejection** |  | When chunk read errors or is missing, `reject()` is called but `outputStream` is never `destroy()`'d. File descriptor leaks; partial file left open. |
| 6 | **Write stream not destroyed on read error** |  | `inputStream` error handler rejects but does not `outputStream.destroy(err)`. Pending buffered writes may continue after rejection. |
| 7 | No per-chunk size validation |  | Does not compare actual bytes read per chunk against expected range. Silent data corruption possible if a `.part` file is truncated on disk. |
| 8 | No stream timeout / stall detection |  | If a chunk read stream stalls (network FS, corrupted file), the Promise hangs indefinitely. |
| 9 | `totalSize` only used for callback |  | Accepts `totalSize` but never validates final `bytesWritten === totalSize`  deferred to caller. Acceptable if caller (mergeAndVerify) does it, but risky if called standalone. |

---

### `cleanupChunks(chunkPaths, stateFilePath)`

| # | Check | Verdict | Detail |
|---|-------|---------|--------|
| 10 | Iterates and unlinks each .part |  | `existsSync` + `unlinkSync` per path |
| 11 | Best-effort error swallowing |  | Bare `catch {}`  acceptable for cleanup |
| 12 | **`stateFilePath` parameter unused** |  | Declared in signature, never referenced in body. Dead parameter. Remove or implement logic to skip deleting the state file. |

---

### `mergeAndVerify({ downloadId, chunkPaths, outputPath, totalSize, expectedChecksum, cleanupAfter, onProgress })`

| # | Check | Verdict | Detail |
|---|-------|---------|--------|
| 13 | Merge  verify size  verify checksum  cleanup sequence |  | Correct 4-step pipeline; each step gates the next |
| 14 | Post-merge size check |  | `stat.size !== totalSize` throws with clear message |
| 15 | SHA-256 verification (conditional) |  | Case-insensitive compare; throws on mismatch |
| 16 | Cleanup after verification only |  | Cleanup runs only after both checks pass (default `true`) |
| 17 | **Checksum failure leaves output + chunks on disk** |  | If checksum fails, output file and chunks are NOT cleaned up. Good for debugging, but caller must know to clean up. Not a bug  but document this behavior. |
| 18 | **Size mismatch leaves output + chunks on disk** |  | Same as above  output persists after size mismatch throw. Caller responsibility. |
| 19 | **`downloadId` param unused** |  | Accepted but never referenced. Dead parameter (possibly reserved for logging). |
| 20 | **Cleanup errors silently swallowed** |  | `cleanupChunks` errors are silent  partial cleanup won't alert caller. |

---

## resume.js  Resume Manager

### `constructor(tempDir)`

| # | Check | Verdict | Detail |
|---|-------|---------|--------|
| 21 | Stores tempDir and ensures directory |  | Assigns `this.tempDir`, calls `_ensureDir` immediately |

---

### `_ensureDir(dir)`

| # | Check | Verdict | Detail |
|---|-------|---------|--------|
| 22 | Recursive mkdir |  | `existsSync` + `mkdirSync({ recursive: true })`  standard pattern |
| 23 | **Race condition on existsSyncmkdirSync** |  | TOCTOU  another process could create the dir between check and create. Harmless in practice (`recursive: true` won't throw), but `existsSync` is unnecessary. |

---

### `getDownloadTempDir(downloadId)`

| # | Check | Verdict | Detail |
|---|-------|---------|--------|
| 24 | Pure path join |  | `path.join(this.tempDir, downloadId)`  correct |
| 25 | **No input sanitization** |  | If `downloadId` contains `../`, path traversal is possible. Caller must sanitize. |

---

### `getStateFilePath(downloadId)`

| # | Check | Verdict | Detail |
|---|-------|---------|--------|
| 26 | Returns `download.json` path |  | Clean delegation to `getDownloadTempDir` + filename |

---

### `getChunkPath(downloadId, chunkIndex)`

| # | Check | Verdict | Detail |
|---|-------|---------|--------|
| 27 | Zero-padded index |  | `padStart(5, '0')`  correct, supports up to 99999 chunks |
| 28 | **No type check on chunkIndex** |  | If `chunkIndex` is `undefined` or non-numeric, `String(undefined).padStart(5,'0')`  `"und00"`. Silent corruption. |

---

### `saveState(state)`

| # | Check | Verdict | Detail |
|---|-------|---------|--------|
| 29 | Ensures directory exists |  | Calls `_ensureDir` before write |
| 30 | Dual field normalization |  | Handles both camelCase and snake_case (e.g. `saveTo`/`save_to`, `totalSize`/`total_size`) |
| 31 | Atomic-ish write |  | Single `writeFileSync`  minimal window for partial writes |
| 32 | `updated_at` always refreshed |  | Set to `new Date().toISOString()` on every save |
| 33 | **No error handling on write** |  | `writeFileSync` can throw (disk full, permissions). Not caught  propagates to caller. Acceptable but should be documented. |
| 34 | **Field normalization is brittle** |  | Two naming conventions maintained in parallel (`camelCase`  `snake_case`). Risk of drift if new fields added without both variants. |

---

### `loadState(downloadId)`

| # | Check | Verdict | Detail |
|---|-------|---------|--------|
| 35 | Returns `null` on missing file |  | `existsSync` check before read |
| 36 | Returns `null` on corrupt JSON |  | Bare `catch {}` on `JSON.parse` failure  graceful |
| 37 | **Corrupt file silently ignored** |  | Returns `null` for corrupted JSON  caller cannot distinguish "doesn't exist" from "corrupt". Consider logging. |

---

### `validateChunks(downloadId, chunks)`

| # | Check | Verdict | Detail |
|---|-------|---------|--------|
| 38 | Missing file detection |  | `existsSync`  marks `needsResume: true`, `valid: false` |
| 39 | Size validation logic |  | `actualSize <= expectedSize`  allows partial (in-progress) chunks |
| 40 | Completed detection |  | `actualSize >= expectedSize`  `completed: true` |
| 41 | **Does not verify `downloaded` field matches actual file size** |  | State may claim `downloaded: 500` but actual file is 300 bytes. The `downloaded` field in state is trusted without reconciliation. |
| 42 | **Does not verify chunk data integrity (hash)** |  | Only checks size  no partial checksum. A corrupted partial chunk passes validation. |

---

### `cleanup(downloadId)`

| # | Check | Verdict | Detail |
|---|-------|---------|--------|
| 43 | Deletes all files then removes dir |  | `readdirSync`  `unlinkSync` per file  `rmdirSync` |
| 44 | Returns early if dir missing |  | `existsSync` guard |
| 45 | **Does not handle nested subdirectories** |  | `unlinkSync` fails on directories. If any subdir exists, cleanup fails silently. |
| 46 | **`rmdirSync` fails if files remain** |  | On Windows, open files (locked by another process) will cause `unlinkSync` to fail silently, then `rmdirSync` will throw (caught). Dir remains. |

---

### `cleanupChunks(downloadId)`

| # | Check | Verdict | Detail |
|---|-------|---------|--------|
| 47 | Filters `.part` only |  | `file.endsWith('.part')`  preserves `download.json` |
| 48 | Best-effort |  | Bare `catch {}`  acceptable for cleanup |

---

### `findAllStateFiles()`

| # | Check | Verdict | Detail |
|---|-------|---------|--------|
| 49 | Returns empty if tempDir missing |  | Guard at top |
| 50 | Filters dirs with `download.json` |  | `readdirSync({ withFileTypes })`  directory filter  `existsSync(stateFile)` |
| 51 | Error handling |  | `try/catch` returns `[]` on any failure |

---

### `updateChunkState(downloadId, chunkIndex, updates)`

| # | Check | Verdict | Detail |
|---|-------|---------|--------|
| 52 | Loads  mutates  saves |  | Correct read-modify-write cycle |
| 53 | Guard on missing state/chunk |  | Returns silently if state or chunk not found |
| 54 | **Full file rewrite per chunk update** |  | Every chunk progress update rewrites entire `download.json`. Under high concurrency (8+ threads), this creates write contention and potential stale reads. |
| 55 | **No atomicity / locking** |  | Concurrent `updateChunkState` calls (from multiple chunk workers) can race: loadloadsavesave = lost update. |

---

## Summary

| Module |  Pass |  Warning |  Fail |
|--------|---------|-----------|--------|
| **merge.js** (3 functions, 12 checks) | 6 | 4 | 2 |
| **resume.js** (12 functions, 27 checks) | 16 | 11 | 0 |
| **Total** | **22** | **15** | **2** |

### Critical Fixes ()

1. **merge.js  `mergeChunks`**: Destroy `outputStream` on rejection to prevent file descriptor leaks.
   ```js
   // In the missing-chunk and error handlers, add:
   outputStream.destroy();
   reject(new Error(...));
   ```

2. **merge.js  `mergeChunks`**: Destroy `outputStream` on read error to prevent writes-after-rejection.
   ```js
   inputStream.on('error', (err) => {
     outputStream.destroy();
     reject(new Error(`Error reading chunk ${chunkPath}: ${err.message}`));
   });
   ```

### Recommended Improvements (  Priority Order)

| # | Item | Risk |
|---|------|------|
| 1 | Add locking or debounce to `updateChunkState` for multi-thread downloads | Data loss (stale writes) |
| 2 | Reconcile `downloaded` field against actual file size in `validateChunks` | Stale state  incorrect resume |
| 3 | Validate `chunkIndex` is a non-negative integer in `getChunkPath` | Silent corrupt filenames |
| 4 | Add stream timeout/stall detection in `mergeChunks` | Hung operations |
| 5 | Sanitize `downloadId` against path traversal in `getDownloadTempDir` | Security |
| 6 | Handle subdirectories in `cleanup()` (use `fs.rmSync` with `{ recursive: true }`) | Leftover dirs |
| 7 | Remove dead params (`stateFilePath` in `cleanupChunks`, `downloadId` in `mergeAndVerify`) | Code hygiene |

