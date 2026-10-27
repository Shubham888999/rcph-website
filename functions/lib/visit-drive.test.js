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
  createVisitHttpUploadHandler,
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
    ...(folder.categoryParentFolderId ? { categoryParentFolderId: folder.categoryParentFolderId } : {}),
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

test('registers get their own Inward Register and Outward Register folders beside Inward and Outward', async () => {
  const fakeDrive = createFakeDrive();
  const drive = createVisitDriveService({ driveClient: fakeDrive.client });
  const validation = (documentCategory) => ({ visitType: 'dzrVisit', positionTitle: 'Secretary', documentCategory });

  const inward = await drive.ensureVisitFolderHierarchy(validation('inward'), DRIVE_CONFIG);
  const inwardRegister = await drive.ensureVisitFolderHierarchy(validation('inward-register'), DRIVE_CONFIG);
  const outwardRegister = await drive.ensureVisitFolderHierarchy(validation('outward-register'), DRIVE_CONFIG);
  const againInwardRegister = await drive.ensureVisitFolderHierarchy(validation('inward-register'), DRIVE_CONFIG);

  assert.deepEqual(fakeDrive.calls.create.map((call) => call.name), ['Secretary', 'Inward', 'Inward Register', 'Outward Register']);
  assert.equal(inwardRegister.targetFolderId, againInwardRegister.targetFolderId);
  assert.notEqual(inwardRegister.targetFolderId, inward.targetFolderId);
  assert.notEqual(inwardRegister.targetFolderId, outwardRegister.targetFolderId);
  assert.deepEqual(fakeDrive.items.get(outwardRegister.targetFolderId).parents, [inward.positionFolderId]);
});

test('a register upload lands in its folder and can move to another register', async () => {
  const env = await createEnv();
  const upload = await uploadVia(env, 'bod-secretary', 'secretary', 'inward-register');
  const folderDoc = env.adapter.store.visitSubmissionPositions.clubAssembly_secretary;
  assert.equal(folderDoc.categoryFolderIds['inward-register'], upload.folder.targetFolderId);
  assert.equal(env.adapter.store.visitSubmissions[upload.submissionId].documentCategory, 'inward-register');

  const result = await env.move('bod-secretary', { submissionId: upload.submissionId, documentCategory: 'outward-register' });
  assert.deepEqual(result, { ok: true, documentCategory: 'outward-register' });
  const movedFolderDoc = env.adapter.store.visitSubmissionPositions.clubAssembly_secretary;
  assert.ok(movedFolderDoc.categoryFolderIds['outward-register']);
  assert.equal(movedFolderDoc.categoryFolderIds['inward-register'], upload.folder.targetFolderId);
  assert.equal(env.adapter.store.visitSubmissions[upload.submissionId].documentCategory, 'outward-register');
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

test('an extra folder gets a Drive folder with its name, shared by later uploads and kept after a rename', async () => {
  const env = await createEnv();
  const { created } = await env.service.createCustomFolder('bod-editor', { visitType: 'clubAssembly', positionKey: 'editor', name: 'Event photos' });
  const first = await uploadVia(env, 'bod-editor', 'editor', created.key, 'photo-1');
  assert.deepEqual(env.fakeDrive.calls.create.filter((call) => call.folder).map((call) => call.name), ['Editor', 'Event photos']);
  assert.notEqual(first.folder.targetFolderId, first.folder.positionFolderId);

  await env.service.renameCustomFolder('bod-editor', { visitType: 'clubAssembly', positionKey: 'editor', folderKey: created.key, name: 'Photos 2026' });
  const second = await uploadVia(env, 'bod-editor', 'editor', created.key, 'photo-2');
  assert.equal(second.folder.targetFolderId, first.folder.targetFolderId);
  assert.equal(env.fakeDrive.calls.create.filter((call) => call.folder).length, 2);
});

test('moving a document into an extra folder creates the Drive folder and moves the file', async () => {
  const env = await createEnv();
  const { created } = await env.service.createCustomFolder('bod-editor', { visitType: 'clubAssembly', positionKey: 'editor', name: 'Bank letters' });
  const upload = await uploadVia(env, 'bod-editor', 'editor');
  const result = await env.move('bod-editor', { submissionId: upload.submissionId, documentCategory: created.key });
  assert.deepEqual(result, { ok: true, documentCategory: created.key });
  const bankFolder = env.fakeDrive.calls.create.find((call) => call.name === 'Bank letters');
  assert.deepEqual(env.fakeDrive.items.get(upload.driveFileId).parents, [bankFolder.id]);
  assert.equal(env.adapter.store.visitSubmissions[upload.submissionId].documentCategory, created.key);
});

test('a subfolder is created inside its parent folder in Drive, and the parent id is remembered', async () => {
  const env = await createEnv();
  const top = (await env.service.createCustomFolder('bod-editor', { visitType: 'clubAssembly', positionKey: 'editor', name: 'Bank letters' })).created;
  const sub = (await env.service.createCustomFolder('bod-editor', { visitType: 'clubAssembly', positionKey: 'editor', name: '2026', parentKey: top.key })).created;
  const first = await uploadVia(env, 'bod-editor', 'editor', sub.key, 'sub-1');
  const created = env.fakeDrive.calls.create.filter((call) => call.folder);
  assert.deepEqual(created.map((call) => call.name), ['Editor', 'Bank letters', '2026']);
  const bank = created.find((call) => call.name === 'Bank letters');
  assert.deepEqual(created.find((call) => call.name === '2026').parents, [bank.id]);
  assert.equal(first.folder.categoryParentFolderId, bank.id);
  assert.deepEqual(env.adapter.store.visitSubmissionPositions.clubAssembly_editor.categoryFolderIds, { [sub.key]: first.folder.targetFolderId, [top.key]: bank.id });

  await env.service.renameCustomFolder('bod-editor', { visitType: 'clubAssembly', positionKey: 'editor', folderKey: top.key, name: 'Bank 2' });
  const second = await uploadVia(env, 'bod-editor', 'editor', sub.key, 'sub-2');
  assert.equal(second.folder.targetFolderId, first.folder.targetFolderId);
  assert.equal(env.fakeDrive.calls.create.filter((call) => call.folder).length, 3);
});

test('a subfolder of a built-in folder lands inside that folder, and a move creates the same structure', async () => {
  const env = await createEnv();
  const sub = (await env.service.createCustomFolder('bod-secretary', { visitType: 'clubAssembly', positionKey: 'secretary', name: '2026', parentKey: 'outward' })).created;
  const upload = await uploadVia(env, 'bod-secretary', 'secretary');
  await env.move('bod-secretary', { submissionId: upload.submissionId, documentCategory: sub.key });
  const created = env.fakeDrive.calls.create.filter((call) => call.folder);
  const outward = created.find((call) => call.name === 'Outward');
  const year = created.find((call) => call.name === '2026');
  assert.deepEqual(year.parents, [outward.id]);
  assert.deepEqual(env.fakeDrive.items.get(upload.driveFileId).parents, [year.id]);
  const ids = env.adapter.store.visitSubmissionPositions.clubAssembly_secretary.categoryFolderIds;
  assert.equal(ids[sub.key], year.id);
  assert.equal(ids.outward, outward.id);
});


function uploadResponse() {
  return {
    statusCode: 200, body: "",
    status(value) { this.statusCode = value; return this; },
    set() { return this; },
    send(value) { this.body = JSON.parse(value); return this; },
  };
}

test('HTTP uploads release the folder lock before slow file transfer, allowing a second file in the same folder', async () => {
  let held = false;
  let released = 0;
  const lockManager = {
    async acquireLock() {
      if (held) throw createHttpUploadError(409, 'Visit upload folder is being prepared.');
      held = true;
      return { async release() { held = false; released += 1; } };
    },
  };
  const env = await createEnv({ lockManager });
  const category = (await env.service.createCustomFolder('admin-uid', { visitType: 'clubAssembly', positionKey: 'editor', name: 'Resolutions' })).created.key;
  const buffer = Buffer.from('%PDF-1.4\nok');
  const session = await env.service.createBulkUploadSessions('admin-uid', {
    visitType: 'clubAssembly', positionKeys: ['editor'],
    destinations: [{ positionKey: 'editor', documentCategory: category }],
    files: ['one', 'two'].map(clientFileId => ({ clientFileId, fileName: `${clientFileId}.pdf`, mimeType: 'application/pdf', sizeBytes: buffer.length })),
  });
  const approved = session.sessions[0];
  let signalFirstTransfer;
  const firstTransfer = new Promise(resolve => { signalFirstTransfer = resolve; });
  let finishFirstTransfer;
  const firstTransferGate = new Promise(resolve => { finishFirstTransfer = resolve; });
  const handler = createVisitHttpUploadHandler({
    visitService: env.service, folderLockManager: lockManager,
    getDriveConfig: () => DRIVE_CONFIG, logger: { warn() {} },
    parseMultipartUpload: async req => ({ fields: req.fields, file: { buffer, sizeBytes: buffer.length, mimeType: 'application/pdf' } }),
    driveService: {
      ensureVisitFolderHierarchy: async (...args) => {
        assert.equal(held, true, 'folder creation remains protected');
        return env.drive.ensureVisitFolderHierarchy(...args);
      },
      uploadFile: async payload => {
        if (payload.fileName === 'one.pdf') {
          signalFirstTransfer();
          await firstTransferGate;
        }
        return env.drive.uploadFile(payload);
      },
    },
  });
  const request = item => ({ method: 'POST', headers: { origin: 'http://localhost:5173' }, fields: { ...item, sessionId: approved.sessionId } });
  const firstResponse = uploadResponse();
  const first = handler(request(approved.files[0]), firstResponse);
  await firstTransfer;
  try {
    assert.equal(held, false, 'slow uploads do not retain the folder lock');
    const secondResponse = uploadResponse();
    await handler(request(approved.files[1]), secondResponse);
    assert.equal(secondResponse.statusCode, 200, JSON.stringify(secondResponse.body));
    const result = await env.service.finalizeUpload('admin-uid', { sessionId: approved.sessionId, ...approved.files[1], completionProof: secondResponse.body.completionProof });
    assert.ok(result.submissionId);
  } finally {
    finishFirstTransfer();
    await first;
  }
  assert.equal(firstResponse.statusCode, 200, JSON.stringify(firstResponse.body));
  await env.service.finalizeUpload('admin-uid', { sessionId: approved.sessionId, ...approved.files[0], completionProof: firstResponse.body.completionProof });
  assert.equal(released, 2);
  assert.equal(held, false);
  const saved = Object.values(env.adapter.store.visitSubmissions);
  assert.equal(saved.length, 2);
  assert.ok(saved.every(item => item.documentCategory === category));
  assert.equal(new Set(saved.map(item => item.driveFolderId)).size, 1);
  assert.deepEqual(env.fakeDrive.calls.create.filter(item => item.folder).map(item => item.name), ['Editor', 'Resolutions']);
});

test('HTTP folder preparation failure releases its lock and never transfers bytes', async () => {
  const events = [];
  const handler = createVisitHttpUploadHandler({
    visitService: { async validateVisitUploadTicketWithProof() { return { sanitizedOriginalFileName: 'one.pdf', visitType: 'clubAssembly', visitDisplayTitle: 'Club Assembly', positionKey: 'editor', positionTitle: 'Editor', avenueCode: 'ED', uploadProof: 'proof' }; } },
    folderLockManager: { async acquireLock() { events.push('lock'); return { async release() { events.push('release'); } }; } },
    driveService: { async ensureVisitFolderHierarchy() { throw createHttpUploadError(500, 'Folder creation failed.'); }, async uploadFile() { events.push('upload'); } },
    getDriveConfig: () => DRIVE_CONFIG, logger: { warn() {} },
    parseMultipartUpload: async () => ({ fields: { ticket: 'a'.repeat(64), sessionId: 'session', clientFileId: 'one', fileName: 'one.pdf', mimeType: 'application/pdf', sizeBytes: 1 }, file: { buffer: Buffer.from('x'), sizeBytes: 1 } }),
  });
  const response = uploadResponse();
  await handler({ method: 'POST', headers: { origin: 'http://localhost:5173' } }, response);
  assert.equal(response.statusCode, 500);
  assert.deepEqual(events, ['lock', 'release']);
});

test('moving into a full Secretary letter folder is rejected before changing Drive', async () => {
  const env = await createEnv();
  const upload = await uploadVia(env, 'bod-secretary', 'secretary');
  for (let i = 0; i < 100; i++) env.adapter.store.visitSubmissions[`letter-${i}`] = { visitType: 'clubAssembly', positionKey: 'secretary', status: 'active', documentCategory: 'inward' };
  env.adapter.store.visitSubmissionPositions.clubAssembly_secretary.activeFileCount = 101;
  await rejectsWith(env.move('bod-secretary', { submissionId: upload.submissionId, documentCategory: 'inward' }), 'resource-exhausted', /100-file limit/);
  assert.equal(env.fakeDrive.calls.update.length, 0);
  assert.equal(env.adapter.store.visitSubmissions[upload.submissionId].documentCategory, '');
});

test('a quota filled during a Drive move returns the file to its original folder', async () => {
  const env = await createEnv();
  const upload = await uploadVia(env, 'bod-secretary', 'secretary');
  for (let i = 0; i < 99; i++) env.adapter.store.visitSubmissions[`letter-${i}`] = { visitType: 'clubAssembly', positionKey: 'secretary', status: 'active', documentCategory: 'inward' };
  env.adapter.store.visitSubmissionPositions.clubAssembly_secretary.activeFileCount = 100;
  const move = env.drive.moveFileToFolder.bind(env.drive);
  let competingUpload = true;
  env.drive.moveFileToFolder = async (...args) => {
    const result = await move(...args);
    if (competingUpload) {
      competingUpload = false;
      env.adapter.store.visitSubmissions['last-letter'] = { visitType: 'clubAssembly', positionKey: 'secretary', status: 'active', documentCategory: 'inward' };
      env.adapter.store.visitSubmissionPositions.clubAssembly_secretary.activeFileCount += 1;
    }
    return result;
  };
  await rejectsWith(env.move('bod-secretary', { submissionId: upload.submissionId, documentCategory: 'inward' }), 'resource-exhausted');
  assert.deepEqual(env.fakeDrive.items.get(upload.driveFileId).parents, [upload.folder.positionFolderId]);
  assert.equal(env.adapter.store.visitSubmissions[upload.submissionId].documentCategory, '');
});
