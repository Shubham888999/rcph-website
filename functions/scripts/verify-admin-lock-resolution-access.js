'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const positionHelpers = require('../lib/positions');
const { createPositionAssignmentService } = require('../lib/position-assignments');
const { canManageResolutions } = require('../lib/resolutions');

const root = path.join(__dirname, '..', '..');
const functionsIndex = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');

function bodyOfFunction(source, name) {
  const marker = `function ${name}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} is defined`);
  let signatureDepth = 0;
  let signatureEnd = -1;
  for (let index = source.indexOf('(', start); index < source.length; index += 1) {
    if (source[index] === '(') signatureDepth += 1;
    if (source[index] === ')') {
      signatureDepth -= 1;
      if (signatureDepth === 0) {
        signatureEnd = index;
        break;
      }
    }
  }
  assert.notEqual(signatureEnd, -1, `${name} signature not found`);
  const open = source.indexOf('{', signatureEnd);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, index);
    }
  }
  throw new Error(`${name} body not found`);
}

const lockToolsBody = bodyOfFunction(functionsIndex, 'hasLockToolsAuthority');
const resolutionToolsBody = bodyOfFunction(functionsIndex, 'hasResolutionToolsAuthority');
const getAccessBody = functionsIndex.slice(
  functionsIndex.indexOf('exports.getMyAccess = onCall'),
  functionsIndex.indexOf('exports.getProspectManagementData = onCall')
);
const updateAccessBody = functionsIndex.slice(
  functionsIndex.indexOf('exports.updateUserAccessAndPositions = onCall'),
  functionsIndex.indexOf('exports.rejectUserRoleRequest = onCall')
);
const updateRoleBody = functionsIndex.slice(
  functionsIndex.indexOf('exports.updateUserRole = onCall'),
  functionsIndex.indexOf('exports.getRoleRequests = onCall')
);

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
    this.details = details || {};
  }
}

function userDoc(uid, role = 'pending', positionKeys = [], overrides = {}) {
  return {
    uid,
    name: overrides.name || uid,
    email: overrides.email || `${uid}@example.com`,
    status: overrides.status || 'pending',
    role,
    active: overrides.active !== false,
    positionKeys,
  };
}

function roleDoc(role = 'pending', overrides = {}) {
  return {
    role,
    status: overrides.status || 'pending',
    positionKeys: overrides.positionKeys || [],
  };
}

function accountSeed(uid, role = 'pending', positionKeys = [], overrides = {}) {
  return {
    users: { [uid]: userDoc(uid, role, positionKeys, overrides.user) },
    roles: { [uid]: roleDoc(role, { status: overrides.roleStatus || overrides.user?.status || 'pending', positionKeys }) },
    members: { [uid]: { userId: uid, name: uid, email: `${uid}@example.com`, positionKeys } },
    bodMembers: positionKeys.length ? { [uid]: { userId: uid, name: uid, email: `${uid}@example.com`, positionKeys, active: true } } : {},
    bodPositionOccupancy: Object.fromEntries(positionKeys.map(key => [key, { positionKey: key, active: true, holderUids: [uid] }])),
    bodPositionAssignments: Object.fromEntries(positionKeys.map(key => [`${key}_${uid}`, { assignmentId: `${key}_${uid}`, positionKey: key, uid, active: true }])),
  };
}

function mergeSeed(...parts) {
  const out = { users: {}, roles: {}, members: {}, bodMembers: {}, bodPositionOccupancy: {}, bodPositionAssignments: {}, rolePositionAudit: {} };
  for (const part of parts) {
    for (const key of Object.keys(out)) out[key] = { ...out[key], ...(part[key] || {}) };
  }
  return out;
}

function createMockDb(seed) {
  const state = mergeSeed(seed);
  const writes = [];
  return {
    state,
    writes,
    collection(collectionName) {
      return {
        doc(id) {
          return { collectionName, id: id || `generated-${writes.length + 1}` };
        },
      };
    },
    async runTransaction(fn) {
      const tx = {
        async get(ref) {
          return makeSnapshot(state[ref.collectionName]?.[ref.id] || null);
        },
        set(ref, payload, options) {
          writes.push({ type: 'set', collection: ref.collectionName, id: ref.id, payload: clone(payload), merge: options?.merge === true });
          state[ref.collectionName][ref.id] = { ...(options?.merge ? (state[ref.collectionName][ref.id] || {}) : {}), ...clone(payload) };
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
    admin: { firestore: { FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' } } },
    HttpsError: TestHttpsError,
    positionHelpers,
  });
  return { db, service };
}

async function runSync(seed, options) {
  const { db, service } = createAssignmentService(seed);
  try {
    const result = await service.syncUserRoleAndPositions({
      actorUid: 'admin-actor',
      actorRole: 'admin',
      actorHasAdminPanelAuthority: true,
      actorHasPresidentAuthority: false,
      targetUid: 'target',
      role: 'bod',
      operationSource: 'accountApproval',
      positionKeysProvided: true,
      positionKeys: ['treasurer'],
      confirmJointPositionKeys: [],
      ...options,
    });
    return { ok: true, result, writes: db.writes, state: db.state };
  } catch (err) {
    return { ok: false, err, writes: db.writes, state: db.state };
  }
}

assert.match(lockToolsBody, /isApprovedActiveUserRecord\(userData\)/, 'lock tools require approved active user data');
assert.match(lockToolsBody, /authority\.role === 'admin'/, 'approved stored admin role grants lock tools');
assert.match(lockToolsBody, /authority\.role === 'president'/, 'approved stored president role grants lock tools');
assert.match(lockToolsBody, /hasPresidentAuthority === true/, 'delegated President authority still grants lock tools');
assert.doesNotMatch(lockToolsBody, /hasSergeantAtArmsPosition/, 'SAA-only authority does not grant lock tools');

assert.match(resolutionToolsBody, /isApprovedActiveUserRecord\(userData\)/, 'resolution tools require approved active user data');
assert.match(resolutionToolsBody, /role === 'admin'/, 'approved stored admin role grants resolution tools');
assert.match(resolutionToolsBody, /role === 'president'/, 'approved stored president role grants resolution tools');
assert.match(resolutionToolsBody, /resolutionManager === true/, 'existing resolution manager authority is preserved');
assert.doesNotMatch(resolutionToolsBody, /hasSergeantAtArmsPosition/, 'SAA-only authority does not grant resolution tools');

assert.match(getAccessBody, /canAccessLockTools/, 'getMyAccess emits canAccessLockTools');
assert.match(getAccessBody, /canAccessResolutionTools/, 'getMyAccess emits canAccessResolutionTools');
assert.match(getAccessBody, /hasResolutionManagerAuthority\(uid, \{ activeRole, userSnap \}\)/, 'getMyAccess still calculates existing resolution manager authority');
assert.doesNotMatch(updateAccessBody, /approverAuthority/, 'updateUserAccessAndPositions does not reference stale approverAuthority');
assert.doesNotMatch(updateRoleBody, /approverAuthority/, 'updateUserRole does not reference stale approverAuthority');
assert.match(updateAccessBody, /rolePositionSyncAuthority\(actorAuthority\)/, 'updateUserAccessAndPositions derives sync authority from trusted actorAuthority');
assert.match(updateRoleBody, /rolePositionSyncAuthority\(actorAuthority\)/, 'updateUserRole derives sync authority from trusted actorAuthority');

assert.equal(canManageResolutions({ role: 'admin', userActive: true, userApproved: true, secretaryAssignmentActive: false }), true);
assert.equal(canManageResolutions({ role: 'admin', userActive: false, userApproved: true, secretaryAssignmentActive: false }), false);
assert.equal(canManageResolutions({ role: 'admin', userActive: true, userApproved: false, secretaryAssignmentActive: false }), false);
assert.equal(canManageResolutions({ role: 'bod', userActive: true, userApproved: true, secretaryAssignmentActive: false }), false);
assert.equal(canManageResolutions({ role: 'bod', userActive: true, userApproved: true, secretaryAssignmentActive: true }), true);
assert.equal(canManageResolutions({ role: 'gbm', userActive: true, userApproved: true, secretaryAssignmentActive: false }), false);
assert.equal(canManageResolutions({ role: 'prospect', userActive: true, userApproved: true, secretaryAssignmentActive: false }), false);

assert.match(rules, /function hasApprovedActiveRole\(role\)[\s\S]*get\(userPath\(\)\)\.data\.get\('status', ''\) == 'approved'[\s\S]*get\(userPath\(\)\)\.data\.get\('active', true\) != false/, 'rules require approved active user for focused role checks');
assert.match(rules, /function hasLockTools\(\)[\s\S]*hasApprovedActiveRole\('admin'\)[\s\S]*hasApprovedActiveRole\('president'\)[\s\S]*hasPresidentAuthority\(\)/, 'rules define lock tools without SAA');
assert.doesNotMatch(bodyOfFunction(rules, 'hasLockTools'), /saa|Sergeant|hasSergeant/i, 'rules lock tools do not include SAA');
assert.match(rules, /match \/locks\/\{panelId\}[\s\S]*allow create, update, delete: if hasLockTools\(\);/, 'direct lock writes use focused lock tools');
assert.match(rules, /match \/resolutions\/\{resolutionId\}[\s\S]*allow read, write: if false;/, 'direct resolution writes remain callable-only');
assert.match(rules, /match \/resolutionNumberIndex\/\{indexId\}[\s\S]*allow read, write: if false;/, 'resolution number index remains direct-client denied');

async function runRolePositionRegressions() {
  let outcome = await runSync(accountSeed('target', 'pending', []));
  assert.equal(outcome.ok, true, 'approving pending Treasurer when vacant succeeds');
  assert.deepEqual(outcome.result.addedPositionKeys, ['treasurer']);
  assert.equal(outcome.state.users.target.status, 'approved');
  assert.deepEqual(outcome.state.bodPositionOccupancy.treasurer.holderUids, ['target']);

  const occupiedTreasurer = mergeSeed(
    accountSeed('target', 'pending', []),
    accountSeed('existing', 'bod', ['treasurer'], { user: { status: 'approved' } })
  );
  outcome = await runSync(occupiedTreasurer);
  assert.equal(outcome.ok, false, 'occupied Treasurer requires joint-position confirmation');
  assert.equal(outcome.err.code, 'failed-precondition');
  assert.equal(outcome.err.details.code, 'joint-assignment-conflict');
  assert.equal(outcome.writes.length, 0, 'occupied Treasurer conflict makes zero partial writes');

  outcome = await runSync(occupiedTreasurer, { confirmJointPositionKeys: ['treasurer'] });
  assert.equal(outcome.ok, true, 'confirmed joint Treasurer assignment succeeds');
  assert.deepEqual(outcome.result.jointPositionKeys, ['treasurer']);
  assert.deepEqual(outcome.state.bodPositionOccupancy.treasurer.holderUids, ['existing', 'target']);

  outcome = await runSync(accountSeed('target', 'bod', ['secretary'], { user: { status: 'approved' } }), {
    operationSource: 'roleMaintenance',
    role: 'bod',
    positionKeys: ['secretary', 'rrro'],
  });
  assert.equal(outcome.ok, true, 'approved Admin can manage ordinary positions');
  assert.deepEqual(outcome.result.addedPositionKeys, ['rrro']);

  outcome = await runSync(accountSeed('target', 'bod', ['secretary'], { user: { status: 'approved' } }), {
    operationSource: 'roleMaintenance',
    role: 'bod',
    positionKeys: ['secretary', 'cwd'],
  });
  assert.equal(outcome.ok, false, 'Admin without President authority cannot assign cwd');
  assert.equal(outcome.err.code, 'permission-denied');
  assert.equal(outcome.writes.length, 0, 'cwd assignment denial makes zero partial writes');

  outcome = await runSync(accountSeed('target', 'bod', ['cwd'], { user: { status: 'approved' } }), {
    operationSource: 'roleMaintenance',
    role: 'bod',
    positionKeys: ['secretary'],
  });
  assert.equal(outcome.ok, false, 'Admin without President authority cannot remove cwd');
  assert.equal(outcome.err.code, 'permission-denied');
  assert.equal(outcome.writes.length, 0, 'cwd removal denial makes zero partial writes');

  outcome = await runSync(accountSeed('target', 'bod', ['secretary'], { user: { status: 'approved' } }), {
    actorUid: 'plain-bod',
    actorRole: 'bod',
    actorHasAdminPanelAuthority: false,
    actorHasPresidentAuthority: false,
    operationSource: 'roleMaintenance',
    role: 'bod',
    positionKeys: ['secretary', 'rrro'],
  });
  assert.equal(outcome.ok, false, 'plain BOD is denied');
  assert.equal(outcome.err.code, 'permission-denied');
  assert.equal(outcome.writes.length, 0, 'plain BOD denial makes zero partial writes');
}

runRolePositionRegressions()
  .then(() => {
    console.log('Admin lock/resolution access verification passed.');
  })
  .catch(error => {
    console.error('Admin lock/resolution access verification failed.');
    console.error(error);
    process.exitCode = 1;
  });
