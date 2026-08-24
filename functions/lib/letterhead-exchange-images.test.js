'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const {
  IMAGE_ACCESS_SESSION_COLLECTION,
  IMAGE_MAX_BYTES,
  IMAGE_MAX_COUNT,
  IMAGE_MIME_TYPES,
  IMAGE_UPLOAD_SESSION_COLLECTION,
  buildExchangeFolderName,
  createLetterheadExchangeImageService,
  getLetterheadExchangeDriveConfig,
  normalizeExpectedFile,
  proofMatches,
  sniffMimeType,
} = require('./letterhead-exchange-images');
const { LETTERHEAD_EXCHANGES_COLLECTION } = require('./letterhead-exchanges');

const NOW = Date.parse('2026-08-21T12:00:00.000Z');
const EXCHANGE_ID = 'exchange-1';
const UID = 'bod-uid';
const ORIGIN = 'http://localhost:5173';

class TestHttpsError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

class FakeTimestamp {
  constructor(millis) {
    this.millis = millis;
  }

  toMillis() {
    return this.millis;
  }

  toDate() {
    return new Date(this.millis);
  }

  toJSON() {
    return this.toDate().toISOString();
  }
}

function clone(value) {
  if (value instanceof FakeTimestamp) return new FakeTimestamp(value.millis);
  if (value instanceof Date) return new Date(value.getTime());
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
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
  cursor[parts.at(-1)] = clone(value);
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

  get() {
    return Promise.resolve(new FakeSnapshot(this._db.read(this.path), this.id, this));
  }

  set(data, options = {}) {
    this._db.writeSet(this.path, data, options);
    return Promise.resolve();
  }

  update(data) {
    this._db.writeUpdate(this.path, data);
    return Promise.resolve();
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

  get() {
    return Promise.resolve({ docs: this._db.collectionDocs(this._pathParts.join('/')) });
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

  update(ref, data) {
    this._writes.push({ type: 'update', path: ref.path, data: clone(data) });
  }

  commit() {
    for (const write of this._writes) {
      if (write.type === 'set') this._db.writeSet(write.path, write.data, write.options);
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

  seed(documentPath, data) {
    this._store.set(documentPath, clone(data));
  }

  writeSet(documentPath, data, options = {}) {
    const resolved = clone(data);
    if (options.merge === true) {
      this._store.set(documentPath, { ...(this.read(documentPath) || {}), ...resolved });
      return;
    }
    this._store.set(documentPath, resolved);
  }

  writeUpdate(documentPath, data) {
    if (!this._store.has(documentPath)) throw new Error(`Missing document for update: ${documentPath}`);
    const current = this.read(documentPath);
    Object.entries(data).forEach(([key, value]) => setPath(current, key, value));
    this._store.set(documentPath, current);
  }

  collectionDocs(collectionPath) {
    const prefix = `${collectionPath}/`;
    return Array.from(this._store.keys())
      .filter(documentPath => documentPath.startsWith(prefix))
      .filter(documentPath => documentPath.slice(prefix.length).split('/').length === 1)
      .sort()
      .map(documentPath => new FakeSnapshot(
        this.read(documentPath),
        documentPath.split('/').at(-1),
        new FakeDocRef(this, documentPath.split('/'))
      ));
  }

  paths() {
    return Array.from(this._store.keys()).sort();
  }
}

class FakeDrive {
  constructor() {
    this.folders = [];
    this.files = new Map();
    this.fileBytes = new Map();
    this.ensureCalls = [];
    this.uploadCalls = [];
    this.downloadCalls = [];
    this.nextFile = 0;
  }

  async ensureExchangeFolder(input) {
    this.ensureCalls.push(clone(input));
    const existing = this.folders.find(folder => folder.name === input.folderName);
    if (existing) return clone(existing);
    const folder = {
      id: `folder-${this.folders.length + 1}`,
      name: input.folderName,
    };
    this.folders.push(clone(folder));
    return folder;
  }

  async uploadImageFile(input) {
    this.uploadCalls.push({
      ...clone(input),
      buffer: undefined,
    });
    this.nextFile += 1;
    const file = {
      id: `drive-file-${this.nextFile}`,
      name: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.buffer.length,
      parents: [input.folderId],
      appProperties: clone(input.appProperties),
      trashed: false,
    };
    this.files.set(file.id, clone(file));
    this.fileBytes.set(file.id, Buffer.from(input.buffer));
    return clone(file);
  }

  async getFileMetadata(fileId) {
    const file = this.files.get(fileId);
    if (!file) {
      const error = new Error('Drive file missing.');
      error.code = 'not-found';
      throw error;
    }
    return clone(file);
  }

  async downloadFile(fileId) {
    this.downloadCalls.push(fileId);
    const bytes = this.fileBytes.get(fileId);
    if (!bytes) {
      const error = new Error('Drive file missing.');
      error.code = 'not-found';
      throw error;
    }
    return Buffer.from(bytes);
  }
}

const admin = {
  firestore: {
    Timestamp: {
      fromMillis: millis => new FakeTimestamp(millis),
    },
    FieldValue: {
      serverTimestamp: () => new FakeTimestamp(NOW),
    },
  },
};

function createJpegBytes(extra = []) {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, ...extra]);
}

function createPngBytes(extra = []) {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...extra]);
}

function createWebpBytes(extra = []) {
  return Buffer.concat([Buffer.from('RIFF1234WEBPVP8 ', 'ascii'), Buffer.from(extra)]);
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function storedImage(index = 1, overrides = {}) {
  const bytes = createJpegBytes([index]);
  return {
    imageId: `existing-${index}`,
    storageProvider: 'googleDrive',
    driveFileId: `drive-existing-${index}`,
    fileName: `existing-${index}.jpg`,
    mimeType: 'image/jpeg',
    sizeBytes: bytes.length,
    sha256: sha256(bytes),
    uploadedAt: '2026-08-20T12:00:00.000Z',
    uploadedByUid: 'admin-uid',
    uploadedByName: 'Admin User',
    uploadSessionId: `existing-${index}`,
    ...overrides,
  };
}

function exchangeDoc(overrides = {}) {
  const data = {
    schemaVersion: 1,
    exchangeDate: '2026-08-21',
    exchangeMonth: '2026-08',
    externalParticipants: [
      { clubName: 'Rotaract Club A', rotaractorName: 'External One', position: 'President' },
      { clubName: 'Rotaract Club B', rotaractorName: 'External Two', position: 'Secretary' },
      { clubName: 'Rotaract Club A', rotaractorName: 'External Three', position: 'Member' },
    ],
    rcphRepresentatives: [{ memberId: 'm1', name: 'RCPH Member', activeAtCreation: true }],
    rcphMemberIds: ['m1'],
    associatedEvent: null,
    other: '',
    images: [],
    imageCount: 0,
    driveFolderId: '',
    driveFolderName: '',
    status: 'active',
    createdAt: '2026-08-21T10:00:00.000Z',
    createdByUid: 'creator-uid',
    createdByName: 'Creator',
    createdByRole: 'bod',
    updatedAt: '2026-08-21T10:00:00.000Z',
    updatedByUid: 'creator-uid',
    updatedByName: 'Creator',
    ...overrides,
  };
  if (!Object.hasOwn(overrides, 'imageCount')) {
    data.imageCount = Array.isArray(data.images) ? data.images.length : 0;
  }
  return data;
}

function initializedDb(overrides = {}) {
  return new FakeDb({
    [`${LETTERHEAD_EXCHANGES_COLLECTION}/${EXCHANGE_ID}`]: exchangeDoc(overrides),
  });
}

function createServices({
  db = initializedDb(),
  role = 'bod',
  approved = true,
  drive = new FakeDrive(),
  parseMultipartUpload,
  allowedOrigins = [ORIGIN],
  logs = [],
  nowMillis = () => NOW,
} = {}) {
  const service = createLetterheadExchangeImageService({
    db,
    admin,
    HttpsError: TestHttpsError,
    drive,
    parseMultipartUpload,
    nowMillis,
    uploadEndpoint: 'http://upload.local/letterhead',
    downloadEndpoint: 'http://download.local/letterhead',
    allowedOrigins,
    logger: { warn: () => {} },
    assertLetterheadExchangeAccess: async (uid) => {
      if (!uid) throw new TestHttpsError('unauthenticated', 'Sign in required.');
      if (!approved || !['bod', 'admin', 'president'].includes(role)) {
        throw new TestHttpsError('permission-denied', 'Approved BOD Tools access required.');
      }
      return { uid, role };
    },
    getActorProfile: async () => ({ name: 'Rtr. Image Uploader' }),
    writeLog: async entry => logs.push(clone(entry)),
  });
  return { db, drive, logs, service };
}

function fileInput(overrides = {}) {
  const { bytes: rawBytes, ...rest } = overrides;
  const bytes = rawBytes || createJpegBytes();
  const mimeType = rest.mimeType || 'image/jpeg';
  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  return {
    fileName: `letterhead.${extension}`,
    mimeType,
    sizeBytes: bytes.length,
    ...rest,
  };
}

async function createSession(service, overrides = {}) {
  return service.createUploadSession(
    UID,
    {
      exchangeId: EXCHANGE_ID,
      files: [fileInput(overrides)],
    },
    { request: { auth: { uid: UID } } }
  );
}

function uploadRequest({ method = 'POST', origin = ORIGIN } = {}) {
  return {
    method,
    headers: origin ? { origin } : {},
    get: name => (String(name).toLowerCase() === 'origin' ? origin || '' : ''),
  };
}

function fakeResponse() {
  return {
    statusCode: 0,
    headers: {},
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    set(key, value) {
      this.headers[key] = value;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
    send(payload) {
      if (
        typeof payload === 'string'
        && String(this.headers['Content-Type'] || '').includes('application/json')
      ) {
        this.payload = JSON.parse(payload);
      } else {
        this.payload = payload;
      }
      return this;
    },
  };
}

async function uploadImage({ service, setParser, session, bytes = createJpegBytes(), mimeType = 'image/jpeg', fileName = 'letterhead.jpg' }) {
  setParser(async () => ({
    fields: {
      exchangeId: EXCHANGE_ID,
      sessionId: session.sessions[0].sessionId,
      proof: session.sessions[0].proof,
      fileName,
      mimeType,
      sizeBytes: String(bytes.length),
    },
    file: {
      mimeType,
      sizeBytes: bytes.length,
      buffer: bytes,
    },
  }));
  const response = fakeResponse();
  await service.uploadHttp(uploadRequest(), response);
  return response;
}

async function createUploadedImageServices() {
  let parser;
  const services = createServices({ parseMultipartUpload: (...args) => parser(...args) });
  const bytes = createJpegBytes();
  const session = await createSession(services.service, {
    fileName: 'letterhead.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: bytes.length,
  });
  const upload = await uploadImage({
    service: services.service,
    setParser: nextParser => {
      parser = nextParser;
    },
    session,
    bytes,
  });
  assert.equal(upload.statusCode, 200);
  return { ...services, bytes, session };
}

test('helper primitives enforce image contracts and Drive root configuration', () => {
  assert.deepEqual(
    getLetterheadExchangeDriveConfig({
      LETTERHEAD_EXCHANGES_ROOT_FOLDER_ID: 'root-folder',
    }),
    { authMode: 'oauth', rootFolderId: 'root-folder' }
  );
  assert.deepEqual(
    getLetterheadExchangeDriveConfig({
      LETTERHEAD_EXCHANGES_DRIVE_AUTH_MODE: 'shared-drive',
      LETTERHEAD_EXCHANGES_ROOT_FOLDER_ID: 'root-folder',
    }),
    { authMode: 'shared-drive', rootFolderId: 'root-folder' }
  );
  assert.throws(
    () => getLetterheadExchangeDriveConfig({ LETTERHEAD_EXCHANGES_DRIVE_AUTH_MODE: 'oauth' }),
    /Letterhead Exchange image storage is not configured/
  );

  assert.equal(
    buildExchangeFolderName('abc12345long', exchangeDoc()),
    '2026-08-21 - Rotaract Club A + 1 - abc12345'
  );
  assert.equal(sniffMimeType(createJpegBytes()), 'image/jpeg');
  assert.equal(sniffMimeType(createPngBytes()), 'image/png');
  assert.equal(sniffMimeType(createWebpBytes()), 'image/webp');
  assert.equal(IMAGE_MIME_TYPES.includes('image/svg+xml'), false);

  for (const [fileName, mimeType] of [
    ['scan.jpg', 'image/jpeg'],
    ['scan.jpeg', 'image/jpeg'],
    ['scan.png', 'image/png'],
    ['scan.webp', 'image/webp'],
  ]) {
    assert.equal(normalizeExpectedFile({ fileName, mimeType, sizeBytes: 1 }, TestHttpsError).mimeType, mimeType);
  }

  for (const bad of [
    { fileName: 'scan.pdf', mimeType: 'application/pdf', sizeBytes: 1 },
    { fileName: 'scan.gif', mimeType: 'image/gif', sizeBytes: 1 },
    { fileName: 'scan.svg', mimeType: 'image/svg+xml', sizeBytes: 1 },
    { fileName: 'scan.heic', mimeType: 'image/heic', sizeBytes: 1 },
    { fileName: 'scan.png', mimeType: 'image/jpeg', sizeBytes: 1 },
    { fileName: 'scan.jpg', mimeType: 'image/jpeg', sizeBytes: 0 },
    { fileName: 'scan.jpg', mimeType: 'image/jpeg', sizeBytes: IMAGE_MAX_BYTES + 1 },
    { fileName: 'scan.jpg', mimeType: 'image/jpeg', sizeBytes: 1, driveFileId: 'browser-value' },
  ]) {
    assert.throws(() => normalizeExpectedFile(bad, TestHttpsError), { code: 'invalid-argument' });
  }
});

test('upload session authorization allows BOD, admin, and president only', async () => {
  await assert.rejects(
    () => createServices().service.createUploadSession('', { exchangeId: EXCHANGE_ID, files: [fileInput()] }),
    { code: 'unauthenticated' }
  );
  await assert.rejects(
    () => createSession(createServices({ role: 'gbm' }).service),
    { code: 'permission-denied' }
  );
  await assert.rejects(
    () => createSession(createServices({ role: 'bod', approved: false }).service),
    { code: 'permission-denied' }
  );

  for (const role of ['bod', 'admin', 'president']) {
    const result = await createSession(createServices({ role }).service);
    assert.equal(result.ok, true);
  }
});

test('create session lazily creates one trusted Drive folder and stores no proofs', async () => {
  const { db, drive, logs, service } = createServices();
  const result = await service.createUploadSession(
    UID,
    {
      exchangeId: EXCHANGE_ID,
      files: [
        fileInput({ fileName: 'first.jpg', mimeType: 'image/jpeg', sizeBytes: createJpegBytes().length }),
        fileInput({ fileName: 'second.png', mimeType: 'image/png', sizeBytes: createPngBytes().length }),
      ],
    },
    { request: { auth: { uid: UID } } }
  );

  assert.equal(result.ok, true);
  assert.equal(result.maxSizeBytes, IMAGE_MAX_BYTES);
  assert.equal(result.maxImages, IMAGE_MAX_COUNT);
  assert.equal(result.uploadEndpoint, 'http://upload.local/letterhead');
  assert.equal(result.sessions.length, 2);
  assert.equal(drive.ensureCalls.length, 1);
  assert.equal(drive.uploadCalls.length, 0);

  const exchange = db.read(`${LETTERHEAD_EXCHANGES_COLLECTION}/${EXCHANGE_ID}`);
  assert.equal(exchange.driveFolderId, 'folder-1');
  assert.equal(exchange.driveFolderName, '2026-08-21 - Rotaract Club A + 1 - exchange');
  assert.equal(exchange.driveFolderStatus, 'ready');

  const stored = db.read(`${IMAGE_UPLOAD_SESSION_COLLECTION}/${result.sessions[0].sessionId}`);
  assert.equal(stored.status, 'pending');
  assert.equal(stored.driveFolderId, 'folder-1');
  assert.equal(stored.expected.fileName, 'first.jpg');
  assert.equal(proofMatches(result.sessions[0].proof, stored.proofHash), true);
  assert.equal(Object.hasOwn(stored, 'proof'), false);

  await createSession(service, { fileName: 'third.jpg' });
  assert.equal(drive.ensureCalls.length, 1);
  assert.equal(logs[0].action, 'image_upload_session_created');
  assert.equal(logs[0].metadata.requestedImageCount, 2);
});

test('image count limits are enforced before and during session creation', async () => {
  await assert.rejects(
    () => createServices().service.createUploadSession(UID, { exchangeId: EXCHANGE_ID, files: [] }),
    { code: 'invalid-argument' }
  );
  await assert.rejects(
    () => createServices().service.createUploadSession(UID, {
      exchangeId: EXCHANGE_ID,
      files: Array.from({ length: IMAGE_MAX_COUNT + 1 }, (_, index) => fileInput({ fileName: `scan-${index}.jpg` })),
    }),
    { code: 'invalid-argument' }
  );

  const sevenImages = Array.from({ length: 7 }, (_, index) => storedImage(index + 1));
  const allowed = await createServices({
    db: initializedDb({ images: sevenImages }),
  }).service.createUploadSession(UID, {
    exchangeId: EXCHANGE_ID,
    files: [fileInput({ fileName: 'a.jpg' }), fileInput({ fileName: 'b.jpg' }), fileInput({ fileName: 'c.jpg' })],
  });
  assert.equal(allowed.sessions.length, 3);

  await assert.rejects(
    () => createServices({
      db: initializedDb({ images: sevenImages }),
    }).service.createUploadSession(UID, {
      exchangeId: EXCHANGE_ID,
      files: [fileInput({ fileName: 'a.jpg' }), fileInput({ fileName: 'b.jpg' }), fileInput({ fileName: 'c.jpg' }), fileInput({ fileName: 'd.jpg' })],
    }),
    { code: 'resource-exhausted' }
  );

  await assert.rejects(
    () => createServices({
      db: initializedDb({ images: Array.from({ length: IMAGE_MAX_COUNT }, (_, index) => storedImage(index + 1)) }),
    }).service.createUploadSession(UID, { exchangeId: EXCHANGE_ID, files: [fileInput()] }),
    { code: 'resource-exhausted' }
  );
});

test('HTTP upload accepts private JPG, PNG, and WebP and rejects tampered requests', async () => {
  for (const [mimeType, bytes, fileName] of [
    ['image/jpeg', createJpegBytes(), 'letterhead.jpg'],
    ['image/png', createPngBytes(), 'letterhead.png'],
    ['image/webp', createWebpBytes(), 'letterhead.webp'],
  ]) {
    let parser;
    const { db, drive, service } = createServices({ parseMultipartUpload: (...args) => parser(...args) });
    const session = await createSession(service, { fileName, mimeType, sizeBytes: bytes.length });
    const response = await uploadImage({
      service,
      setParser: nextParser => {
        parser = nextParser;
      },
      session,
      bytes,
      mimeType,
      fileName,
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.payload.ok, true);
    assert.equal(response.payload.uploaded.mimeType, mimeType);
    assert.equal(Object.hasOwn(response.payload.uploaded, 'driveFileId'), false);
    assert.equal(db.read(`${IMAGE_UPLOAD_SESSION_COLLECTION}/${session.sessions[0].sessionId}`).status, 'uploaded');
    assert.equal(drive.uploadCalls.length, 1);
    assert.equal(drive.uploadCalls[0].appProperties.documentType, 'letterhead-exchange-image');
    assert.equal(drive.uploadCalls[0].appProperties.exchangeId, EXCHANGE_ID);
    assert.equal(drive.uploadCalls[0].appProperties.uploadSessionId, session.sessions[0].sessionId);
  }

  {
    let parser;
    const { service } = createServices({
      allowedOrigins: [/^http:\/\/localhost:\d+$/],
      parseMultipartUpload: (...args) => parser(...args),
    });
    const bytes = createJpegBytes();
    const session = await createSession(service, { fileName: 'letterhead.jpg', mimeType: 'image/jpeg', sizeBytes: bytes.length });
    const response = await uploadImage({
      service,
      setParser: nextParser => {
        parser = nextParser;
      },
      session,
      bytes,
    });
    assert.equal(response.statusCode, 200);
  }

  const noOrigin = fakeResponse();
  await createServices().service.uploadHttp(uploadRequest({ origin: '' }), noOrigin);
  assert.equal(noOrigin.statusCode, 403);

  const method = fakeResponse();
  await createServices().service.uploadHttp(uploadRequest({ method: 'GET' }), method);
  assert.equal(method.statusCode, 405);

  for (const item of [
    { name: 'proof', fields: { proof: 'wrong-proof' }, code: 'permission-denied' },
    { name: 'mime', fileMimeType: 'image/png', code: 'invalid-argument' },
    { name: 'forbidden', fields: { driveFileId: 'client-drive-id' }, code: 'invalid-argument' },
  ]) {
    let parser;
    const { db, service } = createServices({ parseMultipartUpload: (...args) => parser(...args) });
    const bytes = createJpegBytes();
    const session = await createSession(service, { fileName: 'letterhead.jpg', mimeType: 'image/jpeg', sizeBytes: bytes.length });
    parser = async () => ({
      fields: {
        exchangeId: EXCHANGE_ID,
        sessionId: session.sessions[0].sessionId,
        proof: session.sessions[0].proof,
        fileName: 'letterhead.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: String(bytes.length),
        ...(item.fields || {}),
      },
      file: {
        mimeType: item.fileMimeType || 'image/jpeg',
        sizeBytes: bytes.length,
        buffer: bytes,
      },
    });
    const response = fakeResponse();
    await service.uploadHttp(uploadRequest(), response);
    assert.notEqual(response.statusCode, 200, item.name);
    assert.equal(response.payload.code, item.code);
    assert.equal(db.read(`${IMAGE_UPLOAD_SESSION_COLLECTION}/${session.sessions[0].sessionId}`).status, 'pending');
  }
});

test('HTTP upload marks a reserved session failed when Drive upload fails and a new session can retry', async () => {
  let parser;
  const drive = new FakeDrive();
  drive.uploadImageFile = async () => {
    const error = new Error('Drive upload failed.');
    error.code = 'internal';
    throw error;
  };
  const { db, service } = createServices({
    drive,
    parseMultipartUpload: (...args) => parser(...args),
  });
  const bytes = createJpegBytes();
  const session = await createSession(service, { fileName: 'letterhead.jpg', mimeType: 'image/jpeg', sizeBytes: bytes.length });
  const response = await uploadImage({
    service,
    setParser: nextParser => {
      parser = nextParser;
    },
    session,
    bytes,
  });

  assert.equal(response.statusCode, 500);
  assert.equal(response.payload.code, 'internal');
  assert.equal(db.read(`${IMAGE_UPLOAD_SESSION_COLLECTION}/${session.sessions[0].sessionId}`).status, 'failed');
  assert.deepEqual(db.read(`${LETTERHEAD_EXCHANGES_COLLECTION}/${EXCHANGE_ID}`).images, []);

  const retryDrive = new FakeDrive();
  const retry = createServices({
    db,
    drive: retryDrive,
    parseMultipartUpload: (...args) => parser(...args),
  });
  const retrySession = await createSession(retry.service, { fileName: 'letterhead.jpg', mimeType: 'image/jpeg', sizeBytes: bytes.length });
  const retryResponse = await uploadImage({
    service: retry.service,
    setParser: nextParser => {
      parser = nextParser;
    },
    session: retrySession,
    bytes,
  });
  assert.equal(retryResponse.statusCode, 200);
});

test('finalize appends trusted metadata, hides Drive IDs, logs once, and is idempotent', async () => {
  const { db, logs, service, session } = await createUploadedImageServices();
  assert.deepEqual(db.read(`${LETTERHEAD_EXCHANGES_COLLECTION}/${EXCHANGE_ID}`).images, []);

  const finalized = await service.finalizeUpload(
    UID,
    { exchangeId: EXCHANGE_ID, sessionId: session.sessions[0].sessionId },
    { request: { auth: { uid: UID } } }
  );

  assert.equal(finalized.ok, true);
  assert.equal(finalized.unchanged, false);
  assert.equal(finalized.exchange.imageCount, 1);
  assert.equal(Object.hasOwn(finalized.exchange, 'driveFolderId'), false);
  assert.equal(Object.hasOwn(finalized.image, 'driveFileId'), false);
  assert.equal(Object.hasOwn(finalized.image, 'sha256'), false);
  assert.equal(finalized.image.uploadedByName, 'Image Uploader');

  const storedExchange = db.read(`${LETTERHEAD_EXCHANGES_COLLECTION}/${EXCHANGE_ID}`);
  assert.equal(storedExchange.imageCount, 1);
  assert.equal(storedExchange.images[0].driveFileId, 'drive-file-1');
  assert.equal(storedExchange.images[0].sha256, sha256(createJpegBytes()));
  assert.equal(db.read(`${IMAGE_UPLOAD_SESSION_COLLECTION}/${session.sessions[0].sessionId}`).status, 'finalized');
  assert.deepEqual(logs.map(log => log.action), ['image_upload_session_created', 'image_uploaded']);

  const beforeRetryPaths = db.paths().map(path => [path, db.read(path)]);
  const retry = await service.finalizeUpload(
    UID,
    { exchangeId: EXCHANGE_ID, sessionId: session.sessions[0].sessionId },
    { request: { auth: { uid: UID } } }
  );
  assert.equal(retry.ok, true);
  assert.equal(retry.unchanged, true);
  assert.deepEqual(db.paths().map(path => [path, db.read(path)]), beforeRetryPaths);
  assert.deepEqual(logs.map(log => log.action), ['image_upload_session_created', 'image_uploaded']);
});

test('finalize rejects wrong owners, wrong exchanges, tampered Drive metadata, and full exchanges', async () => {
  {
    const { service, session } = await createUploadedImageServices();
    await assert.rejects(
      () => service.finalizeUpload('other-uid', { exchangeId: EXCHANGE_ID, sessionId: session.sessions[0].sessionId }),
      { code: 'permission-denied' }
    );
  }

  {
    const { db, service, session } = await createUploadedImageServices();
    db.seed(`${LETTERHEAD_EXCHANGES_COLLECTION}/exchange-2`, exchangeDoc({ exchangeDate: '2026-08-22' }));
    await assert.rejects(
      () => service.finalizeUpload(UID, { exchangeId: 'exchange-2', sessionId: session.sessions[0].sessionId }),
      { code: 'failed-precondition' }
    );
  }

  {
    const { db, drive, service, session } = await createUploadedImageServices();
    const file = drive.files.get('drive-file-1');
    file.parents = ['wrong-folder'];
    drive.files.set('drive-file-1', file);
    await assert.rejects(
      () => service.finalizeUpload(UID, { exchangeId: EXCHANGE_ID, sessionId: session.sessions[0].sessionId }),
      { code: 'failed-precondition' }
    );
    assert.equal(db.read(`${IMAGE_UPLOAD_SESSION_COLLECTION}/${session.sessions[0].sessionId}`).status, 'uploaded');
    assert.deepEqual(db.read(`${LETTERHEAD_EXCHANGES_COLLECTION}/${EXCHANGE_ID}`).images, []);
  }

  {
    let parser;
    const db = initializedDb({ images: Array.from({ length: IMAGE_MAX_COUNT - 1 }, (_, index) => storedImage(index + 1)) });
    const { service } = createServices({ db, parseMultipartUpload: (...args) => parser(...args) });
    const bytes = createJpegBytes();
    const first = await createSession(service, { fileName: 'first.jpg', mimeType: 'image/jpeg', sizeBytes: bytes.length });
    const second = await createSession(service, { fileName: 'second.jpg', mimeType: 'image/jpeg', sizeBytes: bytes.length });

    await uploadImage({
      service,
      setParser: nextParser => {
        parser = nextParser;
      },
      session: first,
      bytes,
      fileName: 'first.jpg',
    });
    await uploadImage({
      service,
      setParser: nextParser => {
        parser = nextParser;
      },
      session: second,
      bytes,
      fileName: 'second.jpg',
    });

    await service.finalizeUpload(UID, { exchangeId: EXCHANGE_ID, sessionId: first.sessions[0].sessionId });
    await assert.rejects(
      () => service.finalizeUpload(UID, { exchangeId: EXCHANGE_ID, sessionId: second.sessions[0].sessionId }),
      { code: 'resource-exhausted' }
    );
    assert.equal(db.read(`${LETTERHEAD_EXCHANGES_COLLECTION}/${EXCHANGE_ID}`).imageCount, IMAGE_MAX_COUNT);
    assert.equal(db.read(`${IMAGE_UPLOAD_SESSION_COLLECTION}/${second.sessions[0].sessionId}`).status, 'uploaded');
  }
});

test('partial failures do not attach bad images and successful uploads remain finalized', async () => {
  let parser;
  const { db, drive, service } = createServices({ parseMultipartUpload: (...args) => parser(...args) });
  const bytes = createJpegBytes();
  const good = await createSession(service, { fileName: 'good.jpg', mimeType: 'image/jpeg', sizeBytes: bytes.length });
  const bad = await createSession(service, { fileName: 'bad.jpg', mimeType: 'image/jpeg', sizeBytes: bytes.length });

  await uploadImage({
    service,
    setParser: nextParser => {
      parser = nextParser;
    },
    session: good,
    bytes,
    fileName: 'good.jpg',
  });
  await uploadImage({
    service,
    setParser: nextParser => {
      parser = nextParser;
    },
    session: bad,
    bytes,
    fileName: 'bad.jpg',
  });
  await service.finalizeUpload(UID, { exchangeId: EXCHANGE_ID, sessionId: good.sessions[0].sessionId });

  const badFile = drive.files.get('drive-file-2');
  badFile.mimeType = 'image/png';
  drive.files.set('drive-file-2', badFile);
  await assert.rejects(
    () => service.finalizeUpload(UID, { exchangeId: EXCHANGE_ID, sessionId: bad.sessions[0].sessionId }),
    { code: 'failed-precondition' }
  );

  const stored = db.read(`${LETTERHEAD_EXCHANGES_COLLECTION}/${EXCHANGE_ID}`);
  assert.equal(stored.imageCount, 1);
  assert.equal(stored.images[0].imageId, good.sessions[0].sessionId);
  assert.equal(db.read(`${IMAGE_UPLOAD_SESSION_COLLECTION}/${bad.sessions[0].sessionId}`).status, 'uploaded');
});

test('protected image access uses short-lived proof links and streams verified bytes', async () => {
  const { db, drive, bytes, service, session } = await createUploadedImageServices();
  await service.finalizeUpload(UID, { exchangeId: EXCHANGE_ID, sessionId: session.sessions[0].sessionId });

  const access = await service.getImageAccess(
    UID,
    { exchangeId: EXCHANGE_ID, imageId: session.sessions[0].sessionId },
    { request: { auth: { uid: UID } } }
  );

  assert.equal(access.ok, true);
  assert.equal(access.downloadEndpoint, 'http://download.local/letterhead');
  assert.equal(Object.hasOwn(access.image, 'driveFileId'), false);
  const storedAccess = db.read(`${IMAGE_ACCESS_SESSION_COLLECTION}/${access.accessId}`);
  assert.equal(storedAccess.driveFileId, 'drive-file-1');
  assert.equal(proofMatches(access.proof, storedAccess.proofHash), true);
  assert.equal(Object.hasOwn(storedAccess, 'proof'), false);

  const response = fakeResponse();
  await service.downloadImageHttp(
    {
      method: 'GET',
      query: {
        accessId: access.accessId,
        proof: access.proof,
      },
      headers: {},
      get: () => '',
    },
    response
  );
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['Content-Type'], 'image/jpeg');
  assert.equal(response.headers['Content-Length'], String(bytes.length));
  assert.equal(response.headers['Cache-Control'], 'private, no-store, max-age=0');
  assert.ok(Buffer.isBuffer(response.payload));
  assert.deepEqual(response.payload, bytes);
  assert.equal(drive.downloadCalls.length, 1);

  const tampered = fakeResponse();
  await service.downloadImageHttp(
    {
      method: 'GET',
      query: {
        accessId: access.accessId,
        proof: 'wrong-proof',
      },
      headers: {},
      get: () => '',
    },
    tampered
  );
  assert.equal(tampered.statusCode, 403);

  db.writeUpdate(`${IMAGE_ACCESS_SESSION_COLLECTION}/${access.accessId}`, {
    expiresAt: new FakeTimestamp(NOW - 1),
  });
  const expired = fakeResponse();
  await service.downloadImageHttp(
    {
      method: 'GET',
      query: {
        accessId: access.accessId,
        proof: access.proof,
      },
      headers: {},
      get: () => '',
    },
    expired
  );
  assert.equal(expired.statusCode, 412);

  await assert.rejects(
    () => service.getImageAccess(UID, { exchangeId: EXCHANGE_ID, imageId: 'missing-image' }),
    { code: 'not-found' }
  );
});
