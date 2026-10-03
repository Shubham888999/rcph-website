'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const positionHelpers = require('./positions');
const visit = require('./visit-submissions');
const {
  VISIT_FOLDER_BUSY_MESSAGE,
  createHttpUploadError,
  createVisitCategoryMoveHandler,
  createVisitDriveService,
} = require('./visit-drive');

const baseFixture = require(path.join(__dirname, '..', 'scripts', 'fixtures', 'visit-submission-upload-lifecycle-sample.json'));
const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';
const DRIVE_CONFIG = Object.freeze({
  authMode: 'oauth',
  rootFolderIds: {
    clubAssembly: 'rootClubAssembly01',
    dzrVisit: 'rootDzrVisit00001',
    drrVisit: 'rootDrrVisit00001',
  },
});

function createFakeDrive() {
  let counter = 0;
  const items = new Map();
  const calls = { create: [], get: [], update: [], list: [] };
  const newId = (prefix) => `${prefix}${String(++counter).padStart(8, '0')}`;
  const client = {
    files: {
      async list({ q }) {
        calls.list.push(q);
        const parent = /'([^']+)' in parents/.exec(q)[1];
        const name = /name = '([^']+)'/.exec(q)[1];
        const files = Array.from(items.entries())
          .filter(([, item]) => item.folder && item.name === name && item.parents.includes(parent))
          .map(([id, item]) => ({ id, name: item.name }));
        return { data: { files } };
      },
      async create({ requestBody }) {
        const folder = requestBody.mimeType === DRIVE_FOLDER_MIME;
        const id = newId(folder ? 'folder' : 'file');
        items.set(id, { name: requestBody.name, parents: [...requestBody.parents], folder });
        calls.create.push({ id, name: requestBody.name, parents: [...requestBody.parents], folder });
        return { data: { id, name: requestBody.name, webViewLink: `https://drive.google.com/file/d/${id}/view` } };
      },
      async get({ fileId }) {
        calls.get.push(fileId);
        const item = items.get(fileId);
        return { data: { id: fileId, parents: [...item.parents] } };
      },
      async update({ fileId, addParents, removeParents }) {
        calls.update.push({ fileId, addParents, removeParents });
        const item = items.get(fileId);
        const remove = new Set(String(removeParents || '').split(',').filter(Boolean));
        item.parents = item.parents.filter((parentId) => !remove.has(parentId));
        if (addParents && !item.parents.includes(addParents)) item.parents.push(addParents);
        return { data: { id: fileId, parents: [...item.parents] } };
      },
    },
  };
  return { client, items, calls };
}

function createLockManager() {
  const events = [];
  return {
    events,
    async acquireLock(input) {
      events.push({ type: 'acquire', ...input });
      return { lockId: 'test-lock', async release() { events.push({ type: 'release' }); } };
    },
  };
}

function tokenGenerator() {
  let counter = 0;
  return {
    randomHex(bytes) {
      counter += 1;
      return counter.toString(16).padStart(bytes * 2, '0').slice(-(bytes * 2));
    },
  };
}

function fixtureWithSecondSecretary() {
  const data = JSON.parse(JSON.stringify(baseFixture));
  data.users['bod-secretary-2'] = { ...data.users['bod-secretary'], name: 'Second Secretary', email: 'secretary2@example.com' };
  data.roles['bod-secretary-2'] = { ...data.roles['bod-secretary'] };
  data.bodPositionAssignments['secretary_bod-secretary-2'] = {
    ...data.bodPositionAssignments['secretary_bod-secretary'],
    assignmentId: 'secretary_bod-secretary-2',
    uid: 'bod-secretary-2',
  };
  return data;
}

async function createEnv({ lockManager } = {}) {
  const clock = { value: 1000000, now() { return this.value; } };
  const adapter = visit.createMemoryVisitSubmissionAdapter(fixtureWithSecondSecretary());
  const service = visit.createVisitSubmissionService({ adapter, positionHelpers, clock, tokenGenerator: tokenGenerator() });
  await service.initializeStructure('president-uid');
  const fakeDrive = createFakeDrive();
  const drive = createVisitDriveService({ driveClient: fakeDrive.client });
  const locks = lockManager || createLockManager();
  const move = createVisitCategoryMoveHandler({
    visitService: service,
    driveService: drive,
    folderLockManager: locks,
    getDriveConfig: () => DRIVE_CONFIG,
    logger: { warn() {} },
  });
  return { adapter, service, fakeDrive, drive, locks, move };
}

async function uploadVia(env, uid, positionKey, documentCategory = '', clientFileId = 'local-1') {
  const session = await env.service.createUploadSession(uid, {
    visitType: 'clubAssembly',
    positionKey,
    files: [{
      clientFileId,
      fileName: `${clientFileId}.pdf`,
      mimeType: 'application/pdf',
      sizeBytes: 123456,
      ...(documentCategory ? { documentCategory } : {}),
    }],
  });
  const item = session.files[0];
  const validation = await env.service.validateVisitUploadTicketWithProof({
    ticket: item.ticket,
    sessionId: session.sessionId,
    clientFileId: item.clientFileId,
    fileName: item.fileName,
    mimeType: item.mimeType,
    sizeBytes: item.sizeBytes,
  });
  const folder = await env.drive.ensureVisitFolderHierarchy(validation, DRIVE_CONFIG);
  const driveFile = await env.drive.uploadFile({
    folderId: folder.targetFolderId,
    fileName: validation.sanitizedOriginalFileName,
    mimeType: item.mimeType,
    buffer: Buffer.from('test file'),
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
    driveFileId: driveFile.driveFileId,
    driveFolderId: folder.targetFolderId,
    positionFolderId: folder.positionFolderId,
    driveFileUrl: driveFile.driveFileUrl,
  });
  const result = await env.service.finalizeUpload(uid, {
    sessionId: session.sessionId,
    clientFileId: item.clientFileId,
    ticket: item.ticket,
    completionProof: completion.completionProof,
  });
  return { submissionId: result.submissionId, folder, driveFileId: driveFile.driveFileId };
}

async function rejectsWith(promise, code, messagePattern) {
  await assert.rejects(promise, (err) => {
    assert.equal(err?.httpsCode || err?.code, code);
    if (messagePattern) assert.match(err.message, messagePattern);
    return true;
  });
}

test('ensureVisitFolderHierarchy creates and reuses the Inward and Outward folders exactly once', async () => {
  const fakeDrive = createFakeDrive();
  const drive = createVisitDriveService({ driveClient: fakeDrive.client });
  const validation = (documentCategory) => ({ visitType: 'clubAssembly', positionTitle: 'Secretary', documentCategory });

  const firstInward = await drive.ensureVisitFolderHierarchy(validation('inward'), DRIVE_CONFIG);
  const secondInward = await drive.ensureVisitFolderHierarchy(validation('inward'), DRIVE_CONFIG);
  const outward = await drive.ensureVisitFolderHierarchy(validation('outward'), DRIVE_CONFIG);
  const againOutward = await drive.ensureVisitFolderHierarchy(validation('outward'), DRIVE_CONFIG);
  const plain = await drive.ensureVisitFolderHierarchy(validation(''), DRIVE_CONFIG);

  const createdNames = fakeDrive.calls.create.map((call) => call.name);
  assert.deepEqual(createdNames, ['Secretary', 'Inward', 'Outward']);
  assert.equal(firstInward.targetFolderId, secondInward.targetFolderId);
  assert.equal(outward.targetFolderId, againOutward.targetFolderId);
  assert.notEqual(firstInward.targetFolderId, outward.targetFolderId);
  assert.equal(plain.targetFolderId, plain.positionFolderId);
  assert.equal(firstInward.positionFolderId, plain.positionFolderId);
  const inwardFolder = fakeDrive.items.get(firstInward.targetFolderId);
  assert.deepEqual(inwardFolder.parents, [plain.positionFolderId]);
});

test('the uploader can move a document between categories without changing folder counts', async () => {
  const env = await createEnv();
  const upload = await uploadVia(env, 'bod-secretary', 'secretary', 'inward');
  const before = { ...env.adapter.store.visitSubmissionPositions.clubAssembly_secretary };
  const inwardFolderId = upload.folder.targetFolderId;

  const result = await env.move('bod-secretary', { submissionId: upload.submissionId, documentCategory: 'outward' });
  assert.deepEqual(result, { ok: true, documentCategory: 'outward' });

  const folderDoc = env.adapter.store.visitSubmissionPositions.clubAssembly_secretary;
  const outwardFolderId = folderDoc.categoryFolderIds.outward;
  assert.ok(outwardFolderId);
  assert.deepEqual(folderDoc.categoryFolderIds, { inward: inwardFolderId, outward: outwardFolderId });
  assert.equal(folderDoc.driveFolderId, upload.folder.positionFolderId);
  assert.equal(folderDoc.activeFileCount, before.activeFileCount);
  assert.equal(folderDoc.reservedFileCount, before.reservedFileCount);

  assert.deepEqual(env.fakeDrive.items.get(upload.driveFileId).parents, [outwardFolderId]);
  const update = env.fakeDrive.calls.update.at(-1);
  assert.equal(update.addParents, outwardFolderId);
  assert.equal(update.removeParents, inwardFolderId);

  const submission = env.adapter.store.visitSubmissions[upload.submissionId];
  assert.equal(submission.documentCategory, 'outward');
  assert.equal(submission.driveFolderId, outwardFolderId);
  const audit = Object.values(env.adapter.store.visitSubmissionAudit).find((entry) => entry.action === 'visitSubmissionCategoryMoved');
  assert.deepEqual(audit.details, { from: 'inward', to: 'outward' });
  assert.deepEqual(env.locks.events.map((event) => event.type), ['acquire', 'release']);
  assert.equal(env.locks.events[0].positionKey, 'secretary');
  assert.equal(env.locks.events[0].rootFolderId, DRIVE_CONFIG.rootFolderIds.clubAssembly);
});

test('another non-manager secretary cannot move someone else\'s document', async () => {
  const env = await createEnv();
  const upload = await uploadVia(env, 'bod-secretary', 'secretary', 'inward');
  await rejectsWith(env.move('bod-secretary-2', { submissionId: upload.submissionId, documentCategory: 'outward' }), 'permission-denied');
  assert.equal(env.fakeDrive.calls.update.length, 0);
  assert.equal(env.adapter.store.visitSubmissions[upload.submissionId].documentCategory, 'inward');

  const listed = await env.service.getFolder('bod-secretary-2', 'clubAssembly', 'secretary');
  assert.equal(listed.submissions.find((item) => item.submissionId === upload.submissionId).canMove, false);
});

test('a Visit manager can move a document back to supporting files', async () => {
  const env = await createEnv();
  const upload = await uploadVia(env, 'bod-secretary', 'secretary', 'inward');
  const result = await env.move('president-uid', { submissionId: upload.submissionId, documentCategory: '' });
  assert.deepEqual(result, { ok: true, documentCategory: '' });
  assert.deepEqual(env.fakeDrive.items.get(upload.driveFileId).parents, [upload.folder.positionFolderId]);
  const submission = env.adapter.store.visitSubmissions[upload.submissionId];
  assert.equal(submission.documentCategory, '');
  assert.equal(submission.driveFolderId, upload.folder.positionFolderId);
});

test('documents outside secretary folders cannot be moved', async () => {
  const env = await createEnv();
  const upload = await uploadVia(env, 'bod-editor', 'editor');
  await rejectsWith(env.move('bod-editor', { submissionId: upload.submissionId, documentCategory: 'inward' }), 'invalid-argument', /only available for secretary folders/);
  assert.equal(env.fakeDrive.calls.update.length, 0);
});

test('moving a document to its current category is a no-op', async () => {
  const env = await createEnv();
  const upload = await uploadVia(env, 'bod-secretary', 'secretary', 'inward');
  const result = await env.move('bod-secretary', { submissionId: upload.submissionId, documentCategory: 'inward' });
  assert.deepEqual(result, { ok: true, noop: true });
  assert.equal(env.locks.events.length, 0);
  assert.equal(env.fakeDrive.calls.update.length, 0);
});

test('a busy folder lock becomes a failed-precondition with the busy message', async () => {
  const busyLock = {
    async acquireLock() {
      throw createHttpUploadError(409, 'Visit upload folder is being prepared. Please try again.');
    },
  };
  const env = await createEnv({ lockManager: busyLock });
  const upload = await uploadVia(env, 'bod-secretary', 'secretary', 'inward');
  await rejectsWith(
    env.move('bod-secretary', { submissionId: upload.submissionId, documentCategory: 'outward' }),
    'failed-precondition',
    new RegExp(VISIT_FOLDER_BUSY_MESSAGE.replace(/\./g, '\\.')),
  );
  assert.equal(env.fakeDrive.calls.update.length, 0);
  assert.equal(env.adapter.store.visitSubmissions[upload.submissionId].documentCategory, 'inward');
});
