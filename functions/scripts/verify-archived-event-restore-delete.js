'use strict';

// v2.14.0: restore and permanent delete for archived BOD events.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const lifecycle = require('../lib/archived-event-lifecycle');

const readSource = file => fs.readFileSync(path.resolve(__dirname, file), 'utf8').replace(/\r\n/g, '\n');
const indexSource = readSource('../index.js');
const lifecycleSource = readSource('../lib/archived-event-lifecycle.js');
const rulesSource = readSource('../../firestore.rules');

function callableSource(name) {
  const start = indexSource.indexOf(`exports.${name} = onCall`);
  assert.notEqual(start, -1, `${name} callable exists`);
  const next = indexSource.indexOf('\nexports.', start + 1);
  return indexSource.slice(start, next === -1 ? indexSource.length : next);
}

function functionSource(name) {
  const start = indexSource.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} exists`);
  const candidates = ['\nfunction ', '\nasync function ', '\nexports.']
    .map(marker => indexSource.indexOf(marker, start + 1))
    .filter(index => index > start);
  return indexSource.slice(start, candidates.length ? Math.min(...candidates) : indexSource.length);
}

const restoreSource = callableSource('restoreArchivedBodEvent');
const deleteSource = callableSource('permanentlyDeleteArchivedBodEvent');
const archiveSource = callableSource('archiveBodEvent');
const meetingArchiveSource = functionSource('archiveBodToolsMeetingFromBodEventCallable');
const accessSource = functionSource('requireArchivedBodEventLifecycleAccess');
const targetSource = functionSource('loadArchivedBodEventTarget');

// v2 callable signature.
for (const [name, source] of [['restore', restoreSource], ['delete', deleteSource]]) {
  assert.match(source, /= onCall\(CALLABLE_OPTIONS, async \(request\) => \{\n  const data = request\?\.data \|\| \{\};/, `${name} uses v2 request signature`);
  assert.doesNotMatch(source, /async \(data\b/, `${name} does not use v1 (data, context)`);
  assert.doesNotMatch(source, /context\.auth/, `${name} does not read context.auth`);
  assert.match(source, /requireArchivedBodEventLifecycleAccess\(request\)/, `${name} reuses archive access checks`);
  assert.match(source, /validateEventDocId\(data\.eventId\)/, `${name} takes { eventId }`);
  assert.doesNotMatch(source, /bodEventId/, `${name} does not take bodEventId`);
}

// Same permission and lock as archiveBodEvent.
assert.match(archiveSource, /\['bod', 'admin', 'president'\]\.includes\(authority\.role\)/);
assert.deepEqual([...lifecycle.ARCHIVE_LIFECYCLE_ROLES], ['bod', 'admin', 'president']);
assert.match(accessSource, /requireAuth\(request\)/);
assert.match(accessSource, /getAuthorityContext\(uid\)/);
assert.match(accessSource, /canManageArchivedEvents\(authority\.role\)/);
assert.match(accessSource, /'permission-denied'/);
assert.match(accessSource, /await assertBodEventsUnlockedForRole\(authority\)/);
assert.match(targetSource, /bodEventRecordIsBodMeeting\(bodEventData\)/);
assert.match(targetSource, /if \(!isMeeting\) await assertBodEventRecordIsClubEvent\(eventId\)/);
assert.match(targetSource, /bodEventData\.archived !== true\) throw new HttpsError\('failed-precondition'/);
for (const role of ['bod', 'admin', 'president']) assert.equal(lifecycle.canManageArchivedEvents(role), true);
for (const role of ['gbm', 'prospect', '', undefined]) assert.equal(lifecycle.canManageArchivedEvents(role), false);

// confirmText checked server-side, before any reads of the event.
assert.equal(lifecycle.PERMANENT_DELETE_CONFIRM_TEXT, 'DELETE PERMANENTLY');
assert.equal(lifecycle.isPermanentDeleteConfirmation('DELETE PERMANENTLY'), true);
for (const text of ['delete permanently', 'DELETE PERMANENTLY ', ' DELETE PERMANENTLY', 'DELETE', '', null, undefined]) {
  assert.equal(lifecycle.isPermanentDeleteConfirmation(text), false, `rejects ${JSON.stringify(text)}`);
}
const confirmIndex = deleteSource.indexOf('isPermanentDeleteConfirmation(data.confirmText)');
assert.ok(confirmIndex > 0, 'delete checks confirmText');
assert.ok(confirmIndex < deleteSource.indexOf('loadArchivedBodEventTarget('), 'confirmText checked before loading the event');
assert.match(deleteSource.slice(confirmIndex, confirmIndex + 200), /'invalid-argument'/);

// archived === true precondition, re-checked inside the write transaction.
assert.match(restoreSource, /current\.archived !== true\) \{\n\s+throw new HttpsError\('failed-precondition'/);
assert.match(restoreSource, /db\.runTransaction/);
assert.match(deleteSource, /const assertStillArchived = async \(tx\) => \{\n\s+const fresh = await tx\.get\(target\.bodEventRef\);/);
assert.match(deleteSource, /\(fresh\.data\(\) \|\| \{\}\)\.archived !== true/);
assert.equal((deleteSource.match(/await assertStillArchived\(tx\);/g) || []).length, 2, 'both write modes re-check archived');

// Audit is written before any delete or field removal, in both write modes.
const singleStart = deleteSource.indexOf("if (plan.mode === 'single_batch')");
const singleBranch = deleteSource.slice(singleStart, deleteSource.indexOf('} else {', singleStart));
assert.ok(singleBranch.indexOf('tx.set(auditRef, auditDoc)') < singleBranch.indexOf('writeOps.forEach(op => op(tx))'));
const chunkedBranch = deleteSource.slice(deleteSource.indexOf('} else {', singleStart));
assert.ok(chunkedBranch.indexOf('tx.set(auditRef, auditDoc)') < chunkedBranch.indexOf('archivedEventLifecycle.chunk(writeOps'));
assert.ok(chunkedBranch.indexOf('archivedEventLifecycle.chunk(writeOps') < chunkedBranch.indexOf('completed: true'));
assert.match(deleteSource, /db\.collection\('eventDeletionAudit'\)\.doc\(\)/);
assert.match(deleteSource, /auditRef\.collection\('attendance'\)/);
assert.equal(lifecycle.SINGLE_BATCH_WRITE_LIMIT, 450);
assert.equal(lifecycle.CHUNK_WRITE_LIMIT, 400);
assert.ok(deleteSource.indexOf('...primaryDocs.map(doc => doc.ref),\n    target.bodEventRef,') > 0, 'bodEvents doc is deleted last');
assert.match(deleteSource, /return \{\n\s+ok: true,\n\s+eventId,\n\s+auditId: auditRef\.id,\n\s+removedAttendanceFields: attendance\.length,\n\s+deletedReminders: deletedReminderDocs\.length,/);

// No Drive, fines, or treasury writes. Fines are read for ids only.
for (const source of [restoreSource, deleteSource, lifecycleSource]) {
  assert.doesNotMatch(source, /google\.drive|driveService|getDrive|drive\.files|bucket\(|storage\(\)/i);
  assert.doesNotMatch(source, /collection\('treasury'\)/);
  assert.doesNotMatch(source, /collection\('fines'\)\.doc\(/);
}
assert.match(deleteSource, /db\.collection\('fines'\)\.where\('eventId', '==', id\)\.get\(\)/);
assert.doesNotMatch(restoreSource, /fines|ttendance/);

// Attendance: field removal with FieldPath only, never a doc delete.
assert.deepEqual([...lifecycle.ATTENDANCE_COLLECTIONS], ['attendance', 'bodAttendance', 'districtAttendance']);
assert.match(deleteSource, /new admin\.firestore\.FieldPath\(field\), admin\.firestore\.FieldValue\.delete\(\)/);
assert.match(deleteSource, /writer\.update\(db\.collection\(collection\)\.doc\(attendanceUid\), \.\.\.fieldRemovals\)/);
const deleteRefsBlock = deleteSource.slice(deleteSource.indexOf('const deleteRefs = ['), deleteSource.indexOf('];', deleteSource.indexOf('const deleteRefs = [')));
assert.doesNotMatch(deleteRefsBlock, /ttendance/, 'attendance refs never enter the delete list');
const attendanceDocDelete = /collection\(\s*['"`](attendance|bodAttendance|districtAttendance)['"`]\s*\)\s*\.doc\([^)]*\)\s*\.delete\(|\.delete\(\s*db\.collection\(\s*['"`](attendance|bodAttendance|districtAttendance)['"`]/;
for (const [label, source] of [['index.js', indexSource], ['archived-event-lifecycle.js', lifecycleSource]]) {
  assert.doesNotMatch(source, attendanceDocDelete, `${label} never deletes an attendance doc`);
}
assert.doesNotMatch(restoreSource, /\.delete\(/, 'restore deletes nothing');

const removals = lifecycle.findAttendanceFieldRemovals('attendance', [
  { id: 'u1', data: () => ({ evt1: 'P', evt2: 'A', createdAt: 1, updatedAt: 2 }) },
  { id: 'u2', data: () => ({ evt2: 'NA' }) },
  { id: 'u3', data: () => ({ evt1: 'NA', 'evt1.extra': 'x' }) },
], ['evt1']);
assert.deepEqual(removals, [
  { collection: 'attendance', uid: 'u1', field: 'evt1', value: 'P' },
  { collection: 'attendance', uid: 'u3', field: 'evt1', value: 'NA' },
]);

// Reminders: event reminder configs deleted, reporting windows (avenue locks) kept.
assert.equal(lifecycle.isDeletableEventReminder({ recordType: 'event_reminder_config', eventId: 'evt1' }, ['evt1']), true);
assert.equal(lifecycle.isDeletableEventReminder({ recordType: 'avenue_reporting_window', linkedTargetId: 'evt1', eventId: 'evt1' }, ['evt1']), false);
assert.equal(lifecycle.isLinkedReportingWindow({ recordType: 'avenue_reporting_window', linkedTargetId: 'evt1' }, ['evt1']), true);

// Meetings: restore reverses bodMeetings + mirror bodEvents; delete removes them.
assert.match(restoreSource, /refs\.meeting = db\.collection\('bodMeetings'\)\.doc\(target\.meetingId\)/);
assert.match(restoreSource, /refs\.mirror = db\.collection\('bodEvents'\)\.doc\(target\.meetingId\)/);
assert.match(deleteSource, /primaryRefs\.push\(db\.collection\('bodMeetings'\)\.doc\(target\.meetingId\)\)/);
assert.match(deleteSource, /collectSubcollectionDocsForDeletion/);

// statusBeforeArchive stored by both archive paths; restore falls back to 'synced'.
assert.match(archiveSource, /\.\.\.archivedEventLifecycle\.statusBeforeArchivePatch\(bodEventData\),\n\s+status: 'deleted'/);
assert.match(meetingArchiveSource, /\.\.\.archivedEventLifecycle\.statusBeforeArchivePatch\(bodEventData\),/);
assert.match(meetingArchiveSource, /\.\.\.archivedEventLifecycle\.statusBeforeArchivePatch\(mirrorData\),/);
assert.deepEqual(lifecycle.statusBeforeArchivePatch({ status: 'synced' }), { statusBeforeArchive: 'synced' });
assert.deepEqual(lifecycle.statusBeforeArchivePatch({ status: 'deleted', archived: true }), {});
assert.equal(lifecycle.restoredBodEventStatus({ statusBeforeArchive: 'synced' }), 'synced');
assert.equal(lifecycle.restoredBodEventStatus({}), 'synced');
assert.match(restoreSource, /statusBeforeArchive: remove|bodEventRestorePatch/);
assert.match(functionSource('bodEventRestorePatch'), /statusBeforeArchive: remove/);

// Prospect recalc after both actions.
assert.match(restoreSource, /await recalcAllActiveProspects\(\)/);
assert.match(deleteSource, /await recalcAllActiveProspects\(\)/);

// Rules: audit is server-written only, readable by Admin/President.
const auditRule = rulesSource.slice(rulesSource.indexOf('match /eventDeletionAudit/{auditId}'));
assert.ok(rulesSource.includes('match /eventDeletionAudit/{auditId}'));
assert.match(auditRule.slice(0, 600), /allow write: if false;[\s\S]*allow write: if false;/);
assert.match(auditRule.slice(0, 300), /allow read: if hasApprovedActiveRole\('admin'\)\n\s+\|\| hasApprovedActiveRole\('president'\)\n\s+\|\| hasPresidentAuthority\(\);/);

console.log('Archived event restore/delete verification passed.');
