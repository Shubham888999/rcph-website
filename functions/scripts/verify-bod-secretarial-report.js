'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  buildBodSecretarialReportMetrics,
  countActiveClubMembers,
  isActiveClubMemberRecord,
} = require('../lib/bod-secretarial-report');

function doc(data) {
  return { data: () => data };
}

const activeMembers = [
  { role: 'gbm', status: 'approved', active: true },
  { role: 'bod', status: 'approved' },
  { role: 'admin', memberType: 'member' },
  { role: 'president' },
  { memberType: 'member' },
];

activeMembers.forEach((member) => {
  assert.equal(isActiveClubMemberRecord(member), true);
});

[
  { role: 'prospect', status: 'approved' },
  { memberType: 'prospect', status: 'approved' },
  { role: 'gbm', status: 'pending' },
  { role: 'gbm', status: 'rejected' },
  { role: 'gbm', status: 'inactive' },
  { role: 'gbm', active: false },
  { role: 'gbm', status: 'removed' },
  { role: 'gbm', roleStatus: 'removed' },
  { role: 'gbm', removalStatus: 'removed' },
  { role: 'gbm', profileStatus: 'removed' },
  { role: 'gbm', accessRevoked: true },
  { role: 'gbm', removedAt: { seconds: 1 } },
  { role: 'gbm', profileRemovedAt: { seconds: 1 } },
  { role: 'gbm', removal: { removedAt: { seconds: 1 } } },
  { role: 'gbm', deleted: true },
  { role: 'gbm', isDeleted: true },
  { role: 'gbm', removed: true },
  { role: 'gbm', archived: true },
  { role: 'external' },
  {},
].forEach((member) => {
  assert.equal(isActiveClubMemberRecord(member), false, JSON.stringify(member));
});

assert.equal(countActiveClubMembers({
  docs: [
    ...activeMembers.map(doc),
    doc({ role: 'prospect' }),
    doc({ role: 'gbm', accessRevoked: true }),
    doc({ role: 'bod', status: 'removed' }),
  ],
}), activeMembers.length);

assert.deepEqual(buildBodSecretarialReportMetrics({
  docs: [
    doc({ role: 'gbm', active: true }),
    doc({ role: 'bod', active: false }),
  ],
}, new Date('2026-07-22T12:00:00.000Z')), {
  ok: true,
  clubStrength: 1,
  generatedAt: '2026-07-22T12:00:00.000Z',
});

const indexSource = fs.readFileSync(path.resolve(__dirname, '../index.js'), 'utf8');
const callable = indexSource.match(/exports\.getBodSecretarialReportMetrics[\s\S]*?\n\}\);/)?.[0] || '';

assert.match(indexSource, /const bodSecretarialReport = require\('\.\/lib\/bod-secretarial-report'\);/);
assert.match(indexSource, /exports\.getBodSecretarialReportMetrics = onCall\(CALLABLE_OPTIONS, async \(request\) =>/);
assert.match(callable, /requireAuth\(request\)/);
assert.match(callable, /assertBodAdminOrPresident\(uid\)/);
assert.match(callable, /assertApprovedActiveCallableAccount\(uid\)/);
assert.match(callable, /collection\('members'\)\.get\(\)/);
assert.match(callable, /return bodSecretarialReport\.buildBodSecretarialReportMetrics\(membersSnap\)/);
assert.doesNotMatch(callable, /request\.data\?\.|targetUid|uid:/);
assert.doesNotMatch(callable, /treasury/i);
assert.doesNotMatch(callable, /ppt|pptx|powerpoint/i);

const libSource = fs.readFileSync(path.resolve(__dirname, '../lib/bod-secretarial-report.js'), 'utf8');
assert.doesNotMatch(libSource, /treasury/i);
assert.doesNotMatch(libSource, /ppt|pptx|powerpoint/i);

console.log('BOD secretarial report verification passed.');
