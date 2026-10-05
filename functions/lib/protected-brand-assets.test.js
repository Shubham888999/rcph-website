'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const {
  MISSING_ASSET_LOG,
  PROTECTED_BRAND_ASSETS,
  UNAVAILABLE_MESSAGE,
  createProtectedBrandAssetService,
} = require('./protected-brand-assets');

function quietLogger() {
  const errors = [];
  return { errors, error: (...args) => errors.push(args) };
}

test('allow-list maps the three keys to their functions/assets file names', () => {
  assert.deepEqual(PROTECTED_BRAND_ASSETS, {
    'official-letterhead': 'RCPH_BOD_Avenue_Report_Letterhead_A4.png',
    'resolution-letterhead': 'resolution_letterhead.png',
    'report-frame': 'Report_Frame.png',
  });
});

test('valid key returns base64 PNG data and reads the file only once', () => {
  const reads = [];
  const service = createProtectedBrandAssetService({
    assetsDir: '/assets',
    readFileSync: (filePath) => {
      reads.push(filePath);
      return Buffer.from('png-bytes');
    },
    logger: quietLogger(),
  });
  const first = service.getAsset('report-frame');
  assert.deepEqual(first, { asset: 'report-frame', contentType: 'image/png', base64: Buffer.from('png-bytes').toString('base64') });
  assert.deepEqual(service.getAsset('report-frame'), first);
  assert.deepEqual(reads, [path.join('/assets', 'Report_Frame.png')]);
});

test('unknown keys are rejected as invalid-argument without touching the disk', () => {
  const service = createProtectedBrandAssetService({
    readFileSync: () => assert.fail('must not read'),
    logger: quietLogger(),
  });
  for (const key of ['logo', '', undefined, '__proto__', 'toString', '../index.js']) {
    assert.throws(() => service.getAsset(key), (err) => err.code === 'invalid-argument');
  }
});

test('missing file logs a clear error and throws internal with the user message', () => {
  const logger = quietLogger();
  const service = createProtectedBrandAssetService({
    readFileSync: () => {
      const err = new Error('ENOENT');
      err.code = 'ENOENT';
      throw err;
    },
    logger,
  });
  assert.throws(() => service.getAsset('official-letterhead'), (err) => err.code === 'internal' && err.message === UNAVAILABLE_MESSAGE);
  assert.equal(logger.errors.length, 1);
  assert.equal(logger.errors[0][0], MISSING_ASSET_LOG);
  assert.equal(logger.errors[0][1].fileName, 'RCPH_BOD_Avenue_Report_Letterhead_A4.png');
});
