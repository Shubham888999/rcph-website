#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const positionHelpers = require('../lib/positions');
const {
  createFirestoreVisitSubmissionAdapter,
  createVisitSubmissionService,
} = require('../lib/visit-submissions');
const {
  createGoogleDriveClient,
} = require('../lib/visit-drive');

const ACTOR_UID = 'woOIJsv1Z4Tby4A4vK5NOjEfMnv1';
const CONFIRMATION = 'Master-Budget-RIY-26-27';
const REMOVAL_REASON =
  'Cleanup of accidental bulk upload: Master Budget RIY 26-27.pdf';

const TARGET = Object.freeze({
  fileName: 'Master Budget RIY 26-27.pdf',
  visitType: 'clubAssembly',
  uploadedByUid: ACTOR_UID,
  status: 'active',
});

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
    '    node functions/scripts/cleanup-master-budget-visit-submissions.js',
    '',
    '  Execute:',
    '    node functions/scripts/cleanup-master-budget-visit-submissions.js --execute --confirm=Master-Budget-RIY-26-27',
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

function normalizeText(value, max = 1000) {
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

function describeError(err) {
  const code = normalizeText(err?.httpsCode || err?.code || err?.status || 'error', 80);
  const message = normalizeText(err?.message || String(err), 500);
  return `${code}: ${message}`;
}

function toPrintableSubmission(doc) {
  const data = doc.data || {};
  return {
    submissionId: doc.submissionId || doc.id,
    positionKey: normalizeText(data.positionKey, 80),
    positionTitle: normalizeText(data.positionTitle, 180),
fileName: normalizeText(data.fileName, 255),
originalFileName: normalizeText(data.originalFileName, 255),
internalTrackingName: normalizeText(data.internalTrackingName, 255),
    driveFileId: normalizeText(data.driveFileId, 256),
    driveFileUrl: normalizeText(data.driveFileUrl, 1000),
    createdAt: formatTimestamp(data.createdAt),
    status: normalizeText(data.status, 40),
  };
}

function printSubmissions(records) {
  if (!records.length) {
    console.log('No matching active visit submissions found.');
    return;
  }

  records.forEach((record, index) => {
    console.log(`Match ${index + 1}:`);
    console.log(JSON.stringify(toPrintableSubmission(record), null, 2));
  });
}

function printSummary(summary) {
  console.log('');
  console.log('Summary');
  console.log(`matched: ${summary.matched}`);
  console.log(`removed: ${summary.removed}`);
  console.log(`Drive files trashed: ${summary.driveFilesTrashed}`);
  console.log(`skipped: ${summary.skipped}`);
  console.log(`failed Firestore removals: ${summary.failedFirestoreRemovals}`);
  console.log(`failed Drive trash operations: ${summary.failedDriveTrashOperations}`);
}

function isTargetActiveSubmission(data) {
  if (!data) return false;

  const fileName = normalizeText(data.fileName, 255);
  const originalFileName = normalizeText(data.originalFileName, 255);

  const matchesFileName =
    fileName === TARGET.fileName
    || originalFileName === TARGET.fileName;

  return Boolean(
    matchesFileName
    && data.visitType === TARGET.visitType
    && data.uploadedByUid === TARGET.uploadedByUid
    && data.status === TARGET.status
  );
}

function sortRecords(left, right) {
  const leftData = left.data || {};
  const rightData = right.data || {};
  return (
    normalizeText(leftData.positionKey, 80).localeCompare(normalizeText(rightData.positionKey, 80))
    || normalizeText(leftData.positionTitle, 180).localeCompare(normalizeText(rightData.positionTitle, 180))
    || (timestampToMillis(leftData.createdAt) - timestampToMillis(rightData.createdAt))
    || left.id.localeCompare(right.id)
  );
}

async function findMatchingSubmissions(db) {
  const queryByFileField = (fieldName) => (
    db.collection('visitSubmissions')
      .where(fieldName, '==', TARGET.fileName)
      .where('visitType', '==', TARGET.visitType)
      .where('uploadedByUid', '==', TARGET.uploadedByUid)
      .where('status', '==', TARGET.status)
  );

  const [originalFileNameSnapshot, fileNameSnapshot] =
    await Promise.all([
      queryByFileField('originalFileName').get(),
      queryByFileField('fileName').get(),
    ]);

  const documentsById = new Map();

  [
    ...originalFileNameSnapshot.docs,
    ...fileNameSnapshot.docs,
  ].forEach((doc) => {
    documentsById.set(doc.id, doc);
  });

  const rawRecords = Array.from(documentsById.values())
    .map((doc) => {
      const data = doc.data() || {};

      return {
        id: doc.id,
        submissionId: normalizeText(
          data.submissionId || doc.id,
          160
        ),
        data,
      };
    })
    .filter((record) => isTargetActiveSubmission(record.data))
    .sort(sortRecords);

  const records = [];
  const seenSubmissionIds = new Set();
  let duplicateCount = 0;

  for (const record of rawRecords) {
    if (seenSubmissionIds.has(record.submissionId)) {
      duplicateCount += 1;
      continue;
    }

    seenSubmissionIds.add(record.submissionId);
    records.push(record);
  }

  return {
    matched: rawRecords.length,
    records,
    duplicateCount,
  };
}
function createDriveClientForTrash() {
  const authMode = normalizeText(process.env.VISIT_DRIVE_AUTH_MODE, 40).toLowerCase();
  return createGoogleDriveClient(authMode ? { config: { authMode } } : {});
}

async function trashDriveFile(drive, driveFileId) {
  await drive.files.update({
    fileId: driveFileId,
    supportsAllDrives: true,
    requestBody: {
      trashed: true,
    },
  });
}

async function executeCleanup({ db, records }) {
  const summary = {
    matched: records.matched,
    removed: 0,
    driveFilesTrashed: 0,
    skipped: records.duplicateCount,
    failedFirestoreRemovals: 0,
    failedDriveTrashOperations: 0,
  };

  const adapter = createFirestoreVisitSubmissionAdapter(db, admin);
  const service = createVisitSubmissionService({
    adapter,
    positionHelpers,
  });

  let drive;
  try {
    drive = createDriveClientForTrash();
  } catch (err) {
    console.error(`Refusing to execute because the Visit Drive client could not be created: ${describeError(err)}`);
    console.error('No Firestore or Drive changes were made.');
    printSummary(summary);
    process.exitCode = 1;
    return;
  }

  for (const record of records.records) {
    const freshSnap = await db.collection('visitSubmissions').doc(record.id).get();
    const freshData = freshSnap.exists ? (freshSnap.data() || {}) : null;
    if (!freshSnap.exists || !isTargetActiveSubmission(freshData)) {
      summary.skipped += 1;
      console.log(`[skipped] ${record.submissionId}: no longer active or no longer matches the exact cleanup target.`);
      continue;
    }

    const driveFileId = normalizeText(freshData.driveFileId, 256);

    try {
      await service.removeSubmission(ACTOR_UID, {
        submissionId: record.submissionId,
        reason: REMOVAL_REASON,
      });
      summary.removed += 1;
      console.log(`[removed] ${record.submissionId}: Firestore status changed through Visit Submission service.`);
    } catch (err) {
      summary.failedFirestoreRemovals += 1;
      console.error(`[firestore-failed] submissionId=${record.submissionId} ${describeError(err)}`);
      continue;
    }

    if (!driveFileId) {
      summary.failedDriveTrashOperations += 1;
      console.error(`[drive-failed] submissionId=${record.submissionId} driveFileId missing; manual Drive cleanup required.`);
      continue;
    }

    try {
      await trashDriveFile(drive, driveFileId);
      summary.driveFilesTrashed += 1;
      console.log(`[drive-trashed] submissionId=${record.submissionId} driveFileId=${driveFileId}`);
    } catch (err) {
      summary.failedDriveTrashOperations += 1;
      console.error(`[drive-failed] submissionId=${record.submissionId} driveFileId=${driveFileId} ${describeError(err)}`);
    }
  }

  printSummary(summary);
  if (summary.failedFirestoreRemovals || summary.failedDriveTrashOperations) {
    process.exitCode = 1;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }
  if (args.unknown.length) {
    console.error(`Unknown arguments: ${args.unknown.join(', ')}`);
    printUsage();
    process.exitCode = 1;
    return;
  }
  if (args.execute && args.confirm !== CONFIRMATION) {
    console.error(`Refusing to execute without exact confirmation: --confirm=${CONFIRMATION}`);
    console.error('No Firestore or Drive changes were made.');
    printUsage();
    process.exitCode = 1;
    return;
  }

  console.log(args.execute
    ? 'LIVE VISIT SUBMISSION CLEANUP'
    : 'DRY RUN - no Firestore writes or Drive operations will occur.');
  console.log(`Target filename: ${TARGET.fileName}`);
  console.log(`Target visitType: ${TARGET.visitType}`);
  console.log(`Target uploadedByUid: ${TARGET.uploadedByUid}`);
  console.log(`Target status: ${TARGET.status}`);
  console.log('');

  const db = initializeFirebaseAdmin(args.projectId);
  const records = await findMatchingSubmissions(db);
  printSubmissions(records.records);
  console.log(`Total matching records: ${records.matched}`);
  if (records.duplicateCount) {
    console.log(`Duplicate submission IDs skipped: ${records.duplicateCount}`);
  }

  if (!args.execute) {
    printSummary({
      matched: records.matched,
      removed: 0,
      driveFilesTrashed: 0,
      skipped: records.duplicateCount,
      failedFirestoreRemovals: 0,
      failedDriveTrashOperations: 0,
    });
    return;
  }

  await executeCleanup({ db, records });
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err && err.stack ? err.stack : err);
    process.exitCode = 1;
  });
}

module.exports = {
  TARGET,
  ACTOR_UID,
  CONFIRMATION,
  REMOVAL_REASON,
  parseArgs,
  isTargetActiveSubmission,
  toPrintableSubmission,
};
