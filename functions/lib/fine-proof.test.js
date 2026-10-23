'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { FINE_PROOF_FIELDS, buildFineProofUpdate, normalizeFineProof } = require('./fine-proof');

class FakeError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
const makeError = (code, message) => new FakeError(code, message);

const upload = {
  billUrl: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMn/view?usp=drivesdk',
  billDriveFileId: '1AbCdEfGhIjKlMn',
  billFileName: 'upi-payment.png',
  billMimeType: 'image/png',
  billSizeBytes: 245000,
  billFolderId: 'folder_1234567890',
  billFolderUrl: 'https://drive.google.com/drive/folders/folder_1234567890',
  billFolderName: 'September 2026',
};

test('a Treasury upload result becomes the stored proof fields', () => {
  assert.deepEqual(normalizeFineProof(upload, makeError), upload);
  const fromUrlOnly = normalizeFineProof({ ...upload, billDriveFileId: '', billFileName: '' }, makeError);
  assert.equal(fromUrlOnly.billDriveFileId, '1AbCdEfGhIjKlMn', 'the file ID can come from the link');
  assert.equal(fromUrlOnly.billFileName, 'Payment proof');
});

test('proof must be a Drive file of an allowed type and size', () => {
  const rejects = (changes, pattern) => assert.throws(
    () => normalizeFineProof({ ...upload, ...changes }, makeError),
    (error) => error.code === 'invalid-argument' && pattern.test(error.message),
  );
  rejects({ billUrl: 'https://example.com/file.png' }, /Google Drive file link/);
  rejects({ billUrl: 'http://drive.google.com/file/d/1AbCdEfGhIjKlMn/view' }, /Google Drive file link/);
  rejects({ billUrl: '' }, /Google Drive file link/);
  rejects({ billDriveFileId: 'bad id!' }, /Drive file/);
  rejects({ billMimeType: 'image/gif' }, /PDF, JPG, PNG or WebP/);
  rejects({ billSizeBytes: 11 * 1024 * 1024 }, /10 MB/);
  rejects({ billSizeBytes: 0 }, /10 MB/);
  rejects({ billFolderUrl: 'https://evil.example/folder' }, /folder must be a Google Drive link/);
  assert.throws(() => normalizeFineProof(null, makeError), /Google Drive file link/);
});

test('the update records who attached the proof, and removing clears every field', () => {
  const proof = normalizeFineProof(upload, makeError);
  const set = buildFineProofUpdate({ proof, actorUid: 'uid-1', actorName: 'Rtr. SAA', now: 'NOW', deleteField: 'DELETE' });
  assert.equal(set.billUploadedAt, 'NOW');
  assert.equal(set.billUploadedByUid, 'uid-1');
  assert.equal(set.billUrl, upload.billUrl);

  const removed = buildFineProofUpdate({ proof: null, actorUid: 'uid-1', actorName: '', now: 'NOW', deleteField: 'DELETE' });
  assert.deepEqual(Object.keys(removed).sort(), [...FINE_PROOF_FIELDS].sort());
  assert.ok(Object.values(removed).every((value) => value === 'DELETE'));
});

test('setFineProof checks access and locks, and writes the Fine and Treasury entry together', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
  const start = source.indexOf('exports.setFineProof = onCall(');
  assert.ok(start > 0, 'callable is exported');
  const body = source.slice(start, source.indexOf('exports.updateClubRanking', start));
  assert.match(body, /assertAdminOrPresidentAuthority\(actorUid\)/);
  assert.match(body, /assertApprovedActiveCallableAccount\(actorUid\)/);
  assert.match(body, /assertPanelUnlockedForRole\('fines'/);
  assert.match(body, /assertPanelUnlockedForRole\('treasury'/);
  assert.match(body, /validateFineDocumentId\(data\.fineId\)/);
  assert.match(body, /db\.runTransaction/);
  assert.match(body, /treasuryData\.source !== 'fine' \|\| treasuryData\.fineId !== fineId/);
  assert.match(body, /tx\.update\(fineRef/);
  assert.match(body, /tx\.update\(treasuryRef/);
  assert.match(body, /action: remove \? 'fine_proof_removed' : 'fine_proof_set'/);
});
