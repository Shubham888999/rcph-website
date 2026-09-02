const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  BOD_EVENT_ATTACHMENT_SOURCE,
  BOD_EVENT_ATTACHMENT_STORAGE_PROVIDER,
  DRIVE_FOLDER_MIME,
  buildBodEventUploadFolderName,
  createBodEventAttachmentService,
  hashBodEventFinalizeProof,
  normalizeDocumentId,
  normalizeAuthoritativeBodUploadEvent,
} = require('./bod-event-attachments');

const NOW = Date.parse('2026-08-15T12:00:00.000Z');
const SHA = 'a'.repeat(64);

class TestHttpsError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
  }
  return value;
}

function resolveServerTimestamps(value) {
  if (Array.isArray(value)) return value.map(resolveServerTimestamps);
  if (value && typeof value === 'object') {
    if (value.__serverTimestamp === true) return 'SERVER_TIMESTAMP';
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveServerTimestamps(item)]));
  }
  return value;
}

function setPath(target, dottedPath, value) {
  const parts = dottedPath.split('.');
  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    cursor[part] = cursor[part] && typeof cursor[part] === 'object' ? cursor[part] : {};
    cursor = cursor[part];
  }
  cursor[parts.at(-1)] = resolveServerTimestamps(clone(value));
}

class FakeSnapshot {
  constructor(data, id, ref = null) {
    this.id = id;
    this.ref = ref;
    this.exists = data !== undefined;
    this._data = clone(data);
  }

  data() {
    return clone(this._data);
  }
}

class FakeDocRef {
  constructor(db, pathParts) {
    this._db = db;
    this.path = pathParts.join('/');
    this.id = pathParts.at(-1);
  }

  collection(collectionId) {
    return new FakeCollectionRef(this._db, [...this.path.split('/'), collectionId]);
  }

  get() {
    return Promise.resolve(new FakeSnapshot(this._db.read(this.path), this.id, this));
  }
}

class FakeCollectionRef {
  constructor(db, pathParts) {
    this._db = db;
    this._pathParts = pathParts;
  }

  doc(documentId) {
    const id = documentId || `auto-${this._db.nextAutoId()}`;
    return new FakeDocRef(this._db, [...this._pathParts, id]);
  }
}

class FakeTransaction {
  constructor(db) {
    this._db = db;
    this._writes = [];
  }

  get(ref) {
    return Promise.resolve(new FakeSnapshot(this._db.read(ref.path), ref.id, ref));
  }

  set(ref, data, options = {}) {
    this._writes.push({ type: 'set', path: ref.path, data: clone(data), options });
  }

  create(ref, data) {
    this._writes.push({ type: 'create', path: ref.path, data: clone(data) });
  }

  update(ref, data) {
    this._writes.push({ type: 'update', path: ref.path, data: clone(data) });
  }

  commit() {
    for (const write of this._writes) {
      if (write.type === 'set') this._db.writeSet(write.path, write.data, write.options);
      else if (write.type === 'create') this._db.writeCreate(write.path, write.data);
      else this._db.writeUpdate(write.path, write.data);
    }
  }
}

class FakeDb {
  constructor(seed = {}) {
    this._store = new Map(Object.entries(seed).map(([key, value]) => [key, clone(value)]));
    this._autoId = 0;
  }

  collection(collectionId) {
    return new FakeCollectionRef(this, [collectionId]);
  }

  async runTransaction(callback) {
    const tx = new FakeTransaction(this);
    const result = await callback(tx);
    tx.commit();
    return result;
  }

  nextAutoId() {
    this._autoId += 1;
    return this._autoId;
  }

  read(documentPath) {
    return this._store.has(documentPath) ? clone(this._store.get(documentPath)) : undefined;
  }

  writeSet(documentPath, data, options = {}) {
    const resolved = resolveServerTimestamps(data);
    if (options.merge === true) {
      this._store.set(documentPath, { ...(this.read(documentPath) || {}), ...clone(resolved) });
      return;
    }
    this._store.set(documentPath, clone(resolved));
  }

  writeCreate(documentPath, data) {
    if (this._store.has(documentPath)) throw new Error(`Document already exists: ${documentPath}`);
    this._store.set(documentPath, resolveServerTimestamps(clone(data)));
  }

  writeUpdate(documentPath, data) {
    if (!this._store.has(documentPath)) throw new Error(`Missing document for update: ${documentPath}`);
    const current = this.read(documentPath);
    Object.entries(data).forEach(([key, value]) => setPath(current, key, value));
    this._store.set(documentPath, current);
  }
}

class FakeDrive {
  constructor(overrides = {}) {
    this.rootFolderId = overrides.rootFolderId || 'root-folder';
    this.folder = overrides.folder;
    this.file = overrides.file;
    this.calls = [];
  }

  async getFolderMetadata(folderId) {
    this.calls.push(['folder', folderId]);
    return clone(this.folder);
  }

  async getFileMetadata(fileId) {
    this.calls.push(['file', fileId]);
    return clone(this.file);
  }
}

function adminStub() {
  return {
    firestore: {
      FieldValue: {
        serverTimestamp: () => ({ __serverTimestamp: true }),
      },
    },
  };
}

function sessionDocument(overrides = {}) {
  return {
    uploadType: 'bod',
    status: 'pending',
    ticketHash: 'ticket-hash',
    uid: 'bod-user',
    role: 'bod',
    eventId: 'event-1',
    eventName: 'Clean Water Drive',
    eventDate: '2026-08-15',
    eventType: 'clubEvent',
    eventStatus: 'synced',
    eventDriveFolderId: '',
    uploadGroupId: 'group-1',
    fileName: 'poster.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 1234,
    expectedFolderName: buildBodEventUploadFolderName({
      eventDate: '2026-08-15',
      eventName: 'Clean Water Drive',
      uploadGroupId: 'group-1',
    }),
    proofHash: hashBodEventFinalizeProof('proof-1'),
    expiresAt: NOW + 60_000,
    createdAt: 'created',
    updatedAt: null,
    finalizedAt: null,
    driveFileId: '',
    driveFolderId: '',
    sha256: '',
    ...overrides,
  };
}

function validFolder(overrides = {}) {
  return {
    id: 'folder-1',
    name: sessionDocument().expectedFolderName,
    mimeType: DRIVE_FOLDER_MIME,
    parents: ['root-folder'],
    trashed: false,
    ...overrides,
  };
}

function validFile(overrides = {}) {
  return {
    id: 'file-1',
    name: 'poster.jpg',
    mimeType: 'image/jpeg',
    size: '1234',
    parents: ['folder-1'],
    trashed: false,
    webViewLink: 'https://drive.google.com/file/d/file-1/view',
    ...overrides,
  };
}

function validPayload(overrides = {}) {
  return {
    uploadType: 'bod',
    finalizeId: 'finalize-1',
    finalizeProof: 'proof-1',
    eventId: 'event-1',
    uploadGroupId: 'group-1',
    driveFileId: 'file-1',
    fileName: 'poster.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 1234,
    driveFolderId: 'folder-1',
    fileUrl: 'https://drive.google.com/file/d/file-1/view',
    sha256: SHA,
    ...overrides,
  };
}

function seedDb(overrides = {}) {
  return new FakeDb({
    'driveUploadFinalizations/finalize-1': sessionDocument(overrides.session),
    'bodEvents/event-1': {
      name: 'Clean Water Drive',
      date: '2026-08-15',
      type: 'clubEvent',
      status: 'synced',
      ...(overrides.event || {}),
    },
    'driveUploadGroups/group-1': {
      uploadGroupId: 'group-1',
      uid: 'bod-user',
      eventId: 'event-1',
      eventName: 'Clean Water Drive',
      eventDate: '2026-08-15',
      ...(overrides.group || {}),
    },
  });
}

function testService(overrides = {}) {
  const drive = overrides.drive || new FakeDrive({
    folder: validFolder(overrides.folder),
    file: validFile(overrides.file),
  });
  const db = overrides.db || seedDb(overrides);
  const service = createBodEventAttachmentService({
    db,
    admin: adminStub(),
    HttpsError: TestHttpsError,
    drive,
    nowMillis: () => NOW,
    maxBytes: 15 * 1024 * 1024,
  });
  return { db, drive, service };
}

test('authoritative event normalization requires active club events', () => {
  const event = normalizeAuthoritativeBodUploadEvent('event-1', {
    name: ' Clean Water Drive ',
    date: '2026-08-15',
    type: 'clubEvent',
    status: 'synced',
    driveFolder: 'https://drive.google.com/drive/folders/folder-1',
  }, TestHttpsError);

  assert.equal(event.eventId, 'event-1');
  assert.equal(event.eventName, 'Clean Water Drive');
  assert.equal(event.eventDate, '2026-08-15');
  assert.equal(event.driveFolderId, 'folder-1');

  for (const raw of [
    { name: 'Meeting', date: '2026-08-15', type: 'bodMeeting' },
    { name: 'Archived', date: '2026-08-15', type: 'clubEvent', archived: true },
    { name: 'Inactive', date: '2026-08-15', type: 'clubEvent', active: false },
    { name: 'Deleted', date: '2026-08-15', type: 'clubEvent', status: 'deleted' },
    { name: 'Historical', date: '2026-08-15', type: 'clubEvent', historicalAt: '2026-08-20' },
  ]) {
    assert.throws(
      () => normalizeAuthoritativeBodUploadEvent('event-1', raw, TestHttpsError),
      (err) => err.code === 'failed-precondition'
    );
  }
});

test('BOD upload event document IDs use strict document ID validation', () => {
  assert.equal(normalizeDocumentId(' event-1 ', 'Event ID', TestHttpsError), 'event-1');

  for (const eventId of ['', 'event/1', 'event\\1', `event${String.fromCharCode(0)}1`]) {
    assert.throws(
      () => normalizeDocumentId(eventId, 'Event ID', TestHttpsError),
      (err) => err.code === 'invalid-argument'
    );
  }
});

test('BOD folder names match Apps Script sanitization', () => {
  assert.equal(
    buildBodEventUploadFolderName({
      eventDate: ' 2026/08/15 ',
      eventName: 'Project: Clean #Water   Drive',
      uploadGroupId: 'group%1',
    }),
    '2026-08-15_Project- Clean -Water Drive_group-1'
  );
});

test('valid finalization creates authoritative attachment without path-derived fields', async () => {
  const { db, drive, service } = testService();
  const result = await service.finalizeAppsScriptUpload(validPayload());
  const attachment = db.read('bodEvents/event-1/attachments/file-1');
  const finalization = db.read('driveUploadFinalizations/finalize-1');
  const group = db.read('driveUploadGroups/group-1');

  assert.deepEqual(result, {
    ok: true,
    unchanged: false,
    eventId: 'event-1',
    uploadGroupId: 'group-1',
    driveFileId: 'file-1',
    attachmentPath: 'bodEvents/event-1/attachments/file-1',
  });
  assert.deepEqual(drive.calls, [['folder', 'folder-1'], ['file', 'file-1']]);
  assert.equal(attachment.storageProvider, BOD_EVENT_ATTACHMENT_STORAGE_PROVIDER);
  assert.equal(attachment.source, BOD_EVENT_ATTACHMENT_SOURCE);
  assert.equal(attachment.fileName, 'poster.jpg');
  assert.equal(attachment.mimeType, 'image/jpeg');
  assert.equal(attachment.sizeBytes, 1234);
  assert.equal(attachment.driveFolderId, 'folder-1');
  assert.equal(attachment.uploadGroupId, 'group-1');
  assert.equal(attachment.uploadedByUid, 'bod-user');
  assert.equal(attachment.sha256, SHA);
  assert.equal(attachment.fileUrl, 'https://drive.google.com/file/d/file-1/view');
  assert.equal(Object.hasOwn(attachment, 'eventId'), false);
  assert.equal(Object.hasOwn(attachment, 'driveFileId'), false);
  assert.equal(Object.hasOwn(attachment, 'driveFolderUrl'), false);
  assert.equal(Object.hasOwn(attachment, 'thumbnailUrl'), false);
  assert.equal(finalization.status, 'finalized');
  assert.equal(finalization.driveFileId, 'file-1');
  assert.equal(finalization.sha256, SHA);
  assert.equal(group.driveFolderId, 'folder-1');
  assert.equal(group.driveFolderName, sessionDocument().expectedFolderName);
});

test('exact retry is idempotent and does not re-read Drive', async () => {
  const { drive, service } = testService();
  await service.finalizeAppsScriptUpload(validPayload());
  const callCount = drive.calls.length;
  const retry = await service.finalizeAppsScriptUpload(validPayload());

  assert.equal(retry.ok, true);
  assert.equal(retry.unchanged, true);
  assert.equal(drive.calls.length, callCount);
});

test('matching pre-existing attachment is not overwritten by pending finalization recovery', async () => {
  const db = seedDb();
  db.writeCreate('bodEvents/event-1/attachments/file-1', {
    storageProvider: BOD_EVENT_ATTACHMENT_STORAGE_PROVIDER,
    fileName: 'poster.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 1234,
    driveFolderId: 'folder-1',
    uploadGroupId: 'group-1',
    uploadedByUid: 'bod-user',
    uploadedAt: 'ORIGINAL_UPLOAD',
    createdAt: 'ORIGINAL_CREATE',
    verifiedAt: 'ORIGINAL_VERIFY',
    source: BOD_EVENT_ATTACHMENT_SOURCE,
    sha256: SHA,
    fileUrl: 'https://drive.google.com/file/d/file-1/view',
  });
  const { service } = testService({ db });

  const result = await service.finalizeAppsScriptUpload(validPayload());
  const attachment = db.read('bodEvents/event-1/attachments/file-1');

  assert.equal(result.ok, true);
  assert.equal(result.unchanged, false);
  assert.equal(attachment.createdAt, 'ORIGINAL_CREATE');
  assert.equal(attachment.uploadedAt, 'ORIGINAL_UPLOAD');
  assert.equal(db.read('driveUploadFinalizations/finalize-1').status, 'finalized');
});

test('conflicting pre-existing attachment rejects and is never overwritten', async () => {
  const db = seedDb();
  db.writeCreate('bodEvents/event-1/attachments/file-1', {
    storageProvider: BOD_EVENT_ATTACHMENT_STORAGE_PROVIDER,
    fileName: 'other.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 1234,
    driveFolderId: 'folder-1',
    uploadGroupId: 'group-1',
    uploadedByUid: 'bod-user',
    uploadedAt: 'ORIGINAL_UPLOAD',
    createdAt: 'ORIGINAL_CREATE',
    verifiedAt: 'ORIGINAL_VERIFY',
    source: BOD_EVENT_ATTACHMENT_SOURCE,
    sha256: SHA,
  });
  const { service } = testService({ db });

  await assert.rejects(
    service.finalizeAppsScriptUpload(validPayload()),
    (err) => err.code === 'already-exists'
  );

  const attachment = db.read('bodEvents/event-1/attachments/file-1');
  assert.equal(attachment.fileName, 'other.jpg');
  assert.equal(attachment.createdAt, 'ORIGINAL_CREATE');
  assert.equal(db.read('driveUploadFinalizations/finalize-1').status, 'pending');
});

test('eventId-bound groups use event identity while legacy groups require matching labels', async () => {
  const renamedStoredLabels = testService({
    group: {
      eventId: 'event-1',
      eventName: 'Old Event Name',
      eventDate: '2026-01-01',
    },
  });
  const success = await renamedStoredLabels.service.finalizeAppsScriptUpload(validPayload());
  assert.equal(success.ok, true);

  const legacyMismatch = testService({
    group: {
      eventId: '',
      eventName: 'Old Event Name',
      eventDate: '2026-01-01',
    },
  });
  await assert.rejects(
    legacyMismatch.service.finalizeAppsScriptUpload(validPayload()),
    (err) => err.code === 'failed-precondition'
  );
});

test('proof, expiry, and SHA validation reject before attachment writes', async () => {
  for (const [label, overrides, payload, code] of [
    ['bad proof', {}, { finalizeProof: 'wrong-proof' }, 'permission-denied'],
    ['expired finalization', { session: { expiresAt: NOW - 1 } }, {}, 'deadline-exceeded'],
    ['wrong event', {}, { eventId: 'event-2' }, 'failed-precondition'],
    ['wrong upload group', {}, { uploadGroupId: 'group-2' }, 'failed-precondition'],
    ['malformed sha', {}, { sha256: 'not-sha' }, 'invalid-argument'],
  ]) {
    const { db, drive, service } = testService(overrides);
    await assert.rejects(
      service.finalizeAppsScriptUpload(validPayload(payload)),
      (err) => err.code === code,
      label
    );
    assert.equal(db.read('bodEvents/event-1/attachments/file-1'), undefined, label);
    assert.equal(drive.calls.length, label === 'malformed sha' ? 0 : 0, label);
  }
});

test('Drive metadata mismatches are rejected', async () => {
  for (const [label, overrides] of [
    ['foreign folder', { folder: { parents: ['other-root'] } }],
    ['trashed folder', { folder: { trashed: true } }],
    ['wrong folder name', { folder: { name: 'wrong-name' } }],
    ['trashed file', { file: { trashed: true } }],
    ['foreign file', { file: { id: 'other-file' } }],
    ['wrong mime', { file: { mimeType: 'image/png' } }],
    ['wrong size', { file: { size: '9999' } }],
    ['wrong file parent', { file: { parents: ['other-folder'] } }],
  ]) {
    const { service } = testService(overrides);
    await assert.rejects(
      service.finalizeAppsScriptUpload(validPayload()),
      (err) => err.code === 'failed-precondition',
      label
    );
  }
});

test('missing BOD root folder configuration fails safely before writes', async () => {
  const db = seedDb();
  const service = createBodEventAttachmentService({
    db,
    admin: adminStub(),
    HttpsError: TestHttpsError,
    env: {},
    nowMillis: () => NOW,
    maxBytes: 15 * 1024 * 1024,
  });

  await assert.rejects(
    service.finalizeAppsScriptUpload(validPayload()),
    (err) => err.code === 'failed-precondition'
      && err.status === 500
      && err.message === 'BOD event upload storage is not configured.'
  );

  assert.equal(db.read('bodEvents/event-1/attachments/file-1'), undefined);
  assert.equal(db.read('driveUploadFinalizations/finalize-1').status, 'pending');
});

test('same group requires the verified folder and replay cannot switch files', async () => {
  const foreignUser = testService({ group: { uid: 'other-user' } });
  await assert.rejects(
    foreignUser.service.finalizeAppsScriptUpload(validPayload()),
    (err) => err.code === 'permission-denied'
  );

  const boundGroup = testService({ group: { driveFolderId: 'different-folder' } });
  await assert.rejects(
    boundGroup.service.finalizeAppsScriptUpload(validPayload()),
    (err) => err.code === 'failed-precondition'
  );

  const finalized = testService({
    session: {
      status: 'finalized',
      driveFileId: 'file-1',
      driveFolderId: 'folder-1',
      sha256: SHA,
    },
  });
  await assert.rejects(
    finalized.service.finalizeAppsScriptUpload(validPayload({
      driveFileId: 'file-2',
    })),
    (err) => err.code === 'already-exists'
  );
  assert.equal(finalized.drive.calls.length, 0);
});

test('index wiring keeps ticket validation backward compatible and finalization server-only', () => {
  const indexSource = readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
  const createTicket = indexSource.slice(
    indexSource.indexOf('exports.createBodUploadTicket'),
    indexSource.indexOf('exports.getBodManagementBoard')
  );
  const authoritativeEventLoader = indexSource.slice(
    indexSource.indexOf('async function loadAuthoritativeBodUploadEvent'),
    indexSource.indexOf('function normalizeDriveTransactionId')
  );
  const validateTicket = indexSource.slice(
    indexSource.indexOf('exports.validateDriveUploadTicket'),
    indexSource.indexOf('exports.finalizeBodEventUpload')
  );
  const groupMatcher = indexSource.slice(
    indexSource.indexOf('function assertBodUploadGroupMatches'),
    indexSource.indexOf('function validateDriveTransactionId')
  );
  const ticketDocWriter = indexSource.slice(
    indexSource.indexOf('async function createDriveUploadTicketDoc'),
    indexSource.indexOf('function sendDriveUploadJson')
  );
  const finalizeEndpoint = indexSource.slice(
    indexSource.indexOf('exports.finalizeBodEventUpload'),
    indexSource.indexOf('exports.completeVisitSubmissionDriveUpload')
  );

  assert.match(createTicket, /loadAuthoritativeBodUploadEvent\(data\.eventId\)/);
  assert.doesNotMatch(createTicket, /normalizeDriveUploadText\(data\.eventName/);
  assert.doesNotMatch(createTicket, /normalizeDriveUploadText\(data\.eventDate/);
  assert.match(createTicket, /eventId: bodEvent\.eventId/);
  assert.match(createTicket, /expectedFolderName/);
  assert.match(groupMatcher, /if \(groupData\.eventId\) \{[\s\S]*groupData\.eventId !== eventId/);
  assert.match(groupMatcher, /shouldBackfillEventId/);
  assert.match(ticketDocWriter, /eventId: bodUploadGroup\.eventId/);
  assert.match(validateTicket, /safeFileName: ticketData\.fileName/);
  assert.match(validateTicket, /eventName: ticketData\.eventName/);
  assert.match(validateTicket, /eventDate: ticketData\.eventDate/);
  assert.match(validateTicket, /uploadType === 'bod' && !!ticketData\.eventId/);
  assert.match(validateTicket, /proofHash: finalizeProofHash/);
  assert.match(validateTicket, /bodResponse\.finalizeProof = finalizeProof/);
  assert.doesNotMatch(validateTicket, /finalizeProof:/);
  assert.match(authoritativeEventLoader, /normalizeBodEventDocumentId\(eventId, 'Event ID', HttpsError\)/);
  assert.match(finalizeEndpoint, /timingSafeSharedSecretMatches\(req\.get\('x-rcph-drive-secret'\), DRIVE_UPLOAD_SHARED_SECRET\.value\(\)\)/);
  assert.match(finalizeEndpoint, /bodEventAttachments\.finalizeAppsScriptUpload\(data\)/);
});

test('attachment schema omits parent-path and document-id authorities', () => {
  const helperSource = readFileSync(path.join(__dirname, 'bod-event-attachments.js'), 'utf8');
  const attachmentBlock = helperSource.slice(
    helperSource.indexOf('const attachment = {'),
    helperSource.indexOf('      };', helperSource.indexOf('const attachment = {'))
  );

  assert.match(attachmentBlock, /storageProvider: BOD_EVENT_ATTACHMENT_STORAGE_PROVIDER/);
  assert.match(attachmentBlock, /source: BOD_EVENT_ATTACHMENT_SOURCE/);
  assert.doesNotMatch(attachmentBlock, /\beventId\b/);
  assert.doesNotMatch(attachmentBlock, /\bdriveFileId\b/);
  assert.doesNotMatch(attachmentBlock, /\bdriveFolderUrl\b/);
  assert.doesNotMatch(attachmentBlock, /\bthumbnailUrl\b/);
});
