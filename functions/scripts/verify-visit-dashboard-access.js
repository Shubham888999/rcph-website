'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const positionHelpers = require('../lib/positions');
const dashboards = require('../lib/visit-dashboards');

const repoRoot = path.resolve(__dirname, '..', '..');

function createService(configs) {
  return dashboards.createVisitDashboardService({
    adapter: dashboards.createMemoryVisitDashboardAdapter({
      visitDashboardConfig: configs,
    }),
    positionHelpers,
  });
}

function assertNoSensitiveFields(value, pathLabel = 'root') {
  const forbidden = /folder|file|drive|attendance|treasury|member|visiblePositionKeys|allowDistrictOfficials|officialDisplayNames/i;
  if (value == null) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitiveFields(item, `${pathLabel}[${index}]`));
    return;
  }
  if (typeof value === 'object') {
    Object.keys(value).forEach((key) => {
      assert.ok(!forbidden.test(key), `Sensitive access key at ${pathLabel}.${key}`);
      assertNoSensitiveFields(value[key], `${pathLabel}.${key}`);
    });
  }
}

function visibleConfig(visitType, extras = {}) {
  return {
    visitType,
    enabled: true,
    dashboardVisible: true,
    signupOpen: true,
    officialDisplayNames: ['Should Not Leak'],
    visiblePositionKeys: ['secretary'],
    allowDistrictOfficials: false,
    driveFolderId: 'must-not-leak',
    folderUrl: 'https://drive.google.com/drive/folders/must-not-leak',
    attendance: { must: 'not leak' },
    treasury: { must: 'not leak' },
    members: [{ name: 'Must Not Leak' }],
    ...extras,
  };
}

(async () => {
  assert.deepEqual(dashboards.VISIT_DASHBOARD_PATHS, {
    clubAssembly: '/visits/club-assembly',
    dzrVisit: '/visits/dzr-visit',
    drrVisit: '/visits/drr-visit',
  });

  const service = createService({
    clubAssembly: visibleConfig('clubAssembly', { allowDistrictOfficials: true }),
    dzrVisit: visibleConfig('dzrVisit'),
    drrVisit: visibleConfig('drrVisit', { enabled: false, allowDistrictOfficials: true }),
  });

  const districtDefault = await service.getAccessForRole({
    role: 'district-official',
    roleData: { role: 'districtOfficial', status: 'approved' },
  });
  assert.equal(districtDefault.canAccessVisitDashboards, true);
  assert.deepEqual(districtDefault.visitDashboardAccess, {
    clubAssembly: true,
    dzrVisit: false,
    drrVisit: false,
  });
  assert.deepEqual(districtDefault.visitDashboardEntries, [{
    visitType: 'clubAssembly',
    visitName: 'Club Assembly',
    path: '/visits/club-assembly',
  }]);
  assertNoSensitiveFields(districtDefault);

  const districtOverride = await service.getAccessForRole({
    role: 'districtOfficial',
    roleData: {
      role: 'districtOfficial',
      status: 'approved',
      visitAccess: {
        clubAssembly: false,
        dzrVisit: true,
        drrVisit: true,
      },
    },
  });
  assert.equal(districtOverride.canAccessVisitDashboards, true);
  assert.deepEqual(districtOverride.visitDashboardAccess, {
    clubAssembly: false,
    dzrVisit: true,
    drrVisit: false,
  });
  assert.deepEqual(districtOverride.visitDashboardEntries.map(entry => entry.visitType), ['dzrVisit']);
  assertNoSensitiveFields(districtOverride);

  const hiddenService = createService({
    clubAssembly: visibleConfig('clubAssembly', { dashboardVisible: false, allowDistrictOfficials: true }),
    dzrVisit: visibleConfig('dzrVisit', { enabled: false, allowDistrictOfficials: true }),
    drrVisit: visibleConfig('drrVisit', { dashboardVisible: false, allowDistrictOfficials: true }),
  });
  const hiddenDistrict = await hiddenService.getAccessForRole({
    role: 'districtOfficial',
    roleData: { visitAccess: { clubAssembly: true, dzrVisit: true, drrVisit: true } },
  });
  assert.equal(hiddenDistrict.canAccessVisitDashboards, false);
  assert.deepEqual(hiddenDistrict.visitDashboardEntries, []);

  for (const role of ['admin', 'bod', 'president']) {
    const access = await service.getAccessForRole({ role, roleData: { role, status: 'approved' } });
    assert.equal(access.canAccessVisitDashboards, true);
    assert.deepEqual(access.visitDashboardAccess, {
      clubAssembly: true,
      dzrVisit: true,
      drrVisit: false,
    });
    assert.deepEqual(access.visitDashboardEntries.map(entry => entry.path), ['/visits/club-assembly', '/visits/dzr-visit']);
    assertNoSensitiveFields(access);
  }

  for (const role of ['gbm', 'prospect', '', 'pending']) {
    const access = await service.getAccessForRole({ role, roleData: { role, status: 'approved' } });
    assert.equal(access.canAccessVisitDashboards, false);
    assert.deepEqual(access.visitDashboardAccess, {
      clubAssembly: false,
      dzrVisit: false,
      drrVisit: false,
    });
    assert.deepEqual(access.visitDashboardEntries, []);
  }

  const indexSource = fs.readFileSync(path.join(repoRoot, 'functions', 'index.js'), 'utf8');
  const getMyAccessBlock = indexSource.slice(
    indexSource.indexOf('exports.getMyAccess = onCall'),
    indexSource.indexOf('exports.getProspectManagementData = onCall')
  );
  assert.match(getMyAccessBlock, /visitDashboards\.getAccessForRole\(\{ role, roleData \}\)/, 'getMyAccess loads safe visit dashboard access');
  assert.match(getMyAccessBlock, /\.\.\.visitDashboardAccess/, 'getMyAccess returns the safe visit dashboard fields');
  assert.doesNotMatch(getMyAccessBlock, /getFolderOptions|visitSubmissionPositions|drive|folder|attendance|treasury|members/i, 'getMyAccess does not read or return sensitive visit dashboard data');

  console.log('Visit Dashboard access verification passed.');
})().catch((err) => {
  console.error('Visit Dashboard access verification failed.');
  console.error(err);
  process.exitCode = 1;
});
