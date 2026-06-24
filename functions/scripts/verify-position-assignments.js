'use strict';

const assert = require('assert');
const positions = require('../lib/positions');
const {
  buildPositionSyncPlan,
  resolveRequestedPositionValues,
  buildUserPositionPayload,
  buildMemberPositionPayload,
  buildBodMemberPositionPayload,
  buildAuditPayload,
  uniqueSortedUids,
} = require('../lib/position-assignments');

function assertDeepEqual(actual, expected, message) {
  assert.deepStrictEqual(actual, expected, message);
}

function assertEqual(actual, expected, message) {
  assert.strictEqual(actual, expected, message);
}

function plan(options) {
  return buildPositionSyncPlan({
    targetUid: 'uid-one',
    role: 'bod',
    currentPositionKeys: [],
    requestedPositionKeys: [],
    confirmJointPositionKeys: [],
    currentOccupancies: {},
    ...options,
  }, positions);
}

let result = plan({
  currentPositionKeys: ['secretary'],
  requestedPositionKeys: ['Secretary', 'RRRO', 'secretary'],
  currentOccupancies: {
    secretary: { holderUids: ['uid-one'] },
    rrro: { holderUids: [] },
  },
});
assertEqual(result.ok, true, 'position addition plan should pass');
assertDeepEqual(result.addedPositionKeys, ['rrro'], 'added position should be rrro');
assertDeepEqual(result.removedPositionKeys, [], 'no positions should be removed');
assertDeepEqual(result.newPositionKeys, ['secretary', 'rrro'], 'duplicates should normalize and sort');

assertEqual(plan({ role: 'bod', requestedPositionKeys: [] }).ok, false, 'bod with zero positions fails');
assertEqual(plan({ role: 'admin', requestedPositionKeys: [] }).ok, true, 'admin with zero positions passes');
assertEqual(plan({ role: 'president', requestedPositionKeys: [] }).ok, true, 'president with zero positions passes');
assertEqual(plan({ role: 'gbm', requestedPositionKeys: ['secretary'] }).ok, false, 'gbm with positions fails');

result = plan({
  requestedPositionKeys: ['secretary'],
  currentOccupancies: {
    secretary: { holderUids: ['uid-two'] },
  },
});
assertEqual(result.ok, false, 'unconfirmed joint assignment should fail');
assertEqual(result.code, 'joint-assignment-conflict', 'conflict code should be returned');
assertDeepEqual(result.conflicts[0].existingHolderUids, ['uid-two'], 'conflict should include holder');

result = plan({
  requestedPositionKeys: ['secretary'],
  confirmJointPositionKeys: ['secretary'],
  currentOccupancies: {
    secretary: { holderUids: ['uid-two'] },
  },
});
assertEqual(result.ok, true, 'confirmed joint assignment should pass');
assertDeepEqual(result.nextOccupancies.secretary.holderUids, ['uid-one', 'uid-two'], 'joint holders should be retained and sorted');
assertEqual(result.nextOccupancies.secretary.jointAssignment, true, 'joint assignment should be true with two holders');
assertDeepEqual(result.jointPositionKeys, ['secretary'], 'joint key should be recorded');

result = plan({
  role: 'admin',
  currentPositionKeys: ['secretary'],
  requestedPositionKeys: [],
  currentOccupancies: {
    secretary: { holderUids: ['uid-one', 'uid-two', 'uid-two'] },
  },
});
assertEqual(result.ok, true, 'removing one joint holder should pass');
assertDeepEqual(result.nextOccupancies.secretary.holderUids, ['uid-two'], 'other joint holder should remain');
assertEqual(result.nextOccupancies.secretary.jointAssignment, false, 'joint assignment should become false with one holder');
assertDeepEqual(uniqueSortedUids(['b', 'a', 'b', '', null]), ['a', 'b'], 'UID arrays should remain unique and sorted');

let requested = resolveRequestedPositionValues({
  role: 'bod',
  legacyClubPosition: 'Secretary, RRRO',
  currentPositionKeys: [],
}, positions);
assertDeepEqual(requested.positionKeys, ['secretary', 'rrro'], 'legacy clubPosition should canonicalize');
assertDeepEqual(requested.unknownValues, [], 'known legacy clubPosition should have no unknowns');

requested = resolveRequestedPositionValues({
  role: 'bod',
  legacyClubPosition: 'Unknown Legacy Role',
  currentPositionKeys: [],
}, positions);
assertDeepEqual(requested.positionKeys, [], 'unknown legacy position should not become a key');
assertDeepEqual(requested.unknownValues, ['Unknown Legacy Role'], 'unknown legacy position should be reported');

requested = resolveRequestedPositionValues({
  role: 'bod',
  currentPositionKeys: ['Unknown Combined Position'],
  positionKeysProvided: true,
  positionKeys: ['saa', 'pro'],
}, positions);
assertDeepEqual(requested.positionKeys, ['pro', 'saa'], 'explicit canonical replacement should repair unknown current data');
assertDeepEqual(requested.unknownValues, [], 'explicit canonical replacement should not report old unknown data');
assertEqual(requested.source, 'positionKeys', 'explicit canonical replacement should use positionKeys source');

requested = resolveRequestedPositionValues({
  role: 'bod',
  currentPositionKeys: ['Unknown Old Value'],
  positionKeysProvided: true,
  positionKeys: ['secretary', 'Unknown New Value'],
}, positions);
assertDeepEqual(requested.positionKeys, ['secretary'], 'explicit replacement should preserve known incoming keys');
assertDeepEqual(requested.unknownValues, ['Unknown New Value'], 'explicit replacement should report unknown incoming values');
assertEqual(requested.source, 'positionKeys', 'explicit replacement with unknowns should use positionKeys source');

requested = resolveRequestedPositionValues({
  role: 'admin',
  currentPositionKeys: ['Unknown Old Value'],
  positionKeysProvided: false,
}, positions);
assertDeepEqual(requested.positionKeys, [], 'omitted positions should not preserve unknown current data');
assertDeepEqual(requested.unknownValues, ['Unknown Old Value'], 'omitted positions should report unknown current data');
assertEqual(requested.source, 'currentPositionKeys', 'omitted positions should report currentPositionKeys source');

requested = resolveRequestedPositionValues({
  role: 'admin',
  currentPositionKeys: ['secretary', 'rrro'],
  positionKeysProvided: false,
}, positions);
assertDeepEqual(requested.positionKeys, ['secretary', 'rrro'], 'omitted positions should preserve for compatible role');

requested = resolveRequestedPositionValues({
  role: 'gbm',
  currentPositionKeys: ['secretary', 'rrro'],
  positionKeysProvided: false,
}, positions);
assertDeepEqual(requested.positionKeys, [], 'GBM transition should clear positions when omitted');

const emptyMetadata = positions.derivePositionMetadata([]);
const fullMetadata = positions.derivePositionMetadata(['Secretary', 'RRRO']);
const now = 'NOW';
const profile = { uid: 'uid-one', name: 'Example User', email: 'user@example.com' };
const adminBodPayload = buildBodMemberPositionPayload({
  profile,
  role: 'admin',
  metadata: emptyMetadata,
  existing: {},
  now,
});
assertEqual(adminBodPayload.active, false, 'admin with zero positions should deactivate BOD roster');
assertDeepEqual(adminBodPayload.positionKeys, [], 'inactive BOD roster should have empty position keys');

const bodPayload = buildBodMemberPositionPayload({
  profile,
  role: 'bod',
  metadata: fullMetadata,
  existing: {},
  now,
});
assertEqual(bodPayload.active, true, 'BOD with positions should activate BOD roster');
assertDeepEqual(bodPayload.positionKeys, ['secretary', 'rrro'], 'BOD roster keys should match metadata');

const userPayload = buildUserPositionPayload({
  role: 'bod',
  metadata: fullMetadata,
  actorUid: 'admin-uid',
  now,
});
const memberPayload = buildMemberPositionPayload({
  profile,
  role: 'bod',
  metadata: fullMetadata,
  existing: {},
  now,
});
assertDeepEqual(userPayload.positionKeys, memberPayload.positionKeys, 'user and member payload keys should match');
assertDeepEqual(userPayload.positionTitles, memberPayload.positionTitles, 'user and member titles should match');
assertDeepEqual(userPayload.avenueCodes, memberPayload.avenueCodes, 'user and member avenue codes should match');
assertEqual(memberPayload.position, 'Secretary, Rotary Rotaract Relations Officer', 'member display position should be derived');

const transitionPlan = plan({
  role: 'admin',
  currentPositionKeys: ['secretary'],
  requestedPositionKeys: ['secretary', 'rrro'],
  currentOccupancies: {
    secretary: { holderUids: ['uid-one'] },
    rrro: { holderUids: [] },
  },
});
const auditPayload = buildAuditPayload({
  targetUid: 'uid-one',
  actorUid: 'admin-uid',
  actorRole: 'admin',
  oldRole: 'bod',
  role: 'admin',
  plan: transitionPlan,
  operationSource: 'roleMaintenance',
  now,
});
assertEqual(auditPayload.oldRole, 'bod', 'audit should include old role');
assertEqual(auditPayload.newRole, 'admin', 'audit should include new role');
assertDeepEqual(auditPayload.oldPositionKeys, ['secretary'], 'audit should include old positions');
assertDeepEqual(auditPayload.newPositionKeys, ['secretary', 'rrro'], 'audit should include new positions');
assertDeepEqual(auditPayload.addedPositionKeys, ['rrro'], 'audit should include added positions');

console.log('Position assignment verification passed.');
