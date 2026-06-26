const assert = require('assert');
const positions = require('../admin/js/admin-positions.js');

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`not ok - ${name}`);
    throw err;
  }
}

test('grouped catalog contains 19 positions', () => {
  assert.strictEqual(positions.POSITION_CATALOG.length, 19);
  assert.strictEqual(positions.POSITION_GROUPS.length, 3);
});

test('search by title works', () => {
  const results = positions.searchPositions('International Service');
  assert.deepStrictEqual(results.map(item => item.key), ['isd']);
});

test('search by avenue code works', () => {
  const results = positions.searchPositions('WRWC');
  assert.deepStrictEqual(results.map(item => item.key), ['wrwc']);
});

test('Website Director remains a distinct active position', () => {
  const websiteDirector = positions.POSITION_CATALOG.find(item => item.key === 'cwd');
  assert(websiteDirector, 'cwd exists in frontend catalog');
  assert.strictEqual(websiteDirector.displayTitle, 'Website Director');
  assert.strictEqual(websiteDirector.active, true);
  assert(!positions.formatPositionSummary(['cwd']).includes('President'));
});

test('selected keys are deduplicated', () => {
  assert.deepStrictEqual(
    positions.sortPositionKeys(['rrro', 'secretary', 'rrro']),
    ['secretary', 'rrro']
  );
});

test('selected keys preserve catalog order', () => {
  assert.deepStrictEqual(
    positions.sortPositionKeys(['saa', 'president', 'pro']),
    ['president', 'pro', 'saa']
  );
});

test('President transition defaults to president', () => {
  const result = positions.applyRoleTransition({
    previousRole: 'admin',
    nextRole: 'president',
    selectedKeys: [],
    presidentDefaultApplied: false
  });
  assert.deepStrictEqual(result.positionKeys, ['president']);
});

test('rerendering President does not force re-selection', () => {
  const result = positions.applyRoleTransition({
    previousRole: 'president',
    nextRole: 'president',
    selectedKeys: [],
    presidentDefaultApplied: true
  });
  assert.deepStrictEqual(result.positionKeys, []);
});

test('GBM clears positions', () => {
  const result = positions.applyRoleTransition({
    previousRole: 'bod',
    nextRole: 'gbm',
    selectedKeys: ['secretary']
  });
  assert.deepStrictEqual(result.positionKeys, []);
  assert.strictEqual(result.disabled, true);
});

test('BOD with zero positions fails client validation', () => {
  const result = positions.validateRolePositions('bod', []);
  assert.strictEqual(result.ok, false);
});

test('Admin with zero positions passes', () => {
  const result = positions.validateRolePositions('admin', []);
  assert.strictEqual(result.ok, true);
});

test('conflict keys are extracted safely', () => {
  const result = positions.extractConflictKeys({
    code: 'joint-assignment-conflict',
    conflicts: [
      { positionKey: 'rrro' },
      { positionKey: 'secretary' },
      { positionKey: 'rrro' }
    ]
  });
  assert.deepStrictEqual(result, ['secretary', 'rrro']);
});

test('retry payload adds only confirmed conflict keys', () => {
  const result = positions.buildJointRetryPayload({
    targetUid: 'uid-one',
    role: 'bod',
    positionKeys: ['rrro', 'secretary'],
    confirmJointPositionKeys: ['secretary']
  }, ['rrro', 'secretary']);
  assert.deepStrictEqual(result.positionKeys, ['secretary', 'rrro']);
  assert.deepStrictEqual(result.confirmJointPositionKeys, ['secretary', 'rrro']);
});

test('legacy exact titles map correctly', () => {
  const result = positions.mapLegacyPositionText('Secretary, RRRO');
  assert.deepStrictEqual(result.positionKeys, ['secretary', 'rrro']);
  assert.deepStrictEqual(result.unknownValues, []);
});

test('unknown legacy combined title is reported, not guessed', () => {
  const result = positions.mapLegacyPositionText('Sergeant-at-Arms & Public Relations Officer');
  assert.deepStrictEqual(result.positionKeys, []);
  assert.deepStrictEqual(result.unknownValues, ['Sergeant-at-Arms & Public Relations Officer']);
});

console.log('Admin position UI helper verification passed.');
