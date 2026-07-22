'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const positionHelpers = require('../lib/positions');
const {
  REPORTABLE_AVENUE_CODES,
  buildSafeAvenueDirectorRows,
  isReportAvenueDirectorAssignment,
  normalizeReportAvenueCode,
} = require('../lib/bod-avenue-report');

function maps(overrides = {}) {
  return {
    usersByUid: new Map([['u1', { name: 'Director One', status: 'approved', active: true, positionKeys: ['cmd'] }]]),
    rolesByUid: new Map([['u1', { role: 'bod', status: 'approved' }]]),
    ...overrides,
  };
}

const active = { uid: 'u1', positionKey: 'cmd', displayTitle: 'Community Service Director', active: true };
assert.equal(normalizeReportAvenueCode(' cmd '), 'CMD');
assert.equal(normalizeReportAvenueCode('unknown'), '');
assert.deepEqual(REPORTABLE_AVENUE_CODES, ['ISD', 'CMD', 'CSD', 'PDD', 'RRRO', 'PRO', 'DEI', 'GBM']);
assert.deepEqual(buildSafeAvenueDirectorRows({ avenueCode: 'CMD', assignments: [active], positionHelpers, ...maps() }), [
  { name: 'Rtr. Director One', positionTitle: 'Community Service Director' },
]);
assert.deepEqual(buildSafeAvenueDirectorRows({ avenueCode: 'ISD', assignments: [active], positionHelpers, ...maps() }), []);
assert.deepEqual(buildSafeAvenueDirectorRows({ avenueCode: 'CMD', assignments: [{ ...active, active: false }], positionHelpers, ...maps() }), []);
assert.deepEqual(buildSafeAvenueDirectorRows({ avenueCode: 'CMD', assignments: [active], positionHelpers, ...maps({ usersByUid: new Map([['u1', { name: 'Director One', status: 'rejected', active: true, positionKeys: ['cmd'] }]]) }) }), []);
assert.deepEqual(buildSafeAvenueDirectorRows({ avenueCode: 'CMD', assignments: [active], positionHelpers, ...maps({ rolesByUid: new Map([['u1', { role: 'gbm', status: 'approved' }]]) }) }), []);
assert.equal(buildSafeAvenueDirectorRows({ avenueCode: 'CMD', assignments: [active, { ...active }], positionHelpers, ...maps() }).length, 1);
assert.equal(Object.hasOwn(buildSafeAvenueDirectorRows({ avenueCode: 'CMD', assignments: [active], positionHelpers, ...maps() })[0], 'uid'), false);
const clubServiceAssignments = [
  { uid: 'csd-main', positionKey: 'csd', displayTitle: 'Club Service Director', active: true },
  { uid: 'csd-co', positionKey: 'co-csd', displayTitle: 'Co-Club Service Director', active: true },
];
const clubServiceMaps = maps({
  usersByUid: new Map([
    ['csd-main', { name: 'Zara Main', status: 'approved', active: true, positionKeys: ['csd'] }],
    ['csd-co', { name: 'Aarya Co', status: 'approved', active: true, positionKeys: ['co-csd'] }],
  ]),
  rolesByUid: new Map([
    ['csd-main', { role: 'bod', status: 'approved' }],
    ['csd-co', { role: 'bod', status: 'approved' }],
  ]),
});
assert.deepEqual(buildSafeAvenueDirectorRows({ avenueCode: 'CSD', assignments: clubServiceAssignments, positionHelpers, ...clubServiceMaps }), [
  { name: 'Rtr. Zara Main', positionTitle: 'Club Service Director' },
  { name: 'Rtr. Aarya Co', positionTitle: 'Co-Club Service Director' },
]);
assert.deepEqual(buildSafeAvenueDirectorRows({
  avenueCode: 'CSD',
  assignments: [{ uid: 'co-cmd', positionKey: 'co-cmd', displayTitle: 'Co-Community Service Director', active: true }],
  positionHelpers,
  ...maps({
    usersByUid: new Map([['co-cmd', { name: 'Other Director', status: 'approved', active: true, positionKeys: ['co-cmd'] }]]),
    rolesByUid: new Map([['co-cmd', { role: 'bod', status: 'approved' }]]),
  }),
}), []);
assert.deepEqual(buildSafeAvenueDirectorRows({
  avenueCode: 'CSD',
  assignments: [
    { uid: 'inactive', positionKey: 'csd', displayTitle: 'Club Service Director', active: true },
    { uid: 'archived', positionKey: 'csd', displayTitle: 'Club Service Director', active: true },
    { uid: 'removed', positionKey: 'csd', displayTitle: 'Club Service Director', active: true },
  ],
  positionHelpers,
  ...maps({
    usersByUid: new Map([
      ['inactive', { name: 'Inactive Director', status: 'approved', active: false, positionKeys: ['csd'] }],
      ['archived', { name: 'Archived Director', status: 'approved', active: true, archived: true, positionKeys: ['csd'] }],
      ['removed', { name: 'Removed Director', status: 'approved', active: true, removed: true, positionKeys: ['csd'] }],
    ]),
    rolesByUid: new Map([
      ['inactive', { role: 'bod', status: 'approved' }],
      ['archived', { role: 'bod', status: 'approved' }],
      ['removed', { role: 'bod', status: 'approved' }],
    ]),
  }),
}), []);
assert.equal(isReportAvenueDirectorAssignment({ uid: 'x', positionKey: 'co-csd', displayTitle: 'Co CSD', active: true }, 'CSD', positionHelpers), true);
assert.equal(isReportAvenueDirectorAssignment({ uid: 'x', positionKey: 'co-editor', displayTitle: 'Joint Club Service Director', active: true }, 'CSD', positionHelpers), true);
assert.equal(isReportAvenueDirectorAssignment({ uid: 'x', positionKey: 'co-editor', displayTitle: 'Co CSD', active: true }, 'CSD', positionHelpers), true);
assert.equal(isReportAvenueDirectorAssignment({ uid: 'x', positionKey: 'co-cmd', displayTitle: 'Co-Community Service Director', active: true }, 'CSD', positionHelpers), false);
assert.equal(isReportAvenueDirectorAssignment({ uid: 'x', positionKey: 'co-editor', displayTitle: 'Co-Editor', active: true }, 'CSD', positionHelpers), false);

const indexSource = fs.readFileSync(path.resolve(__dirname, '../index.js'), 'utf8');
const callable = indexSource.match(/exports\.getBodAvenueReportDirectors[\s\S]*?\n\}\);/)?.[0] || '';
assert.match(callable, /requireAuth\(request\)/);
assert.match(callable, /assertBodAdminOrPresident\(uid\)/);
assert.match(callable, /assertApprovedActiveCallableAccount\(uid\)/);
assert.match(callable, /request\.data\?\.avenueCode/);
assert.doesNotMatch(callable, /request\.data\?\.(uid|targetUid)/);
assert.match(callable, /assignmentBasis: 'current-active'/);
assert.match(callable, /isReportAvenueDirectorAssignment/);

console.log('BOD avenue report verification passed.');
