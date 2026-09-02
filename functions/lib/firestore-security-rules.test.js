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
  saa: account('saa', 'bod', ['saa']),
  coSaa: account('co-saa', 'bod', ['co-saa']),
  saaAssignmentOnly: account(
  'saa-assignment-only',
  'bod',
  [],
  {
    assignments: ['saa'],
  },
),

coSaaAssignmentOnly: account(
  'co-saa-assignment-only',
  'bod',
  [],
  {
    assignments: ['co-saa'],
  },
),
  inactiveSaa: account('inactive-saa', 'bod', ['saa'], { assignment: { active: false, removedAt: NOW } }),
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
  return hasAnyRole(
    identity,
    ['bod', 'admin', 'president'],
  ) && activePositionAssignment(identity, 'saa');
}

function hasActiveCoSaaAssignment(identity) {
  return hasAnyRole(
    identity,
    ['bod', 'admin', 'president'],
  ) && activePositionAssignment(identity, 'co-saa');
}

function hasActiveSergeantAtArmsAssignment(identity) {
  return hasActiveSaaAssignment(identity) || hasActiveCoSaaAssignment(identity);
}

function isAdmin(identity) {
  return hasApprovedActiveRole(identity, 'admin')
    || hasApprovedActiveRole(identity, 'president')
    || hasPresidentAuthority(identity);
}

function isApprovedBod(identity) {
  return hasApprovedActiveRole(identity, 'bod') || isAdmin(identity);
}

function hasAdminPanelAuthority(identity) {
  return hasApprovedActiveRole(identity, 'admin')
    || hasApprovedActiveRole(identity, 'president')
    || hasPresidentAuthority(identity);
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

function canReadLock(identity, panelId) {
  return hasAdminPanelAuthority(identity)
    || (['attendance', 'bodAttendance'].includes(panelId) && hasActiveSergeantAtArmsAssignment(identity));
}

function canWriteLock(identity) {
  return hasLockTools(identity);
}

function canReadAdminCollection(identity, collection) {
  if (['systemLogs', 'auditLogs'].includes(collection)) return false;
  if (['members', 'events', 'attendance', 'bodMembers', 'bodMeetings', 'bodAttendance', 'districtEvents', 'districtAttendance'].includes(collection)) {
    return isAdmin(identity) || hasActiveSergeantAtArmsAssignment(identity);
  }
  return isAdmin(identity);
}

function canAccessLetterheadExchangeDirectly() {
  return false;
}

function canReadBodEventAttachment(identity) {
  return isApprovedBod(identity);
}

function canWriteBodEventAttachment() {
  return false;
}

function canWriteAdminCollection(identity, collection, panelLocked = false) {
  if (['attendance', 'districtAttendance'].includes(collection)) {
    return (isAdmin(identity) || hasActiveSergeantAtArmsAssignment(identity)) && !panelLocked;
  }
  if (collection === 'bodAttendance') {
    return (isAdmin(identity) || hasActiveSergeantAtArmsAssignment(identity)) && !panelLocked;
  }
  return isAdmin(identity) && !panelLocked;
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
  assert.match(bodyOfFunction(rules, 'validBodAvenueCodes'), /'CWD'/);
  assert.match(bodyOfFunction(rules, 'validBodAvenueCodes'), /'SPORTS'/);
  assert.match(bodyOfFunction(rules, 'validBodAvenueCodes'), /'FINANCE'/);
  assert.match(bodyOfFunction(rules, 'validBodEventWrite'), /data\.avenues\.size\(\) <= 11/);
  assert.match(bodyOfFunction(rules, 'validBodEventWrite'), /validBodFocusAreas\(data\)/);
  assert.match(bodyOfFunction(rules, 'validBodFocusAreaValue'), /Blue Careers - Future jobs beneath the surface/);
  assert.match(rules, /match \/roles\/\{uid\} \{\s*allow get: if signedIn\(\) && \(request\.auth\.uid == uid \|\| isAdmin\(\)\);\s*allow list: if isAdmin\(\);/);
  assert.match(rules, /match \/locks\/\{panelId\} \{\s*allow read: if canReadAttendanceLock\(panelId\) \|\| hasAdminPanelAuthority\(\);\s*allow create, update, delete: if hasLockTools\(\);/);
  assert.match(rules, /match \/letterheadExchanges\/\{exchangeId\} \{\s*allow read, write: if false;\s*\}/);
  assert.match(rules, /match \/letterheadExchangeImageUploadSessions\/\{sessionId\} \{\s*allow read, write: if false;\s*\}/);
  assert.match(rules, /match \/letterheadExchangeImageAccessSessions\/\{sessionId\} \{\s*allow read, write: if false;\s*\}/);
  assert.match(rules, /match \/bodEvents\/\{eventId\} \{[\s\S]*match \/attachments\/\{fileId\} \{[\s\S]*allow read: if isApprovedBod\(\);[\s\S]*allow create, update, delete: if false;/);
    const saaBody = bodyOfFunction(
    rules,
    'hasActiveSaaAssignment',
  );

  const coSaaBody = bodyOfFunction(
    rules,
    'hasActiveCoSaaAssignment',
  );

  assert.match(
    saaBody,
    /hasActivePositionAssignment\(\s*saaAssignmentPath\(\),\s*'saa'\s*\)/,
  );

  assert.match(
    coSaaBody,
    /hasActivePositionAssignment\(\s*coSaaAssignmentPath\(\),\s*'co-saa'\s*\)/,
  );

  assert.doesNotMatch(
    saaBody,
    /positionKeys|userPath/,
  );

  assert.doesNotMatch(
    coSaaBody,
    /positionKeys|userPath/,
  );
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

test('Letterhead Exchanges collection is callable-only through direct Firestore rules', () => {
  for (const identity of [
    identities.unauthenticated,
    identities.member,
    identities.mainDirector,
    identities.admin,
    identities.president,
    identities.cwd,
    identities.saa,
  ]) {
    assert.equal(canAccessLetterheadExchangeDirectly(identity), false);
  }
});

test('BOD event attachments are BOD Tools readable and callable-only for writes', () => {
  for (const identity of [
    identities.mainDirector,
    identities.admin,
    identities.president,
    identities.cwd,
  ]) {
    assert.equal(canReadBodEventAttachment(identity), true);
    assert.equal(canWriteBodEventAttachment(identity), false);
  }

  for (const identity of [
    identities.unauthenticated,
    identities.member,
    identities.inactiveAdmin,
    identities.rejectedAdmin,
    identities.disabledAdmin,
  ]) {
    assert.equal(canReadBodEventAttachment(identity), false);
    assert.equal(canWriteBodEventAttachment(identity), false);
  }
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
  assert.equal(canReadLock(identities.saa, 'attendance'), true);
  assert.equal(canReadLock(identities.coSaa, 'bodAttendance'), true);
  assert.equal(canReadLock(identities.saa, 'treasury'), false);
  assert.equal(canWriteLock(identities.saa), false);
  assert.equal(canWriteLock(identities.coSaa), false);
    for (
    const identity of [
      identities.saaAssignmentOnly,
      identities.coSaaAssignmentOnly,
    ]
  ) {
    assert.equal(
      canReadAdminCollection(
        identity,
        'members',
      ),
      true,
      'active assignment permits member roster read without duplicated user positionKeys',
    );

    assert.equal(
      canReadAdminCollection(
        identity,
        'attendance',
      ),
      true,
      'active assignment permits attendance read without duplicated user positionKeys',
    );

    assert.equal(
      canWriteAdminCollection(
        identity,
        'attendance',
      ),
      true,
      'active assignment permits attendance marking without duplicated user positionKeys',
    );

    assert.equal(
      canReadLock(
        identity,
        'attendance',
      ),
      true,
      'active assignment permits attendance lock read without duplicated user positionKeys',
    );
  }
  assert.equal(canReadLock(identities.inactiveSaa, 'attendance'), false);
});

test('Sergeant-at-Arms and Co-Sergeant-at-Arms rules are scoped to attendance data', () => {
  for (const identity of [identities.saa, identities.coSaa]) {
    for (const collection of ['members', 'events', 'attendance', 'bodMembers', 'bodMeetings', 'bodAttendance', 'districtEvents', 'districtAttendance']) {
      assert.equal(canReadAdminCollection(identity, collection), true, `${collection} delegated read`);
    }

    for (const collection of ['attendance', 'bodAttendance', 'districtAttendance']) {
      assert.equal(canWriteAdminCollection(identity, collection), true, `${collection} delegated write`);
      assert.equal(canWriteAdminCollection(identity, collection, true), false, `${collection} locked delegated write`);
    }

    for (const collection of ['roles', 'users', 'treasury', 'fines', 'reminders', 'systemLogs', 'auditLogs']) {
      assert.equal(canReadAdminCollection(identity, collection), false, `${collection} remains denied`);
      assert.equal(canWriteAdminCollection(identity, collection), false, `${collection} write remains denied`);
    }
  }

  assert.equal(canReadAdminCollection(identities.inactiveSaa, 'attendance'), false, 'inactive SAA read denied');
  assert.equal(canWriteAdminCollection(identities.inactiveSaa, 'attendance'), false, 'inactive SAA write denied');
  assert.equal(canReadAdminCollection(identities.mainDirector, 'attendance'), false, 'plain BOD cannot forge delegated read authority');
  assert.equal(canWriteAdminCollection(identities.mainDirector, 'attendance'), false, 'plain BOD cannot forge delegated write authority');
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
