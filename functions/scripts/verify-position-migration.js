#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
  analyzeMigrationData,
} = require('../lib/position-migration');

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`not ok - ${name}`);
    throw err;
  }
}

function dataset(collections) {
  return { collections };
}

function baseUser(uid, overrides = {}) {
  return {
    name: overrides.name || `User ${uid}`,
    email: overrides.email || `${uid}@example.com`,
    status: 'approved',
    role: overrides.role || 'gbm',
    ...overrides,
  };
}

function baseRole(role) {
  return { role, status: 'approved' };
}

function reportFor(collections) {
  return analyzeMigrationData(dataset(collections), { projectId: 'fixture' });
}

test('UID-aligned records correlate correctly', () => {
  const report = reportFor({
    users: { uid1: baseUser('uid1', { role: 'admin' }) },
    roles: { uid1: baseRole('admin') },
    members: { uid1: { name: 'User uid1', userId: 'uid1' } },
    attendance: { uid1: { event1: true } },
  });
  const user = report.users.find((item) => item.uid === 'uid1');
  assert.strictEqual(user.sourceRecords.roles, true);
  assert.strictEqual(user.sourceRecords.members, true);
  assert.strictEqual(user.sourceRecords.attendance, true);
});

test('exact email duplicate is high confidence', () => {
  const report = reportFor({
    users: { uid1: baseUser('uid1', { email: 'match@example.com' }) },
    roles: { uid1: baseRole('gbm') },
    members: { manual1: { name: 'Manual', email: 'match@example.com' } },
  });
  const candidate = report.duplicates.find((item) => item.documentId === 'manual1');
  assert.strictEqual(candidate.confidence, 'high');
  assert.strictEqual(candidate.candidateUid, 'uid1');
});

test('name-only match is not auto-merged', () => {
  const report = reportFor({
    users: { uid1: baseUser('uid1', { name: 'Same Name' }) },
    roles: { uid1: baseRole('gbm') },
    members: { manual1: { name: 'Same Name' } },
  });
  const candidate = report.duplicates.find((item) => item.documentId === 'manual1');
  assert.strictEqual(candidate.confidence, 'medium');
  assert.strictEqual(candidate.recommendedAction, 'review-manual-row-before-migration');
});

test('known legacy position resolves', () => {
  const report = reportFor({
    users: { uid1: baseUser('uid1', { role: 'bod', clubPosition: 'Secretary' }) },
    roles: { uid1: baseRole('bod') },
  });
  const user = report.users.find((item) => item.uid === 'uid1');
  assert.deepStrictEqual(user.positionKeys, ['secretary']);
  assert.deepStrictEqual(user.blockers, []);
});

test('unknown combined position is blocked', () => {
  const report = reportFor({
    users: { uid1: baseUser('uid1', { role: 'bod', clubPosition: 'Secretary & RRRO' }) },
    roles: { uid1: baseRole('bod') },
  });
  const user = report.users.find((item) => item.uid === 'uid1');
  assert(user.blockers.some((item) => item.includes('Unknown or ambiguous')));
});

test('BOD without position is blocked', () => {
  const report = reportFor({
    users: { uid1: baseUser('uid1', { role: 'bod' }) },
    roles: { uid1: baseRole('bod') },
  });
  const user = report.users.find((item) => item.uid === 'uid1');
  assert(user.blockers.some((item) => item.includes('BOD role has no resolvable')));
});

test('Admin with zero positions is allowed', () => {
  const report = reportFor({
    users: { uid1: baseUser('uid1', { role: 'admin' }) },
    roles: { uid1: baseRole('admin') },
  });
  const user = report.users.find((item) => item.uid === 'uid1');
  assert.deepStrictEqual(user.blockers, []);
  assert.deepStrictEqual(user.positionKeys, []);
});

test('GBM with legacy positions produces warning and clearing plan', () => {
  const report = reportFor({
    users: { uid1: baseUser('uid1', { role: 'gbm', clubPosition: 'Secretary' }) },
    roles: { uid1: baseRole('gbm') },
  });
  const user = report.users.find((item) => item.uid === 'uid1');
  assert.deepStrictEqual(user.positionKeys, []);
  assert(user.warnings.some((item) => item.includes('cleared')));
});

test('two holders create joint-position review item', () => {
  const report = reportFor({
    users: {
      uid1: baseUser('uid1', { role: 'bod', clubPosition: 'Secretary' }),
      uid2: baseUser('uid2', { role: 'bod', clubPosition: 'Secretary' }),
    },
    roles: { uid1: baseRole('bod'), uid2: baseRole('bod') },
  });
  const secretary = report.occupancy.find((item) => item.positionKey === 'secretary');
  assert.strictEqual(secretary.jointAssignmentRequired, true);
  assert.deepStrictEqual(secretary.holderUids, ['uid1', 'uid2']);
});

test('one holder does not create a joint conflict', () => {
  const report = reportFor({
    users: { uid1: baseUser('uid1', { role: 'bod', clubPosition: 'PDD' }) },
    roles: { uid1: baseRole('bod') },
  });
  const pdd = report.occupancy.find((item) => item.positionKey === 'pdd');
  assert.strictEqual(pdd.jointAssignmentRequired, false);
});

test('inactive BOD member with active positions proposes activation', () => {
  const report = reportFor({
    users: { uid1: baseUser('uid1', { role: 'bod', clubPosition: 'RRRO' }) },
    roles: { uid1: baseRole('bod') },
    bodMembers: { uid1: { userId: 'uid1', active: false, position: 'RRRO' } },
  });
  const user = report.users.find((item) => item.uid === 'uid1');
  assert.strictEqual(user.bodRosterAction, 'activate');
});

test('active BOD member with no positions proposes deactivation', () => {
  const report = reportFor({
    users: { uid1: baseUser('uid1', { role: 'admin' }) },
    roles: { uid1: baseRole('admin') },
    bodMembers: { uid1: { userId: 'uid1', active: true } },
  });
  const user = report.users.find((item) => item.uid === 'uid1');
  assert.strictEqual(user.bodRosterAction, 'deactivate');
});

test('missing attendance row proposes create', () => {
  const report = reportFor({
    users: { uid1: baseUser('uid1', { role: 'gbm' }) },
    roles: { uid1: baseRole('gbm') },
  });
  const user = report.users.find((item) => item.uid === 'uid1');
  assert.strictEqual(user.actions.attendance, 'create');
});

test('existing attendance row proposes preserve', () => {
  const report = reportFor({
    users: { uid1: baseUser('uid1', { role: 'gbm' }) },
    roles: { uid1: baseRole('gbm') },
    attendance: { uid1: { event1: true } },
  });
  const user = report.users.find((item) => item.uid === 'uid1');
  assert.strictEqual(user.actions.attendance, 'preserve');
});

test('orphan attendance row is reported', () => {
  const report = reportFor({
    users: { uid1: baseUser('uid1', { role: 'gbm' }) },
    roles: { uid1: baseRole('gbm') },
    attendance: { orphan1: { event1: true } },
  });
  assert(report.attendance.attendance.orphanRows.some((item) => item.documentId === 'orphan1'));
});

test('stale occupancy is detected', () => {
  const report = reportFor({
    users: { uid1: baseUser('uid1', { role: 'bod', clubPosition: 'Secretary' }) },
    roles: { uid1: baseRole('bod') },
    bodPositionOccupancy: { secretary: { holderUids: ['old-uid'] } },
  });
  const secretary = report.occupancy.find((item) => item.positionKey === 'secretary');
  assert(secretary.occupancyDifference.classification.includes('existing-stale'));
});

test('stale assignment is detected', () => {
  const report = reportFor({
    users: { uid1: baseUser('uid1', { role: 'admin' }) },
    roles: { uid1: baseRole('admin') },
    bodPositionAssignments: {
      isd_old: { assignmentId: 'isd_old', positionKey: 'isd', uid: 'old', active: true },
    },
  });
  assert(report.assignments.some((item) => item.assignmentId === 'isd_old' && item.proposedAction === 'deactivate-stale-assignment'));
});

test('existing matching occupancy is preserved', () => {
  const report = reportFor({
    users: { uid1: baseUser('uid1', { role: 'bod', clubPosition: 'PDD' }) },
    roles: { uid1: baseRole('bod') },
    bodPositionOccupancy: { pdd: { holderUids: ['uid1'] } },
  });
  const pdd = report.occupancy.find((item) => item.positionKey === 'pdd');
  assert(pdd.occupancyDifference.classification.includes('existing-agrees'));
});

test('PDD and IPP remain separate', () => {
  const report = reportFor({
    users: { uid1: baseUser('uid1', { role: 'admin', positionKeys: ['pdd', 'immediate-past-president'] }) },
    roles: { uid1: baseRole('admin') },
  });
  const user = report.users.find((item) => item.uid === 'uid1');
  assert.deepStrictEqual(user.positionKeys, ['immediate-past-president', 'pdd']);
});

test('WRWC and WR remain separate', () => {
  const report = reportFor({
    users: { uid1: baseUser('uid1', { role: 'bod', positionKeys: ['wrwc', 'wr'] }) },
    roles: { uid1: baseRole('bod') },
  });
  const user = report.users.find((item) => item.uid === 'uid1');
  assert.deepStrictEqual(user.positionKeys, ['wrwc', 'wr']);
});

test('generated-ID BOD row is not used as authorization evidence', () => {
  const report = reportFor({
    users: { uid1: baseUser('uid1', { role: 'bod' }) },
    roles: { uid1: baseRole('bod') },
    bodMembers: {
      generated: { userId: 'uid1', position: 'Secretary' },
    },
  });
  const user = report.users.find((item) => item.uid === 'uid1');
  assert.deepStrictEqual(user.positionKeys, []);
  assert(user.blockers.some((item) => item.includes('BOD role has no resolvable')));
});

test('report summary counts are correct', () => {
  const report = reportFor({
    users: {
      uid1: baseUser('uid1', { role: 'admin' }),
      uid2: baseUser('uid2', { role: 'bod' }),
    },
    roles: { uid1: baseRole('admin'), uid2: baseRole('bod') },
  });
  assert.strictEqual(report.summary.totalUsers, 2);
  assert.strictEqual(report.summary.blockedUsers, 1);
  assert.strictEqual(report.summary.warningUsers, 0);
});

test('blockers force readyForWrite false', () => {
  const report = reportFor({
    users: { uid1: baseUser('uid1', { role: 'bod' }) },
    roles: { uid1: baseRole('bod') },
  });
  assert.strictEqual(report.summary.readyForWrite, false);
});

test('no-blocker fixtures can produce readyForWrite true', () => {
  const report = reportFor({
    users: { uid1: baseUser('uid1', { role: 'admin' }) },
    roles: { uid1: baseRole('admin') },
    attendance: { uid1: { event1: true } },
    districtAttendance: { uid1: { event1: true } },
  });
  assert.strictEqual(report.summary.readyForWrite, true);
});

test('pending request is excluded', () => {
  const report = reportFor({
    users: {
      pending1: {
        name: 'Pending BOD',
        email: 'pending@example.com',
        status: 'pending',
        requestedRole: 'bod',
        clubPosition: 'Secretary',
      },
    },
  });
  const user = report.users.find((item) => item.uid === 'pending1');
  assert.strictEqual(user.eligibility, 'excluded-pending');
  assert.strictEqual(user.proposedRole, null);
  assert.strictEqual(user.actions.roles, 'none');
  assert.strictEqual(user.actions.members, 'none');
  assert.strictEqual(user.actions.attendance, 'none');
  assert.strictEqual(report.occupancy.find((item) => item.positionKey === 'secretary').holderUids.includes('pending1'), false);
  assert.strictEqual(report.assignments.some((item) => item.uid === 'pending1'), false);
});

test('pending Admin request is excluded', () => {
  const report = reportFor({
    users: {
      pendingAdmin: {
        name: 'Pending Admin',
        email: 'pending.admin@example.com',
        status: 'pending',
        requestedRole: 'admin',
      },
    },
  });
  const user = report.users.find((item) => item.uid === 'pendingAdmin');
  assert.strictEqual(user.eligibility, 'excluded-pending');
  assert.strictEqual(user.actions.roles, 'none');
  assert.strictEqual(user.actions.members, 'none');
});

test('rejected user is excluded', () => {
  const report = reportFor({
    users: {
      rejected1: {
        name: 'Rejected User',
        email: 'rejected@example.com',
        status: 'rejected',
        requestedRole: 'bod',
        clubPosition: 'Secretary',
      },
    },
  });
  const user = report.users.find((item) => item.uid === 'rejected1');
  assert.strictEqual(user.eligibility, 'excluded-rejected');
  assert.strictEqual(user.actions.roles, 'none');
  assert.strictEqual(user.actions.members, 'none');
  assert.strictEqual(user.actions.attendance, 'none');
  assert.strictEqual(report.assignments.some((item) => item.uid === 'rejected1'), false);
});

test('requested role alone is not migration authority', () => {
  const report = reportFor({
    users: {
      requestOnly: {
        name: 'Request Only',
        email: 'request.only@example.com',
        requestedRole: 'bod',
        clubPosition: 'Secretary',
      },
    },
  });
  const user = report.users.find((item) => item.uid === 'requestOnly');
  assert.strictEqual(user.eligibility, 'excluded-unapproved');
  assert.strictEqual(user.proposedRole, null);
  assert.strictEqual(user.actions.members, 'none');
});

test('approved user still migrates', () => {
  const report = reportFor({
    users: {
      approvedBod: baseUser('approvedBod', { role: 'bod', positionKeys: ['secretary'] }),
    },
    roles: { approvedBod: baseRole('bod') },
  });
  const user = report.users.find((item) => item.uid === 'approvedBod');
  assert.strictEqual(user.eligibility, 'approved');
  assert.strictEqual(user.proposedRole, 'bod');
  assert.deepStrictEqual(user.positionKeys, ['secretary']);
  assert.strictEqual(user.actions.bodMembers, 'create');
});

test('pending plus approved role remains blocked', () => {
  const report = reportFor({
    users: {
      pendingBlocked: {
        name: 'Pending Blocked',
        email: 'pending.blocked@example.com',
        status: 'pending',
        requestedRole: 'bod',
      },
    },
    roles: { pendingBlocked: baseRole('bod') },
  });
  const user = report.users.find((item) => item.uid === 'pendingBlocked');
  assert.strictEqual(user.eligibility, 'blocked-inconsistent-status');
  assert(user.blockers.some((item) => item.includes('Pending user has an approved role document')));
  assert.strictEqual(report.summary.readyForWrite, false);
});

test('excluded users do not make readiness fail', () => {
  const report = reportFor({
    users: {
      approvedAdmin: baseUser('approvedAdmin', { role: 'admin' }),
      pending1: {
        name: 'Pending',
        email: 'pending.clean@example.com',
        status: 'pending',
        requestedRole: 'bod',
        clubPosition: 'Secretary',
      },
    },
    roles: { approvedAdmin: baseRole('admin') },
  });
  assert.strictEqual(report.summary.readyForWrite, true);
});

test('summary counts eligibility classes', () => {
  const report = reportFor({
    users: {
      approvedAdmin: baseUser('approvedAdmin', { role: 'admin' }),
      pending1: { name: 'Pending', email: 'p@example.com', status: 'pending', requestedRole: 'bod' },
      rejected1: { name: 'Rejected', email: 'r@example.com', status: 'rejected', requestedRole: 'gbm' },
      unapproved1: { name: 'Unapproved', email: 'u@example.com', requestedRole: 'admin' },
    },
    roles: { approvedAdmin: baseRole('admin') },
  });
  assert.strictEqual(report.summary.approvedEligibleUsers, 1);
  assert.strictEqual(report.summary.excludedPendingUsers, 1);
  assert.strictEqual(report.summary.excludedRejectedUsers, 1);
  assert.strictEqual(report.summary.excludedUnapprovedUsers, 1);
});

console.log('Position migration verification passed.');
