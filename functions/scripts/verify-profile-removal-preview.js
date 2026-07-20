'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const profileRemoval = require('../lib/profile-removal');

const profileRemovalSource = readFileSync(
  path.join(__dirname, '..', 'lib', 'profile-removal.js'),
  'utf8'
);

const indexSource = readFileSync(
  path.join(__dirname, '..', 'index.js'),
  'utf8'
);

test('profile removal preview service is exported', () => {
  assert.equal(typeof profileRemoval.createProfileRemovalService, 'function');
  assert.equal(typeof profileRemoval._private.buildProtectionReport, 'function');
});

test('preview callable is exported from index', () => {
  assert.match(indexSource, /const \{ createProfileRemovalService \} = require\('\.\/lib\/profile-removal'\);/);
  assert.match(indexSource, /const profileRemoval = createProfileRemovalService\(\{/);
  assert.match(indexSource, /exports\.previewRemovePersonProfile = onCall\(CALLABLE_OPTIONS/);
  assert.match(indexSource, /profileRemoval\.previewRemovePersonProfile/);
});

test('preview module has no destructive Firebase writes', () => {
  assert.doesNotMatch(profileRemovalSource, /deleteUser\s*\(/);
  assert.doesNotMatch(profileRemovalSource, /updateUser\s*\(/);
  assert.doesNotMatch(profileRemovalSource, /createUser\s*\(/);
  assert.doesNotMatch(profileRemovalSource, /\.commit\s*\(/);
  assert.doesNotMatch(profileRemovalSource, /\.batch\s*\(/);
  assert.doesNotMatch(profileRemovalSource, /\.delete\s*\(/);
  assert.doesNotMatch(profileRemovalSource, /\.update\s*\(/);
  assert.doesNotMatch(profileRemovalSource, /\.set\s*\(/);
});

test('protection report blocks self, admin, president authority, CWD, and SAA', () => {
  const report = profileRemoval._private.buildProtectionReport({
    actorUid: 'actor-1',
    targetUid: 'actor-1',
    target: { role: 'admin' },
    userData: { positionKeys: ['cwd'] },
    roleData: { role: 'admin', positionKeys: ['saa'] },
    authority: {
      authority: {
        hasPresidentAuthority: true,
        hasWebsiteDirectorPosition: true,
        hasSergeantAtArmsPosition: true,
      },
      positionKeys: ['president'],
    },
    activeAssignments: [{ positionKey: 'co-cwd' }],
    ambiguous: false,
  });

  assert.equal(report.blocked, true);
  assert.ok(report.reasons.includes('self_delete_blocked'));
  assert.ok(report.reasons.includes('admin_account_protected'));
  assert.ok(report.reasons.includes('president_authority_protected'));
  assert.ok(report.reasons.includes('website_director_protected'));
  assert.ok(report.reasons.includes('sergeant_at_arms_protected'));
  assert.ok(report.reasons.includes('protected_position_president'));
  assert.ok(report.reasons.includes('protected_position_cwd'));
  assert.ok(report.reasons.includes('protected_position_saa'));
  assert.ok(report.reasons.includes('protected_position_co-cwd'));
});

test('normal GBM preview protection can be allowed', () => {
  const report = profileRemoval._private.buildProtectionReport({
    actorUid: 'admin-1',
    targetUid: 'gbm-1',
    target: { role: 'gbm' },
    userData: { positionKeys: [] },
    roleData: { role: 'gbm', positionKeys: [] },
    authority: { authority: {}, positionKeys: [] },
    activeAssignments: [],
    ambiguous: false,
  });

  assert.equal(report.blocked, false);
  assert.deepEqual(report.reasons, []);
});