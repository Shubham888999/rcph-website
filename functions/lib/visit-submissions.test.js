'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  resolveAccessContextFromRecords,
} = require('./visit-submissions');

function assignment(uid, positionKey, overrides = {}) {
  return {
    uid,
    positionKey,
    active: true,
    endedAt: null,
    endedBy: null,
    endReason: null,
    ...overrides,
  };
}

function records({
  uid,
  role = 'bod',
  identityPositionKeys = [],
  assignments = [],
}) {
  return {
    user: {
      uid,
      role,
      status: 'approved',
      active: true,
      positionKeys: identityPositionKeys,
    },

    role: {
      role,
      status: 'approved',
      active: true,
    },

    bodMember: {
      userId: uid,
      active: true,
      positionKeys: identityPositionKeys,
    },

    activePositionAssignments: assignments,
  };
}

test('active SAA assignment grants full Visit manager authority', () => {
  const uid = 'active-saa';

  const access = resolveAccessContextFromRecords(
    uid,
    records({
      uid,
      identityPositionKeys: [],
      assignments: [
        assignment(uid, 'saa'),
      ],
    })
  );

  assert.equal(access.canAccessVisitSystem, true);
  assert.equal(access.canManageVisitSystem, true);
  assert.equal(
    access.authority.hasSergeantAtArmsPosition,
    true
  );
});

test('active Co-SAA assignment grants full Visit manager authority', () => {
  const uid = 'active-co-saa';

  const access = resolveAccessContextFromRecords(
    uid,
    records({
      uid,
      identityPositionKeys: [],
      assignments: [
        assignment(uid, 'co-saa'),
      ],
    })
  );

  assert.equal(access.canAccessVisitSystem, true);
  assert.equal(access.canManageVisitSystem, true);
  assert.equal(
    access.authority.hasSergeantAtArmsPosition,
    true
  );
});

test('stale SAA identity position without assignment does not grant Visit authority', () => {
  const uid = 'stale-saa';

  assert.throws(
    () => resolveAccessContextFromRecords(
      uid,
      records({
        uid,
        identityPositionKeys: ['saa'],
        assignments: [],
      })
    ),
    (err) => err?.code === 'permission-denied'
  );
});

test('ended SAA assignment does not grant Visit authority', () => {
  const uid = 'ended-saa';

  assert.throws(
    () => resolveAccessContextFromRecords(
      uid,
      records({
        uid,
        identityPositionKeys: ['saa'],
        assignments: [
          assignment(uid, 'saa', {
            endedAt: new Date(
              '2026-09-01T00:00:00.000Z'
            ),
          }),
        ],
      })
    ),
    (err) => err?.code === 'permission-denied'
  );
});

test('ordinary BOD assignment gets Visit access but not manager authority', () => {
  const uid = 'ordinary-bod';

  const access = resolveAccessContextFromRecords(
    uid,
    records({
      uid,
      identityPositionKeys: ['csd'],
      assignments: [
        assignment(uid, 'csd'),
      ],
    })
  );

  assert.equal(access.canAccessVisitSystem, true);
  assert.equal(access.canManageVisitSystem, false);
  assert.equal(
    access.authority.hasSergeantAtArmsPosition,
    false
  );
});

test('stored Admin remains Visit manager without an SAA assignment', () => {
  const uid = 'ordinary-admin';

  const access = resolveAccessContextFromRecords(
    uid,
    records({
      uid,
      role: 'admin',
      identityPositionKeys: [],
      assignments: [],
    })
  );

  assert.equal(access.canAccessVisitSystem, true);
  assert.equal(access.canManageVisitSystem, true);
  assert.equal(
    access.authority.hasSergeantAtArmsPosition,
    false
  );
});