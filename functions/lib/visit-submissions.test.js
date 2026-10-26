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

test('normalizeDocumentCategory accepts the inward/outward files and registers, or empty', () => {
  assert.equal(visit.normalizeDocumentCategory(undefined), '');
  assert.equal(visit.normalizeDocumentCategory(''), '');
  assert.equal(visit.normalizeDocumentCategory('inward'), 'inward');
  assert.equal(visit.normalizeDocumentCategory('outward'), 'outward');
  assert.equal(visit.normalizeDocumentCategory('inward-register'), 'inward-register');
  assert.equal(visit.normalizeDocumentCategory('outward-register'), 'outward-register');
  assert.throws(() => visit.normalizeDocumentCategory('register'), (err) => err.code === 'invalid-argument');
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

// ---------------------------------------------------------------------------
// Extra folders added by the position holder or a Visit manager.
// ---------------------------------------------------------------------------

const extraFolder = (visitType, positionKey, name) => ({ visitType, positionKey, name });

test('a holder adds extra folders to their own position folder, and managers to any', async () => {
  const env = await categoryEnv();
  const created = await env.service.createCustomFolder('bod-editor', extraFolder('clubAssembly', 'editor', '  Event   photos '));
  assert.equal(created.created.name, 'Event photos');
  assert.match(created.created.key, /^custom-[a-f0-9]{8}$/);

  await rejectsWith(env.service.createCustomFolder('bod-editor', extraFolder('clubAssembly', 'secretary', 'Nope')), 'permission-denied');
  const byManager = await env.service.createCustomFolder('president-uid', extraFolder('clubAssembly', 'secretary', 'Bank letters'));
  assert.deepEqual(byManager.customFolders.map(item => item.name), ['Bank letters']);

  const editorFolder = await env.service.getFolder('bod-editor', 'clubAssembly', 'editor');
  assert.deepEqual(editorFolder.folder.customFolders, [{ key: created.created.key, name: 'Event photos' }]);
  assert.equal(editorFolder.folder.supportsCustomFolders, true);
  assert.equal(editorFolder.folder.canManageCustomFolders, true);
  assert.equal(editorFolder.folder.supportsDocumentCategories, false);

  const audit = Object.values(env.adapter.store.visitSubmissionAudit || {}).filter(item => item.action === 'visitCustomFolderCreated');
  assert.equal(audit.length, 2);
});

test('extra folder names are checked and limited to ten', async () => {
  const env = await categoryEnv();
  await rejectsWith(env.service.createCustomFolder('bod-editor', extraFolder('clubAssembly', 'editor', 'Inward')), 'invalid-argument', /built-in/);
  await rejectsWith(env.service.createCustomFolder('bod-editor', extraFolder('clubAssembly', 'editor', 'a/b')), 'invalid-argument', /cannot contain/);
  await env.service.createCustomFolder('bod-editor', extraFolder('clubAssembly', 'editor', 'Photos'));
  await rejectsWith(env.service.createCustomFolder('bod-editor', extraFolder('clubAssembly', 'editor', 'photos')), 'invalid-argument', /already exists/);
  for (let index = 1; index < 10; index += 1) await env.service.createCustomFolder('bod-editor', extraFolder('clubAssembly', 'editor', `Folder ${index}`));
  await rejectsWith(env.service.createCustomFolder('bod-editor', extraFolder('clubAssembly', 'editor', 'Eleventh')), 'invalid-argument', /up to 10/);
});

test('files can be uploaded into an extra folder by key, and only that position may use the key', async () => {
  const env = await categoryEnv();
  const { created } = await env.service.createCustomFolder('bod-editor', extraFolder('clubAssembly', 'editor', 'Event photos'));
  await rejectsWith(env.service.createUploadSession('bod-editor', {
    visitType: 'clubAssembly', positionKey: 'editor', files: [categoryFile({ documentCategory: 'custom-0a0a0a0a' })],
  }), 'invalid-argument');
  await rejectsWith(env.service.createUploadSession('bod-secretary', {
    visitType: 'clubAssembly', positionKey: 'secretary', files: [categoryFile({ documentCategory: created.key })],
  }), 'invalid-argument');
  await rejectsWith(env.service.createUploadSession('bod-editor', {
    visitType: 'clubAssembly', positionKey: 'editor', files: [categoryFile({ documentCategory: 'inward' })],
  }), 'invalid-argument', /only available for secretary folders/);

  const session = await env.service.createUploadSession('bod-editor', {
    visitType: 'clubAssembly', positionKey: 'editor', files: [categoryFile({ clientFileId: 'p-1', fileName: 'Photo.pdf', documentCategory: created.key })],
  });
  const { validation, result } = await uploadThroughDrive(env, 'bod-editor', session, {
    driveFileId: 'driveFilePhoto0001', driveFolderId: 'photosFolder00001', positionFolderId: 'editorFolder00001',
  });
  assert.equal(validation.documentCategory, created.key);
  assert.equal(validation.documentCategoryName, 'Event photos');
  assert.equal(validation.documentCategoryFolderId, '');
  assert.deepEqual(env.adapter.store.visitSubmissionPositions.clubAssembly_editor.categoryFolderIds, { [created.key]: 'photosFolder00001' });
  assert.equal(env.adapter.store.visitSubmissions[result.submissionId].documentCategory, created.key);

  const next = await env.service.createUploadSession('bod-editor', {
    visitType: 'clubAssembly', positionKey: 'editor', files: [categoryFile({ clientFileId: 'p-2', fileName: 'Photo2.pdf', documentCategory: created.key })],
  });
  const stored = env.adapter.store.visitSubmissionUploadSessions[next.sessionId];
  assert.equal(env.adapter.store.driveUploadTickets[stored.expectedFiles[0].ticketHash].documentCategoryFolderId, 'photosFolder00001');
});

test('a document can be moved into an extra folder, and back out', async () => {
  const env = await categoryEnv();
  const { created } = await env.service.createCustomFolder('bod-editor', extraFolder('clubAssembly', 'editor', 'Event photos'));
  const session = await env.service.createUploadSession('bod-editor', {
    visitType: 'clubAssembly', positionKey: 'editor', files: [categoryFile({ clientFileId: 'p-1', fileName: 'Photo.pdf' })],
  });
  const { result } = await uploadThroughDrive(env, 'bod-editor', session, {
    driveFileId: 'driveFilePhoto0001', driveFolderId: 'editorFolder00001',
  });
  const plan = await env.service.prepareCategoryMove('bod-editor', { submissionId: result.submissionId, documentCategory: created.key });
  assert.equal(plan.targetCategory, created.key);
  assert.equal(plan.targetCategoryName, 'Event photos');
  await env.service.commitCategoryMove('bod-editor', {
    submissionId: result.submissionId, targetCategory: created.key, driveFileId: 'driveFilePhoto0001', driveFolderId: 'photosFolder00001', positionFolderId: 'editorFolder00001',
  });
  assert.equal(env.adapter.store.visitSubmissions[result.submissionId].documentCategory, created.key);
  await rejectsWith(env.service.prepareCategoryMove('bod-editor', { submissionId: result.submissionId, documentCategory: 'inward' }), 'invalid-argument', /only available for secretary folders/);
  await rejectsWith(env.service.prepareCategoryMove('bod-editor', { submissionId: result.submissionId, documentCategory: 'custom-0a0a0a0a' }), 'invalid-argument');
});

test('an extra folder can be renamed, and deleted only when it has no active files', async () => {
  const env = await categoryEnv();
  const { created } = await env.service.createCustomFolder('bod-editor', extraFolder('clubAssembly', 'editor', 'Photos'));
  const renamed = await env.service.renameCustomFolder('bod-editor', { ...extraFolder('clubAssembly', 'editor', 'Event photos'), folderKey: created.key });
  assert.deepEqual(renamed.customFolders, [{ key: created.key, name: 'Event photos' }]);
  await rejectsWith(env.service.renameCustomFolder('bod-secretary', { ...extraFolder('clubAssembly', 'editor', 'Hijack'), folderKey: created.key }), 'permission-denied');

  const session = await env.service.createUploadSession('bod-editor', {
    visitType: 'clubAssembly', positionKey: 'editor', files: [categoryFile({ clientFileId: 'p-1', fileName: 'Photo.pdf', documentCategory: created.key })],
  });
  await uploadThroughDrive(env, 'bod-editor', session, { driveFileId: 'driveFilePhoto0001', driveFolderId: 'photosFolder00001', positionFolderId: 'editorFolder00001' });
  await rejectsWith(env.service.deleteCustomFolder('bod-editor', { ...extraFolder('clubAssembly', 'editor', ''), folderKey: created.key }), 'invalid-argument', /Move or remove/);

  const second = await env.service.createCustomFolder('bod-editor', extraFolder('clubAssembly', 'editor', 'Empty one'));
  const deleted = await env.service.deleteCustomFolder('bod-editor', { ...extraFolder('clubAssembly', 'editor', ''), folderKey: second.created.key });
  assert.deepEqual(deleted.customFolders.map(item => item.name), ['Event photos']);
  await rejectsWith(env.service.deleteCustomFolder('bod-editor', { ...extraFolder('clubAssembly', 'editor', ''), folderKey: second.created.key }), 'invalid-argument', /no longer exists/);
});
