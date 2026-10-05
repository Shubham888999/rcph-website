'use strict';

// Confirms the gitignored brand assets exist before a functions deploy.
const fs = require('fs');
const path = require('path');
const { PROTECTED_BRAND_ASSETS } = require('../lib/protected-brand-assets');

const assetsDir = path.join(__dirname, '..', 'assets');
const missing = Object.values(PROTECTED_BRAND_ASSETS)
  .filter(fileName => !fs.existsSync(path.join(assetsDir, fileName)));

if (missing.length) {
  console.error('Missing private brand assets in functions/assets:');
  missing.forEach(fileName => console.error(`  - ${fileName}`));
  console.error('These files are gitignored. Copy them from C:\\Personal\\Z folder\\RCPH_private_assets\\ before deploying functions.');
  process.exit(1);
}

console.log(`All ${Object.keys(PROTECTED_BRAND_ASSETS).length} private brand assets are present in functions/assets.`);
