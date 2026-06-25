#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  loadPreviewDirectory,
  buildManifest,
  validateNoSecretFields,
  KNOWN_SECOND_SHUBHAM_UID,
  CONFIRMED_PRESERVED_UID,
} = require('../lib/riy-clean-slate-manifest');

const fixturePath = path.resolve(__dirname, 'fixtures', 'riy-clean-slate-manifest-sample.json');
const previewDir = path.resolve(__dirname, 'fixtures', 'riy-clean-slate-preview-sample');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function previewWithUid(uid) {
  return JSON.parse(JSON.stringify(samplePreview()).replace(/fixture-president/g, uid));
}

function samplePreview() {
  const preview = loadPreviewDirectory(previewDir);
  assert.strictEqual(preview.ok, true, 'fixture preview loads');
  return preview;
}

function sampleBundle(overrides = {}) {
  return buildManifest(overrides.preview || samplePreview(), {
    projectId: overrides.projectId || 'rcph-admin',
    preservedUid: overrides.preservedUid || 'fixture-president',
    expectedPreservedUid: overrides.expectedPreservedUid || 'fixture-president',
    sourcePreviewDirectory: previewDir,
    backupEvidence: Object.prototype.hasOwnProperty.call(overrides, 'backupEvidence')
      ? overrides.backupEvidence
      : fixture.backupEvidence,
  });
}

function copyPreviewWithout(fileName) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'riy-manifest-preview-'));
  for (const name of fs.readdirSync(previewDir)) {
    if (name === fileName) continue;
    fs.copyFileSync(path.join(previewDir, name), path.join(tempRoot, name));
  }
  return tempRoot;
}

function testValidPreviewLoads() {
  const preview = samplePreview();
  assert.strictEqual(preview.summary.projectId, 'rcph-admin');
}

function testMissingPreviewFileBlocks() {
  const tempDir = copyPreviewWithout('summary.json');
  const preview = loadPreviewDirectory(tempDir);
  assert.strictEqual(preview.ok, false);
  assert(preview.errors.some((item) => item.includes('summary.json')));
}

function testWrongProjectBlocks() {
  const bundle = sampleBundle({ projectId: 'wrong-project' });
  assert(bundle.sourceValidationBlockers.some((item) => item.includes('project ID')));
}

function testWrongPreservedUidBlocks() {
  const bundle = sampleBundle({ preservedUid: 'not-fixture-president', expectedPreservedUid: 'not-fixture-president' });
  assert(bundle.sourceValidationBlockers.some((item) => item.includes('preserved UID')));
}

function testPreservedAuthDeleteBlocks() {
  const preview = clone(samplePreview());
  preview.authRemovalPlan.find((item) => item.uid === 'fixture-president').action = 'future-delete';
  const bundle = sampleBundle({ preview });
  assert(bundle.sourceValidationBlockers.some((item) => item.includes('action preserve')));
}

function testPreservedUserDeleteBlocks() {
  const preview = clone(samplePreview());
  preview.firestoreRemovalPlan.find((item) => item.collection === 'users' && item.documentId === 'fixture-president').action = 'future-delete';
  const bundle = sampleBundle({ preview });
  assert(bundle.sourceValidationBlockers.some((item) => item.includes('users/fixture-president')));
}

function testPreservedRoleDeleteBlocks() {
  const preview = clone(samplePreview());
  preview.firestoreRemovalPlan.find((item) => item.collection === 'roles' && item.documentId === 'fixture-president').action = 'future-delete';
  const bundle = sampleBundle({ preview });
  assert(bundle.sourceValidationBlockers.some((item) => item.includes('roles/fixture-president')));
}

function testRebuildOtherUidBlocks() {
  const preview = clone(samplePreview());
  preview.rebuildPlan.push({ path: 'members/other-uid', action: 'future-create', fields: { userId: 'other-uid' } });
  const bundle = sampleBundle({ preview });
  assert(bundle.sourceValidationBlockers.some((item) => item.includes('non-preserved path')));
}

function testSourceCountMismatchBlocks() {
  const preview = clone(samplePreview());
  preview.summary.firestoreDocumentsToRemove += 1;
  const bundle = sampleBundle({ preview });
  assert(bundle.sourceValidationBlockers.some((item) => item.includes('Firestore removal count')));
}

function testVisitPolicies() {
  const bundle = sampleBundle();
  const visit = bundle.policyDecisions.policies.visitSubmission;
  assert.strictEqual(visit.find((item) => item.collection === 'visitSubmissionConfig').policy, 'reset-and-recreate-when-feature-is-implemented');
  assert.strictEqual(visit.find((item) => item.collection === 'visitSubmissionPositions').policy, 'reset-and-recreate-when-feature-is-implemented');
}

function testLockPolicies() {
  const bundle = sampleBundle();
  const attendance = bundle.manifest.locks.documents.find((item) => item.lockId === 'attendance');
  const custom = bundle.manifest.locks.documents.find((item) => item.lockId === 'customLock');
  assert.strictEqual(attendance.action, 'future-reset');
  assert.deepStrictEqual(attendance.targetState, { locked: false });
  assert.strictEqual(custom.action, 'manual-review');
}

function testDrivePolicies() {
  const bundle = sampleBundle();
  assert.strictEqual(bundle.manifest.drive.deleteDriveFilesDuringFirestoreReset, false);
  assert(bundle.manifest.drive.references.length >= 3);
  assert(bundle.manifest.drive.references.every((item) => item.action === 'preserve-external-file-for-now'));
}

function testBackupEvidenceValidates() {
  const bundle = sampleBundle();
  assert.strictEqual(bundle.backupVerification.status, 'verified');
}

function testStaleBackupWarns() {
  const backupEvidence = clone(fixture.backupEvidence);
  backupEvidence.createdAt = '2026-06-24T22:00:00.000Z';
  const bundle = sampleBundle({ backupEvidence });
  assert.strictEqual(bundle.backupVerification.status, 'verified-with-warnings');
  assert(bundle.backupVerification.warnings.some((item) => item.includes('before the source preview')));
}

function testWrongProjectBackupBlocks() {
  const backupEvidence = clone(fixture.backupEvidence);
  backupEvidence.projectId = 'wrong-project';
  const bundle = sampleBundle({ backupEvidence });
  assert.strictEqual(bundle.backupVerification.status, 'invalid');
  assert(bundle.backupVerification.errors.some((item) => item.includes('project ID')));
}

function testMissingBackupBlocks() {
  const bundle = sampleBundle({ backupEvidence: null });
  assert.strictEqual(bundle.backupVerification.status, 'not-provided');
  assert(bundle.manifest.approval.blockingReasons.some((item) => item.includes('Backup evidence')));
}

function testBackupCountMismatchReported() {
  const backupEvidence = clone(fixture.backupEvidence);
  backupEvidence.collectionCounts.events = 99;
  const bundle = sampleBundle({ backupEvidence });
  assert.strictEqual(bundle.backupVerification.status, 'verified-with-warnings');
  assert.strictEqual(bundle.backupVerification.countMismatchRequiresApproval, true);
  assert.strictEqual(bundle.backupVerification.countMismatchApprovalStatus, 'pending');
  assert(bundle.backupVerification.countComparisons.some((item) => item.collection === 'events' && item.status === 'mismatch'));
  assert(bundle.manifest.approval.blockingReasons.some((item) => item.includes('Backup count mismatches require explicit resolution')));
  assert.strictEqual(bundle.preExecutionChecklist.find((item) => item.item === 'backup counts reconciled').status, 'pending');
}

function testMatchingBackupCountsPass() {
  const bundle = sampleBundle();
  assert.strictEqual(bundle.preExecutionChecklist.find((item) => item.item === 'backup counts reconciled').status, 'pass');
}

function testPolicyUidUsesRequestedUid() {
  const bundle = sampleBundle();
  assert.strictEqual(bundle.manifest.policies.identity.preservedUid, 'fixture-president');

  const productionPreview = previewWithUid(CONFIRMED_PRESERVED_UID);
  const productionBundle = sampleBundle({
    preview: productionPreview,
    preservedUid: CONFIRMED_PRESERVED_UID,
    expectedPreservedUid: CONFIRMED_PRESERVED_UID,
  });
  assert.strictEqual(productionBundle.manifest.policies.identity.preservedUid, CONFIRMED_PRESERVED_UID);
}

function testManifestPolicyUidMismatchBlocks() {
  const bundle = sampleBundle();
  bundle.manifest.policies.identity.preservedUid = 'wrong-uid';
  const findings = require('../lib/riy-clean-slate-manifest').validateManifestConsistency(bundle.manifest);
  assert(findings.some((item) => item.includes('identity policy preserved UID')));
}

function testPreservedAccountUidMismatchBlocks() {
  const preview = clone(samplePreview());
  preview.preservedAccount.preservedUid = 'different-uid';
  const bundle = sampleBundle({ preview });
  assert(bundle.sourceValidationBlockers.some((item) => item.includes('preserved-account UID')));
}

function testPresidentOccupancyUidBlocks() {
  const preview = clone(samplePreview());
  const occupancy = preview.rebuildPlan.find((item) => item.path === 'bodPositionOccupancy/president');
  occupancy.fields.holderUids = ['other-uid'];
  const bundle = sampleBundle({ preview });
  assert(bundle.sourceValidationBlockers.some((item) => item.includes('President occupancy holderUids')));
}

function testPresidentOccupancyMultipleUidsBlocks() {
  const preview = clone(samplePreview());
  const occupancy = preview.rebuildPlan.find((item) => item.path === 'bodPositionOccupancy/president');
  occupancy.fields.holderUids = ['fixture-president', 'other-uid'];
  const bundle = sampleBundle({ preview });
  assert(bundle.sourceValidationBlockers.some((item) => item.includes('President occupancy holderUids')));
}

function testAssignmentPathWrongUidBlocks() {
  const preview = clone(samplePreview());
  const assignment = preview.rebuildPlan.find((item) => item.path === 'bodPositionAssignments/president_fixture-president');
  assignment.path = 'bodPositionAssignments/president_other-uid';
  const bundle = sampleBundle({ preview });
  assert(bundle.sourceValidationBlockers.some((item) => item.includes('bodPositionAssignments/president_fixture-president')));
}

function testAssignmentIdWrongUidBlocks() {
  const preview = clone(samplePreview());
  const assignment = preview.rebuildPlan.find((item) => item.path === 'bodPositionAssignments/president_fixture-president');
  assignment.fields.assignmentId = 'president_other-uid';
  const bundle = sampleBundle({ preview });
  assert(bundle.sourceValidationBlockers.some((item) => item.includes('assignmentId')));
}

function testAssignmentFieldUidWrongBlocks() {
  const preview = clone(samplePreview());
  const assignment = preview.rebuildPlan.find((item) => item.path === 'bodPositionAssignments/president_fixture-president');
  assignment.fields.uid = 'other-uid';
  const bundle = sampleBundle({ preview });
  assert(bundle.sourceValidationBlockers.some((item) => item.includes('assignment uid')));
}

function testAuditTargetUidWrongBlocks() {
  const preview = clone(samplePreview());
  const audit = preview.rebuildPlan.find((item) => item.path === 'rolePositionAudit/{generatedId}');
  audit.fields.targetUid = 'other-uid';
  const bundle = sampleBundle({ preview });
  assert(bundle.sourceValidationBlockers.some((item) => item.includes('audit targetUid')));
}

function testPreservedAuthInDeleteIdentityListBlocksManifest() {
  const bundle = sampleBundle();
  bundle.manifest.auth.usersToRemove.push({
    uid: 'fixture-president',
    action: 'future-delete',
  });
  const findings = require('../lib/riy-clean-slate-manifest').validateManifestConsistency(bundle.manifest);
  assert(findings.some((item) => item.includes('preserved UID')));
}

function testIdentityRiskDetection() {
  const bundle = sampleBundle();
  const secondShubham = bundle.identityReview.find((item) => item.uid === KNOWN_SECOND_SHUBHAM_UID);
  assert(secondShubham, 'second Shubham account is in identity review');
  assert.strictEqual(secondShubham.requiresExplicitIdentityApproval, true);
  assert(secondShubham.riskReasons.includes('same-display-name-as-preserved'));
  assert(secondShubham.riskReasons.includes('similar-email-to-preserved'));

  const admin = bundle.identityReview.find((item) => item.uid === 'fixture-admin');
  assert.strictEqual(admin.requiresExplicitIdentityApproval, true);
  assert(admin.riskReasons.includes('admin-or-president-role'));

  const gbm = bundle.identityReview.find((item) => item.uid === 'fixture-gbm');
  assert.strictEqual(gbm.requiresExplicitIdentityApproval, false);

  const testUser = bundle.identityReview.find((item) => item.uid === 'fixture-test');
  assert.strictEqual(testUser.requiresExplicitIdentityApproval, false);
  assert(testUser.riskReasons.includes('disabled-auth-account'));
}

function testDraftAndReadiness() {
  const bundle = sampleBundle();
  assert.strictEqual(bundle.manifest.approval.manifestStatus, 'draft');
  assert.strictEqual(bundle.manifest.approval.readyForExecutorImplementation, false);
  assert.strictEqual(bundle.manifestSummary.readyForExecutorImplementation, false);
}

function testNoFirebaseSdkLoaded() {
  const loaded = Object.keys(require.cache).filter((key) => key.includes('firebase-admin'));
  assert.deepStrictEqual(loaded, []);
}

function testNoSecretsOrWriteMethods() {
  const bundle = sampleBundle();
  assert.deepStrictEqual(validateNoSecretFields(bundle.manifest), []);
  const builderSource = fs.readFileSync(path.resolve(__dirname, 'build-riy-clean-slate-manifest.js'), 'utf8');
  assert(!builderSource.includes('firebase-admin'), 'builder must not load Firebase Admin');
  for (const forbidden of ['deleteUser', 'updateUser', 'batch.commit', 'runTransaction']) {
    assert(!builderSource.includes(forbidden), `builder must not contain ${forbidden}`);
  }
}

function run() {
  testValidPreviewLoads();
  testMissingPreviewFileBlocks();
  testWrongProjectBlocks();
  testWrongPreservedUidBlocks();
  testPreservedAuthDeleteBlocks();
  testPreservedUserDeleteBlocks();
  testPreservedRoleDeleteBlocks();
  testRebuildOtherUidBlocks();
  testSourceCountMismatchBlocks();
  testVisitPolicies();
  testLockPolicies();
  testDrivePolicies();
  testBackupEvidenceValidates();
  testStaleBackupWarns();
  testWrongProjectBackupBlocks();
  testMissingBackupBlocks();
  testBackupCountMismatchReported();
  testMatchingBackupCountsPass();
  testPolicyUidUsesRequestedUid();
  testManifestPolicyUidMismatchBlocks();
  testPreservedAccountUidMismatchBlocks();
  testPresidentOccupancyUidBlocks();
  testPresidentOccupancyMultipleUidsBlocks();
  testAssignmentPathWrongUidBlocks();
  testAssignmentIdWrongUidBlocks();
  testAssignmentFieldUidWrongBlocks();
  testAuditTargetUidWrongBlocks();
  testPreservedAuthInDeleteIdentityListBlocksManifest();
  testIdentityRiskDetection();
  testDraftAndReadiness();
  testNoFirebaseSdkLoaded();
  testNoSecretsOrWriteMethods();
  console.log('RIY clean-slate manifest verification passed.');
}

run();
