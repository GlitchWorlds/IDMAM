'use strict';

// Enable test mode BEFORE any imports to bypass SSRF blocks on localhost
process.env.IDMM_TEST = '1';
process.env.NODE_ENV = 'test';

/**
 * IDMM Integration Tests.
 *
 * Tests real imports from production code - bridges the gap between
 * isolated test scripts and the actual modules.
 *
 * Uses Node.js built-in test runner (node:test) - no extra dependencies.
 *
 * Usage: node test/integration.test.js  (from app/)
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const crypto = require('node:crypto');

// --- Production imports (the whole point of this file) ---
const DownloadManager = require('../src/engine/downloader');
const IDMMDatabase = require('../src/db/sqlite');
const IDMMServer = require('../src/server/server');

// --- Test fixtures ---
const TEST_DB_PATH = path.join(os.tmpdir(), 'idmm-integration-test-' + Date.now() + '.db');
const TEST_TEMP_DIR = path.join(os.tmpdir(), 'idmm-integration-temp-' + Date.now());
const TEST_SAVE_DIR = path.join(os.tmpdir(), 'idmm-integration-save-' + Date.now());
const TEST_SERVER_PORT = 19891;
const TEST_FILE_SIZE = 64 * 1024; // 64 KB

let db;
let downloader;
let server;
let testHttpServer;

// --- Helpers ---
function sleep(ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
}

function createTestFileServer() {
  return new Promise(function (resolve) {
    var testFile = crypto.randomBytes(TEST_FILE_SIZE);
    var srv = http.createServer(function (req, res) {
      if (req.url === '/testfile.bin') {
        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Length': testFile.length,
          'Accept-Ranges': 'bytes',
        });
        res.end(testFile);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    srv.listen(TEST_SERVER_PORT, '127.0.0.1', function () {
      resolve({ server: srv, testFile: testFile });
    });
  });
}

// ============================================================
// TEST SUITE
// ============================================================

describe('IDMM Integration Tests', function () {

  before(async function () {
    for (var dir of [TEST_TEMP_DIR, TEST_SAVE_DIR]) {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    db = await IDMMDatabase.create(TEST_DB_PATH);
    assert.ok(db.isConnected(), 'DB should be connected');

    downloader = new DownloadManager({
      db: db,
      tempDir: TEST_TEMP_DIR,
      settings: {
        default_threads: '2',
        default_thread_mode: 'manual',
        default_save_path: TEST_SAVE_DIR,
        retry_count: '1',
        timeout_ms: '5000',
        speed_limit_global: '0',
      },
    });

    testHttpServer = await createTestFileServer();
  });

  after(async function () {
    if (downloader) {
      for (var state of downloader.getActiveStates()) {
        try { downloader.cancelDownload(state.id); } catch (_) {}
      }
    }
    if (server) { try { await server.stop(); } catch (_) {} }
    if (db) { db.close(); }
    if (testHttpServer) { testHttpServer.server.close(); }
    try { fs.rmSync(TEST_DB_PATH, { force: true }); } catch (_) {}
    try { fs.rmSync(TEST_TEMP_DIR, { recursive: true, force: true }); } catch (_) {}
    try { fs.rmSync(TEST_SAVE_DIR, { recursive: true, force: true }); } catch (_) {}
  });

  // ---- Module Import Tests ----

  describe('Module imports', function () {

    it('should import DownloadManager from production code', function () {
      assert.ok(DownloadManager, 'DownloadManager should be importable');
      assert.equal(typeof DownloadManager, 'function', 'DownloadManager should be a constructor');
    });

    it('should import IDMMDatabase from production code', function () {
      assert.ok(IDMMDatabase, 'IDMMDatabase should be importable');
      assert.equal(typeof IDMMDatabase, 'function', 'IDMMDatabase should be a constructor');
    });

    it('should import IDMMServer from production code', function () {
      assert.ok(IDMMServer, 'IDMMServer should be importable');
      assert.equal(typeof IDMMServer, 'function', 'IDMMServer should be a constructor');
    });
  });

  // ---- Database Lifecycle ----

  describe('Database lifecycle', function () {

    it('DB init -> create download -> get download -> update download -> delete download', function () {
      var downloadId = 'test-' + Date.now();

      var created = db.createDownload({
        id: downloadId,
        url: 'http://example.com/file.bin',
        filename: 'file.bin',
        saveTo: TEST_SAVE_DIR,
        totalSize: 1024,
        threads: 4,
        mimeType: 'application/octet-stream',
        category: 'Others',
        status: 'pending',
      });
      assert.ok(created, 'createDownload should return a row');
      assert.equal(created.id, downloadId);

      var fetched = db.getDownload(downloadId);
      assert.ok(fetched, 'getDownload should return the record');
      assert.equal(fetched.url, 'http://example.com/file.bin');

      db.updateDownload(downloadId, { status: 'downloading', downloaded: 512 });
      var updated = db.getDownload(downloadId);
      assert.equal(updated.status, 'downloading');
      assert.equal(updated.downloaded, 512);

      db.deleteDownload(downloadId);
      var deleted = db.getDownload(downloadId);
      assert.ok(!deleted, 'getDownload should return null after delete');
    });

    it('should support createChunks -> getChunks -> updateChunk', function () {
      var downloadId = 'chunk-test-' + Date.now();

      db.createDownload({
        id: downloadId,
        url: 'http://example.com/chunked.bin',
        filename: 'chunked.bin',
        saveTo: TEST_SAVE_DIR,
        totalSize: 2048,
        threads: 2,
        status: 'pending',
      });

      db.createChunks(downloadId, [
        { index: 0, start: 0, end: 1023 },
        { index: 1, start: 1024, end: 2047 },
      ]);

      var chunks = db.getChunks(downloadId);
      assert.ok(Array.isArray(chunks), 'getChunks should return array');
      assert.equal(chunks.length, 2);

      db.updateChunk(chunks[0].id, { downloaded_bytes: 512, status: 'downloading' });
      var updatedChunks = db.getChunks(downloadId);
      assert.equal(updatedChunks[0].downloaded_bytes, 512);

      db.deleteDownload(downloadId);
    });
  });

  // ---- Server + WebSocket (single server start) ----

  describe('Server lifecycle + WebSocket', function () {

    it('Server start -> GET /api/health -> WebSocket init', async function () {
      server = new IDMMServer({ db: db, downloader: downloader });
      await server.start();
      await sleep(300);

      // --- HTTP health check ---
      var response = await new Promise(function (resolve, reject) {
        var req = http.get('http://127.0.0.1:9977/api/health', function (res) {
          var body = '';
          res.on('data', function (chunk) { body += chunk; });
          res.on('end', function () { resolve({ status: res.statusCode, body: body }); });
        });
        req.on('error', reject);
        req.setTimeout(5000, function () { req.destroy(); reject(new Error('timeout')); });
      });

      assert.equal(response.status, 200, 'Health should return 200');
      var health = JSON.parse(response.body);
      assert.equal(health.status, 'ok', 'Health status should be ok');
      assert.ok(health.version, 'Health should include version');
      assert.equal(typeof health.uptime, 'number', 'Health should include uptime');

      // --- WebSocket init message ---
      var wsMsg = await new Promise(function (resolve, reject) {
        var ws;
        try {
          var WebSocket = require('ws');
          ws = new WebSocket('ws://127.0.0.1:9977/ws');
        } catch (err) {
          return reject(err);
        }

        var timeout = setTimeout(function () { ws.close(); reject(new Error('WebSocket timeout')); }, 5000);
        ws.on('open', function () {});
        ws.on('message', function (data) {
          clearTimeout(timeout);
          try { resolve(JSON.parse(data.toString())); } catch (_) { resolve({ raw: data.toString() }); }
          ws.close();
        });
        ws.on('error', function (err) { clearTimeout(timeout); reject(err); });
      });

      assert.ok(wsMsg, 'Should receive a WebSocket message');
      assert.equal(wsMsg.type, 'init', 'First WS message should be init');
      assert.ok(Array.isArray(wsMsg.downloads), 'WS init should include downloads array');

      await server.stop();
      server = null;
    });
  });

  // ---- DownloadManager Lifecycle ----

  describe('DownloadManager lifecycle', function () {

    it('DownloadManager start -> pause -> resume -> cancel flow', async function () {
      var url = 'http://127.0.0.1:' + TEST_SERVER_PORT + '/testfile.bin';

      var result = await downloader.startDownload({
        url: url,
        threads: 1,
        threadMode: 'manual',
        saveTo: TEST_SAVE_DIR,
      });
      assert.ok(result.id, 'Should return download id');
      assert.equal(result.status, 'downloading');

      await sleep(200);

      var paused = downloader.pauseDownload(result.id);
      assert.equal(paused.status, 'paused');

      var dbAfterPause = db.getDownload(result.id);
      assert.equal(dbAfterPause.status, 'paused');

      var resumed = await downloader.resumeDownload(result.id);
      assert.equal(resumed.status, 'downloading');

      await sleep(200);

      var cancelled = downloader.cancelDownload(result.id);
      assert.equal(cancelled.status, 'cancelled');

      var dbAfterCancel = db.getDownload(result.id);
      assert.equal(dbAfterCancel.status, 'cancelled');
    });
  });
});
