'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PDFDocument } = require('pdf-lib');
const { inspectSourcePdf, normalizeVotesTableConfig, validateSourceFileMetadata } = require('../lib/resolution-pdf-merge');
const { createSourcePdf } = require('./fixtures/resolution-pdf-fixtures');

(async () => {
  const valid = await createSourcePdf({ pages: 1 });
  assert.deepEqual(validateSourceFileMetadata({ originalFileName: 'board-resolution.pdf', mimeType: 'application/pdf', sizeBytes: valid.length }), { originalFileName: 'board-resolution.pdf', mimeType: 'application/pdf', sizeBytes: valid.length });
  assert.equal((await inspectSourcePdf(valid)).pageCount, 1);
  assert.throws(() => validateSourceFileMetadata({ originalFileName: 'fake.txt', mimeType: 'application/pdf', sizeBytes: 10 }), /PDF filename/);
  assert.throws(() => validateSourceFileMetadata({ originalFileName: 'fake.pdf', mimeType: 'text/plain', sizeBytes: 10 }), /Only PDF/);
  assert.throws(() => validateSourceFileMetadata({ originalFileName: 'large.pdf', mimeType: 'application/pdf', sizeBytes: (10 * 1024 * 1024) + 1 }), /10 MB/);
  await assert.rejects(() => inspectSourcePdf(Buffer.from('not a pdf')), error => error.code === 'invalid-pdf-signature');
  await assert.rejects(() => inspectSourcePdf(Buffer.from('%PDF-1.7\nmalformed')), error => error.code === 'malformed-pdf');
  await assert.rejects(() => inspectSourcePdf(Buffer.from('%PDF-1.7\n1 0 obj << /Encrypt 2 0 R >> endobj')), error => error.code === 'encrypted-pdf');
  const many = await createSourcePdf({ pages: 26 });
  await assert.rejects(() => inspectSourcePdf(many), error => error.code === 'too-many-pages');
  const emptyDocument = await PDFDocument.create();
  const empty = Buffer.from(await emptyDocument.save({ addDefaultPage: false, useObjectStreams: false }));
  await assert.rejects(() => inspectSourcePdf(empty), error => error.code === 'zero-page-pdf');
  const config = normalizeVotesTableConfig({ columns: { name: false, signature: true }, voterScope: 'all', showTitle: false, showResultSummary: false });
  assert.equal(config.columns.signature, true);
  assert.equal(config.voterScope, 'all');
  const uploadSource = fs.readFileSync(path.join(__dirname, '..', 'lib', 'resolution-upload.js'), 'utf8');
  const indexSource = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
  for (const marker of ['resolutionPdfUploadSessions', "status: 'pending'", "status: 'uploading'", "status: 'uploaded'", "status: 'finalized'", "status: 'expired'", "status: 'cancelled'", 'ifGenerationMatch: 0', 'proofHash', 'objectGeneration']) assert.match(uploadSource, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(uploadSource, /'failed'/);
  assert.match(uploadSource, /'conflict'/);
  assert.match(uploadSource, /resolutions\/\$\{resolutionId\}\/source\/\$\{uploadId\}\.pdf/);
  assert.match(indexSource, /uploadedSource\?\.status !== 'ready'/);
  for (const field of ['finalizedUploadedSourceSnapshot', 'finalizedVotesTableConfigSnapshot', 'finalizedVoteRowsSnapshot']) assert.match(indexSource, new RegExp(field));
  assert.doesNotMatch(uploadSource, /getSignedUrl|makePublic/);
  console.log('Resolution PDF upload verification passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
