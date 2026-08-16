'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const indexSource = readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
const migrationSource = readFileSync(path.join(__dirname, '..', 'scripts', 'migrate-bod-meetings-to-bod-tools.js'), 'utf8');

function callableSource(name) {
  const start = indexSource.indexOf(`exports.${name} = onCall`);
  const next = indexSource.indexOf('\nexports.', start + 1);
  assert.notEqual(start, -1);
  return indexSource.slice(start, next === -1 ? indexSource.length : next);
}

function functionSource(name) {
  const start = indexSource.indexOf(`function ${name}`);
  const next = indexSource.indexOf('\nfunction ', start + 1);
  const nextAsync = indexSource.indexOf('\nasync function ', start + 1);
  const candidates = [next, nextAsync].filter((index) => index > start);
  assert.notEqual(start, -1);
  return indexSource.slice(start, candidates.length ? Math.min(...candidates) : indexSource.length);
}

test('BOD Tools submit route accepts only BOD meeting avenue before club event validation', () => {
  const submitSource = callableSource('submitBodEvent');

  assert.match(indexSource, /function normalizeBodToolsMeetingPayload/);
  assert.match(indexSource, /requestedType === 'bodMeeting' \|\| rawAvenues\.includes\('BOD'\)/);
  assert.match(indexSource, /Board of Directors meetings must use only the BOD avenue/);
  assert.match(submitSource, /const bodMeetingPayload = normalizeBodToolsMeetingPayload\(data\)/);
  assert.match(submitSource, /stableBodToolsMeetingId\(data, bodMeetingPayload\)/);
  assert.match(submitSource, /saveBodToolsMeetingFromBodEventCallable/);
  assert.match(submitSource, /normalizeBodEventPayload\(data, \{/);
});

test('BOD Tools meeting sync keeps bodMeetings as canonical attendance identity', () => {
  const saveSource = functionSource('saveBodToolsMeetingFromBodEventCallable');
  const writeSource = indexSource.slice(indexSource.indexOf('async function writeBodMeetingSynced'), indexSource.indexOf('async function writeDistrictEventSynced'));

  assert.match(writeSource, /db\.collection\('bodMeetings'\)\.doc\(meetingId\)/);
  assert.match(writeSource, /db\.collection\('bodEvents'\)\.doc\(meetingId\)/);
  assert.match(writeSource, /syncedMeetingId: meetingId/);
  assert.match(writeSource, /bodMeetingId: meetingId/);
  assert.match(writeSource, /avenues: payload\.avenues \|\| payload\.avenue/);
  assert.match(writeSource, /eventTime: time/);
  assert.match(saveSource, /initializeAttendanceFieldForCollection\('bodMembers', 'bodAttendance', meetingId, now\)/);
  assert.match(saveSource, /targetType: 'bod_meeting'/);
  assert.match(saveSource, /eventId: meetingId/);
  assert.doesNotMatch(saveSource, /recalcAllActiveProspects/);
});

test('BOD Tools update and archive routes preserve attendance and soft-delete only', () => {
  const updateSource = callableSource('updateBodEvent');
  const archiveSource = callableSource('archiveBodEvent');
  const archiveHelperSource = functionSource('archiveBodToolsMeetingFromBodEventCallable');

  assert.match(updateSource, /bodEventRecordIsBodMeeting\(bodEventData\)/);
  assert.match(updateSource, /source: 'updateBodEvent'/);
  assert.match(archiveSource, /archiveBodToolsMeetingFromBodEventCallable/);
  assert.match(archiveHelperSource, /db\.collection\('bodMeetings'\)\.doc\(meetingId\)/);
  assert.match(archiveHelperSource, /db\.collection\('bodEvents'\)\.doc\(eventId\)/);
  assert.match(archiveHelperSource, /archived: true/);
  assert.match(archiveHelperSource, /status: 'deleted'/);
  assert.doesNotMatch(archiveHelperSource, /\.delete\(/);
  assert.doesNotMatch(archiveHelperSource, /bodAttendance/);
});

test('BOD meeting MOM metadata is preserved when mirrored into BOD Tools', () => {
  assert.match(indexSource, /const BOD_MEETING_MOM_FIELDS = \[/);
  assert.match(indexSource, /'momDriveFileId'/);
  assert.match(indexSource, /'momFileName'/);
  assert.match(indexSource, /'momUploadedAt'/);
  assert.match(indexSource, /preservedBodMeetingMomPatch\(meetingId, existingBodEvent, existingMeeting\)/);
  assert.match(indexSource, /momTargetType: 'bod_meeting'/);
  assert.match(indexSource, /\.\.\.momPatch/);
});

test('BOD meeting migration script is dry-run first, deterministic, and Firestore-only', () => {
  assert.match(migrationSource, /const CONFIRMATION = 'MIGRATE-BOD-MEETINGS'/);
  assert.match(migrationSource, /const dryRun = !args\.execute/);
  assert.match(migrationSource, /Execution requires --confirm=\$\{CONFIRMATION\}/);
  assert.match(migrationSource, /plannedTargetBodToolsDocId: plan\.meeting\.id/);
  assert.match(migrationSource, /db\.collection\('bodEvents'\)\.doc\(plan\.meeting\.id\)\.set/);
  assert.match(migrationSource, /loadSnapshotDocs\(db, 'bodAttendance'\)/);
  assert.match(migrationSource, /attendance records verified unchanged/);
  assert.doesNotMatch(migrationSource, /drive\.files|googleapis|Drive cleanup|trash/i);
  assert.doesNotMatch(migrationSource, /\.delete\(/);
});
