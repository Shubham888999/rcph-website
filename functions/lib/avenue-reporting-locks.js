'use strict';

const {
  AVENUE_REPORTING_LOCK_REASON,
  AVENUE_REPORTING_LOCK_TYPE,
  normalizeAvenueKey,
  avenueDisplayLabel,
  avenueRecipientPositionKeys,
} = require('./reminderCore');
const { SECRETARY_POSITION_KEYS } = require('./momCore');
const bodEventSchema = require('./bod-event-schema');
const defaultPositionHelpers = require('./positions');

const BOD_AVENUE_CODE_SET = new Set(bodEventSchema.BOD_AVENUE_CODES);

function cleanText(value, max = 300) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function cleanLower(value, max = 120) {
  return cleanText(value, max).toLowerCase();
}

function docId(doc) {
  return cleanText(doc?.id || doc?.ref?.id, 180);
}

function docData(doc) {
  if (!doc) return {};
  if (typeof doc.data === 'function') return doc.data() || {};
  return doc.data && typeof doc.data === 'object' ? doc.data : {};
}

function timestampToMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function timestampToIso(value) {
  const millis = timestampToMillis(value);
  return millis ? new Date(millis).toISOString() : '';
}

function safeAnnouncementIdSegment(value) {
  return cleanText(value, 180)
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 96) || 'window';
}

function normalizeReminderDoc(doc) {
  const data = docData(doc);
  const recordType = cleanText(data.recordType || data.type, 80);
  if (recordType !== 'avenue_reporting_window') return null;
  const avenue = normalizeAvenueKey(data.avenue);
  if (!avenue) return null;
  const id = docId(doc);
  const lockId = cleanText(data.lockId, 180)
    || `avenueReporting_${safeAnnouncementIdSegment(id)}`;
  return {
    id,
    lockId,
    avenue,
    avenueLabel: avenueDisplayLabel(avenue),
    targetName: cleanText(data.targetName || data.eventName || data.name, 180),
    conductedDate: cleanText(data.conductedDate || data.eventConductedDate || data.targetDate, 40),
    reportingDueAt: data.reportingDueAt || data.reportDueAt || null,
  };
}

function normalizeActiveAvenueReportingLockDoc(doc) {
  const id = docId(doc);
  const data = docData(doc);
  if (!id || data.locked !== true) return null;
  if (cleanText(data.type, 80) !== AVENUE_REPORTING_LOCK_TYPE) return null;
  if (cleanLower(data.status, 40) !== 'active') return null;
  const reason = cleanText(data.reason, 160);
  if (reason && reason !== AVENUE_REPORTING_LOCK_REASON) return null;
  const avenue = normalizeAvenueKey(data.avenue);
  if (!avenue) return null;

  return {
    lockId: id,
    id,
    avenue,
    avenueLabel: cleanText(data.avenueLabel, 120) || avenueDisplayLabel(avenue),
    reportingWindowId: cleanText(data.reportingWindowId || data.reminderId, 180),
    reminderId: cleanText(data.reminderId || data.reportingWindowId, 180),
    targetName: cleanText(data.targetName || data.eventName || data.name, 180),
    conductedDate: cleanText(data.conductedDate || data.eventConductedDate || data.targetDate, 40),
    dueAt: data.dueAt || data.reportingDueAt || data.reportDueAt || null,
    lockedAt: data.lockedAt || data.createdAt || data.updatedAt || null,
    reason: reason || AVENUE_REPORTING_LOCK_REASON,
  };
}

function normalizeActiveAvenueReportingLocks({ lockDocs = [], reminderDocs = [] } = {}) {
  const reminders = new Map();
  for (const doc of reminderDocs) {
    const reminder = normalizeReminderDoc(doc);
    if (!reminder) continue;
    if (reminder.id) reminders.set(reminder.id, reminder);
    if (reminder.lockId) reminders.set(reminder.lockId, reminder);
  }

  const byKey = new Map();
  for (const doc of lockDocs) {
    const lock = normalizeActiveAvenueReportingLockDoc(doc);
    if (!lock) continue;
    const reminder = reminders.get(lock.reportingWindowId)
      || reminders.get(lock.reminderId)
      || reminders.get(lock.lockId)
      || null;
    const reportingWindowId = lock.reportingWindowId || reminder?.id || lock.reminderId || '';
    const enriched = {
      ...lock,
      reportingWindowId,
      reminderId: lock.reminderId || reportingWindowId,
      avenueLabel: lock.avenueLabel || reminder?.avenueLabel || avenueDisplayLabel(lock.avenue),
      targetName: lock.targetName || reminder?.targetName || '',
      conductedDate: lock.conductedDate || reminder?.conductedDate || '',
      dueAt: lock.dueAt || reminder?.reportingDueAt || null,
    };
    const key = `${enriched.avenue}:${enriched.reportingWindowId || enriched.lockId}`;
    byKey.set(key, enriched);
  }

  return Array.from(byKey.values())
    .sort((a, b) => String(a.avenue).localeCompare(String(b.avenue))
      || String(a.reportingWindowId || a.lockId).localeCompare(String(b.reportingWindowId || b.lockId)));
}

function formatAvenueList(codes = []) {
  const values = Array.from(new Set(codes.map(code => cleanText(code, 40)).filter(Boolean)));
  if (values.length <= 1) return values[0] || 'Selected avenue';
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`;
}

function lockedAvenueMessage(codes = []) {
  const values = Array.from(new Set(codes.map(code => cleanText(code, 40)).filter(Boolean)));
  const subject = formatAvenueList(values);
  return `${subject} ${values.length === 1 ? 'is' : 'are'} locked due to missed reporting window. Ask President or Admin to unlock.`;
}

function lockedBodAvenuesForPayload(avenues, locks = []) {
  const selected = bodEventSchema.normalizeBodAvenues(avenues);
  const lockedCodes = new Set((Array.isArray(locks) ? locks : [])
    .map(lock => normalizeAvenueKey(lock?.avenue))
    .filter(code => BOD_AVENUE_CODE_SET.has(code)));
  return selected.filter(code => lockedCodes.has(code));
}

function assertBodEventAvenuesUnlocked({ avenues, locks, HttpsError }) {
  const lockedAvenues = lockedBodAvenuesForPayload(avenues, locks);
  if (!lockedAvenues.length) return;
  throw new HttpsError('failed-precondition', lockedAvenueMessage(lockedAvenues), {
    lockedAvenues,
    reason: AVENUE_REPORTING_LOCK_REASON,
  });
}

function normalizedPositionKeys(positionKeys, positionHelpers = defaultPositionHelpers) {
  const normalizer = positionHelpers?.normalizePositionKeys;
  if (typeof normalizer !== 'function') {
    return Array.isArray(positionKeys) ? positionKeys.map(key => cleanLower(key, 80)).filter(Boolean) : [];
  }
  const normalized = normalizer(positionKeys || []);
  if (Array.isArray(normalized)) return normalized.map(key => cleanLower(key, 80)).filter(Boolean);
  if (Array.isArray(normalized?.positionKeys)) return normalized.positionKeys.map(key => cleanLower(key, 80)).filter(Boolean);
  return [];
}

function recipientPositionKeysForAvenue(avenue) {
  const key = normalizeAvenueKey(avenue);
  const direct = avenueRecipientPositionKeys(key);
  if (direct.length) return direct;
  if (key === 'GBM' || key === 'BOD_MEETING') return Array.from(SECRETARY_POSITION_KEYS);
  return [];
}

function positionMatchesLock(positionKeys, lock) {
  const userKeys = new Set(positionKeys);
  return recipientPositionKeysForAvenue(lock?.avenue).some(key => userKeys.has(key));
}

function buildReportingWindowLockDashboardNotice({ locks = [], positionKeys = [], positionHelpers = defaultPositionHelpers, now = new Date() } = {}) {
  const userKeys = normalizedPositionKeys(positionKeys, positionHelpers);
  if (!userKeys.length) return null;
  const relevantLocks = (Array.isArray(locks) ? locks : [])
    .filter(lock => positionMatchesLock(userKeys, lock));
  if (!relevantLocks.length) return null;

  const lockedAvenues = [];
  const lockedWindowIds = [];
  for (const lock of relevantLocks) {
    const avenue = normalizeAvenueKey(lock.avenue);
    if (avenue && !lockedAvenues.includes(avenue)) lockedAvenues.push(avenue);
    const windowId = cleanText(lock.reportingWindowId || lock.reminderId || lock.lockId, 180);
    if (windowId && !lockedWindowIds.includes(windowId)) lockedWindowIds.push(windowId);
  }

  if (!lockedAvenues.length) return null;
  const idSegment = safeAnnouncementIdSegment(lockedAvenues.join('_'));
  return {
    id: `reportingWindowLock_${idSegment}`,
    source: 'reportingWindowLock',
    title: lockedAvenues.length === 1
      ? `${lockedAvenues[0]} reporting window locked`
      : `${formatAvenueList(lockedAvenues)} reporting windows locked`,
    body: lockedAvenueMessage(lockedAvenues),
    priority: 'urgent',
    publishedAt: timestampToIso(now) || new Date().toISOString(),
    expiresAt: '',
    read: true,
    dismissible: false,
    lockedAvenues,
    reportingWindowIds: lockedWindowIds,
  };
}

module.exports = {
  normalizeActiveAvenueReportingLockDoc,
  normalizeActiveAvenueReportingLocks,
  lockedBodAvenuesForPayload,
  lockedAvenueMessage,
  assertBodEventAvenuesUnlocked,
  recipientPositionKeysForAvenue,
  buildReportingWindowLockDashboardNotice,
};
