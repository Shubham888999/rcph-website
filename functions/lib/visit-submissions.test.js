'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  resolveAccessContextFromRecords,
} = require('./visit-submissions');

function assignment(uid, positionKey, overrides = {}) {
  return {
    uid,
    positionKey,
    active: true,
    endedAt: null,
    endedBy: null,
    endReason: null,
    ...overrides,
  };
}

function records({
  uid,
  role = 'bod',
  identityPositionKeys = [],
  assignments = [],
}) {
  return {
    user: {
      uid,
      role,
      status: 'approved',
      active: true,
      positionKeys: identityPositionKeys,
    },

    role: {
      role,
      status: 'approved',
      active: true,
    },

    bodMember: {
      userId: uid,
      active: true,
      positionKeys: identityPositionKeys,
    },

    activePositionAssignments: assignments,
  };
}

test('active SAA assignment grants full Visit manager authority', () => {
  const uid = 'active-saa';

  const access = resolveAccessContextFromRecords(
    uid,
    records({
      uid,
      identityPositionKeys: [],
      assignments: [
        assignment(uid, 'saa'),
      ],
    })
  );

  assert.equal(access.canAccessVisitSystem, true);
  assert.equal(access.canManageVisitSystem, true);
  assert.equal(
    access.authority.hasSergeantAtArmsPosition,
    true
  );
});

test('active Co-SAA assignment grants full Visit manager authority', () => {
  const uid = 'active-co-saa';

  const access = resolveAccessContextFromRecords(
    uid,
    records({
      uid,
      identityPositionKeys: [],
      assignments: [
        assignment(uid, 'co-saa'),
      ],
    })
  );

  assert.equal(access.canAccessVisitSystem, true);
  assert.equal(access.canManageVisitSystem, true);
  assert.equal(
    access.authority.hasSergeantAtArmsPosition,
    true
  );
});

test('stale SAA identity position without assignment does not grant Visit authority', () => {
  const uid = 'stale-saa';

  assert.throws(
    () => resolveAccessContextFromRecords(
      uid,
      records({
        uid,
        identityPositionKeys: ['saa'],
        assignments: [],
      })
    ),
    (err) => err?.code === 'permission-denied'
  );
});

test('ended SAA assignment does not grant Visit authority', () => {
  const uid = 'ended-saa';

  assert.throws(
    () => resolveAccessContextFromRecords(
      uid,
      records({
        uid,
        identityPositionKeys: ['saa'],
        assignments: [
          assignment(uid, 'saa', {
            endedAt: new Date(
              '2026-09-01T00:00:00.000Z'
            ),
          }),
        ],
      })
    ),
    (err) => err?.code === 'permission-denied'
  );
});

test('ordinary BOD assignment gets Visit access but not manager authority', () => {
  const uid = 'ordinary-bod';

  const access = resolveAccessContextFromRecords(
    uid,
    records({
      uid,
      identityPositionKeys: ['csd'],
      assignments: [
        assignment(uid, 'csd'),
      ],
    })
  );

  assert.equal(access.canAccessVisitSystem, true);
  assert.equal(access.canManageVisitSystem, false);
  assert.equal(
    access.authority.hasSergeantAtArmsPosition,
    false
  );
});

test('stored Admin remains Visit manager without an SAA assignment', () => {
  const uid = 'ordinary-admin';

  const access = resolveAccessContextFromRecords(
    uid,
    records({
      uid,
      role: 'admin',
      identityPositionKeys: [],
      assignments: [],
    })
  );

  assert.equal(access.canAccessVisitSystem, true);
  assert.equal(access.canManageVisitSystem, true);
  assert.equal(
    access.authority.hasSergeantAtArmsPosition,
    false
  );
});

// ---------------------------------------------------------------------------
// Document categories (Inward / Outward) for secretary folders.
// ---------------------------------------------------------------------------

const path = require('node:path');
const positionHelpers = require('./positions');
const visit = require('./visit-submissions');

const categoryFixture = require(path.join(__dirname, '..', 'scripts', 'fixtures', 'visit-submission-upload-lifecycle-sample.json'));

function categoryTokenGenerator() {
  let counter = 0;
  return {
    randomHex(bytes) {
      counter += 1;
      return counter.toString(16).padStart(bytes * 2, '0').slice(-(bytes * 2));
    },
  };
}

async function categoryEnv() {
  const clock = { value: 1000000, now() { return this.value; } };
  const adapter = visit.createMemoryVisitSubmissionAdapter(categoryFixture);
  const service = visit.createVisitSubmissionService({
    adapter,
    positionHelpers,
    clock,
    tokenGenerator: categoryTokenGenerator(),
  });
  await service.initializeStructure('president-uid');
  return { adapter, service };
}

function categoryFile(overrides = {}) {
  return {
    clientFileId: overrides.clientFileId || 'local-1',
    fileName: overrides.fileName || 'Letter.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 123456,
    ...(overrides.documentCategory !== undefined ? { documentCategory: overrides.documentCategory } : {}),
  };
}

async function rejectsWith(promise, code, messagePattern) {
  await assert.rejects(promise, (err) => {
    assert.equal(err?.httpsCode || err?.code, code);
    if (messagePattern) assert.match(err.message, messagePattern);
    return true;
  });
}

async function uploadThroughDrive(env, uid, session, { driveFileId, driveFolderId, positionFolderId }, index = 0) {
  const item = session.files[index];
  const validation = await env.service.validateVisitUploadTicketWithProof({
    ticket: item.ticket,
    sessionId: session.sessionId,
    clientFileId: item.clientFileId,
    fileName: item.fileName,
    mimeType: item.mimeType,
    sizeBytes: item.sizeBytes,
  });
  const completion = await env.service.completeDriveUpload({
    ticket: item.ticket,
    sessionId: session.sessionId,
    clientFileId: item.clientFileId,
    uploadProof: validation.uploadProof,
    fileName: item.fileName,
    mimeType: item.mimeType,
    sizeBytes: item.sizeBytes,
    finalFileName: item.fileName,
    driveFileId,
    driveFolderId,
    ...(positionFolderId ? { positionFolderId } : {}),
    driveFileUrl: `https://drive.google.com/file/d/${driveFileId}/view`,
  });
  const result = await env.service.finalizeUpload(uid, {
    sessionId: session.sessionId,
    clientFileId: item.clientFileId,
    ticket: item.ticket,
    completionProof: completion.completionProof,
  });
  return { validation, result };
}

test('normalizeDocumentCategory accepts only inward, outward, or empty', () => {
  assert.equal(visit.normalizeDocumentCategory(undefined), '');
  assert.equal(visit.normalizeDocumentCategory(''), '');
  assert.equal(visit.normalizeDocumentCategory('inward'), 'inward');
  assert.equal(visit.normalizeDocumentCategory('outward'), 'outward');
  assert.throws(() => visit.normalizeDocumentCategory('Inward'), (err) => err.code === 'invalid-argument');
  assert.throws(() => visit.normalizeDocumentCategory('sideways'), (err) => err.code === 'invalid-argument');
});

test('document categories are only accepted for secretary folders and must be valid', async () => {
  const env = await categoryEnv();

  await rejectsWith(env.service.createUploadSession('bod-editor', {
    visitType: 'clubAssembly',
    positionKey: 'editor',
    files: [categoryFile({ documentCategory: 'inward' })],
  }), 'invalid-argument', /only available for secretary folders/);

  await rejectsWith(env.service.createUploadSession('bod-secretary', {
    visitType: 'clubAssembly',
    positionKey: 'secretary',
    files: [categoryFile({ documentCategory: 'sideways' })],
  }), 'invalid-argument');

  const session = await env.service.createUploadSession('bod-secretary', {
    visitType: 'clubAssembly',
    positionKey: 'secretary',
    files: [
      categoryFile({ clientFileId: 'in-1', fileName: 'In.pdf', documentCategory: 'inward' }),
      categoryFile({ clientFileId: 'out-1', fileName: 'Out.pdf', documentCategory: 'outward' }),
      categoryFile({ clientFileId: 'none-1', fileName: 'Plain.pdf' }),
    ],
  });
  const stored = env.adapter.store.visitSubmissionUploadSessions[session.sessionId];
  assert.deepEqual(stored.expectedFiles.map((file) => file.documentCategory), ['inward', 'outward', '']);
  const ticketCategories = stored.expectedFiles.map((file) => env.adapter.store.driveUploadTickets[file.ticketHash].documentCategory);
  assert.deepEqual(ticketCategories, ['inward', 'outward', '']);

  const folder = await env.service.getFolder('bod-secretary', 'clubAssembly', 'secretary');
  assert.equal(folder.folder.supportsDocumentCategories, true);
  const editorFolder = await env.service.getFolder('bod-editor', 'clubAssembly', 'editor');
  assert.equal(editorFolder.folder.supportsDocumentCategories, false);
});

test('first inward upload keeps the position folder and records the Inward subfolder', async () => {
  const env = await categoryEnv();
  const inwardSession = await env.service.createUploadSession('bod-secretary', {
    visitType: 'clubAssembly',
    positionKey: 'secretary',
    files: [categoryFile({ clientFileId: 'in-1', documentCategory: 'inward' })],
  });
  const { validation, result } = await uploadThroughDrive(env, 'bod-secretary', inwardSession, {
    driveFileId: 'driveFileInward001',
    driveFolderId: 'inwardFolder00001',
    positionFolderId: 'positionFolder0001',
  });
  assert.equal(validation.documentCategory, 'inward');

  const folderDoc = env.adapter.store.visitSubmissionPositions.clubAssembly_secretary;
  assert.equal(folderDoc.driveFolderId, 'positionFolder0001');
  assert.deepEqual(folderDoc.categoryFolderIds, { inward: 'inwardFolder00001' });
  const submission = env.adapter.store.visitSubmissions[result.submissionId];
  assert.equal(submission.documentCategory, 'inward');
  assert.equal(submission.driveFolderId, 'inwardFolder00001');

  const plainSession = await env.service.createUploadSession('bod-secretary', {
    visitType: 'clubAssembly',
    positionKey: 'secretary',
    files: [categoryFile({ clientFileId: 'plain-1', fileName: 'Plain.pdf' })],
  });
  const plain = await uploadThroughDrive(env, 'bod-secretary', plainSession, {
    driveFileId: 'driveFilePlain0001',
    driveFolderId: 'positionFolder0001',
  });
  assert.equal(env.adapter.store.visitSubmissions[plain.result.submissionId].documentCategory, '');
  const after = env.adapter.store.visitSubmissionPositions.clubAssembly_secretary;
  assert.equal(after.driveFolderId, 'positionFolder0001');
  assert.deepEqual(after.categoryFolderIds, { inward: 'inwardFolder00001' });
  assert.equal(after.activeFileCount, 2);

  const listed = await env.service.getFolder('bod-secretary', 'clubAssembly', 'secretary');
  const byId = new Map(listed.submissions.map((item) => [item.submissionId, item]));
  assert.equal(byId.get(result.submissionId).documentCategory, 'inward');
  assert.equal(byId.get(result.submissionId).canMove, true);
  assert.equal(byId.get(plain.result.submissionId).documentCategory, '');
});

test('a categorised upload that lands in the position folder is rejected at finalize', async () => {
  const env = await categoryEnv();
  const session = await env.service.createUploadSession('bod-secretary', {
    visitType: 'clubAssembly',
    positionKey: 'secretary',
    files: [categoryFile({ clientFileId: 'in-1', documentCategory: 'inward' })],
  });
  await rejectsWith(uploadThroughDrive(env, 'bod-secretary', session, {
    driveFileId: 'driveFileInward001',
    driveFolderId: 'positionFolder0001',
  }), 'failed-precondition', /category folder is missing/);
});

test('a replacement keeps the old category even when the client sends another', async () => {
  const env = await categoryEnv();
  const session = await env.service.createUploadSession('bod-secretary', {
    visitType: 'clubAssembly',
    positionKey: 'secretary',
    files: [categoryFile({ clientFileId: 'in-1', documentCategory: 'inward' })],
  });
  const { result } = await uploadThroughDrive(env, 'bod-secretary', session, {
    driveFileId: 'driveFileInward001',
    driveFolderId: 'inwardFolder00001',
    positionFolderId: 'positionFolder0001',
  });

  const replacement = await env.service.replaceSubmission('bod-secretary', {
    submissionId: result.submissionId,
    files: [categoryFile({ clientFileId: 'replace-1', fileName: 'Letter v2.pdf', documentCategory: 'outward' })],
  });
  const stored = env.adapter.store.visitSubmissionUploadSessions[replacement.sessionId];
  assert.equal(stored.expectedFiles[0].documentCategory, 'inward');
  assert.equal(env.adapter.store.driveUploadTickets[stored.expectedFiles[0].ticketHash].documentCategory, 'inward');
});

test('bulk upload sessions always use no category', async () => {
  const env = await categoryEnv();
  const bulk = await env.service.createBulkUploadSessions('president-uid', {
    visitType: 'clubAssembly',
    positionKeys: ['secretary', 'editor'],
    files: [categoryFile({ clientFileId: 'bulk-1', documentCategory: 'inward' })],
  });
  for (const sessionInfo of bulk.sessions) {
    const stored = env.adapter.store.visitSubmissionUploadSessions[sessionInfo.sessionId];
    assert.deepEqual(stored.expectedFiles.map((file) => file.documentCategory), ['']);
    assert.equal(env.adapter.store.driveUploadTickets[stored.expectedFiles[0].ticketHash].documentCategory, '');
  }
});
