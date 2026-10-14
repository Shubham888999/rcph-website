'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const lifecycle = require('./archived-event-lifecycle');

test('statusBeforeArchivePatch keeps the original status across repeat archives', () => {
  assert.deepEqual(lifecycle.statusBeforeArchivePatch({ status: 'synced' }), { statusBeforeArchive: 'synced' });
  assert.deepEqual(lifecycle.statusBeforeArchivePatch({ status: 'synced', archived: true }), {});
  assert.deepEqual(lifecycle.statusBeforeArchivePatch({ status: 'deleted' }), {});
  assert.deepEqual(lifecycle.statusBeforeArchivePatch({}), {});
});

test('restoredBodEventStatus prefers statusBeforeArchive and falls back to synced', () => {
  assert.equal(lifecycle.restoredBodEventStatus({ statusBeforeArchive: 'active' }), 'active');
  assert.equal(lifecycle.restoredBodEventStatus({ statusBeforeArchive: 'deleted' }), 'synced');
  assert.equal(lifecycle.restoredBodEventStatus({ status: 'deleted' }), 'synced');
});

test('attendance removals match exact field names and group per doc', () => {
  const docs = [
    { id: 'u1', data: () => ({ evt: 'P', meet: 'A', other: 'P', updatedAt: 1 }) },
    { id: 'u2', data: () => ({ other: 'P' }) },
  ];
  const removals = lifecycle.findAttendanceFieldRemovals('bodAttendance', docs, ['evt', 'meet', 'evt']);
  assert.deepEqual(removals.map(entry => `${entry.uid}:${entry.field}:${entry.value}`), ['u1:evt:P', 'u1:meet:A']);
  assert.deepEqual(lifecycle.groupAttendanceRemovalsByDoc(removals), [
    { collection: 'bodAttendance', uid: 'u1', fields: ['evt', 'meet'] },
  ]);
});

test('reminder classification deletes event configs and keeps reporting windows', () => {
  assert.equal(lifecycle.isDeletableEventReminder({ recordType: 'event_reminder_config', targetId: 'evt' }, ['evt']), true);
  assert.equal(lifecycle.isDeletableEventReminder({ recordType: 'event_reminder_config', targetId: 'x' }, ['evt']), false);
  assert.equal(lifecycle.isDeletableEventReminder({ recordType: 'avenue_reporting_window', eventId: 'evt' }, ['evt']), false);
  assert.equal(lifecycle.isLinkedReportingWindow({ recordType: 'avenue_reporting_window', linkedBodEventId: 'evt' }, ['evt']), true);
  assert.equal(lifecycle.isLinkedReportingWindow({ recordType: 'event_reminder_config', linkedBodEventId: 'evt' }, ['evt']), false);
});

test('collectEventReferences records Drive and storage references only', () => {
  const references = lifecycle.collectEventReferences(
    { driveFolderId: 'folder1', driveLinks: [], imageLinks: ['https://x'], reportImagePath: 'bod/evt/a.jpg', name: 'Event' },
    { driveFolderId: 'ignored-second', attachmentPath: 'bodEvents/evt/attachments/f1' },
  );
  assert.deepEqual(references, {
    driveFolderId: 'folder1',
    imageLinks: ['https://x'],
    storagePaths: ['bod/evt/a.jpg', 'bodEvents/evt/attachments/f1'],
  });
});

test('planPermanentDelete picks one atomic batch up to 450 writes, else chunked', () => {
  const small = lifecycle.planPermanentDelete({ auditBase: {}, attendance: [], relatedDocs: [], deleteDocCount: 3, attendanceDocCount: 446 });
  assert.equal(small.totalWrites, 450);
  assert.equal(small.mode, 'single_batch');
  const large = lifecycle.planPermanentDelete({ auditBase: {}, attendance: [], relatedDocs: [], deleteDocCount: 4, attendanceDocCount: 446 });
  assert.equal(large.mode, 'chunked');
});

test('planPermanentDelete moves attendance to a subcollection when the audit is too large', () => {
  const attendance = Array.from({ length: 2000 }, (_, index) => ({
    collection: 'attendance', uid: `uid-${index}`, field: 'evt', value: 'x'.repeat(500),
  }));
  const plan = lifecycle.planPermanentDelete({ auditBase: { eventId: 'evt' }, attendance, relatedDocs: [], deleteDocCount: 2, attendanceDocCount: 2000 });
  assert.equal(plan.attendanceInline, false);
  assert.equal(plan.relatedDocsInline, true);
  assert.equal(plan.auditSubcollectionWrites, 2000);
  assert.equal(plan.mode, 'chunked');
});

test('chunk splits writes into groups of at most 400', () => {
  const groups = lifecycle.chunk(Array.from({ length: 801 }, (_, index) => index));
  assert.deepEqual(groups.map(group => group.length), [400, 400, 1]);
});
