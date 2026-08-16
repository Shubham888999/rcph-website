'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  normalizeReportingWindowConfig,
} = require('./reminderCore');
const {
  buildBodReportingQueueResponsibilities,
  compareBodReportingQueueItems,
  reportingWindowQueueCoverage,
  shapeBodReportingQueueItem,
  shouldIncludeBodReportingQueueItem,
} = require('./reminderFunctions');

function reportingWindow(id, overrides = {}) {
  const raw = {
    recordType: 'avenue_reporting_window',
    avenue: 'ISD',
    avenues: ['ISD'],
    targetName: 'Service Project',
    conductedDate: '2026-08-10',
    eventTime: '10:00',
    reportingOpensAt: '2026-08-11T00:00:00.000Z',
    reportingDueAt: '2026-08-15T00:00:00.000Z',
    lockAt: '2026-08-20T00:00:00.000Z',
    status: 'active',
    remindersEnabled: true,
    lockEnabled: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
  const normalized = normalizeReportingWindowConfig(id, raw);
  assert.ok(normalized, `expected ${id} to normalize`);
  return normalized;
}

test('BOD reporting queue recomputes normal avenue coverage from the linked event', () => {
  const reminder = reportingWindow('rw-partial', {
    avenues: ['ISD', 'RRRO'],
    eventReportStatus: 'recorded',
    linkedBodEventId: 'eventA',
    linkedTargetId: 'eventA',
  });
  const coverage = reportingWindowQueueCoverage(reminder, {
    avenues: ['ISD', 'RRRO', 'CMD'],
    avenueDescriptions: { ISD: 'International service report', CMD: 'Extra report' },
  });

  assert.equal(coverage.status, 'partial');
  assert.equal(coverage.complete, false);
  assert.deepEqual(coverage.requiredAvenues, ['ISD', 'RRRO']);
  assert.deepEqual(coverage.reportedAvenues, ['ISD']);
  assert.deepEqual(coverage.missingDescriptionAvenues, ['RRRO']);
  assert.equal(shouldIncludeBodReportingQueueItem(reminder, coverage), true);

  const item = shapeBodReportingQueueItem({
    reminder,
    coverage,
    responsibilities: [],
    nowMillis: Date.parse('2026-08-12T00:00:00.000Z'),
  });
  assert.equal(item.action, 'continue_event');
  assert.equal(item.eventReportStatus, 'partial');
});

test('BOD reporting queue excludes true complete and administratively stopped windows', () => {
  const completeReminder = reportingWindow('rw-complete', { avenues: ['ISD', 'RRRO'] });
  const completeCoverage = reportingWindowQueueCoverage(completeReminder, {
    avenues: ['ISD', 'RRRO'],
    avenueDescriptions: {
      ISD: 'International service report',
      RRRO: 'Rotary relations report',
    },
  });
  assert.equal(completeCoverage.complete, true);
  assert.equal(shouldIncludeBodReportingQueueItem(completeReminder, completeCoverage), false);

  const statusCompleted = reportingWindow('rw-status-complete', { status: 'completed' });
  assert.equal(shouldIncludeBodReportingQueueItem(statusCompleted, reportingWindowQueueCoverage(statusCompleted, {})), false);

  const stopped = reportingWindow('rw-stopped', { completionReason: 'reminders_disabled' });
  assert.equal(shouldIncludeBodReportingQueueItem(stopped, reportingWindowQueueCoverage(stopped, {})), false);
});

test('BOD reporting queue keeps unlocked, upcoming, no-event, and locked incomplete windows visible', () => {
  const noEvent = reportingWindow('rw-no-event');
  const noEventCoverage = reportingWindowQueueCoverage(noEvent, {});
  const addItem = shapeBodReportingQueueItem({
    reminder: noEvent,
    coverage: noEventCoverage,
    responsibilities: [],
    nowMillis: Date.parse('2026-08-12T00:00:00.000Z'),
  });
  assert.equal(shouldIncludeBodReportingQueueItem(noEvent, noEventCoverage), true);
  assert.equal(addItem.action, 'add_event');
  assert.equal(addItem.locked, false);

  const upcoming = reportingWindow('rw-upcoming', {
    reportingOpensAt: '2026-08-18T00:00:00.000Z',
    reportingDueAt: '2026-08-19T00:00:00.000Z',
    lockAt: '2026-08-20T00:00:00.000Z',
  });
  const upcomingItem = shapeBodReportingQueueItem({
    reminder: upcoming,
    coverage: reportingWindowQueueCoverage(upcoming, {}),
    responsibilities: [],
    nowMillis: Date.parse('2026-08-12T00:00:00.000Z'),
  });
  assert.equal(upcomingItem.runtimeState, 'not_open');
  assert.equal(upcomingItem.locked, false);

  const locked = reportingWindow('rw-locked', {
    status: 'active',
    lockAt: '2026-08-12T00:00:00.000Z',
  });
  const lockedItem = shapeBodReportingQueueItem({
    reminder: locked,
    coverage: reportingWindowQueueCoverage(locked, {}),
    responsibilities: [],
    nowMillis: Date.parse('2026-08-13T00:00:00.000Z'),
  });
  assert.equal(shouldIncludeBodReportingQueueItem(locked, lockedItem.coverage), true);
  assert.equal(lockedItem.runtimeState, 'locked');
  assert.equal(lockedItem.locked, true);

  const unlocked = reportingWindow('rw-unlocked', { status: 'unlocked' });
  assert.equal(shouldIncludeBodReportingQueueItem(unlocked, reportingWindowQueueCoverage(unlocked, {})), true);
});

test('BOD reporting queue responsibilities group by avenue without private contact data', () => {
  const responsibilities = buildBodReportingQueueResponsibilities(['ISD', 'RRRO', 'GBM', 'BOD_MEETING'], [
    { uid: 'coIsd', name: 'Co ISD', role: 'bod', positionKey: 'co-isd', email: 'co@example.com', isCo: true, positionSortOrder: 21 },
    { uid: 'primaryIsd', name: 'Primary ISD', role: 'bod', positionKey: 'isd', email: 'primary@example.com', isCo: false, positionSortOrder: 20 },
    { uid: 'primaryIsd', name: 'Primary ISD Duplicate', role: 'bod', positionKey: 'co-isd', email: 'dupe@example.com', isCo: true, positionSortOrder: 21 },
    { uid: 'secretary', name: 'Secretary', role: 'bod', positionKey: 'secretary', email: 'secretary@example.com', isCo: false, positionSortOrder: 5 },
    { uid: 'coSecretary', name: 'Co Secretary', role: 'bod', positionKey: 'co-secretary', email: 'co-secretary@example.com', isCo: true, positionSortOrder: 24 },
  ]);

  const byAvenue = new Map(responsibilities.map(group => [group.avenue, group]));
  assert.deepEqual(byAvenue.get('ISD').assignees.map(assignee => assignee.uid), ['primaryIsd', 'coIsd']);
  assert.deepEqual(byAvenue.get('RRRO').assignees, []);
  assert.deepEqual(byAvenue.get('GBM').assignees.map(assignee => assignee.uid), ['secretary', 'coSecretary']);
  assert.deepEqual(byAvenue.get('BOD_MEETING').assignees.map(assignee => assignee.positionKey), ['secretary', 'co-secretary']);
  responsibilities.flatMap(group => group.assignees).forEach((assignee) => {
    assert.equal(Object.prototype.hasOwnProperty.call(assignee, 'email'), false);
  });
});

test('BOD reporting queue supports special reporting windows without normal BOD meeting coverage', () => {
  const gbm = reportingWindow('rw-gbm', { avenue: 'GBM', avenues: ['GBM'], eventReportStatus: 'pending' });
  const gbmCoverage = reportingWindowQueueCoverage(gbm, {});
  assert.equal(gbmCoverage.status, 'pending');
  assert.deepEqual(gbmCoverage.requiredAvenues, ['GBM']);
  assert.equal(shouldIncludeBodReportingQueueItem(gbm, gbmCoverage), true);

  const bodMeeting = reportingWindow('rw-bod', { avenue: 'BOD_MEETING', avenues: ['BOD_MEETING'], eventReportStatus: 'pending' });
  const bodItem = shapeBodReportingQueueItem({
    reminder: bodMeeting,
    coverage: reportingWindowQueueCoverage(bodMeeting, { avenues: ['BOD'], description: 'Ignored' }),
    responsibilities: [],
    nowMillis: Date.parse('2026-08-12T00:00:00.000Z'),
  });
  assert.equal(bodItem.targetType, 'bod_meeting');
  assert.deepEqual(bodItem.coverage.requiredAvenues, ['BOD_MEETING']);

  const recorded = reportingWindow('rw-gbm-recorded', { avenue: 'GBM', avenues: ['GBM'], eventReportStatus: 'recorded' });
  const recordedCoverage = reportingWindowQueueCoverage(recorded, {});
  assert.equal(recordedCoverage.complete, true);
  assert.equal(shouldIncludeBodReportingQueueItem(recorded, recordedCoverage), false);
});

test('BOD reporting queue sorts by due date, lock date, newest created date, then id', () => {
  const items = [
    { reportingWindowId: 'rw-b', reportingDueAt: '2026-08-16T00:00:00.000Z', lockAt: '2026-08-20T00:00:00.000Z', createdAt: '2026-08-01T00:00:00.000Z' },
    { reportingWindowId: 'rw-a', reportingDueAt: '2026-08-16T00:00:00.000Z', lockAt: '2026-08-20T00:00:00.000Z', createdAt: '2026-08-03T00:00:00.000Z' },
    { reportingWindowId: 'rw-c', reportingDueAt: '2026-08-15T00:00:00.000Z', lockAt: '2026-08-22T00:00:00.000Z', createdAt: '2026-08-02T00:00:00.000Z' },
    { reportingWindowId: 'rw-d', reportingDueAt: '2026-08-16T00:00:00.000Z', lockAt: '2026-08-19T00:00:00.000Z', createdAt: '2026-08-04T00:00:00.000Z' },
  ];

  items.sort(compareBodReportingQueueItems);
  assert.deepEqual(items.map(item => item.reportingWindowId), ['rw-c', 'rw-d', 'rw-a', 'rw-b']);
});
