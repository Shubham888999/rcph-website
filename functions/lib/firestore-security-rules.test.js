'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rules = readFileSync(path.join(__dirname, '..', '..', 'firestore.rules'), 'utf8');
const NOW = new Date('2026-07-30T12:00:00.000Z');
const TERMINAL_FIELDS = [
  'revokedAt',
  'disabledAt',
  'inactiveAt',
  'deletedAt',
  'archivedAt',
  'removedAt',
  'endedAt',
  'historicalAt',
];

function bodyOfFunction(source, name) {
  const marker = `function ${name}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} is defined`);
  const open = source.indexOf('{', start);
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

function role(roleName, overrides = {}) {
  return { role: roleName, status: 'approved', active: true, ...overrides };
}

function user(roleName, positionKeys = [], overrides = {}) {
  return { role: roleName, status: 'approved', active: true, positionKeys, ...overrides };
}

function assignment(uid, positionKey, overrides = {}) {
  return { uid, positionKey, active: true, ...overrides };
}

function account(uid, roleName, positionKeys = [], overrides = {}) {
  return {
    uid,
    role: role(roleName, overrides.role || {}),
    user: user(roleName, positionKeys, overrides.user || {}),
    assignments: Object.fromEntries((overrides.assignments || positionKeys)
      .map(positionKey => [`${positionKey}_${uid}`, assignment(uid, positionKey, overrides.assignment || {})])),
    occupancy: overrides.occupancy || {},
  };
}

const identities = {
  unauthenticated: null,
  member: account('member', 'gbm'),
  mainDirector: account('main-csd', 'bod', ['csd']),
  coDirector: account('co-csd', 'bod', ['co-csd']),
  admin: account('admin', 'admin'),
  inactiveAdmin: account('inactive-admin', 'admin', [], { user: { active: false } }),
  rejectedAdmin: account('rejected-admin', 'admin', [], { role: { status: 'rejected' }, user: { status: 'rejected' } }),
  disabledAdmin: account('disabled-admin', 'admin', [], { role: { disabled: true }, user: { disabled: true } }),
  president: account('president', 'president', ['president']),
  cwd: account('cwd', 'bod', ['cwd']),
  removedCwd: account('removed-cwd', 'bod', ['cwd'], { assignment: { active: false, removedAt: NOW } }),
  expiredCwd: account('expired-cwd', 'bod', ['cwd'], { assignment: { expiresAt: new Date('2026-07-01T00:00:00.000Z') } }),
  staleCwdPositionKey: account('stale-cwd-key', 'bod', ['cwd'], { assignments: [] }),
  staleCwdOccupancy: account('stale-cwd-occupancy', 'bod', ['cwd'], {
    assignments: [],
    occupancy: { cwd: { positionKey: 'cwd', active: true, holderUids: ['stale-cwd-occupancy'] } },
  }),
  unrelated: account('unrelated', 'prospect'),
};

function hasTerminalField(data = {}) {
  return TERMINAL_FIELDS.some(field => Object.prototype.hasOwnProperty.call(data, field));
}

function hasNoExpiredLifecycle(data = {}) {
  if (!Object.prototype.hasOwnProperty.call(data, 'expiresAt')) return true;
  return data.expiresAt instanceof Date && NOW < data.expiresAt;
}

function isActiveLifecycleRecord(data = {}) {
  return data.active !== false
    && data.disabled !== true
    && data.deleted !== true
    && data.archived !== true
    && data.removed !== true
    && data.accessRevoked !== true
    && !hasTerminalField(data)
    && hasNoExpiredLifecycle(data);
}

function isApprovedActiveRecord(data = {}) {
  return data.status === 'approved' && isActiveLifecycleRecord(data);
}

function hasApprovedActiveRole(identity, roleName) {
  return !!identity
    && identity.role?.role === roleName
    && identity.user?.role === roleName
    && isApprovedActiveRecord(identity.role)
    && isApprovedActiveRecord(identity.user);
}

function hasAnyRole(identity, roleNames) {
  return !!identity
    && roleNames.includes(identity.role?.role)
    && identity.user?.role === identity.role?.role
    && isApprovedActiveRecord(identity.role)
    && isApprovedActiveRecord(identity.user);
}

function activePositionAssignment(identity, positionKey) {
  const doc = identity?.assignments?.[`${positionKey}_${identity.uid}`];
  return !!doc
    && doc.uid === identity.uid
    && doc.positionKey === positionKey
    && doc.active === true
    && ['active', 'approved'].includes(doc.status || 'active')
    && isActiveLifecycleRecord(doc);
}

function hasPresidentAuthority(identity) {
  return (hasAnyRole(identity, ['bod', 'admin', 'president'])
      && identity.user.positionKeys?.includes('president')
      && activePositionAssignment(identity, 'president'))
    || (hasAnyRole(identity, ['bod', 'admin', 'president'])
      && identity.user.positionKeys?.includes('cwd')
      && activePositionAssignment(identity, 'cwd'));
}

function hasActiveSaaAssignment(identity) {
  return hasAnyRole(identity, ['bod', 'admin', 'president'])
    && identity.user.positionKeys?.includes('saa')
    && activePositionAssignment(identity, 'saa');
}

function isAdmin(identity) {
  return hasApprovedActiveRole(identity, 'admin')
    || hasApprovedActiveRole(identity, 'president')
    || hasPresidentAuthority(identity)
    || hasActiveSaaAssignment(identity);
}

function hasAdminPanelAuthority(identity) {
  return hasApprovedActiveRole(identity, 'admin')
    || hasApprovedActiveRole(identity, 'president')
    || hasPresidentAuthority(identity)
    || hasActiveSaaAssignment(identity);
}

function hasLockTools(identity) {
  return hasApprovedActiveRole(identity, 'admin')
    || hasApprovedActiveRole(identity, 'president')
    || hasPresidentAuthority(identity);
}

function canGetRole(identity, targetUid) {
  return !!identity && (identity.uid === targetUid || isAdmin(identity));
}

function canListRoles(identity) {
  return isAdmin(identity);
}

function canReadLock(identity) {
  return hasAdminPanelAuthority(identity);
}

function canWriteLock(identity) {
  return hasLockTools(identity);
}

function canReadAdminCollection(identity, collection) {
  if (['systemLogs', 'auditLogs'].includes(collection)) return false;
  return isAdmin(identity);
}

test('rules source replaces broad role and lock reads with approved-active authority', () => {
  assert.match(rules, /function isApprovedActiveRecord\(data\)/);
  assert.match(rules, /function isActiveLifecycleRecord\(data\)/);
  assert.match(rules, /function websiteDirectorAssignmentPath\(\)/);
  assert.doesNotMatch(rules, /bodPositionOccupancy\/cwd/);
  assert.match(bodyOfFunction(rules, 'hasApprovedActiveRole'), /get\(userPath\(\)\)\.data\.role == role/);
  assert.match(bodyOfFunction(rules, 'hasApprovedActiveRole'), /isApprovedActiveRecord\(get\(rolePath\(\)\)\.data\)/);
  assert.match(bodyOfFunction(rules, 'hasApprovedActiveRole'), /isApprovedActiveRecord\(get\(userPath\(\)\)\.data\)/);
  assert.match(bodyOfFunction(rules, 'hasActivePositionAssignment'), /isActiveLifecycleRecord\(get\(assignmentPath\)\.data\)/);
  assert.match(bodyOfFunction(rules, 'hasWebsiteDirectorPosition'), /websiteDirectorAssignmentPath\(\)/);
  assert.doesNotMatch(bodyOfFunction(rules, 'isAdmin'), /hasRole\('admin'\)/);
  assert.match(rules, /match \/roles\/\{uid\} \{\s*allow get: if signedIn\(\) && \(request\.auth\.uid == uid \|\| isAdmin\(\)\);\s*allow list: if isAdmin\(\);/);
  assert.match(rules, /match \/locks\/\{panelId\} \{\s*allow read: if hasAdminPanelAuthority\(\);\s*allow create, update, delete: if hasLockTools\(\);/);
});

test('role reads deny unauthenticated, cross-user, and ordinary collection queries', () => {
  assert.equal(canGetRole(identities.unauthenticated, 'member'), false);
  assert.equal(canGetRole(identities.member, 'member'), true);
  assert.equal(canGetRole(identities.member, 'admin'), false);
  assert.equal(canGetRole(identities.mainDirector, 'admin'), false);
  assert.equal(canGetRole(identities.coDirector, 'admin'), false);
  assert.equal(canListRoles(identities.member), false);
  assert.equal(canListRoles(identities.mainDirector), false);
  assert.equal(canListRoles(identities.coDirector), false);
  assert.equal(canGetRole(identities.admin, 'member'), true);
  assert.equal(canListRoles(identities.admin), true);
  assert.equal(canGetRole(identities.inactiveAdmin, 'member'), false);
  assert.equal(canGetRole(identities.rejectedAdmin, 'member'), false);
  assert.equal(canGetRole(identities.disabledAdmin, 'member'), false);
});

test('lock reads and writes deny ordinary and stale identities', () => {
  assert.equal(canReadLock(identities.member), false);
  assert.equal(canReadLock(identities.mainDirector), false);
  assert.equal(canReadLock(identities.coDirector), false);
  assert.equal(canWriteLock(identities.member), false);
  assert.equal(canWriteLock(identities.mainDirector), false);
  assert.equal(canWriteLock(identities.coDirector), false);
  assert.equal(canReadLock(identities.admin), true);
  assert.equal(canWriteLock(identities.admin), true);
  assert.equal(canReadLock(identities.president), true);
  assert.equal(canWriteLock(identities.president), true);
  assert.equal(canReadLock(identities.cwd), true);
  assert.equal(canWriteLock(identities.cwd), true);
  assert.equal(canReadLock(identities.inactiveAdmin), false);
  assert.equal(canWriteLock(identities.inactiveAdmin), false);
  assert.equal(canReadLock(identities.removedCwd), false);
  assert.equal(canWriteLock(identities.removedCwd), false);
  assert.equal(canReadLock(identities.expiredCwd), false);
  assert.equal(canWriteLock(identities.expiredCwd), false);
  assert.equal(canReadLock(identities.staleCwdPositionKey), false);
  assert.equal(canReadLock(identities.staleCwdOccupancy), false);
});

test('admin lifecycle checks protect representative sensitive collections', () => {
  for (const collection of ['roles', 'treasury', 'fines', 'attendance', 'reminders']) {
    assert.equal(canReadAdminCollection(identities.admin, collection), true, `${collection} active admin`);
    assert.equal(canReadAdminCollection(identities.cwd, collection), true, `${collection} active cwd`);
    assert.equal(canReadAdminCollection(identities.president, collection), true, `${collection} active president`);
    assert.equal(canReadAdminCollection(identities.member, collection), false, `${collection} ordinary member`);
    assert.equal(canReadAdminCollection(identities.mainDirector, collection), false, `${collection} main director`);
    assert.equal(canReadAdminCollection(identities.coDirector, collection), false, `${collection} co-director`);
    assert.equal(canReadAdminCollection(identities.inactiveAdmin, collection), false, `${collection} inactive admin`);
    assert.equal(canReadAdminCollection(identities.rejectedAdmin, collection), false, `${collection} rejected admin`);
    assert.equal(canReadAdminCollection(identities.disabledAdmin, collection), false, `${collection} disabled admin`);
    assert.equal(canReadAdminCollection(identities.removedCwd, collection), false, `${collection} removed cwd`);
    assert.equal(canReadAdminCollection(identities.expiredCwd, collection), false, `${collection} expired cwd`);
    assert.equal(canReadAdminCollection(identities.staleCwdPositionKey, collection), false, `${collection} stale cwd key`);
    assert.equal(canReadAdminCollection(identities.staleCwdOccupancy, collection), false, `${collection} stale cwd occupancy`);
  }

  for (const collection of ['systemLogs', 'auditLogs']) {
    assert.equal(canReadAdminCollection(identities.admin, collection), false, `${collection} remains callable-only`);
    assert.equal(canReadAdminCollection(identities.cwd, collection), false, `${collection} remains callable-only`);
    assert.equal(canReadAdminCollection(identities.member, collection), false, `${collection} ordinary member`);
  }
});
