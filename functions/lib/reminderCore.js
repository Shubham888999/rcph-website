'use strict';

const {
  SECRETARY_POSITION_KEYS,
  SERGEANT_POSITION_KEYS,
  normalizePositionKeys,
} = require('./momCore');

const REMINDERS_COLLECTION = 'reminders';
const REMINDER_EMAIL_HISTORY_COLLECTION = 'reminderEmailHistory';
const REMINDER_TEMPLATE_TEST_HISTORY_COLLECTION = 'reminderTemplateTestHistory';
const EVENT_REMINDER_RECORD_TYPE = 'event_reminder_config';
const REPORTING_WINDOW_RECORD_TYPE = 'avenue_reporting_window';
const AVENUE_REPORTING_REMINDER_TYPE = 'avenue_reporting';
const AVENUE_REPORTING_LOCK_TYPE = 'avenue_reporting';
const AVENUE_REPORTING_LOCK_REASON = 'reporting_window_expired';
const REPORTING_WINDOW_TIMEZONE = 'Asia/Kolkata';
const REMINDER_DEFAULT_MAX = 3;

const SUPPORTED_REMINDER_TYPES = Object.freeze([
  'mom_submission',
  'attendance_marking',
]);

const REMINDER_TEMPLATE_TEST_TYPES = Object.freeze([
  'mom_submission',
  'attendance_marking',
  'avenue_reporting',
]);

const PROCESSABLE_REMINDER_STATUSES = Object.freeze([
  '',
  'configured',
  'active',
]);

const PROCESSABLE_REPORTING_STATUSES = Object.freeze([
  '',
  'configured',
  'not_open',
  'open',
  'active',
  'failed',
  'no_recipient',
]);

const TERMINAL_REPORTING_STATUSES = Object.freeze([
  'completed',
  'locked',
  'unlocked',
]);

const SOURCE_TARGET_TYPES = Object.freeze({
  events: 'club_event',
  bodMeetings: 'bod_meeting',
  districtEvents: 'district_event',
  bodEvents: 'bod_event',
});

const TARGET_COLLECTIONS = Object.freeze({
  club_event: 'events',
  bod_meeting: 'bodMeetings',
  district_event: 'districtEvents',
  bod_event: 'bodEvents',
});

const REMINDER_RECIPIENT_BY_TYPE = Object.freeze({
  mom_submission: 'secretary',
  attendance_marking: 'sergeant',
});

const AVENUE_LABELS = Object.freeze({
  ISD: 'International Service',
  CMD: 'Community Service',
  CSD: 'Club Service',
  PDD: 'Professional Development',
  RRRO: 'Rotary-Rotaract Relations',
  PRO: 'Public Relations',
  DEI: 'DEI',
  GBM: 'GBM',
  CWD: 'CWD',
  SPORTS: 'Sports',
  FINANCE: 'Finance',
  BOD_MEETING: 'BOD Meeting',
});

const AVENUE_ALIAS_ENTRIES = Object.freeze([
  ['ISD', 'ISD'], ['INTERNATIONAL SERVICE', 'ISD'], ['INTERNATIONAL SERVICE DIRECTOR', 'ISD'],
  ['CMD', 'CMD'], ['COMMUNITY SERVICE', 'CMD'], ['COMMUNITY SERVICE DIRECTOR', 'CMD'],
  ['CSD', 'CSD'], ['CLUB SERVICE', 'CSD'], ['CLUB SERVICE DIRECTOR', 'CSD'],
  ['PDD', 'PDD'], ['PROFESSIONAL DEVELOPMENT', 'PDD'], ['PROFESSIONAL DEVELOPMENT DIRECTOR', 'PDD'],
  ['RRRO', 'RRRO'], ['ROTARY ROTARACT RELATIONS', 'RRRO'], ['ROTARY-ROTARACT RELATIONS', 'RRRO'],
  ['PRO', 'PRO'], ['PR', 'PRO'], ['PUBLIC RELATIONS', 'PRO'], ['PUBLIC RELATIONS DIRECTOR', 'PRO'],
  ['DEI', 'DEI'], ['DIVERSITY EQUITY INCLUSION', 'DEI'], ['DIVERSITY EQUITY AND INCLUSION', 'DEI'],
  ['GBM', 'GBM'], ['GENERAL BODY MEETING', 'GBM'],
  ['CWD', 'CWD'], ['CLUB WEBSITE DIRECTOR', 'CWD'], ['WEBSITE DIRECTOR', 'CWD'],
  ['SPORTS', 'SPORTS'], ['SPORTS DIRECTOR', 'SPORTS'], ['SPORTS REPRESENTATIVE', 'SPORTS'],
  ['FINANCE', 'FINANCE'], ['TREASURY', 'FINANCE'], ['TREASURER', 'FINANCE'], ['FINANCE DIRECTOR', 'FINANCE'],
  ['BOD MEETING', 'BOD_MEETING'], ['BOD_MEETING', 'BOD_MEETING'], ['BOARD MEETING', 'BOD_MEETING'],
]);

const AVENUE_ALIASES = new Map(AVENUE_ALIAS_ENTRIES);

const AVENUE_RECIPIENT_POSITION_KEYS = Object.freeze({
  ISD: Object.freeze(['isd', 'co-isd']),
  CMD: Object.freeze(['cmd', 'co-cmd']),
  CSD: Object.freeze(['csd', 'co-csd']),
  PDD: Object.freeze(['pdd', 'co-pdd']),
  RRRO: Object.freeze(['rrro', 'co-rrro']),
  PRO: Object.freeze(['pro', 'co-pro']),
  DEI: Object.freeze(['dei', 'co-dei']),
  CWD: Object.freeze(['cwd', 'co-cwd']),
  SPORTS: Object.freeze(['sports-representative', 'co-sports-representative']),
  FINANCE: Object.freeze(['treasurer', 'co-treasurer']),
});

const AVENUE_SECRETARY_RECIPIENTS = new Set(['GBM', 'BOD_MEETING']);

function cleanText(value, max = 300) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function cleanLower(value, max = 120) {
  return cleanText(value, max).toLowerCase();
}

function safeDocumentId(value) {
  const id = cleanText(value, 180);
  return /^[A-Za-z0-9_-]{1,180}$/.test(id) ? id : '';
}

function normalizeReminderType(value) {
  const type = cleanLower(value, 80);
  return SUPPORTED_REMINDER_TYPES.includes(type) ? type : '';
}

function normalizeReminderStatus(value) {
  return cleanLower(value, 40) || 'configured';
}

function normalizeAvenueKey(value) {
  const normalized = cleanText(value, 80)
    .toUpperCase()
    .replace(/&/g, ' AND ')
    .replace(/[-/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return AVENUE_ALIASES.get(normalized) || '';
}

function avenueDisplayLabel(value) {
  const key = normalizeAvenueKey(value) || cleanText(value, 80).toUpperCase();
  return AVENUE_LABELS[key] || cleanText(value, 80) || 'Avenue';
}

function avenueRecipientRole(value) {
  const key = normalizeAvenueKey(value);
  if (AVENUE_SECRETARY_RECIPIENTS.has(key)) return 'secretary';
  return 'avenue_director';
}

function avenueRecipientPositionKeys(value) {
  const key = normalizeAvenueKey(value);
  return AVENUE_RECIPIENT_POSITION_KEYS[key] || [];
}

function normalizeReminderRecipientRole(value, reminderType = '') {
  const role = cleanLower(value, 80).replace(/\s+/g, '-');
  if (role === 'saa' || role === 'sergeant' || role === 'sergeant-at-arms') return 'sergeant';
  if (role === 'secretary' || role === 'joint-secretary' || role === 'co-secretary') return 'secretary';
  return REMINDER_RECIPIENT_BY_TYPE[normalizeReminderType(reminderType)] || role;
}

function numericCount(value, fallback = 0) {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? Math.floor(count) : fallback;
}

function timestampDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value.toDate === 'function') {
    const date = value.toDate();
    return date && !Number.isNaN(date.getTime()) ? date : null;
  }
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function timestampMillis(value) {
  const date = timestampDate(value);
  return date ? date.getTime() : 0;
}

function reminderTimestampIso(value) {
  const date = timestampDate(value);
  return date ? date.toISOString() : '';
}

function targetTypeForSource(source) {
  return SOURCE_TARGET_TYPES[cleanText(source, 80)] || '';
}

function collectionForTargetType(targetType) {
  return TARGET_COLLECTIONS[cleanLower(targetType, 80)] || '';
}

function normalizeReminderConfig(id, raw = {}) {
  const reminderType = normalizeReminderType(raw.reminderType || raw.type);
  if (!id || !reminderType) return null;

  const source = cleanText(raw.source || raw.eventSource, 80);
  const targetType = cleanLower(raw.targetType || targetTypeForSource(source), 80);
  const targetId = safeDocumentId(raw.targetId || raw.eventId || raw.eventID);
  const maxReminders = numericCount(raw.maxReminders, REMINDER_DEFAULT_MAX) || REMINDER_DEFAULT_MAX;

  return {
    id,
    recordType: cleanText(raw.recordType, 80) || EVENT_REMINDER_RECORD_TYPE,
    source,
    targetType,
    targetId,
    targetName: cleanText(raw.targetName || raw.eventName || raw.name, 180),
    targetDate: cleanText(raw.targetDate || raw.conductedDate || raw.eventDate || raw.date || raw.startDate, 40),
    reminderType,
    recipientRole: normalizeReminderRecipientRole(raw.recipientRole, reminderType),
    enabled: raw.enabled !== false && raw.disabled !== true,
    status: normalizeReminderStatus(raw.status),
    remindersSent: numericCount(raw.remindersSent, 0),
    maxReminders,
    reminderTime: cleanText(raw.reminderTime, 20) || '00:00',
    lastReminderSentAt: reminderTimestampIso(raw.lastReminderSentAt),
    completedAt: reminderTimestampIso(raw.completedAt),
    stoppedAt: reminderTimestampIso(raw.stoppedAt),
    completionReason: cleanText(raw.completionReason || raw.stoppedReason || raw.failureReason, 160),
    failureReason: cleanText(raw.failureReason, 160),
    createdBy: cleanText(raw.createdBy, 160),
    updatedAt: reminderTimestampIso(raw.updatedAt),
    createdAt: reminderTimestampIso(raw.createdAt),
  };
}

function normalizeReportingWindowConfig(id, raw = {}) {
  const recordType = cleanText(raw.recordType || raw.type, 80);
  if (!id || recordType !== REPORTING_WINDOW_RECORD_TYPE) return null;
  const avenueKey = normalizeAvenueKey(raw.avenue);
  const conductedDate = cleanText(raw.conductedDate || raw.eventConductedDate || raw.targetDate, 40);
  const reportingOpensAt = raw.reportingOpensAt || raw.windowOpensAt;
  const reportingDueAt = raw.reportingDueAt || raw.reportDueAt;
  const lockAt = raw.lockAt;
  const targetName = cleanText(raw.targetName || raw.eventName || raw.name, 180) || `${avenueDisplayLabel(avenueKey)} event`;
  const maxReminders = numericCount(raw.maxReminders, REMINDER_DEFAULT_MAX) || REMINDER_DEFAULT_MAX;
  if (!avenueKey || !conductedDate || !timestampMillis(reportingOpensAt) || !timestampMillis(reportingDueAt) || !timestampMillis(lockAt)) return null;

  return {
    id,
    recordType: REPORTING_WINDOW_RECORD_TYPE,
    type: REPORTING_WINDOW_RECORD_TYPE,
    reminderType: AVENUE_REPORTING_REMINDER_TYPE,
    source: 'reminders',
    targetType: AVENUE_REPORTING_REMINDER_TYPE,
    targetId: id,
    avenue: avenueKey,
    avenueLabel: avenueDisplayLabel(avenueKey),
    targetName,
    eventName: targetName,
    targetDate: conductedDate,
    conductedDate,
    eventConductedDate: conductedDate,
    eventTime: cleanText(raw.eventTime, 20),
    reportingOpensAt: reminderTimestampIso(reportingOpensAt),
    reportingOpensAtMillis: timestampMillis(reportingOpensAt),
    windowOpensAt: reminderTimestampIso(reportingOpensAt),
    reportingDueAt: reminderTimestampIso(reportingDueAt),
    reportingDueAtMillis: timestampMillis(reportingDueAt),
    reportDueAt: reminderTimestampIso(reportingDueAt),
    lockAt: reminderTimestampIso(lockAt),
    lockAtMillis: timestampMillis(lockAt),
    timezone: cleanText(raw.timezone, 80) || REPORTING_WINDOW_TIMEZONE,
    remindersEnabled: raw.remindersEnabled === true,
    lockEnabled: raw.lockEnabled === true,
    enabled: raw.remindersEnabled === true,
    status: normalizeReminderStatus(raw.status),
    remindersSent: numericCount(raw.remindersSent, 0),
    maxReminders,
    recipientRole: avenueRecipientRole(avenueKey),
    recipientPositionKeys: avenueRecipientPositionKeys(avenueKey),
    lastReminderSentAt: reminderTimestampIso(raw.lastReminderSentAt),
    completedAt: reminderTimestampIso(raw.completedAt),
    lockedAt: reminderTimestampIso(raw.lockedAt),
    unlockedAt: reminderTimestampIso(raw.unlockedAt),
    lockId: cleanText(raw.lockId, 180) || avenueReportingLockId(id),
    completionReason: cleanText(raw.completionReason || raw.stoppedReason || raw.failureReason, 160),
    failureReason: cleanText(raw.failureReason, 160),
    lockReason: cleanText(raw.lockReason, 160),
    createdBy: cleanText(raw.createdBy, 160),
    updatedAt: reminderTimestampIso(raw.updatedAt),
    createdAt: reminderTimestampIso(raw.createdAt),
  };
}

function reminderSkipReason(config) {
  if (!config) return 'invalid_config';
  if (config.recordType && config.recordType !== EVENT_REMINDER_RECORD_TYPE) return 'not_event_reminder';
  if (!SUPPORTED_REMINDER_TYPES.includes(config.reminderType)) return 'unsupported_type';
  if (!config.enabled) return 'disabled';
  if (!PROCESSABLE_REMINDER_STATUSES.includes(config.status)) return config.status || 'inactive';
  if (!collectionForTargetType(config.targetType) || !config.targetId) return 'invalid_target';
  if (config.remindersSent >= config.maxReminders) return 'max_reminders_reached';
  return '';
}

function reportingWindowSkipReason(config) {
  if (!config) return 'invalid_config';
  if (config.recordType !== REPORTING_WINDOW_RECORD_TYPE) return 'not_reporting_window';
  if (TERMINAL_REPORTING_STATUSES.includes(config.status)) return config.status;
  if (!PROCESSABLE_REPORTING_STATUSES.includes(config.status)) return config.status || 'inactive';
  if (!config.reportingOpensAtMillis || !config.reportingDueAtMillis || !config.lockAtMillis) return 'invalid_window';
  return '';
}

function reportingWindowRuntimeState(config, nowMillis) {
  const skipReason = reportingWindowSkipReason(config);
  if (skipReason) return skipReason;
  if (nowMillis < config.reportingOpensAtMillis) return 'not_open';
  if (nowMillis >= config.lockAtMillis) return 'lock_due';
  return config.remindersSent > 0 ? 'active' : 'open';
}

function targetCollectionForReminder(config) {
  return collectionForTargetType(config?.targetType || targetTypeForSource(config?.source));
}

function targetNameFromData(config = {}, data = {}) {
  return cleanText(config.targetName || data.name || data.title || 'RCPH event/meeting', 180);
}

function targetDateFromData(config = {}, data = {}) {
  return cleanText(config.targetDate || data.date || data.eventStart || data.startDate || data.eventDate, 40);
}

function hasMomMetadata(data = {}) {
  return Boolean(
    cleanText(data.momDriveFileId, 180)
      && (
        cleanText(data.momFileName, 180)
        || data.momUploadedAt
        || data.momUpdatedAt
      ),
  );
}

function hasAnyPositionKey(positionKeys, allowedKeys) {
  return normalizePositionKeys(positionKeys).some(key => allowedKeys.has(key));
}

function reminderRecipientMatchesRole(recipient = {}, recipientRole = '') {
  const role = cleanLower(recipient.role || recipient.storedRole, 80).replace(/\s+/g, '-');
  const normalizedRole = normalizeReminderRecipientRole(recipientRole);
  const positionKeys = normalizePositionKeys(recipient.positionKeys);

  if (normalizedRole === 'secretary') {
    return role === 'secretary' || hasAnyPositionKey(positionKeys, SECRETARY_POSITION_KEYS);
  }

  if (normalizedRole === 'sergeant') {
    return ['saa', 'sergeant', 'sergeant-at-arms'].includes(role)
      || hasAnyPositionKey(positionKeys, SERGEANT_POSITION_KEYS);
  }

  return role === normalizedRole;
}

function recipientRoleLabel(recipientRole) {
  const role = normalizeReminderRecipientRole(recipientRole);
  if (role === 'secretary') return 'Secretary';
  if (role === 'sergeant') return 'Sergeant-at-Arms';
  return cleanText(recipientRole, 80) || 'recipient';
}

function formatReminderDate(value) {
  const text = cleanText(value, 80);
  if (!text) return 'the conducted date';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? new Date(`${text}T00:00:00+05:30`)
    : new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: REPORTING_WINDOW_TIMEZONE,
  });
}

function formatReminderDueDate(value) {
  const date = timestampDate(value);
  if (!date) return 'the due date';
  return `${date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: REPORTING_WINDOW_TIMEZONE,
  })}, ${date.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: REPORTING_WINDOW_TIMEZONE,
  }).toUpperCase()}`;
}

function escapeEmailHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildReminderBody({ reminder, recipient }) {
  const targetName = cleanText(reminder.targetName, 180) || 'RCPH event/meeting';
  const recipientName = cleanText(recipient?.name, 180) || recipientRoleLabel(reminder.recipientRole);

  if (reminder.reminderType === AVENUE_REPORTING_REMINDER_TYPE) {
    const avenue = avenueDisplayLabel(reminder.avenue || reminder.avenueLabel);
    const itemNoun = ['GBM', 'BOD_MEETING'].includes(normalizeAvenueKey(reminder.avenue)) ? 'record' : 'event';
    return {
      subject: `Avenue Reporting Window Open: ${avenue} - ${targetName}`,
      text: [
        `Dear Rtr. ${recipientName},`,
        '',
        `The reporting window for ${avenue} ${itemNoun}, "${targetName}", is now open on the Club Website.`,
        '',
        `The event was conducted on ${formatReminderDate(reminder.conductedDate || reminder.targetDate)} and must be reported by ${formatReminderDueDate(reminder.reportingDueAt || reminder.reportDueAt)}.`,
        '',
        'Upon expiry of the prescribed reporting period, the portal will automatically close and no further submissions shall be accepted without administrative approval. Consequently, the Secretary may not be able to consider or report the event to the District.',
        '',
        'You are requested to complete the reporting within the stipulated timeline.',
        '',
        'Regards,',
        'Rotaract Club of Pune Heritage',
      ].join('\n'),
    };
  }

  if (reminder.reminderType === 'mom_submission') {
    return {
      subject: `MOM Submission Reminder: ${targetName}`,
      text: [
        `Dear Rtr. ${recipientName},`,
        '',
        `This is a reminder to create and upload the Minutes of Meeting for "${targetName}" on the Club Website.`,
        '',
        'You are requested to complete the MOM submission at the earliest so that the event/meeting records remain updated and accessible to the Board.',
        '',
        'Regards,',
        'Rotaract Club of Pune Heritage',
      ].join('\n'),
    };
  }

  return {
    subject: `Attendance Marking Reminder: ${targetName}`,
    text: [
      `Dear Rtr. ${recipientName},`,
      '',
      `This is a reminder to complete attendance marking for "${targetName}" on the Club Website.`,
      '',
      'You are requested to update the attendance records at the earliest so that the club records remain accurate and complete.',
      '',
      'Regards,',
      'Rotaract Club of Pune Heritage',
    ].join('\n'),
  };
}

function buildReminderEmail({ reminder, recipient }) {
  const body = buildReminderBody({ reminder, recipient });
  const safeText = escapeEmailHtml(body.text).replace(/\r?\n/g, '<br>');
  const targetName = cleanText(reminder.targetName, 180) || 'RCPH event/meeting';
  return {
    subject: body.subject,
    text: body.text,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#172124;background:#f6fbfb;padding:24px;">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dce8e8;border-radius:12px;padding:24px;">
          <p style="margin:0 0 10px;color:#0f766e;font-weight:800;letter-spacing:.04em;text-transform:uppercase;">Rotaract Club of Pune Heritage</p>
          <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#111827;">${escapeEmailHtml(body.subject)}</h1>
          <p style="margin:0 0 8px;color:#243133;"><strong>Event/meeting:</strong> ${escapeEmailHtml(targetName)}</p>
          <p style="margin:0 0 8px;color:#243133;"><strong>Conducted date:</strong> ${escapeEmailHtml(formatReminderDate(reminder.conductedDate || reminder.targetDate))}</p>
          ${reminder.reminderType === AVENUE_REPORTING_REMINDER_TYPE ? `<p style="margin:0 0 18px;color:#243133;"><strong>Due:</strong> ${escapeEmailHtml(formatReminderDueDate(reminder.reportingDueAt || reminder.reportDueAt))}</p>` : ''}
          <div style="font-size:16px;color:#243133;">${safeText}</div>
        </div>
      </div>
    `,
  };
}

function normalizeReminderTemplateTestType(value) {
  const type = cleanLower(value, 80);
  return REMINDER_TEMPLATE_TEST_TYPES.includes(type) ? type : '';
}

function buildTestReminderEnvelope({ subject, text }) {
  const safeText = escapeEmailHtml(text).replace(/\r?\n/g, '<br>');
  return {
    subject,
    text,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#172124;background:#f6fbfb;padding:24px;">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dce8e8;border-radius:12px;padding:24px;">
          <p style="margin:0 0 10px;color:#0f766e;font-weight:800;letter-spacing:.04em;text-transform:uppercase;">Rotaract Club of Pune Heritage</p>
          <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#111827;">${escapeEmailHtml(subject)}</h1>
          <div style="font-size:16px;color:#243133;">${safeText}</div>
        </div>
      </div>
    `,
  };
}

function buildReminderTemplateTestEmail({ templateType } = {}) {
  const type = normalizeReminderTemplateTestType(templateType);
  if (!type) return null;

  if (type === 'avenue_reporting') {
    return buildTestReminderEnvelope({
      subject: '[TEST] Avenue Reporting Window Open: Test Avenue Event',
      text: [
        'Dear Rtr. Test Recipient,',
        '',
        'This is a test reminder email sent from the RCPH admin panel.',
        '',
        'The reporting window for Test Avenue event, "Test Event / Meeting", is now open on the Club Website.',
        '',
        'The event was conducted on 15 July 2026 and must be reported by 18 July 2026, 11:59 PM.',
        '',
        'Upon expiry of the prescribed reporting period, the portal will automatically close and no further submissions shall be accepted without administrative approval. Consequently, the Secretary may not be able to consider or report the event to the District.',
        '',
        'You are requested to complete the reporting within the stipulated timeline.',
        '',
        'Regards,',
        'Rotaract Club of Pune Heritage',
      ].join('\n'),
    });
  }

  if (type === 'attendance_marking') {
    return buildTestReminderEnvelope({
      subject: '[TEST] Attendance Marking Reminder: Test Event / Meeting',
      text: [
        'Dear Rtr. Test Recipient,',
        '',
        'This is a test reminder email sent from the RCPH admin panel.',
        '',
        'This is a reminder to complete attendance marking for "Test Event / Meeting" on the Club Website.',
        '',
        'You are requested to update the attendance records at the earliest so that the club records remain accurate and complete.',
        '',
        'Regards,',
        'Rotaract Club of Pune Heritage',
      ].join('\n'),
    });
  }

  return buildTestReminderEnvelope({
    subject: '[TEST] MOM Submission Reminder: Test Event / Meeting',
    text: [
      'Dear Rtr. Test Recipient,',
      '',
      'This is a test reminder email sent from the RCPH admin panel.',
      '',
      'This is a reminder to create and upload the Minutes of Meeting for "Test Event / Meeting" on the Club Website.',
      '',
      'You are requested to complete the MOM submission at the earliest so that the event/meeting records remain updated and accessible to the Board.',
      '',
      'Regards,',
      'Rotaract Club of Pune Heritage',
    ].join('\n'),
  });
}

function nextSentState(config) {
  const remindersSent = Math.min(config.maxReminders, config.remindersSent + 1);
  return {
    remindersSent,
    status: remindersSent >= config.maxReminders ? 'completed' : 'active',
    completionReason: remindersSent >= config.maxReminders ? 'max_reminders_sent' : '',
  };
}

function nextAvenueReportingSentState(config) {
  const remindersSent = Math.min(config.maxReminders, config.remindersSent + 1);
  return {
    remindersSent,
    status: 'active',
    completionReason: '',
  };
}

function avenueReportingLockId(reminderId) {
  const safeId = cleanText(reminderId, 180).replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 150);
  return `avenueReporting_${safeId || 'window'}`;
}

function avenueReportingLockPayload(reminder, now) {
  return {
    type: AVENUE_REPORTING_LOCK_TYPE,
    locked: true,
    status: 'active',
    avenue: reminder.avenue,
    avenueLabel: reminder.avenueLabel,
    targetName: reminder.targetName,
    eventName: reminder.targetName,
    conductedDate: reminder.conductedDate,
    dueAt: now && reminder.reportingDueAt ? new Date(reminder.reportingDueAt) : reminder.reportingDueAt,
    lockedAt: now,
    lockedBySystem: true,
    reminderId: reminder.id,
    reportingWindowId: reminder.id,
    reason: AVENUE_REPORTING_LOCK_REASON,
    updatedAt: now,
  };
}

module.exports = {
  REMINDERS_COLLECTION,
  REMINDER_EMAIL_HISTORY_COLLECTION,
  REMINDER_TEMPLATE_TEST_HISTORY_COLLECTION,
  EVENT_REMINDER_RECORD_TYPE,
  REPORTING_WINDOW_RECORD_TYPE,
  AVENUE_REPORTING_REMINDER_TYPE,
  AVENUE_REPORTING_LOCK_TYPE,
  AVENUE_REPORTING_LOCK_REASON,
  REPORTING_WINDOW_TIMEZONE,
  REMINDER_DEFAULT_MAX,
  SUPPORTED_REMINDER_TYPES,
  REMINDER_TEMPLATE_TEST_TYPES,
  REMINDER_RECIPIENT_BY_TYPE,
  AVENUE_LABELS,
  AVENUE_RECIPIENT_POSITION_KEYS,
  cleanText,
  cleanLower,
  safeDocumentId,
  normalizeAvenueKey,
  avenueDisplayLabel,
  avenueRecipientRole,
  avenueRecipientPositionKeys,
  normalizeReminderRecipientRole,
  normalizeReminderConfig,
  normalizeReportingWindowConfig,
  reminderSkipReason,
  reportingWindowSkipReason,
  reportingWindowRuntimeState,
  targetCollectionForReminder,
  targetNameFromData,
  targetDateFromData,
  hasMomMetadata,
  reminderRecipientMatchesRole,
  recipientRoleLabel,
  buildReminderEmail,
  normalizeReminderTemplateTestType,
  buildReminderTemplateTestEmail,
  nextSentState,
  nextAvenueReportingSentState,
  avenueReportingLockId,
  avenueReportingLockPayload,
};
