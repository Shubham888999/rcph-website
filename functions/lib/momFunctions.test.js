'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const indexSource = readFileSync(path.join(__dirname, '../index.js'), 'utf8');
const functionsSource = readFileSync(path.join(__dirname, './momFunctions.js'), 'utf8');

test('production index exports MOM functions additively with CommonJS', () => {
  assert.match(indexSource, /const momFunctions = require\('\.\/lib\/momFunctions'\)/);
  assert.match(indexSource, /exports\.createMomUploadSession = momFunctions\.createMomUploadSession/);
  assert.match(indexSource, /exports\.uploadMomPdf = momFunctions\.uploadMomPdf/);
  assert.match(indexSource, /exports\.finalizeMomUpload = momFunctions\.finalizeMomUpload/);
  assert.match(indexSource, /exports\.downloadMomPdf = momFunctions\.downloadMomPdf/);
});

test('MOM backend reuses production Drive secrets and avoids deferred behavior', () => {
  assert.match(functionsSource, /VISIT_DRIVE_CLIENT_ID/);
  assert.match(functionsSource, /VISIT_DRIVE_CLIENT_SECRET/);
  assert.match(functionsSource, /VISIT_DRIVE_REFRESH_TOKEN/);
  assert.match(functionsSource, /createGoogleDriveClient/);
  assert.match(functionsSource, /@fastify\/busboy/);
  assert.doesNotMatch(functionsSource, /firebase\/storage|sendEmail|setAdminLock|lockEnabled|lockAt/);
});

test('MOM email callable audits failures and preserves Phase 3 boundaries', () => {
  assert.match(functionsSource, /requireCallableAccess\(request, 'upload'\)/);
  assert.match(functionsSource, /missing_mom_metadata/);
  assert.match(functionsSource, /drive_file_missing/);
  assert.match(functionsSource, /email_not_configured/);
  assert.match(functionsSource, /status: 'no_recipients'/);
  assert.match(functionsSource, /updateLatest: false/);
  assert.match(functionsSource, /No eligible recipients found for/);
  assert.match(functionsSource, /momEmail: latest/);
  assert.doesNotMatch(functionsSource, /remindersSent|lockAt|lockEnabled/);
});

test('MOM BOD recipient group scans active BOD position assignments', () => {
  assert.match(functionsSource, /\['all', 'bod', 'president', 'secretary', 'saa'\]\.includes\(group\)/);
  assert.match(functionsSource, /momRecipientMatchesGroups\(\{ role: 'gbm', positionKeys: \[positionKey\] \}, groups\)/);
});