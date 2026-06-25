#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  REQUIRED_PROJECT_ID,
  CONFIRM_PHRASE,
  RESET_COLLECTIONS,
  KNOWN_LOCK_IDS,
  RESET_EXPECT_EMPTY_COLLECTIONS,
  createFixtureAdapters,
  runCleanSlate,
  validateLiveFlags,
  verifyFinalState,
  assertNoSecretFields,
} = require('../lib/riy-clean-slate-executor');

const fixturePath = path.resolve(__dirname, 'fixtures', 'riy-clean-slate-executor-sample.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function adaptersFor(overrides = {}) {
  const data = clone(fixture);
  if (overrides.fixtureMutator) overrides.fixtureMutator(data);
  if (overrides.failures) data.failures = overrides.failures;
  return createFixtureAdapters(data);
}

function authDeleteWrites(adapters) {
  return adapters.state.writes.filter((write) => write.type === 'deleteAuthUser');
}

function baseOptions(overrides = {}) {
  return {
    projectId: REQUIRED_PROJECT_ID,
    preserveUid: 'fixture-president',
    preservedEmail: 'fixture-president@example.com',
    preservedName: 'Fixture President',
    confirmProject: REQUIRED_PROJECT_ID,
    confirmNoBackup: true,
    confirmPhrase: CONFIRM_PHRASE,
    execute: true,
    enforceRealUid: false,
    ...overrides,
  };
}

async function testPreviewCausesZeroWrites() {
  const adapters = adaptersFor();
  const result = await runCleanSlate(adapters, baseOptions({ execute: false }));
  assert.strictEqual(result.status, 'preview-only');
  assert.strictEqual(adapters.state.writes.length, 0);
}

function testLiveFlagValidation() {
  assert(validateLiveFlags(baseOptions({ execute: false })).some((item) => item.includes('--execute')));
  assert(validateLiveFlags(baseOptions({ confirmNoBackup: false })).some((item) => item.includes('--confirm-no-backup')));
  assert(validateLiveFlags(baseOptions({ confirmPhrase: 'WRONG' })).some((item) => item.includes('confirmation phrase')));
  assert(validateLiveFlags(baseOptions({ projectId: 'wrong-project' })).some((item) => item.includes('--project')));
}

async function testPreservedAccountPreflightBlocks() {
  let adapters = adaptersFor({ fixtureMutator: (data) => { data.authUsers = data.authUsers.filter((user) => user.uid !== 'fixture-president'); } });
  let result = await runCleanSlate(adapters, baseOptions());
  assert.strictEqual(result.status, 'aborted-before-write');
  assert(result.blockers.some((item) => item.includes('Preserved Auth user')));

  adapters = adaptersFor({ fixtureMutator: (data) => { data.authUsers.find((user) => user.uid === 'fixture-president').email = 'wrong@example.com'; } });
  result = await runCleanSlate(adapters, baseOptions());
  assert(result.blockers.some((item) => item.includes('email')));

  adapters = adaptersFor({ fixtureMutator: (data) => { delete data.collections.users['fixture-president']; } });
  result = await runCleanSlate(adapters, baseOptions());
  assert(result.blockers.some((item) => item.includes('users/fixture-president')));

  adapters = adaptersFor({ fixtureMutator: (data) => { delete data.collections.roles['fixture-president']; } });
  result = await runCleanSlate(adapters, baseOptions());
  assert(result.blockers.some((item) => item.includes('roles/fixture-president')));
}

async function testExecutionHappyPath() {
  const adapters = adaptersFor();
  const result = await runCleanSlate(adapters, baseOptions());
  assert.strictEqual(result.status, 'completed');
  assert(!result.authResults.some((item) => item.uid === 'fixture-president'));
  assert.deepStrictEqual((await adapters.auth.listUsers()).map((user) => user.uid), ['fixture-president']);

  for (const collection of RESET_COLLECTIONS) {
    if (['members', 'attendance', 'districtAttendance', 'bodMembers', 'bodAttendance', 'bodPositionOccupancy', 'bodPositionAssignments', 'rolePositionAudit'].includes(collection)) continue;
    assert.strictEqual((await adapters.firestore.listDocs(collection)).length, 0, `${collection} should be empty`);
  }

  assert.deepStrictEqual((await adapters.firestore.listDocs('users')).map((doc) => doc.id), ['fixture-president']);
  assert.deepStrictEqual((await adapters.firestore.listDocs('roles')).map((doc) => doc.id), ['fixture-president']);
  for (const lockId of KNOWN_LOCK_IDS) {
    const lock = await adapters.firestore.getDoc('locks', lockId);
    assert.strictEqual(lock.data.locked, false, `${lockId} unlocked`);
  }
  const customLock = await adapters.firestore.getDoc('locks', 'customLock');
  assert.strictEqual(customLock.data.locked, true, 'unknown lock unchanged');
  assert.strictEqual(adapters.state.driveCalls.length, 0);

  const user = await adapters.firestore.getDoc('users', 'fixture-president');
  assert.strictEqual(user.data.role, 'president');
  assert.strictEqual(user.data.requestedRole, 'president');
  assert.deepStrictEqual(user.data.positionKeys, ['president']);
  assert.strictEqual(user.data.phone, '123');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(user.data, 'legacyAdminFlag'), false);

  const role = await adapters.firestore.getDoc('roles', 'fixture-president');
  assert.strictEqual(role.data.role, 'president');

  for (const collection of ['members', 'attendance', 'districtAttendance', 'bodMembers', 'bodAttendance']) {
    const docs = await adapters.firestore.listDocs(collection);
    assert.deepStrictEqual(docs.map((doc) => doc.id), ['fixture-president']);
  }
  const occupancy = await adapters.firestore.getDoc('bodPositionOccupancy', 'president');
  assert.deepStrictEqual(occupancy.data.holderUids, ['fixture-president']);
  const assignment = await adapters.firestore.getDoc('bodPositionAssignments', 'president_fixture-president');
  assert.strictEqual(assignment.data.uid, 'fixture-president');
  assert((await adapters.firestore.listDocs('rolePositionAudit')).length >= 1);
  assert.strictEqual(result.verification.ok, true);
}

async function testIdempotencyAndRetrySafety() {
  const adapters = adaptersFor();
  let result = await runCleanSlate(adapters, baseOptions());
  assert.strictEqual(result.status, 'completed');
  result = await runCleanSlate(adapters, baseOptions());
  assert.strictEqual(result.status, 'completed');
  assert.deepStrictEqual((await adapters.auth.listUsers()).map((user) => user.uid), ['fixture-president']);
}

async function testEmptyCollectionsRetrySafe() {
  const adapters = adaptersFor({ fixtureMutator: (data) => {
    for (const collection of RESET_COLLECTIONS) data.collections[collection] = {};
  } });
  const result = await runCleanSlate(adapters, baseOptions());
  assert(['completed', 'completed-with-errors'].includes(result.status));
}

async function testPartialFailuresReported() {
  let adapters = adaptersFor({ failures: { deleteCollections: ['events'] } });
  let result = await runCleanSlate(adapters, baseOptions());
  assert.strictEqual(result.status, 'completed-with-errors');
  assert(result.firestoreResults.some((item) => item.collection === 'events' && item.errors.length));
  assert.strictEqual(result.authDeletionSkipped, true);
  assert.strictEqual(authDeleteWrites(adapters).length, 0);

  adapters = adaptersFor({ failures: { deleteAuthUids: ['old-gbm'] } });
  result = await runCleanSlate(adapters, baseOptions());
  assert.strictEqual(result.status, 'completed-with-errors');
  assert(result.authResults.some((item) => item.uid === 'old-gbm' && item.ok === false));
  assert(result.verification.checks.some((item) => item.check === 'exactly one Auth user remains' && item.ok === false));
}

async function assertFirestoreFailureSkipsAuth(failure, expectedPathOrLock) {
  const adapters = adaptersFor({ failures: failure });
  const result = await runCleanSlate(adapters, baseOptions());
  assert.strictEqual(result.status, 'completed-with-errors', expectedPathOrLock);
  assert.strictEqual(result.authDeletionSkipped, true, expectedPathOrLock);
  assert.strictEqual(result.authDeletionSkipReason, 'Firestore cleanup or President rebuild did not complete successfully.');
  assert.strictEqual(authDeleteWrites(adapters).length, 0, expectedPathOrLock);
}

async function testRebuildFailuresPreventAuthDeletion() {
  await assertFirestoreFailureSkipsAuth({ setDocs: ['members/fixture-president'] }, 'members/fixture-president');
  await assertFirestoreFailureSkipsAuth({ setDocs: ['attendance/fixture-president'] }, 'attendance/fixture-president');
  await assertFirestoreFailureSkipsAuth({ setDocs: ['users/fixture-president'] }, 'users/fixture-president');
  await assertFirestoreFailureSkipsAuth({ setDocs: ['roles/fixture-president'] }, 'roles/fixture-president');
  await assertFirestoreFailureSkipsAuth({ setDocs: ['bodPositionOccupancy/president'] }, 'bodPositionOccupancy/president');
  await assertFirestoreFailureSkipsAuth({ setDocs: ['bodPositionAssignments/president_fixture-president'] }, 'bodPositionAssignments/president_fixture-president');
  await assertFirestoreFailureSkipsAuth({ addDocs: ['rolePositionAudit'] }, 'rolePositionAudit');
  await assertFirestoreFailureSkipsAuth({ lockWrites: ['attendance'] }, 'locks/attendance');
}

async function testSuccessfulIntermediateAllowsAuthDeletion() {
  const adapters = adaptersFor();
  const result = await runCleanSlate(adapters, baseOptions());
  assert.strictEqual(result.intermediateVerification.ok, true);
  assert.strictEqual(result.authDeletionSkipped, false);
  assert(authDeleteWrites(adapters).some((write) => write.uid === 'old-president'));
}

async function testOverwriteRemovesOldFields() {
  const adapters = adaptersFor({ fixtureMutator: (data) => {
    data.collections.users['fixture-president'].legacyAdminFlag = true;
    data.collections.members['fixture-president'] = { userId: 'fixture-president', legacyMemberField: true, eventId: 'old' };
    data.collections.attendance['fixture-president'] = { userId: 'fixture-president', oldEvent: 'P' };
  } });
  const result = await runCleanSlate(adapters, baseOptions());
  assert.strictEqual(result.status, 'completed');
  const user = await adapters.firestore.getDoc('users', 'fixture-president');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(user.data, 'legacyAdminFlag'), false);
  assert.deepStrictEqual(Object.keys(user.data).sort(), ['active', 'avenueCodes', 'clubPosition', 'createdAt', 'email', 'hasBodPosition', 'name', 'phone', 'photoURL', 'positionKeys', 'positionTitles', 'requestedRole', 'role', 'status', 'uid'].sort());
  const member = await adapters.firestore.getDoc('members', 'fixture-president');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(member.data, 'legacyMemberField'), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(member.data, 'eventId'), false);
  const attendance = await adapters.firestore.getDoc('attendance', 'fixture-president');
  assert.deepStrictEqual(Object.keys(attendance.data).sort(), ['active', 'userId']);
}

async function testVerificationCatchesBadFinalState() {
  let adapters = adaptersFor();
  await runCleanSlate(adapters, baseOptions());
  adapters.state.authUsers.push({ uid: 'extra-auth', email: 'extra@example.com' });
  let verification = await verifyFinalState(adapters, baseOptions());
  assert.strictEqual(verification.ok, false);
  assert(verification.checks.some((item) => item.check === 'exactly one Auth user remains' && item.ok === false));

  adapters = adaptersFor();
  await runCleanSlate(adapters, baseOptions());
  adapters.state.collections.users['stale-user'] = { role: 'gbm' };
  verification = await verifyFinalState(adapters, baseOptions());
  assert(verification.checks.some((item) => item.check === 'exactly one users document remains' && item.ok === false));

  adapters = adaptersFor();
  await runCleanSlate(adapters, baseOptions());
  adapters.state.collections.roles['fixture-president'].role = 'admin';
  verification = await verifyFinalState(adapters, baseOptions());
  assert(verification.checks.some((item) => item.check === 'preserved role is approved President' && item.ok === false));
}

async function testExpandedFinalVerificationCatchesStaleRecords() {
  let adapters = adaptersFor();
  await runCleanSlate(adapters, baseOptions());
  for (const collection of RESET_EXPECT_EMPTY_COLLECTIONS) {
    const verification = await verifyFinalState(adapters, baseOptions({ executionId: 'not-required' }));
    assert(verification.checks.some((item) => item.check === `${collection} is empty`), `${collection} final verification missing`);
  }

  adapters = adaptersFor();
  await runCleanSlate(adapters, baseOptions());
  adapters.state.collections.driveUploadTickets.stale = {};
  let verification = await verifyFinalState(adapters, baseOptions());
  assert(verification.checks.some((item) => item.check === 'driveUploadTickets is empty' && item.ok === false));

  adapters = adaptersFor();
  await runCleanSlate(adapters, baseOptions());
  adapters.state.collections.visitSubmissions.stale = {};
  verification = await verifyFinalState(adapters, baseOptions());
  assert(verification.checks.some((item) => item.check === 'visitSubmissions is empty' && item.ok === false));

  adapters = adaptersFor();
  await runCleanSlate(adapters, baseOptions());
  adapters.state.collections.rolePositionAudit.stalePriorAudit = { action: 'oldRoleChange' };
  verification = await verifyFinalState(adapters, baseOptions());
  assert(verification.checks.some((item) => item.check === 'rolePositionAudit contains only clean-slate audit records' && item.ok === false));
}

async function testNestedSubcollectionBlocksBeforeWrites() {
  const adapters = adaptersFor({ fixtureMutator: (data) => {
    data.nestedSubcollections = {
      'events/event-one': ['events/event-one/attendees'],
    };
  } });
  const result = await runCleanSlate(adapters, baseOptions());
  assert.strictEqual(result.status, 'aborted-before-write');
  assert(result.blockers.some((item) => item.includes('Nested Firestore subcollections')));
  assert.deepStrictEqual(result.plan.nestedSubcollections, ['events/event-one/attendees']);
  assert.strictEqual(adapters.state.writes.length, 0);
}

function testNoSecretFieldsAndNoDeployCommands() {
  assert.deepStrictEqual(assertNoSecretFields({ safe: true, nested: { tokenValue: 'nope' } }), ['nested.tokenValue']);
  const executorSource = fs.readFileSync(path.resolve(__dirname, '../lib/riy-clean-slate-executor.js'), 'utf8');
  const cliSource = fs.readFileSync(path.resolve(__dirname, 'execute-riy-clean-slate.js'), 'utf8');
  assert(!executorSource.includes('firebase deploy'));
  assert(!cliSource.includes('firebase deploy'));
  assert(!executorSource.includes('gcloud app deploy'));
  assert(!cliSource.includes('gcloud app deploy'));
}

async function testPlanningRules() {
  const adapters = adaptersFor();
  const result = await runCleanSlate(adapters, baseOptions({ execute: false }));
  assert(result.plan.authUsersToDelete.every((user) => user.uid !== 'fixture-president'));
  assert(result.plan.authUsersToDelete.some((user) => user.uid === 'old-president'));
  assert(Object.keys(result.plan.resetCollections).every((collection) => RESET_COLLECTIONS.includes(collection)));
  assert(result.plan.unknownCollections.includes('unknownCollection'));
  assert(result.plan.usersToDelete.includes('old-president'));
  assert(!result.plan.usersToDelete.includes('fixture-president'));
  assert(result.plan.rolesToDelete.includes('old-president'));
  assert(!result.plan.rolesToDelete.includes('fixture-president'));
}

async function run() {
  await testPreviewCausesZeroWrites();
  testLiveFlagValidation();
  await testPreservedAccountPreflightBlocks();
  await testPlanningRules();
  await testExecutionHappyPath();
  await testIdempotencyAndRetrySafety();
  await testEmptyCollectionsRetrySafe();
  await testPartialFailuresReported();
  await testRebuildFailuresPreventAuthDeletion();
  await testSuccessfulIntermediateAllowsAuthDeletion();
  await testOverwriteRemovesOldFields();
  await testVerificationCatchesBadFinalState();
  await testExpandedFinalVerificationCatchesStaleRecords();
  await testNestedSubcollectionBlocksBeforeWrites();
  testNoSecretFieldsAndNoDeployCommands();
  console.log('RIY clean-slate executor verification passed.');
}

run().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exitCode = 1;
});
