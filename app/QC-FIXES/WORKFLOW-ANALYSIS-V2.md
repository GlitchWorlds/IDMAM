# IDMM  Workflow Analysis v2 (Post-Fix)

> **Date:** 2026-07-15 15:15 WIB | **Analyst:** MANAGER-001
> **Status:** Updated after 13 QC/Audit fixes (commit f8ec27c)

---

## Source Code Stats

| File | Lines | Role |
|------|-------|------|
| downloader.js | 1263 | Core download engine |
| server.js | 566 | Express API + WebSocket |
| sqlite.js | 400 | SQLite WASM database |
| resume.js | 301 | Resume state management |
| chunk-worker.js | 275 | Worker thread per chunk |
| mime.js | 224 | MIME detection + categorization |
| merge.js | 178 | Chunk merger (atomic write) |
| filename.js | 162 | Filename resolution + sanitize |
| hash.js | 77 | SHA-256 verification |
| **TOTAL** | **3446** | 9 modules |

---

## End-to-End Download Flow (Updated v2)

```

                    CHROME EXTENSION                           
  background.js intercepts download                           
   Cancel browser download                                   
   POST http://localhost:9977/api/download                   
    {url, filename, filesize, cookies, referrer, mime}        

                            
                            

                    EXPRESS API SERVER (:9977)                  
                                                               
  1. CORS check (localhost/chrome-extension only)              
  2. Rate limiter (100 req/min, TTL eviction every 5min)       
  3. URL validation (new URL())                                
  4. Path traversal check (save_to under allowed root)         
  5. Duplicate URL check (activeUrls Set  409 if exists)      
  6. Concurrent limit check (max_concurrent_downloads)         
  7. Resolve filename + detect MIME + categorize               
  8. Create DB record + start download engine                  
  9. Return 201 {id, status, filename, threads}                
                                                               
  WebSocket: /ws                                               
  - Origin validation on connect                               
  - maxPayload: 64KB                                           
  - Heartbeat: ping/pong every 30s                             
  - Broadcast progress every 500ms                             
  - Events: init, progress, completed, error, paused           

                            
                            

                    DOWNLOAD MANAGER                            
                                                               
  active Map<id, State>                                        
  State = { id, url, filename, status, totalSize, downloaded,  
            speed, eta, chunks[], workers[], requestHeaders,   
            chunkDbIds (cached), _lastDbWrite, _finalizing }   
                                                               
  Guard: active.has(id)  block duplicate resume               
  Guard: DB status check  "already paused" vs "not active"    
  Guard: settled flag  prevent double resolve/reject          

                            
              
                                        
  
  PROBE (HEAD)       CHUNKED        SINGLE      
  Content-Length?     MODE           STREAM      
  Accept-Ranges?     8 workers      1 stream    
   decide mode      Range hdr      (no Range)  
   flags:'a'      settled     
                       append mode    guard       
                      
                                            
                                            
                  
                 WORKER THREADS            
                 (chunk-worker.js)         
                                           
                HTTP GET Range: start-end    
                Write to chunk_NNN.part     
                Retry 3x, exp backoff       
                Progress via parentPort     
                fileStream.on('error')    
                  
                                            
                                            
              
                      MERGE + VERIFY            
                1. Atomic write: .part.tmp       
                2. fs.renameSync  final file    
                3. Verify size == totalSize      
                4. SHA-256 verify (if provided)  
                5. Cleanup temp/                 
              
                          
                          
              
                      SQLite (sql.js WASM)       
                Tables: downloads, chunks,       
                        settings                  
                Auto-save every 5 seconds        
                Chunk IDs cached at start      
              
```

## Pause/Resume Flow (Updated v2)

```
PAUSE:
  1. Check: if not active  "Download not active"
  2. Check: DB status = 'paused'  "Download already paused"  NEW
  3. _flushChunkState(): read actual .part sizes from disk
  4. flushPending(): drain debounced resume state  NEW
  5. Save to DB: each chunk.downloaded = actual file size
  6. Save to resume file: download.json
  7. Terminate workers (worker.__terminated = true BEFORE terminate)
  8. Update DB: status = "paused"
  9. Remove from active Map

RESUME:
  1. Check: if active.has(id)  "Download already active"  NEW
  2. Load from DB + resume file + disk (.part sizes)
  3. Cross-validate: take highest downloaded value
  4. Cache chunkDbIds in state object  NEW
  5. Reset corrupted chunks
  6. Spawn workers for remaining chunks
```

## Security Hardening (v2)

| # | Feature | Status |
|---|---------|--------|
| 1 | Path traversal: save_to validated under allowed root |  |
| 2 | Unhandled rejection: settled flag on resolve/reject |  |
| 3 | Resume guard: block if already active |  |
| 4 | Pause message: distinguish "already paused" vs "not active" |  |
| 5 | Extension CSP: declared in manifest |  |
| 6 | WS maxPayload: 64KB limit |  |
| 7 | WS heartbeat: ping/pong 30s |  |
| 8 | Chunk DB IDs cached: no table scan per progress |  |
| 9 | Rate limiter: TTL eviction every 5min |  |
| 10 | Duplicate URL: activeUrls Set, 409 conflict |  |
| 11 | Resume debouncing: 500ms interval |  |
| 12 | Atomic merge: write .part.tmp + rename |  |

---

**END WORKFLOW ANALYSIS v2**

