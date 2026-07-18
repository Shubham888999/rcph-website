'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  DEFAULT_BOARD_ID,
  DEFAULT_RIY_LABEL,
  createBodManagementService,
} = require('./bod-management');
const {
  PHOTO_MAX_BYTES,
  RATE_LIMIT_COUNT,
  SESSION_COLLECTION,
  RATE_LIMIT_COLLECTION,
  DEFAULT_ROOT_FOLDER_NAME,
  createBodPhotoDriveService,
  createBodPhotoUploadService,
  getBodPhotoDriveConfig,
  hashProof,
  proofMatches,
  sniffMimeType,
} = require('./bod-photo-upload');

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

  collection(collectionId) {
    return new FakeCollectionRef(this._db, [...this.path.split('/'), collectionId]);
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
    if (ref instanceof FakeCollectionRef) {
      return Promise.resolve({ docs: this._db.collectionDocs(ref._pathParts.join('/')) });
    }
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
      .filter((documentPath) => documentPath.startsWith(prefix))
      .filter((documentPath) => documentPath.slice(prefix.length).split('/').length === 1)
      .sort()
      .map((documentPath) => new FakeSnapshot(this.read(documentPath), documentPath.split('/').at(-1), new FakeDocRef(this, documentPath.split('/'))));
  }

  paths() {
    return Array.from(this._store.keys()).sort();
  }

  dump() {
    return Object.fromEntries(this.paths().map((key) => [key, this.read(key)]));
  }
}

class FakeDrive {
  constructor() {
    this.files = new Map();
    this.fileBytes = new Map();
    this.folderCalls = [];
    this.uploadCalls = [];
    this.findCalls = [];
    this.downloadCalls = [];
    this.deleteCalls = [];
    this.nextFile = 0;
  }

  async ensureProfileFolder(input) {
    this.folderCalls.push(clone(input));

    return {
      profileFolderId:
        `folder-${input.sectionKey}-${input.profileId}`,
    };
  }

  async uploadPhotoFile(input) {
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
    this.fileBytes.set(
      file.id,
      Buffer.from(input.buffer)
    );

    return file;
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

  async findPublishedPhotoFile(input) {
    this.findCalls.push(clone(input));

    const matches = Array
      .from(this.files.values())
      .filter((file) => {
        const properties =
          file.appProperties || {};

        return (
          file.trashed !== true
          && properties.documentType
            === 'bod-profile-photo'
          && properties.boardId
            === input.boardId
          && properties.sectionKey
            === input.sectionKey
          && properties.profileId
            === input.profileId
          && properties.photoVersionCandidate
            === String(input.photoVersion)
        );
      });

    if (matches.length > 1) {
      const error = new Error(
        'Duplicate published BOD photo versions were found.'
      );

      error.code = 'failed-precondition';
      throw error;
    }

    return matches.length === 1
      ? clone(matches[0])
      : null;
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

  async deleteFile(fileId) {
    this.deleteCalls.push(fileId);
    this.files.delete(fileId);
    this.fileBytes.delete(fileId);
  }
}

const admin = {
  firestore: {
    Timestamp: {
      fromMillis: (millis) => new FakeTimestamp(millis),
    },
    FieldValue: {
      serverTimestamp: () => new FakeTimestamp(Date.parse('2026-07-17T00:00:00.000Z')),
    },
  },
};

function boardDocument(sectionOverrides = {}) {
  return {
    boardId: DEFAULT_BOARD_ID,
    riyLabel: DEFAULT_RIY_LABEL,
    schemaVersion: 1,
    sections: {
      clubBoard: {
        publicationStatus: 'draft',
        draftRevision: 0,
        publishedRevision: 0,
        publishedAt: null,
        publishedBy: null,
        ...(sectionOverrides.clubBoard || {}),
      },
      leadershipBeyondClub: {
        publicationStatus: 'draft',
        draftRevision: 0,
        publishedRevision: 0,
        publishedAt: null,
        publishedBy: null,
        ...(sectionOverrides.leadershipBeyondClub || {}),
      },
    },
  };
}

function settingDocument() {
  return { activeBoardId: DEFAULT_BOARD_ID, schemaVersion: 1 };
}

function readyPhoto(overrides = {}) {
  return {
    status: 'ready',
    storageProvider: 'googleDrive',
    driveFileId: 'drive-ready-1',
    driveFolderId: 'folder-ready-1',
    mimeType: 'image/png',
    originalName: 'portrait.png',
    sizeBytes: 120,
    width: null,
    height: null,
    sha256: 'a'.repeat(64),
    version: 1,
    uploadedAt: '2026-07-01T00:00:00.000Z',
    uploadedBy: 'admin-1',
    uploadSessionId: 'session-ready-1',
    previousPhoto: null,
    ...overrides,
  };
}

function storedProfile(overrides = {}) {
  return {
    sectionKey: 'clubBoard',
    name: 'Rtr. Test Member',
    positionKey: 'president',
    positionLabel: 'President',
    summary: 'Leads club work.',
    bio: '',
    avenueLabels: [],
    instagramUsername: null,
    linkedBodMemberId: null,
    linkedUserUid: null,
    sortOrder: 10,
    displayPublicly: false,
    status: 'active',
    photo: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    createdBy: 'admin-1',
    updatedAt: '2026-07-01T00:00:00.000Z',
    updatedBy: 'admin-1',
    archivedAt: null,
    archivedBy: null,
    ...overrides,
  };
}

function initializedDb(extra = {}) {
  return new FakeDb({
    'bodSettings/publicBoard': settingDocument(),
    [`bodBoards/${DEFAULT_BOARD_ID}`]: boardDocument(extra.boardSections || {}),
    [`bodBoards/${DEFAULT_BOARD_ID}/profiles/p1`]: storedProfile(extra.profile || {}),
    ...(extra.documents || {}),
  });
}

function createServices({
  db = initializedDb(),
  role = 'admin',
  approved = true,
  drive = new FakeDrive(),
  nowMillis = () => Date.parse('2026-07-17T00:00:00.000Z'),
  parseMultipartUpload,
  env,
} = {}) {
  const bodManagement = createBodManagementService({
    db,
    admin,
    HttpsError: TestHttpsError,
    assertApprovedActiveCallableAccount: async () => {
      if (!approved) throw new TestHttpsError('permission-denied', 'Approved active account required.');
      return {};
    },
    getAuthorityContext: async (uid) => ({ uid, role }),
    logger: { warn: () => {} },
  });
  const photo = createBodPhotoUploadService({
    db,
    admin,
    HttpsError: TestHttpsError,
    bodManagement,
    drive,
    env,
    nowMillis,
    parseMultipartUpload,
    randomBytes: (size) => Buffer.alloc(size, 7),
    logger: { warn: () => {} },
    allowedOrigins: ['http://localhost:5173'],
  });
  return { db, drive, bodManagement, photo };
}

function createJpegBytes() {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
}

function createPngBytes() {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
}

function createWebpBytes() {
  return Buffer.from('RIFF1234WEBPVP8 ', 'ascii');
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
      this.payload = payload;
      return this;
    },
  };
}

async function createSession(photo, overrides = {}) {
  return photo.createUploadSession({
    boardId: DEFAULT_BOARD_ID,
    profileId: 'p1',
    sectionKey: 'clubBoard',
    fileName: 'portrait.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: createJpegBytes().length,
    ...overrides,
  }, 'admin-1');
}

async function uploadAndFinalizePhoto({
  photo,
  setParser,
  expectedDraftRevision,
  bytes = createJpegBytes(),
}) {
  const session = await createSession(photo, {
    sizeBytes: bytes.length,
  });

  setParser(async () => ({
    fields: {
      sessionId: session.sessionId,
      proof: session.proof,
      boardId: DEFAULT_BOARD_ID,
      profileId: 'p1',
      sectionKey: 'clubBoard',
      fileName: 'portrait.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: String(bytes.length),
    },
    file: {
      mimeType: 'image/jpeg',
      sizeBytes: bytes.length,
      buffer: bytes,
    },
  }));

  const uploadResponse = fakeResponse();

  await photo.uploadHttp(
    {
      method: 'POST',
      headers: {
        origin: 'http://localhost:5173',
      },
      get: () => 'http://localhost:5173',
    },
    uploadResponse
  );

  assert.equal(uploadResponse.statusCode, 200);

  const finalized = await photo.finalizeUpload(
    {
      boardId: DEFAULT_BOARD_ID,
      profileId: 'p1',
      sessionId: session.sessionId,
      expectedDraftRevision,
    },
    'admin-1'
  );

  return {
    session,
    finalized,
    bytes,
  };
}

test('photo helper primitives validate proof hashes and image magic bytes', () => {
  const proof = 'secret-proof';
  assert.equal(proofMatches(proof, hashProof(proof)), true);
  assert.equal(proofMatches('wrong', hashProof(proof)), false);
  assert.equal(sniffMimeType(createJpegBytes()), 'image/jpeg');
  assert.equal(sniffMimeType(createPngBytes()), 'image/png');
  assert.equal(sniffMimeType(createWebpBytes()), 'image/webp');
});

test('createBodPhotoUploadSession allows only canonical Admin or President', async () => {
  await createSession(createServices({ role: 'admin' }).photo);
  await createSession(createServices({ role: 'president' }).photo);
  for (const role of ['bod', 'gbm']) {
    await assert.rejects(
      createSession(createServices({ role }).photo),
      (error) => error.code === 'permission-denied'
    );
  }
  await assert.rejects(
    createSession(createServices({ role: 'admin', approved: false }).photo),
    (error) => error.code === 'permission-denied'
  );
});

test('Admin board responses expose safe photo summaries only', async () => {
  const { bodManagement } = createServices({
    db: initializedDb({ profile: { photo: readyPhoto() } }),
  });
  const board = await bodManagement.getBodManagementBoard({}, 'admin-1');
  const profile = board.profiles.clubBoard[0];

  assert.equal(profile.hasPhoto, true);
  assert.deepEqual(profile.photo, {
    status: 'ready',
    mimeType: 'image/png',
    originalName: 'portrait.png',
    sizeBytes: 120,
    width: null,
    height: null,
    version: 1,
    uploadedAt: '2026-07-01T00:00:00.000Z',
  });
  assert.equal('driveFileId' in profile.photo, false);
  assert.equal('uploadSessionId' in profile.photo, false);
  assert.equal('previousPhoto' in profile.photo, false);
});

test('stored profile photo validation accepts removed tombstones and rejects malformed private data', async () => {
  const removed = readyPhoto({ status: 'removed', previousPhoto: null });
  const okBoard = await createServices({ db: initializedDb({ profile: { photo: removed } }) })
    .bodManagement.getBodManagementBoard({}, 'admin-1');
  assert.equal(okBoard.profiles.clubBoard[0].hasPhoto, false);
  assert.equal(okBoard.profiles.clubBoard[0].photo.status, 'removed');

  await assert.rejects(
    createServices({ db: initializedDb({ profile: { photo: readyPhoto({ storageProvider: 'publicUrl' }) } }) })
      .bodManagement.getBodManagementBoard({}, 'admin-1'),
    (error) => error.code === 'failed-precondition'
  );
  await assert.rejects(
    createServices({
      db: initializedDb({
        profile: {
          photo: readyPhoto({
            previousPhoto: readyPhoto({
              status: 'replaced',
              previousPhoto: readyPhoto({ status: 'removed' }),
            }),
          }),
        },
      }),
    })
      .bodManagement.getBodManagementBoard({}, 'admin-1'),
    (error) => error.code === 'failed-precondition'
  );
});

test('text CRUD rejects client-supplied photo and preserves stored photo metadata', async () => {
  const existingPhoto = readyPhoto();
  const { db, bodManagement } = createServices({ db: initializedDb({ profile: { photo: existingPhoto } }) });

  await assert.rejects(
    bodManagement.upsertBodProfile({
      boardId: DEFAULT_BOARD_ID,
      profileId: 'p1',
      expectedDraftRevision: 0,
      profile: { ...storedProfile(), photo: { status: 'ready' } },
    }, 'admin-1'),
    (error) => error.code === 'invalid-argument'
  );

  await bodManagement.upsertBodProfile({
    boardId: DEFAULT_BOARD_ID,
    profileId: 'p1',
    expectedDraftRevision: 0,
    profile: {
      sectionKey: 'clubBoard',
      name: 'Updated',
      positionKey: 'president',
      positionLabel: '',
      summary: 'Updated summary',
      bio: '',
      avenueLabels: [],
      instagramUsername: null,
      linkedBodMemberId: null,
      linkedUserUid: null,
      sortOrder: 10,
      displayPublicly: false,
    },
  }, 'admin-1');
  assert.deepEqual(db.read(`bodBoards/${DEFAULT_BOARD_ID}/profiles/p1`).photo, existingPhoto);
});

test('create session writes proof hash, rate limit state, and no Drive operation', async () => {
  const { db, drive, photo } = createServices();
  const session = await createSession(photo);
  const stored = db.read(`${SESSION_COLLECTION}/${session.sessionId}`);
  const ratePath = db.paths().find((path) => path.startsWith(`${RATE_LIMIT_COLLECTION}/`));

  assert.equal(session.ok, true);
  assert.equal(session.maxSizeBytes, PHOTO_MAX_BYTES);
  assert.equal(stored.status, 'pending');
  assert.equal(stored.proofHash, hashProof(session.proof));
  assert.equal('proof' in stored, false);
  assert.equal(stored.versionCandidate, 1);
  assert.ok(ratePath);
  assert.equal(db.read(ratePath).count, 1);
  assert.equal(drive.uploadCalls.length, 0);
  assert.equal(db.paths().some((path) => db.read(path).eventType === 'photoUploadCreated'), true);
});

test('create session rejects archived profiles, bad metadata, section mismatch, and rate-limit overflow', async () => {
  await assert.rejects(
    createSession(createServices({ db: initializedDb({ profile: { status: 'archived', archivedAt: '2026-07-02T00:00:00.000Z', archivedBy: 'admin-1' } }) }).photo),
    (error) => error.code === 'failed-precondition'
  );
  await assert.rejects(
    createSession(createServices().photo, { mimeType: 'image/svg+xml' }),
    (error) => error.code === 'invalid-argument'
  );
  await assert.rejects(
    createSession(createServices().photo, { sizeBytes: PHOTO_MAX_BYTES + 1 }),
    (error) => error.code === 'invalid-argument'
  );
  await assert.rejects(
    createSession(createServices().photo, { sectionKey: 'leadershipBeyondClub' }),
    (error) => error.code === 'failed-precondition'
  );

  const { photo } = createServices();
  for (let index = 0; index < RATE_LIMIT_COUNT; index += 1) {
    await createSession(photo);
  }
  await assert.rejects(createSession(photo), (error) => error.code === 'resource-exhausted');
});

test('create session uses configured upload endpoint with production fallback', async () => {
  const customEndpoint =
    'http://127.0.0.1:5001/rcph-admin/us-central1/uploadBodProfilePhoto';

  const configuredSession = await createSession(
    createServices({
      env: {
        BOD_PHOTO_UPLOAD_ENDPOINT: customEndpoint,
      },
    }).photo
  );

  assert.equal(configuredSession.uploadEndpoint, customEndpoint);

  const productionSession = await createSession(
    createServices({
      env: {},
    }).photo
  );

  assert.equal(
    productionSession.uploadEndpoint,
    'https://us-central1-rcph-admin.cloudfunctions.net/uploadBodProfilePhoto'
  );
});

test('Drive config prefers explicit BOD root and can fall back to a private OAuth root folder', () => {
  assert.deepEqual(
    getBodPhotoDriveConfig({
      BOD_PHOTO_DRIVE_AUTH_MODE: 'oauth',
      BOD_PHOTO_ROOT_FOLDER_ID: 'configured-root',
      BOD_PHOTO_ROOT_FOLDER_NAME: 'Ignored name when ID is set',
    }),
    {
      authMode: 'oauth',
      rootFolderId: 'configured-root',
      parentFolderId: '',
      rootFolderName: 'Ignored name when ID is set',
    }
  );

  assert.deepEqual(
    getBodPhotoDriveConfig({
      BOD_PHOTO_DRIVE_AUTH_MODE: 'oauth',
    }),
    {
      authMode: 'oauth',
      rootFolderId: '',
      parentFolderId: '',
      rootFolderName: DEFAULT_ROOT_FOLDER_NAME,
    }
  );

  assert.deepEqual(
    getBodPhotoDriveConfig({
      BOD_PHOTO_DRIVE_AUTH_MODE: 'shared-drive',
      BOD_PHOTO_PARENT_FOLDER_ID: 'shared-parent',
      BOD_PHOTO_ROOT_FOLDER_NAME: 'Leadership Root',
    }),
    {
      authMode: 'shared-drive',
      rootFolderId: '',
      parentFolderId: 'shared-parent',
      rootFolderName: 'Leadership Root',
    }
  );

  assert.throws(
    () => getBodPhotoDriveConfig({
      BOD_PHOTO_DRIVE_AUTH_MODE: 'shared-drive',
    }),
    /BOD photo storage is not configured/
  );
});

test('Drive service creates the private BOD photo root when no root ID is configured', async () => {
  const created = [];
  const driveClient = {
    files: {
      async list() {
        return { data: { files: [] } };
      },
      async create(input) {
        const name = input.requestBody.name;
        const id = `folder-${created.length + 1}`;
        created.push({
          id,
          name,
          parents: input.requestBody.parents,
          mimeType: input.requestBody.mimeType,
        });
        return { data: { id, name } };
      },
    },
  };
  const service = createBodPhotoDriveService({
    driveClient,
    env: {
      BOD_PHOTO_DRIVE_AUTH_MODE: 'oauth',
    },
  });

  const folder = await service.ensureProfileFolder({
    boardId: DEFAULT_BOARD_ID,
    sectionKey: 'clubBoard',
    profileId: 'p1',
  });

  assert.equal(folder.rootFolderId, 'folder-1');
  assert.equal(folder.profileFolderId, 'folder-4');
  assert.deepEqual(
    created.map((item) => [item.name, item.parents]),
    [
      [DEFAULT_ROOT_FOLDER_NAME, ['root']],
      ['RIY 2026-27', ['folder-1']],
      ['Club Board', ['folder-2']],
      ['p1', ['folder-3']],
    ]
  );
  assert.equal(
    created.every((item) => item.mimeType === 'application/vnd.google-apps.folder'),
    true
  );
});
test('HTTP multipart upload accepts private JPEG/PNG/WebP uploads and excludes Drive IDs from responses', async () => {
  for (const [mimeType, bytes] of [
    ['image/jpeg', createJpegBytes()],
    ['image/png', createPngBytes()],
    ['image/webp', createWebpBytes()],
  ]) {
    let parser;
    const { db, drive, photo } = createServices({
      parseMultipartUpload: (...args) => parser(...args),
    });
    const session = await createSession(photo, { fileName: `portrait.${mimeType.split('/')[1]}`, mimeType, sizeBytes: bytes.length });
    parser = async () => ({
      fields: {
        sessionId: session.sessionId,
        proof: session.proof,
        boardId: DEFAULT_BOARD_ID,
        profileId: 'p1',
        sectionKey: 'clubBoard',
        fileName: `portrait.${mimeType.split('/')[1]}`,
        mimeType,
        sizeBytes: String(bytes.length),
      },
      file: { mimeType, sizeBytes: bytes.length, buffer: bytes },
    });
    const res = fakeResponse();
    await photo.uploadHttp({ method: 'POST', headers: { origin: 'http://localhost:5173' }, get: (name) => name === 'origin' ? 'http://localhost:5173' : '' }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.ok, true);
    assert.equal(res.payload.uploaded.mimeType, mimeType);
    assert.equal('driveFileId' in res.payload.uploaded, false);
    assert.equal(db.read(`${SESSION_COLLECTION}/${session.sessionId}`).status, 'uploaded');
    assert.equal(drive.uploadCalls.length, 1);
    assert.equal(drive.uploadCalls[0].appProperties.documentType, 'bod-profile-photo');
    assert.equal(drive.uploadCalls[0].appProperties.uploadSessionId, session.sessionId);
  }
});

test('HTTP multipart upload rejects origin, method, proof mismatch, MIME mismatch, and forbidden fields', async () => {
const sessionCases = [
  {
    name: 'proof',
    fields: { proof: 'wrong-proof' },
    code: 'permission-denied',
    status: 'pending',
  },
  {
    name: 'mime',
    fileMimeType: 'image/png',
    code: 'invalid-argument',
    status: 'pending',
  },
  {
    name: 'forbidden',
    fields: { driveFileId: 'browser-supplied' },
    code: 'invalid-argument',
    status: 'pending',
  },
];

  const noOrigin = fakeResponse();
  await createServices().photo.uploadHttp({ method: 'POST', headers: {}, get: () => '' }, noOrigin);
  assert.equal(noOrigin.statusCode, 403);

  const method = fakeResponse();
  await createServices().photo.uploadHttp({ method: 'GET', headers: { origin: 'http://localhost:5173' }, get: () => 'http://localhost:5173' }, method);
  assert.equal(method.statusCode, 405);

  for (const item of sessionCases) {
    let parser;
    const { db, photo } = createServices({ parseMultipartUpload: (...args) => parser(...args) });
    const session = await createSession(photo);
    parser = async () => ({
      fields: {
        sessionId: session.sessionId,
        proof: session.proof,
        boardId: DEFAULT_BOARD_ID,
        profileId: 'p1',
        sectionKey: 'clubBoard',
        fileName: 'portrait.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: String(createJpegBytes().length),
        ...(item.fields || {}),
      },
      file: { mimeType: item.fileMimeType || 'image/jpeg', sizeBytes: createJpegBytes().length, buffer: createJpegBytes() },
    });
    const res = fakeResponse();
    await photo.uploadHttp({ method: 'POST', headers: { origin: 'http://localhost:5173' }, get: () => 'http://localhost:5173' }, res);
    assert.notEqual(res.statusCode, 200, item.name);
    assert.equal(res.payload.code, item.code);
    assert.equal(db.read(`${SESSION_COLLECTION}/${session.sessionId}`).status, item.status || 'failed');
  }
});

test('HTTP multipart upload marks a successfully reserved session failed when Drive upload fails', async () => {
  let parser;
  const drive = new FakeDrive();

  drive.uploadPhotoFile = async () => {
    const error = new Error('Drive upload failed.');
    error.code = 'internal';
    throw error;
  };

  const { db, photo } = createServices({
    drive,
    parseMultipartUpload: (...args) => parser(...args),
  });

  const session = await createSession(photo);

  parser = async () => ({
    fields: {
      sessionId: session.sessionId,
      proof: session.proof,
      boardId: DEFAULT_BOARD_ID,
      profileId: 'p1',
      sectionKey: 'clubBoard',
      fileName: 'portrait.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: String(createJpegBytes().length),
    },
    file: {
      mimeType: 'image/jpeg',
      sizeBytes: createJpegBytes().length,
      buffer: createJpegBytes(),
    },
  });

  const res = fakeResponse();

  await photo.uploadHttp({
    method: 'POST',
    headers: { origin: 'http://localhost:5173' },
    get: () => 'http://localhost:5173',
  }, res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.payload.code, 'internal');
  assert.equal(
    db.read(`${SESSION_COLLECTION}/${session.sessionId}`).status,
    'failed'
  );
});

test('published photo endpoint streams only the snapshot-authorized Drive version', async () => {
  let parser;

  const db = initializedDb({
    profile: {
      displayPublicly: true,
    },
  });

  const {
    bodManagement,
    drive,
    photo,
  } = createServices({
    db,
    parseMultipartUpload: (...args) =>
      parser(...args),
  });

  const bytes = createJpegBytes();

  await uploadAndFinalizePhoto({
    photo,
    setParser: (nextParser) => {
      parser = nextParser;
    },
    expectedDraftRevision: 0,
    bytes,
  });

  await bodManagement.publishBodSection(
    {
      boardId: DEFAULT_BOARD_ID,
      sectionKey: 'clubBoard',
      expectedDraftRevision: 1,
      expectedPublishedRevision: 0,
    },
    'admin-1'
  );

  const response = fakeResponse();

  await photo.downloadPublishedPhotoHttp(
    {
      method: 'GET',
      query: {
        boardId: DEFAULT_BOARD_ID,
        sectionKey: 'clubBoard',
        profileId: 'p1',
        version: '1',
      },
    },
    response
  );

  assert.equal(response.statusCode, 200);

  assert.equal(
    response.headers['Content-Type'],
    'image/jpeg'
  );

  assert.equal(
    response.headers['Content-Length'],
    String(bytes.length)
  );

  assert.match(
    response.headers['Cache-Control'],
    /^public,/
  );

  assert.equal(
    response.headers[
      'Access-Control-Allow-Origin'
    ],
    '*'
  );

  assert.ok(Buffer.isBuffer(response.payload));
  assert.deepEqual(response.payload, bytes);
  assert.equal(drive.findCalls.length, 1);
  assert.equal(drive.downloadCalls.length, 1);
});

test('published photo endpoint returns 404 for Draft sections, wrong profiles, and wrong versions', async () => {
  const draftServices = createServices();
  const draftResponse = fakeResponse();

  await draftServices.photo
    .downloadPublishedPhotoHttp(
      {
        method: 'GET',
        query: {
          boardId: DEFAULT_BOARD_ID,
          sectionKey: 'clubBoard',
          profileId: 'p1',
          version: '1',
        },
      },
      draftResponse
    );

  assert.equal(draftResponse.statusCode, 404);
  assert.equal(
    draftResponse.payload.code,
    'not-found'
  );
  assert.equal(
    draftServices.drive.downloadCalls.length,
    0
  );

  let parser;

  const db = initializedDb({
    profile: {
      displayPublicly: true,
    },
  });

  const {
    bodManagement,
    drive,
    photo,
  } = createServices({
    db,
    parseMultipartUpload: (...args) =>
      parser(...args),
  });

  await uploadAndFinalizePhoto({
    photo,
    setParser: (nextParser) => {
      parser = nextParser;
    },
    expectedDraftRevision: 0,
  });

  await bodManagement.publishBodSection(
    {
      boardId: DEFAULT_BOARD_ID,
      sectionKey: 'clubBoard',
      expectedDraftRevision: 1,
      expectedPublishedRevision: 0,
    },
    'admin-1'
  );

  const invalidQueries = [
    {
      boardId: DEFAULT_BOARD_ID,
      sectionKey: 'clubBoard',
      profileId: 'other-profile',
      version: '1',
    },
    {
      boardId: DEFAULT_BOARD_ID,
      sectionKey: 'clubBoard',
      profileId: 'p1',
      version: '2',
    },
  ];

  for (const query of invalidQueries) {
    const response = fakeResponse();

    await photo.downloadPublishedPhotoHttp(
      {
        method: 'GET',
        query,
      },
      response
    );

    assert.equal(response.statusCode, 404);
    assert.equal(
      response.payload.code,
      'not-found'
    );
  }

  assert.equal(drive.downloadCalls.length, 0);
});

test('published photo remains available after multiple draft replacements and removal', async () => {
  let parser;

  const db = initializedDb({
    profile: {
      displayPublicly: true,
    },
  });

  const {
    bodManagement,
    drive,
    photo,
  } = createServices({
    db,
    parseMultipartUpload: (...args) =>
      parser(...args),
  });

  const publishedBytes = Buffer.concat([
    createJpegBytes(),
    Buffer.from([1]),
  ]);

  await uploadAndFinalizePhoto({
    photo,
    setParser: (nextParser) => {
      parser = nextParser;
    },
    expectedDraftRevision: 0,
    bytes: publishedBytes,
  });

  await bodManagement.publishBodSection(
    {
      boardId: DEFAULT_BOARD_ID,
      sectionKey: 'clubBoard',
      expectedDraftRevision: 1,
      expectedPublishedRevision: 0,
    },
    'admin-1'
  );

  await uploadAndFinalizePhoto({
    photo,
    setParser: (nextParser) => {
      parser = nextParser;
    },
    expectedDraftRevision: 1,
    bytes: Buffer.concat([
      createJpegBytes(),
      Buffer.from([2]),
    ]),
  });

  await uploadAndFinalizePhoto({
    photo,
    setParser: (nextParser) => {
      parser = nextParser;
    },
    expectedDraftRevision: 2,
    bytes: Buffer.concat([
      createJpegBytes(),
      Buffer.from([3]),
    ]),
  });

await photo.removePhoto(
  {
    boardId: DEFAULT_BOARD_ID,
    profileId: 'p1',
    expectedDraftRevision: 3,
  },
  'admin-1'
);

  const response = fakeResponse();

  await photo.downloadPublishedPhotoHttp(
    {
      method: 'GET',
      query: {
        boardId: DEFAULT_BOARD_ID,
        sectionKey: 'clubBoard',
        profileId: 'p1',
        version: '1',
      },
    },
    response
  );

  assert.equal(response.statusCode, 200);

  assert.deepEqual(
    response.payload,
    publishedBytes
  );

  assert.equal(drive.files.size, 3);
  assert.equal(drive.downloadCalls.length, 1);
});

test('published photo endpoint rejects tampered Drive metadata or content', async () => {
  let parser;

  const db = initializedDb({
    profile: {
      displayPublicly: true,
    },
  });

  const {
    bodManagement,
    drive,
    photo,
  } = createServices({
    db,
    parseMultipartUpload: (...args) =>
      parser(...args),
  });

  await uploadAndFinalizePhoto({
    photo,
    setParser: (nextParser) => {
      parser = nextParser;
    },
    expectedDraftRevision: 0,
  });

  await bodManagement.publishBodSection(
    {
      boardId: DEFAULT_BOARD_ID,
      sectionKey: 'clubBoard',
      expectedDraftRevision: 1,
      expectedPublishedRevision: 0,
    },
    'admin-1'
  );

  const fileId = Array
    .from(drive.files.keys())[0];

  const tampered = drive.files.get(fileId);

  tampered.appProperties.sha256 =
    'b'.repeat(64);

  drive.files.set(fileId, tampered);

  const response = fakeResponse();

  await photo.downloadPublishedPhotoHttp(
    {
      method: 'GET',
      query: {
        boardId: DEFAULT_BOARD_ID,
        sectionKey: 'clubBoard',
        profileId: 'p1',
        version: '1',
      },
    },
    response
  );

  assert.equal(response.statusCode, 500);

  assert.equal(
    response.payload.code,
    'internal'
  );

  assert.equal(
    response.headers['Cache-Control'],
    'no-store'
  );

  assert.equal(
    JSON.stringify(response.payload)
      .includes(fileId),
    false
  );
});

test('finalize creates versioned ready photos, replaces safely, and preserves previous photo privately', async () => {
  let parser;
  const { db, drive, photo } = createServices({ parseMultipartUpload: (...args) => parser(...args) });
  const session = await createSession(photo);
  parser = async () => ({
    fields: {
      sessionId: session.sessionId,
      proof: session.proof,
      boardId: DEFAULT_BOARD_ID,
      profileId: 'p1',
      sectionKey: 'clubBoard',
      fileName: 'portrait.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: String(createJpegBytes().length),
    },
    file: { mimeType: 'image/jpeg', sizeBytes: createJpegBytes().length, buffer: createJpegBytes() },
  });
  await photo.uploadHttp({ method: 'POST', headers: { origin: 'http://localhost:5173' }, get: () => 'http://localhost:5173' }, fakeResponse());
  const finalized = await photo.finalizeUpload({
    boardId: DEFAULT_BOARD_ID,
    profileId: 'p1',
    sessionId: session.sessionId,
    expectedDraftRevision: 0,
  }, 'admin-1');

  assert.equal(finalized.profile.hasPhoto, true);
  assert.equal(finalized.profile.photo.version, 1);
  assert.equal('driveFileId' in finalized.profile.photo, false);
  assert.equal(db.read(`bodBoards/${DEFAULT_BOARD_ID}`).sections.clubBoard.draftRevision, 1);
  const firstDriveFileId = db.read(`bodBoards/${DEFAULT_BOARD_ID}/profiles/p1`).photo.driveFileId;

  const replacement = await createSession(photo, { sizeBytes: createJpegBytes().length });
  parser = async () => ({
    fields: {
      sessionId: replacement.sessionId,
      proof: replacement.proof,
      boardId: DEFAULT_BOARD_ID,
      profileId: 'p1',
      sectionKey: 'clubBoard',
      fileName: 'portrait.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: String(createJpegBytes().length),
    },
    file: { mimeType: 'image/jpeg', sizeBytes: createJpegBytes().length, buffer: createJpegBytes() },
  });
  await photo.uploadHttp({ method: 'POST', headers: { origin: 'http://localhost:5173' }, get: () => 'http://localhost:5173' }, fakeResponse());
  const replaced = await photo.finalizeUpload({
    boardId: DEFAULT_BOARD_ID,
    profileId: 'p1',
    sessionId: replacement.sessionId,
    expectedDraftRevision: 1,
  }, 'admin-1');
  const stored = db.read(`bodBoards/${DEFAULT_BOARD_ID}/profiles/p1`).photo;

  assert.equal(replaced.profile.photo.version, 2);
  assert.equal(stored.previousPhoto.status, 'replaced');
  assert.equal(stored.previousPhoto.driveFileId, firstDriveFileId);
  assert.equal(stored.previousPhoto.previousPhoto, null);
  assert.equal(drive.deleteCalls.length, 0);
});

test('finalize rejects a profile archived after upload and leaves the uploaded session unchanged', async () => {
  let parser;

  const { db, photo } = createServices({
    parseMultipartUpload: (...args) => parser(...args),
  });

  const session = await createSession(photo);

  parser = async () => ({
    fields: {
      sessionId: session.sessionId,
      proof: session.proof,
      boardId: DEFAULT_BOARD_ID,
      profileId: 'p1',
      sectionKey: 'clubBoard',
      fileName: 'portrait.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: String(createJpegBytes().length),
    },
    file: {
      mimeType: 'image/jpeg',
      sizeBytes: createJpegBytes().length,
      buffer: createJpegBytes(),
    },
  });

  await photo.uploadHttp({
    method: 'POST',
    headers: { origin: 'http://localhost:5173' },
    get: () => 'http://localhost:5173',
  }, fakeResponse());

  db.writeUpdate(`bodBoards/${DEFAULT_BOARD_ID}/profiles/p1`, {
    status: 'archived',
    archivedAt: '2026-07-17T00:05:00.000Z',
    archivedBy: 'admin-1',
  });

  db.writeUpdate(`bodBoards/${DEFAULT_BOARD_ID}`, {
    'sections.clubBoard.draftRevision': 1,
  });

  await assert.rejects(
    photo.finalizeUpload({
      boardId: DEFAULT_BOARD_ID,
      profileId: 'p1',
      sessionId: session.sessionId,
      expectedDraftRevision: 1,
    }, 'admin-1'),
    (error) => (
      error.code === 'failed-precondition'
      && error.message === 'Archived profiles cannot receive photos.'
    )
  );

  const storedProfileAfter = db.read(
    `bodBoards/${DEFAULT_BOARD_ID}/profiles/p1`
  );

  assert.equal(storedProfileAfter.status, 'archived');
  assert.equal(storedProfileAfter.photo, null);
  assert.equal(
    db.read(`${SESSION_COLLECTION}/${session.sessionId}`).status,
    'uploaded'
  );
  assert.equal(
    db.read(`bodBoards/${DEFAULT_BOARD_ID}`).sections.clubBoard.draftRevision,
    1
  );
});
test('finalize retry returns unchanged when the first successful response was lost', async () => {
  let parser;

  const { db, photo } = createServices({
    parseMultipartUpload: (...args) => parser(...args),
  });

  const session = await createSession(photo);

  parser = async () => ({
    fields: {
      sessionId: session.sessionId,
      proof: session.proof,
      boardId: DEFAULT_BOARD_ID,
      profileId: 'p1',
      sectionKey: 'clubBoard',
      fileName: 'portrait.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: String(createJpegBytes().length),
    },
    file: {
      mimeType: 'image/jpeg',
      sizeBytes: createJpegBytes().length,
      buffer: createJpegBytes(),
    },
  });

  await photo.uploadHttp({
    method: 'POST',
    headers: { origin: 'http://localhost:5173' },
    get: () => 'http://localhost:5173',
  }, fakeResponse());

  const payload = {
    boardId: DEFAULT_BOARD_ID,
    profileId: 'p1',
    sessionId: session.sessionId,
    expectedDraftRevision: 0,
  };

  const first = await photo.finalizeUpload(payload, 'admin-1');

  assert.equal(first.unchanged, false);
  assert.equal(first.draftRevision, 1);
  assert.equal(
    db.read(`${SESSION_COLLECTION}/${session.sessionId}`).status,
    'finalized'
  );

  const beforeRetry = db.dump();

  // Simulates the client retrying the identical request because the first
  // successful callable response was lost.
  const retry = await photo.finalizeUpload(payload, 'admin-1');

  assert.equal(retry.ok, true);
  assert.equal(retry.unchanged, true);
  assert.equal(retry.draftRevision, 1);
  assert.equal(retry.profile.hasPhoto, true);

  // The retry must perform no additional profile, board, session, or audit writes.
  assert.deepEqual(db.dump(), beforeRetry);
});
test('stale finalize uses aborted and leaves uploaded session/profile unchanged', async () => {
  let parser;
  const { db, photo } = createServices({ parseMultipartUpload: (...args) => parser(...args) });
  const session = await createSession(photo);
  parser = async () => ({
    fields: {
      sessionId: session.sessionId,
      proof: session.proof,
      boardId: DEFAULT_BOARD_ID,
      profileId: 'p1',
      sectionKey: 'clubBoard',
      fileName: 'portrait.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: String(createJpegBytes().length),
    },
    file: { mimeType: 'image/jpeg', sizeBytes: createJpegBytes().length, buffer: createJpegBytes() },
  });
  await photo.uploadHttp({ method: 'POST', headers: { origin: 'http://localhost:5173' }, get: () => 'http://localhost:5173' }, fakeResponse());
  const before = db.dump();
  db.writeUpdate(`bodBoards/${DEFAULT_BOARD_ID}`, { 'sections.clubBoard.draftRevision': 1 });

  await assert.rejects(
    photo.finalizeUpload({ boardId: DEFAULT_BOARD_ID, profileId: 'p1', sessionId: session.sessionId, expectedDraftRevision: 0 }, 'admin-1'),
    (error) => error.code === 'aborted'
  );
  assert.equal(db.read(`${SESSION_COLLECTION}/${session.sessionId}`).status, 'uploaded');
  assert.equal(db.read(`bodBoards/${DEFAULT_BOARD_ID}/profiles/p1`).photo, null);
  assert.equal(before[`${SESSION_COLLECTION}/${session.sessionId}`].status, 'uploaded');
});

test('removeBodProfilePhoto creates removed tombstones and no-ops for missing or already removed photos', async () => {
  const { db, drive, photo } = createServices({
    db: initializedDb({ profile: { photo: readyPhoto() } }),
  });
  const removed = await photo.removePhoto({
    boardId: DEFAULT_BOARD_ID,
    profileId: 'p1',
    expectedDraftRevision: 0,
  }, 'admin-1');
  const stored = db.read(`bodBoards/${DEFAULT_BOARD_ID}/profiles/p1`).photo;
  assert.equal(removed.unchanged, false);
  assert.equal(stored.status, 'removed');
  assert.equal(stored.version, 1);
  assert.equal(stored.previousPhoto, null);
  assert.equal(db.read(`bodBoards/${DEFAULT_BOARD_ID}`).sections.clubBoard.draftRevision, 1);
  assert.equal(drive.deleteCalls.length, 0);

  const beforeNoop = db.dump();
  const noop = await photo.removePhoto({
    boardId: DEFAULT_BOARD_ID,
    profileId: 'p1',
    expectedDraftRevision: 1,
  }, 'admin-1');
  assert.equal(noop.unchanged, true);
  assert.deepEqual(db.dump(), beforeNoop);
});

test('cleanup marks expired sessions and deletes only unreferenced orphan uploads after grace', async () => {
  const now = Date.parse('2026-07-17T00:00:00.000Z');
  const old = new FakeTimestamp(now - (26 * 60 * 60 * 1000));
  const { db, drive, photo } = createServices({ nowMillis: () => now });
  drive.files.set('orphan-file', {
    id: 'orphan-file',
    mimeType: 'image/jpeg',
    sizeBytes: 10,
    parents: ['folder'],
    appProperties: {},
    trashed: false,
  });
  drive.files.set('referenced-file', {
    id: 'referenced-file',
    mimeType: 'image/png',
    sizeBytes: 120,
    parents: ['folder'],
    appProperties: {},
    trashed: false,
  });
  db.seed(`${SESSION_COLLECTION}/pending-old`, {
    uid: 'admin-1',
    actorRole: 'admin',
    boardId: DEFAULT_BOARD_ID,
    profileId: 'p1',
    sectionKey: 'clubBoard',
    status: 'pending',
    expected: { fileName: 'a.jpg', mimeType: 'image/jpeg', sizeBytes: 10 },
    expiresAt: old,
  });
  db.seed(`${SESSION_COLLECTION}/uploaded-orphan`, {
    uid: 'admin-1',
    actorRole: 'admin',
    boardId: DEFAULT_BOARD_ID,
    profileId: 'p1',
    sectionKey: 'clubBoard',
    status: 'uploaded',
    expected: { fileName: 'a.jpg', mimeType: 'image/jpeg', sizeBytes: 10 },
    driveFileId: 'orphan-file',
    expiresAt: old,
  });
  db.seed(`${SESSION_COLLECTION}/uploaded-referenced`, {
    uid: 'admin-1',
    actorRole: 'admin',
    boardId: DEFAULT_BOARD_ID,
    profileId: 'p1',
    sectionKey: 'clubBoard',
    status: 'uploaded',
    expected: { fileName: 'a.png', mimeType: 'image/png', sizeBytes: 120 },
    driveFileId: 'referenced-file',
    expiresAt: old,
  });
  db.writeUpdate(`bodBoards/${DEFAULT_BOARD_ID}/profiles/p1`, { photo: readyPhoto({ driveFileId: 'referenced-file' }) });

  const result = await photo.cleanupExpiredSessions({ limit: 10 }, 'admin-1');

  assert.equal(result.cleaned, 3);
  assert.equal(db.read(`${SESSION_COLLECTION}/pending-old`).status, 'expired');
  assert.equal(db.read(`${SESSION_COLLECTION}/uploaded-orphan`).status, 'expired');
  assert.equal(db.read(`${SESSION_COLLECTION}/uploaded-referenced`).status, 'expired');
  assert.deepEqual(drive.deleteCalls, ['orphan-file']);
});
