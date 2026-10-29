#!/usr/bin/env node
'use strict';

// Read-only: compare completed/pending website replacements with downloaded Drive
// bytes. Never uploads, updates, trashes, pins revisions or changes website data.
const { readDriveBinaryDigest, driveFileIdFromUrl } = require('../lib/visit-file-actions');

function millis(value) {
  return typeof value?.toMillis === 'function' ? value.toMillis() : Number(value) || 0;
}
function latestReplacements(rows, name, limit = 3) {
  const selected = new Map();
  rows.filter(row => row.data.action === 'replace' && (row.data.fileName === name || row.data.replacement?.fileName === name))
    .sort((a, b) => millis(b.data.completedAt || b.data.updatedAt || b.data.createdAt) - millis(a.data.completedAt || a.data.updatedAt || a.data.createdAt))
    .forEach(row => { if (!selected.has(row.data.driveFileId)) selected.set(row.data.driveFileId, row); });
  return [...selected.values()].slice(0, limit);
}
async function inspectReplacement({ operation, drive, loadSubmission }) {
  const source = await loadSubmission(operation.submissionId);
  const file = (await drive.files.get({ fileId: operation.driveFileId, supportsAllDrives: true, fields: 'id,name,size,mimeType,trashed,modifiedTime,headRevisionId,webContentLink,webViewLink' })).data;
  const actual = file.trashed ? null : await readDriveBinaryDigest(drive, operation.driveFileId);
  const expected = operation.replacement;
  const expectedName = expected?.fileName || operation.fileName;
  const linkedId = driveFileIdFromUrl(source?.fileUrl || source?.driveFileUrl);
  return {
    submissionId: operation.submissionId,
    visit: operation.visitType,
    position: operation.positionKey,
    operationState: operation.state,
    operationStage: operation.stage,
    websiteStatus: source?.status || 'missing',
    driveFileId: file.id,
    websiteDriveFileId: source?.driveFileId || '',
    driveName: file.name,
    expectedFileName: expectedName,
    websiteFileName: source?.originalFileName || source?.fileName || '',
    driveNameMatchesReplacement: file.name === expectedName,
    driveModifiedAt: file.modifiedTime || '',
    trashed: Boolean(file.trashed),
    expectedSizeBytes: expected?.sizeBytes || null,
    downloadedSizeBytes: actual?.sizeBytes ?? null,
    expectedSha256: expected?.sha256 || '',
    downloadedSha256: actual?.sha256 || '',
    downloadedContentsMatchReplacement: Boolean(actual && expected && actual.sha256 === expected.sha256 && actual.sizeBytes === expected.sizeBytes),
    websiteRecordMatchesReplacement: Boolean(source && expected && source.driveFileId === operation.driveFileId && (source.originalFileName || source.fileName) === expectedName && source.contentSha256 === expected.sha256 && Number(source.sizeBytes) === expected.sizeBytes),
    websiteLinkMatchesDriveFile: linkedId ? linkedId === operation.driveFileId : null,
    openActualFile: file.webViewLink || `https://drive.google.com/file/d/${encodeURIComponent(file.id)}/view`,
    downloadActualFile: file.webContentLink || '',
  };
}
async function main(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--load-project-secrets') args.loadSecrets = true;
    else if (['--project', '--name'].includes(argv[i]) && argv[i + 1]) {
      const key = argv[i].slice(2);
      args[key] = argv[++i];
    }
    else throw new Error('Use --project <project-id> --name <exact-file-name> --load-project-secrets.');
  }
  if (!/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(args.project || '') || !args.name || !args.loadSecrets) throw new Error('Use --project <project-id> --name <exact-file-name> --load-project-secrets.');
  const admin = require('firebase-admin');
  const { google } = require('googleapis');
  const { createGoogleDriveClient } = require('../lib/visit-drive');
  const { loadProjectDriveSecrets } = require('./replace-visit-file');
  admin.initializeApp({ projectId: args.project });
  try {
    const auth = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
    const secrets = google.secretmanager({ version: 'v1', auth });
    const values = await loadProjectDriveSecrets({ projectId: args.project, accessSecret: name => secrets.projects.secrets.versions.access({ name }) });
    const drive = createGoogleDriveClient({ config: { authMode: 'oauth' }, getSecret: name => values[name] });
    const db = admin.firestore();
    const snapshot = await db.collection('visitSubmissionFileOperations').where('action', '==', 'replace').get();
    const rows = latestReplacements(snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() })), args.name);
    const reports = [];
    for (const row of rows) {
      reports.push(await inspectReplacement({ operation: row.data, drive, loadSubmission: async id => {
        const snap = await db.collection('visitSubmissions').doc(id).get();
        return snap.exists ? snap.data() : null;
      } }));
    }
    console.log(JSON.stringify({ readOnly: true, matchingFiles: reports.length, files: reports }, null, 2));
  } finally { await admin.app().delete(); }
}
module.exports = { latestReplacements, inspectReplacement };
if (require.main === module) main(process.argv.slice(2)).catch(error => {
  console.error(`Read-only file inspection failed (${error?.code || error?.name || 'error'}). No files or records were changed.`);
  process.exitCode = 1;
});
