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

test('profile removal service is exported', () => {
  assert.equal(typeof profileRemoval.createProfileRemovalService, 'function');
  assert.equal(typeof profileRemoval._private.buildProtectionReport, 'function');

  const service = profileRemoval.createProfileRemovalService({
    db: {},
    admin: {},
    HttpsError: class HttpsError extends Error {},
    assertAdminOrPresidentAuthority: async () => {},
    assertApprovedActiveCallableAccount: async () => {},
    getAuthorityContext: async () => ({}),
  });

  assert.equal(typeof service.previewRemovePersonProfile, 'function');
  assert.equal(typeof service.removePersonProfile, 'function');
});

test('preview callable is exported from index', () => {
  assert.match(indexSource, /const \{ createProfileRemovalService \} = require\('\.\/lib\/profile-removal'\);/);
  assert.match(indexSource, /const profileRemoval = createProfileRemovalService\(\{/);
  assert.match(indexSource, /exports\.previewRemovePersonProfile = onCall\(CALLABLE_OPTIONS/);
  assert.match(indexSource, /profileRemoval\.previewRemovePersonProfile/);
  assert.match(indexSource, /exports\.removePersonProfile = onCall\(CALLABLE_OPTIONS/);
  assert.match(indexSource, /profileRemoval\.removePersonProfile/);
});

function sourceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start > -1 && end > start, `Could not locate ${startMarker}.`);
  return source.slice(start, end);
}

test('profile removal mutation avoids hard deletes and disables Auth after Firestore cleanup', () => {
  // Hard deletes are allowed only in permanentlyDeleteRemovedProfile (added in e768c43), never in removePersonProfile.
  const removeBody = sourceBetween(profileRemovalSource, 'async function removePersonProfile(', 'async function permanentlyDeleteRemovedProfile(');
  const permanentDeleteBody = sourceBetween(profileRemovalSource, 'async function permanentlyDeleteRemovedProfile(', '\n  return {');
  assert.doesNotMatch(removeBody, /deleteUser\s*\(/);
  assert.doesNotMatch(removeBody, /\.delete\s*\(/);
  const sourceOutsidePermanentDelete = profileRemovalSource.replace(permanentDeleteBody, '');
  assert.doesNotMatch(sourceOutsidePermanentDelete, /deleteUser\s*\(/);
  assert.doesNotMatch(sourceOutsidePermanentDelete, /\.delete\s*\(/);

  assert.match(profileRemovalSource, /buildRemovedPayload/);
  assert.match(profileRemovalSource, /status: 'removed'/);
  assert.match(profileRemovalSource, /active: false/);
  assert.match(profileRemovalSource, /PROFILE_REMOVAL_AUDIT_ACTION/);
  assert.match(profileRemovalSource, /admin\.auth\(\)\.updateUser\(targetUid, \{ disabled: true \}\)/);

  const firestoreCommitIndex = profileRemovalSource.indexOf('await commitFirestoreOperations(db, operations);');
  const authDisableIndex = profileRemovalSource.indexOf("await admin.auth().updateUser(targetUid, { disabled: true });");

  assert.ok(firestoreCommitIndex > -1, 'Firestore cleanup commit should exist.');
  assert.ok(authDisableIndex > -1, 'Auth disable should exist.');
  assert.ok(
    firestoreCommitIndex < authDisableIndex,
    'Firestore cleanup and audit must happen before Auth disable.'
  );
});

test('permanent delete is limited to already-removed profiles and confirmed Admin/President requests', () => {
  const body = sourceBetween(profileRemovalSource, 'async function permanentlyDeleteRemovedProfile(', '\n  return {');
  const firstHardDelete = Math.min(body.indexOf('deleteUser('), body.indexOf('.delete('));
  const guards = [
    'await assertApprovedActiveCallableAccount(safeActorUid);',
    'await assertAdminOrPresidentAuthority(safeActorUid);',
    '!== PERMANENT_DELETE_CONFIRM_TEXT',
    "preview.protections?.blocked === true",
    '!records.every(summaryIsRemoved)',
    "'Only removed profiles can be permanently deleted. Remove the profile first.'",
    '(affected.activeBodAssignments || []).length',
  ];
  assert.ok(firstHardDelete > -1, 'permanent delete should hard-delete the login and documents');
  for (const guard of guards) {
    const index = body.indexOf(guard);
    assert.ok(index > -1, `missing permanent-delete guard: ${guard}`);
    assert.ok(index < firstHardDelete, `guard must run before any hard delete: ${guard}`);
  }
  assert.match(body, /action: PROFILE_PERMANENT_DELETE_AUDIT_ACTION/);
  assert.match(body, /preservedCollections: PERMANENT_DELETE_PRESERVED_COLLECTIONS\.slice\(\)/);
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

test('auth action normalization supports disable and none only', () => {
  assert.equal(profileRemoval._private.normalizeAuthAction('disable'), 'disable');
  assert.equal(profileRemoval._private.normalizeAuthAction('none'), 'none');
  assert.equal(profileRemoval._private.normalizeAuthAction('delete'), '');
});