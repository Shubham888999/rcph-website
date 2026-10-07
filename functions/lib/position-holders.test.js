'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  FALLBACK_DISPLAY_NAME,
  buildActivePositionHolders,
  getActivePositionHolders,
  holdersForPosition,
  personKeyForUid,
} = require('./position-holders');

function assignment(uid, positionKey, overrides = {}) {
  return { id: `${positionKey}_${uid}`, data: { uid, positionKey, active: true, status: 'active', ...overrides } };
}

function user(name, overrides = {}) {
  return { name, status: 'approved', active: true, ...overrides };
}

function build(assignments, users, bodMembers = {}) {
  return buildActivePositionHolders({
    assignments,
    users: new Map(Object.entries(users)),
    bodMembers: new Map(Object.entries(bodMembers)),
    now: 1_800_000_000_000,
  });
}

test('personKey is an opaque 16-hex hash that never contains the uid', () => {
  const key = personKeyForUid('uid-secret-123');
  assert.match(key, /^[0-9a-f]{16}$/);
  assert.equal(key, personKeyForUid('uid-secret-123'), 'stable for the same uid');
  assert.notEqual(key, personKeyForUid('uid-secret-124'));
  assert.equal(key.includes('uid-secret'), false);
});

test('single holder resolves with a Rtr. display name', () => {
  const holders = build([assignment('u1', 'pro')], { u1: user('Yashali Shirodkar') });
  assert.deepEqual(holdersForPosition(holders, 'pro'), [
    { personKey: personKeyForUid('u1'), displayName: 'Rtr. Yashali Shirodkar' },
  ]);
  assert.equal(JSON.stringify([...holders.values()]).includes('u1'), false, 'uid is not exposed');
});

test('existing Rtr. prefix is not doubled', () => {
  const holders = build([assignment('u1', 'pro')], { u1: user('Rtr. Yashali Shirodkar') });
  assert.equal(holdersForPosition(holders, 'pro')[0].displayName, 'Rtr. Yashali Shirodkar');
});

test('joint position lists every active holder sorted by display name', () => {
  const holders = build(
    [assignment('u2', 'secretary'), assignment('u1', 'secretary')],
    { u1: user('Zara Patil'), u2: user('Aditya Rao') },
  );
  assert.deepEqual(holdersForPosition(holders, 'secretary').map(holder => holder.displayName), [
    'Rtr. Aditya Rao',
    'Rtr. Zara Patil',
  ]);
});

test('a person holding several positions appears under each with the same personKey', () => {
  const holders = build(
    [assignment('u1', 'cmd'), assignment('u1', 'dei')],
    { u1: user('Tanishka Patekar') },
  );
  assert.deepEqual(holdersForPosition(holders, 'cmd'), holdersForPosition(holders, 'dei'));
  assert.equal(holdersForPosition(holders, 'cmd')[0].personKey, personKeyForUid('u1'));
});

test('inactive, ended, removed and expired assignments are excluded', () => {
  const holders = build([
    assignment('u1', 'csd', { active: false }),
    assignment('u2', 'cmd', { endedAt: '2026-01-01T00:00:00Z' }),
    assignment('u3', 'isd', { removed: true }),
    assignment('u4', 'pdd', { expiresAtMillis: 1 }),
    assignment('u5', 'rrro', { status: 'historical' }),
  ], {
    u1: user('One'), u2: user('Two'), u3: user('Three'), u4: user('Four'), u5: user('Five'),
  });
  assert.equal(holders.size, 0);
  assert.deepEqual(holdersForPosition(holders, 'csd'), [], 'vacant position returns an empty array');
});

test('removed, inactive, unapproved or missing profiles are excluded', () => {
  const holders = build([
    assignment('u1', 'csd'),
    assignment('u2', 'cmd'),
    assignment('u3', 'isd'),
    assignment('u4', 'pdd'),
  ], {
    u1: user('Removed', { status: 'removed', removed: true, active: false }),
    u2: user('Inactive', { active: false }),
    u3: user('Pending', { status: 'pending' }),
  });
  assert.equal(holders.size, 0);
});

test('assignments whose uid does not match the stored uid field are ignored', () => {
  const holders = build([{ id: 'pro_u1', data: { positionKey: 'pro', active: true } }], { u1: user('Someone') });
  assert.equal(holders.size, 0);
});

test('missing name falls back to bodMembers name, then to Rtr. Member', () => {
  const holders = build(
    [assignment('u1', 'pro'), assignment('u2', 'editor')],
    { u1: user(''), u2: user('   ') },
    { u1: { name: 'Board Name' } },
  );
  assert.equal(holdersForPosition(holders, 'pro')[0].displayName, 'Rtr. Board Name');
  assert.equal(holdersForPosition(holders, 'editor')[0].displayName, FALLBACK_DISPLAY_NAME);
  assert.equal(FALLBACK_DISPLAY_NAME, 'Rtr. Member');
});

test('duplicate assignment rows for the same person and position collapse', () => {
  const holders = build(
    [assignment('u1', 'pro'), { id: 'dup', data: { uid: 'u1', positionKey: 'pro', active: true } }],
    { u1: user('Solo') },
  );
  assert.equal(holdersForPosition(holders, 'pro').length, 1);
});

test('getActivePositionHolders reads assignments once and profiles by id', async () => {
  const calls = [];
  const adapter = {
    async queryActivePositionAssignments() {
      calls.push('assignments');
      return [assignment('u1', 'pid'), assignment('u1', 'mdo')];
    },
    async getDocsByIds(collection, ids) {
      calls.push(`${collection}:${ids.join(',')}`);
      return new Map(ids.map(id => [id, collection === 'users' ? user('Anish Abhijit Joglekar') : null]));
    },
  };
  const holders = await getActivePositionHolders(adapter);
  assert.deepEqual(calls.sort(), ['assignments', 'bodMembers:u1', 'users:u1']);
  assert.equal(holdersForPosition(holders, 'pid')[0].displayName, 'Rtr. Anish Abhijit Joglekar');
  assert.equal(holdersForPosition(holders, 'mdo')[0].displayName, 'Rtr. Anish Abhijit Joglekar');
});

test('getActivePositionHolders skips profile reads when nobody holds a position', async () => {
  let profileReads = 0;
  const holders = await getActivePositionHolders({
    async queryActivePositionAssignments() { return []; },
    async getDocsByIds() { profileReads += 1; return new Map(); },
  });
  assert.equal(holders.size, 0);
  assert.equal(profileReads, 0);
});
