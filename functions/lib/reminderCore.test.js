'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  normalizeReminderConfig,
  normalizeReportingWindowConfig,
  deriveReportingWindowLifecycle,
  reminderSkipReason,
  reportingWindowRuntimeState,
  resolveReportingWindowLifecycle,
  hasMomMetadata,
  normalizedNameSimilarity,
  attendanceValueIsMarked,
  normalizeReportingAvenues,
  reportingAvenuesLabel,
  reportingWindowRecipientPositionKeys,
  evaluateReportingWindowAvenueCoverage,
  reportingReminderPendingAvenues,
  reportingReminderAudienceConfig,
  withReportingReminderPendingAudience,
  avenueRecipientPositionKeys,
  avenueRecipientRole,
  reminderRecipientMatchesRole,
  buildReminderEmail,
  buildReminderTemplateTestEmail,
  normalizeReminderTemplateTestType,
  nextSentState,
  nextAvenueReportingSentState,
  avenueReportingLockId,
  avenueReportingLockPayload,
} = require('./reminderCore');

test('reminder config normalizes Phase 1 event records as enabled configured reminders', () => {
  const config = normalizeReminderConfig('reminder-1', {
    recordType: 'event_reminder_config',
    source: 'events',
    eventId: 'event_1',
    eventName: 'Club Assembly',
    conductedDate: '2026-07-14',
    reminderType: 'mom_submission',
    recipientRole: 'secretary',
    status: 'configured',
    remindersSent: 1,
    maxReminders: 3,
  });

  assert.equal(config.enabled, true);
  assert.equal(config.targetType, 'club_event');
  assert.equal(config.targetId, 'event_1');
  assert.equal(config.targetName, 'Club Assembly');
  assert.equal(config.targetDate, '2026-07-14');
  assert.equal(reminderSkipReason(config), '');
});

test('disabled, stopped, completed, and maxed reminders are skipped', () => {
  assert.equal(reminderSkipReason(normalizeReminderConfig('a', { reminderType: 'mom_submission', source: 'events', eventId: 'e1', enabled: false })), 'disabled');
  assert.equal(reminderSkipReason(normalizeReminderConfig('b', { reminderType: 'mom_submission', source: 'events', eventId: 'e1', status: 'stopped' })), 'stopped');
  assert.equal(reminderSkipReason(normalizeReminderConfig('c', { reminderType: 'mom_submission', source: 'events', eventId: 'e1', status: 'completed' })), 'completed');
  assert.equal(reminderSkipReason(normalizeReminderConfig('d', { reminderType: 'mom_submission', source: 'events', eventId: 'e1', remindersSent: 3, maxReminders: 3 })), 'max_reminders_reached');
});

test('MOM metadata completion detection only needs private metadata fields', () => {
  assert.equal(hasMomMetadata({ momDriveFileId: 'drive-1', momFileName: 'mom.pdf' }), true);
  assert.equal(hasMomMetadata({ momDriveFileId: 'drive-1', momUploadedAt: '2026-07-15T00:00:00.000Z' }), true);
  assert.equal(hasMomMetadata({ momFileName: 'mom.pdf' }), false);
});

test('reminder recipients resolve active secretary and SAA position metadata', () => {
  assert.equal(reminderRecipientMatchesRole({ role: 'bod', positionKeys: ['secretary'] }, 'secretary'), true);
  assert.equal(reminderRecipientMatchesRole({ role: 'gbm', positionKeys: ['joint secretary'] }, 'secretary'), true);
  assert.equal(reminderRecipientMatchesRole({ role: 'bod', positionKeys: ['saa'] }, 'sergeant'), true);
  assert.equal(reminderRecipientMatchesRole({ role: 'bod', positionKeys: ['sergeant-at-arms'] }, 'saa'), true);
  assert.equal(reminderRecipientMatchesRole({ role: 'bod', positionKeys: ['treasurer'] }, 'secretary'), false);
});

test('reminder email templates use the requested subjects and bodies', () => {
  const mom = buildReminderEmail({
    reminder: { reminderType: 'mom_submission', recipientRole: 'secretary', targetName: 'BOD Meeting 2', targetDate: '2026-07-14' },
    recipient: { name: 'Aarav' },
  });
  assert.equal(mom.subject, 'MOM Submission Reminder: BOD Meeting 2');
  assert.match(mom.text, /Dear Rtr\. Aarav/);
  assert.match(mom.text, /create and upload the Minutes of Meeting/);
  assert.match(mom.html, /Rotaract Club of Pune Heritage/);

  const attendance = buildReminderEmail({
    reminder: { reminderType: 'attendance_marking', recipientRole: 'sergeant', targetName: 'Club Assembly', targetDate: '2026-07-14' },
    recipient: { name: 'Meera' },
  });
  assert.equal(attendance.subject, 'Attendance Marking Reminder: Club Assembly');
  assert.match(attendance.text, /complete attendance marking/);
});

test('reminder send state increments and completes after max reminders', () => {
  assert.deepEqual(nextSentState({ remindersSent: 0, maxReminders: 3 }), {
    remindersSent: 1,
    status: 'active',
    completionReason: '',
  });
  assert.deepEqual(nextSentState({ remindersSent: 2, maxReminders: 3 }), {
    remindersSent: 3,
    status: 'completed',
    completionReason: 'max_reminders_sent',
  });
});

test('avenue reporting windows normalize aliases and runtime states', () => {
  const config = normalizeReportingWindowConfig('window-1', {
    recordType: 'avenue_reporting_window',
    avenue: 'CWD',
    targetName: 'Website Launch',
    conductedDate: '2026-07-14',
    windowOpensAt: new Date('2026-07-14T18:30:00.000Z'),
    reportDueAt: new Date('2026-07-17T18:29:00.000Z'),
    lockAt: new Date('2026-07-17T18:30:00.000Z'),
    remindersEnabled: true,
    lockEnabled: true,
  });

  assert.equal(config.reminderType, 'avenue_reporting');
  assert.equal(config.targetType, 'avenue_reporting_window');
  assert.equal(config.source, 'reminders');
  assert.equal(config.avenue, 'CWD');
  assert.deepEqual(config.avenues, ['CWD']);
  assert.deepEqual(config.avenueLabels, ['CWD']);
  assert.equal(config.avenuesLabel, 'CWD');
  assert.equal(config.recipientRole, 'avenue_director');
  assert.deepEqual(config.recipientPositionKeys, ['cwd', 'co-cwd']);
  assert.equal(config.reportingOpensAt, '2026-07-14T18:30:00.000Z');
  assert.equal(config.reportingDueAt, '2026-07-17T18:29:59.999Z');
  assert.equal(config.lockAt, '2026-07-17T18:30:00.000Z');
  assert.equal(reportingWindowRuntimeState(config, Date.parse('2026-07-14T18:29:00.000Z')), 'not_open');
  assert.equal(reportingWindowRuntimeState(config, Date.parse('2026-07-14T18:30:00.000Z')), 'open');
  assert.equal(reportingWindowRuntimeState({ ...config, remindersSent: 1 }, Date.parse('2026-07-15T18:30:00.000Z')), 'active');
  assert.equal(reportingWindowRuntimeState(config, Date.parse('2026-07-17T18:30:00.000Z')), 'lock_due');
});

test('reporting lifecycle uses later IST calendar date of conducted and created dates', () => {
  const beforeEvent = deriveReportingWindowLifecycle({
    conductedDate: '2026-08-09',
    createdAt: '2026-08-05T04:30:00.000Z',
    reportingDueAt: '2026-08-12T18:29:00.000Z',
    lockAt: '2026-08-12T18:30:00.000Z',
  });
  assert.equal(beforeEvent.anchorDate, '2026-08-09');
  assert.equal(beforeEvent.countdownStartAt, '2026-08-09T18:30:00.000Z');
  assert.equal(beforeEvent.reportingDueAt, '2026-08-12T18:29:59.999Z');
  assert.equal(beforeEvent.lockAt, '2026-08-12T18:30:00.000Z');

  const afterEvent = deriveReportingWindowLifecycle({
    conductedDate: '2026-08-09',
    createdAt: '2026-08-11T04:30:00.000Z',
  });
  assert.equal(afterEvent.anchorDate, '2026-08-11');
  assert.equal(afterEvent.countdownStartAt, '2026-08-11T18:30:00.000Z');
  assert.equal(afterEvent.reportingDueAt, '2026-08-14T18:29:59.999Z');
  assert.equal(afterEvent.lockAt, '2026-08-14T18:30:00.000Z');

  const muchLater = deriveReportingWindowLifecycle({
    conductedDate: '2026-08-09',
    createdAt: '2026-08-16T04:30:00.000Z',
  });
  assert.equal(muchLater.anchorDate, '2026-08-16');
  assert.equal(muchLater.countdownStartAt, '2026-08-16T18:30:00.000Z');
  assert.equal(muchLater.reportingDueAt, '2026-08-19T18:29:59.999Z');
  assert.equal(muchLater.lockAt, '2026-08-19T18:30:00.000Z');

  const sameDate = deriveReportingWindowLifecycle({
    conductedDate: '2026-08-09',
    createdAt: '2026-08-09T08:30:00.000Z',
  });
  assert.equal(sameDate.anchorDate, '2026-08-09');
  assert.equal(sameDate.reportingDueAt, '2026-08-12T18:29:59.999Z');
});

test('reporting lifecycle uses IST dates for UTC timestamps near midnight', () => {
  const lifecycle = deriveReportingWindowLifecycle({
    conductedDate: '2026-08-08T20:00:00.000Z',
    createdAt: '2026-08-09T20:00:00.000Z',
  });

  assert.equal(lifecycle.conductedCalendarDate, '2026-08-09');
  assert.equal(lifecycle.createdCalendarDate, '2026-08-10');
  assert.equal(lifecycle.anchorDate, '2026-08-10');
  assert.equal(lifecycle.countdownStartAt, '2026-08-10T18:30:00.000Z');
  assert.equal(lifecycle.reportingDueAt, '2026-08-13T18:29:59.999Z');
  assert.equal(lifecycle.lockAt, '2026-08-13T18:30:00.000Z');
});

test('reporting lifecycle keeps legacy windows from shortening stored deadlines', () => {
  const legacyShort = normalizeReportingWindowConfig('legacy-short', {
    recordType: 'avenue_reporting_window',
    avenue: 'CSD',
    targetName: 'VOX',
    conductedDate: '2026-08-09',
    createdAt: '2026-08-16T04:30:00.000Z',
    reportingOpensAt: '2026-08-09T18:30:00.000Z',
    reportingDueAt: '2026-08-12T18:29:00.000Z',
    lockAt: '2026-08-12T18:30:00.000Z',
    lockEnabled: true,
  });
  assert.equal(legacyShort.anchorDate, '2026-08-16');
  assert.equal(legacyShort.reportingDueAt, '2026-08-19T18:29:59.999Z');
  assert.equal(legacyShort.lockAt, '2026-08-19T18:30:00.000Z');

  const legacyLong = normalizeReportingWindowConfig('legacy-long', {
    recordType: 'avenue_reporting_window',
    avenue: 'CSD',
    targetName: 'Extended Project',
    conductedDate: '2026-08-09',
    createdAt: '2026-08-09T04:30:00.000Z',
    reportingDueAt: '2026-08-20T18:29:59.999Z',
    lockAt: '2026-08-20T18:30:00.000Z',
    lockEnabled: true,
  });
  assert.equal(legacyLong.reportingDueAt, '2026-08-20T18:29:59.999Z');
  assert.equal(legacyLong.lockAt, '2026-08-20T18:30:00.000Z');
});

test('effective reporting lock state honors automatic locks, manual unlocks, and completion', () => {
  const expired = normalizeReportingWindowConfig('expired', {
    recordType: 'avenue_reporting_window',
    avenue: 'CSD',
    targetName: 'Expired Project',
    conductedDate: '2026-08-09',
    createdAt: '2026-08-09T04:30:00.000Z',
    lockEnabled: true,
  });
  const afterLock = Date.parse('2026-08-13T18:30:00.000Z');
  assert.equal(resolveReportingWindowLifecycle(expired, { nowMillis: afterLock }).effectiveLocked, true);
  assert.equal(resolveReportingWindowLifecycle(expired, { nowMillis: afterLock }).runtimeState, 'locked');

  const unlocked = {
    ...expired,
    status: 'unlocked',
    unlockedAt: '2026-08-14T04:30:00.000Z',
  };
  const unlockedState = resolveReportingWindowLifecycle(unlocked, { nowMillis: afterLock });
  assert.equal(unlockedState.effectiveLocked, false);
  assert.equal(unlockedState.manualUnlockActive, true);
  assert.equal(unlockedState.runtimeState, 'active');

  const completed = { ...unlocked, status: 'completed', eventReportStatus: 'recorded' };
  const completedState = resolveReportingWindowLifecycle(completed, { nowMillis: afterLock });
  assert.equal(completedState.runtimeState, 'completed');
  assert.equal(completedState.effectiveLocked, false);
});

test('reporting reminders wait for countdown while BOD queue can open after creation', () => {
  const vox = normalizeReportingWindowConfig('vox', {
    recordType: 'avenue_reporting_window',
    avenue: 'CSD',
    targetName: 'VOX//26',
    conductedDate: '2026-08-09',
    createdAt: '2026-08-16T04:30:00.000Z',
    reportingDueAt: '2026-08-12T18:29:00.000Z',
    lockAt: '2026-08-12T18:30:00.000Z',
    lockEnabled: true,
  });
  const createdDayRead = Date.parse('2026-08-16T06:00:00.000Z');

  assert.equal(reportingWindowRuntimeState(vox, createdDayRead), 'not_open');
  assert.equal(resolveReportingWindowLifecycle(vox, { nowMillis: createdDayRead }).runtimeState, 'open');
  assert.equal(resolveReportingWindowLifecycle(vox, { nowMillis: createdDayRead }).effectiveLocked, false);
});

test('multi-avenue reporting windows normalize arrays, aliases, and recipient unions', () => {
  const config = normalizeReportingWindowConfig('window-multi', {
    recordType: 'avenue_reporting_window',
    avenues: ['International Service', 'RRRO', 'ISD'],
    targetName: 'Joint Fellowship Project',
    conductedDate: '2026-07-14',
    reportingOpensAt: new Date('2026-07-14T18:30:00.000Z'),
    reportingDueAt: new Date('2026-07-17T18:29:00.000Z'),
    lockAt: new Date('2026-07-17T18:30:00.000Z'),
  });

  assert.equal(config.avenue, 'ISD');
  assert.deepEqual(config.avenues, ['ISD', 'RRRO']);
  assert.deepEqual(config.avenueLabels, ['International Service', 'Rotary-Rotaract Relations']);
  assert.equal(config.avenuesLabel, 'ISD + RRRO');
  assert.equal(config.recipientRole, 'avenue_director');
  assert.deepEqual(config.recipientPositionKeys, ['isd', 'co-isd', 'rrro', 'co-rrro']);
  assert.deepEqual(normalizeReportingAvenues(['Club Service', 'CSD', 'bad']), ['CSD']);
  assert.equal(reportingAvenuesLabel(['ISD', 'RRRO']), 'ISD + RRRO');
  assert.deepEqual(reportingWindowRecipientPositionKeys(['ISD', 'RRRO']), ['isd', 'co-isd', 'rrro', 'co-rrro']);
});

test('reporting window avenue arrays reject empty selections and exclusive meeting conflicts', () => {
  const base = {
    recordType: 'avenue_reporting_window',
    avenue: 'CWD',
    targetName: 'Website Launch',
    conductedDate: '2026-07-14',
    reportingOpensAt: new Date('2026-07-14T18:30:00.000Z'),
    reportingDueAt: new Date('2026-07-17T18:29:00.000Z'),
    lockAt: new Date('2026-07-17T18:30:00.000Z'),
  };

  assert.equal(normalizeReportingWindowConfig('empty-array', { ...base, avenues: [] }), null);
  assert.equal(normalizeReportingWindowConfig('invalid-array', { ...base, avenues: ['bad'] }), null);
  assert.equal(normalizeReportingWindowConfig('gbm-conflict', { ...base, avenues: ['GBM', 'ISD'] }), null);
  assert.equal(normalizeReportingWindowConfig('bod-conflict', { ...base, avenues: ['BOD Meeting', 'RRRO'] }), null);

  const gbm = normalizeReportingWindowConfig('gbm', { ...base, avenues: ['General Body Meeting'] });
  assert.equal(gbm.avenue, 'GBM');
  assert.deepEqual(gbm.avenues, ['GBM']);
  assert.equal(gbm.recipientRole, 'secretary');

  const bod = normalizeReportingWindowConfig('bod', { ...base, avenues: ['BOD Meeting'] });
  assert.equal(bod.avenue, 'BOD_MEETING');
  assert.deepEqual(bod.avenues, ['BOD_MEETING']);
  assert.equal(bod.recipientRole, 'secretary');
});

test('reporting window coverage is pending with no event data', () => {
  const coverage = evaluateReportingWindowAvenueCoverage({ avenues: ['ISD', 'RRRO'] }, null);

  assert.deepEqual(coverage.requiredAvenues, ['ISD', 'RRRO']);
  assert.deepEqual(coverage.avenueStatuses, {
    ISD: 'missing_avenue',
    RRRO: 'missing_avenue',
  });
  assert.deepEqual(coverage.reportedAvenues, []);
  assert.deepEqual(coverage.pendingAvenues, ['ISD', 'RRRO']);
  assert.deepEqual(coverage.missingAvenues, ['ISD', 'RRRO']);
  assert.deepEqual(coverage.missingDescriptionAvenues, []);
  assert.equal(coverage.reportedCount, 0);
  assert.equal(coverage.totalAvenues, 2);
  assert.equal(coverage.status, 'pending');
  assert.equal(coverage.complete, false);
});

test('reporting window coverage detects reported and missing avenues independently', () => {
  const coverage = evaluateReportingWindowAvenueCoverage(
    { avenues: ['ISD', 'RRRO'] },
    {
      avenues: ['ISD'],
      avenueDescriptions: { ISD: 'ISD report' },
    },
  );

  assert.deepEqual(coverage.avenueStatuses, {
    ISD: 'reported',
    RRRO: 'missing_avenue',
  });
  assert.deepEqual(coverage.reportedAvenues, ['ISD']);
  assert.deepEqual(coverage.pendingAvenues, ['RRRO']);
  assert.deepEqual(coverage.missingAvenues, ['RRRO']);
  assert.deepEqual(coverage.missingDescriptionAvenues, []);
  assert.equal(coverage.reportedCount, 1);
  assert.equal(coverage.totalAvenues, 2);
  assert.equal(coverage.status, 'partial');
  assert.equal(coverage.complete, false);
});

test('reporting window coverage requires avenue-specific descriptions', () => {
  const coverage = evaluateReportingWindowAvenueCoverage(
    { avenues: ['ISD', 'RRRO'] },
    {
      avenues: ['ISD', 'RRRO'],
      description: 'General report must not count',
      desc: 'General report must not count',
      avenueDescriptions: { ISD: 'ISD report' },
    },
  );

  assert.deepEqual(coverage.avenueStatuses, {
    ISD: 'reported',
    RRRO: 'missing_description',
  });
  assert.deepEqual(coverage.reportedAvenues, ['ISD']);
  assert.deepEqual(coverage.pendingAvenues, ['RRRO']);
  assert.deepEqual(coverage.missingAvenues, []);
  assert.deepEqual(coverage.missingDescriptionAvenues, ['RRRO']);
  assert.equal(coverage.status, 'partial');
  assert.equal(coverage.complete, false);
});

test('reporting reminder pending audience filters reported avenues from live coverage', () => {
  const reminder = { avenues: ['ISD', 'RRRO', 'CMD'], avenue: 'ISD' };
  const coverage = evaluateReportingWindowAvenueCoverage(reminder, {
    avenues: ['ISD', 'RRRO'],
    avenueDescriptions: { ISD: 'ISD report' },
  });

  assert.deepEqual(reportingReminderPendingAvenues(reminder, coverage), ['RRRO', 'CMD']);
  assert.deepEqual(reportingReminderAudienceConfig(reminder, coverage), {
    requiredAvenues: ['ISD', 'RRRO', 'CMD'],
    reportedAvenues: ['ISD'],
    pendingAvenues: ['RRRO', 'CMD'],
    pendingAvenueCount: 2,
    pendingAvenuesLabel: 'RRRO + CMD',
    pendingAvenueStatuses: {
      RRRO: 'missing_description',
      CMD: 'missing_avenue',
    },
    complete: false,
  });
});

test('reporting reminder send envelope uses only pending avenues for subject and body', () => {
  const reminder = {
    reminderType: 'avenue_reporting',
    recipientRole: 'avenue_director',
    targetName: 'Joint Fellowship Project',
    conductedDate: '2026-07-14',
    reportingDueAt: new Date('2026-07-17T18:29:00.000Z'),
    avenue: 'ISD',
    avenues: ['ISD', 'RRRO'],
    avenuesLabel: 'ISD + RRRO',
    bodToolsUrl: 'https://example.test/bod-tools?reportingWindowId=rw1',
  };
  const coverage = evaluateReportingWindowAvenueCoverage(reminder, {
    avenues: ['ISD', 'RRRO'],
    avenueDescriptions: { ISD: 'ISD report' },
  });
  const email = buildReminderEmail({
    reminder: withReportingReminderPendingAudience(reminder, coverage),
    recipient: { name: 'Meera' },
  });

  assert.equal(email.subject, 'Avenue Reporting Window Open: RRRO - Joint Fellowship Project');
  assert.match(email.text, /The RRRO report for "Joint Fellowship Project" is still pending/);
  assert.match(email.text, /- RRRO - report description pending/);
  assert.doesNotMatch(email.subject, /ISD/);
  assert.doesNotMatch(email.text, /ISD \+ RRRO reports/);
});

test('reporting window coverage completes when every required avenue has a specific description', () => {
  const coverage = evaluateReportingWindowAvenueCoverage(
    { avenues: ['ISD', 'RRRO'] },
    {
      avenues: ['ISD', 'RRRO'],
      avenueDescriptions: {
        ISD: 'ISD report',
        RRRO: 'RRRO report',
      },
    },
  );

  assert.deepEqual(coverage.avenueStatuses, {
    ISD: 'reported',
    RRRO: 'reported',
  });
  assert.deepEqual(coverage.reportedAvenues, ['ISD', 'RRRO']);
  assert.deepEqual(coverage.pendingAvenues, []);
  assert.equal(coverage.reportedCount, 2);
  assert.equal(coverage.totalAvenues, 2);
  assert.equal(coverage.status, 'complete');
  assert.equal(coverage.complete, true);
});

test('reporting window coverage ignores extra event avenues and whitespace descriptions', () => {
  const coverage = evaluateReportingWindowAvenueCoverage(
    { avenues: ['ISD', 'RRRO'] },
    {
      avenues: ['ISD', 'RRRO', 'CMD'],
      avenueDescriptions: {
        ISD: 'ISD report',
        RRRO: '   ',
        CMD: 'Extra report',
      },
    },
  );

  assert.deepEqual(coverage.requiredAvenues, ['ISD', 'RRRO']);
  assert.deepEqual(coverage.avenueStatuses, {
    ISD: 'reported',
    RRRO: 'missing_description',
  });
  assert.deepEqual(coverage.reportedAvenues, ['ISD']);
  assert.deepEqual(coverage.missingDescriptionAvenues, ['RRRO']);
  assert.equal(coverage.status, 'partial');
});

test('reporting window coverage supports legacy avenue, aliases, and immutable inputs', () => {
  const reportingWindow = { avenue: 'Club Service' };
  const event = {
    avenues: ['csd'],
    avenueDescriptions: { csd: 'Club Service report' },
    description: 'General report',
  };
  const reportingWindowBefore = JSON.stringify(reportingWindow);
  const eventBefore = JSON.stringify(event);

  const coverage = evaluateReportingWindowAvenueCoverage(reportingWindow, event);

  assert.deepEqual(coverage.requiredAvenues, ['CSD']);
  assert.deepEqual(coverage.avenueStatuses, { CSD: 'reported' });
  assert.equal(coverage.status, 'complete');
  assert.equal(coverage.complete, true);
  assert.equal(JSON.stringify(reportingWindow), reportingWindowBefore);
  assert.equal(JSON.stringify(event), eventBefore);
});

test('reporting window coverage never treats an empty required list as complete', () => {
  const coverage = evaluateReportingWindowAvenueCoverage({}, {
    avenues: ['ISD'],
    avenueDescriptions: { ISD: 'ISD report' },
  });

  assert.deepEqual(coverage.requiredAvenues, []);
  assert.equal(coverage.reportedCount, 0);
  assert.equal(coverage.totalAvenues, 0);
  assert.equal(coverage.status, 'pending');
  assert.equal(coverage.complete, false);
});

test('avenue recipient mapping covers director, secretary, sports, and finance targets', () => {
  assert.deepEqual(avenueRecipientPositionKeys('PDD'), ['pdd', 'co-pdd']);
  assert.deepEqual(avenueRecipientPositionKeys('CSD'), ['csd', 'co-csd']);
  assert.deepEqual(avenueRecipientPositionKeys('CMD'), ['cmd', 'co-cmd']);
  assert.deepEqual(avenueRecipientPositionKeys('ISD'), ['isd', 'co-isd']);
  assert.deepEqual(avenueRecipientPositionKeys('RRRO'), ['rrro', 'co-rrro']);
  assert.deepEqual(avenueRecipientPositionKeys('PRO'), ['pro', 'co-pro']);
  assert.deepEqual(avenueRecipientPositionKeys('DEI'), ['dei', 'co-dei']);
  assert.deepEqual(avenueRecipientPositionKeys('CWD'), ['cwd', 'co-cwd']);
  assert.deepEqual(avenueRecipientPositionKeys('Sports'), ['sports-representative', 'co-sports-representative']);
  assert.deepEqual(avenueRecipientPositionKeys('Finance'), ['treasurer', 'co-treasurer']);
  assert.deepEqual(avenueRecipientPositionKeys('Club Service'), ['csd', 'co-csd']);
  assert.equal(avenueRecipientRole('GBM'), 'secretary');
  assert.equal(avenueRecipientRole('BOD Meeting'), 'secretary');
  assert.deepEqual(avenueRecipientPositionKeys('GBM'), []);
  assert.deepEqual(avenueRecipientPositionKeys('BOD Meeting'), []);
});

test('avenue reporting email uses formal deadline wording', () => {
  const email = buildReminderEmail({
    reminder: {
      reminderType: 'avenue_reporting',
      recipientRole: 'avenue_director',
      avenue: 'CWD',
      targetName: 'Website Launch',
      conductedDate: '2026-07-14',
      reportingDueAt: '2026-07-17T18:29:00.000Z',
      bodToolsUrl: 'https://www.rcph3131.org/bod-tools?reportingWindowId=window-1',
    },
    recipient: { name: 'Dev' },
  });

  assert.equal(email.subject, 'Avenue Reporting Window Open: CWD - Website Launch');
  assert.match(email.text, /Dear Rtr\. Dev/);
  assert.match(email.text, /The reporting window for CWD event, "Website Launch"/);
  assert.match(email.text, /must be reported by 17 July 2026, 11:59 PM/);
  assert.match(email.text, /Click the button below to open the BOD Tools form/);
  assert.match(email.text, /Please do not change the prefilled event name/);
  assert.match(email.html, /Open prefilled BOD Tools form/);
  assert.match(email.text, /portal will automatically close/);
  assert.match(email.html, /Rotaract Club of Pune Heritage/);
});

test('multi-avenue reporting email uses combined code label and deduped grammar', () => {
  const email = buildReminderEmail({
    reminder: {
      reminderType: 'avenue_reporting',
      recipientRole: 'avenue_director',
      avenue: 'ISD',
      avenues: ['ISD', 'RRRO'],
      avenuesLabel: 'ISD + RRRO',
      targetName: 'Joint Fellowship Project',
      conductedDate: '2026-07-14',
      reportingDueAt: '2026-07-17T18:29:00.000Z',
      bodToolsUrl: 'https://www.rcph3131.org/bod-tools?reportingWindowId=window-multi',
    },
    recipient: { name: 'Dev' },
  });

  assert.equal(email.subject, 'Avenue Reporting Window Open: ISD + RRRO - Joint Fellowship Project');
  assert.match(email.text, /The reporting window for the ISD \+ RRRO event, "Joint Fellowship Project"/);
  assert.match(email.html, /ISD \+ RRRO/);
});

test('GBM and BOD Meeting workflow reminders include the exact BOD Tools warning', () => {
  const warning = 'Please first add this meeting/event in BOD Tools using the exact name below if not already present.';
  const mom = buildReminderEmail({
    reminder: {
      reminderType: 'mom_submission',
      recipientRole: 'secretary',
      targetName: 'BOD Meeting 2',
      targetDate: '2026-07-14',
      requiresBodToolsRecord: true,
    },
    recipient: { name: 'Secretary' },
  });
  const attendance = buildReminderEmail({
    reminder: {
      reminderType: 'attendance_marking',
      recipientRole: 'sergeant',
      targetName: 'GBM 1',
      targetDate: '2026-07-14',
      workflowWarning: warning,
    },
    recipient: { name: 'SAA' },
  });

  assert.match(mom.text, new RegExp(warning.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(attendance.text, new RegExp(warning.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('strict workflow matching helpers reject low confidence names and accept marked attendance values', () => {
  assert.equal(normalizedNameSimilarity('Pages of Hope', 'Pages of Hope'), 1);
  assert.ok(normalizedNameSimilarity('Pages of Hope', 'Pages of Hopee') >= 0.85);
  assert.ok(normalizedNameSimilarity('Pages of Hope', 'Completely Different Event') < 0.5);
  assert.equal(attendanceValueIsMarked(true), true);
  assert.equal(attendanceValueIsMarked(false), true);
  assert.equal(attendanceValueIsMarked('Present'), true);
  assert.equal(attendanceValueIsMarked('Absent'), true);
  assert.equal(attendanceValueIsMarked('NA'), false);
});

test('avenue reporting send state does not complete before lock workflow runs', () => {
  assert.deepEqual(nextAvenueReportingSentState({ remindersSent: 2, maxReminders: 3 }), {
    remindersSent: 3,
    status: 'active',
    completionReason: '',
  });
});

test('avenue reporting lock payload uses deterministic lock records', () => {
  const now = new Date('2026-07-17T18:30:00.000Z');
  const lockId = avenueReportingLockId('window/1');
  const payload = avenueReportingLockPayload({
    id: 'window/1',
    avenue: 'CWD',
    avenueLabel: 'CWD',
    avenues: ['CWD'],
    avenueLabels: ['CWD'],
    avenuesLabel: 'CWD',
    targetName: 'Website Launch',
    conductedDate: '2026-07-14',
    reportingDueAt: '2026-07-17T18:29:00.000Z',
  }, now);

  assert.equal(lockId, 'avenueReporting_window_1');
  assert.equal(payload.type, 'avenue_reporting');
  assert.equal(payload.locked, true);
  assert.equal(payload.status, 'active');
  assert.deepEqual(payload.avenues, ['CWD']);
  assert.deepEqual(payload.avenueLabels, ['CWD']);
  assert.equal(payload.avenuesLabel, 'CWD');
  assert.equal(payload.reason, 'reporting_window_expired');
  assert.equal(payload.reportingWindowId, 'window/1');
  assert.equal(payload.lockedBySystem, true);
});

test('reminder template test emails use test labels and placeholder content', () => {
  const mom = buildReminderTemplateTestEmail({ templateType: 'mom_submission' });
  assert.equal(mom.subject, '[TEST] MOM Submission Reminder: Test Event / Meeting');
  assert.match(mom.text, /This is a test reminder email sent from the RCPH admin panel\./);
  assert.match(mom.text, /create and upload the Minutes of Meeting/);

  const attendance = buildReminderTemplateTestEmail({ templateType: 'attendance_marking' });
  assert.equal(attendance.subject, '[TEST] Attendance Marking Reminder: Test Event / Meeting');
  assert.match(attendance.text, /complete attendance marking/);

  const avenue = buildReminderTemplateTestEmail({ templateType: 'avenue_reporting' });
  assert.equal(avenue.subject, '[TEST] Avenue Reporting Window Open: Test Avenue Event');
  assert.match(avenue.text, /The event was conducted on 15 July 2026/);
  assert.match(avenue.text, /18 July 2026, 11:59 PM/);
  assert.match(avenue.text, /Click the button below to open the BOD Tools form/);
  assert.match(avenue.text, /portal will automatically close/);
  assert.match(avenue.html, /Rotaract Club of Pune Heritage/);
});

test('reminder template test types are strict and do not alter scheduled reminder types', () => {
  assert.equal(normalizeReminderTemplateTestType('mom_submission'), 'mom_submission');
  assert.equal(normalizeReminderTemplateTestType('attendance_marking'), 'attendance_marking');
  assert.equal(normalizeReminderTemplateTestType('avenue_reporting'), 'avenue_reporting');
  assert.equal(normalizeReminderTemplateTestType('bad'), '');
  assert.equal(buildReminderTemplateTestEmail({ templateType: 'bad' }), null);
  assert.equal(reminderSkipReason(normalizeReminderConfig('avenue-test', { reminderType: 'avenue_reporting', source: 'events', eventId: 'e1' })), 'invalid_config');
});
