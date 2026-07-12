'use strict';

const assert = require('assert');
const {
  POSITION_CATALOG,
  POSITION_KEYS,
  ADMIN_POSITION_KEYS,
  BOD_POSITION_KEYS,
  CO_ADMIN_POSITION_KEYS,
  CO_BOD_POSITION_KEYS,
  normalizePositionKey,
  normalizePositionKeys,
  getPositionDefinition,
  isResolutionVoterPosition,
  hasResolutionVoterPosition,
  effectiveRoleForPosition,
  deriveEffectiveRole,
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

assertEqual(POSITION_KEYS.length, 38, 'catalog should contain 38 positions');
assertEqual(new Set(POSITION_KEYS).size, POSITION_KEYS.length, 'catalog keys should be unique');
assertDeepEqual(ADMIN_POSITION_KEYS, ['president', 'immediate-past-president', 'vice-president', 'secretary', 'joint-secretary', 'treasurer', 'club-advisor'], 'admin position group should be explicit');
assertDeepEqual(BOD_POSITION_KEYS, ['csd', 'cmd', 'isd', 'pdd', 'rrro', 'pro', 'dei', 'editor', 'cwd', 'sports-representative', 'wrwc', 'wr', 'saa'], 'bod position group should be explicit');
assertDeepEqual(CO_ADMIN_POSITION_KEYS, ['co-president', 'co-vice-president', 'co-secretary', 'co-treasurer', 'co-club-advisor'], 'co-admin position group should be explicit');
assertDeepEqual(CO_BOD_POSITION_KEYS, ['co-csd', 'co-cmd', 'co-isd', 'co-pdd', 'co-rrro', 'co-pro', 'co-dei', 'co-editor', 'co-cwd', 'co-sports-representative', 'co-wrwc', 'co-wr', 'co-saa'], 'co-bod position group should be explicit');

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
assertEqual(normalizePositionKey('Club Advisor'), 'club-advisor', 'Club Advisor should resolve');
assertEqual(normalizePositionKey('Co-Secretary'), 'co-secretary', 'Co-Secretary should resolve');
assertEqual(normalizePositionKey('Co-Website Director'), 'co-cwd', 'Co-Website Director should resolve');

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
assertEqual(metadata.effectiveRole, 'admin');
assertEqual(effectiveRoleForPosition('club-advisor'), 'admin', 'Club Advisor maps to admin');
assertEqual(effectiveRoleForPosition('co-secretary'), 'admin', 'Co-Secretary maps to admin');
assertEqual(effectiveRoleForPosition('co-cwd'), 'bod', 'Co-Website Director maps to bod');
assertEqual(effectiveRoleForPosition('co-president'), 'admin', 'Co-President maps to admin, not president');
CO_ADMIN_POSITION_KEYS.forEach(key => assertEqual(effectiveRoleForPosition(key), 'admin', `${key} maps to admin`));
CO_BOD_POSITION_KEYS.forEach(key => assertEqual(effectiveRoleForPosition(key), 'bod', `${key} maps to bod`));
assertEqual(deriveEffectiveRole(['co-secretary', 'co-cmd']), 'admin', 'co-admin plus co-bod resolves admin');
assertEqual(deriveEffectiveRole(['co-cmd'], 'gbm'), 'bod', 'GBM plus co-bod resolves bod');
assertEqual(deriveEffectiveRole(['president', 'co-secretary']), 'president', 'President precedence remains');
assertEqual(derivePositionMetadata(['club-advisor']).hasBodPosition, true, 'Club Advisor creates BOD roster access');
assertEqual(derivePositionMetadata(['club-advisor']).isResolutionVoter, true, 'Club Advisor is Resolution-voter eligible');
assertEqual(derivePositionMetadata(['co-club-advisor']).hasBodPosition, true, 'Co-Club Advisor creates BOD roster access');
assertEqual(derivePositionMetadata(['co-club-advisor']).isResolutionVoter, true, 'Co-Club Advisor is Resolution-voter eligible');
assertEqual(derivePositionMetadata(['co-cwd']).hasBodPosition, true, 'Co-BOD positions create BOD roster access');
assertEqual(derivePositionMetadata([]).isResolutionVoter, false, 'Admin role alone is not a Resolution voter without an eligible position');
ADMIN_POSITION_KEYS.concat(CO_ADMIN_POSITION_KEYS, BOD_POSITION_KEYS, CO_BOD_POSITION_KEYS).forEach(key => {
  const definition = getPositionDefinition(key);
  assertEqual(definition.bodRoster, true, `${key} is in the BOD roster`);
  assertEqual(definition.resolutionVoter, true, `${key} is marked as a Resolution voter`);
  assertEqual(isResolutionVoterPosition(key), true, `${key} is Resolution-voter eligible`);
});
assertEqual(hasResolutionVoterPosition(['gbm', 'co-cwd']), true, 'multiple positions are eligible when any position is a Resolution voter');
assertEqual(hasResolutionVoterPosition([]), false, 'no position means no Resolution voter eligibility');

assertEqual(validateRolePositionCombination('bod', []).ok, false, 'bod with zero positions should fail');
assertEqual(validateRolePositionCombination('bod', ['secretary']).normalizedRole, 'admin', 'Secretary position derives admin');
assertEqual(validateRolePositionCombination('bod', ['Secretary', 'RRRO']).normalizedRole, 'admin', 'Admin plus BOD position remains admin');
assertEqual(validateRolePositionCombination('gbm', ['co-cmd']).normalizedRole, 'bod', 'GBM plus co-bod derives bod');
assertEqual(validateRolePositionCombination('admin', ['co-cwd']).normalizedRole, 'bod', 'client cannot force admin from only co-bod positions');
assertEqual(validateRolePositionCombination('admin', []).ok, true, 'admin with zero positions should pass');
assertEqual(validateRolePositionCombination('president', []).ok, true, 'president with zero positions should pass');
assertEqual(validateRolePositionCombination('gbm', ['secretary']).normalizedRole, 'admin', 'gbm with admin position derives admin');
assertEqual(validateRolePositionCombination('unknown-role', []).ok, false, 'unknown role should fail');
assertEqual(validateRolePositionCombination('bod', ['unknown']).code, 'unknown-position', 'unknown positions should fail validation');
assertEqual(WEBSITE_DIRECTOR_POSITION_KEY, 'cwd', 'Website Director authority key should be cwd');
assertEqual(buildPresidentAuthority('president', []).hasPresidentAuthority, true, 'President role has President authority');
assertEqual(buildPresidentAuthority('admin', ['cwd']).hasPresidentAuthority, true, 'Admin plus cwd has President authority');
assertEqual(buildPresidentAuthority('bod', ['cwd']).hasPresidentAuthority, true, 'BOD plus cwd has President authority');
assertEqual(buildPresidentAuthority('admin', []).hasPresidentAuthority, false, 'Admin without cwd has no President authority');
assertEqual(buildPresidentAuthority('admin', ['co-president']).hasPresidentAuthority, false, 'Co-President does not grant President authority');
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
