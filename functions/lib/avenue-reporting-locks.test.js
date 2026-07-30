'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  assertBodEventAvenuesUnlocked,
  buildReportingWindowLockDashboardNotice,
  buildReportingWindowOpenDashboardNotices,
  lockedAvenueMessage,
  lockedBodAvenuesForPayload,
  normalizeActiveAvenueReportingLocks,
  normalizeOpenAvenueReportingWindows,
  reportingWindowLockDashboardMessage,
  reportingWindowOpenDashboardMessage,
  recipientPositionKeysForAvenue,
} = require('./avenue-reporting-locks');

class TestHttpsError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

function lockDoc(id, overrides = {}) {
  return {
    id,
    data: {
      type: 'avenue_reporting',
      locked: true,
      status: 'active',
      reason: 'reporting_window_expired',
      avenue: 'PDD',
      reportingWindowId: 'window-pdd',
      ...overrides,
    },
  };
}

function reminderDoc(id, overrides = {}) {
  return {
    id,
    data: {
      recordType: 'avenue_reporting_window',
      avenue: 'PDD',
      targetName: 'Career Lab',
      conductedDate: '2026-07-15',
      reportingOpensAt: '2026-07-24T18:30:00.000Z',
      reportingDueAt: '2026-07-26T18:29:00.000Z',
      lockAt: '2026-07-26T18:30:00.000Z',
      remindersEnabled: true,
      lockEnabled: true,
      status: 'open',
      ...overrides,
    },
  };
}

test('active reporting-window locks normalize from lock docs and reminder metadata', () => {
  const locks = normalizeActiveAvenueReportingLocks({
    lockDocs: [
      lockDoc('avenueReporting_window-pdd'),
      lockDoc('wrong-type', { type: 'bod_events', avenue: 'CMD' }),
      lockDoc('unlocked', { locked: false, avenue: 'CMD' }),
    ],
    reminderDocs: [{
      id: 'window-pdd',
      data: {
        recordType: 'avenue_reporting_window',
        avenue: 'Professional Development',
        targetName: 'Career Lab',
        conductedDate: '2026-07-15',
      },
    }],
  });

  assert.equal(locks.length, 1);
  assert.equal(locks[0].avenue, 'PDD');
  assert.equal(locks[0].targetName, 'Career Lab');
  assert.equal(locks[0].conductedDate, '2026-07-15');
});

test('BOD event avenue enforcement rejects locked selected avenues for every caller path', () => {
  const locks = normalizeActiveAvenueReportingLocks({
    lockDocs: [
      lockDoc('avenueReporting_window-pdd'),
      lockDoc('avenueReporting_window-cmd', {
        avenue: 'CMD',
        reportingWindowId: 'window-cmd',
      }),
    ],
  });

  assert.deepEqual(lockedBodAvenuesForPayload(['PDD', 'GBM'], locks), ['PDD']);
  assert.equal(lockedAvenueMessage(['PDD']), 'PDD is locked due to missed reporting window. Ask President or Admin to unlock.');
  assert.equal(lockedAvenueMessage(['CMD', 'PDD']), 'CMD and PDD are locked due to missed reporting window. Ask President or Admin to unlock.');
  assert.equal(reportingWindowLockDashboardMessage(['PDD']), 'PDD reporting is locked because the reporting deadline was missed. Please ask the President or Admin to unlock this avenue.');

  assert.throws(
    () => assertBodEventAvenuesUnlocked({
      avenues: ['CMD', 'PDD'],
      locks,
      HttpsError: TestHttpsError,
    }),
    (error) => (
      error.code === 'failed-precondition'
      && error.message.includes('CMD and PDD')
      && error.details.reason === 'reporting_window_expired'
    )
  );

  assert.doesNotThrow(() => assertBodEventAvenuesUnlocked({
    avenues: ['GBM'],
    locks,
    HttpsError: TestHttpsError,
  }));
});

test('dashboard reporting-window lock notice targets only assigned director and co-director positions', () => {
  const locks = normalizeActiveAvenueReportingLocks({
    lockDocs: [
      lockDoc('avenueReporting_window-pdd'),
      lockDoc('avenueReporting_window-cmd', {
        avenue: 'CMD',
        reportingWindowId: 'window-cmd',
      }),
    ],
  });

  const directorNotice = buildReportingWindowLockDashboardNotice({
    locks,
    positionKeys: ['pdd'],
    now: new Date('2026-07-25T00:00:00.000Z'),
  });
  assert.equal(directorNotice.body, 'PDD reporting is locked because the reporting deadline was missed. Please ask the President or Admin to unlock this avenue.');
  assert.deepEqual(directorNotice.lockedAvenues, ['PDD']);
  assert.equal(directorNotice.dismissible, false);

  const coDirectorNotice = buildReportingWindowLockDashboardNotice({
    locks,
    positionKeys: ['co-pdd', 'co-cmd'],
    now: new Date('2026-07-25T00:00:00.000Z'),
  });
  assert.equal(coDirectorNotice.body, 'CMD and PDD reporting is locked because the reporting deadline was missed. Please ask the President or Admin to unlock this avenue.');

  const unrelatedNotice = buildReportingWindowLockDashboardNotice({
    locks,
    positionKeys: ['pro'],
    now: new Date('2026-07-25T00:00:00.000Z'),
  });
  assert.equal(unrelatedNotice, null);
});

test('open reporting-window dashboard notices target assigned director and co-director positions', () => {
  const reminderDocs = [
    reminderDoc('window-pdd'),
    reminderDoc('window-cmd', { avenue: 'CMD', targetName: 'Drive', status: 'active' }),
  ];

  const windows = normalizeOpenAvenueReportingWindows({
    reminderDocs,
    now: new Date('2026-07-25T00:00:00.000Z'),
  });
  assert.deepEqual(windows.map(window => window.avenue), ['CMD', 'PDD']);
  assert.equal(
    reportingWindowOpenDashboardMessage('PDD', '2026-07-26T18:29:00.000Z'),
    'PDD reporting window is open. Please submit the event report before the deadline. Due by 26 July 2026, 11:59 PM.'
  );

  const directorNotice = buildReportingWindowOpenDashboardNotices({
    windows,
    positionKeys: ['pdd'],
    now: new Date('2026-07-25T00:00:00.000Z'),
  });
  assert.equal(directorNotice.length, 1);
  assert.equal(directorNotice[0].body, 'PDD reporting window is open. Please submit the event report before the deadline. Due by 26 July 2026, 11:59 PM.');
  assert.equal(directorNotice[0].dismissible, false);
  assert.deepEqual(directorNotice[0].reportingWindowIds, ['window-pdd']);

  const coDirectorNotices = buildReportingWindowOpenDashboardNotices({
    windows,
    positionKeys: ['co-pdd', 'co-cmd'],
    now: new Date('2026-07-25T00:00:00.000Z'),
  });
  assert.deepEqual(coDirectorNotices.map(notice => notice.openAvenue), ['CMD', 'PDD']);

  const unrelatedNotice = buildReportingWindowOpenDashboardNotices({
    windows,
    positionKeys: ['pro'],
    now: new Date('2026-07-25T00:00:00.000Z'),
  });
  assert.deepEqual(unrelatedNotice, []);
});

test('reporting-window dashboard notices disappear after completion, unlock, or expiry', () => {
  const openWindows = normalizeOpenAvenueReportingWindows({
    reminderDocs: [
      reminderDoc('completed', { status: 'completed' }),
      reminderDoc('unlocked', { status: 'unlocked' }),
      reminderDoc('expired', { lockAt: '2026-07-24T18:30:00.000Z' }),
    ],
    now: new Date('2026-07-25T00:00:00.000Z'),
  });
  assert.deepEqual(openWindows, []);

  const locks = normalizeActiveAvenueReportingLocks({
    lockDocs: [
      lockDoc('unlocked-lock', { locked: false, status: 'unlocked' }),
      lockDoc('inactive-lock', { locked: true, status: 'unlocked' }),
    ],
  });
  assert.deepEqual(locks, []);
  assert.equal(buildReportingWindowLockDashboardNotice({
    locks,
    positionKeys: ['pdd', 'co-pdd'],
  }), null);
});

test('GBM reporting locks target secretary assignments consistently with reminder routing', () => {
  assert.deepEqual(recipientPositionKeysForAvenue('GBM'), ['secretary', 'joint-secretary', 'co-secretary']);
  const locks = normalizeActiveAvenueReportingLocks({
    lockDocs: [lockDoc('avenueReporting_window-gbm', {
      avenue: 'GBM',
      reportingWindowId: 'window-gbm',
    })],
  });
  const notice = buildReportingWindowLockDashboardNotice({
    locks,
    positionKeys: ['co-secretary'],
    now: new Date('2026-07-25T00:00:00.000Z'),
  });
  assert.equal(notice.body, 'GBM reporting is locked because the reporting deadline was missed. Please ask the President or Admin to unlock this avenue.');
});

test('submitBodEvent and updateBodEvent call avenue lock enforcement after payload normalization', () => {
  const indexSource = readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
  assert.match(indexSource, /const avenueReportingLocks = require\('\.\/lib\/avenue-reporting-locks'\);/);
  assert.match(indexSource, /async function loadActiveAvenueReportingLocks\(\)/);
  assert.match(indexSource, /exports\.getBodToolsLockState = onCall/);
  assert.match(indexSource, /shapeBodEventLockState\(bodEventsLock\)/);
  assert.match(indexSource, /locks\.map\(shapeAvenueReportingLockState\)/);
  assert.match(indexSource, /async function assertBodEventAvenuesUnlocked\(avenues\)/);
  assert.match(indexSource, /async function getActiveBodPositionKeysForUser\(uid\)/);
  assert.match(indexSource, /const dashboardPositionKeys = mergePositionKeysForDashboard\(/);
  assert.match(indexSource, /getReportingWindowDashboardNotices\(dashboardPositionKeys\)/);
  assert.match(indexSource, /exports\.submitBodEvent[\s\S]*const payload = normalizeBodEventPayload\(data\);\s*await assertBodEventAvenuesUnlocked\(payload\.avenues\);/);
  assert.match(indexSource, /exports\.updateBodEvent[\s\S]*const payload = normalizeBodEventPayload\(request\.data \|\| \{\}\);\s*await assertBodEventAvenuesUnlocked\(payload\.avenues\);/);
});
