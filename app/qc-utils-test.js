'use strict';
const { parseContentDisposition, filenameFromUrl, sanitizeFilename, resolveFilename, ensureUniqueFilename } = require('./src/utils/filename');
const { hashFile, verifyFile, hashString, hashBuffer, createHasher } = require('./src/utils/hash');
const { detectMime, parseContentType, getCategoryFromMime, resolveCategory } = require('./src/utils/mime');
const { isBlockedHost, validateRedirect } = require('./src/utils/ssrf');
const fs = require('fs'); const path = require('path'); const os = require('os');

(async () => {
let pass = 0, fail = 0;
function check(name, cond) { if (cond) { pass++; console.log('  ✅ ' + name); } else { fail++; console.log('  ❌ ' + name); } }

console.log('=== filename.js ===');
check('parseContentDisposition standard', parseContentDisposition('attachment; filename="test.zip"') === 'test.zip');
check('parseContentDisposition RFC5987', parseContentDisposition("attachment; filename*=UTF-8''%E4%B8%AD%E6%96%87.zip") === '中文.zip');
check('parseContentDisposition null', parseContentDisposition(null) === null);
check('filenameFromUrl', filenameFromUrl('http://example.com/path/file.zip') === 'file.zip');
check('filenameFromUrl decoded', filenameFromUrl('http://example.com/path/my%20file.zip') === 'my file.zip');
check('sanitizeFilename', sanitizeFilename('test<>:"/|?*.zip').includes('test'));
check('sanitizeFilename empty', sanitizeFilename('') === 'download');
check('resolveFilename priority', resolveFilename({ url: 'http://x.com/a.zip', filename: 'b.zip', contentDisposition: 'attachment; filename="c.zip"' }) === 'b.zip');
check('resolveFilename fallback', resolveFilename({}) === 'download');
check('ensureUnique no conflict', ensureUniqueFilename('/tmp', 'test.zip', () => false) === 'test.zip');
check('ensureUnique with conflict', ensureUniqueFilename('/tmp', 'test.zip', (p) => p.includes('test.zip')) === 'test (1).zip');

console.log('\n=== hash.js ===');
const tmpFile = path.join(os.tmpdir(), 'idmam_hash_test_' + Date.now());
fs.writeFileSync(tmpFile, 'hello world');
const h = await hashFile(tmpFile);
check('hashFile 64 chars', h.length === 64);
check('hashFile deterministic', h === (await hashFile(tmpFile)));
check('hashString', hashString('hello world').length === 64);
check('hashBuffer', hashBuffer(Buffer.from('hello world')).length === 64);
check('hashString matches file', hashString('hello world') === h);
const hasher = createHasher();
hasher.update('hello ');
hasher.update('world');
check('createHasher', hasher.digest() === h);
const v = await verifyFile(tmpFile, h);
check('verifyFile correct hash', v === true);
const v2 = await verifyFile(tmpFile, 'wrong');
check('verifyFile wrong hash', v2 === false);
const v3 = await verifyFile(tmpFile, null);
check('verifyFile null hash', v3 === false);
fs.unlinkSync(tmpFile);

console.log('\n=== mime.js ===');
check('detectMime mp4', detectMime('video.mp4') === 'video/mp4');
check('detectMime zip', detectMime('file.zip') === 'application/zip');
check('detectMime unknown', detectMime('file.xyz123') === 'application/octet-stream');
check('parseContentType', parseContentType('video/mp4; charset=utf-8') === 'video/mp4');
check('parseContentType null', parseContentType(null) === null);
check('getCategoryFromMime video', getCategoryFromMime('video/mp4') === 'Videos');
check('getCategoryFromMime audio', getCategoryFromMime('audio/mpeg') === 'Music');
check('getCategoryFromMime image', getCategoryFromMime('image/png') === 'Images');
check('getCategoryFromMime text', getCategoryFromMime('text/plain') === 'Documents');
check('getCategoryFromMime unknown', getCategoryFromMime('application/x-unknown') === 'Others');
check('resolveCategory', resolveCategory('test.mp4', 'video/mp4') === 'Videos');

console.log('\n=== ssrf.js ===');
check('isBlockedHost localhost', isBlockedHost('localhost') === true);
check('isBlockedHost 127.0.0.1', isBlockedHost('127.0.0.1') === true);
check('isBlockedHost 0.0.0.0', isBlockedHost('0.0.0.0') === true);
check('isBlockedHost 10.x', isBlockedHost('10.0.0.1') === true);
check('isBlockedHost 192.168.x', isBlockedHost('192.168.1.1') === true);
check('isBlockedHost 172.16.x', isBlockedHost('172.16.0.1') === true);
check('isBlockedHost 169.254.x', isBlockedHost('169.254.1.1') === true);
check('isBlockedHost ::1', isBlockedHost('::1') === true);
check('isBlockedHost fe80', isBlockedHost('fe80::1') === true);
check('isBlockedHost safe domain', isBlockedHost('example.com') === false);
check('isBlockedHost safe IP', isBlockedHost('8.8.8.8') === false);
let threw = false; try { validateRedirect('http://example.com/new', 'http://example.com/old'); } catch { threw = true; } check('validateRedirect safe (no throw)', threw === false);
threw = false; try { validateRedirect('http://127.0.0.1/', 'http://example.com/'); } catch { threw = true; } check('validateRedirect blocked (throws)', threw === true);
threw = false; try { validateRedirect('http://10.0.0.1/', 'http://example.com/'); } catch { threw = true; } check('validateRedirect private (throws)', threw === true);

console.log('\n=== TOTAL: ' + pass + ' PASS, ' + fail + ' FAIL ===');
})();
