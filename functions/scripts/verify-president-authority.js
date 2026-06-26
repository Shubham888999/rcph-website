const assert = require('assert');
const fs = require('fs');
const path = require('path');
const positionHelpers = require('../lib/positions');
const { resolveAccessContextFromRecords } = require('../lib/visit-submissions');
const { createPositionAssignmentService } = require('../lib/position-assignments');

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`not ok - ${name}`);
    throw err;
  }
}

function user(role, positionKeys, overrides = {}) {
  return {
    uid: overrides.uid || 'uid',
    role,
    status: overrides.status || 'approved',
    active: overrides.active,
    positionKeys: positionKeys || [],
  };
}

function roleDoc(role, overrides = {}) {
  return {
    role,
    status: overrides.status || 'approved',
  };
}

function cwdAssignment(uid = 'uid', overrides = {}) {
  return {
    uid,
    positionKey: 'cwd',
    active: overrides.active !== false,
  };
}

function access(uid, records) {
  return resolveAccessContextFromRecords(uid, records, positionHelpers);
}

function assertDenied(fn, label) {
  assert.throws(fn, err => err && err.code === 'permission-denied', label);
}

function assertRejected(fn, codes, label) {
  assert.throws(fn, err => err && codes.includes(err.code), label);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function makeSnapshot(data) {
  return {
    exists: !!data,
    data: () => clone(data),
  };
}

class TestHttpsError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.httpsCode = code;
    this.details = details || {};
  }
}

function createMockDb(seed) {
  const state = {
    users: {},
    roles: {},
    members: {},
    bodMembers: {},
    bodPositionOccupancy: {},
    bodPositionAssignments: {},
    rolePositionAudit: {},
    ...(seed || {}),
  };
  const writes = [];

  function ref(collectionName, id) {
    return { collectionName, id };
  }

  return {
    state,
    writes,
    collection(collectionName) {
      return {
        doc(id) {
          return ref(collectionName, id || `generated-${writes.length + 1}`);
        },
      };
    },
    async runTransaction(fn) {
      const tx = {
        async get(documentRef) {
          return makeSnapshot(state[documentRef.collectionName]?.[documentRef.id] || null);
        },
        set(documentRef, payload, options) {
          writes.push({
            type: 'set',
            collection: documentRef.collectionName,
            id: documentRef.id,
            payload: clone(payload),
            merge: options?.merge === true,
          });
          state[documentRef.collectionName] = state[documentRef.collectionName] || {};
          state[documentRef.collectionName][documentRef.id] = {
            ...(options?.merge ? (state[documentRef.collectionName][documentRef.id] || {}) : {}),
            ...clone(payload),
          };
        },
      };
      return fn(tx);
    },
  };
}

function createAssignmentService(seed) {
  const db = createMockDb(seed);
  const service = createPositionAssignmentService({
    db,
    admin: {
      firestore: {
        FieldValue: {
          serverTimestamp: () => 'SERVER_TIMESTAMP',
        },
      },
    },
    HttpsError: TestHttpsError,
    positionHelpers,
  });
  return { db, service };
}

function assignmentSeed(targetUid, role, positionKeys) {
  return {
    users: {
      [targetUid]: user(role, positionKeys, { uid: targetUid }),
    },
    roles: {
      [targetUid]: roleDoc(role),
    },
    members: {
      [targetUid]: { userId: targetUid, positionKeys: positionKeys || [] },
    },
    bodMembers: {
      [targetUid]: { userId: targetUid, positionKeys: positionKeys || [] },
    },
    bodPositionOccupancy: Object.fromEntries((positionKeys || []).map(key => [
      key,
      { positionKey: key, active: true, holderUids: [targetUid] },
    ])),
    bodPositionAssignments: Object.fromEntries((positionKeys || []).map(key => [
      `${key}_${targetUid}`,
      { assignmentId: `${key}_${targetUid}`, positionKey: key, uid: targetUid, active: true },
    ])),
  };
}

async function runSyncCase(seed, options) {
  const { db, service } = createAssignmentService(seed);
  try {
    const result = await service.syncUserRoleAndPositions({
      actorUid: 'actor',
      actorRole: 'admin',
      targetUid: 'target',
      role: 'bod',
      operationSource: 'roleMaintenance',
      positionKeysProvided: true,
      positionKeys: [],
      ...options,
    });
    return { ok: true, result, writes: db.writes, state: db.state };
  } catch (err) {
    return { ok: false, err, writes: db.writes, state: db.state };
  }
}

async function assertSyncDenied(name, seed, options, expectedMessagePart) {
  const outcome = await runSyncCase(seed, options);
  assert.strictEqual(outcome.ok, false, name);
  assert.strictEqual(outcome.err.code, 'permission-denied', name);
  if (expectedMessagePart) {
    assert(String(outcome.err.message).includes(expectedMessagePart), name);
  }
  assert.strictEqual(outcome.writes.length, 0, `${name}: must reject before transaction writes`);
  console.log(`ok - ${name}`);
}

async function assertSyncAllowed(name, seed, options) {
  const outcome = await runSyncCase(seed, options);
  assert.strictEqual(outcome.ok, true, name);
  assert(outcome.writes.length > 0, `${name}: expected writes`);
  console.log(`ok - ${name}`);
  return outcome;
}

test('approved president role has President authority', () => {
  const authority = positionHelpers.buildPresidentAuthority('president', []);
  assert.strictEqual(authority.isPresidentRole, true);
  assert.strictEqual(authority.hasPresidentAuthority, true);
});

test('approved admin plus cwd has President authority in Visit backend', () => {
  const result = access('uid', {
    user: user('admin', ['cwd']),
    role: roleDoc('admin'),
    websiteDirectorAssignment: cwdAssignment(),
  });
  assert.strictEqual(result.role, 'admin');
  assert.strictEqual(result.authority.hasPresidentAuthority, true);
  assert.strictEqual(result.canManageVisitSystem, true);
});

test('approved bod plus cwd has President authority in Visit backend', () => {
  const result = access('uid', {
    user: user('bod', ['cwd']),
    role: roleDoc('bod'),
    websiteDirectorAssignment: cwdAssignment(),
  });
  assert.strictEqual(result.role, 'bod');
  assert.strictEqual(result.authority.hasPresidentAuthority, true);
  assert.strictEqual(result.canManageVisitSystem, true);
});

test('approved admin without cwd has only normal Admin manager access', () => {
  const result = access('uid', {
    user: user('admin', []),
    role: roleDoc('admin'),
  });
  assert.strictEqual(result.authority.hasPresidentAuthority, false);
  assert.strictEqual(result.canManageVisitSystem, true);
});

test('approved bod without cwd has no President authority', () => {
  const result = access('uid', {
    user: user('bod', ['secretary']),
    role: roleDoc('bod'),
  });
  assert.strictEqual(result.authority.hasPresidentAuthority, false);
  assert.strictEqual(result.canManageVisitSystem, false);
});

test('gbm without cwd has no President authority', () => {
  assertDenied(() => access('uid', {
    user: user('gbm', []),
    role: roleDoc('gbm'),
  }), 'GBM should not access Visit manager authority');
});

test('pending account with cwd-like data is denied', () => {
  assertDenied(() => access('uid', {
    user: user('bod', ['cwd'], { status: 'pending' }),
    role: roleDoc('bod'),
    websiteDirectorAssignment: cwdAssignment(),
  }), 'pending cwd should be denied');
});

test('rejected account with cwd-like data is denied', () => {
  assertDenied(() => access('uid', {
    user: user('admin', ['cwd'], { status: 'rejected' }),
    role: roleDoc('admin'),
    websiteDirectorAssignment: cwdAssignment(),
  }), 'rejected cwd should be denied');
});

test('unknown position key is denied President authority', () => {
  assertRejected(() => access('uid', {
    user: user('bod', ['not-a-position']),
    role: roleDoc('bod'),
    websiteDirectorAssignment: cwdAssignment(),
  }), ['failed-precondition', 'permission-denied'], 'unknown position should not grant authority');
});

test('removed cwd assignment removes President authority', () => {
  const result = access('uid', {
    user: user('bod', ['cwd']),
    role: roleDoc('bod'),
    websiteDirectorAssignment: cwdAssignment('uid', { active: false }),
  });
  assert.strictEqual(result.authority.hasPresidentAuthority, false);
  assert.strictEqual(result.canManageVisitSystem, false);
  assert.strictEqual(result.positionKeys.includes('cwd'), true);
});

test('multiple positions including cwd are allowed', () => {
  const result = access('uid', {
    user: user('bod', ['secretary', 'cwd']),
    role: roleDoc('bod'),
    websiteDirectorAssignment: cwdAssignment(),
  });
  assert.strictEqual(result.authority.hasPresidentAuthority, true);
  assert.deepStrictEqual(result.positionKeys, ['secretary', 'cwd']);
});

test('Website Director display title remains Website Director', () => {
  const metadata = positionHelpers.derivePositionMetadata(['cwd']);
  assert.deepStrictEqual(metadata.positionTitles, ['Website Director']);
  assert.strictEqual(metadata.clubPosition, 'Website Director');
});

test('Firestore rules centralize President authority and block client assignment writes', () => {
  const rules = fs.readFileSync(path.join(__dirname, '..', '..', 'firestore.rules'), 'utf8');
  assert(rules.includes('function hasPresidentAuthority()'), 'rules define hasPresidentAuthority');
  assert(rules.includes('bodPositionOccupancy/cwd'), 'rules use server-maintained cwd occupancy');
  assert(/match \/bodPositionAssignments\/\{assignmentId\}[\s\S]*allow write: if false;/.test(rules), 'clients cannot write assignments');
  assert(/match \/bodPositionOccupancy\/\{positionKey\}[\s\S]*allow write: if false;/.test(rules), 'clients cannot write occupancy');
  assert(/match \/locks\/\{panelId\}[\s\S]*allow create, update, delete: if hasPresidentAuthority\(\);/.test(rules), 'locks use President authority');
});
test('approved user without role document is denied Visit access', () => {
  assertDenied(() => access('uid', {
    user: user('admin', []),
  }), 'missing role document should be denied');
});

test('approved cwd user without role document is denied Visit access', () => {
  assertDenied(() => access('uid', {
    user: user('admin', ['cwd']),
    websiteDirectorAssignment: cwdAssignment(),
  }), 'cwd without role document should be denied');
});

test('user and role document mismatch is denied', () => {
  assertRejected(() => access('uid', {
    user: user('admin', []),
    role: roleDoc('bod'),
  }), ['failed-precondition'], 'role mismatch should be denied');
});
async function runPositionAssignmentAuthorityTests() {
  await assertSyncDenied(
    'Admin cannot assign cwd to self',
    assignmentSeed('actor', 'admin', []),
    { actorUid: 'actor', actorRole: 'admin', targetUid: 'actor', role: 'admin', positionKeys: ['cwd'] },
    'President authority is required'
  );

  await assertSyncDenied(
    'Admin cannot assign cwd to another account',
    assignmentSeed('target', 'admin', []),
    { actorUid: 'actor', actorRole: 'admin', targetUid: 'target', role: 'admin', positionKeys: ['cwd'] },
    'President authority is required'
  );

  await assertSyncDenied(
    'Admin cannot remove cwd from another account',
    assignmentSeed('target', 'admin', ['cwd']),
    { actorUid: 'actor', actorRole: 'admin', targetUid: 'target', role: 'admin', positionKeys: [] },
    'President authority is required'
  );

  await assertSyncDenied(
    'Admin cannot remove cwd from self',
    assignmentSeed('actor', 'admin', ['cwd']),
    { actorUid: 'actor', actorRole: 'admin', targetUid: 'actor', role: 'admin', positionKeys: [] },
    'President authority is required'
  );

  await assertSyncDenied(
    'BOD without President authority cannot assign cwd',
    assignmentSeed('target', 'bod', ['secretary']),
    { actorUid: 'actor', actorRole: 'bod', targetUid: 'target', role: 'bod', positionKeys: ['secretary', 'cwd'] },
    'Admin or president access required'
  );

  await assertSyncDenied(
    'Non-president Website Director cannot alter own cwd',
    assignmentSeed('actor', 'admin', ['cwd']),
    {
      actorUid: 'actor',
      actorRole: 'admin',
      actorHasPresidentAuthority: true,
      targetUid: 'actor',
      role: 'admin',
      positionKeys: [],
    },
    'Only the President role may change its own Website Director assignment'
  );

  await assertSyncAllowed(
    'Literal President can assign cwd to another user',
    assignmentSeed('target', 'admin', []),
    { actorUid: 'president-uid', actorRole: 'president', targetUid: 'target', role: 'admin', positionKeys: ['cwd'] }
  );

  const removeOther = await assertSyncAllowed(
    'Literal President can remove cwd from another user',
    assignmentSeed('target', 'admin', ['cwd']),
    { actorUid: 'president-uid', actorRole: 'president', targetUid: 'target', role: 'admin', positionKeys: [] }
  );
  assert.deepStrictEqual(removeOther.result.removedPositionKeys, ['cwd']);

  await assertSyncAllowed(
    'Literal President can assign cwd to self',
    assignmentSeed('president-uid', 'president', []),
    { actorUid: 'president-uid', actorRole: 'president', targetUid: 'president-uid', role: 'president', positionKeys: ['cwd'] }
  );

  const removeSelf = await assertSyncAllowed(
    'Literal President can remove cwd from self',
    assignmentSeed('president-uid', 'president', ['cwd']),
    { actorUid: 'president-uid', actorRole: 'president', targetUid: 'president-uid', role: 'president', positionKeys: [] }
  );
  assert.deepStrictEqual(removeSelf.result.removedPositionKeys, ['cwd']);

  await assertSyncAllowed(
    'Existing Website Director authority can change non-cwd positions for another user',
    assignmentSeed('target', 'bod', ['secretary']),
    {
      actorUid: 'actor',
      actorRole: 'bod',
      actorHasPresidentAuthority: true,
      targetUid: 'target',
      role: 'bod',
      positionKeys: ['rrro'],
    }
  );

  await assertSyncAllowed(
    'Admin can assign ordinary non-cwd position',
    assignmentSeed('target', 'admin', []),
    { actorUid: 'actor', actorRole: 'admin', targetUid: 'target', role: 'admin', positionKeys: ['secretary'] }
  );

  const ordinaryRemoval = await assertSyncAllowed(
    'Admin can remove ordinary non-cwd position',
    assignmentSeed('target', 'admin', ['secretary']),
    { actorUid: 'actor', actorRole: 'admin', targetUid: 'target', role: 'admin', positionKeys: [] }
  );
  assert.deepStrictEqual(ordinaryRemoval.result.removedPositionKeys, ['secretary']);

  const presidentRemoval = await assertSyncAllowed(
    'Removing cwd by President removes future President authority data',
    assignmentSeed('target', 'admin', ['cwd']),
    { actorUid: 'president-uid', actorRole: 'president', targetUid: 'target', role: 'admin', positionKeys: [] }
  );
  const assignmentWrite = presidentRemoval.writes.find(write => write.collection === 'bodPositionAssignments' && write.id === 'cwd_target');
  assert(assignmentWrite, 'cwd assignment write exists');
  assert.strictEqual(assignmentWrite.payload.active, false, 'cwd assignment is deactivated');

await assertSyncDenied(
  'Admin cannot promote self to President role',
  assignmentSeed('actor', 'admin', []),
  {
    actorUid: 'actor',
    actorRole: 'admin',
    actorHasPresidentAuthority: false,
    targetUid: 'actor',
    role: 'president',
    positionKeys: ['president'],
  },
  'President authority is required'
);

await assertSyncDenied(
  'Admin cannot promote another account to President role',
  assignmentSeed('target', 'admin', []),
  {
    actorUid: 'actor',
    actorRole: 'admin',
    actorHasPresidentAuthority: false,
    targetUid: 'target',
    role: 'president',
    positionKeys: ['president'],
  },
  'President authority is required'
);

await assertSyncDenied(
  'Admin cannot remove President role',
  assignmentSeed('target', 'president', ['president']),
  {
    actorUid: 'actor',
    actorRole: 'admin',
    actorHasPresidentAuthority: false,
    targetUid: 'target',
    role: 'admin',
    positionKeys: [],
  },
  'President authority is required'
);

await assertSyncDenied(
  'BOD cannot assign President role',
  assignmentSeed('target', 'bod', ['secretary']),
  {
    actorUid: 'actor',
    actorRole: 'bod',
    actorHasPresidentAuthority: false,
    targetUid: 'target',
    role: 'president',
    positionKeys: ['president'],
  },
  'Admin or president access required'
);

await assertSyncDenied(
  'Website Director cannot promote self to President role',
  assignmentSeed('actor', 'admin', ['cwd']),
  {
    actorUid: 'actor',
    actorRole: 'admin',
    actorHasPresidentAuthority: true,
    targetUid: 'actor',
    role: 'president',
    positionKeys: ['cwd', 'president'],
  },
  'Only the President role may change its own President role assignment'
);

await assertSyncAllowed(
  'Literal President can assign President role',
  assignmentSeed('target', 'admin', []),
  {
    actorUid: 'president-actor',
    actorRole: 'president',
    actorHasPresidentAuthority: true,
    targetUid: 'target',
    role: 'president',
    positionKeys: ['president'],
  }
);

await assertSyncAllowed(
  'Literal President can remove President role',
  assignmentSeed('target', 'president', ['president']),
  {
    actorUid: 'president-actor',
    actorRole: 'president',
    actorHasPresidentAuthority: true,
    targetUid: 'target',
    role: 'admin',
    positionKeys: [],
  }
);

await assertSyncAllowed(
  'Admin can still manage ordinary roles',
  assignmentSeed('target', 'bod', ['secretary']),
  {
    actorUid: 'actor',
    actorRole: 'admin',
    actorHasPresidentAuthority: false,
    targetUid: 'target',
    role: 'admin',
    positionKeys: ['secretary'],
  }
);
}

runPositionAssignmentAuthorityTests()
  .then(() => {
    console.log('President authority verification passed.');
  })
  .catch((err) => {
    console.error('President authority verification failed.');
    console.error(err);
    process.exitCode = 1;
  });
