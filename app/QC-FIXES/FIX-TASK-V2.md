# IDMM v2  REMAINING FIX TASK (QC + Audit v2)

> Generated: 2026-07-15 15:20 WIB
> Sources: QC-V2-REPORT.md + AUDIT-V2-REPORT.md
> Status: 13 previous fixes verified   these are NEW findings

## P1  SHOULD FIX

### R1: Redirect loop cap in chunk-worker.js
File: D:\IDMM\app\src\engine\chunk-worker.js
Problem: No limit on redirect chain. Infinite redirect loop possible (attacker-controlled server).
Fix: Add redirect counter, max 5 redirects, throw error if exceeded.

### R2: No backpressure in merge.js
File: D:\IDMM\app\src\engine\merge.js
Problem: WriteStream has no backpressure handling. Memory pressure on large files when reader is faster than writer.
Fix: Check write() return value, wait for 'drain' event before continuing.

### R3: mergeAndVerify temp file cleanup on verification failure
File: D:\IDMM\app\src\engine\merge.js
Problem: When merge succeeds but size/checksum verification fails, the output file is left on disk.
Fix: Delete outputPath in catch block of mergeAndVerify() on verification failure.

### R4: _probeUrl redirect drain
File: D:\IDMM\app\src\engine\downloader.js
Problem: On redirect in _probeUrl(), response body not drained. Socket could hang.
Fix: Add res.resume() before following redirect.

## P2  NICE TO HAVE

### R5: process.exit() flush in chunk-worker.js
File: D:\IDMM\app\src\engine\chunk-worker.js
Problem: process.exit() may lose final postMessage to parent.
Fix: Add small setTimeout (100ms) before process.exit to allow message flush.

### R6: ensureUniqueFilename upper bound
File: D:\IDMM\app\src\utils\filename.js
Problem: No upper bound on counter loop. Could be slow with thousands of files.
Fix: Add max 999 iterations, throw if exceeded.

## SKIP (acceptable as-is)
- W2: Redirect settled scope  theoretical, req destroyed on redirect
- W3: flushPending re-entrancy  Node.js single-threaded, no real risk
- W4: Rate limiter IP  localhost-only, no proxy scenario
- W5: Redundant _finalizing  defensive, no harm
- W6: terminate() not awaited  __terminated flag handles it
- W7: Callback overwrite  cosmetic, add comment

## Output Contract
1. Fix R1-R6
2. After fixes: cd D:\IDMM\app && node test.js  all 9 must pass
3. Report: files changed, what was fixed per item

