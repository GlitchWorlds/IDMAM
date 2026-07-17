Rename IDMM to IDMM across the entire codebase. "Internet Download Manager Max" becomes "Internet Download Manager Max". Branding change only - no logic changes.

Files to update:
- app/main.js (banner, comments, env vars IDMM_TEST/IDMM_DEBUG, data dir .IDMM->.idmm, db name IDMM.db->idmm.db, save path IDMM->IDMM)
- app/package.json (name, description, author)
- app/src/server/server.js (comments, env vars, header X-IDMM-Token->X-IDMM-Token)
- app/src/engine/downloader.js (comments, User-Agent IDMM/1.0->IDMM/1.0, log messages)
- app/src/engine/chunk-worker.js (log messages)
- app/src/db/sqlite.js (class name IDMMDatabase->IDMMDatabase, comments)
- app/src/engine/resume.js (comments)
- electron/main.js (title, comments, data dir, class name)
- electron/package.json (name IDMM-desktop->idmm-desktop, description, author, appId com.IDMM->com.idmm, productName IDMM->IDMM)
- electron/ui/src/components/*.jsx (any IDMM references)
- extension/manifest.json (name, short_name, description)
- extension/background.js (comments, log [IDMM]->[IDMM], function sendToIDMM->sendToIDMM, IDMM_API->IDMM_API, storage key idmm_settings->idmm_settings)
- extension/popup.js, options.js, api-client.js if they exist
- DESIGN.md (all references)
- RELEASE-NOTES-v1.1.0.md, README.md if exists
- FUNCTION-MAP.md

Also update banner in main.js: "Internet Download Manager Max v1.0.0" -> "Internet Download Manager Max v1.0.0" and ASCII art header.

Keep data migration note: if .IDMM folder exists, use it (backward compat) OR rename to .idmm. Prefer renaming .IDMM->.idmm with fs.renameSync if .idmm doesn't exist yet.

Commit message: "refactor: rename IDMM to IDMM (Internet Download Manager Max)"
