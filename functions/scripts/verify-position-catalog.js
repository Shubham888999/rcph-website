'use strict';

const assert = require('assert');
const {
  POSITION_CATALOG,
  POSITION_KEYS,
  normalizePositionKey,
  normalizePositionKeys,
  getPositionDefinition,
  derivePositionMetadata,
  validateRolePositionCombination,
  resolvePositionKeysFromRecords,
  buildPresidentAuthority,
  WEBSITE_DIRECTOR_POSITION_KEY,
} = require('../lib/positions');

function assertDeepEqual(actual, expected, message) {
  assert.deepStrictEqual(actual, expected, message);
}

function assertEqual(actual, expected, message) {
  assert.strictEqual(actual, expected, message);
}

assertEqual(POSITION_KEYS.length, 19, 'catalog should contain 19 positions');
assertEqual(new Set(POSITION_KEYS).size, POSITION_KEYS.length, 'catalog keys should be unique');

const sortOrders = POSITION_KEYS.map((key) => POSITION_CATALOG[key].sortOrder);
assertEqual(new Set(sortOrders).size, sortOrders.length, 'sort orders should be unique');

for (const key of POSITION_KEYS) {
  const definition = POSITION_CATALOG[key];
  assertEqual(normalizePositionKey(key), key, `${key} should resolve to itself`);
  assert.ok(definition.avenueCode, `${key} should have an avenue code`);
  assert.ok(definition.active === true, `${key} should be active by default`);
  assert.ok(Object.isFrozen(definition), `${key} definition should be frozen`);

  for (const alias of definition.aliases) {
    assertEqual(normalizePositionKey(alias), key, `${alias} should resolve to ${key}`);
  }

  const returnedDefinition = getPositionDefinition(key);
  returnedDefinition.aliases.push('mutated');
  assert.ok(!POSITION_CATALOG[key].aliases.includes('mutated'), 'definition helper should return fresh aliases');
}

assertEqual(normalizePositionKey('ISD'), 'isd');
assertEqual(normalizePositionKey('International Service Director'), 'isd');
assertEqual(normalizePositionKey('Vice-President'), 'vice-president');
assertEqual(normalizePositionKey(' Immediate Past President '), 'immediate-past-president');
assertEqual(normalizePositionKey("Women's Representative"), 'wr');
assertEqual(normalizePositionKey('World Rotaract Week Chairperson'), 'wrwc');
assertEqual(normalizePositionKey('unknown title'), null);

assertEqual(normalizePositionKey('PDD'), 'pdd');
assertEqual(normalizePositionKey('IPP'), 'immediate-past-president');
assert.notStrictEqual(normalizePositionKey('PDD'), normalizePositionKey('IPP'), 'PDD and IPP must remain separate');

assertEqual(normalizePositionKey('WRWC'), 'wrwc');
assertEqual(normalizePositionKey('WR'), 'wr');
assert.notStrictEqual(normalizePositionKey('WRWC'), normalizePositionKey('WR'), 'WRWC and WR must remain separate');

assertDeepEqual(
  normalizePositionKeys(['RRRO', 'Secretary', 'secretary', 'unknown']).positionKeys,
  ['secretary', 'rrro'],
  'duplicates should be removed and keys sorted'
);
assertDeepEqual(
  normalizePositionKeys('Secretary, RRRO, Mystery'),
  { positionKeys: ['secretary', 'rrro'], unknownValues: ['Mystery'] },
  'legacy comma-separated input should resolve with unknown reporting'
);

const metadata = derivePositionMetadata(['rrro', 'secretary']);
assertDeepEqual(metadata.positionKeys, ['secretary', 'rrro']);
assertDeepEqual(metadata.positionTitles, ['Secretary', 'Rotary Rotaract Relations Officer']);
assertDeepEqual(metadata.avenueCodes, ['SEC', 'RRRO']);
assertEqual(metadata.clubPosition, 'Secretary, Rotary Rotaract Relations Officer');
assertEqual(metadata.hasBodPosition, true);

assertEqual(validateRolePositionCombination('bod', []).ok, false, 'bod with zero positions should fail');
assertEqual(validateRolePositionCombination('bod', ['secretary']).ok, true, 'bod with one position should pass');
assertEqual(validateRolePositionCombination('bod', ['Secretary', 'RRRO']).ok, true, 'bod with multiple positions should pass');
assertEqual(validateRolePositionCombination('admin', []).ok, true, 'admin with zero positions should pass');
assertEqual(validateRolePositionCombination('president', []).ok, true, 'president with zero positions should pass');
assertEqual(validateRolePositionCombination('gbm', ['secretary']).ok, false, 'gbm with positions should fail');
assertEqual(validateRolePositionCombination('unknown-role', []).ok, false, 'unknown role should fail');
assertEqual(validateRolePositionCombination('bod', ['unknown']).code, 'unknown-position', 'unknown positions should fail validation');
assertEqual(WEBSITE_DIRECTOR_POSITION_KEY, 'cwd', 'Website Director authority key should be cwd');
assertEqual(buildPresidentAuthority('president', []).hasPresidentAuthority, true, 'President role has President authority');
assertEqual(buildPresidentAuthority('admin', ['cwd']).hasPresidentAuthority, true, 'Admin plus cwd has President authority');
assertEqual(buildPresidentAuthority('bod', ['cwd']).hasPresidentAuthority, true, 'BOD plus cwd has President authority');
assertEqual(buildPresidentAuthority('admin', []).hasPresidentAuthority, false, 'Admin without cwd has no President authority');
assertEqual(buildPresidentAuthority('bod', ['secretary']).hasPresidentAuthority, false, 'BOD without cwd has no President authority');
assertEqual(buildPresidentAuthority('gbm', ['cwd']).hasPresidentAuthority, false, 'GBM cannot gain President authority from cwd-like data');
assertDeepEqual(derivePositionMetadata(['cwd']).positionTitles, ['Website Director'], 'cwd displays as Website Director');

assertDeepEqual(
  resolvePositionKeysFromRecords({
    users: { positionKeys: ['rrro', 'Secretary'] },
    bodMembers: { userId: 'uid', positionKeys: ['pdd'] },
  }),
  {
    positionKeys: ['secretary', 'rrro'],
    source: 'users.positionKeys',
    unknownValues: [],
    warnings: [],
  },
  'resolver should prefer users.positionKeys'
);

assertDeepEqual(
  resolvePositionKeysFromRecords({
    users: { clubPosition: 'Secretary, RRRO' },
  }).positionKeys,
  ['secretary', 'rrro'],
  'resolver should canonicalize legacy users.clubPosition'
);

const skippedBod = resolvePositionKeysFromRecords({
  bodMembers: { position: 'Secretary' },
});
assertDeepEqual(skippedBod.positionKeys, [], 'generated/non-linked bodMembers record should not authorize');
assert.ok(skippedBod.warnings.length > 0, 'skipped generated/non-linked bodMembers record should warn');

const skippedMember = resolvePositionKeysFromRecords({
  members: { position: 'Secretary' },
});
assertDeepEqual(skippedMember.positionKeys, [], 'generated/non-linked members record should not authorize');
assert.ok(skippedMember.warnings.length > 0, 'skipped generated/non-linked members record should warn');

assertDeepEqual(
  resolvePositionKeysFromRecords({
    members: {
      userId: 'uid-one',
      positionKeys: ['Secretary', 'RRRO'],
    },
  }).positionKeys,
  ['secretary', 'rrro'],
  'UID-linked members.positionKeys should resolve'
);

assertDeepEqual(
  resolvePositionKeysFromRecords({
    members: {
      userId: 'uid-one',
      position: 'Secretary, RRRO',
    },
  }).positionKeys,
  ['secretary', 'rrro'],
  'UID-linked members.position should resolve'
);

assertDeepEqual(
  resolvePositionKeysFromRecords({
    bodMembers: { userId: 'uid-one', position: 'Secretary, Mystery' },
  }),
  {
    positionKeys: ['secretary'],
    source: 'bodMembers.position',
    unknownValues: ['Mystery'],
    warnings: [],
  },
  'UID-linked bodMembers legacy position should resolve and report unknowns'
);

console.log(`Position catalog verification passed for ${POSITION_KEYS.length} positions.`);
