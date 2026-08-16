'use strict';

const {
  AVENUE_REPORTING_LOCK_REASON,
  AVENUE_REPORTING_LOCK_TYPE,
  normalizeAvenueKey,
  normalizeReportingAvenues,
  reportingAvenuesLabel,
  avenueDisplayLabel,
  avenueRecipientPositionKeys,
  reportingWindowRecipientPositionKeys,
  normalizeReportingWindowConfig,
  reportingWindowRuntimeState,
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
  const avenues = normalizeReportingAvenues(Array.isArray(data.avenues) && data.avenues.length ? data.avenues : data.avenue);
  if (!avenues.length) return null;
  const avenue = avenues[0];
  const id = docId(doc);
  const lockId = cleanText(data.lockId, 180)
    || `avenueReporting_${safeAnnouncementIdSegment(id)}`;
  return {
    id,
    lockId,
    avenue,
    avenueLabel: avenueDisplayLabel(avenue),
    avenues,
    avenueLabels: Array.isArray(data.avenueLabels) && data.avenueLabels.length ? data.avenueLabels.map(label => cleanText(label, 120)).filter(Boolean) : avenues.map(avenueDisplayLabel),
    avenuesLabel: cleanText(data.avenuesLabel, 160) || reportingAvenuesLabel(avenues),
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
  const avenues = normalizeReportingAvenues(Array.isArray(data.avenues) && data.avenues.length ? data.avenues : data.avenue);
  if (!avenues.length) return null;
  const avenue = avenues[0];

  return {
    lockId: id,
    id,
    avenue,
    avenueLabel: cleanText(data.avenueLabel, 120) || avenueDisplayLabel(avenue),
    avenues,
    avenueLabels: Array.isArray(data.avenueLabels) && data.avenueLabels.length ? data.avenueLabels.map(label => cleanText(label, 120)).filter(Boolean) : avenues.map(avenueDisplayLabel),
    avenuesLabel: cleanText(data.avenuesLabel, 160) || reportingAvenuesLabel(avenues),
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
    const avenues = lock.avenues?.length ? lock.avenues : (reminder?.avenues?.length ? reminder.avenues : [lock.avenue].filter(Boolean));
    const enriched = {
      ...lock,
      reportingWindowId,
      reminderId: lock.reminderId || reportingWindowId,
      avenueLabel: lock.avenueLabel || reminder?.avenueLabel || avenueDisplayLabel(lock.avenue),
      avenues,
      avenueLabels: lock.avenueLabels?.length ? lock.avenueLabels : (reminder?.avenueLabels?.length ? reminder.avenueLabels : avenues.map(avenueDisplayLabel)),
      avenuesLabel: lock.avenuesLabel || reminder?.avenuesLabel || reportingAvenuesLabel(avenues),
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

function normalizeOpenAvenueReportingWindows({ reminderDocs = [], now = new Date() } = {}) {
  const nowMillis = timestampToMillis(now) || Date.now();
  const byId = new Map();
  for (const doc of reminderDocs) {
    const id = docId(doc);
    const window = normalizeReportingWindowConfig(id, docData(doc));
    if (!window) continue;
    const state = reportingWindowRuntimeState(window, nowMillis);
    if (state !== 'open' && state !== 'active') continue;
    byId.set(window.id, {
      ...window,
      runtimeState: state,
    });
  }

  return Array.from(byId.values())
    .sort((a, b) => String(a.avenuesLabel || a.avenue).localeCompare(String(b.avenuesLabel || b.avenue))
      || (timestampToMillis(a.reportingDueAt) - timestampToMillis(b.reportingDueAt))
      || String(a.id).localeCompare(String(b.id)));
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

function reportingWindowLockDashboardMessage(codes = []) {
  const values = Array.from(new Set(codes.map(code => cleanText(code, 40)).filter(Boolean)));
  const subject = formatAvenueList(values);
  return `${subject} reporting is locked because the reporting deadline was missed. Please ask the President or Admin to unlock this avenue.`;
}

function formatDashboardDueDate(value) {
  const millis = timestampToMillis(value);
  if (!millis) return '';
  const date = new Date(millis);
  return `${date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  })}, ${date.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  }).toUpperCase()}`;
}

function reportingWindowOpenDashboardMessage(avenue, dueAt) {
  const code = normalizeAvenueKey(avenue) || cleanText(avenue, 40) || 'Avenue';
  const dueText = formatDashboardDueDate(dueAt);
  return `${code} reporting window is open. Please submit the event report before the deadline.${dueText ? ` Due by ${dueText}.` : ''}`;
}

function lockedBodAvenuesForPayload(avenues, locks = []) {
  const selected = bodEventSchema.normalizeBodAvenues(avenues);
  const lockedCodes = new Set((Array.isArray(locks) ? locks : [])
    .flatMap(lock => normalizeReportingAvenues(Array.isArray(lock?.avenues) && lock.avenues.length ? lock.avenues : lock?.avenue))
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

function recipientPositionKeysForAvenues(avenues = []) {
  const normalized = normalizeReportingAvenues(avenues);
  const direct = reportingWindowRecipientPositionKeys(normalized);
  if (direct.length) return direct;
  if (normalized.some(key => key === 'GBM' || key === 'BOD_MEETING')) return Array.from(SECRETARY_POSITION_KEYS);
  return [];
}

function positionMatchesLock(positionKeys, lock) {
  const userKeys = new Set(positionKeys);
  return recipientPositionKeysForAvenues(Array.isArray(lock?.avenues) && lock.avenues.length ? lock.avenues : lock?.avenue).some(key => userKeys.has(key));
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
    normalizeReportingAvenues(Array.isArray(lock.avenues) && lock.avenues.length ? lock.avenues : lock.avenue)
      .forEach((avenue) => {
        if (avenue && !lockedAvenues.includes(avenue)) lockedAvenues.push(avenue);
      });
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
    body: reportingWindowLockDashboardMessage(lockedAvenues),
    priority: 'urgent',
    publishedAt: timestampToIso(now) || new Date().toISOString(),
    expiresAt: '',
    read: true,
    dismissible: false,
    lockedAvenues,
    avenuesLabel: reportingAvenuesLabel(lockedAvenues),
    reportingWindowIds: lockedWindowIds,
  };
}

function buildReportingWindowOpenDashboardNotices({ windows = [], reminderDocs = [], positionKeys = [], positionHelpers = defaultPositionHelpers, now = new Date() } = {}) {
  const userKeys = normalizedPositionKeys(positionKeys, positionHelpers);
  if (!userKeys.length) return [];
  const candidates = Array.isArray(windows) && windows.length
    ? windows
    : normalizeOpenAvenueReportingWindows({ reminderDocs, now });

  return candidates
    .filter(window => recipientPositionKeysForAvenues(Array.isArray(window?.avenues) && window.avenues.length ? window.avenues : window?.avenue).some(key => userKeys.includes(key)))
    .map((window) => {
      const avenues = normalizeReportingAvenues(Array.isArray(window.avenues) && window.avenues.length ? window.avenues : window.avenue);
      const avenue = avenues[0] || normalizeAvenueKey(window.avenue) || cleanText(window.avenue, 40);
      const avenuesLabel = cleanText(window.avenuesLabel, 160) || reportingAvenuesLabel(avenues) || avenue;
      const dueAt = window.reportingDueAt || window.reportDueAt;
      const lockAt = window.lockAt || dueAt;
      return {
        id: `reportingWindowOpen_${safeAnnouncementIdSegment(window.id || `${avenue}_${window.targetName}`)}`,
        source: 'reportingWindowOpen',
        title: `${avenuesLabel} reporting window open`,
        body: reportingWindowOpenDashboardMessage(avenuesLabel, dueAt),
        priority: 'important',
        publishedAt: timestampToIso(window.reportingOpensAt || now) || new Date().toISOString(),
        expiresAt: timestampToIso(lockAt),
        read: true,
        dismissible: false,
        openAvenue: avenue,
        openAvenues: avenues,
        avenueLabel: window.avenueLabel || avenueDisplayLabel(avenue),
        avenueLabels: Array.isArray(window.avenueLabels) && window.avenueLabels.length ? window.avenueLabels : avenues.map(avenueDisplayLabel),
        avenuesLabel,
        reportingWindowId: window.id,
        reportingWindowIds: window.id ? [window.id] : [],
        dueAt: timestampToIso(dueAt),
        targetLabel: window.targetName || '',
        conductedDate: window.conductedDate || '',
      };
    });
}

module.exports = {
  normalizeActiveAvenueReportingLockDoc,
  normalizeActiveAvenueReportingLocks,
  normalizeOpenAvenueReportingWindows,
  lockedBodAvenuesForPayload,
  lockedAvenueMessage,
  reportingWindowLockDashboardMessage,
  reportingWindowOpenDashboardMessage,
  assertBodEventAvenuesUnlocked,
  recipientPositionKeysForAvenue,
  recipientPositionKeysForAvenues,
  buildReportingWindowLockDashboardNotice,
  buildReportingWindowOpenDashboardNotices,
};
