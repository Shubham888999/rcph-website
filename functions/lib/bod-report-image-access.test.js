const assert = require('node:assert/strict');
const crypto = require('crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  createBodReportImageAccessService,
  createBodReportImageHttpHandler,
  sniffImageMime,
} = require('./bod-report-image-access');
const {
  BOD_EVENT_ATTACHMENT_SOURCE,
  BOD_EVENT_ATTACHMENT_STORAGE_PROVIDER,
  DRIVE_FOLDER_MIME,
  buildBodEventUploadFolderName,
} = require('./bod-event-attachments');

const MAX_BYTES = 64;
const ALLOWED_ORIGINS = [
  'https://rcph3131.org',
  'https://www.rcph3131.org',
  'https://rcph-admin.web.app',
  'https://rcph-admin.firebaseapp.com',
  'http://localhost:5173',
  /^https:\/\/rcph-admin-staging-2--[a-z0-9-]+\.web\.app$/,
];

class TestHttpsError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

function bytesFor(mimeType) {
  if (mimeType === 'image/png') {
    return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]);
  }
  if (mimeType === 'image/webp') {
    return Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x01, 0, 0, 0]), Buffer.from('WEBP'), Buffer.from([0x01])]);
  }
  return Buffer.from([0xff, 0xd8, 0xff, 0x01]);
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function clone(value) {
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
  }
  return value;
}

class FakeSnapshot {
  constructor(id, data) {
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
    this._db.reads.push(this.path);
    return Promise.resolve(new FakeSnapshot(this.id, this._db.store.get(this.path)));
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

class FakeDb {
  constructor(seed) {
    this.store = new Map(Object.entries(seed).map(([key, value]) => [key, clone(value)]));
    this.reads = [];
    this.writes = [];
  }

  collection(collectionId) {
    return new FakeCollectionRef(this, [collectionId]);
  }

  write() {
    this.writes.push([...arguments]);
    throw new Error('writes are not allowed in report image access');
  }
}

function eventDoc(overrides = {}) {
  return {
    name: 'Clean Water Drive',
    date: '2026-08-15',
    type: 'clubEvent',
    status: 'synced',
    active: true,
    reportImageFileId: 'file-1',
    driveFolderId: 'old-event-folder',
    previewLink: 'https://drive.google.com/file/d/legacy-preview/view',
    imageLinks: ['https://drive.google.com/file/d/legacy-image/view'],
    driveLinks: ['https://drive.google.com/file/d/legacy-file/view'],
    ...overrides,
  };
}

function attachmentDoc(mimeType = 'image/jpeg', overrides = {}) {
  const bytes = overrides.bytes || bytesFor(mimeType);
  return {
    storageProvider: BOD_EVENT_ATTACHMENT_STORAGE_PROVIDER,
    source: BOD_EVENT_ATTACHMENT_SOURCE,
    fileName: 'poster.jpg',
    mimeType,
    sizeBytes: bytes.length,
    driveFolderId: 'folder-1',
    uploadGroupId: 'group-1',
    sha256: sha256(bytes),
    fileUrl: 'https://drive.google.com/file/d/file-1/view',
    ...overrides,
  };
}

function folderDoc(overrides = {}) {
  return {
    id: 'folder-1',
    name: buildBodEventUploadFolderName({
      eventDate: '2026-08-15',
      eventName: 'Clean Water Drive',
      uploadGroupId: 'group-1',
    }),
    mimeType: DRIVE_FOLDER_MIME,
    parents: ['bod-root'],
    trashed: false,
    ...overrides,
  };
}

function fileDoc(mimeType = 'image/jpeg', overrides = {}) {
  const bytes = overrides.bytes || bytesFor(mimeType);
  return {
    id: 'file-1',
    name: 'poster.jpg',
    mimeType,
    sizeBytes: bytes.length,
    parents: ['folder-1'],
    trashed: false,
    ...overrides,
  };
}

function makeDrive({ mimeType = 'image/jpeg', folder = {}, file = {}, bytes = bytesFor(mimeType) } = {}) {
  const calls = { folders: [], files: [], downloads: [] };
  return {
    rootFolderId: 'bod-root',
    calls,
    async getFolderMetadata(folderId) {
      calls.folders.push(folderId);
      return folderDoc(folder);
    },
    async getFileMetadata(fileId) {
      calls.files.push(fileId);
      return fileDoc(mimeType, file);
    },
    async downloadFile(fileId) {
      calls.downloads.push(fileId);
      return Buffer.from(bytes);
    },
  };
}

function makeService(options = {}) {
  const mimeType = options.mimeType || 'image/jpeg';
  const bytes = options.bytes || bytesFor(mimeType);
  const seed = {
    'bodEvents/event-1': eventDoc(options.event),
    'bodEvents/event-1/attachments/file-1': attachmentDoc(mimeType, { bytes, ...(options.attachment || {}) }),
    ...(options.seed || {}),
  };
  if (options.deleteEvent) delete seed['bodEvents/event-1'];
  if (options.deleteAttachment) delete seed['bodEvents/event-1/attachments/file-1'];
  const db = new FakeDb(seed);
  const drive = options.drive || makeDrive({ mimeType, bytes, folder: options.folder, file: options.file });
  const service = createBodReportImageAccessService({ db, HttpsError: TestHttpsError, drive, maxBytes: options.maxBytes || MAX_BYTES });
  return { db, drive, service, bytes };
}

async function rejectsCode(fn, code) {
  await assert.rejects(fn, (err) => err.code === code);
}

async function assertServiceRejects(options, code = 'failed-precondition') {
  const { service } = makeService(options);
  await rejectsCode(() => service.getReportImage('actor-1', 'event-1'), code);
}

test('valid JPEG PNG and WebP report images return exact verified bytes', async () => {
  for (const mimeType of ['image/jpeg', 'image/png', 'image/webp']) {
    const { service, drive, bytes } = makeService({ mimeType });
    const result = await service.getReportImage('actor-1', 'event-1');
    assert.equal(result.eventId, 'event-1');
    assert.equal(result.fileId, 'file-1');
    assert.equal(result.mimeType, mimeType);
    assert.equal(result.sizeBytes, bytes.length);
    assert.deepEqual(result.bytes, bytes);
    assert.deepEqual(drive.calls.files, ['file-1']);
    assert.deepEqual(drive.calls.downloads, ['file-1']);
  }
});

test('missing or ineligible event state rejects before returning bytes', async () => {
  await assertServiceRejects({ event: { reportImageFileId: '' } });
  await assertServiceRejects({ deleteEvent: true }, 'not-found');
  await assertServiceRejects({ event: { active: false } });
  await assertServiceRejects({ event: { archived: true } });
  await assertServiceRejects({ event: { status: 'deleted' } });
  await assertServiceRejects({ event: { type: 'bodMeeting' } });
});

test('attachment authority metadata and MIME are strictly validated', async () => {
  await assertServiceRejects({ deleteAttachment: true }, 'not-found');
  await assertServiceRejects({ attachment: { storageProvider: 'publicUrl' } });
  await assertServiceRejects({ attachment: { source: 'browser' } });
  await assertServiceRejects({ mimeType: 'application/pdf', bytes: Buffer.from('%PDF') });
  await assertServiceRejects({ attachment: { sha256: 'ABC' } });
  await assertServiceRejects({ attachment: { sizeBytes: 0 } });
  await assertServiceRejects({ attachment: { sizeBytes: MAX_BYTES + 1 } });
  await assertServiceRejects({ attachment: { fileName: '' } });
  await assertServiceRejects({ attachment: { driveFolderId: '' } });
  await assertServiceRejects({ attachment: { uploadGroupId: '' } });
});

test('Drive folder is reverified against root and deterministic upload folder name', async () => {
  await assertServiceRejects({ folder: { parents: ['outside-root'] } });
  await assertServiceRejects({ folder: { name: 'wrong-folder-name' } });
  await assertServiceRejects({ folder: { trashed: true } });
  await assertServiceRejects({ folder: { mimeType: 'application/vnd.google-apps.document' } });
  await assertServiceRejects({ folder: { id: 'different-folder' } });
});

test('Drive file metadata must match the selected authoritative attachment', async () => {
  await assertServiceRejects({ file: { parents: ['other-folder'] } });
  await assertServiceRejects({ file: { name: 'other.jpg' } });
  await assertServiceRejects({ file: { mimeType: 'image/png' } });
  await assertServiceRejects({ file: { sizeBytes: 1 } });
  await assertServiceRejects({ file: { trashed: true } });
  await assertServiceRejects({ file: { id: 'other-file' } });
});

test('downloaded bytes are checked for length signature MIME and SHA', async () => {
  await assertServiceRejects({ bytes: Buffer.from([0xff, 0xd8, 0xff, 0x01, 0x02]), file: { sizeBytes: 5 }, attachment: { sizeBytes: 4 } });
  await assertServiceRejects({ bytes: Buffer.from([0x25, 0x50, 0x44, 0x46]) });
  await assertServiceRejects({ attachment: { sha256: 'b'.repeat(64) } });
  await assertServiceRejects({ bytes: Buffer.alloc(MAX_BYTES + 1, 1), attachment: { sizeBytes: MAX_BYTES + 1 }, file: { sizeBytes: MAX_BYTES + 1 } });
});

test('reportImageFileId is the only Drive file authority and legacy links cannot affect retrieval', async () => {
  const { db, service, drive } = makeService({
    seed: {
      'bodEvents/event-1/attachments/legacy-preview': attachmentDoc('image/jpeg', { fileName: 'legacy.jpg' }),
    },
    event: {
      reportImageFileId: 'file-1',
      previewLink: 'https://drive.google.com/file/d/legacy-preview/view',
      imageLinks: ['https://drive.google.com/file/d/legacy-image/view'],
      driveLinks: ['https://drive.google.com/file/d/legacy-file/view'],
      driveFolderId: 'nonmatching-legacy-event-folder',
    },
  });
  const result = await service.getReportImage('actor-1', 'event-1');
  assert.equal(result.fileId, 'file-1');
  assert.deepEqual(drive.calls.files, ['file-1']);
  assert.deepEqual(drive.calls.downloads, ['file-1']);
  assert.deepEqual(db.reads, ['bodEvents/event-1', 'bodEvents/event-1/attachments/file-1']);
  assert.deepEqual(db.writes, []);
});

test('event driveFolderId mismatch does not reject a valid selected attachment', async () => {
  const { service } = makeService({ event: { driveFolderId: 'old-upload-folder' } });
  const result = await service.getReportImage('actor-1', 'event-1');
  assert.equal(result.fileId, 'file-1');
});

test('sniffImageMime accepts only JPEG PNG and WebP signatures', () => {
  assert.equal(sniffImageMime(bytesFor('image/jpeg')), 'image/jpeg');
  assert.equal(sniffImageMime(bytesFor('image/png')), 'image/png');
  assert.equal(sniffImageMime(bytesFor('image/webp')), 'image/webp');
  assert.equal(sniffImageMime(Buffer.from('%PDF')), '');
});

function makeAdmin({ invalid = false } = {}) {
  const calls = { tokens: [] };
  return {
    calls,
    auth() {
      return {
        async verifyIdToken(token) {
          calls.tokens.push(token);
          if (invalid) throw new Error('invalid token internals');
          return { uid: 'bod-user' };
        },
      };
    },
  };
}

function makeReq({ method = 'GET', origin = 'https://rcph3131.org', authorization = 'Bearer token-1', query = { eventId: 'event-1' } } = {}) {
  const headers = {};
  if (origin !== null) headers.origin = origin;
  if (authorization !== null) headers.authorization = authorization;
  return {
    method,
    headers,
    query,
    get(name) {
      return headers[String(name || '').toLowerCase()] || '';
    },
  };
}

function makeRes() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
  };
}

function makeHttpHandler(options = {}) {
  const admin = options.admin || makeAdmin();
  const calls = { bod: [], active: [], image: [] };
  const imageAccess = options.imageAccess || {
    async getReportImage(uid, eventId) {
      calls.image.push({ uid, eventId });
      const bytes = bytesFor('image/jpeg');
      return { eventId, fileId: 'file-1', fileName: 'poster.jpg', mimeType: 'image/jpeg', sizeBytes: bytes.length, bytes };
    },
  };
  const handler = createBodReportImageHttpHandler({
    admin,
    imageAccess,
    allowedOrigins: ALLOWED_ORIGINS,
    HttpsError: TestHttpsError,
    logger: { warn() {} },
    async assertBodAdminOrPresident(uid) {
      calls.bod.push(uid);
    },
    async assertApprovedActiveCallableAccount(uid) {
      calls.active.push(uid);
    },
  });
  return { handler, admin, calls };
}

async function runHttp(req, options = {}) {
  const { handler, admin, calls } = makeHttpHandler(options);
  const res = makeRes();
  await handler(req, res);
  return { res, admin, calls };
}

test('HTTP rejects missing malformed and invalid Authorization headers safely', async () => {
  assert.equal((await runHttp(makeReq({ authorization: null }))).res.statusCode, 401);
  assert.equal((await runHttp(makeReq({ authorization: 'bearer token-1' }))).res.statusCode, 401);
  assert.equal((await runHttp(makeReq({ authorization: 'Bearer token-1 extra' }))).res.statusCode, 401);
  assert.equal((await runHttp(makeReq(), { admin: makeAdmin({ invalid: true }) })).res.statusCode, 401);
});

test('HTTP invokes BOD and approved-active checks before returning the image', async () => {
  const { res, admin, calls } = await runHttp(makeReq());
  assert.equal(res.statusCode, 200);
  assert.deepEqual(admin.calls.tokens, ['token-1']);
  assert.deepEqual(calls.bod, ['bod-user']);
  assert.deepEqual(calls.active, ['bod-user']);
  assert.deepEqual(calls.image, [{ uid: 'bod-user', eventId: 'event-1' }]);
});

test('HTTP rejects client fileId selection so callers cannot choose arbitrary attachments', async () => {
  const unauthenticated = await runHttp(makeReq({ authorization: null, query: { eventId: 'event-1', fileId: 'other-file' } }));
  assert.equal(unauthenticated.res.statusCode, 401);
  assert.deepEqual(unauthenticated.calls.image, []);

  const { res, calls } = await runHttp(makeReq({ query: { eventId: 'event-1', fileId: 'other-file' } }));
  assert.equal(res.statusCode, 400);
  assert.deepEqual(calls.image, []);
  const body = JSON.parse(String(res.body));
  assert.equal(body.ok, false);
  assert.equal(body.code, 'invalid-argument');
});

test('HTTP OPTIONS supports Authorization and approved CORS origins', async () => {
  const { res } = await runHttp(makeReq({ method: 'OPTIONS', authorization: null }));
  assert.equal(res.statusCode, 204);
  assert.equal(res.headers['Access-Control-Allow-Origin'], 'https://rcph3131.org');
  assert.equal(res.headers['Access-Control-Allow-Methods'], 'GET, OPTIONS');
  assert.match(res.headers['Access-Control-Allow-Headers'], /Authorization/);
  assert.equal(res.headers.Vary, 'Origin');
});

test('HTTP rejects unapproved Origin without wildcard CORS', async () => {
  const { res } = await runHttp(makeReq({ origin: 'https://evil.example' }));
  assert.equal(res.statusCode, 403);
  assert.equal(res.headers['Access-Control-Allow-Origin'], undefined);
  const body = JSON.parse(String(res.body));
  assert.equal(body.code, 'permission-denied');
});

test('HTTP success streams verified bytes with secure no-store headers', async () => {
  const { res } = await runHttp(makeReq());
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['Content-Type'], 'image/jpeg');
  assert.equal(res.headers['Content-Length'], String(bytesFor('image/jpeg').length));
  assert.equal(res.headers['Content-Disposition'], 'inline; filename="poster.jpg"');
  assert.equal(res.headers['Cache-Control'], 'private, no-store, max-age=0');
  assert.equal(res.headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(res.headers['Referrer-Policy'], 'no-referrer');
  assert.ok(Buffer.isBuffer(res.body));
});

test('index wiring exposes authenticated HTTP endpoint with existing Drive secrets', () => {
  const source = readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
  const serviceStart = source.indexOf('const bodReportImageAccess = createBodReportImageAccessService({');
  const handlerStart = source.indexOf('const downloadBodReportImageHandler = createBodReportImageHttpHandler({');
  const endpointStart = source.indexOf('exports.downloadBodReportImage');
  const endpoint = source.slice(
    endpointStart,
    source.indexOf('exports.getBodAvenueReportDirectors')
  );
  assert.notEqual(serviceStart, -1);
  assert.notEqual(handlerStart, -1);
  assert.notEqual(endpointStart, -1);
  assert.ok(serviceStart < handlerStart);
  assert.ok(handlerStart < endpointStart);
  assert.match(source, /secrets: \{ VISIT_DRIVE_CLIENT_ID, VISIT_DRIVE_CLIENT_SECRET, VISIT_DRIVE_REFRESH_TOKEN \}/);
  assert.match(source, /imageAccess: bodReportImageAccess/);
  assert.match(source, /allowedOrigins: CALLABLE_OPTIONS\.cors/);
  assert.match(source, /assertBodAdminOrPresident/);
  assert.match(source, /assertApprovedActiveCallableAccount/);
  assert.match(source, /BOD_REPORT_IMAGE_HTTP_OPTIONS/);
  assert.match(endpoint, /onRequest/);
  assert.match(endpoint, /downloadBodReportImageHandler/);
  assert.doesNotMatch(endpoint, /fileId/);
});