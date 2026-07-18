'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  DEFAULT_BOARD_ID,
  DEFAULT_RIY_LABEL,
  createBodManagementService,
  publicFallback,
} = require('./bod-management');

class TestHttpsError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function resolveServerTimestamps(value) {
  if (Array.isArray(value)) return value.map(resolveServerTimestamps);
  if (value && typeof value === 'object') {
    if (value.__serverTimestamp === true) return '2026-07-17T00:00:00.000Z';
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, resolveServerTimestamps(item)])
    );
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
  cursor[parts[parts.length - 1]] = resolveServerTimestamps(clone(value));
}

class FakeSnapshot {
  constructor(data, id = '') {
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
  }

  collection(collectionId) {
    return new FakeCollectionRef(this._db, [...this.path.split('/'), collectionId]);
  }

  get() {
    return Promise.resolve(new FakeSnapshot(this._db.read(this.path), this.path.split('/').at(-1)));
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
    return Promise.resolve({
      docs: this._db.collectionDocs(this._pathParts.join('/')),
    });
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
    return Promise.resolve(new FakeSnapshot(this._db.read(ref.path), ref.path.split('/').at(-1)));
  }

  set(ref, data, options = {}) {
    this._writes.push({ type: 'set', path: ref.path, data: clone(data), options });
  }

  update(ref, data) {
    this._writes.push({ type: 'update', path: ref.path, data: clone(data) });
  }

  commit() {
    for (const write of this._writes) {
      if (write.type === 'set') {
        this._db.writeSet(write.path, write.data, write.options);
      } else {
        this._db.writeUpdate(write.path, write.data);
      }
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

  collectionDocs(collectionPath) {
    const prefix = `${collectionPath}/`;
    return this.paths()
      .filter((documentPath) => documentPath.startsWith(prefix))
      .filter((documentPath) => documentPath.slice(prefix.length).split('/').length === 1)
      .map((documentPath) => new FakeSnapshot(this.read(documentPath), documentPath.split('/').at(-1)));
  }

  seed(documentPath, data) {
    this._store.set(documentPath, clone(data));
  }

  writeSet(documentPath, data, options = {}) {
    const resolved = resolveServerTimestamps(data);
    if (options.merge === true) {
      const current = this.read(documentPath) || {};
      this._store.set(documentPath, { ...current, ...clone(resolved) });
      return;
    }
    this._store.set(documentPath, clone(resolved));
  }

  writeUpdate(documentPath, data) {
    if (!this._store.has(documentPath)) {
      throw new Error(`Missing document for update: ${documentPath}`);
    }
    const current = this.read(documentPath);
    Object.entries(data).forEach(([key, value]) => setPath(current, key, value));
    this._store.set(documentPath, current);
  }

  paths() {
    return Array.from(this._store.keys()).sort();
  }

  dump() {
    return Object.fromEntries(this.paths().map((key) => [key, this.read(key)]));
  }
}

function testAdmin({ role = 'admin', approved = true, db = new FakeDb(), authority = {} } = {}) {
  const logger = { warn: () => {} };
  const service = createBodManagementService({
    db,
    admin: {
      firestore: {
        FieldValue: {
          serverTimestamp: () => ({ __serverTimestamp: true }),
        },
      },
    },
    HttpsError: TestHttpsError,
    assertApprovedActiveCallableAccount: async () => {
      if (!approved) throw new TestHttpsError('permission-denied', 'Approved active account required.');
      return {};
    },
    getAuthorityContext: async (uid) => ({
      uid,
      role,
      authority,
    }),
    logger,
  });

  return { db, service };
}

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
  return {
    activeBoardId: DEFAULT_BOARD_ID,
    schemaVersion: 1,
  };
}

function draftPayload(overrides = {}) {
  return {
    boardId: DEFAULT_BOARD_ID,
    sectionKey: 'clubBoard',
    publicationStatus: 'draft',
    expectedDraftRevision: 0,
    expectedPublishedRevision: 0,
    ...overrides,
  };
}

function publishPayload(overrides = {}) {
  return {
    boardId: DEFAULT_BOARD_ID,
    sectionKey: 'clubBoard',
    expectedDraftRevision: 0,
    expectedPublishedRevision: 0,
    ...overrides,
  };
}

function profileInput(overrides = {}) {
  return {
    sectionKey: 'clubBoard',
    name: ' Rtr. Test Member ',
    positionKey: 'president',
    positionLabel: 'Spoofed Label',
    summary: ' Leads club work. ',
    bio: '',
    avenueLabels: ['Community', 'community', ' Club '],
    instagramUsername: '@test.member',
    linkedBodMemberId: null,
    linkedUserUid: null,
    sortOrder: 10,
    displayPublicly: false,
    ...overrides,
  };
}

function externalProfileInput(overrides = {}) {
  return {
    sectionKey: 'leadershipBeyondClub',
    name: ' Rtr. External Leader ',
    positionKey: 'custom',
    positionLabel: ' District Secretary ',
    summary: ' Serves beyond the club. ',
    bio: '',
    avenueLabels: ['Professional'],
    leadershipLevel: 'district',
    organizationName: ' Rotaract District 3131 ',
    termLabel: ' RIY 2026-27 ',
    instagramUsername: null,
    linkedBodMemberId: null,
    linkedUserUid: null,
    sortOrder: 10,
    displayPublicly: false,
    ...overrides,
  };
}

function storedProfile(overrides = {}) {
  const status = overrides.status || 'active';
  return {
    ...profileInput(),
    name: 'Rtr. Test Member',
    positionLabel: 'President',
    avenueLabels: ['Community', 'Club'],
    instagramUsername: 'test.member',
    status,
    photo: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    createdBy: 'admin-1',
    updatedAt: '2026-07-01T00:00:00.000Z',
    updatedBy: 'admin-1',
    archivedAt: status === 'archived' ? '2026-07-02T00:00:00.000Z' : null,
    archivedBy: status === 'archived' ? 'admin-1' : null,
    ...overrides,
  };
}

function storedExternalProfile(overrides = {}) {
  const status = overrides.status || 'active';
  return {
    ...externalProfileInput(),
    name: 'Rtr. External Leader',
    positionLabel: 'District Secretary',
    summary: 'Serves beyond the club.',
    avenueLabels: ['Professional'],
    organizationName: 'Rotaract District 3131',
    termLabel: 'RIY 2026-27',
    status,
    photo: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    createdBy: 'admin-1',
    updatedAt: '2026-07-01T00:00:00.000Z',
    updatedBy: 'admin-1',
    archivedAt: status === 'archived' ? '2026-07-02T00:00:00.000Z' : null,
    archivedBy: status === 'archived' ? 'admin-1' : null,
    ...overrides,
  };
}

function readyPhoto(overrides = {}) {
  return {
    status: 'ready',
    storageProvider: 'googleDrive',
    driveFileId: 'drive-file-1',
    driveFolderId: 'drive-folder-1',
    mimeType: 'image/jpeg',
    originalName: 'portrait.jpg',
    sizeBytes: 1200,
    width: null,
    height: null,
    sha256: 'a'.repeat(64),
    version: 1,
    uploadedAt: '2026-07-01T00:00:00.000Z',
    uploadedBy: 'admin-1',
    uploadSessionId: 'session-1',
    previousPhoto: null,
    ...overrides,
  };
}

function initializedDb(extra = {}) {
  return new FakeDb({
    'bodSettings/publicBoard': settingDocument(),
    [`bodBoards/${DEFAULT_BOARD_ID}`]: boardDocument(extra.boardSections || {}),
    ...(extra.documents || {}),
  });
}

function upsertPayload(overrides = {}) {
  return {
    boardId: DEFAULT_BOARD_ID,
    expectedDraftRevision: 0,
    profile: profileInput(),
    ...overrides,
  };
}

function upsertExternalPayload(overrides = {}) {
  return upsertPayload({
    profile: externalProfileInput(),
    ...overrides,
  });
}

test('BOD Management defaults expose the locked RIY label', () => {
  assert.equal(DEFAULT_BOARD_ID, 'riy-2026-27');
  assert.equal(DEFAULT_RIY_LABEL, 'RIY 2026\u201327');
  assert.equal(publicFallback().sections.clubBoard.state, 'draft');
});

test('missing BOD setting returns virtual Draft defaults without writing', async () => {
  const { db, service } = testAdmin();
  const result = await service.getBodManagementBoard({}, 'admin-1');

  assert.equal(result.ok, true);
  assert.equal(result.initialized, false);
  assert.equal(result.boardId, DEFAULT_BOARD_ID);
  assert.deepEqual(result.sections.clubBoard, {
    publicationStatus: 'draft',
    draftRevision: 0,
    publishedRevision: 0,
    publishedAt: null,
  });
  assert.deepEqual(db.paths(), []);
});

test('missing BOD board returns virtual Draft defaults', async () => {
  const db = new FakeDb({ 'bodSettings/publicBoard': settingDocument() });
  const { service } = testAdmin({ db });
  const result = await service.getBodManagementBoard({}, 'admin-1');

  assert.equal(result.ok, true);
  assert.equal(result.boardId, DEFAULT_BOARD_ID);
  assert.equal(result.sections.leadershipBeyondClub.publicationStatus, 'draft');
});

test('BOD Management authority is limited to canonical admin and president roles', async () => {
  await testAdmin({ role: 'admin' }).service.assertBodManagementAuthority('admin-1');
  await testAdmin({ role: 'president' }).service.assertBodManagementAuthority('president-1');

  await assert.rejects(
    testAdmin({ role: 'bod', authority: { hasSergeantAtArmsPosition: true } })
      .service.assertBodManagementAuthority('saa-1'),
    (err) => err.code === 'permission-denied'
  );
  await assert.rejects(
    testAdmin({ role: 'bod', authority: { hasPresidentAuthority: true, hasWebsiteDirectorPosition: true } })
      .service.assertBodManagementAuthority('cwd-1'),
    (err) => err.code === 'permission-denied'
  );
  await assert.rejects(
    testAdmin({ role: 'bod' }).service.assertBodManagementAuthority('bod-1'),
    (err) => err.code === 'permission-denied'
  );
  await assert.rejects(
    testAdmin({ role: 'admin', approved: false }).service.assertBodManagementAuthority('inactive-admin'),
    (err) => err.code === 'permission-denied'
  );
});

test('saveBodSectionPublication rejects public, invalid sections, and invalid revisions', async () => {
  const { service } = testAdmin();

  await assert.rejects(
    service.saveBodSectionPublication(draftPayload({ publicationStatus: 'public' }), 'admin-1'),
    (err) => err.code === 'invalid-argument'
  );
  await assert.rejects(
    service.saveBodSectionPublication(draftPayload({ sectionKey: 'profiles' }), 'admin-1'),
    (err) => err.code === 'invalid-argument'
  );
  await assert.rejects(
    service.saveBodSectionPublication(draftPayload({ expectedDraftRevision: -1 }), 'admin-1'),
    (err) => err.code === 'invalid-argument'
  );
  await assert.rejects(
    service.saveBodSectionPublication(draftPayload({ boardId: 'riy-2027/28' }), 'admin-1'),
    (err) => err.code === 'invalid-argument'
  );
  await assert.rejects(
    service.saveBodSectionPublication(draftPayload({ boardId: `${DEFAULT_BOARD_ID}${'x'.repeat(81)}` }), 'admin-1'),
    (err) => err.code === 'invalid-argument'
  );
});

test('first explicit Draft save initializes settings, both sections, and boardCreated audit', async () => {
  const { db, service } = testAdmin();
  const result = await service.saveBodSectionPublication(draftPayload(), 'admin-1');

  assert.equal(result.ok, true);
  assert.equal(result.initialized, true);
  assert.equal(result.unchanged, true);

  const setting = db.read('bodSettings/publicBoard');
  const board = db.read(`bodBoards/${DEFAULT_BOARD_ID}`);
  assert.equal(setting.activeBoardId, DEFAULT_BOARD_ID);
  assert.equal(board.sections.clubBoard.publicationStatus, 'draft');
  assert.equal(board.sections.leadershipBeyondClub.publicationStatus, 'draft');
  assert.equal(board.sections.clubBoard.draftRevision, 0);
  assert.equal(board.sections.clubBoard.publishedRevision, 0);

  const auditPath = db.paths().find((documentPath) => documentPath.includes('/audit/'));
  assert.ok(auditPath);
  assert.equal(db.read(auditPath).eventType, 'boardCreated');
});

test('existing Draft save returns unchanged without incrementing revisions', async () => {
  const db = new FakeDb({
    'bodSettings/publicBoard': settingDocument(),
    [`bodBoards/${DEFAULT_BOARD_ID}`]: boardDocument(),
  });
  const { service } = testAdmin({ db });
  const before = db.dump();
  const result = await service.saveBodSectionPublication(draftPayload(), 'admin-1');

  assert.equal(result.unchanged, true);
  assert.equal(result.section.draftRevision, 0);
  assert.equal(result.section.publishedRevision, 0);
  assert.deepEqual(db.dump(), before);
});

test('stored activeBoardId without RIY format causes controlled Admin error', async () => {
  const db = new FakeDb({
    'bodSettings/publicBoard': { activeBoardId: 'board-2026', schemaVersion: 1 },
  });
  const { service } = testAdmin({ db });

  await assert.rejects(
    service.getBodManagementBoard({}, 'admin-1'),
    (err) => err.code === 'failed-precondition'
  );
});

test('stored activeBoardId without RIY format causes public Draft fallback', async () => {
  const db = new FakeDb({
    'bodSettings/publicBoard': { activeBoardId: 'board-2026', schemaVersion: 1 },
  });
  const payload = await testAdmin({ db }).service.getPublicBodBoardPayload();

  assert.deepEqual(payload, publicFallback());
});

test('stored boardId must match the Firestore document path', async () => {
  const board = boardDocument();
  board.boardId = 'riy-2027-28';
  const db = new FakeDb({
    'bodSettings/publicBoard': settingDocument(),
    [`bodBoards/${DEFAULT_BOARD_ID}`]: board,
  });
  const { service } = testAdmin({ db });

  await assert.rejects(
    service.getBodManagementBoard({}, 'admin-1'),
    (err) => err.code === 'failed-precondition'
  );
});

test('missing stored section objects are rejected', async () => {
  const missingClubBoard = boardDocument();
  delete missingClubBoard.sections.clubBoard;
  const missingLeadership = boardDocument();
  delete missingLeadership.sections.leadershipBeyondClub;

  for (const board of [missingClubBoard, missingLeadership]) {
    const db = new FakeDb({
      'bodSettings/publicBoard': settingDocument(),
      [`bodBoards/${DEFAULT_BOARD_ID}`]: board,
    });
    const { service } = testAdmin({ db });
    await assert.rejects(
      service.getBodManagementBoard({}, 'admin-1'),
      (err) => err.code === 'failed-precondition'
    );
  }
});

test('missing stored publicationStatus is rejected', async () => {
  const board = boardDocument();
  delete board.sections.clubBoard.publicationStatus;
  const db = new FakeDb({
    'bodSettings/publicBoard': settingDocument(),
    [`bodBoards/${DEFAULT_BOARD_ID}`]: board,
  });
  const { service } = testAdmin({ db });

  await assert.rejects(
    service.getBodManagementBoard({}, 'admin-1'),
    (err) => err.code === 'failed-precondition'
  );
});

test('missing stored revision fields are rejected', async () => {
  for (const revisionField of ['draftRevision', 'publishedRevision']) {
    const board = boardDocument();
    delete board.sections.clubBoard[revisionField];
    const db = new FakeDb({
      'bodSettings/publicBoard': settingDocument(),
      [`bodBoards/${DEFAULT_BOARD_ID}`]: board,
    });
    const { service } = testAdmin({ db });
    await assert.rejects(
      service.getBodManagementBoard({}, 'admin-1'),
      (err) => err.code === 'failed-precondition'
    );
  }
});

test('missing stored publication metadata fields are rejected', async () => {
  for (const metadataField of ['publishedAt', 'publishedBy']) {
    const board = boardDocument();
    delete board.sections.clubBoard[metadataField];
    const db = new FakeDb({
      'bodSettings/publicBoard': settingDocument(),
      [`bodBoards/${DEFAULT_BOARD_ID}`]: board,
    });
    const { service } = testAdmin({ db });
    await assert.rejects(
      service.getBodManagementBoard({}, 'admin-1'),
      (err) => err.code === 'failed-precondition'
    );
  }
});

test('malformed stored publication timestamp is rejected', async () => {
  const board = boardDocument({
    clubBoard: {
      publishedAt: 'July 1, 2026',
    },
  });
  const db = new FakeDb({
    'bodSettings/publicBoard': settingDocument(),
    [`bodBoards/${DEFAULT_BOARD_ID}`]: board,
  });
  const { service } = testAdmin({ db });

  await assert.rejects(
    service.getBodManagementBoard({}, 'admin-1'),
    (err) => err.code === 'failed-precondition'
  );
});

test('malformed existing board causes public Draft fallback', async () => {
  const board = boardDocument();
  delete board.sections.clubBoard.publicationStatus;
  const db = new FakeDb({
    'bodSettings/publicBoard': settingDocument(),
    [`bodBoards/${DEFAULT_BOARD_ID}`]: board,
  });
  const payload = await testAdmin({ db }).service.getPublicBodBoardPayload();

  assert.deepEqual(payload, publicFallback());
});

test('public fallback sections do not share mutable profile arrays', () => {
  const payload = publicFallback();
  payload.sections.clubBoard.profiles.push({ name: 'leak' });

  assert.deepEqual(payload.sections.leadershipBeyondClub.profiles, []);
});

test('uninitialized board returns empty profile arrays and position presets', async () => {
  const { service } = testAdmin();
  const result = await service.getBodManagementBoard({}, 'admin-1');

  assert.deepEqual(result.profiles, { clubBoard: [], leadershipBeyondClub: [] });
  assert.ok(result.options.positionPresets.some((preset) => preset.key === 'president'));
  assert.ok(result.options.positionPresets.some((preset) => preset.key === 'custom'));
});

test('initialized board returns sorted active and archived Club BOD profiles with sanitized links', async () => {
  const db = initializedDb({
    documents: {
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/b`]: storedProfile({ name: 'Beta', sortOrder: 20 }),
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/a`]: storedProfile({ name: 'Alpha', sortOrder: 10 }),
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/z`]: storedProfile({ name: 'Archived', sortOrder: 1, status: 'archived' }),
      'bodMembers/member-1': { name: 'Roster Person', position: 'Secretary' },
      'users/user-1': { name: 'Portal Person', status: 'approved', active: true, email: 'hidden@example.com' },
      'users/user-2': { name: 'Inactive Person', status: 'approved', active: false },
      'roles/user-1': { role: 'bod', status: 'approved' },
      'roles/user-2': { role: 'bod', status: 'approved' },
    },
  });
  const result = await testAdmin({ db }).service.getBodManagementBoard({}, 'admin-1');

  assert.deepEqual(result.profiles.clubBoard.map((profile) => profile.id), ['a', 'b', 'z']);
  assert.deepEqual(result.profiles.leadershipBeyondClub, []);
  assert.deepEqual(result.options.bodMemberLinks, [{ id: 'member-1', name: 'Roster Person', positionLabel: 'Secretary' }]);
  assert.deepEqual(result.options.userLinks, [{ uid: 'user-1', name: 'Portal Person', role: 'bod' }]);
  assert.equal(JSON.stringify(result).includes('hidden@example.com'), false);
});

test('initialized board returns both sections sorted independently with leadership options', async () => {
  const db = initializedDb({
    documents: {
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/club-a`]: storedProfile({ name: 'Club A', sortOrder: 10 }),
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/ext-b`]: storedExternalProfile({ name: 'External B', sortOrder: 20 }),
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/ext-a`]: storedExternalProfile({ name: 'External A', sortOrder: 10 }),
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/ext-z`]: storedExternalProfile({ name: 'External Archived', sortOrder: 1, status: 'archived' }),
      'users/user-1': { name: 'Portal Person', status: 'approved', active: true, email: 'hidden@example.com' },
      'roles/user-1': { role: 'president', status: 'approved' },
    },
  });
  const result = await testAdmin({ db }).service.getBodManagementBoard({}, 'admin-1');

  assert.deepEqual(result.profiles.clubBoard.map((profile) => profile.id), ['club-a']);
  assert.deepEqual(result.profiles.leadershipBeyondClub.map((profile) => profile.id), ['ext-a', 'ext-b', 'ext-z']);
  assert.deepEqual(result.profiles.leadershipBeyondClub.map((profile) => profile.leadershipLevel), ['district', 'district', 'district']);
  assert.ok(result.options.leadershipLevels.some((level) => level.key === 'multiDistrict' && level.label === 'Multi-District'));
  assert.equal(JSON.stringify(result).includes('hidden@example.com'), false);
});

test('malformed external stored profile is rejected while existing Club BOD shape remains valid', async () => {
  const validClubDb = initializedDb({
    documents: {
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/club-a`]: storedProfile(),
    },
  });
  const validClub = await testAdmin({ db: validClubDb }).service.getBodManagementBoard({}, 'admin-1');
  assert.equal(validClub.profiles.clubBoard.length, 1);

  const malformedExternalDb = initializedDb({
    documents: {
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/ext-a`]: storedExternalProfile({ leadershipLevel: 'galaxy' }),
    },
  });
  await assert.rejects(
    testAdmin({ db: malformedExternalDb }).service.getBodManagementBoard({}, 'admin-1'),
    (err) => err.code === 'failed-precondition'
  );
});

test('stored external position key must be exact custom while Club BOD shape is unchanged', async () => {
  const validExternalDb = initializedDb({
    documents: {
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/ext-a`]: storedExternalProfile({ positionKey: 'custom' }),
    },
  });
  const validExternal = await testAdmin({ db: validExternalDb }).service.getBodManagementBoard({}, 'admin-1');
  assert.equal(validExternal.profiles.leadershipBeyondClub[0].positionKey, 'custom');

  const missingPositionKey = storedExternalProfile();
  delete missingPositionKey.positionKey;
  for (const profile of [
    storedExternalProfile({ positionKey: null }),
    storedExternalProfile({ positionKey: '' }),
    storedExternalProfile({ positionKey: 'president' }),
    missingPositionKey,
  ]) {
    const db = initializedDb({
      documents: {
        [`bodBoards/${DEFAULT_BOARD_ID}/profiles/ext-a`]: profile,
      },
    });
    await assert.rejects(
      testAdmin({ db }).service.getBodManagementBoard({}, 'admin-1'),
      (err) => err.code === 'failed-precondition'
    );
  }

  const validClubDb = initializedDb({
    documents: {
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/club-a`]: storedProfile({ positionKey: 'president' }),
    },
  });
  const validClub = await testAdmin({ db: validClubDb }).service.getBodManagementBoard({}, 'admin-1');
  assert.equal(validClub.profiles.clubBoard[0].positionKey, 'president');
});

test('valid active and archived stored profiles are accepted', async () => {
  const db = initializedDb({
    documents: {
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/a`]: storedProfile({ name: 'Active', status: 'active' }),
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/z`]: storedProfile({ name: 'Archived', status: 'archived' }),
    },
  });
  const result = await testAdmin({ db }).service.getBodManagementBoard({}, 'admin-1');

  assert.deepEqual(result.profiles.clubBoard.map((profile) => [profile.id, profile.status]), [
    ['a', 'active'],
    ['z', 'archived'],
  ]);
});

test('invalid stored profile createdAt is rejected', async () => {
  const db = initializedDb({
    documents: {
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/p1`]: storedProfile({ createdAt: 'not-a-date' }),
    },
  });

  await assert.rejects(
    testAdmin({ db }).service.getBodManagementBoard({}, 'admin-1'),
    (err) => err.code === 'failed-precondition'
  );
});

test('invalid stored profile updatedAt is rejected', async () => {
  const db = initializedDb({
    documents: {
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/p1`]: storedProfile({ updatedAt: null }),
    },
  });

  await assert.rejects(
    testAdmin({ db }).service.getBodManagementBoard({}, 'admin-1'),
    (err) => err.code === 'failed-precondition'
  );
});

test('active stored profile with archive metadata is rejected', async () => {
  const db = initializedDb({
    documents: {
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/p1`]: storedProfile({
        status: 'active',
        archivedAt: '2026-07-02T00:00:00.000Z',
        archivedBy: 'admin-1',
      }),
    },
  });

  await assert.rejects(
    testAdmin({ db }).service.getBodManagementBoard({}, 'admin-1'),
    (err) => err.code === 'failed-precondition'
  );
});

test('archived stored profile without archivedAt is rejected', async () => {
  const db = initializedDb({
    documents: {
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/p1`]: storedProfile({
        status: 'archived',
        archivedAt: null,
      }),
    },
  });

  await assert.rejects(
    testAdmin({ db }).service.getBodManagementBoard({}, 'admin-1'),
    (err) => err.code === 'failed-precondition'
  );
});

test('archived stored profile without archivedBy is rejected', async () => {
  const db = initializedDb({
    documents: {
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/p1`]: storedProfile({
        status: 'archived',
        archivedBy: null,
      }),
    },
  });

  await assert.rejects(
    testAdmin({ db }).service.getBodManagementBoard({}, 'admin-1'),
    (err) => err.code === 'failed-precondition'
  );
});

test('upsertBodProfile creates an incomplete Club BOD draft profile and audits once', async () => {
  const db = initializedDb();
  const { service } = testAdmin({ db });
  const result = await service.upsertBodProfile(upsertPayload({
    profile: profileInput({
      name: '',
      summary: '',
      instagramUsername: 'https://www.instagram.com/test.member/',
    }),
  }), 'admin-1');

  const board = db.read(`bodBoards/${DEFAULT_BOARD_ID}`);
  const profile = db.read(`bodBoards/${DEFAULT_BOARD_ID}/profiles/${result.profileId}`);
  assert.equal(result.ok, true);
  assert.equal(result.draftRevision, 1);
  assert.equal(board.sections.clubBoard.draftRevision, 1);
  assert.equal(board.sections.leadershipBeyondClub.draftRevision, 0);
  assert.equal(profile.status, 'active');
  assert.equal(profile.photo, null);
  assert.equal(profile.archivedAt, null);
  assert.equal(profile.positionLabel, 'President');
  assert.equal(profile.instagramUsername, 'test.member');

  const auditPath = db.paths().find((documentPath) => documentPath.includes('/audit/'));
  assert.equal(db.read(auditPath).eventType, 'profileCreated');
  assert.equal(db.read(auditPath).draftRevisionAfter, 1);
});

test('upsertBodProfile rejects server fields, external leadership fields, and invalid Instagram', async () => {
  const { service } = testAdmin({ db: initializedDb() });

  await assert.rejects(
    service.upsertBodProfile(upsertPayload({ profile: { ...profileInput(), photo: null } }), 'admin-1'),
    (err) => err.code === 'invalid-argument'
  );
  await assert.rejects(
    service.upsertBodProfile(upsertPayload({ profile: { ...profileInput(), leadershipLevel: 'district' } }), 'admin-1'),
    (err) => err.code === 'invalid-argument'
  );
  await assert.rejects(
    service.upsertBodProfile(upsertPayload({ profile: profileInput({ instagramUsername: 'https://example.com/test' }) }), 'admin-1'),
    (err) => err.code === 'invalid-argument'
  );
});

test('upsertBodProfile creates incomplete external leadership draft and increments only that section', async () => {
  const db = initializedDb();
  const { service } = testAdmin({ db });
  const result = await service.upsertBodProfile(upsertExternalPayload({
    profile: externalProfileInput({
      name: '',
      positionKey: '',
      positionLabel: '',
      leadershipLevel: null,
      organizationName: '',
      termLabel: '',
      summary: '',
    }),
  }), 'admin-1');

  const board = db.read(`bodBoards/${DEFAULT_BOARD_ID}`);
  const profile = db.read(`bodBoards/${DEFAULT_BOARD_ID}/profiles/${result.profileId}`);
  assert.equal(result.ok, true);
  assert.equal(result.sectionKey, 'leadershipBeyondClub');
  assert.equal(result.draftRevision, 1);
  assert.equal(board.sections.clubBoard.draftRevision, 0);
  assert.equal(board.sections.leadershipBeyondClub.draftRevision, 1);
  assert.equal(profile.sectionKey, 'leadershipBeyondClub');
  assert.equal(profile.positionKey, 'custom');
  assert.equal(profile.positionLabel, '');
  assert.equal(profile.leadershipLevel, null);
  assert.equal(profile.organizationName, '');
  assert.equal(profile.termLabel, '');
  assert.equal(profile.status, 'active');
  assert.equal(profile.photo, null);
  assert.equal(profile.archivedAt, null);

  const auditPath = db.paths().find((documentPath) => documentPath.includes('/audit/'));
  const audit = db.read(auditPath);
  assert.equal(audit.eventType, 'profileCreated');
  assert.equal(audit.sectionKey, 'leadershipBeyondClub');
  assert.equal(audit.draftRevisionAfter, 1);

  const omittedPositionInput = externalProfileInput({ name: 'Omitted Position Key' });
  delete omittedPositionInput.positionKey;
  const omitted = await service.upsertBodProfile(upsertExternalPayload({
    expectedDraftRevision: 1,
    profile: omittedPositionInput,
  }), 'admin-1');
  const omittedProfile = db.read(`bodBoards/${DEFAULT_BOARD_ID}/profiles/${omitted.profileId}`);
  assert.equal(omittedProfile.positionKey, 'custom');
});

test('external leadership validation rejects unknown levels, overlong fields, preset positions, unknown fields, and invalid Instagram', async () => {
  const service = testAdmin({ db: initializedDb() }).service;
  for (const profile of [
    externalProfileInput({ leadershipLevel: 'galaxy' }),
    externalProfileInput({ organizationName: 'O'.repeat(141) }),
    externalProfileInput({ termLabel: 'T'.repeat(61) }),
    externalProfileInput({ positionKey: 'president' }),
    externalProfileInput({ extraField: true }),
    externalProfileInput({ instagramUsername: 'bad username' }),
  ]) {
    await assert.rejects(
      service.upsertBodProfile(upsertExternalPayload({ profile }), 'admin-1'),
      (err) => err.code === 'invalid-argument'
    );
  }
});

test('external update preserves lifecycle, rejects section moves, supports no-op and visibility audit', async () => {
  const db = initializedDb({
    boardSections: { leadershipBeyondClub: { draftRevision: 2 } },
    documents: {
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/ext-a`]: storedExternalProfile({
        createdBy: 'creator',
        archivedAt: null,
        archivedBy: null,
      }),
    },
  });
  const service = testAdmin({ db }).service;
  const updated = await service.upsertBodProfile(upsertExternalPayload({
    profileId: 'ext-a',
    expectedDraftRevision: 2,
    profile: externalProfileInput({
      name: 'Updated External',
      leadershipLevel: 'zone',
      organizationName: 'Zone 1',
      termLabel: '2026-27',
      displayPublicly: true,
    }),
  }), 'admin-1');
  const profile = db.read(`bodBoards/${DEFAULT_BOARD_ID}/profiles/ext-a`);
  const auditPath = db.paths().find((documentPath) => documentPath.includes('/audit/'));

  assert.equal(updated.draftRevision, 3);
  assert.equal(profile.name, 'Updated External');
  assert.equal(profile.leadershipLevel, 'zone');
  assert.equal(profile.organizationName, 'Zone 1');
  assert.equal(profile.createdBy, 'creator');
  assert.equal(profile.photo, null);
  assert.equal(db.read(`bodBoards/${DEFAULT_BOARD_ID}`).sections.clubBoard.draftRevision, 0);
  assert.equal(db.read(`bodBoards/${DEFAULT_BOARD_ID}`).sections.leadershipBeyondClub.draftRevision, 3);
  assert.equal(db.read(auditPath).sectionKey, 'leadershipBeyondClub');

  await assert.rejects(
    service.upsertBodProfile(upsertPayload({
      profileId: 'ext-a',
      expectedDraftRevision: 3,
      profile: profileInput(),
    }), 'admin-1'),
    (err) => err.code === 'invalid-argument'
  );

  const beforeNoop = db.dump();
  const noop = await service.upsertBodProfile(upsertExternalPayload({
    profileId: 'ext-a',
    expectedDraftRevision: 3,
    profile: externalProfileInput({
      name: 'Updated External',
      leadershipLevel: 'zone',
      organizationName: 'Zone 1',
      termLabel: '2026-27',
      displayPublicly: true,
    }),
  }), 'admin-1');
  assert.equal(noop.unchanged, true);
  assert.deepEqual(db.dump(), beforeNoop);
});

test('upsertBodProfile accepts valid new BOD roster link', async () => {
  const db = initializedDb({
    documents: {
      'bodMembers/member-1': { name: 'Roster Person' },
    },
  });
  const result = await testAdmin({ db }).service.upsertBodProfile(upsertPayload({
    profile: profileInput({ linkedBodMemberId: 'member-1' }),
  }), 'admin-1');
  const profile = db.read(`bodBoards/${DEFAULT_BOARD_ID}/profiles/${result.profileId}`);

  assert.equal(result.ok, true);
  assert.equal(profile.linkedBodMemberId, 'member-1');
});

test('upsertBodProfile accepts valid new user link without requiring a BOD role', async () => {
  const db = initializedDb({
    documents: {
      'users/user-1': { name: 'Portal Person', status: 'approved', active: true },
    },
  });
  const result = await testAdmin({ db }).service.upsertBodProfile(upsertPayload({
    profile: profileInput({ linkedUserUid: 'user-1' }),
  }), 'admin-1');
  const profile = db.read(`bodBoards/${DEFAULT_BOARD_ID}/profiles/${result.profileId}`);

  assert.equal(result.ok, true);
  assert.equal(profile.linkedUserUid, 'user-1');
});

test('missing new BOD roster link is rejected with zero writes', async () => {
  const db = initializedDb();
  const before = db.dump();

  await assert.rejects(
    testAdmin({ db }).service.upsertBodProfile(upsertPayload({
      profile: profileInput({ linkedBodMemberId: 'missing-member' }),
    }), 'admin-1'),
    (err) => err.code === 'failed-precondition'
  );
  assert.deepEqual(db.dump(), before);
});

test('missing new user link is rejected with zero writes', async () => {
  const db = initializedDb();
  const before = db.dump();

  await assert.rejects(
    testAdmin({ db }).service.upsertBodProfile(upsertPayload({
      profile: profileInput({ linkedUserUid: 'missing-user' }),
    }), 'admin-1'),
    (err) => err.code === 'failed-precondition'
  );
  assert.deepEqual(db.dump(), before);
});

test('changed profile links are revalidated', async () => {
  const db = initializedDb({
    documents: {
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/p1`]: storedProfile({
        linkedBodMemberId: 'member-1',
        linkedUserUid: 'user-1',
      }),
      'bodMembers/member-1': { name: 'Old Roster' },
      'bodMembers/member-2': { name: 'New Roster' },
      'users/user-1': { name: 'Old User' },
      'users/user-2': { name: 'New User' },
    },
  });
  const result = await testAdmin({ db }).service.upsertBodProfile(upsertPayload({
    profileId: 'p1',
    profile: profileInput({
      linkedBodMemberId: 'member-2',
      linkedUserUid: 'user-2',
    }),
  }), 'admin-1');
  const profile = db.read(`bodBoards/${DEFAULT_BOARD_ID}/profiles/p1`);

  assert.equal(result.draftRevision, 1);
  assert.equal(profile.linkedBodMemberId, 'member-2');
  assert.equal(profile.linkedUserUid, 'user-2');
});

test('changed missing profile links are rejected with zero writes', async () => {
  for (const profile of [
    profileInput({ linkedBodMemberId: 'missing-member', linkedUserUid: 'user-1' }),
    profileInput({ linkedBodMemberId: 'member-1', linkedUserUid: 'missing-user' }),
  ]) {
    const db = initializedDb({
      documents: {
        [`bodBoards/${DEFAULT_BOARD_ID}/profiles/p1`]: storedProfile({
          linkedBodMemberId: 'member-1',
          linkedUserUid: 'user-1',
        }),
        'bodMembers/member-1': { name: 'Roster Person' },
        'users/user-1': { name: 'Portal Person' },
      },
    });
    const before = db.dump();
    await assert.rejects(
      testAdmin({ db }).service.upsertBodProfile(upsertPayload({
        profileId: 'p1',
        profile,
      }), 'admin-1'),
      (err) => err.code === 'failed-precondition'
    );
    assert.deepEqual(db.dump(), before);
  }
});

test('unchanged stale links do not prevent unrelated profile edits', async () => {
  const db = initializedDb({
    documents: {
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/p1`]: storedProfile({
        linkedBodMemberId: 'removed-member',
        linkedUserUid: 'removed-user',
      }),
    },
  });
  const result = await testAdmin({ db }).service.upsertBodProfile(upsertPayload({
    profileId: 'p1',
    profile: profileInput({
      name: 'Updated With Stale Links',
      linkedBodMemberId: 'removed-member',
      linkedUserUid: 'removed-user',
    }),
  }), 'admin-1');
  const profile = db.read(`bodBoards/${DEFAULT_BOARD_ID}/profiles/p1`);

  assert.equal(result.draftRevision, 1);
  assert.equal(profile.name, 'Updated With Stale Links');
  assert.equal(profile.linkedBodMemberId, 'removed-member');
  assert.equal(profile.linkedUserUid, 'removed-user');
});

test('external profiles verify changed links and allow the same linked person across sections', async () => {
  const db = initializedDb({
    documents: {
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/club-a`]: storedProfile({
        linkedBodMemberId: 'member-1',
        linkedUserUid: 'user-1',
      }),
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/ext-a`]: storedExternalProfile({
        linkedBodMemberId: 'member-1',
        linkedUserUid: 'user-1',
      }),
      'bodMembers/member-1': { name: 'Roster Person' },
      'users/user-1': { name: 'Portal Person' },
    },
  });
  const service = testAdmin({ db }).service;
  const result = await service.upsertBodProfile(upsertExternalPayload({
    profileId: 'ext-a',
    profile: externalProfileInput({
      name: 'Same Linked Person',
      linkedBodMemberId: 'member-1',
      linkedUserUid: 'user-1',
    }),
  }), 'admin-1');

  assert.equal(result.draftRevision, 1);
  assert.equal(db.read(`bodBoards/${DEFAULT_BOARD_ID}/profiles/club-a`).name, 'Rtr. Test Member');
  assert.equal(db.read(`bodBoards/${DEFAULT_BOARD_ID}/profiles/ext-a`).name, 'Same Linked Person');

  const staleDb = initializedDb({
    documents: {
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/ext-a`]: storedExternalProfile({
        linkedBodMemberId: 'removed-member',
        linkedUserUid: 'removed-user',
      }),
    },
  });
  const staleResult = await testAdmin({ db: staleDb }).service.upsertBodProfile(upsertExternalPayload({
    profileId: 'ext-a',
    profile: externalProfileInput({
      name: 'External With Stale Links',
      linkedBodMemberId: 'removed-member',
      linkedUserUid: 'removed-user',
    }),
  }), 'admin-1');
  assert.equal(staleResult.draftRevision, 1);

  const missingDb = initializedDb({
    documents: {
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/ext-a`]: storedExternalProfile({
        linkedBodMemberId: 'member-1',
        linkedUserUid: 'user-1',
      }),
      'bodMembers/member-1': { name: 'Roster Person' },
      'users/user-1': { name: 'Portal Person' },
    },
  });
  const before = missingDb.dump();
  await assert.rejects(
    testAdmin({ db: missingDb }).service.upsertBodProfile(upsertExternalPayload({
      profileId: 'ext-a',
      profile: externalProfileInput({
        linkedBodMemberId: 'missing-member',
        linkedUserUid: 'user-1',
      }),
    }), 'admin-1'),
    (err) => err.code === 'failed-precondition'
  );
  assert.deepEqual(missingDb.dump(), before);
});

test('upsertBodProfile updates editable fields and preserves server lifecycle metadata', async () => {
  const db = initializedDb({
    boardSections: { clubBoard: { draftRevision: 2 } },
    documents: {
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/p1`]: storedProfile({
        createdBy: 'creator',
        status: 'archived',
        archivedAt: '2026-07-02T00:00:00.000Z',
        archivedBy: 'archiver',
      }),
    },
  });
  const result = await testAdmin({ db }).service.upsertBodProfile(upsertPayload({
    profileId: 'p1',
    expectedDraftRevision: 2,
    profile: profileInput({ name: 'Updated Name', positionKey: 'custom', positionLabel: 'Custom Role' }),
  }), 'admin-1');
  const profile = db.read(`bodBoards/${DEFAULT_BOARD_ID}/profiles/p1`);

  assert.equal(result.draftRevision, 3);
  assert.equal(profile.name, 'Updated Name');
  assert.equal(profile.positionLabel, 'Custom Role');
  assert.equal(profile.createdBy, 'creator');
  assert.equal(profile.status, 'archived');
  assert.equal(profile.archivedBy, 'archiver');
  assert.equal(profile.photo, null);
});

test('exact no-op profile update performs zero writes', async () => {
  const db = initializedDb({
    documents: {
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/p1`]: storedProfile(),
    },
  });
  const before = db.dump();
  const result = await testAdmin({ db }).service.upsertBodProfile(upsertPayload({
    profileId: 'p1',
    profile: profileInput(),
  }), 'admin-1');

  assert.equal(result.unchanged, true);
  assert.deepEqual(db.dump(), before);
});

test('visibility-only update writes profileVisibilityChanged audit', async () => {
  const db = initializedDb({
    documents: {
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/p1`]: storedProfile(),
    },
  });
  const result = await testAdmin({ db }).service.upsertBodProfile(upsertPayload({
    profileId: 'p1',
    profile: profileInput({ displayPublicly: true }),
  }), 'admin-1');
  const auditPath = db.paths().find((documentPath) => documentPath.includes('/audit/'));

  assert.equal(result.draftRevision, 1);
  assert.equal(db.read(auditPath).eventType, 'profileVisibilityChanged');
});

test('stale draft revision rejects profile mutations without writes', async () => {
  const db = initializedDb({
    boardSections: { clubBoard: { draftRevision: 4 } },
  });
  const before = db.dump();

  await assert.rejects(
    testAdmin({ db }).service.upsertBodProfile(upsertPayload({ expectedDraftRevision: 3 }), 'admin-1'),
    (err) => err.code === 'aborted'
  );
  assert.deepEqual(db.dump(), before);
});

test('profile mutations require initialized active board', async () => {
  const { service } = testAdmin({ db: new FakeDb() });

  await assert.rejects(
    service.upsertBodProfile(upsertPayload(), 'admin-1'),
    (err) => err.code === 'failed-precondition'
  );
});

test('archive and restore update lifecycle fields and no-op when repeated', async () => {
  const db = initializedDb({
    documents: {
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/p1`]: storedProfile({ displayPublicly: true }),
    },
  });
  const service = testAdmin({ db }).service;
  const archived = await service.archiveBodProfile({
    boardId: DEFAULT_BOARD_ID,
    profileId: 'p1',
    expectedDraftRevision: 0,
  }, 'admin-1');
  const afterArchive = db.read(`bodBoards/${DEFAULT_BOARD_ID}/profiles/p1`);

  assert.equal(archived.draftRevision, 1);
  assert.equal(afterArchive.status, 'archived');
  assert.equal(afterArchive.displayPublicly, false);
  assert.equal(afterArchive.photo, null);

  const beforeNoopArchive = db.dump();
  const noopArchive = await service.archiveBodProfile({
    boardId: DEFAULT_BOARD_ID,
    profileId: 'p1',
    expectedDraftRevision: 1,
  }, 'admin-1');
  assert.equal(noopArchive.unchanged, true);
  assert.deepEqual(db.dump(), beforeNoopArchive);

  const restored = await service.restoreBodProfile({
    boardId: DEFAULT_BOARD_ID,
    profileId: 'p1',
    expectedDraftRevision: 1,
  }, 'admin-1');
  const afterRestore = db.read(`bodBoards/${DEFAULT_BOARD_ID}/profiles/p1`);
  assert.equal(restored.draftRevision, 2);
  assert.equal(afterRestore.status, 'active');
  assert.equal(afterRestore.displayPublicly, false);
  assert.equal(afterRestore.archivedAt, null);
  assert.equal(afterRestore.archivedBy, null);

  const beforeNoopRestore = db.dump();
  const noopRestore = await service.restoreBodProfile({
    boardId: DEFAULT_BOARD_ID,
    profileId: 'p1',
    expectedDraftRevision: 2,
  }, 'admin-1');
  assert.equal(noopRestore.unchanged, true);
  assert.deepEqual(db.dump(), beforeNoopRestore);
});

test('external archive and restore use the external section revision only', async () => {
  const db = initializedDb({
    documents: {
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/ext-a`]: storedExternalProfile({ displayPublicly: true }),
    },
  });
  const service = testAdmin({ db }).service;
  const archived = await service.archiveBodProfile({
    boardId: DEFAULT_BOARD_ID,
    profileId: 'ext-a',
    expectedDraftRevision: 0,
  }, 'admin-1');
  const afterArchive = db.read(`bodBoards/${DEFAULT_BOARD_ID}/profiles/ext-a`);

  assert.equal(archived.sectionKey, 'leadershipBeyondClub');
  assert.equal(archived.draftRevision, 1);
  assert.equal(afterArchive.status, 'archived');
  assert.equal(afterArchive.displayPublicly, false);
  assert.equal(db.read(`bodBoards/${DEFAULT_BOARD_ID}`).sections.clubBoard.draftRevision, 0);
  assert.equal(db.read(`bodBoards/${DEFAULT_BOARD_ID}`).sections.leadershipBeyondClub.draftRevision, 1);

  const restored = await service.restoreBodProfile({
    boardId: DEFAULT_BOARD_ID,
    profileId: 'ext-a',
    expectedDraftRevision: 1,
  }, 'admin-1');
  const afterRestore = db.read(`bodBoards/${DEFAULT_BOARD_ID}/profiles/ext-a`);
  assert.equal(restored.sectionKey, 'leadershipBeyondClub');
  assert.equal(restored.draftRevision, 2);
  assert.equal(afterRestore.status, 'active');
  assert.equal(afterRestore.displayPublicly, false);
  assert.equal(afterRestore.archivedAt, null);
  assert.equal(afterRestore.archivedBy, null);
});

test('reorderBodProfiles normalizes active order and leaves archived sort order untouched', async () => {
  const db = initializedDb({
    documents: {
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/a`]: storedProfile({ name: 'A', sortOrder: 30 }),
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/b`]: storedProfile({ name: 'B', sortOrder: 10 }),
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/c`]: storedProfile({ name: 'C', sortOrder: 5, status: 'archived' }),
    },
  });
  const result = await testAdmin({ db }).service.reorderBodProfiles({
    boardId: DEFAULT_BOARD_ID,
    sectionKey: 'clubBoard',
    orderedProfileIds: ['b', 'a'],
    expectedDraftRevision: 0,
  }, 'admin-1');

  assert.equal(result.draftRevision, 1);
  assert.equal(db.read(`bodBoards/${DEFAULT_BOARD_ID}/profiles/b`).sortOrder, 10);
  assert.equal(db.read(`bodBoards/${DEFAULT_BOARD_ID}/profiles/a`).sortOrder, 20);
  assert.equal(db.read(`bodBoards/${DEFAULT_BOARD_ID}/profiles/c`).sortOrder, 5);
  const auditPath = db.paths().find((documentPath) => documentPath.includes('/audit/'));
  assert.equal(db.read(auditPath).eventType, 'profileReordered');
});

test('reorderBodProfiles normalizes external order independently and rejects cross-section IDs', async () => {
  const db = initializedDb({
    documents: {
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/club-a`]: storedProfile({ name: 'Club A', sortOrder: 10 }),
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/ext-a`]: storedExternalProfile({ name: 'External A', sortOrder: 30 }),
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/ext-b`]: storedExternalProfile({ name: 'External B', sortOrder: 10 }),
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/ext-c`]: storedExternalProfile({ name: 'External C', sortOrder: 5, status: 'archived' }),
    },
  });
  const result = await testAdmin({ db }).service.reorderBodProfiles({
    boardId: DEFAULT_BOARD_ID,
    sectionKey: 'leadershipBeyondClub',
    orderedProfileIds: ['ext-b', 'ext-a'],
    expectedDraftRevision: 0,
  }, 'admin-1');

  assert.equal(result.sectionKey, 'leadershipBeyondClub');
  assert.equal(result.draftRevision, 1);
  assert.equal(db.read(`bodBoards/${DEFAULT_BOARD_ID}/profiles/ext-b`).sortOrder, 10);
  assert.equal(db.read(`bodBoards/${DEFAULT_BOARD_ID}/profiles/ext-a`).sortOrder, 20);
  assert.equal(db.read(`bodBoards/${DEFAULT_BOARD_ID}/profiles/ext-c`).sortOrder, 5);
  assert.equal(db.read(`bodBoards/${DEFAULT_BOARD_ID}/profiles/club-a`).sortOrder, 10);
  assert.equal(db.read(`bodBoards/${DEFAULT_BOARD_ID}`).sections.clubBoard.draftRevision, 0);
  assert.equal(db.read(`bodBoards/${DEFAULT_BOARD_ID}`).sections.leadershipBeyondClub.draftRevision, 1);

  for (const orderedProfileIds of [['ext-b', 'club-a'], ['ext-b', 'ext-c'], ['ext-b']]) {
    await assert.rejects(
      testAdmin({ db }).service.reorderBodProfiles({
        boardId: DEFAULT_BOARD_ID,
        sectionKey: 'leadershipBeyondClub',
        orderedProfileIds,
        expectedDraftRevision: 1,
      }, 'admin-1')
    );
  }
});

test('stale external revisions reject create, update, archive, restore, and reorder without writes', async () => {
  for (const run of [
    async (service) => service.upsertBodProfile(upsertExternalPayload({ expectedDraftRevision: 1 }), 'admin-1'),
    async (service) => service.upsertBodProfile(upsertExternalPayload({
      profileId: 'ext-a',
      expectedDraftRevision: 1,
      profile: externalProfileInput({ name: 'Stale Update' }),
    }), 'admin-1'),
    async (service) => service.archiveBodProfile({ boardId: DEFAULT_BOARD_ID, profileId: 'ext-a', expectedDraftRevision: 1 }, 'admin-1'),
    async (service) => service.restoreBodProfile({ boardId: DEFAULT_BOARD_ID, profileId: 'ext-archived', expectedDraftRevision: 1 }, 'admin-1'),
    async (service) => service.reorderBodProfiles({
      boardId: DEFAULT_BOARD_ID,
      sectionKey: 'leadershipBeyondClub',
      orderedProfileIds: ['ext-a'],
      expectedDraftRevision: 1,
    }, 'admin-1'),
  ]) {
    const db = initializedDb({
      boardSections: { leadershipBeyondClub: { draftRevision: 2 } },
      documents: {
        [`bodBoards/${DEFAULT_BOARD_ID}/profiles/ext-a`]: storedExternalProfile(),
        [`bodBoards/${DEFAULT_BOARD_ID}/profiles/ext-archived`]: storedExternalProfile({ status: 'archived' }),
      },
    });
    const before = db.dump();
    await assert.rejects(
      run(testAdmin({ db }).service),
      (err) => err.code === 'aborted'
    );
    assert.deepEqual(db.dump(), before);
  }
});

test('reorderBodProfiles rejects duplicate, missing, archived, foreign, and unknown IDs', async () => {
  const documents = {
    [`bodBoards/${DEFAULT_BOARD_ID}/profiles/a`]: storedProfile({ sortOrder: 10 }),
    [`bodBoards/${DEFAULT_BOARD_ID}/profiles/b`]: storedProfile({ sortOrder: 20 }),
    [`bodBoards/${DEFAULT_BOARD_ID}/profiles/c`]: storedProfile({ sortOrder: 30, status: 'archived' }),
    [`bodBoards/${DEFAULT_BOARD_ID}/profiles/x`]: storedExternalProfile(),
  };

  for (const orderedProfileIds of [['a', 'a'], ['a'], ['a', 'c'], ['a', 'x'], ['a', 'missing']]) {
    const service = testAdmin({ db: initializedDb({ documents }) }).service;
    await assert.rejects(
      service.reorderBodProfiles({
        boardId: DEFAULT_BOARD_ID,
        sectionKey: 'clubBoard',
        orderedProfileIds,
        expectedDraftRevision: 0,
      }, 'admin-1')
    );
  }
});

test('reorderBodProfiles no-op performs zero writes', async () => {
  const db = initializedDb({
    documents: {
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/a`]: storedProfile({ sortOrder: 10 }),
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/b`]: storedProfile({ sortOrder: 20 }),
    },
  });
  const before = db.dump();
  const result = await testAdmin({ db }).service.reorderBodProfiles({
    boardId: DEFAULT_BOARD_ID,
    sectionKey: 'clubBoard',
    orderedProfileIds: ['a', 'b'],
    expectedDraftRevision: 0,
  }, 'admin-1');

  assert.equal(result.unchanged, true);
  assert.deepEqual(db.dump(), before);
});

test('Public-to-Draft preserves publication metadata and current snapshot', async () => {
  const publishedAt = '2026-07-01T12:00:00.000Z';
  const snapshot = { profiles: [{ name: 'Private Name' }], publicationStatus: 'public' };
  const db = new FakeDb({
    'bodSettings/publicBoard': settingDocument(),
    [`bodBoards/${DEFAULT_BOARD_ID}`]: boardDocument({
      clubBoard: {
        publicationStatus: 'public',
        draftRevision: 2,
        publishedRevision: 3,
        publishedAt,
        publishedBy: 'publisher-1',
      },
    }),
    [`bodBoards/${DEFAULT_BOARD_ID}/published/current`]: snapshot,
  });
  const { service } = testAdmin({ db });

  const result = await service.saveBodSectionPublication(
    draftPayload({ expectedDraftRevision: 2, expectedPublishedRevision: 3 }),
    'admin-1'
  );

  const board = db.read(`bodBoards/${DEFAULT_BOARD_ID}`);
  assert.equal(result.unchanged, false);
  assert.equal(board.sections.clubBoard.publicationStatus, 'draft');
  assert.equal(board.sections.clubBoard.draftRevision, 2);
  assert.equal(board.sections.clubBoard.publishedRevision, 3);
  assert.equal(board.sections.clubBoard.publishedAt, publishedAt);
  assert.equal(board.sections.clubBoard.publishedBy, 'publisher-1');
  assert.deepEqual(db.read(`bodBoards/${DEFAULT_BOARD_ID}/published/current`), snapshot);

  const auditPath = db.paths().find((documentPath) => documentPath.includes('/audit/'));
  assert.equal(db.read(auditPath).eventType, 'sectionPublicationChanged');
});

test('revision conflict prevents writes', async () => {
  const db = new FakeDb({
    'bodSettings/publicBoard': settingDocument(),
    [`bodBoards/${DEFAULT_BOARD_ID}`]: boardDocument({
      clubBoard: {
        publicationStatus: 'public',
        draftRevision: 4,
        publishedRevision: 2,
      },
    }),
  });
  const before = db.dump();
  const { service } = testAdmin({ db });

  await assert.rejects(
    service.saveBodSectionPublication(draftPayload({ expectedDraftRevision: 3, expectedPublishedRevision: 2 }), 'admin-1'),
    (err) => err.code === 'aborted'
  );
  assert.deepEqual(db.dump(), before);
});

test('publishBodSection atomically writes an ordered sanitized Club snapshot', async () => {
  const db = initializedDb({
    documents: {
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/second`]: storedProfile({
        name: 'Rtr. Second',
        sortOrder: 20,
        displayPublicly: true,
        linkedBodMemberId: 'private-roster-id',
        linkedUserUid: 'private-user-id',
        photo: readyPhoto({
          driveFileId: 'private-drive-second',
          uploadSessionId: 'private-session-second',
          version: 2,
        }),
      }),
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/first`]: storedProfile({
        name: 'Rtr. First',
        sortOrder: 10,
        displayPublicly: true,
        photo: readyPhoto({
          driveFileId: 'private-drive-first',
          uploadSessionId: 'private-session-first',
        }),
      }),
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/hidden`]: storedProfile({
        name: 'Rtr. Hidden',
        displayPublicly: false,
        photo: null,
      }),
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/archived`]: storedProfile({
        name: 'Rtr. Archived',
        status: 'archived',
        displayPublicly: true,
        photo: readyPhoto({
          driveFileId: 'private-drive-archived',
          uploadSessionId: 'private-session-archived',
        }),
      }),
    },
  });

  const result = await testAdmin({ db }).service.publishBodSection(
    publishPayload(),
    'admin-1'
  );

  const board = db.read(`bodBoards/${DEFAULT_BOARD_ID}`);
  const snapshot = db.read(
    `bodBoards/${DEFAULT_BOARD_ID}/published/current`
  );
  const publishedProfiles = snapshot.sections.clubBoard.profiles;

  assert.equal(result.ok, true);
  assert.equal(result.unchanged, false);
  assert.equal(result.publishedRevision, 1);
  assert.equal(result.profileCount, 2);

  assert.equal(
    board.sections.clubBoard.publicationStatus,
    'public'
  );
  assert.equal(board.sections.clubBoard.draftRevision, 0);
  assert.equal(board.sections.clubBoard.publishedRevision, 1);
  assert.equal(
    board.sections.leadershipBeyondClub.publicationStatus,
    'draft'
  );

  assert.equal(snapshot.boardId, DEFAULT_BOARD_ID);
  assert.equal(snapshot.riyLabel, DEFAULT_RIY_LABEL);
  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(
    snapshot.sections.clubBoard.publicationStatus,
    'public'
  );
  assert.equal(
    snapshot.sections.leadershipBeyondClub.publicationStatus,
    'draft'
  );

  assert.deepEqual(
    publishedProfiles.map((profile) => profile.profileId),
    ['first', 'second']
  );
  assert.deepEqual(
    publishedProfiles.map((profile) => profile.name),
    ['Rtr. First', 'Rtr. Second']
  );
  assert.deepEqual(
    publishedProfiles.map((profile) => profile.photoVersion),
    [1, 2]
  );

  const serializedProfiles = JSON.stringify(publishedProfiles);

  assert.doesNotMatch(
    serializedProfiles,
    /driveFileId|driveFolderId|linkedBodMemberId|linkedUserUid|uploadSessionId|sha256|uploadedBy|createdBy|updatedBy|archivedBy/
  );
  assert.doesNotMatch(
    serializedProfiles,
    /private-drive|private-session|private-roster-id|private-user-id/
  );

  const auditPath = db.paths()
    .filter((documentPath) => documentPath.includes('/audit/'))
    .at(-1);

  assert.ok(auditPath);
  assert.equal(db.read(auditPath).eventType, 'sectionPublished');
});

test('publishBodSection retains the previous snapshot when a visible profile is incomplete', async () => {
  const previousSnapshot = {
    boardId: DEFAULT_BOARD_ID,
    riyLabel: DEFAULT_RIY_LABEL,
    schemaVersion: 1,
    sections: {
      clubBoard: {
        sectionKey: 'clubBoard',
        publicationStatus: 'public',
        publishedRevision: 1,
        publishedAt: '2026-07-01T00:00:00.000Z',
        profileCount: 1,
        contentHash: 'b'.repeat(64),
        profiles: [{
          profileId: 'previous-profile',
          sectionKey: 'clubBoard',
          name: 'Previous Published Profile',
        }],
      },
      leadershipBeyondClub: {
        sectionKey: 'leadershipBeyondClub',
        publicationStatus: 'draft',
        publishedRevision: 0,
        publishedAt: null,
        profileCount: 0,
        contentHash: null,
        profiles: [],
      },
    },
    updatedAt: '2026-07-01T00:00:00.000Z',
    updatedBy: 'publisher-1',
  };

  const db = initializedDb({
    boardSections: {
      clubBoard: {
        publicationStatus: 'public',
        draftRevision: 2,
        publishedRevision: 1,
        publishedAt: '2026-07-01T00:00:00.000Z',
        publishedBy: 'publisher-1',
      },
    },
    documents: {
      [`bodBoards/${DEFAULT_BOARD_ID}/published/current`]:
        previousSnapshot,
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/incomplete`]:
        storedProfile({
          name: 'Incomplete Profile',
          summary: '',
          displayPublicly: true,
          photo: readyPhoto(),
        }),
    },
  });

  const before = db.dump();

  await assert.rejects(
    testAdmin({ db }).service.publishBodSection(
      publishPayload({
        expectedDraftRevision: 2,
        expectedPublishedRevision: 1,
      }),
      'admin-1'
    ),
    (error) => (
      error.code === 'failed-precondition'
      && error.details?.profileId === 'incomplete'
      && error.details?.missingFields?.includes('summary')
    )
  );

  assert.deepEqual(db.dump(), before);
});

test('publishBodSection is idempotent when the published content has not changed', async () => {
  const db = initializedDb({
    documents: {
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/p1`]: storedProfile({
        displayPublicly: true,
        photo: readyPhoto(),
      }),
    },
  });

  const service = testAdmin({ db }).service;

  const first = await service.publishBodSection(
    publishPayload(),
    'admin-1'
  );

  assert.equal(first.unchanged, false);
  assert.equal(first.publishedRevision, 1);

  const beforeRetry = db.dump();

  const retry = await service.publishBodSection(
    publishPayload({
      expectedPublishedRevision: 1,
    }),
    'admin-1'
  );

  assert.equal(retry.ok, true);
  assert.equal(retry.unchanged, true);
  assert.equal(retry.publishedRevision, 1);
  assert.deepEqual(db.dump(), beforeRetry);
});

test('publishBodSection preserves the other independently published section', async () => {
  const db = initializedDb({
    documents: {
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/club-1`]:
        storedProfile({
          displayPublicly: true,
          photo: readyPhoto({
            driveFileId: 'club-drive',
            uploadSessionId: 'club-session',
          }),
        }),
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/external-1`]:
        storedExternalProfile({
          displayPublicly: true,
          photo: readyPhoto({
            driveFileId: 'external-drive',
            uploadSessionId: 'external-session',
          }),
        }),
    },
  });

  const service = testAdmin({ db }).service;

  await service.publishBodSection(
    publishPayload(),
    'admin-1'
  );

  const clubSnapshotBefore = clone(
    db.read(`bodBoards/${DEFAULT_BOARD_ID}/published/current`)
      .sections.clubBoard
  );

  const externalResult = await service.publishBodSection(
    publishPayload({
      sectionKey: 'leadershipBeyondClub',
    }),
    'admin-1'
  );

  const board = db.read(`bodBoards/${DEFAULT_BOARD_ID}`);
  const snapshot = db.read(
    `bodBoards/${DEFAULT_BOARD_ID}/published/current`
  );

  assert.equal(externalResult.ok, true);
  assert.equal(externalResult.publishedRevision, 1);

  assert.deepEqual(
    snapshot.sections.clubBoard,
    clubSnapshotBefore
  );

  assert.equal(
    snapshot.sections.leadershipBeyondClub.publicationStatus,
    'public'
  );
  assert.equal(
    snapshot.sections.leadershipBeyondClub.profileCount,
    1
  );
  assert.equal(
    snapshot.sections.leadershipBeyondClub.profiles[0].profileId,
    'external-1'
  );

  assert.equal(board.sections.clubBoard.publishedRevision, 1);
  assert.equal(
    board.sections.leadershipBeyondClub.publishedRevision,
    1
  );
});

test('publishBodSection rejects stale revisions without writes', async () => {
  const db = initializedDb({
    boardSections: {
      clubBoard: {
        draftRevision: 3,
        publishedRevision: 2,
      },
    },
    documents: {
      [`bodBoards/${DEFAULT_BOARD_ID}/profiles/p1`]: storedProfile({
        displayPublicly: true,
        photo: readyPhoto(),
      }),
    },
  });

  const before = db.dump();

  await assert.rejects(
    testAdmin({ db }).service.publishBodSection(
      publishPayload({
        expectedDraftRevision: 2,
        expectedPublishedRevision: 2,
      }),
      'admin-1'
    ),
    (error) => error.code === 'aborted'
  );

  assert.deepEqual(db.dump(), before);
});

test('public BOD payload exposes only the sanitized published snapshot', async () => {
const db = initializedDb({
  documents: {
    [`bodBoards/${DEFAULT_BOARD_ID}/profiles/p1`]: storedProfile({
      name: 'Published Member',
      displayPublicly: true,
      linkedBodMemberId: 'private-member',
      linkedUserUid: 'private-user',
      photo: readyPhoto({
        driveFileId: 'private-drive-file',
        driveFolderId: 'private-drive-folder',
        uploadSessionId: 'private-session',
        version: 3,
      }),
    }),
  },
});

  const service = testAdmin({ db }).service;

  await service.publishBodSection(
    publishPayload(),
    'admin-1'
  );

  const payload =
    await service.getPublicBodBoardPayload();

  assert.equal(
    payload.sections.clubBoard.state,
    'public'
  );
  assert.equal(
    payload.sections.clubBoard.publishedRevision,
    1
  );
  assert.equal(
    payload.sections.clubBoard.profileCount,
    1
  );

  assert.deepEqual(
    payload.sections.clubBoard.profiles.map(
      (profile) => [
        profile.profileId,
        profile.name,
        profile.photoVersion,
      ]
    ),
    [['p1', 'Published Member', 3]]
  );

  const serialized = JSON.stringify(payload);

  assert.doesNotMatch(
    serialized,
    /driveFileId|driveFolderId|uploadSessionId|linkedBodMemberId|linkedUserUid|sha256|uploadedBy|createdBy|updatedBy|publishedBy/
  );

  assert.doesNotMatch(
    serialized,
    /private-drive|private-session|private-member|private-user/
  );
});

test('working draft edits do not change the public snapshot until republished', async () => {
const db = initializedDb({
  documents: {
    [`bodBoards/${DEFAULT_BOARD_ID}/profiles/p1`]: storedProfile({
      name: 'Published Name',
      displayPublicly: true,
      photo: readyPhoto(),
    }),
  },
});

  const service = testAdmin({ db }).service;

  await service.publishBodSection(
    publishPayload(),
    'admin-1'
  );

  await service.upsertBodProfile(
    upsertPayload({
      profileId: 'p1',
      expectedDraftRevision: 0,
      profile: profileInput({
        name: 'Unpublished Draft Name',
        displayPublicly: true,
      }),
    }),
    'admin-1'
  );

  const payload =
    await service.getPublicBodBoardPayload();

  assert.equal(
    payload.sections.clubBoard.state,
    'public'
  );
  assert.equal(
    payload.sections.clubBoard.profiles[0].name,
    'Published Name'
  );

  assert.doesNotMatch(
    JSON.stringify(payload),
    /Unpublished Draft Name/
  );
});

test('returning a section to Draft immediately hides its retained snapshot', async () => {
const db = initializedDb({
  documents: {
    [`bodBoards/${DEFAULT_BOARD_ID}/profiles/p1`]: storedProfile({
      displayPublicly: true,
      photo: readyPhoto(),
    }),
  },
});

  const service = testAdmin({ db }).service;

  await service.publishBodSection(
    publishPayload(),
    'admin-1'
  );

  const snapshotBefore = clone(
    db.read(
      `bodBoards/${DEFAULT_BOARD_ID}/published/current`
    )
  );

  await service.saveBodSectionPublication(
    draftPayload({
      expectedDraftRevision: 0,
      expectedPublishedRevision: 1,
    }),
    'admin-1'
  );

  const payload =
    await service.getPublicBodBoardPayload();

  assert.deepEqual(
    payload.sections.clubBoard,
    {
      state: 'draft',
      profiles: [],
    }
  );

  assert.deepEqual(
    db.read(
      `bodBoards/${DEFAULT_BOARD_ID}/published/current`
    ),
    snapshotBefore
  );
});

test('a malformed published section does not hide the other valid section', async () => {
const db = initializedDb({
  documents: {
    [`bodBoards/${DEFAULT_BOARD_ID}/profiles/p1`]: storedProfile({
      displayPublicly: true,
      photo: readyPhoto(),
    }),

    [`bodBoards/${DEFAULT_BOARD_ID}/profiles/external-1`]:
      storedExternalProfile({
        displayPublicly: true,
        photo: readyPhoto({
          driveFileId: 'external-drive',
          uploadSessionId: 'external-session',
        }),
      }),
  },
});

  const service = testAdmin({ db }).service;

  await service.publishBodSection(
    publishPayload(),
    'admin-1'
  );

  await service.publishBodSection(
    publishPayload({
      sectionKey: 'leadershipBeyondClub',
    }),
    'admin-1'
  );

  const snapshotPath =
    `bodBoards/${DEFAULT_BOARD_ID}/published/current`;

  const corruptedSnapshot = db.read(snapshotPath);

  corruptedSnapshot.sections.clubBoard
    .profiles[0].name = '';

  db.seed(snapshotPath, corruptedSnapshot);

  const payload =
    await service.getPublicBodBoardPayload();

  assert.equal(
    payload.sections.clubBoard.state,
    'draft'
  );
  assert.deepEqual(
    payload.sections.clubBoard.profiles,
    []
  );

  assert.equal(
    payload.sections.leadershipBeyondClub.state,
    'public'
  );
  assert.equal(
    payload.sections.leadershipBeyondClub
      .profiles[0].profileId,
    'external-1'
  );
});

test('public BOD payload returns safe Draft fallback for missing or malformed config', async () => {
  const missing = await testAdmin().service.getPublicBodBoardPayload();
  assert.deepEqual(missing.sections.clubBoard, { state: 'draft', profiles: [] });

  const malformedDb = new FakeDb({ 'bodSettings/publicBoard': { activeBoardId: 'bad/id', schemaVersion: 1 } });
  const malformed = await testAdmin({ db: malformedDb }).service.getPublicBodBoardPayload();
  assert.deepEqual(malformed.sections.leadershipBeyondClub, { state: 'draft', profiles: [] });
});

test('public BOD payload never exposes working profile data in Phase 1', async () => {
  const db = new FakeDb({
    'bodSettings/publicBoard': settingDocument(),
    [`bodBoards/${DEFAULT_BOARD_ID}`]: boardDocument({
      clubBoard: {
        publicationStatus: 'public',
        publishedRevision: 1,
      },
    }),
    [`bodBoards/${DEFAULT_BOARD_ID}/published/current`]: {
      profiles: [{ name: 'Existing Published Person', actorUid: 'private' }],
    },
  });
  const payload = await testAdmin({ db }).service.getPublicBodBoardPayload();
  const serialized = JSON.stringify(payload);

  assert.equal(payload.sections.clubBoard.state, 'draft');
  assert.equal(payload.sections.clubBoard.profiles.length, 0);
  assert.doesNotMatch(serialized, /Existing Published Person|actorUid|publishedBy|updatedBy/);
});

test('production index exports BOD Management functions additively', () => {
  const indexSource = readFileSync(path.join(__dirname, '../index.js'), 'utf8');
  const bodPhotoServiceBlock = indexSource.match(
  /const bodPhotoUploads = createBodPhotoUploadService\(\{[\s\S]*?\n\}\);/
)?.[0] || '';

assert.match(
  bodPhotoServiceBlock,
  /env: process\.env/
);

assert.doesNotMatch(
  bodPhotoServiceBlock,
  /uploadEndpoint:/
);
  assert.match(indexSource, /const \{ createBodManagementService \} = require\('\.\/lib\/bod-management'\)/);
  assert.match(indexSource, /const \{ createBodPhotoUploadService \} = require\('\.\/lib\/bod-photo-upload'\)/);
  assert.match(indexSource, /exports\.getBodManagementBoard = onCall\(CALLABLE_OPTIONS/);
  assert.match(indexSource, /exports\.saveBodSectionPublication = onCall\(CALLABLE_OPTIONS/);
  assert.match(indexSource, /exports\.createBodPhotoUploadSession = onCall\(CALLABLE_OPTIONS/);
  assert.match(indexSource, /exports\.uploadBodProfilePhoto = onRequest\(/);
  assert.match(indexSource, /exports\.finalizeBodPhotoUpload = onCall\(BOD_PHOTO_CALLABLE_OPTIONS/);
  assert.match(indexSource, /exports\.removeBodProfilePhoto = onCall\(CALLABLE_OPTIONS/);
  assert.match(indexSource, /exports\.cleanupExpiredBodPhotoUploadSessions = onCall\(BOD_PHOTO_CALLABLE_OPTIONS/);
  assert.match(indexSource, /exports\.getPublicBodBoard = onRequest\(/);
  assert.match(
  indexSource,
  /exports\.publishBodSection = onCall\(CALLABLE_OPTIONS/
);
assert.match(
  indexSource,
  /exports\.downloadPublishedBodPhoto = onRequest\(/
);
});

test('Firestore rules explicitly deny browser access to BOD Management documents', () => {
  const rules = readFileSync(path.join(__dirname, '..', '..', 'firestore.rules'), 'utf8');
  assert.match(rules, /match \/bodSettings\/\{document\} \{\s*allow read, write: if false;/);
  assert.match(rules, /match \/bodBoards\/\{boardId\} \{\s*allow read, write: if false;\s*match \/\{document=\*\*\} \{/);
  assert.match(rules, /match \/bodProfilePhotoUploadSessions\/\{sessionId\} \{\s*allow read, write: if false;/);
  assert.match(rules, /match \/bodProfilePhotoUploadRateLimits\/\{rateLimitId\} \{\s*allow read, write: if false;/);
});
