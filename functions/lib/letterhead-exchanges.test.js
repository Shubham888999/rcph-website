'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  LETTERHEAD_EXCHANGES_COLLECTION,
  MAX_EXTERNAL_PARTICIPANTS,
  MAX_REPORT_MONTHS,
  ROTARACT_DISTRICT_ID_MAX,
  createLetterheadExchangeService,
  istDateString,
  loadEventOptions,
  loadMemberOptions,
  normalizeReportExchange,
  normalizeCreatePayload,
  validateReportInput,
} = require('./letterhead-exchanges');

class TestHttpsError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details || {};
  }
}

function clone(value) {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  return JSON.parse(JSON.stringify(value));
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
  constructor(db, path) {
    this._db = db;
    this.path = path;
    this.id = path.split('/').at(-1);
  }

  get() {
    return Promise.resolve(new FakeSnapshot(this.id, this._db.read(this.path)));
  }

  set(data) {
    this._db.write(this.path, data);
    return Promise.resolve();
  }
}

class FakeCollectionRef {
  constructor(db, collectionPath, query = {}) {
    this._db = db;
    this.path = collectionPath;
    this._query = query;
  }

  doc(id = '') {
    const documentId = id || `exchange-${this._db.nextAutoId()}`;
    return new FakeDocRef(this._db, `${this.path}/${documentId}`);
  }

  orderBy(field, direction = 'asc') {
    return new FakeCollectionRef(this._db, this.path, { ...this._query, orderBy: { field, direction } });
  }

  where(field, operator, value) {
    const filters = Array.isArray(this._query.filters) ? this._query.filters : [];
    return new FakeCollectionRef(this._db, this.path, { ...this._query, filters: [...filters, { field, operator, value }] });
  }

  limit(count) {
    return new FakeCollectionRef(this._db, this.path, { ...this._query, limit: count });
  }

  get() {
    let docs = this._db.collectionDocs(this.path);
    if (Array.isArray(this._query.filters)) {
      docs = docs.filter((doc) => this._query.filters.every((filter) => {
        const value = doc.data()?.[filter.field];
        if (filter.operator !== '==') return false;
        return value === filter.value;
      }));
    }
    if (this._query.orderBy) {
      const { field, direction } = this._query.orderBy;
      docs = docs.sort((left, right) => {
        const leftValue = left.data()?.[field] || '';
        const rightValue = right.data()?.[field] || '';
        const result = String(leftValue).localeCompare(String(rightValue));
        return direction === 'desc' ? -result : result;
      });
    }
    if (this._query.limit) docs = docs.slice(0, this._query.limit);
    return Promise.resolve({ docs });
  }
}

class FakeDb {
  constructor(seed = {}) {
    this._store = new Map(Object.entries(seed).map(([path, data]) => [path, clone(data)]));
    this._autoId = 0;
  }

  collection(collectionId) {
    return new FakeCollectionRef(this, collectionId);
  }

  nextAutoId() {
    this._autoId += 1;
    return this._autoId;
  }

  read(path) {
    return this._store.has(path) ? clone(this._store.get(path)) : undefined;
  }

  write(path, data) {
    this._store.set(path, clone(data));
  }

  collectionDocs(collectionPath) {
    const prefix = `${collectionPath}/`;
    return Array.from(this._store.keys())
      .filter(path => path.startsWith(prefix))
      .filter(path => path.slice(prefix.length).split('/').length === 1)
      .map(path => new FakeSnapshot(path.split('/').at(-1), this.read(path)));
  }

  paths() {
    return Array.from(this._store.keys()).sort();
  }
}

function activeMember(overrides = {}) {
  return {
    name: 'Member One',
    role: 'bod',
    position: 'Secretary',
    userId: 'user-one',
    status: 'approved',
    active: true,
    ...overrides,
  };
}

function normalEvent(overrides = {}) {
  return {
    name: 'Project EduReach',
    type: 'clubEvent',
    date: '2026-08-20',
    endDate: '2026-08-20',
    avenues: ['ISD'],
    visibility: 'public',
    archived: false,
    ...overrides,
  };
}

function seedForOptions() {
  return {
    'members/z': activeMember({ name: 'Zara Member', role: 'gbm', position: 'Volunteer' }),
    'members/a': activeMember({ name: 'Asha Member', role: 'bod', position: 'ISD' }),
    'members/inactive': activeMember({ name: 'Inactive Member', active: false }),
    'members/removed': activeMember({ name: 'Removed Member', status: 'removed' }),

    'events/club-1': normalEvent({ name: 'Project EduReach', date: '2026-08-20', avenues: ['ISD'] }),
    'events/gbm-1': normalEvent({ name: 'General Body Meeting', date: '2026-08-19', avenues: ['GBM'] }),
    'events/future-1': normalEvent({ name: 'Future Project', date: '2026-08-25', avenues: ['CSD'] }),
    'events/district-1': normalEvent({ name: 'District Conference Mirror', date: '2026-08-18', type: 'districtEvent', districtEventId: 'district-1' }),

    'bodMeetings/meeting-1': { name: 'Board Meeting', date: '2026-08-18', type: 'bodMeeting' },
    'bodEvents/meeting-1': { name: 'Board Meeting Mirror', date: '2026-08-18', type: 'bodMeeting', syncedMeetingId: 'meeting-1' },

    'districtEvents/district-1': { name: 'District Conference', date: '2026-08-18', type: 'districtEvent' },
    'bodEvents/district-1': { name: 'District Conference Mirror', date: '2026-08-18', type: 'districtEvent', syncedDistrictEventId: 'district-1' },

    'bodEvents/orphan-bod': { name: 'Recovered BOD Event', date: '2026-08-17', type: 'clubEvent', avenues: ['CMD'] },
  };
}

function makeService({ db = new FakeDb(seedForOptions()), role = 'bod', approved = true, logs = [] } = {}) {
  const service = createLetterheadExchangeService({
    db,
    admin: {
      firestore: {
        FieldValue: {
          serverTimestamp: () => new Date('2026-08-21T12:00:00.000Z'),
        },
      },
    },
    HttpsError: TestHttpsError,
    now: () => new Date('2026-08-21T18:30:00.000Z'),
    assertBodToolsAccess: async (uid) => {
      if (!approved || !role) throw new TestHttpsError('permission-denied', 'Approved BOD Tools access required.');
      return { uid, role };
    },
    getActorProfile: async () => ({ name: 'Rtr. Creator Person' }),
    writeLog: async entry => logs.push(entry),
  });
  return { service, db, logs };
}

function validPayload(overrides = {}) {
  return {
    exchangeDate: '2026-08-21',
    externalParticipants: [
      {
        clubName: 'Rotaract Club of Pune Heritage Partner',
        rotaractorName: 'External President',
        position: 'President',
        rotaractDistrictId: 'RID 3131',
      },
    ],
    rcphMemberIds: ['a'],
    associatedEvent: { source: 'events', id: 'club-1' },
    other: ' Exchanged before fellowship. ',
    ...overrides,
  };
}

function storedExchange(overrides = {}) {
  const payload = validPayload();
  return {
    schemaVersion: 1,
    exchangeDate: '2026-08-21',
    exchangeMonth: '2026-08',
    externalParticipants: payload.externalParticipants,
    rcphRepresentatives: [
      { memberId: 'a', userId: 'user-one', name: 'Asha Member', role: 'bod', position: 'ISD', activeAtCreation: true },
    ],
    rcphMemberIds: ['a'],
    associatedEvent: null,
    other: '',
    images: [],
    imageCount: 0,
    driveFolderId: 'private-folder',
    driveFolderName: 'private folder',
    status: 'active',
    createdAt: '2026-08-21T12:00:00.000Z',
    createdByUid: 'creator',
    createdByName: 'Creator Person',
    ...overrides,
  };
}

test('authorization denies missing uid and unauthorized users for all operations', async () => {
  const { service } = makeService();
  await assert.rejects(() => service.formOptions(''), { code: 'unauthenticated' });
  await assert.rejects(() => service.create('', validPayload()), { code: 'unauthenticated' });
  await assert.rejects(() => service.list(''), { code: 'unauthenticated' });
  await assert.rejects(() => service.forReport('', { months: ['2026-08'] }), { code: 'unauthenticated' });

  const unauthorized = makeService({ role: '' }).service;
  await assert.rejects(() => unauthorized.formOptions('plain-user'), { code: 'permission-denied' });
  await assert.rejects(() => unauthorized.create('plain-user', validPayload()), { code: 'permission-denied' });
  await assert.rejects(() => unauthorized.list('plain-user'), { code: 'permission-denied' });
  await assert.rejects(() => unauthorized.forReport('plain-user', { months: ['2026-08'] }), { code: 'permission-denied' });

  const inactiveOrUnapproved = makeService({ approved: false }).service;
  await assert.rejects(() => inactiveOrUnapproved.forReport('inactive-user', { months: ['2026-08'] }), { code: 'permission-denied' });

  for (const role of ['bod', 'admin', 'president']) {
    const allowed = makeService({ role }).service;
    assert.equal((await allowed.formOptions(`${role}-uid`)).ok, true);
    assert.equal((await allowed.forReport(`${role}-uid`, { months: ['2026-08'] })).ok, true);
  }

  await assert.rejects(() => service.formOptions('bod-uid', { unexpected: true }), { code: 'invalid-argument' });
});

test('external participant validation enforces required fields and Rotaract District ID semantics', () => {
  assert.throws(() => normalizeCreatePayload({ ...validPayload(), externalParticipants: undefined }, TestHttpsError), { code: 'invalid-argument' });
  assert.throws(() => normalizeCreatePayload({ ...validPayload(), externalParticipants: [] }, TestHttpsError), { code: 'invalid-argument' });
  assert.throws(() => normalizeCreatePayload({ ...validPayload(), externalParticipants: [{ clubName: '', rotaractorName: 'Person' }] }, TestHttpsError), { code: 'invalid-argument' });
  assert.throws(() => normalizeCreatePayload({ ...validPayload(), externalParticipants: [{ clubName: 'Club', rotaractorName: ' ' }] }, TestHttpsError), { code: 'invalid-argument' });
  assert.throws(() => normalizeCreatePayload({
    ...validPayload(),
    externalParticipants: [{
      clubName: 'Club',
      rotaractorName: 'Person',
      rotaractDistrictId: 'x'.repeat(ROTARACT_DISTRICT_ID_MAX + 1),
    }],
  }, TestHttpsError), { code: 'invalid-argument' });
  assert.throws(() => normalizeCreatePayload({
    ...validPayload(),
    externalParticipants: Array.from({ length: MAX_EXTERNAL_PARTICIPANTS + 1 }, (_, index) => ({
      clubName: `Club ${index}`,
      rotaractorName: `Person ${index}`,
    })),
  }, TestHttpsError), { code: 'invalid-argument' });

  const normalized = normalizeCreatePayload({
    ...validPayload(),
    externalParticipants: [
      { clubName: ' Rotaract Club A ', rotaractorName: ' Person 1 ', position: ' President ', rotaractDistrictId: '3131-A' },
      { clubName: 'Rotaract Club A', rotaractorName: 'Person 2', position: '', rotaractDistrictId: 'RID 3131' },
    ],
  }, TestHttpsError);
  assert.equal(normalized.externalParticipants.length, 2);
  assert.equal(normalized.externalParticipants[0].rotaractDistrictId, '3131-A');
  assert.equal(normalized.externalParticipants[1].rotaractDistrictId, 'RID 3131');
});

test('date and other validation derive exchangeMonth and reject malformed input', () => {
  assert.throws(() => normalizeCreatePayload({ ...validPayload(), exchangeDate: '' }, TestHttpsError), { code: 'invalid-argument' });
  assert.throws(() => normalizeCreatePayload({ ...validPayload(), exchangeDate: '21-08-2026' }, TestHttpsError), { code: 'invalid-argument' });
  assert.throws(() => normalizeCreatePayload({ ...validPayload(), exchangeDate: '2026-02-30' }, TestHttpsError), { code: 'invalid-argument' });
  assert.throws(() => normalizeCreatePayload({ ...validPayload(), other: 'x'.repeat(2001) }, TestHttpsError), { code: 'invalid-argument' });

  const normalized = normalizeCreatePayload({ ...validPayload(), exchangeDate: '2026-09-05', other: '  Hello   world  ' }, TestHttpsError);
  assert.equal(normalized.exchangeMonth, '2026-09');
  assert.equal(normalized.other, 'Hello world');
  assert.equal(istDateString(new Date('2026-08-20T20:00:00.000Z')), '2026-08-21');
});

test('member options expose only active public selector fields sorted alphabetically', async () => {
  const db = new FakeDb(seedForOptions());
  const members = await loadMemberOptions(db);
  assert.deepEqual(members.map(member => member.id), ['a', 'z']);
  assert.deepEqual(Object.keys(members[0]).sort(), ['id', 'name', 'position', 'role']);
  assert.equal(Object.hasOwn(members[0], 'email'), false);
});

test('event options include conducted canonical categories and remove mirrors', async () => {
  const db = new FakeDb(seedForOptions());
  const events = await loadEventOptions(db, new Date('2026-08-21T18:30:00.000Z'));
  const keys = events.map(event => `${event.source}:${event.id}`);
  assert.deepEqual(keys, [
    'events:club-1',
    'events:gbm-1',
    'bodMeetings:meeting-1',
    'districtEvents:district-1',
    'bodEvents:orphan-bod',
  ]);
  assert.equal(keys.includes('events:future-1'), false);
  assert.equal(keys.includes('events:district-1'), false);
  assert.equal(keys.includes('bodEvents:meeting-1'), false);
  assert.equal(keys.includes('bodEvents:district-1'), false);
  assert.match(events.find(event => event.id === 'club-1').label, /Project EduReach - ISD - 20 Aug 2026/);
});

test('create writes trusted snapshots, initialized image fields, metadata, and system log', async () => {
  const { service, db, logs } = makeService();
  const result = await service.create('creator-uid', {
    ...validPayload(),
    rcphMemberIds: ['a', 'a', 'z'],
  });

  assert.equal(result.ok, true);
  assert.equal(result.exchange.exchangeDate, '2026-08-21');
  assert.equal(result.exchange.exchangeMonth, '2026-08');
  assert.equal(result.exchange.externalParticipants[0].rotaractDistrictId, 'RID 3131');
  assert.deepEqual(result.exchange.rcphMemberIds, ['a', 'z']);
  assert.deepEqual(result.exchange.rcphRepresentatives.map(member => member.name), ['Asha Member', 'Zara Member']);
  assert.equal(result.exchange.rcphRepresentatives[0].userId, 'user-one');
  assert.equal(result.exchange.associatedEvent.name, 'Project EduReach');
  assert.equal(result.exchange.other, 'Exchanged before fellowship.');
  assert.deepEqual(result.exchange.images, []);
  assert.equal(result.exchange.imageCount, 0);
  assert.equal(result.exchange.driveFolderName, '');
  assert.equal(Object.hasOwn(result.exchange, 'driveFolderId'), false);
  assert.equal(result.exchange.createdByName, 'Creator Person');
  assert.equal(result.exchange.createdByRole, 'bod');

  const stored = db.read(`${LETTERHEAD_EXCHANGES_COLLECTION}/${result.exchange.id}`);
  assert.equal(stored.schemaVersion, 1);
  assert.equal(stored.status, 'active');
  assert.equal(stored.createdByUid, 'creator-uid');
  assert.equal(stored.rcphRepresentatives[0].name, 'Asha Member');

  assert.equal(logs.length, 1);
  assert.equal(logs[0].exchange.id, result.exchange.id);
  assert.deepEqual(logs[0].metadata, {
    exchangeDate: '2026-08-21',
    exchangeMonth: '2026-08',
    externalParticipantCount: 1,
    rcphRepresentativeCount: 2,
    associatedEvent: true,
  });
});

test('create rejects unknown, inactive, and fake client-supplied snapshots', async () => {
  const { service } = makeService();
  await assert.rejects(() => service.create('creator-uid', validPayload({ rcphMemberIds: [] })), { code: 'invalid-argument' });
  await assert.rejects(() => service.create('creator-uid', validPayload({ rcphMemberIds: ['missing'] })), { code: 'not-found' });
  await assert.rejects(() => service.create('creator-uid', validPayload({ rcphMemberIds: ['inactive'] })), { code: 'failed-precondition' });
  await assert.rejects(() => service.create('creator-uid', {
    ...validPayload(),
    rcphRepresentatives: [{ memberId: 'a', name: 'Fake Name' }],
  }), { code: 'invalid-argument' });
  await assert.rejects(() => service.create('creator-uid', {
    ...validPayload(),
    associatedEvent: { source: 'events', id: 'club-1', name: 'Fake Event' },
  }), { code: 'invalid-argument' });
});

test('associated event validation accepts conducted sources and rejects bad or future references', async () => {
  const { service } = makeService();
  assert.equal((await service.create('creator-uid', validPayload({ associatedEvent: null }))).exchange.associatedEvent, null);
  assert.equal((await service.create('creator-uid', validPayload({ associatedEvent: { source: 'events', id: 'gbm-1' } }))).exchange.associatedEvent.type, 'gbm');
  assert.equal((await service.create('creator-uid', validPayload({ associatedEvent: { source: 'bodMeetings', id: 'meeting-1' } }))).exchange.associatedEvent.type, 'bodMeeting');
  assert.equal((await service.create('creator-uid', validPayload({ associatedEvent: { source: 'districtEvents', id: 'district-1' } }))).exchange.associatedEvent.type, 'districtEvent');

  await assert.rejects(() => service.create('creator-uid', validPayload({ associatedEvent: { source: 'bad', id: 'club-1' } })), { code: 'invalid-argument' });
  await assert.rejects(() => service.create('creator-uid', validPayload({ associatedEvent: { source: 'events', id: 'missing' } })), { code: 'failed-precondition' });
  await assert.rejects(() => service.create('creator-uid', validPayload({ associatedEvent: { source: 'events', id: 'future-1' } })), { code: 'failed-precondition' });
});

test('list returns bounded newest-first normalized exchange records', async () => {
  const db = new FakeDb({
    [`${LETTERHEAD_EXCHANGES_COLLECTION}/old`]: {
      ...validPayload(),
      exchangeMonth: '2026-08',
      externalParticipants: validPayload().externalParticipants,
      rcphRepresentatives: [{ memberId: 'a', name: 'Asha Member', activeAtCreation: true }],
      rcphMemberIds: ['a'],
      associatedEvent: null,
      images: [],
      imageCount: 0,
      status: 'active',
      createdAt: '2026-08-01T00:00:00.000Z',
    },
    [`${LETTERHEAD_EXCHANGES_COLLECTION}/new`]: {
      ...validPayload({ exchangeDate: '2026-08-22' }),
      exchangeMonth: '2026-08',
      externalParticipants: validPayload().externalParticipants,
      rcphRepresentatives: [{ memberId: 'z', name: 'Zara Member', activeAtCreation: true }],
      rcphMemberIds: ['z'],
      associatedEvent: null,
      images: [],
      imageCount: 0,
      status: 'active',
      createdAt: '2026-08-22T00:00:00.000Z',
    },
  });
  const { service } = makeService({ db });
  const result = await service.list('viewer-uid', { limit: 1 });
  assert.equal(result.ok, true);
  assert.equal(result.limit, 1);
  assert.deepEqual(result.exchanges.map(exchange => exchange.id), ['new']);
  await assert.rejects(() => service.list('viewer-uid', { limit: 0 }), { code: 'invalid-argument' });
  const clamped = await service.list('viewer-uid', { limit: 500 });
  assert.equal(clamped.limit, 100);
});

test('report request validation normalizes duplicates and rejects malformed months', () => {
  assert.deepEqual(validateReportInput({ months: ['2026-08', '2026-07', '2026-08'] }, TestHttpsError), ['2026-07', '2026-08']);
  assert.throws(() => validateReportInput({}, TestHttpsError), { code: 'invalid-argument' });
  assert.throws(() => validateReportInput({ months: [] }, TestHttpsError), { code: 'invalid-argument' });
  assert.throws(() => validateReportInput({ months: ['2026-13'] }, TestHttpsError), { code: 'invalid-argument' });
  assert.throws(() => validateReportInput({ months: ['2026-8'] }, TestHttpsError), { code: 'invalid-argument' });
  assert.throws(() => validateReportInput({ months: [{ month: '2026-08' }] }, TestHttpsError), { code: 'invalid-argument' });
  assert.throws(() => validateReportInput({ months: ['2026-08'], extra: true }, TestHttpsError), { code: 'invalid-argument' });
  assert.throws(() => validateReportInput({ months: Array.from({ length: MAX_REPORT_MONTHS + 1 }, (_, index) => `2026-${String((index % 12) + 1).padStart(2, '0')}`) }, TestHttpsError), { code: 'invalid-argument' });
});

test('report retrieval returns selected exchangeMonth union in chronological safe shape', async () => {
  const db = new FakeDb({
    [`${LETTERHEAD_EXCHANGES_COLLECTION}/aug-late`]: storedExchange({
      exchangeDate: '2026-08-22',
      exchangeMonth: '2026-08',
      externalParticipants: [
        { clubName: 'Rotaract Club A', rotaractorName: 'Person 1', position: 'President', rotaractDistrictId: '3131' },
        { clubName: 'Rotaract Club A', rotaractorName: 'Person 2', position: '', rotaractDistrictId: '' },
      ],
      rcphRepresentatives: [
        { memberId: 'a', userId: 'u-a', name: 'Asha Member', role: 'bod', position: 'ISD' },
        { memberId: 'z', userId: 'u-z', name: 'Zara Member', role: 'gbm', position: 'Volunteer' },
      ],
      associatedEvent: { source: 'events', id: 'cmd-event', type: 'clubEvent', name: 'Community Event', label: 'Community Event - CMD - 22 Aug 2026', date: '2026-08-22' },
      other: 'Exchange during multi-avenue fellowship.',
      images: [{ imageId: 'image-1', fileName: 'secret.jpg', driveFileId: 'private-file' }],
      driveFolderId: 'private-folder',
    }),
    [`${LETTERHEAD_EXCHANGES_COLLECTION}/jul-first`]: storedExchange({
      exchangeDate: '2026-07-05',
      exchangeMonth: '2026-07',
      associatedEvent: null,
      other: '',
    }),
    [`${LETTERHEAD_EXCHANGES_COLLECTION}/sep-other`]: storedExchange({
      exchangeDate: '2026-09-01',
      exchangeMonth: '2026-09',
    }),
    [`${LETTERHEAD_EXCHANGES_COLLECTION}/inactive`]: storedExchange({
      exchangeDate: '2026-08-01',
      exchangeMonth: '2026-08',
      status: 'archived',
    }),
  });
  const { service } = makeService({ db });
  const result = await service.forReport('viewer-uid', { months: ['2026-08', '2026-07'] });

  assert.equal(result.ok, true);
  assert.deepEqual(result.months, ['2026-07', '2026-08']);
  assert.deepEqual(result.exchanges.map(exchange => exchange.id), ['jul-first', 'aug-late']);
  assert.equal(result.exchanges[0].associatedEvent, null);
  assert.equal(result.exchanges[1].externalParticipants.length, 2);
  assert.deepEqual(result.exchanges[1].rcphRepresentatives.map(row => row.name), ['Asha Member', 'Zara Member']);
  assert.equal(result.exchanges[1].associatedEvent.label, 'Community Event - CMD - 22 Aug 2026');
  const json = JSON.stringify(result);
  assert.equal(json.includes('driveFolderId'), false);
  assert.equal(json.includes('driveFileId'), false);
  assert.equal(json.includes('images'), false);
  assert.equal(json.includes('memberId'), false);
  assert.equal(json.includes('userId'), false);
});

test('report retrieval returns empty arrays for valid months with no matching exchanges', async () => {
  const { service } = makeService({ db: new FakeDb() });
  const result = await service.forReport('viewer-uid', { months: ['2026-08'] });
  assert.deepEqual(result, { ok: true, months: ['2026-08'], exchanges: [] });
});

test('report exchange normalization exposes no image or Drive internals', () => {
  const normalized = normalizeReportExchange('exchange-1', storedExchange({
    images: [{ imageId: 'image-1', fileName: 'scan.jpg', driveFileId: 'private' }],
    driveFolderId: 'folder',
    driveFolderName: 'folder name',
  }));
  assert.deepEqual(Object.keys(normalized).sort(), ['associatedEvent', 'exchangeDate', 'exchangeMonth', 'externalParticipants', 'id', 'other', 'rcphRepresentatives']);
  assert.equal(JSON.stringify(normalized).includes('drive'), false);
  assert.equal(JSON.stringify(normalized).includes('image'), false);
});

test('form options callable response shape is minimal and sorted', async () => {
  const { service } = makeService();
  const result = await service.formOptions('bod-uid');
  assert.equal(result.ok, true);
  assert.deepEqual(result.members.map(member => member.name), ['Asha Member', 'Zara Member']);
  assert.equal(result.events[0].date >= result.events[1].date, true);
  assert.deepEqual(Object.keys(result.events[0]).sort(), ['avenues', 'date', 'endDate', 'id', 'label', 'name', 'source', 'type']);
});
