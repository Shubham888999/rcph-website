#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const CONFIRMATION = 'MIGRATE-BOD-MEETINGS';
const EXPECTED_MEETING_COUNT = 2;

const MOM_FIELDS = [
  'momDriveFileId',
  'momFileName',
  'momMimeType',
  'momUploadedBy',
  'momUploadedByName',
  'momUploadedAt',
  'momUpdatedAt',
  'momReplacedBy',
  'momReplacedByName',
  'momTargetType',
  'momTargetId',
  'momPublicUrl',
  'momUrl',
  'momFileUrl',
  'minutesUrl',
];

function parseArgs(argv) {
  const args = {
    execute: false,
    confirm: '',
    projectId: '',
    help: false,
    unknown: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--execute') {
      args.execute = true;
    } else if (arg.startsWith('--confirm=')) {
      args.confirm = arg.slice('--confirm='.length);
    } else if (arg === '--project') {
      args.projectId = argv[index + 1] || '';
      index += 1;
    } else if (arg.startsWith('--project=')) {
      args.projectId = arg.slice('--project='.length);
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else {
      args.unknown.push(arg);
    }
  }

  return args;
}

function printUsage() {
  console.log([
    'Usage:',
    '  Dry run:',
    '    node functions/scripts/migrate-bod-meetings-to-bod-tools.js',
    '',
    '  Execute:',
    '    node functions/scripts/migrate-bod-meetings-to-bod-tools.js --execute --confirm=MIGRATE-BOD-MEETINGS',
    '',
    'Optional:',
    '    --project <firebase-project-id>',
    '',
    'The command defaults to dry run. Live execution requires --execute and the exact --confirm value.',
  ].join('\n'));
}

function readDefaultFirebaseProjectId() {
  try {
    const firebaseRcPath = path.resolve(__dirname, '..', '..', '.firebaserc');
    const firebaseRc = JSON.parse(fs.readFileSync(firebaseRcPath, 'utf8'));
    return String(firebaseRc?.projects?.default || '').trim();
  } catch {
    return '';
  }
}

function initializeFirebaseAdmin(projectId) {
  if (!admin.apps.length) {
    const resolvedProjectId =
      String(projectId || '').trim()
      || String(process.env.GOOGLE_CLOUD_PROJECT || '').trim()
      || String(process.env.GCLOUD_PROJECT || '').trim()
      || readDefaultFirebaseProjectId();
    admin.initializeApp(resolvedProjectId ? { projectId: resolvedProjectId } : undefined);
  }
  return admin.firestore();
}

function cleanText(value, max = 1000) {
  return String(value == null ? '' : value).trim().replace(/\s+/g, ' ').slice(0, max);
}

function timestampToMillis(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatTimestamp(value) {
  const millis = timestampToMillis(value);
  return millis ? new Date(millis).toISOString() : '';
}

function printableValue(value) {
  if (!value) return value;
  if (typeof value.toDate === 'function' || typeof value.toMillis === 'function' || value instanceof Date) {
    return formatTimestamp(value);
  }
  if (Array.isArray(value)) return value.map(printableValue);
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, printableValue(entry)]));
  }
  return value;
}

function hasValue(value) {
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function pickMomFields(data = {}, meetingId = '') {
  const mom = {};
  MOM_FIELDS.forEach((field) => {
    if (hasValue(data[field])) mom[field] = data[field];
  });
  if (Object.keys(mom).length) {
    mom.momTargetType = 'bod_meeting';
    mom.momTargetId = meetingId;
  }
  return mom;
}

function activeState(data = {}) {
  const status = cleanText(data.status, 40).toLowerCase();
  const archived = data.archived === true || status === 'deleted';
  return archived ? 'archived' : 'active';
}

function meetingSort(left, right) {
  return cleanText(left.data.date, 20).localeCompare(cleanText(right.data.date, 20))
    || cleanText(left.data.name, 180).localeCompare(cleanText(right.data.name, 180))
    || left.id.localeCompare(right.id);
}

function buildDesiredBodEvent(meeting, nowValue) {
  const data = meeting.data || {};
  const date = cleanText(data.date, 20);
  const time = cleanText(data.time || data.eventTime, 20);
  const desc = cleanText(data.desc || data.description, 1200);
  const archived = activeState(data) === 'archived';
  return {
    name: cleanText(data.name, 180),
    date,
    endDate: cleanText(data.endDate || date, 20) || date,
    eventStart: date,
    eventEnd: cleanText(data.endDate || date, 20) || date,
    time,
    eventTime: time,
    desc,
    description: desc,
    avenue: ['BOD'],
    avenues: ['BOD'],
    type: 'bodMeeting',
    source: cleanText(data.source, 80) || 'adminBodAttendance',
    visibility: 'internal',
    status: archived ? 'deleted' : 'synced',
    syncedMeetingId: meeting.id,
    bodMeetingId: meeting.id,
    reportingWindowId: cleanText(data.reportingWindowId || data.reminderId, 160),
    archived,
    createdBy: cleanText(data.createdBy, 160),
    createdAt: data.createdAt || nowValue,
    updatedAt: nowValue,
    ...pickMomFields(data, meeting.id),
  };
}

function valuesEqual(left, right) {
  if (Array.isArray(left) || Array.isArray(right)) {
    return JSON.stringify(left || []) === JSON.stringify(right || []);
  }
  if (typeof left?.isEqual === 'function') return left.isEqual(right);
  return (left || '') === (right || '');
}

function plannedPatch(desired, existing = null) {
  if (!existing) return { ...desired };
  const patch = {};
  Object.entries(desired).forEach(([field, value]) => {
    if (field === 'updatedAt') return;
    if (field.startsWith('mom') && !hasValue(value)) return;
    if (!hasValue(existing[field]) && hasValue(value)) {
      patch[field] = value;
    }
  });
  if (Object.keys(patch).length) patch.updatedAt = desired.updatedAt;
  return patch;
}

function detectConflicts(meeting, target, linkedDocs) {
  const conflicts = [];
  if (linkedDocs.length > 1) {
    conflicts.push(`multiple linked bodEvents records: ${linkedDocs.map((doc) => doc.id).join(', ')}`);
  }
  if (target) {
    const type = cleanText(target.type, 40);
    if (type && type !== 'bodMeeting') conflicts.push(`target bodEvents/${meeting.id} has type ${type}`);
    for (const field of ['name', 'date', 'time']) {
      const meetingValue = cleanText(meeting.data[field] || (field === 'time' ? meeting.data.eventTime : ''), field === 'name' ? 180 : 20);
      const targetValue = cleanText(target[field] || (field === 'time' ? target.eventTime : ''), field === 'name' ? 180 : 20);
      if (meetingValue && targetValue && meetingValue !== targetValue) {
        conflicts.push(`target ${field} differs (${targetValue} != ${meetingValue})`);
      }
    }
    const linkedMeetingId = cleanText(target.syncedMeetingId || target.bodMeetingId, 160);
    if (linkedMeetingId && linkedMeetingId !== meeting.id) {
      conflicts.push(`target links to different meeting ${linkedMeetingId}`);
    }
  }
  return conflicts;
}

function attendanceRecordCount(attendanceDocs, meetingId) {
  return attendanceDocs.reduce((count, doc) => (
    Object.prototype.hasOwnProperty.call(doc.data || {}, meetingId) ? count + 1 : count
  ), 0);
}

function printMeetingPlan(plan, index) {
  console.log(`Meeting ${index + 1}:`);
  console.log(JSON.stringify({
    meetingId: plan.meeting.id,
    name: cleanText(plan.meeting.data.name, 180),
    date: cleanText(plan.meeting.data.date, 20),
    time: cleanText(plan.meeting.data.time || plan.meeting.data.eventTime, 20),
    state: activeState(plan.meeting.data),
    momFields: printableValue(plan.momFields),
    attendanceRecordCount: plan.attendanceRecordCount,
    linkedBodToolsEntryExists: plan.linkedBodToolsEntryExists,
    linkedBodToolsEntryIds: plan.linkedBodToolsEntryIds,
    plannedTargetBodToolsDocId: plan.meeting.id,
    fieldsToWrite: printableValue(plan.fieldsToWrite),
    fieldsUnchanged: plan.fieldsUnchanged,
    conflicts: plan.conflicts,
    action: plan.action,
  }, null, 2));
}

async function loadSnapshotDocs(db, collectionName) {
  const snapshot = await db.collection(collectionName).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }
  if (args.unknown.length) {
    console.error(`Unknown argument(s): ${args.unknown.join(', ')}`);
    printUsage();
    process.exitCode = 1;
    return;
  }
  if (args.execute && args.confirm !== CONFIRMATION) {
    console.error(`Execution requires --confirm=${CONFIRMATION}. No changes were made.`);
    process.exitCode = 1;
    return;
  }

  const dryRun = !args.execute;
  const db = initializeFirebaseAdmin(args.projectId);
  const [meetings, bodEvents, bodAttendance] = await Promise.all([
    loadSnapshotDocs(db, 'bodMeetings'),
    loadSnapshotDocs(db, 'bodEvents'),
    loadSnapshotDocs(db, 'bodAttendance'),
  ]);
  const sortedMeetings = meetings.sort(meetingSort);
  const bodEventById = new Map(bodEvents.map((doc) => [doc.id, doc.data]));
  const linkedByMeetingId = new Map();
  bodEvents.forEach((doc) => {
    const linkedIds = [doc.id, doc.data.syncedMeetingId, doc.data.bodMeetingId].map((value) => cleanText(value, 160)).filter(Boolean);
    linkedIds.forEach((linkedId) => {
      if (!linkedByMeetingId.has(linkedId)) linkedByMeetingId.set(linkedId, []);
      const records = linkedByMeetingId.get(linkedId);
      if (!records.some((record) => record.id === doc.id)) records.push(doc);
    });
  });

  console.log(dryRun ? 'DRY RUN: no Firestore writes will be performed.' : 'EXECUTE MODE: Firestore bodEvents records may be created or updated.');
  if (sortedMeetings.length !== EXPECTED_MEETING_COUNT) {
    console.log(`Expected ${EXPECTED_MEETING_COUNT} existing BOD meetings; found ${sortedMeetings.length}. Continuing with all inspected meetings.`);
  } else {
    console.log(`Expected ${EXPECTED_MEETING_COUNT} existing BOD meetings found.`);
  }
  console.log('');

  const summary = {
    meetingsInspected: sortedMeetings.length,
    alreadyLinked: 0,
    bodToolsRecordsCreatedOrUpdated: 0,
    plannedBodToolsRecordsCreatedOrUpdated: 0,
    momLinksPreserved: 0,
    attendanceRecordsVerifiedUnchanged: 0,
    skipped: 0,
    conflicts: 0,
    failures: 0,
  };

  const nowValue = dryRun ? '[serverTimestamp]' : admin.firestore.FieldValue.serverTimestamp();
  const plans = sortedMeetings.map((meeting) => {
    const linkedDocs = linkedByMeetingId.get(meeting.id) || [];
    const target = bodEventById.get(meeting.id) || null;
    const desired = buildDesiredBodEvent(meeting, nowValue);
    const fieldsToWrite = plannedPatch(desired, target);
    const conflicts = detectConflicts(meeting, target, linkedDocs);
    const momFields = pickMomFields(meeting.data, meeting.id);
    const count = attendanceRecordCount(bodAttendance, meeting.id);
    const linkedBodToolsEntryExists = Boolean(target || linkedDocs.length);
    const action = conflicts.length
      ? 'skip-conflict'
      : Object.keys(fieldsToWrite).length
        ? target
          ? 'update'
          : 'create'
        : 'already-linked';
    return {
      meeting,
      fieldsToWrite,
      fieldsUnchanged: ['bodMeetings document fields', 'bodAttendance attendance fields', 'Google Drive files'],
      conflicts,
      momFields,
      attendanceRecordCount: count,
      linkedBodToolsEntryExists,
      linkedBodToolsEntryIds: linkedDocs.map((doc) => doc.id),
      action,
    };
  });

  plans.forEach((plan, index) => {
    if (plan.linkedBodToolsEntryExists) summary.alreadyLinked += 1;
    if (Object.keys(plan.momFields).length) summary.momLinksPreserved += 1;
    summary.attendanceRecordsVerifiedUnchanged += plan.attendanceRecordCount;
    if (plan.conflicts.length) summary.conflicts += 1;
    if (plan.action === 'update' || plan.action === 'create') summary.plannedBodToolsRecordsCreatedOrUpdated += 1;
    if (plan.action === 'already-linked' || plan.action === 'skip-conflict') summary.skipped += 1;
    printMeetingPlan(plan, index);
  });

  if (!dryRun) {
    for (const plan of plans) {
      if (plan.conflicts.length) {
        continue;
      }
      if (!Object.keys(plan.fieldsToWrite).length) continue;
      try {
        await db.collection('bodEvents').doc(plan.meeting.id).set(plan.fieldsToWrite, { merge: true });
        summary.bodToolsRecordsCreatedOrUpdated += 1;
      } catch (error) {
        summary.failures += 1;
        console.error(`Failed to write bodEvents/${plan.meeting.id}: ${error?.message || error}`);
      }
    }
  }

  console.log('');
  console.log('Summary');
  console.log(`meetings inspected: ${summary.meetingsInspected}`);
  console.log(`already linked: ${summary.alreadyLinked}`);
  console.log(`BOD Tools records created/updated: ${summary.bodToolsRecordsCreatedOrUpdated}`);
  if (dryRun) console.log(`planned BOD Tools records created/updated: ${summary.plannedBodToolsRecordsCreatedOrUpdated}`);
  console.log(`MOM links preserved: ${summary.momLinksPreserved}`);
  console.log(`attendance records verified unchanged: ${summary.attendanceRecordsVerifiedUnchanged}`);
  console.log(`skipped: ${summary.skipped}`);
  console.log(`conflicts: ${summary.conflicts}`);
  console.log(`failures: ${summary.failures}`);
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});
