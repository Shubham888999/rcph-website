'use strict';

const assert = require('node:assert/strict');
const { PDFDict, PDFDocument, PDFName, degrees } = require('pdf-lib');
const { BOUNDS, PAGE, loadLetterheadBytes, mergeResolutionPdf, sha256 } = require('../lib/resolution-pdf-merge');
const { validateExistingFinalObject } = require('../lib/resolution-upload');
const { createSourcePdf, voteRows } = require('./fixtures/resolution-pdf-fixtures');

const FROZEN_METADATA_DATE = new Date('2026-07-04T12:34:56.000Z');

async function merge(sourceBytes, rows, config = {}) {
  return mergeResolutionPdf({
    sourceBytes,
    letterheadBytes: loadLetterheadBytes(),
    details: { resolutionNumber: 'RCPH/TEST/1', title: 'PDF merge verification', resultLabel: 'PASSED', approveCount: 3, rejectCount: 1, abstainCount: 0, rows, metadataTimestamp: FROZEN_METADATA_DATE, finalizationId: 'finalization_test_1', config: { columns: { name: true, position: true, vote: true, timestamp: true, signature: false }, voterScope: 'submitted', showTitle: true, repeatHeader: true, showResultSummary: true, ...config } },
  });
}

async function assertAppendixStructure(result) {
  const parsed = await PDFDocument.load(result.bytes);
  assert.equal(parsed.getPageCount(), result.pageCount);
  for (let index = result.sourcePageCount; index < parsed.getPageCount(); index += 1) {
    const appendixPage = parsed.getPage(index);
    assert.deepEqual(appendixPage.getSize(), PAGE);
    const xObjects = appendixPage.node.Resources().lookup(PDFName.of('XObject'), PDFDict);
    assert.ok(xObjects.keys().length >= 1, `appendix page ${index + 1} must reference the letterhead image`);
  }
}

(async () => {
  assert.deepEqual(PAGE, { width: 595, height: 842 });
  assert.deepEqual(BOUNDS, { left: 54, right: 541, bottom: 260, top: 665 });

  const one = await createSourcePdf({ pages: 1 });
  const oneMerged = await merge(one, voteRows(3));
  assert.equal(oneMerged.sourcePageCount, 1);
  assert.equal(oneMerged.pageCount, 1 + oneMerged.appendixPageCount);
  assert.equal(sha256(oneMerged.bytes), oneMerged.sha256);
  assert.equal((await PDFDocument.load(oneMerged.bytes)).getPageCount(), oneMerged.pageCount);
  await assertAppendixStructure(oneMerged);
  const deterministicRetry = await merge(one, voteRows(3));
  assert.equal(Buffer.compare(oneMerged.bytes, deterministicRetry.bytes), 0, 'separate merge instances must produce byte-identical output');
  assert.equal(oneMerged.sha256, deterministicRetry.sha256);
  const metadata = await PDFDocument.load(deterministicRetry.bytes, { updateMetadata: false });
  assert.equal(metadata.getCreationDate().toISOString(), FROZEN_METADATA_DATE.toISOString());
  assert.equal(metadata.getModificationDate().toISOString(), FROZEN_METADATA_DATE.toISOString());
  assert.equal(metadata.getProducer(), 'RCPH Resolution System');
  assert.equal(metadata.getCreator(), 'RCPH Resolution System');
  assert.equal(metadata.getTitle(), 'RCPH/TEST/1 - Final');
  assert.match(metadata.getSubject(), /PDF merge verification/);

  const changedFrozenInput = await merge(one, [...voteRows(3), { name: 'Changed voter', position: 'Director', vote: 'approve', submittedAt: FROZEN_METADATA_DATE }]);
  assert.notEqual(changedFrozenInput.sha256, oneMerged.sha256);

  const existingMetadata = { generation: '42', metadata: { resolutionId: 'resolution_1', finalizationId: 'finalization_test_1', sha256: oneMerged.sha256 } };
  assert.deepEqual(validateExistingFinalObject({ bytes: oneMerged.bytes, metadata: existingMetadata, expectedSha256: oneMerged.sha256, resolutionId: 'resolution_1', finalizationId: 'finalization_test_1' }), { sha256: oneMerged.sha256, generation: '42', sizeBytes: oneMerged.bytes.length });
  assert.throws(() => validateExistingFinalObject({ bytes: changedFrozenInput.bytes, metadata: existingMetadata, expectedSha256: oneMerged.sha256, resolutionId: 'resolution_1', finalizationId: 'finalization_test_1' }), error => error.code === 'final-object-conflict');
  assert.throws(() => validateExistingFinalObject({ bytes: oneMerged.bytes, metadata: { ...existingMetadata, metadata: { ...existingMetadata.metadata, finalizationId: 'other' } }, expectedSha256: oneMerged.sha256, resolutionId: 'resolution_1', finalizationId: 'finalization_test_1' }), error => error.code === 'final-object-conflict');

  const four = await createSourcePdf({ pages: 4 });
  const fourMerged = await merge(four, voteRows(4));
  assert.equal(fourMerged.sourcePageCount, 4);
  assert.equal(fourMerged.pageCount, 4 + fourMerged.appendixPageCount);

  const mixed = await createSourcePdf({ pageSpecs: [[595, 842], [842, 595], [400, 600]], rotate: 90 });
  const mixedMerged = await merge(mixed, voteRows(8), { columns: { name: true, position: true, vote: true, timestamp: false, signature: true }, voterScope: 'all' });
  await assertAppendixStructure(mixedMerged);
  const parsed = await PDFDocument.load(mixedMerged.bytes);
  assert.deepEqual(parsed.getPage(0).getSize(), { width: 595, height: 842 });
  assert.equal(parsed.getPage(0).getRotation().angle, degrees(90).angle);
  assert.deepEqual(parsed.getPage(1).getSize(), { width: 842, height: 595 });
  assert.deepEqual(parsed.getPage(2).getSize(), { width: 400, height: 600 });

  const long = await merge(one, voteRows(80), { columns: { name: true, position: true, vote: true, timestamp: true, signature: true }, voterScope: 'all' });
  assert.ok(long.appendixPageCount > 1);
  assert.equal((await PDFDocument.load(long.bytes)).getPageCount(), long.pageCount);
  await assertAppendixStructure(long);
  console.log(`Resolution PDF merge verification passed. Deterministic SHA-256: ${oneMerged.sha256}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
