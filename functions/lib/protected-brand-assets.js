'use strict';

const fs = require('fs');
const path = require('path');
const { HttpsError } = require('firebase-functions/v2/https');

// Allow-list of brand images served only through the getProtectedBrandAsset callable.
const PROTECTED_BRAND_ASSETS = Object.freeze({
  'official-letterhead': 'RCPH_BOD_Avenue_Report_Letterhead_A4.png',
  'resolution-letterhead': 'resolution_letterhead.png',
  'report-frame': 'Report_Frame.png',
});
const DEFAULT_ASSETS_DIR = path.join(__dirname, '..', 'assets');
const MISSING_ASSET_LOG = 'protected brand asset missing from functions/assets; these files are gitignored and must exist locally at deploy time';
const UNAVAILABLE_MESSAGE = 'The letterhead is unavailable. Please contact the Website Director.';

function isProtectedBrandAssetKey(key) {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(PROTECTED_BRAND_ASSETS, key);
}

function createProtectedBrandAssetService({
  assetsDir = DEFAULT_ASSETS_DIR,
  readFileSync = fs.readFileSync,
  logger = console,
} = {}) {
  const cache = new Map();

  function getAsset(key) {
    if (!isProtectedBrandAssetKey(key)) {
      throw new HttpsError('invalid-argument', 'Unknown brand asset.');
    }
    let buffer = cache.get(key);
    if (!buffer) {
      const fileName = PROTECTED_BRAND_ASSETS[key];
      try {
        buffer = readFileSync(path.join(assetsDir, fileName));
      } catch (err) {
        logger.error(MISSING_ASSET_LOG, { asset: key, fileName, errorCode: err?.code || 'unknown' });
        throw new HttpsError('internal', UNAVAILABLE_MESSAGE);
      }
      cache.set(key, buffer);
    }
    return { asset: key, contentType: 'image/png', base64: buffer.toString('base64') };
  }

  return { getAsset };
}

const defaultService = createProtectedBrandAssetService();

module.exports = {
  PROTECTED_BRAND_ASSETS,
  MISSING_ASSET_LOG,
  UNAVAILABLE_MESSAGE,
  createProtectedBrandAssetService,
  getAsset: defaultService.getAsset,
  isProtectedBrandAssetKey,
};
