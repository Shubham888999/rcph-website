'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  normalizeReminderConfig,
  normalizeReportingWindowConfig,
  reminderSkipReason,
  reportingWindowRuntimeState,
  hasMomMetadata,
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
  assert.equal(config.avenue, 'CWD');
  assert.equal(config.recipientRole, 'avenue_director');
  assert.deepEqual(config.recipientPositionKeys, ['cwd', 'co-cwd']);
  assert.equal(config.reportingOpensAt, '2026-07-14T18:30:00.000Z');
  assert.equal(config.reportingDueAt, '2026-07-17T18:29:00.000Z');
  assert.equal(config.lockAt, '2026-07-17T18:30:00.000Z');
  assert.equal(reportingWindowRuntimeState(config, Date.parse('2026-07-14T18:29:00.000Z')), 'not_open');
  assert.equal(reportingWindowRuntimeState(config, Date.parse('2026-07-14T18:30:00.000Z')), 'open');
  assert.equal(reportingWindowRuntimeState({ ...config, remindersSent: 1 }, Date.parse('2026-07-15T18:30:00.000Z')), 'active');
  assert.equal(reportingWindowRuntimeState(config, Date.parse('2026-07-17T18:30:00.000Z')), 'lock_due');
});

test('avenue recipient mapping covers director, secretary, sports, and finance targets', () => {
  assert.deepEqual(avenueRecipientPositionKeys('CWD'), ['cwd', 'co-cwd']);
  assert.deepEqual(avenueRecipientPositionKeys('Club Service'), ['csd', 'co-csd']);
  assert.deepEqual(avenueRecipientPositionKeys('Sports'), ['sports-representative', 'co-sports-representative']);
  assert.deepEqual(avenueRecipientPositionKeys('Finance'), ['treasurer', 'co-treasurer']);
  assert.equal(avenueRecipientRole('GBM'), 'secretary');
  assert.equal(avenueRecipientRole('BOD Meeting'), 'secretary');
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
    },
    recipient: { name: 'Dev' },
  });

  assert.equal(email.subject, 'Avenue Reporting Window Open: CWD - Website Launch');
  assert.match(email.text, /Dear Rtr\. Dev/);
  assert.match(email.text, /The reporting window for CWD event, "Website Launch"/);
  assert.match(email.text, /must be reported by 17 July 2026, 11:59 PM/);
  assert.match(email.text, /portal will automatically close/);
  assert.match(email.html, /Rotaract Club of Pune Heritage/);
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
    targetName: 'Website Launch',
    conductedDate: '2026-07-14',
    reportingDueAt: '2026-07-17T18:29:00.000Z',
  }, now);

  assert.equal(lockId, 'avenueReporting_window_1');
  assert.equal(payload.type, 'avenue_reporting');
  assert.equal(payload.locked, true);
  assert.equal(payload.status, 'active');
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
