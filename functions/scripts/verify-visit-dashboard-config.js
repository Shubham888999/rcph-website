'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const positionHelpers = require('../lib/positions');
const dashboards = require('../lib/visit-dashboards');

const repoRoot = path.resolve(__dirname, '..', '..');

function seed() {
  return {
    visitDashboardConfig: {},
    visitDashboardAudit: {},
    visitSubmissionPositions: {
      clubAssembly_president: {
        visitType: 'clubAssembly',
        positionKey: 'president',
        positionTitle: 'President',
        avenueCode: 'PRES',
        enabled: true,
        submissionOpen: true,
        locked: false,
        activeFileCount: 2,
        driveFolderId: 'must-not-leak-folder',
        folderUrl: 'https://drive.google.com/drive/folders/must-not-leak',
      },
      clubAssembly_secretary: {
        visitType: 'clubAssembly',
        positionKey: 'secretary',
        positionTitle: 'Secretary',
        avenueCode: 'SEC',
        enabled: false,
        submissionOpen: false,
        locked: true,
        activeFileCount: 4,
        driveFolderId: 'must-not-leak-folder-2',
      },
      dzrVisit_treasurer: {
        visitType: 'dzrVisit',
        positionKey: 'treasurer',
        positionTitle: 'Treasurer',
        avenueCode: 'TREAS',
        enabled: true,
        submissionOpen: true,
        locked: false,
        activeFileCount: 1,
      },
    },
  };
}

function createEnv(initial = seed()) {
  const adapter = dashboards.createMemoryVisitDashboardAdapter(initial);
  const service = dashboards.createVisitDashboardService({
    adapter,
    positionHelpers,
    assertAdmin: async (uid) => {
      if (uid === 'admin-uid' || uid === 'president-uid') return { uid, role: uid === 'president-uid' ? 'president' : 'admin' };
      const err = new Error('Administrative access required.');
      err.httpsCode = 'permission-denied';
      throw err;
    },
  });
  return { adapter, service };
}

function assertErrorCode(error, code) {
  assert.strictEqual(error?.httpsCode || error?.code, code);
}

async function rejectsWithCode(promiseFactory, code, label) {
  let rejected = false;
  try {
    await promiseFactory();
  } catch (err) {
    rejected = true;
    assertErrorCode(err, code);
  }
  assert.ok(rejected, label || `Expected rejection with ${code}`);
}

function assertNoSensitiveAvailabilityFields(value, pathLabel = 'root') {
  const forbidden = /folder|file|drive|member|treasury|attendance|official|visiblePositionKeys|allowDistrictOfficials/i;
  if (value == null) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitiveAvailabilityFields(item, `${pathLabel}[${index}]`));
    return;
  }
  if (typeof value === 'object') {
    Object.keys(value).forEach((key) => {
      assert.ok(!forbidden.test(key), `Sensitive signup availability key at ${pathLabel}.${key}`);
      assertNoSensitiveAvailabilityFields(value[key], `${pathLabel}.${key}`);
    });
  }
}

function assertVisitRuleDenyBlock(rules, collection) {
  const pattern = new RegExp(
    `match\\s+/${collection}/\\{[^}]+\\}\\s*\\{\\s*allow\\s+read,\\s*write:\\s*if\\s+false;\\s*\\}`,
    'm'
  );
  assert.ok(pattern.test(rules), `${collection} precisely denies direct reads and writes`);
}

(async () => {
  assert.deepStrictEqual(dashboards.VISIT_TYPE_KEYS, ['clubAssembly', 'dzrVisit', 'drrVisit']);
  assert.strictEqual(dashboards.normalizeVisitType('clubAssembly'), 'clubAssembly');
  assert.throws(() => dashboards.normalizeVisitType('unknownVisit'), /Unknown visit type/);

  const defaultConfig = dashboards.buildVisitDashboardDefaultConfig('dzrVisit');
  assert.deepStrictEqual(defaultConfig, {
    visitType: 'dzrVisit',
    visitName: 'DZR Visit',
    enabled: false,
    signupOpen: false,
    dashboardVisible: false,
    officialDisplayNames: [],
    visiblePositionKeys: [],
    allowDistrictOfficials: false,
    updatedAt: null,
    updatedBy: '',
  });

  const normalizedNames = dashboards.normalizeOfficialDisplayNames([
    '  PHF. DRR. Example  ',
    '',
    'PHF. DRR. Example',
    'DZR Name',
    ...Array.from({ length: 20 }, (_, index) => `Official ${index}`),
  ]);
  assert.deepStrictEqual(normalizedNames.slice(0, 2), ['PHF. DRR. Example', 'DZR Name']);
  assert.strictEqual(normalizedNames.length, 12, 'official names are capped');

  assert.deepStrictEqual(
    dashboards.normalizeVisiblePositionKeys([' Secretary ', 'secretary', 'Treasurer'], positionHelpers),
    ['secretary', 'treasurer']
  );
  assert.throws(
    () => dashboards.normalizeVisiblePositionKeys(['not-a-position'], positionHelpers),
    /unknown position/i
  );

  const env = createEnv();
  const configs = await env.service.getConfigs('admin-uid');
  assert.strictEqual(configs.configs.length, 3);
  assert.strictEqual(configs.configs.every(config => config.enabled === false), true);
  await rejectsWithCode(() => env.service.getConfigs('gbm-uid'), 'permission-denied', 'config read is admin-only');

  const unavailable = await env.service.getSignupAvailability();
  assert.deepStrictEqual(unavailable, { ok: true, available: false, visits: [] });
  assertNoSensitiveAvailabilityFields(unavailable);

  const update = await env.service.updateConfig('admin-uid', {
    visitType: 'clubAssembly',
    enabled: true,
    signupOpen: true,
    dashboardVisible: true,
    officialDisplayNames: [' Official One ', '', 'Official Two'],
    visiblePositionKeys: ['secretary', 'president', 'secretary'],
    allowDistrictOfficials: true,
  });
  assert.strictEqual(update.ok, true);
  assert.deepStrictEqual(update.config.officialDisplayNames, ['Official One', 'Official Two']);
  assert.deepStrictEqual(update.config.visiblePositionKeys, ['president', 'secretary']);
  assert.strictEqual(update.config.updatedBy, 'admin-uid');
  assert.deepStrictEqual(
    Object.keys(env.adapter.store.visitDashboardConfig.clubAssembly).sort(),
    [
      'allowDistrictOfficials',
      'dashboardVisible',
      'enabled',
      'officialDisplayNames',
      'signupOpen',
      'updatedAt',
      'updatedBy',
      'visiblePositionKeys',
      'visitType',
    ].sort(),
    'only expected config fields are written'
  );
  assert.ok(Object.keys(env.adapter.store.visitDashboardAudit).length >= 1, 'real update writes audit');

  const available = await env.service.getSignupAvailability();
  assert.deepStrictEqual(available, {
    ok: true,
    available: true,
    visits: [{ visitType: 'clubAssembly', visitName: 'Club Assembly' }],
  });
  assertNoSensitiveAvailabilityFields(available);

  const noopWriteCount = env.adapter.writes.length;
  const noop = await env.service.updateConfig('admin-uid', {
    visitType: 'clubAssembly',
    enabled: true,
  });
  assert.deepStrictEqual(noop.changedFields, [], 'no-op update reports no changed fields');
  assert.strictEqual(env.adapter.writes.length, noopWriteCount, 'no-op update performs no write');

  await rejectsWithCode(
    () => env.service.updateConfig('gbm-uid', { visitType: 'clubAssembly', enabled: false }),
    'permission-denied',
    'ordinary users cannot update config'
  );
  await rejectsWithCode(
    () => env.service.updateConfig('admin-uid', { visitType: 'clubAssembly', visiblePositionKeys: ['editor'] }),
    'failed-precondition',
    'visiblePositionKeys are validated against visitSubmissionPositions when available'
  );
  await rejectsWithCode(
    () => env.service.updateConfig('admin-uid', { visitType: 'unknownVisit', enabled: true }),
    'invalid-argument',
    'unknown visit update rejected'
  );

  const noFolderSeed = seed();
  noFolderSeed.visitSubmissionPositions = {};
  const noFolderEnv = createEnv(noFolderSeed);
  const noFolderUpdate = await noFolderEnv.service.updateConfig('president-uid', {
    visitType: 'drrVisit',
    visiblePositionKeys: ['secretary'],
  });
  assert.deepStrictEqual(noFolderUpdate.config.visiblePositionKeys, ['secretary'], 'folder validation allows canonical keys before visit upload structure exists');

  const folderOptions = await env.service.getFolderOptions('admin-uid', 'clubAssembly');
  assert.strictEqual(folderOptions.visitName, 'Club Assembly');
  assert.deepStrictEqual(folderOptions.folders.map(folder => folder.positionKey).sort(), ['president', 'secretary']);
  folderOptions.folders.forEach((folder) => {
    assert.ok(!Object.prototype.hasOwnProperty.call(folder, 'driveFolderId'), 'folder option hides Drive folder ID');
    assert.ok(!Object.prototype.hasOwnProperty.call(folder, 'folderUrl'), 'folder option hides Drive URL');
  });
  await rejectsWithCode(() => env.service.getFolderOptions('gbm-uid', 'clubAssembly'), 'permission-denied');

  const rules = fs.readFileSync(path.join(repoRoot, 'firestore.rules'), 'utf8');
  assertVisitRuleDenyBlock(rules, 'visitDashboardConfig');
  assertVisitRuleDenyBlock(rules, 'visitDashboardAudit');

  const indexSource = fs.readFileSync(path.join(repoRoot, 'functions', 'index.js'), 'utf8');
  [
    'exports.getVisitDashboardConfigs',
    'exports.getVisitSignupAvailability',
    'exports.updateVisitDashboardConfig',
    'exports.getVisitDashboardFolderOptions',
  ].forEach((exportName) => assert.ok(indexSource.includes(exportName), `${exportName} is exported`));
  assert.ok(!/Firebase Storage|public Drive|anyoneWithLink/i.test(indexSource), 'no storage or public Drive behavior introduced');

  console.log('Visit Dashboard config verification passed.');
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
