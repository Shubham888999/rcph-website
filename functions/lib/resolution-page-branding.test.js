'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { PDFDocument, PDFRawStream, decodePDFRawStream } = require('pdf-lib');
const { buildBrandedResolutionDownload, sha256 } = require('./resolution-pdf-merge');
const { resolutionPageBranding } = require('./resolution-page-branding');
const { createResolutionUploadService } = require('./resolution-upload');
const { createSourcePdf, voteRows } = require('../scripts/fixtures/resolution-pdf-fixtures');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64');
const details = () => ({ title: 'Bank usage', resolution: { title: 'Bank usage', meetingDate: '2026-10-25' }, majority: { status: 'passed', approveCount: 12, votesReceivedCount: 12 }, resolutionPageConfig: { enabled: true, details: { boardMembersPresent: 16 } }, metadataTimestamp: new Date('2026-10-25T18:00:00Z'), rows: voteRows(35) });
function pageText(page) {
  const streams = page.node.Contents();
  const operators = Array.from({ length: streams.size() }, (_, i) => Buffer.from(decodePDFRawStream(streams.lookup(i, PDFRawStream)).decode()).toString()).join('\n');
  return operators.replace(/<([0-9A-Fa-f]+)>/g, (_, hex) => Buffer.from(hex, 'hex').toString('latin1'));
}

test('closed rendition seals every page, certifies all continuations and preserves source bytes', async () => {
  const source = await createSourcePdf({ pages: 2, rotate: 90 });
  const before = sha256(source);
  const input = details();
  assert.equal(resolutionPageBranding(input).percent, '75%');
  const result = await buildBrandedResolutionDownload({ sourceBytes: source, letterheadBytes: PNG, sealBytes: PNG, details: input });
  const output = await PDFDocument.load(result.bytes);
  assert.equal(result.resolutionPageCount, 1);
  assert.ok(output.getPageCount() >= 5);
  assert.equal(sha256(source), before);
  output.getPages().forEach((page, index) => {
    const text = pageText(page);
    assert.match(text, /1 0 0 1 312 40 cm/);
    assert.match(text, new RegExp(`Page ${index + 1} of ${output.getPageCount()}`));
    if (index > 0) {
      assert.match(text, /Resolution: Bank usage/);
      assert.match(text, /majority of 75%/);
    } else assert.doesNotMatch(text, /hereby confirm/);
  });
});

function downloadFixture({ corruptSource = false, allowed = true } = {}) {
  const archive = Buffer.from('archived immutable PDF');
  const original = Buffer.from('frozen uploaded source');
  const resolution = {
    documentSourceMode: 'uploadedPdf', status: 'passed', title: 'Closed bank resolution',
    merge: { status: 'ready', finalizationId: 'f1', createdAt: new Date('2026-10-25T18:00:00Z') },
    finalizedMergedPdf: { driveFileId: 'final-file', sha256: sha256(archive), finalizationId: 'f1' },
    finalizedUploadedSourceSnapshot: { driveFileId: 'source-file', uploadId: 'u1', sha256: sha256(original) },
    finalizedResolutionPageConfigSnapshot: { enabled: true, details: { boardMembersPresent: 16 } },
    finalizedVoteRowsSnapshot: [{ name: 'Frozen voter', vote: 'approve' }], approveCount: 12, votesReceivedCount: 12,
  };
  const calls = [];
  const service = createResolutionUploadService({
    db: { collection: () => ({ doc: () => ({ get: async () => ({ exists: true, data: () => resolution }) }) }) },
    admin: { auth: () => ({ verifyIdToken: async () => ({ uid: 'manager' }) }) },
    getManagerContext: async () => { if (!allowed) throw new Error('Access denied'); },
    drive: { downloadFinalFile: async () => ({ bytes: archive }), downloadSourceFile: async () => ({ bytes: corruptSource ? Buffer.from('corrupted') : original }) },
    loadSeal: () => PNG, loadLetterhead: () => PNG,
    renderFinalPdf: async args => { calls.push(args); return { bytes: Buffer.from('sealed rendition') }; },
  });
  const res = { headers: {}, status(n) { this.code = n; return this; }, set(k, v) { Object.assign(this.headers, typeof k === 'string' ? { [k]: v } : k); return this; }, send(body) { this.body = body; return this; }, json(body) { this.body = body; return this; } };
  const req = { method: 'GET', query: { resolutionId: 'r1' }, get: name => name === 'authorization' ? 'Bearer token' : '' };
  return { service, req, res, calls, resolution };
}

test('closed PDF download returns a fresh rendition from frozen records without writes', async () => {
  const f = downloadFixture();
  const before = structuredClone(f.resolution);
  await f.service.streamFinalPdf(f.req, f.res);
  assert.equal(f.res.code, 200);
  assert.equal(f.res.headers['X-RCPH-Pdf-Format'], 'sealed-v1');
  assert.equal(f.res.body.toString(), 'sealed rendition');
  assert.deepEqual(f.calls[0].details.rows, f.resolution.finalizedVoteRowsSnapshot);
  assert.equal(resolutionPageBranding(f.calls[0].details).percent, '75%');
  assert.deepEqual(f.resolution, before);
});

test('download rejects corrupted frozen sources and unauthorized access before rendering', async () => {
  for (const options of [{ corruptSource: true }, { allowed: false }]) {
    const f = downloadFixture(options);
    await f.service.streamFinalPdf(f.req, f.res);
    assert.ok(f.res.code >= 400);
    assert.equal(f.calls.length, 0);
    assert.equal(f.res.headers['Content-Disposition'], undefined);
  }
});
