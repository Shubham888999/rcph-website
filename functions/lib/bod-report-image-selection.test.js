const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  BOD_REPORT_IMAGE_MIME_TYPES,
  createBodReportImageSelectionService,
} = require('./bod-report-image-selection');
const {
  BOD_EVENT_ATTACHMENT_SOURCE,
  BOD_EVENT_ATTACHMENT_STORAGE_PROVIDER,
} = require('./bod-event-attachments');

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

function resolveSentinels(value) {
  if (Array.isArray(value)) return value.map(resolveSentinels);
  if (value && typeof value === 'object') {
    if (value.__serverTimestamp === true || value.__delete === true) return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveSentinels(item)]));
  }
  return value;
}

function applyUpdate(target, updates) {
  Object.entries(resolveSentinels(updates)).forEach(([key, value]) => {
    if (value && value.__delete === true) {
      delete target[key];
    } else {
      target[key] = clone(value);
    }
  });
}

class FakeSnapshot {
  constructor(data, id) {
    this.id = id;
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
    return Promise.resolve(new FakeSnapshot(this._db.read(this.path), this.id));
  }
}

class FakeCollectionRef {
  constructor(db, pathParts) {
    this._db = db;
    this._pathParts = pathParts;
  }

  doc(documentId) {
    return new FakeDocRef(this._db, [...this._pathParts, documentId]);
  }
}

class FakeTransaction {
  constructor(db) {
    this._db = db;
    this._writes = [];
  }

  get(ref) {
    return Promise.resolve(new FakeSnapshot(this._db.read(ref.path), ref.id));
  }

  update(ref, data) {
    this._writes.push({ path: ref.path, data: clone(data) });
  }

  commit() {
    this._writes.forEach((write) => this._db.writeUpdate(write.path, write.data));
  }
}

class FakeDb {
  constructor(seed = {}) {
    this._store = new Map(Object.entries(seed).map(([key, value]) => [key, clone(value)]));
    this.updates = [];
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

  read(documentPath) {
    return this._store.has(documentPath) ? clone(this._store.get(documentPath)) : undefined;
  }

  writeUpdate(documentPath, data) {
    if (!this._store.has(documentPath)) throw new Error(`Missing document for update: ${documentPath}`);
    const current = this.read(documentPath);
    applyUpdate(current, data);
    this._store.set(documentPath, current);
    this.updates.push({ path: documentPath, data: resolveSentinels(clone(data)) });
  }
}

function adminStub() {
  return {
    firestore: {
      FieldValue: {
        delete: () => ({ __delete: true }),
        serverTimestamp: () => ({ __serverTimestamp: true }),
      },
    },
  };
}

function eventDoc(overrides = {}) {
  return {
    name: 'Clean Water Drive',
    date: '2026-08-15',
    type: 'clubEvent',
    status: 'synced',
    description: 'Public summary',
    driveFolderId: 'legacy-folder',
    ...overrides,
  };
}

function attachmentDoc(overrides = {}) {
  return {
    storageProvider: BOD_EVENT_ATTACHMENT_STORAGE_PROVIDER,
    source: BOD_EVENT_ATTACHMENT_SOURCE,
    fileName: 'poster.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 1234,
    driveFolderId: 'folder-1',
    uploadGroupId: 'group-1',
    uploadedByUid: 'bod-user',
    sha256: 'a'.repeat(64),
    fileUrl: 'https://drive.google.com/file/d/file-1/view',
    ...overrides,
  };
}

function seedDb(overrides = {}) {
  const seed = {
    'bodEvents/event-1': eventDoc(overrides.event),
    'bodEvents/event-1/attachments/file-1': attachmentDoc(overrides.attachment),
    'bodEvents/event-2': eventDoc({ name: 'Other Event' }),
    'bodEvents/event-2/attachments/other-file': attachmentDoc({ fileName: 'other.jpg' }),
    ...(overrides.seed || {}),
  };
  if (overrides.deleteAttachment) delete seed['bodEvents/event-1/attachments/file-1'];
  return new FakeDb(seed);
}

function testService(overrides = {}) {
  const db = overrides.db || seedDb(overrides);
  const service = createBodReportImageSelectionService({
    db,
    admin: adminStub(),
    HttpsError: TestHttpsError,
  });
  return { db, service };
}

async function rejectsWith(fn, code) {
  await assert.rejects(fn, (err) => err.code === code);
}

test('valid JPEG selection succeeds and updates only report image fields', async () => {
  const { db, service } = testService();
  const beforeAttachment = db.read('bodEvents/event-1/attachments/file-1');
  const result = await service.setReportImage('actor-1', { eventId: 'event-1', fileId: 'file-1' });
  const event = db.read('bodEvents/event-1');

  assert.deepEqual(result, {
    ok: true,
    eventId: 'event-1',
    reportImageFileId: 'file-1',
    unchanged: false,
  });
  assert.equal(event.reportImageFileId, 'file-1');
  assert.equal(event.name, 'Clean Water Drive');
  assert.equal(event.description, 'Public summary');
  assert.equal(event.driveFolderId, 'legacy-folder');
  assert.equal(event.reportImageUpdatedByUid, 'actor-1');
  assert.deepEqual(db.read('bodEvents/event-1/attachments/file-1'), beforeAttachment);
});

test('valid PNG and WebP selections succeed', async () => {
  for (const mimeType of ['image/png', 'image/webp']) {
    const { service } = testService({ attachment: { mimeType } });
    const result = await service.setReportImage('actor-1', { eventId: 'event-1', fileId: 'file-1' });
    assert.equal(result.ok, true);
    assert.equal(result.reportImageFileId, 'file-1');
  }
});

test('report image MIME allowlist is exactly JPEG PNG and WebP', () => {
  assert.deepEqual(BOD_REPORT_IMAGE_MIME_TYPES, ['image/jpeg', 'image/png', 'image/webp']);
});

test('PDF and malformed authoritative attachment fields are rejected', async () => {
  for (const attachment of [
    { mimeType: 'application/pdf' },
    { source: 'browser' },
    { storageProvider: 'publicUrl' },
    { sizeBytes: 0 },
    { driveFolderId: '' },
    { sha256: 'ABC' },
  ]) {
    const { service } = testService({ attachment });
    await rejectsWith(
      () => service.setReportImage('actor-1', { eventId: 'event-1', fileId: 'file-1' }),
      'failed-precondition'
    );
  }
});

test('missing attachment and another event attachment cannot be selected', async () => {
  const missing = testService({ deleteAttachment: true });
  await rejectsWith(
    () => missing.service.setReportImage('actor-1', { eventId: 'event-1', fileId: 'file-1' }),
    'not-found'
  );

  const otherEvent = testService();
  await rejectsWith(
    () => otherEvent.service.setReportImage('actor-1', { eventId: 'event-1', fileId: 'other-file' }),
    'not-found'
  );
});

test('archived inactive events and BOD meetings are rejected', async () => {
  for (const event of [
    { archived: true },
    { active: false },
    { status: 'deleted' },
    { removedAt: '2026-08-20' },
    { type: 'bodMeeting' },
  ]) {
    const { service } = testService({ event });
    await rejectsWith(
      () => service.setReportImage('actor-1', { eventId: 'event-1', fileId: 'file-1' }),
      'failed-precondition'
    );
  }
});

test('clearing selection deletes reportImageFileId and absent clear is unchanged', async () => {
  const selected = testService({ event: { reportImageFileId: 'file-1' } });
  const cleared = await selected.service.setReportImage('actor-1', { eventId: 'event-1', fileId: '' });
  assert.deepEqual(cleared, {
    ok: true,
    eventId: 'event-1',
    reportImageFileId: '',
    unchanged: false,
  });
  assert.equal(Object.hasOwn(selected.db.read('bodEvents/event-1'), 'reportImageFileId'), false);

  const absent = testService();
  const unchanged = await absent.service.setReportImage('actor-1', { eventId: 'event-1', fileId: null });
  assert.deepEqual(unchanged, {
    ok: true,
    eventId: 'event-1',
    reportImageFileId: '',
    unchanged: true,
  });
  assert.equal(absent.db.updates.length, 0);
});

test('existing valid selection is unchanged but still requires eligible attachment', async () => {
  const valid = testService({ event: { reportImageFileId: 'file-1' } });
  const result = await valid.service.setReportImage('actor-1', { eventId: 'event-1', fileId: 'file-1' });
  assert.equal(result.unchanged, true);
  assert.equal(valid.db.updates.length, 0);

  const missing = testService({ event: { reportImageFileId: 'file-1' }, deleteAttachment: true });
  await rejectsWith(
    () => missing.service.setReportImage('actor-1', { eventId: 'event-1', fileId: 'file-1' }),
    'not-found'
  );

  const invalid = testService({ event: { reportImageFileId: 'file-1' }, attachment: { mimeType: 'application/pdf' } });
  await rejectsWith(
    () => invalid.service.setReportImage('actor-1', { eventId: 'event-1', fileId: 'file-1' }),
    'failed-precondition'
  );
});

test('malformed request identity is rejected before writes', async () => {
  const { db, service } = testService();
  await rejectsWith(() => service.setReportImage('', { eventId: 'event-1', fileId: 'file-1' }), 'invalid-argument');
  await rejectsWith(() => service.setReportImage('actor-1', { eventId: 'event/1', fileId: 'file-1' }), 'invalid-argument');
  await rejectsWith(() => service.setReportImage('actor-1', { eventId: 'event-1', fileId: 'folder/file' }), 'invalid-argument');
  assert.equal(db.updates.length, 0);
});

test('index callable wiring requires auth BOD role and approved active account', () => {
  const indexSource = readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
  const callable = indexSource.slice(
    indexSource.indexOf('exports.setBodReportImage'),
    indexSource.indexOf('exports.getBodAvenueReportDirectors')
  );

  assert.match(indexSource, /createBodReportImageSelectionService/);
  assert.match(callable, /requireAuth\(request\)/);
  assert.match(callable, /assertBodAdminOrPresident\(uid\)/);
  assert.match(callable, /assertApprovedActiveCallableAccount\(uid\)/);
  assert.match(callable, /bodReportImageSelection\.setReportImage\(uid, request\.data \|\| \{\}\)/);
});
