'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const positionHelpers = require('../lib/positions');
const {
  REPORTABLE_AVENUE_CODES,
  buildSafeAvenueDirectorRows,
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
  { name: 'Director One', positionTitle: 'Community Service Director' },
]);
assert.deepEqual(buildSafeAvenueDirectorRows({ avenueCode: 'ISD', assignments: [active], positionHelpers, ...maps() }), []);
assert.deepEqual(buildSafeAvenueDirectorRows({ avenueCode: 'CMD', assignments: [{ ...active, active: false }], positionHelpers, ...maps() }), []);
assert.deepEqual(buildSafeAvenueDirectorRows({ avenueCode: 'CMD', assignments: [active], positionHelpers, ...maps({ usersByUid: new Map([['u1', { name: 'Director One', status: 'rejected', active: true, positionKeys: ['cmd'] }]]) }) }), []);
assert.deepEqual(buildSafeAvenueDirectorRows({ avenueCode: 'CMD', assignments: [active], positionHelpers, ...maps({ rolesByUid: new Map([['u1', { role: 'gbm', status: 'approved' }]]) }) }), []);
assert.equal(buildSafeAvenueDirectorRows({ avenueCode: 'CMD', assignments: [active, { ...active }], positionHelpers, ...maps() }).length, 1);
assert.equal(Object.hasOwn(buildSafeAvenueDirectorRows({ avenueCode: 'CMD', assignments: [active], positionHelpers, ...maps() })[0], 'uid'), false);

const indexSource = fs.readFileSync(path.resolve(__dirname, '../index.js'), 'utf8');
const callable = indexSource.match(/exports\.getBodAvenueReportDirectors[\s\S]*?\n\}\);/)?.[0] || '';
assert.match(callable, /requireAuth\(request\)/);
assert.match(callable, /assertBodAdminOrPresident\(uid\)/);
assert.match(callable, /assertApprovedActiveCallableAccount\(uid\)/);
assert.match(callable, /request\.data\?\.avenueCode/);
assert.doesNotMatch(callable, /request\.data\?\.(uid|targetUid)/);
assert.match(callable, /assignmentBasis: 'current-active'/);

console.log('BOD avenue report verification passed.');
