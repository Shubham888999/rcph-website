'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createProfileRemovalService,
  _private,
} = require('./profile-removal');

const CONFIRM = 'DELETE PERMANENTLY';
const SERVER_TIMESTAMP = { serverTimestamp: true };

class FakeHttpsError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

function createFakeDb(seed = {}) {
  const store = new Map(Object.entries(seed).map(([path, data]) => [path, { ...data }]));
  let autoId = 0;

  function snapshotFor(path) {
    const id = path.split('/').pop();
    const ref = docRef(path);
    return {
      id,
      ref,
      exists: store.has(path),
      data: () => (store.has(path) ? { ...store.get(path) } : undefined),
    };
  }

  function docRef(path) {
    return {
      id: path.split('/').pop(),
      path,
      get: async () => snapshotFor(path),
    };
  }

  function collection(name) {
    return {
      doc(id) {
        const docId = id === undefined ? `auto-${++autoId}` : id;
        return docRef(`${name}/${docId}`);
      },
      where(field, op, value) {
        assert.equal(op, '==');
        return {
          get: async () => ({
            docs: Array.from(store.keys())
              .filter(path => path.startsWith(`${name}/`) && path.split('/').length === 2)
              .filter(path => store.get(path)[field] === value)
              .map(snapshotFor),
          }),
        };
      },
    };
  }

  return {
    store,
    collection,
    doc: docRef,
    batch() {
      const ops = [];
      return {
        set(ref, data, options = {}) { ops.push(() => store.set(ref.path, options.merge ? { ...(store.get(ref.path) || {}), ...data } : { ...data })); },
        delete(ref) { ops.push(() => store.delete(ref.path)); },
        async commit() { ops.forEach(op => op()); },
      };
    },
  };
}

function createFakeAdmin(authUids = []) {
  const users = new Set(authUids);
  const calls = { deleteUser: [], updateUser: [] };
  const notFound = () => Object.assign(new Error('not found'), { code: 'auth/user-not-found' });
  return {
    calls,
    users,
    firestore: { FieldValue: { serverTimestamp: () => SERVER_TIMESTAMP } },
    auth: () => ({
      async getUser(uid) {
        if (!users.has(uid)) throw notFound();
        return { uid, disabled: false, email: `${uid}@example.com`, displayName: uid };
      },
      async updateUser(uid, update) {
        calls.updateUser.push({ uid, update });
        if (!users.has(uid)) throw notFound();
      },
      async deleteUser(uid) {
        calls.deleteUser.push(uid);
        if (!users.has(uid)) throw notFound();
        users.delete(uid);
      },
    }),
  };
}

function createService(db, admin) {
  return createProfileRemovalService({
    db,
    admin,
    HttpsError: FakeHttpsError,
    assertAdminOrPresidentAuthority: async () => ({ role: 'admin', authority: {} }),
    assertApprovedActiveCallableAccount: async () => ({}),
    getAuthorityContext: async () => ({ role: '', authority: {}, positionKeys: [] }),
  });
}

const REMOVED = Object.freeze({ status: 'removed', deleted: true, active: false, accessRevoked: true, removedAt: '2026-09-01T00:00:00.000Z' });

function auditDocs(db) {
  return Array.from(db.store.entries())
    .filter(([path]) => path.startsWith('adminMaintenanceAudit/'))
    .map(([, data]) => data);
}

test('summaryIsRemoved recognises removed and deleted summaries only', () => {
  assert.equal(_private.summaryIsRemoved({ status: 'removed' }), true);
  assert.equal(_private.summaryIsRemoved({ status: 'approved', deleted: true }), true);
  assert.equal(_private.summaryIsRemoved({ status: 'approved', deleted: false }), false);
  assert.equal(_private.summaryIsRemoved(null), false);
});

test('permanent delete refuses a member that has not been removed', async () => {
  const db = createFakeDb({
    'members/m-active': { name: 'Active Member', email: 'active@example.com', status: 'approved', active: true },
    'attendance/m-active': { e1: true },
  });
  const admin = createFakeAdmin();
  const service = createService(db, admin);

  await assert.rejects(
    service.permanentlyDeleteRemovedProfile({ actorUid: 'admin-1', data: { memberId: 'm-active', confirmationText: CONFIRM } }),
    (error) => error.code === 'failed-precondition' && /Only removed profiles/.test(error.message),
  );
  assert.ok(db.store.has('members/m-active'));
  assert.ok(db.store.has('attendance/m-active'));
  assert.equal(auditDocs(db).length, 0);
});

test('permanent delete removes a linked member, its login and attendance under both ids, and keeps fines', async () => {
  const db = createFakeDb({
    'users/u-1': { ...REMOVED, name: 'Linked Member', email: 'linked@example.com', role: 'gbm' },
    'roles/u-1': { ...REMOVED, role: 'gbm', roleStatus: 'removed' },
    'members/m-1': { ...REMOVED, name: 'Linked Member', email: 'linked@example.com', uid: 'u-1' },
    'attendance/m-1': { e1: true },
    'attendance/u-1': { e2: false },
    'fines/f-1': { memberId: 'm-1', amount: 50 },
  });
  const admin = createFakeAdmin(['u-1']);
  const service = createService(db, admin);

  const result = await service.permanentlyDeleteRemovedProfile({
    actorUid: 'admin-1',
    data: { targetUid: 'u-1', memberId: 'm-1', confirmationText: CONFIRM },
  });

  assert.equal(result.ok, true);
  assert.equal(result.authDeleted, true);
  assert.deepEqual(admin.calls.deleteUser, ['u-1']);
  for (const path of ['users/u-1', 'roles/u-1', 'members/m-1', 'attendance/m-1', 'attendance/u-1']) {
    assert.equal(db.store.has(path), false, `${path} should be deleted`);
  }
  assert.ok(db.store.has('fines/f-1'), 'fines are preserved');
  const [audit] = auditDocs(db);
  assert.equal(audit.action, 'profile_permanently_deleted');
  assert.equal(audit.targetUid, 'u-1');
  assert.equal(audit.authDeleted, true);
});

test('permanent delete of a removed member without a login skips auth and deletes the member and attendance', async () => {
  const db = createFakeDb({
    'members/m-2': { ...REMOVED, name: 'Roster Only', email: 'roster@example.com' },
    'attendance/m-2': { e1: false },
  });
  const admin = createFakeAdmin();
  const service = createService(db, admin);

  const result = await service.permanentlyDeleteRemovedProfile({
    actorUid: 'admin-1',
    data: { memberId: 'm-2', confirmationText: CONFIRM },
  });

  assert.equal(result.ok, true);
  assert.equal(result.authDeleted, false);
  assert.deepEqual(admin.calls.deleteUser, []);
  assert.equal(db.store.has('members/m-2'), false);
  assert.equal(db.store.has('attendance/m-2'), false);
  assert.equal(auditDocs(db).length, 1);
});

test('permanent delete requires the exact confirmation text', async () => {
  const db = createFakeDb({ 'members/m-3': { ...REMOVED, name: 'Wrong Text' } });
  const service = createService(db, createFakeAdmin());

  await assert.rejects(
    service.permanentlyDeleteRemovedProfile({ actorUid: 'admin-1', data: { memberId: 'm-3', confirmationText: 'delete permanently' } }),
    (error) => error.code === 'failed-precondition',
  );
  assert.ok(db.store.has('members/m-3'));
});

test('removePersonProfile does not create a roles document for a member without one', async () => {
  const db = createFakeDb({
    'members/m-4': { name: 'No Role Doc', email: 'norole@example.com', status: 'approved', active: true },
  });
  const service = createService(db, createFakeAdmin());

  const result = await service.removePersonProfile({
    actorUid: 'admin-1',
    data: { memberId: 'm-4', confirmationText: 'REMOVE PROFILE' },
  });

  assert.equal(result.ok, true);
  assert.equal(db.store.has('roles/m-4'), false);
  assert.equal(db.store.get('members/m-4').status, 'removed');
});

function snapshotStore(db) {
  return JSON.stringify(Array.from(db.store.entries()).sort(([a], [b]) => a.localeCompare(b)));
}

test('r1: a member doc linked by uid resolves to that uid and can be removed', async () => {
  const db = createFakeDb({
    'users/u-1': { name: 'Linked Member', email: 'linked@example.com', role: 'gbm', status: 'approved' },
    'roles/u-1': { role: 'gbm', status: 'approved' },
    'members/m-1': { name: 'Linked Member', email: 'linked@example.com', uid: 'u-1', status: 'approved' },
  });
  const service = createService(db, createFakeAdmin(['u-1']));

  const preview = await service.previewRemovePersonProfile({ actorUid: 'admin-1', data: { memberId: 'm-1' } });
  assert.equal(preview.target.uid, 'u-1');
  assert.equal(preview.protections.reasons.includes('ambiguous_identity'), false);

  const result = await service.removePersonProfile({ actorUid: 'admin-1', data: { memberId: 'm-1', confirmationText: 'REMOVE PROFILE' } });
  assert.equal(result.ok, true);
  assert.equal(result.targetUid, 'u-1');
  assert.equal(db.store.get('members/m-1').status, 'removed');
  assert.equal(db.store.get('users/u-1').status, 'removed');
});

test('r2: a member doc without uid fields resolves through the email-matched user', async () => {
  const db = createFakeDb({
    'users/u-2': { name: 'Email Match', email: 'match@example.com', role: 'gbm', status: 'approved' },
    'members/m-2': { name: 'Email Match', email: 'match@example.com', status: 'approved' },
  });
  const service = createService(db, createFakeAdmin(['u-2']));
  const data = { memberId: 'm-2', email: 'match@example.com' };

  const preview = await service.previewRemovePersonProfile({ actorUid: 'admin-1', data });
  assert.equal(preview.target.uid, 'u-2');
  assert.equal(preview.protections.reasons.includes('ambiguous_identity'), false);

  const result = await service.removePersonProfile({ actorUid: 'admin-1', data: { ...data, confirmationText: 'REMOVE PROFILE' } });
  assert.equal(result.ok, true);
  assert.equal(result.targetUid, 'u-2');
});

test('r3: a roster-only member with no account resolves to its member doc id', async () => {
  const db = createFakeDb({
    'members/m-3': { name: 'Roster Only', email: 'roster-only@example.com', status: 'approved' },
  });
  const service = createService(db, createFakeAdmin());

  const preview = await service.previewRemovePersonProfile({ actorUid: 'admin-1', data: { memberId: 'm-3', email: 'roster-only@example.com' } });
  assert.equal(preview.target.uid, 'm-3');
  assert.equal(preview.protections.blocked, false);
});

test('r4: a member linked to one uid whose email matches a different user stays ambiguous and nothing is written', async () => {
  const db = createFakeDb({
    'users/u-5': { name: 'Someone Else', email: 'shared@example.com', role: 'gbm', status: 'approved' },
    'members/m-4': { name: 'Linked Elsewhere', email: 'shared@example.com', uid: 'u-4', status: 'approved' },
  });
  const service = createService(db, createFakeAdmin(['u-4', 'u-5']));
  const data = { memberId: 'm-4', email: 'shared@example.com' };

  const preview = await service.previewRemovePersonProfile({ actorUid: 'admin-1', data });
  assert.equal(preview.protections.blocked, true);
  assert.ok(preview.protections.reasons.includes('ambiguous_identity'));

  const before = snapshotStore(db);
  await assert.rejects(
    service.removePersonProfile({ actorUid: 'admin-1', data: { ...data, confirmationText: 'REMOVE PROFILE' } }),
    (error) => error.code === 'failed-precondition' && error.details.reasons.includes('ambiguous_identity'),
  );
  assert.equal(snapshotStore(db), before);
});
