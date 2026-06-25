'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const positionHelpers = require('../lib/positions');
const visit = require('../lib/visit-submissions');

const fixturePath = path.join(__dirname, 'fixtures', 'visit-submission-foundation-sample.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const repoRoot = path.resolve(__dirname, '..', '..');

function createEnv(seed = fixture) {
  const adapter = visit.createMemoryVisitSubmissionAdapter(seed);
  const service = visit.createVisitSubmissionService({ adapter, positionHelpers });
  return { adapter, service };
}

function assertErrorCode(error, code) {
  assert.strictEqual(error?.httpsCode || error?.code, code);
}

async function rejectsWithCode(promiseFactory, code, label) {
  let rejected = false;
  try {
    await promiseFactory();
  } catch (err) {
    rejected = true;
    assertErrorCode(err, code);
  }
  assert.ok(rejected, label || `Expected rejection with ${code}`);
}

async function initializedEnv() {
  const env = createEnv();
  const result = await env.service.initializeStructure('president-uid');
  assert.strictEqual(result.createdConfigCount, 3);
  assert.strictEqual(result.createdPositionCount, 57);
  return env;
}

function assertNoSecretLikeValues(value, pathLabel = 'root') {
  const secretPattern = /private[_-]?key|credential|shared[_-]?secret|access[_-]?token|refresh[_-]?token|auth[_-]?token/i;
  if (value == null) return;
  if (typeof value === 'string') {
    assert.ok(!secretPattern.test(value), `Secret-like value at ${pathLabel}`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSecretLikeValues(item, `${pathLabel}[${index}]`));
    return;
  }
  if (typeof value === 'object') {
    Object.keys(value).forEach((key) => {
      assert.ok(!secretPattern.test(key), `Secret-like key at ${pathLabel}.${key}`);
      assertNoSecretLikeValues(value[key], `${pathLabel}.${key}`);
    });
  }
}

function assertNoInternalSubmissionFields(submission) {
  [
    'driveFileId',
    'driveFolderId',
    'deletedByUid',
    'deleteReason',
    'uploadTicketId',
    'ticketId',
  ].forEach((field) => {
    assert.ok(!Object.prototype.hasOwnProperty.call(submission, field), `${field} is not exposed`);
  });
  assert.ok(Object.prototype.hasOwnProperty.call(submission, 'fileUrl'), 'safe fileUrl is exposed');
}

function assertVisitRuleDenyBlock(rules, collection) {
  const pattern = new RegExp(
    `match\\s+/${collection}/\\{[^}]+\\}\\s*\\{\\s*allow\\s+read,\\s*write:\\s*if\\s+false;\\s*\\}`,
    'm'
  );
  assert.ok(pattern.test(rules), `${collection} precisely denies direct reads and writes`);
}

(async () => {
  assert.strictEqual(visit.VISIT_TYPE_KEYS.length, 3, 'exactly three canonical visit types exist');
  assert.deepStrictEqual(visit.VISIT_TYPE_KEYS, ['clubAssembly', 'dzrVisit', 'drrVisit']);
  assert.strictEqual(positionHelpers.POSITION_KEYS.length, 19, 'exactly 19 canonical positions are used');

  const uninitialized = createEnv();
  await rejectsWithCode(
    () => uninitialized.service.getDashboard('president-uid'),
    'failed-precondition',
    'dashboard before initialization fails'
  );
  await rejectsWithCode(
    () => uninitialized.service.getFolders('president-uid', 'clubAssembly'),
    'failed-precondition',
    'folders before initialization fail'
  );
  await rejectsWithCode(
    () => uninitialized.service.getFolder('president-uid', 'clubAssembly', 'president'),
    'failed-precondition',
    'folder before initialization fails'
  );

  const first = await initializedEnv();
  assert.strictEqual(Object.keys(first.adapter.store.visitSubmissionConfig).length, 3);
  assert.strictEqual(Object.keys(first.adapter.store.visitSubmissionPositions).length, 57);

  first.adapter.store.visitSubmissionConfig.clubAssembly.description = 'Custom assembly instructions';
  first.adapter.store.visitSubmissionPositions.clubAssembly_secretary.locked = true;
  first.adapter.store.visitSubmissionPositions.clubAssembly_secretary.lockReason = 'Existing custom lock';
  const secondInit = await first.service.initializeStructure('president-uid');
  assert.strictEqual(secondInit.createdConfigCount, 0, 'second initialization creates no configs');
  assert.strictEqual(secondInit.createdPositionCount, 0, 'second initialization creates no folders');
  assert.strictEqual(first.adapter.store.visitSubmissionConfig.clubAssembly.description, 'Custom assembly instructions');
  assert.strictEqual(first.adapter.store.visitSubmissionPositions.clubAssembly_secretary.locked, true);
  assert.strictEqual(first.adapter.store.visitSubmissionPositions.clubAssembly_secretary.lockReason, 'Existing custom lock');

  await rejectsWithCode(() => first.service.resolveAccessContext(''), 'unauthenticated', 'unauthenticated access denied');
  await rejectsWithCode(() => first.service.getDashboard('missing-user'), 'permission-denied', 'missing user document denied');
  await rejectsWithCode(() => first.service.getDashboard('orphan-role'), 'permission-denied', 'orphan approved role denied');
  await rejectsWithCode(() => first.service.getDashboard('missing-status'), 'permission-denied', 'missing user status denied');
  await rejectsWithCode(() => first.service.getDashboard('role-conflict'), 'failed-precondition', 'user/role conflict fails');
  await rejectsWithCode(() => first.service.getDashboard('role-rejected'), 'permission-denied', 'rejected role document denied');
  await rejectsWithCode(() => first.service.getDashboard('inactive-user'), 'permission-denied', 'inactive user denied');
  await rejectsWithCode(() => first.service.getDashboard('prospect-uid'), 'permission-denied', 'prospect denied');
  await rejectsWithCode(() => first.service.getDashboard('gbm-uid'), 'permission-denied', 'GBM denied');
  await rejectsWithCode(() => first.service.getDashboard('pending-bod'), 'permission-denied', 'unapproved user denied');
  await rejectsWithCode(() => first.service.getDashboard('bod-malformed'), 'failed-precondition', 'malformed position keys rejected safely');

  const noRoleDocSeed = JSON.parse(JSON.stringify(fixture));
  delete noRoleDocSeed.roles['admin-uid'];
  const noRoleDocEnv = createEnv(noRoleDocSeed);
  await noRoleDocEnv.service.initializeStructure('president-uid');
  const adminWithoutRoleDoc = await noRoleDocEnv.service.getDashboard('admin-uid');
  assert.strictEqual(adminWithoutRoleDoc.access.role, 'admin', 'approved user doc may carry access without roles doc');

  const presidentDashboard = await first.service.getDashboard('president-uid');
  assert.strictEqual(presidentDashboard.access.role, 'president', 'approved President resolves');
  assert.strictEqual(presidentDashboard.visits[0].activeSubmissionCount, 3, 'President manager-wide count works');

  const adminFolders = await first.service.getFolders('admin-uid', 'clubAssembly');
  assert.strictEqual(adminFolders.folders.length, 19, 'Admin sees all folders');
  const presidentFolders = await first.service.getFolders('president-uid', 'clubAssembly');
  assert.strictEqual(presidentFolders.folders.length, 19, 'President sees all folders');

  const bodDashboard = await first.service.getDashboard('bod-secretary');
  assert.strictEqual(bodDashboard.access.role, 'bod', 'approved BOD with canonical positions resolves');
  assert.strictEqual(bodDashboard.visits[0].accessiblePositionCount, 1);
  assert.strictEqual(bodDashboard.visits[0].activeSubmissionCount, 1, 'one-position BOD counts only that position');

  const onePositionFolders = await first.service.getFolders('bod-secretary', 'clubAssembly');
  assert.strictEqual(onePositionFolders.folders.length, 1, 'BOD with one position sees one folder');
  assert.strictEqual(onePositionFolders.folders[0].positionKey, 'secretary');

  const multiPositionDashboard = await first.service.getDashboard('bod-multi');
  assert.strictEqual(multiPositionDashboard.visits[0].activeSubmissionCount, 2, 'multi-position BOD counts assigned positions only');
  const multiPositionFolders = await first.service.getFolders('bod-multi', 'clubAssembly');
  assert.deepStrictEqual(multiPositionFolders.folders.map(folder => folder.positionKey), ['secretary', 'editor']);

  const secretaryFolder = await first.service.getFolder('bod-secretary', 'clubAssembly', 'secretary');
  assert.deepStrictEqual(secretaryFolder.submissions.map(item => item.positionKey), ['secretary']);
  assert.strictEqual(secretaryFolder.submissions.length, 1, 'inaccessible submission metadata is not returned');
  assertNoInternalSubmissionFields(secretaryFolder.submissions[0]);

  const multiEditorFolder = await first.service.getFolder('bod-multi', 'clubAssembly', 'editor');
  assert.deepStrictEqual(multiEditorFolder.submissions.map(item => item.positionKey), ['editor']);

  await rejectsWithCode(
    () => first.service.getFolder('bod-secretary', 'clubAssembly', 'treasurer'),
    'permission-denied',
    'BOD cannot request another position'
  );
  await rejectsWithCode(
    () => first.service.updateConfig('bod-secretary', { visitType: 'clubAssembly', description: 'Nope' }),
    'permission-denied',
    'BOD cannot update config'
  );
  await rejectsWithCode(
    () => first.service.updateFolder('bod-secretary', { visitType: 'clubAssembly', positionKey: 'secretary', locked: false }),
    'permission-denied',
    'BOD cannot update folder lock'
  );

  await rejectsWithCode(() => first.service.getFolders('admin-uid', 'unknownVisit'), 'invalid-argument', 'unknown visit rejected');
  await rejectsWithCode(
    () => first.service.getFolder('admin-uid', 'clubAssembly', 'unknown-position'),
    'invalid-argument',
    'unknown position rejected before query'
  );

  await rejectsWithCode(
    () => first.service.getFolders('bod-manual-only', 'clubAssembly'),
    'permission-denied',
    'manual generated-ID BOD row does not authorize'
  );

  const missingConfigEnv = await initializedEnv();
  delete missingConfigEnv.adapter.store.visitSubmissionConfig.drrVisit;
  await rejectsWithCode(
    () => missingConfigEnv.service.getDashboard('president-uid'),
    'failed-precondition',
    'missing one config after initialization fails'
  );

  const missingPositionEnv = await initializedEnv();
  delete missingPositionEnv.adapter.store.visitSubmissionPositions.clubAssembly_secretary;
  await rejectsWithCode(
    () => missingPositionEnv.service.getDashboard('bod-secretary'),
    'failed-precondition',
    'dashboard reports partial position structure as incomplete'
  );
  await rejectsWithCode(
    () => missingPositionEnv.service.getFolder('bod-secretary', 'clubAssembly', 'secretary'),
    'not-found',
    'missing one position folder after initialization fails'
  );

  const configUpdate = await first.service.updateConfig('admin-uid', {
    visitType: 'clubAssembly',
    description: 'Updated description',
    submissionOpen: false,
  });
  assert.deepStrictEqual(configUpdate.changedFields.sort(), ['description', 'submissionOpen']);
  assert.strictEqual(first.adapter.store.visitSubmissionConfig.clubAssembly.description, 'Updated description');

  const folderUpdate = await first.service.updateFolder('president-uid', {
    visitType: 'clubAssembly',
    positionKey: 'secretary',
    locked: false,
    maxActiveFiles: 25,
    maxFilesPerSelection: 5,
    maxFileSizeBytes: 10 * 1024 * 1024,
  });
  assert.ok(folderUpdate.changedFields.includes('locked'), 'President can update folder config');

  await rejectsWithCode(
    () => first.service.updateConfig('admin-uid', { visitType: 'clubAssembly' }),
    'invalid-argument',
    'empty config update rejected'
  );
  await rejectsWithCode(
    () => first.service.updateFolder('admin-uid', { visitType: 'clubAssembly', positionKey: 'secretary' }),
    'invalid-argument',
    'empty folder update rejected'
  );

  const noopEnv = await initializedEnv();
  const writeCountBeforeNoopConfig = noopEnv.adapter.writes.length;
  const auditCountBeforeNoopConfig = Object.keys(noopEnv.adapter.store.visitSubmissionAudit || {}).length;
  const noopConfig = await noopEnv.service.updateConfig('admin-uid', {
    visitType: 'clubAssembly',
    description: '',
  });
  assert.deepStrictEqual(noopConfig.changedFields, [], 'no-op config update returns empty changedFields');
  assert.strictEqual(noopEnv.adapter.writes.length, writeCountBeforeNoopConfig, 'no-op config update performs no write');
  assert.strictEqual(Object.keys(noopEnv.adapter.store.visitSubmissionAudit || {}).length, auditCountBeforeNoopConfig);

  const writeCountBeforeNoopFolder = noopEnv.adapter.writes.length;
  const auditCountBeforeNoopFolder = Object.keys(noopEnv.adapter.store.visitSubmissionAudit || {}).length;
  const noopFolder = await noopEnv.service.updateFolder('admin-uid', {
    visitType: 'clubAssembly',
    positionKey: 'secretary',
    locked: false,
  });
  assert.deepStrictEqual(noopFolder.changedFields, [], 'no-op folder update returns empty changedFields');
  assert.strictEqual(noopEnv.adapter.writes.length, writeCountBeforeNoopFolder, 'no-op folder update performs no write');
  assert.strictEqual(Object.keys(noopEnv.adapter.store.visitSubmissionAudit || {}).length, auditCountBeforeNoopFolder);

  const lockedEnv = await initializedEnv();
  await lockedEnv.service.updateFolder('president-uid', {
    visitType: 'clubAssembly',
    positionKey: 'secretary',
    locked: true,
    lockReason: 'Review window closed',
  });
  const lockedFolder = await lockedEnv.service.getFolder('bod-secretary', 'clubAssembly', 'secretary');
  assert.strictEqual(lockedFolder.folder.canUpload, false, 'locked folder cannot upload');

  const closedEnv = await initializedEnv();
  await closedEnv.service.updateConfig('admin-uid', {
    visitType: 'clubAssembly',
    submissionOpen: false,
  });
  const closedFolder = await closedEnv.service.getFolder('bod-secretary', 'clubAssembly', 'secretary');
  assert.strictEqual(closedFolder.folder.canUpload, false, 'closed visit cannot upload');

  const disabledEnv = await initializedEnv();
  await disabledEnv.service.updateFolder('president-uid', {
    visitType: 'clubAssembly',
    positionKey: 'secretary',
    enabled: false,
  });
  const disabledFolder = await disabledEnv.service.getFolder('bod-secretary', 'clubAssembly', 'secretary');
  assert.strictEqual(disabledFolder.folder.canUpload, false, 'disabled folder cannot upload');

  assert.throws(() => visit.validateFolderUpdate({ maxActiveFiles: 0 }), /maxActiveFiles/);
  assert.throws(() => visit.validateFolderUpdate({ maxFilesPerSelection: 11 }), /maxFilesPerSelection/);
  assert.throws(() => visit.validateFolderUpdate({ maxFileSizeBytes: (25 * 1024 * 1024) + 1 }), /maxFileSizeBytes/);

  const auditDocs = Object.values(first.adapter.store.visitSubmissionAudit || {});
  assert.ok(auditDocs.length >= 3, 'audit records are written for init and real updates');
  auditDocs.forEach(audit => assertNoSecretLikeValues(audit));

  const rules = fs.readFileSync(path.join(repoRoot, 'firestore.rules'), 'utf8');
  [
    'visitSubmissionConfig',
    'visitSubmissionPositions',
    'visitSubmissions',
    'visitSubmissionAudit',
    'visitSubmissionFolderLocks',
  ].forEach(collection => assertVisitRuleDenyBlock(rules, collection));

  const source = fs.readFileSync(path.join(repoRoot, 'functions', 'lib', 'visit-submissions.js'), 'utf8');
  assert.ok(!/DriveApp|google\.drive|drive\.files|deleteDrive/i.test(source), 'no Drive calls occur');
  assert.ok(!/createVisitUploadTicket|uploadVisitFile|deleteVisitFile/.test(source), 'no upload function is implemented');
  assert.ok(!/firebase deploy/i.test(source), 'no deploy commands are introduced in module');

  console.log('Visit Submission foundation verification passed.');
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
