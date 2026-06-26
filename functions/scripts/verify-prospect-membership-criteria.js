'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  calculateProspectMembershipProgress,
} = require('../lib/prospect-membership-criteria');

const repoRoot = path.resolve(__dirname, '..', '..');
const now = '2026-03-31';
const user = { createdAt: '2026-01-01', role: 'prospect', memberType: 'prospect', status: 'approved' };

function event(id, date, extra = {}) {
  return {
    id,
    name: extra.name || `Event ${id}`,
    date,
    type: 'clubEvent',
    visibility: 'public',
    avenue: extra.avenue || ['Club'],
    ...extra,
  };
}

function progress({ events, attendance, duesPaid = false, currentProgress = {}, userData = user }) {
  return calculateProspectMembershipProgress({
    uid: 'prospect-1',
    user: userData,
    currentProgress: { duesPaid, ...currentProgress },
    attendance,
    events,
    now,
  });
}

function assertIds(actual, expected, message) {
  assert.deepStrictEqual(actual, expected, message);
}

let result = progress({
  duesPaid: true,
  events: [
    event('gbm-1', '2026-01-05', { avenue: ['GBM'] }),
    event('isd-1', '2026-01-06', { avenue: ['ISD'] }),
    event('missed', '2026-01-07'),
    event('gbm-2', '2026-01-08', { avenue: ['GBM'] }),
    event('cmd-1', '2026-01-09', { avenue: ['CMD'] }),
  ],
  attendance: {
    'gbm-1': true,
    'isd-1': true,
    missed: false,
    'gbm-2': true,
    'cmd-1': true,
  },
});
assert.strictEqual(result.gbmAttended, 2, 'legacy GBM total should still be calculated');
assert.strictEqual(result.avenueEventsAttended, 2, 'legacy avenue total should still be calculated');
assert.strictEqual(result.attendanceRequirementMet, false, 'old 2 GBM + 2 avenue pattern should not satisfy v2');
assert.strictEqual(result.ready, false, 'dues plus old 2+2 totals should not make a prospect ready');

result = progress({
  events: [event('e1', '2026-01-01'), event('e2', '2026-01-02'), event('e3', '2026-01-03')],
  attendance: { e1: true, e2: true, e3: true },
});
assert.strictEqual(result.attendanceRequirementMet, true, '3 attended activities in a row qualifies');
assert.strictEqual(result.duesDue, true, 'dues become due after attendance completion');
assert.strictEqual(result.ready, false, 'dues are required for readiness');
assertIds(result.qualifyingEventIds, ['e1', 'e2', 'e3'], 'qualifying event IDs should be stored');

result = progress({
  duesPaid: true,
  events: [event('e1', '2026-01-01'), event('e2', '2026-01-02'), event('e3', '2026-01-03')],
  attendance: { e1: true, e2: true, e3: true },
});
assert.strictEqual(result.ready, true, 'backend-ready equivalent requires attendance plus dues');

result = progress({
  events: [event('e1', '2026-01-01'), event('e2', '2026-01-02'), event('e3', '2026-01-03'), event('e4', '2026-01-04')],
  attendance: { e1: true, e2: true, e3: false, e4: true },
});
assert.strictEqual(result.currentConsecutiveAttendance, 1, 'missed eligible activity resets current streak');
assert.strictEqual(result.maximumConsecutiveAttendance, 2, 'highest streak should preserve the pre-miss streak');
assert.strictEqual(result.attendanceRequirementMet, false, '2 attended, 1 missed, 1 attended should not qualify');

result = progress({
  events: [event('e1', '2026-01-01'), event('e2', '2026-01-02'), event('e3', '2026-01-03'), event('e4', '2026-01-04')],
  attendance: { e1: true, e2: true, e3: true, e4: false },
});
assert.strictEqual(result.attendanceRequirementMet, true, 'completion remains valid after a later absence');
assert.strictEqual(result.currentConsecutiveAttendance, 0, 'later absence resets only the active streak');
assertIds(result.qualifyingEventIds, ['e1', 'e2', 'e3'], 'later absence should not replace qualifying trio');

result = progress({
  events: [event('e1', '2026-01-01'), event('e2', '2026-01-02'), event('e3', '2026-01-03'), event('e4', '2026-01-04')],
  attendance: { e1: true, e2: false, e3: true, e4: false },
});
assert.strictEqual(result.attendanceRequirementMet, false, 'removing one qualifying attendance record revokes completion');

result = progress({
  events: [event('e1', '2026-01-01'), event('e2', '2026-01-02'), event('e3', '2026-01-03')],
  attendance: { e1: true, e2: true, e3: true },
});
assert.strictEqual(result.attendanceRequirementMet, true, 'editing absent to present can complete the requirement');

result = progress({
  events: [
    event('e1', '2026-01-01'),
    event('archived', '2026-01-02', { archived: true }),
    event('e3', '2026-01-03'),
  ],
  attendance: { e1: true, archived: true, e3: true },
});
assert.strictEqual(result.attendanceRequirementMet, false, 'archived event is excluded from qualifying sequence');

result = progress({
  events: [
    event('e1', '2026-01-01'),
    event('district', '2026-01-02', { type: 'districtEvent', avenue: ['District'] }),
    event('internal', '2026-01-03', { visibility: 'internal' }),
    event('e2', '2026-01-04'),
    event('e3', '2026-01-05'),
  ],
  attendance: { e1: true, district: true, internal: false, e2: true, e3: true },
});
assert.strictEqual(result.attendanceRequirementMet, true, 'district/internal events should not count or reset eligible club streaks');
assertIds(result.qualifyingEventIds, ['e1', 'e2', 'e3'], 'qualifying sequence should skip district/internal events');

result = progress({
  events: [event('b', '2026-01-01'), event('a', '2026-01-01'), event('c', '2026-01-01')],
  attendance: { a: true, b: true, c: true },
});
assertIds(result.qualifyingEventIds, ['a', 'b', 'c'], 'same-date events should use stable ID sorting');

result = progress({
  userData: { ...user, createdAt: '2026-01-10' },
  events: [event('old', '2026-01-01'), event('e1', '2026-01-10'), event('e2', '2026-01-11')],
  attendance: { old: true, e1: true, e2: true },
});
assert.strictEqual(result.attendanceRequirementMet, false, 'events before prospect account creation should be ignored');
assert.strictEqual(result.maximumConsecutiveAttendance, 2, 'pre-account attendance should not extend the streak');

result = progress({
  duesPaid: true,
  events: [event('e1', '2026-01-01'), event('e2', '2026-01-02')],
  attendance: { e1: true, e2: true },
});
assert.strictEqual(result.ready, false, 'dues alone do not make a prospect ready');

result = progress({
  events: [event('e1', '2026-01-01'), event('e2', '2026-01-02'), event('e3', '2026-01-03')],
  attendance: { e1: true, e2: true },
});
assert.strictEqual(result.currentConsecutiveAttendance, 0, 'missing attendance value for an eligible activity is treated as not attended');
assert.strictEqual(result.attendanceRequirementMet, false, 'missing attendance records should not qualify');

result = progress({
  events: [event('missing-date', ''), event('bad-date', 'not-a-date'), event('e1', '2026-01-01')],
  attendance: { 'missing-date': true, 'bad-date': true, e1: true },
});
assert.strictEqual(result.maximumConsecutiveAttendance, 1, 'missing or malformed event dates should be ignored safely');

const firstRun = progress({
  duesPaid: true,
  events: [event('e1', '2026-01-01'), event('e2', '2026-01-02'), event('e3', '2026-01-03')],
  attendance: { e1: true, e2: true, e3: true },
});
const secondRun = progress({
  duesPaid: true,
  events: [event('e1', '2026-01-01'), event('e2', '2026-01-02'), event('e3', '2026-01-03')],
  attendance: { e1: true, e2: true, e3: true },
});
assert.deepStrictEqual(secondRun, firstRun, 'criteria calculation should be idempotent');

const functionsIndex = fs.readFileSync(path.join(repoRoot, 'functions', 'index.js'), 'utf8');
assert(functionsIndex.includes('exports.recalculateAllProspectProgress'), 'all-prospect backfill callable should exist');
assert(functionsIndex.includes('skippedPromoted'), 'backfill summary should track skipped promoted accounts');
assert(functionsIndex.includes("status !== 'pending'"), 'pending users should not be treated as active prospects');
assert(functionsIndex.includes("status !== 'rejected'"), 'rejected users should not be treated as active prospects');
assert(functionsIndex.includes('recalculated.attendanceRequirementMet === true'), 'promotion should check freshly recalculated attendance completion');
assert(functionsIndex.includes('recalculated.duesPaid === true'), 'promotion should check freshly recalculated dues');
assert(functionsIndex.includes('recalculated.ready === true'), 'promotion should check freshly recalculated ready flag');
assert(functionsIndex.includes('attendanceRequirementMet && duesPaid && ready'), 'promotion transaction should independently enforce readiness');
assert(!functionsIndex.includes('prospectCompletion('), 'old readiness helper should not remain');

const adminHtml = fs.readFileSync(path.join(repoRoot, 'admin.html'), 'utf8');
const adminCore = fs.readFileSync(path.join(repoRoot, 'admin', 'js', 'admin-core.js'), 'utf8');
const dashboardHtml = fs.readFileSync(path.join(repoRoot, 'my-dashboard.html'), 'utf8');
const dashboardJs = fs.readFileSync(path.join(repoRoot, 'js', 'my-dashboard.js'), 'utf8');
const accessJs = fs.readFileSync(path.join(repoRoot, 'js', 'access.js'), 'utf8');
const uiBundle = [adminHtml, adminCore, dashboardHtml, dashboardJs, accessJs].join('\n');

assert(uiBundle.includes('Current streak'), 'Admin or dashboard UI should show current streak');
assert(uiBundle.includes('Highest streak'), 'Admin UI should show highest streak');
assert(uiBundle.includes('Attendance Complete'), 'Admin KPI should show attendance complete');
assert(uiBundle.includes('Dues Pending'), 'Admin KPI/status should show dues pending');
assert(uiBundle.includes('Ready for Induction'), 'UI should use induction readiness label');
assert(uiBundle.includes('Dues payable at the 4th eligible activity'), 'UI should explain fourth-activity dues timing');
assert(uiBundle.includes('Attend 3 eligible club meetings or events consecutively'), 'Prospect dashboard should explain consecutive rule');
assert(adminHtml.includes('Ready for Induction') || adminCore.includes('Ready for induction'), 'Admin UI should retain readiness display');
assert(!dashboardHtml.includes('Induction readiness'), 'Prospect dashboard should not show an induction readiness criterion card');
assert(!dashboardHtml.includes('prospectDuesItem'), 'Removed prospect dashboard readiness item should not remain in HTML');
assert(!dashboardHtml.includes('prospectDuesValue'), 'Removed prospect dashboard readiness value should not remain in HTML');
assert(!dashboardJs.includes('prospectDuesItem'), 'Removed prospect dashboard readiness item should not remain in JS');
assert(!dashboardJs.includes('prospectDuesValue'), 'Removed prospect dashboard readiness value should not remain in JS');
assert(!dashboardJs.includes('Ready for induction'), 'Prospect dashboard should not write removed readiness-card ready text');
assert(!dashboardJs.includes('Not ready'), 'Prospect dashboard should not write removed readiness-card not-ready text');
['Need GBM', 'Need Avenue', 'GBM progress', 'Avenue progress', 'Complete 2 GBMs', 'Attend 2 General Body Meetings', 'Attend 2 Avenue Events'].forEach((oldLabel) => {
  assert(!uiBundle.includes(oldLabel), `old UI label should be removed: ${oldLabel}`);
});

console.log('Prospect membership criteria v2 verifier passed.');
