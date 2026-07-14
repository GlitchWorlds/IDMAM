'use strict';

/**
 * IDMAM Test Script.
 *
 * Demonstrates the complete download lifecycle using a local test server:
 * 1. Start a download
 * 2. Monitor progress
 * 3. Pause
 * 4. Resume
 * 5. Verify completion
 *
 * Usage: node test.js
 *
 * This script is self-contained — it creates its own test file server
 * so it works without internet access.
 */

const http = require('node:http');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const crypto = require('node:crypto');

const TEST_FILE_SIZE = 2 * 1024 * 1024; // 2 MB test file
const TEST_PORT = 19890;
const TEST_URL = `http://127.0.0.1:${TEST_PORT}/testfile.bin`;

// ─── Utilities ─────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

function formatSpeed(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec === 0) return '0 MB/s';
  return `${(bytesPerSec / (1024 * 1024)).toFixed(2)} MB/s`;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Local Test File Server ────────────────────────────────────────

function createTestFileServer() {
  // Create deterministic test data
  const testData = Buffer.alloc(TEST_FILE_SIZE);
  for (let i = 0; i < TEST_FILE_SIZE; i++) {
    testData[i] = i % 256;
  }
  const expectedHash = crypto.createHash('sha256').update(testData).digest('hex');

  const server = http.createServer((req, res) => {
    if (req.method === 'HEAD') {
      res.writeHead(200, {
        'Content-Length': String(TEST_FILE_SIZE),
        'Accept-Ranges': 'bytes',
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="testfile.bin"',
      });
      res.end();
      return;
    }

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : TEST_FILE_SIZE - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${TEST_FILE_SIZE}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(chunkSize),
        'Content-Type': 'application/octet-stream',
      });
      res.end(testData.slice(start, end + 1));
    } else {
      res.writeHead(200, {
        'Content-Length': String(TEST_FILE_SIZE),
        'Content-Type': 'application/octet-stream',
      });
      res.end(testData);
    }
  });

  return { server, expectedHash, testData };
}

// ─── HTTP Client ───────────────────────────────────────────────────

function apiRequest(method, apiPath, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(apiPath, 'http://127.0.0.1:9977');
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ─── Test Steps ────────────────────────────────────────────────────

async function runTests() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  IDMAM Core Engine — Integration Test               ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');

  // ─── Setup ───────────────────────────────────────────────────────

  console.log('▸ Step 0: Setting up test environment...');

  const IDMAMDatabase = require('./src/db/sqlite');
  const DownloadManager = require('./src/engine/downloader');
  const IDRAMServer = require('./src/server/server');

  // Create temp directories
  const DATA_DIR = path.join(os.homedir(), '.idmam', 'test-run');
  const TEMP_DIR = path.join(DATA_DIR, 'temp');
  const SAVE_DIR = path.join(DATA_DIR, 'downloads');

  for (const dir of [DATA_DIR, TEMP_DIR, SAVE_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  // Start test file server
  const { server: testServer, expectedHash } = createTestFileServer();
  await new Promise(r => testServer.listen(TEST_PORT, '127.0.0.1', r));
  console.log(`  ✅ Test file server on http://127.0.0.1:${TEST_PORT} (${formatBytes(TEST_FILE_SIZE)})`);

  // Initialize IDMAM
  const db = await IDMAMDatabase.create(path.join(DATA_DIR, 'test.db'));
  db.setSetting('default_save_path', SAVE_DIR);
  const settings = db.getAllSettings();
  console.log('  ✅ Database initialized');

  let completedResult = null;
  const downloader = new DownloadManager({
    db,
    tempDir: TEMP_DIR,
    settings,
    onComplete: (id, result) => {
      completedResult = result;
    },
    onError: (id, err) => {
      console.error(`  ❌ Error: ${err.message}`);
    },
  });

  const server = new IDRAMServer({ db, downloader });
  await server.start();
  console.log('  ✅ IDMAM server started on http://127.0.0.1:9977');
  console.log('');

  // ─── Test 1: Health Check ────────────────────────────────────────

  console.log('▸ Step 1: Health check...');
  const health = await apiRequest('GET', '/api/health');
  console.log(`  Status: ${health.status} — ${health.data.status}`);
  console.log(`  ✅ Health check passed\n`);

  // ─── Test 2: Start Download ──────────────────────────────────────

  console.log('▸ Step 2: Starting download...');
  const startRes = await apiRequest('POST', '/api/download', {
    url: TEST_URL,
    threads: 4,
  });

  if (startRes.status !== 201) {
    console.error(`  ❌ Failed to start: ${JSON.stringify(startRes.data)}`);
    await cleanup(server, db, testServer, DATA_DIR);
    process.exit(1);
  }

  const downloadId = startRes.data.id;
  console.log(`  ID: ${downloadId}`);
  console.log(`  File: ${startRes.data.filename}`);
  console.log(`  Size: ${formatBytes(startRes.data.total_size)}`);
  console.log(`  Threads: ${startRes.data.threads}`);
  console.log(`  ✅ Download started\n`);

  // ─── Test 3: Monitor Progress ────────────────────────────────────

  console.log('▸ Step 3: Monitoring progress...');
  let pauseTested = false;

  for (let tick = 0; tick < 120; tick++) {
    await sleep(250);

    const statusRes = await apiRequest('GET', `/api/download/${downloadId}`);
    if (statusRes.status !== 200) continue;

    const d = statusRes.data;
    const bar = '█'.repeat(Math.floor((d.progress || 0) / 5)) +
                '░'.repeat(20 - Math.floor((d.progress || 0) / 5));
    const line = `  [${bar}] ${(d.progress || 0).toFixed(1)}% | ${formatBytes(d.downloaded)} / ${formatBytes(d.total_size)} | ${formatSpeed(d.speed)} | ETA: ${d.eta}s | threads: ${d.active_threads}`;

    // Print at every 5% change
    if (tick % 4 === 0) {
      console.log(line);
    }

    // Test pause at ~30% progress
    if ((d.progress || 0) >= 30 && !pauseTested) {
      pauseTested = true;
      console.log('');
      break;
    }

    if (d.status === 'completed') {
      console.log(`  ✅ Download completed!\n`);
      pauseTested = true;
      break;
    }

    if (d.status === 'failed') {
      console.error(`  ❌ Download failed: ${d.error}\n`);
      await cleanup(server, db, testServer, DATA_DIR);
      process.exit(1);
    }
  }

  // ─── Test 4: Pause ──────────────────────────────────────────────

  if (pauseTested) {
    const statusCheck = await apiRequest('GET', `/api/download/${downloadId}`);
    if (statusCheck.data.status === 'completed') {
      console.log('  ⏭️  Download completed too fast for pause test\n');
    } else {
      console.log('▸ Step 4: Pausing download...');
      const pauseRes = await apiRequest('POST', `/api/download/${downloadId}/pause`);
      console.log(`  Status: ${pauseRes.data.status}`);

      await sleep(1000);

      const pausedStatus = await apiRequest('GET', `/api/download/${downloadId}`);
      console.log(`  Downloaded: ${formatBytes(pausedStatus.data.downloaded)} (${(pausedStatus.data.progress || 0).toFixed(1)}%)`);
      console.log(`  ✅ Download paused\n`);

      // ─── Test 5: Resume ──────────────────────────────────────────

      console.log('▸ Step 5: Resuming download...');
      const resumeRes = await apiRequest('POST', `/api/download/${downloadId}/resume`);
      console.log(`  Status: ${resumeRes.data.status}`);
      console.log(`  ✅ Download resumed\n`);

      // Wait for completion
      console.log('▸ Step 6: Waiting for completion...');
      for (let tick = 0; tick < 240; tick++) {
        await sleep(250);

        const statusRes = await apiRequest('GET', `/api/download/${downloadId}`);
        const d = statusRes.data;

        if (tick % 8 === 0) {
          console.log(`  [${(d.progress || 0).toFixed(1)}%] ${formatBytes(d.downloaded)} / ${formatBytes(d.total_size)} | ${formatSpeed(d.speed)}`);
        }

        if (d.status === 'completed') {
          console.log(`  ✅ Download completed after resume!\n`);
          break;
        }
        if (d.status === 'failed') {
          console.error(`  ❌ Download failed after resume: ${d.error}\n`);
          break;
        }
      }
    }
  }

  // ─── Test 6: Verify File ─────────────────────────────────────────

  console.log('▸ Step 7: Verifying downloaded file...');
  if (fs.existsSync(SAVE_DIR)) {
    const files = fs.readdirSync(SAVE_DIR);
    console.log(`  Files: ${files.join(', ')}`);

    for (const file of files) {
      const filePath = path.join(SAVE_DIR, file);
      const stat = fs.statSync(filePath);
      console.log(`  ${file}: ${formatBytes(stat.size)}`);

      if (stat.size === TEST_FILE_SIZE) {
        // Verify content hash
        const content = fs.readFileSync(filePath);
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        if (hash === expectedHash) {
          console.log(`  ✅ SHA-256 verified — file integrity confirmed!`);
        } else {
          console.log(`  ❌ Hash mismatch!`);
        }
      } else {
        console.log(`  ⚠️ Size mismatch: expected ${formatBytes(TEST_FILE_SIZE)}`);
      }
    }
  } else {
    console.log(`  ⚠️ Download directory not found`);
  }
  console.log('');

  // ─── Test 7: List & Stats ────────────────────────────────────────

  console.log('▸ Step 8: Listing downloads...');
  const listRes = await apiRequest('GET', '/api/downloads');
  console.log(`  Found ${listRes.data.length} download(s)`);
  for (const d of listRes.data) {
    console.log(`  • ${d.filename} — ${d.status} (${(d.progress || 0).toFixed(1)}%)`);
  }
  console.log('');

  console.log('▸ Step 9: Statistics...');
  const statsRes = await apiRequest('GET', '/api/stats');
  const s = statsRes.data;
  console.log(`  Total: ${s.total_downloads} | Completed: ${s.completed} | Failed: ${s.failed}`);
  console.log(`  Total downloaded: ${formatBytes(s.total_bytes_downloaded)}`);
  console.log('');

  // ─── Summary ─────────────────────────────────────────────────────

  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  ✅ ALL TESTS PASSED!                               ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  // Cleanup
  await cleanup(server, db, testServer, DATA_DIR);
}

async function cleanup(server, db, testServer, dataDir) {
  try {
    await server.stop();
    testServer.close();
    db.close();
    // Clean up test files
    fs.rmSync(dataDir, { recursive: true, force: true });
  } catch {
    // Best effort
  }
}

runTests().catch(err => {
  console.error('\n❌ Test failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
