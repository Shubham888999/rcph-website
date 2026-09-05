'use strict';

const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const { logger } = require('firebase-functions');
const { HttpsError, onCall } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const positionHelpers = require('./positions');
const {
  REMINDERS_COLLECTION,
  REMINDER_EMAIL_HISTORY_COLLECTION,
  REMINDER_TEMPLATE_TEST_HISTORY_COLLECTION,
  EVENT_REMINDER_RECORD_TYPE,
  REPORTING_WINDOW_RECORD_TYPE,
  AVENUE_REPORTING_REMINDER_TYPE,
  AVENUE_REPORTING_LOCK_REASON,
  REMINDER_DEFAULT_MAX,
  GBM_BOD_TOOLS_RECORD_WARNING,
  cleanLower,
  cleanText,
  safeDocumentId,
  normalizeAvenueKey,
  normalizeReportingAvenues,
  reportingAvenuesLabel,
  reportingWindowRecipientPositionKeys,
  avenueDisplayLabel,
  avenueRecipientPositionKeys,
  reportingReminderAudienceConfig,
  withReportingReminderPendingAudience,
  sourceForTargetType,
  normalizeReminderConfig,
  normalizeReportingWindowConfig,
  normalizeReminderRecipientRole,
  evaluateReportingWindowAvenueCoverage,
  reminderSkipReason,
  reportingWindowRuntimeState,
  resolveReportingWindowLifecycle,
  targetCollectionForReminder,
  normalizedNameSimilarity,
  attendanceValueIsMarked,
  targetNameFromData,
  targetDateFromData,
  hasMomMetadata,
  reminderRecipientMatchesRole,
  buildReminderEmail,
  buildReminderTemplateTestEmail,
  normalizeReminderTemplateTestType,
  nextSentState,
  nextAvenueReportingSentState,
  avenueReportingLockId,
  avenueReportingLockPayload,
} = require('./reminderCore');
const {
  writeSystemLog,
  writeSystemLogSafely,
} = require('./system-logs');
const {
  normalizeMomAccess,
  normalizeMomEmailAddress,
  normalizePositionKeys,
  SECRETARY_POSITION_KEYS,
} = require('./momCore');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const auth = admin.auth();
const EMAIL_USER = process.env.EMAIL_USER || process.env.SMTP_USER || '';
const EMAIL_PASS = process.env.EMAIL_PASS || process.env.SMTP_PASS || '';
const reminderTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});
const RCPH_APP_BASE_URL = cleanText(
  process.env.RCPH_APP_BASE_URL
    || process.env.RCPH_WEBSITE_URL
    || process.env.SITE_URL
    || 'https://www.rcph3131.org',
  500,
).replace(/\/+$/, '');

const CALLABLE_OPTIONS = {
  region: 'us-central1',
  cors: [
    'https://rcph3131.org',
    'https://www.rcph3131.org',
    'https://rcph-admin.web.app',
    'https://rcph-admin.firebaseapp.com',
    'http://localhost:5000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    /^http:\/\/localhost:\d+$/,
    /^http:\/\/127\.0\.0\.1:\d+$/,
  ],
};

const ROLE_COLLECTIONS = ['roles', 'userRoles', 'access'];
const ACTIVE_ACCOUNT_ROLES = new Set(['prospect', 'gbm', 'bod', 'admin', 'president', 'secretary', 'saa', 'sergeant']);
const ADMIN_PANEL_POSITION_KEYS = new Set(['cwd', 'co-cwd']);
const SERGEANT_AT_ARMS_POSITION_KEYS = new Set([
  'saa',
  'co-saa',
]);
function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function getFirestoreDocsById(collectionName, ids) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  const result = new Map();
  for (const chunk of chunkArray(uniqueIds, 450)) {
    const refs = chunk.map(id => db.collection(collectionName).doc(id));
    const snaps = await db.getAll(...refs);
    snaps.forEach(snap => result.set(snap.id, snap));
  }
  return result;
}

async function getAuthUsersById(ids) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  const result = new Map();
  for (const chunk of chunkArray(uniqueIds, 100)) {
    const response = await auth.getUsers(chunk.map(uid => ({ uid })));
    response.users.forEach(user => result.set(user.uid, user));
  }
  return result;
}

function isApprovedActiveUserRecord(data = {}) {
  const status = cleanLower(data.status || data.roleStatus, 40);
  return data.active !== false && (!status || status === 'approved');
}

function canonicalPositionKeys(...sources) {
  const values = [];
  sources.flatMap(source => Array.isArray(source) ? source : [source]).forEach((value) => {
    if (value == null || value === '') return;
    if (Array.isArray(value)) values.push(...value);
    else values.push(value);
  });
  return positionHelpers.normalizePositionKeys(values).positionKeys || [];
}

async function activePositionKeysForUid(uid) {
  const snap = await db
    .collection('bodPositionAssignments')
    .where('uid', '==', uid)
    .get()
    .catch(() => null);

  if (!snap) return [];

  return snap.docs
    .map(doc => doc.data() || {})
    .map(assignment => ({
      assignment,
      positionKey: positionHelpers.normalizePositionKey(
        assignment.positionKey
      ),
    }))
    .filter(({ assignment, positionKey }) =>
      Boolean(
        positionKey
        && positionHelpers.isActivePositionAssignment(
          uid,
          positionKey,
          assignment
        )
      )
    )
    .map(({ positionKey }) => positionKey);
}

async function resolveReminderAccess(uid, token = {}) {
  const userRef = db.collection('users').doc(uid);
  const roleRefs = ROLE_COLLECTIONS.map(collectionName => db.collection(collectionName).doc(uid));
  const [userSnap, assignmentKeys, ...roleSnaps] = await Promise.all([
    userRef.get(),
    activePositionKeysForUid(uid),
    ...roleRefs.map(ref => ref.get().catch(() => null)),
  ]);
  const user = userSnap.exists ? userSnap.data() || {} : {};
  const roleSnap = roleSnaps.find(snapshot => snapshot?.exists);
  const role = roleSnap?.exists ? roleSnap.data() || {} : user;
  const mergedPositionKeys = canonicalPositionKeys(user.positionKeys, role.positionKeys, user.clubPosition, role.clubPosition, user.position, role.position, assignmentKeys);
  const mergedUser = { ...user, positionKeys: mergedPositionKeys };
  const mergedRole = { ...role, positionKeys: mergedPositionKeys };
  const access = normalizeMomAccess({
  uid,
  user: mergedUser,
  role: mergedRole,
  token,
});

return {
  ...access,
  trustedActivePositionKeys: assignmentKeys.slice(),
};
}

function hasAdminPanelAuthority(access = {}) {
  if (access.isApproved !== true) return false;

  if (['admin', 'president'].includes(access.storedRole)) {
    return true;
  }

  if (access.hasPresidentAuthority === true) {
    return true;
  }

  if (
    normalizePositionKeys(
      access.trustedActivePositionKeys
    ).some(key => SERGEANT_AT_ARMS_POSITION_KEYS.has(key))
  ) {
    return true;
  }

  return normalizePositionKeys(access.positionKeys)
    .some(key => ADMIN_PANEL_POSITION_KEYS.has(key));
}
function hasBodToolsReportingAccess(access = {}) {
  return access.isApproved === true
    && (['bod', 'admin', 'president'].includes(access.storedRole) || access.hasPresidentAuthority === true);
}

async function requireAdminPanelReminderAccess(request, action = 'manage reminders') {
  const uid = request.auth?.uid || '';
  if (!uid) throw new HttpsError('unauthenticated', `Sign in before you ${action}.`);
  const access = await resolveReminderAccess(uid, request.auth?.token || {});
  if (!hasAdminPanelAuthority(access)) {
    throw new HttpsError('permission-denied', 'Admin panel authority is required for reminder operations.');
  }
  return access;
}

async function requireBodToolsReportingAccess(request, action = 'open BOD Tools') {
  const uid = request.auth?.uid || '';
  if (!uid) throw new HttpsError('unauthenticated', `Sign in before you ${action}.`);
  const access = await resolveReminderAccess(uid, request.auth?.token || {});
  if (!hasBodToolsReportingAccess(access)) {
    throw new HttpsError('permission-denied', 'Approved BOD Tools access is required.');
  }
  return access;
}

function roleCanBeReminderRecipient(role) {
  return ACTIVE_ACCOUNT_ROLES.has(cleanLower(role, 80));
}

function buildEligibleReminderRecipient(uid, { authRecord, userSnap, roleSnap, positionKeys = [] }) {
  if (!authRecord || authRecord.disabled === true || !userSnap?.exists) return null;
  const userData = userSnap.data() || {};
  const roleData = roleSnap?.exists ? roleSnap.data() || {} : userData;
  const storedRole = cleanLower(roleData.role || userData.role || userData.storedRole, 80);
  const roleStatus = cleanLower(roleData.status || roleData.roleStatus || userData.roleStatus || userData.status || 'approved', 40);
  if (!roleCanBeReminderRecipient(storedRole) || roleStatus !== 'approved') return null;
  if (!isApprovedActiveUserRecord(userData)) return null;

  const mergedPositionKeys = canonicalPositionKeys(
    roleData.positionKeys,
    userData.positionKeys,
    userData.clubPosition,
    roleData.clubPosition,
    userData.position,
    roleData.position,
    positionKeys,
  );
  const access = normalizeMomAccess({
    uid,
    user: { ...userData, positionKeys: mergedPositionKeys },
    role: { ...roleData, positionKeys: mergedPositionKeys },
    token: authRecord,
  });
  const email = normalizeMomEmailAddress(userData.email || authRecord.email || '');
  if (access.isApproved !== true || !email.ok) return null;

  return {
    uid,
    name: cleanText(userData.name || userData.displayName || authRecord.displayName || authRecord.email || uid, 180),
    email: email.email,
    role: access.storedRole,
    positionKeys: access.positionKeys,
    hasPresidentAuthority: access.hasPresidentAuthority === true,
  };
}

function dedupeReminderRecipients(recipients = []) {
  const byUid = new Map();
  const emails = new Set();
  for (const recipient of recipients) {
    const uid = safeDocumentId(recipient?.uid);
    const email = normalizeMomEmailAddress(recipient?.email);
    if (!uid || !email.ok || byUid.has(uid) || emails.has(email.email)) continue;
    byUid.set(uid, { ...recipient, uid, email: email.email });
    emails.add(email.email);
  }
  return Array.from(byUid.values()).sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')) || a.uid.localeCompare(b.uid));
}

function reminderLogActor(access = {}) {
  return {
    actorUid: cleanText(access.uid || 'system', 160) || 'system',
    actorName: cleanText(access.displayName || access.name || (access.uid ? 'Unknown user' : 'System'), 180),
    actorRole: cleanText(access.storedRole || access.role || (access.uid ? '' : 'system'), 80),
  };
}

async function writeReminderSystemLog(input = {}, { safe = false } = {}) {
  const writer = safe ? writeSystemLogSafely : writeSystemLog;
  return writer({ db, admin }, {
    ...reminderLogActor(input.access || {}),
    category: input.category || 'reminder',
    action: input.action || 'updated',
    status: input.status || 'success',
    targetType: input.targetType || 'reminder',
    targetId: input.targetId || '',
    targetLabel: input.targetLabel || '',
    targetAudience: input.targetAudience || '',
    details: input.details || '',
    source: input.source || 'reminderFunctions',
    relatedDocPath: input.relatedDocPath || '',
    metadata: input.metadata || {},
  }, console);
}

function bodToolsPrefillUrl(reportingWindowId) {
  const safeId = encodeURIComponent(safeDocumentId(reportingWindowId));
  return safeId ? `${RCPH_APP_BASE_URL}/bod-tools?reportingWindowId=${safeId}` : '';
}

function reportingWindowAvenuesForReminder(reminder = {}) {
  return normalizeReportingAvenues(Array.isArray(reminder.avenues) && reminder.avenues.length ? reminder.avenues : reminder.avenue);
}

function reportingWindowAudienceLabel(reminder = {}) {
  const avenues = reportingWindowAvenuesForReminder(reminder);
  return cleanText(reminder.avenuesLabel, 160) || reportingAvenuesLabel(avenues) || reminder.avenue || '';
}

function isSpecialReportingWindow(reminder = {}) {
  const avenue = reportingWindowAvenuesForReminder(reminder)[0] || normalizeAvenueKey(reminder.avenue);
  return ['GBM', 'BOD_MEETING'].includes(avenue);
}

const REPORTING_QUEUE_STOPPED_STATUSES = new Set(['stopped', 'cancelled', 'canceled', 'disabled', 'inactive']);
const REPORTING_QUEUE_STOPPED_REASONS = new Set(['reminders_disabled', 'admin_removed', 'cancelled', 'canceled']);

function queueTimestampMillis(value) {
  if (!value) return 0;
  if (Number.isFinite(Number(value))) return Number(value);
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getTime();
  if (typeof value.toMillis === 'function') return value.toMillis();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function reportingWindowAdministrativelyStopped(reminder = {}) {
  const status = cleanLower(reminder.status, 40);
  const reason = cleanLower(reminder.completionReason || reminder.stoppedReason || reminder.failureReason, 160);
  return REPORTING_QUEUE_STOPPED_STATUSES.has(status) || REPORTING_QUEUE_STOPPED_REASONS.has(reason);
}

function reportingWindowQueueLocked(reminder = {}, nowMillis = Date.now(), lock = null) {
  return resolveReportingWindowLifecycle(reminder, { nowMillis, lock }).effectiveLocked;
}

function reportingWindowQueueRuntimeState(reminder = {}, nowMillis = Date.now(), lock = null) {
  if (reportingWindowAdministrativelyStopped(reminder)) return 'stopped';
  return resolveReportingWindowLifecycle(reminder, { nowMillis, lock }).runtimeState;
}

function specialReportingWindowCoverage(reminder = {}) {
  const requiredAvenues = reportingWindowAvenuesForReminder(reminder);
  const complete = cleanLower(reminder.eventReportStatus, 40) === 'recorded'
    || cleanLower(reminder.status, 40) === 'completed'
    || cleanLower(reminder.completionReason, 160) === 'report_submitted';
  const avenueStatuses = requiredAvenues.reduce((out, avenue) => {
    out[avenue] = complete ? 'reported' : 'missing_avenue';
    return out;
  }, {});
  return {
    requiredAvenues,
    avenueStatuses,
    reportedAvenues: complete ? requiredAvenues.slice() : [],
    pendingAvenues: complete ? [] : requiredAvenues.slice(),
    missingAvenues: complete ? [] : requiredAvenues.slice(),
    missingDescriptionAvenues: [],
    totalAvenues: requiredAvenues.length,
    reportedCount: complete ? requiredAvenues.length : 0,
    status: complete ? 'complete' : 'pending',
    complete,
  };
}

function reportingWindowQueueCoverage(reminder = {}, linkedEvent = null) {
  return isSpecialReportingWindow(reminder)
    ? specialReportingWindowCoverage(reminder)
    : evaluateReportingWindowAvenueCoverage(reminder, linkedEvent || {});
}

function shouldIncludeBodReportingQueueItem(reminder = {}, coverage = {}) {
  if (!reminder || reportingWindowAdministrativelyStopped(reminder)) return false;
  if (cleanLower(reminder.status, 40) === 'completed') return false;
  return coverage.complete !== true;
}

function positionDisplayLabel(positionKey) {
  const definition = positionHelpers.getPositionDefinition(positionKey);
  return cleanText(definition?.displayTitle, 120) || cleanText(positionKey, 80);
}

function positionSortOrder(positionKey) {
  const definition = positionHelpers.getPositionDefinition(positionKey);
  return Number.isFinite(Number(definition?.sortOrder)) ? Number(definition.sortOrder) : Number.MAX_SAFE_INTEGER;
}

function isCoPositionKey(positionKey) {
  const definition = positionHelpers.getPositionDefinition(positionKey);
  return cleanLower(definition?.group, 40).startsWith('co-') || cleanText(positionKey, 80).startsWith('co-');
}

function compareQueueAssignees(a = {}, b = {}) {
  return Number(a.isCo === true) - Number(b.isCo === true)
    || (Number(a.positionSortOrder) || Number.MAX_SAFE_INTEGER) - (Number(b.positionSortOrder) || Number.MAX_SAFE_INTEGER)
    || String(a.positionLabel || '').localeCompare(String(b.positionLabel || ''))
    || String(a.name || '').localeCompare(String(b.name || ''))
    || String(a.uid || '').localeCompare(String(b.uid || ''));
}

function secretaryPositionKeys() {
  return Array.from(SECRETARY_POSITION_KEYS || []).map(positionHelpers.normalizePositionKey).filter(Boolean);
}

function responsibilityPositionKeysForAvenue(avenue) {
  const key = normalizeAvenueKey(avenue);
  return ['GBM', 'BOD_MEETING'].includes(key) ? secretaryPositionKeys() : avenueRecipientPositionKeys(key);
}

function buildBodReportingQueueResponsibilities(avenues = [], assignees = []) {
  return normalizeReportingAvenues(avenues).map((avenue) => {
    const allowed = new Set(responsibilityPositionKeysForAvenue(avenue));
    const seenUids = new Set();
    const groupAssignees = assignees
      .filter(assignee => allowed.has(positionHelpers.normalizePositionKey(assignee.positionKey)))
      .slice()
      .sort(compareQueueAssignees)
      .reduce((list, assignee) => {
        const uid = safeDocumentId(assignee.uid);
        const positionKey = positionHelpers.normalizePositionKey(assignee.positionKey);
        if (!uid || !positionKey || seenUids.has(uid)) return list;
        seenUids.add(uid);
        list.push({
          uid,
          name: cleanText(assignee.name, 180) || uid,
          role: cleanLower(assignee.role, 80),
          positionKey,
          positionLabel: positionDisplayLabel(positionKey),
          assignmentType: isCoPositionKey(positionKey) ? 'co' : 'primary',
        });
        return list;
      }, []);
    return {
      avenue,
      avenueLabel: avenueDisplayLabel(avenue),
      assignees: groupAssignees,
    };
  });
}

async function loadBodReportingQueueAssignees() {
  const snap = await db.collection('bodPositionAssignments').where('active', '==', true).get().catch(() => null);
  if (!snap) return [];
  const rows = snap.docs.map((doc) => {
    const data = doc.data() || {};
    return {
      uid: safeDocumentId(data.uid),
      positionKey: positionHelpers.normalizePositionKey(data.positionKey),
    };
  }).filter(row => row.uid && row.positionKey);
  const uids = rows.map(row => row.uid);
  const [userSnaps, roleSnaps, authUsers] = await Promise.all([
    getFirestoreDocsById('users', uids),
    getFirestoreDocsById('roles', uids),
    getAuthUsersById(uids),
  ]);

  return rows.reduce((list, row) => {
    const recipient = buildEligibleReminderRecipient(row.uid, {
      authRecord: authUsers.get(row.uid),
      userSnap: userSnaps.get(row.uid),
      roleSnap: roleSnaps.get(row.uid),
      positionKeys: [row.positionKey],
    });
    if (!recipient) return list;
    list.push({
      uid: recipient.uid,
      name: recipient.name,
      role: recipient.role,
      positionKey: row.positionKey,
      positionLabel: positionDisplayLabel(row.positionKey),
      positionSortOrder: positionSortOrder(row.positionKey),
      isCo: isCoPositionKey(row.positionKey),
    });
    return list;
  }, []);
}

function queueLinkedBodEventId(reminder = {}) {
  return safeDocumentId(reminder.linkedBodEventId || reminder.linkedEventId || reminder.linkedTargetId);
}

function queueLinkedTargetId(reminder = {}) {
  return safeDocumentId(reminder.linkedTargetId || reminder.linkedBodEventId || reminder.linkedEventId || reminder.linkedMeetingId);
}

function shapeBodReportingQueueItem({ reminder, coverage, responsibilities, nowMillis = Date.now(), lock = null }) {
  const targetType = reportingWindowExpectedTargetType(reminder);
  const linkedTargetId = queueLinkedTargetId(reminder);
  const linkedBodEventId = queueLinkedBodEventId(reminder);
  const lifecycle = resolveReportingWindowLifecycle(reminder, { nowMillis, lock });
  return {
    id: reminder.id,
    reportingWindowId: reminder.id,
    source: REMINDERS_COLLECTION,
    targetType,
    targetId: linkedTargetId,
    linkedTargetType: cleanLower(reminder.linkedTargetType, 80) || targetType,
    linkedTargetId,
    linkedBodEventId,
    linkedMeetingId: safeDocumentId(reminder.linkedMeetingId),
    eventName: reminder.targetName,
    name: reminder.targetName,
    conductedDate: reminder.conductedDate,
    date: reminder.conductedDate,
    time: reminder.eventTime,
    avenue: reminder.avenue,
    avenueLabel: reminder.avenueLabel,
    avenues: reminder.avenues.slice(),
    avenueLabels: reminder.avenueLabels.slice(),
    avenuesLabel: reminder.avenuesLabel,
    anchorDate: reminder.anchorDate,
    reportingDeadlineAnchorDate: reminder.reportingDeadlineAnchorDate,
    countdownStartAt: reminder.countdownStartAt,
    reportingAvailableAt: reminder.reportingAvailableAt,
    reportingOpensAt: reminder.reportingOpensAt,
    reportingDueAt: reminder.reportingDueAt,
    deadline: reminder.reportingDueAt,
    lockAt: reminder.lockAt,
    timezone: reminder.timezone,
    status: reminder.status,
    runtimeState: lifecycle.runtimeState,
    locked: lifecycle.effectiveLocked,
    effectiveLocked: lifecycle.effectiveLocked,
    deadlinePassed: lifecycle.deadlinePassed,
    lockTargetReached: lifecycle.lockTargetReached,
    manualUnlockActive: lifecycle.manualUnlockActive,
    lockSource: lifecycle.lockSource,
    lockReason: reminder.lockReason,
    eventReportStatus: coverage.complete ? 'recorded' : coverage.status,
    coverage: {
      requiredAvenues: coverage.requiredAvenues.slice(),
      avenueStatuses: { ...coverage.avenueStatuses },
      reportedAvenues: coverage.reportedAvenues.slice(),
      pendingAvenues: coverage.pendingAvenues.slice(),
      missingAvenues: coverage.missingAvenues.slice(),
      missingDescriptionAvenues: coverage.missingDescriptionAvenues.slice(),
      totalAvenues: coverage.totalAvenues,
      reportedCount: coverage.reportedCount,
      status: coverage.status,
      complete: coverage.complete === true,
    },
    responsibilities,
    action: linkedTargetId ? 'continue_event' : 'add_event',
    createdAt: reminder.createdAt,
    updatedAt: reminder.updatedAt,
  };
}

function compareBodReportingQueueItems(a = {}, b = {}) {
  return (queueTimestampMillis(a.reportingDueAt) || Number.MAX_SAFE_INTEGER) - (queueTimestampMillis(b.reportingDueAt) || Number.MAX_SAFE_INTEGER)
    || (queueTimestampMillis(a.lockAt) || Number.MAX_SAFE_INTEGER) - (queueTimestampMillis(b.lockAt) || Number.MAX_SAFE_INTEGER)
    || queueTimestampMillis(b.createdAt) - queueTimestampMillis(a.createdAt)
    || String(a.reportingWindowId || a.id || '').localeCompare(String(b.reportingWindowId || b.id || ''));
}

function workflowReminderConfigId(reportingWindowId, reminderType) {
  return ['reportingWorkflow', safeDocumentId(reportingWindowId), cleanLower(reminderType, 80)]
    .filter(Boolean)
    .join('_');
}

function reminderTypeDefinition(reminderType) {
  const type = cleanLower(reminderType, 80);
  if (type === 'mom_submission') {
    return { reminderType: 'mom_submission', recipientRole: 'secretary' };
  }
  if (type === 'attendance_marking') {
    return { reminderType: 'attendance_marking', recipientRole: 'sergeant' };
  }
  return null;
}

function workflowReminderPayload({ reportingWindow, reminderType, targetType, targetId, enabled = true, requiresBodToolsRecord = false }) {
  const definition = reminderTypeDefinition(reminderType);
  if (!definition) return null;
  const source = sourceForTargetType(targetType);
  const safeTargetId = safeDocumentId(targetId);
  if (!source || !safeTargetId) return null;
  const avenues = reportingWindowAvenuesForReminder(reportingWindow);
  const configId = workflowReminderConfigId(reportingWindow.id, definition.reminderType);
  return {
    configId,
    recordType: EVENT_REMINDER_RECORD_TYPE,
    source,
    targetType,
    targetId: safeTargetId,
    eventId: safeTargetId,
    eventName: reportingWindow.targetName,
    targetName: reportingWindow.targetName,
    eventType: targetType,
    eventTypeLabel: targetType === 'bod_meeting' ? 'BOD meeting' : targetType === 'avenue_reporting_window' ? 'Reporting workflow' : 'Club event',
    avenue: avenues.length ? avenues : [reportingWindow.avenue].filter(Boolean),
    avenues,
    avenueLabels: avenues.map(avenueDisplayLabel),
    avenuesLabel: reportingAvenuesLabel(avenues),
    conductedDate: reportingWindow.conductedDate,
    targetDate: reportingWindow.conductedDate,
    reminderType: definition.reminderType,
    recipientRole: definition.recipientRole,
    enabled: enabled === true,
    disabled: enabled !== true,
    status: enabled === true ? 'configured' : 'stopped',
    remindersSent: 0,
    maxReminders: 3,
    reminderTime: '00:00',
    reportingWindowId: reportingWindow.id,
    workflowType: 'reporting_window',
    workflowStatus: requiresBodToolsRecord ? 'awaiting_bod_tools_record' : 'linked',
    requiresBodToolsRecord: requiresBodToolsRecord === true,
    workflowWarning: requiresBodToolsRecord ? GBM_BOD_TOOLS_RECORD_WARNING : '',
    completionReason: '',
    failureReason: '',
    stoppedReason: enabled === true ? '' : 'workflow_reminders_disabled',
  };
}

function existingWorkflowLifecyclePatch(snap) {
  if (!snap?.exists) return {};
  const data = snap.data() || {};
  const existing = normalizeReminderConfig(snap.id, data);
  if (!existing) return {};

  const patch = {
    remindersSent: existing.remindersSent,
    maxReminders: existing.maxReminders || REMINDER_DEFAULT_MAX,
  };
  if (data.lastReminderSentAt !== undefined) patch.lastReminderSentAt = data.lastReminderSentAt;

  if (existing.status === 'active') {
    patch.status = 'active';
  } else if (existing.status === 'completed') {
    patch.status = 'completed';
    patch.enabled = data.enabled !== false;
    patch.disabled = data.disabled === true;
    if (data.completedAt !== undefined) patch.completedAt = data.completedAt;
    patch.completionReason = existing.completionReason;
    patch.failureReason = '';
  } else if (existing.status === 'stopped') {
    patch.status = 'stopped';
    patch.enabled = false;
    patch.disabled = true;
    if (data.stoppedAt !== undefined) patch.stoppedAt = data.stoppedAt;
    patch.stoppedReason = existing.stoppedReason || 'admin_removed';
  }

  return patch;
}

async function upsertWorkflowReminderConfigs({ reportingWindow, targetType, targetId, enabled = true, requiresBodToolsRecord = false, access = null, now = admin.firestore.Timestamp.now() }) {
  const createdOrUpdated = [];
  for (const reminderType of ['mom_submission', 'attendance_marking']) {
    const payload = workflowReminderPayload({
      reportingWindow,
      reminderType,
      targetType,
      targetId,
      enabled,
      requiresBodToolsRecord,
    });
    if (!payload) continue;
    const ref = db.collection(REMINDERS_COLLECTION).doc(payload.configId);
    const snap = await ref.get();
    const lifecyclePatch = existingWorkflowLifecyclePatch(snap);
    await ref.set({
      ...payload,
      ...lifecyclePatch,
      updatedAt: now,
      updatedBy: access?.uid || 'system',
      updatedByName: access?.displayName || access?.name || 'System',
      ...(snap.exists ? {} : {
        createdAt: now,
        createdBy: access?.uid || 'system',
        createdByName: access?.displayName || access?.name || 'System',
      }),
    }, { merge: true });
    createdOrUpdated.push(payload.configId);
  }

  if (createdOrUpdated.length) {
    await writeReminderSystemLog({
      access: access || { uid: 'system', displayName: 'System', storedRole: 'system' },
      action: 'started',
      status: enabled === true ? 'active' : 'inactive',
      targetType: 'reporting_workflow_reminders',
      targetId: reportingWindow.id,
      targetLabel: reportingWindow.targetName,
      targetAudience: reportingWindowAudienceLabel(reportingWindow),
      details: `${createdOrUpdated.length} linked MOM/attendance reminder configs started.`,
      source: 'upsertWorkflowReminderConfigs',
      relatedDocPath: `${REMINDERS_COLLECTION}/${reportingWindow.id}`,
      metadata: {
        reportingWindowId: reportingWindow.id,
        avenue: reportingWindow.avenue,
        avenues: reportingWindowAvenuesForReminder(reportingWindow),
        avenuesLabel: reportingWindowAudienceLabel(reportingWindow),
        targetType,
        targetId,
        enabled: enabled === true,
        requiresBodToolsRecord: requiresBodToolsRecord === true,
        reminderIds: createdOrUpdated,
      },
    }, { safe: true });
  }

  return createdOrUpdated;
}

async function updateReportingWindowWorkflowFields(reportingWindowId, fields, now = admin.firestore.Timestamp.now()) {
  const safeId = safeDocumentId(reportingWindowId);
  if (!safeId) return false;
  await db.collection(REMINDERS_COLLECTION).doc(safeId).set({
    ...fields,
    updatedAt: now,
  }, { merge: true });
  return true;
}

function reportingCoveragePersistenceFields(coverage, now) {
  return {
    eventReportStatus: coverage.complete ? 'recorded' : coverage.status,
    reportedAvenues: coverage.reportedAvenues,
    pendingAvenues: coverage.pendingAvenues,
    missingAvenues: coverage.missingAvenues,
    missingDescriptionAvenues: coverage.missingDescriptionAvenues,
    avenueReportStatuses: coverage.avenueStatuses,
    reportedAvenueCount: coverage.reportedCount,
    requiredAvenueCount: coverage.totalAvenues,
    reportingCoverageUpdatedAt: now,
  };
}

function arraysMatch(left = [], right = []) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  return left.every((item, index) => item === right[index]);
}

function objectsMatch(left = {}, right = {}) {
  const leftKeys = Object.keys(left || {}).sort();
  const rightKeys = Object.keys(right || {}).sort();
  return arraysMatch(leftKeys, rightKeys) && leftKeys.every(key => left[key] === right[key]);
}

function reportingCoverageChanged(reportingWindow = {}, fields = {}) {
  return cleanLower(reportingWindow.eventReportStatus, 40) !== fields.eventReportStatus
    || !arraysMatch(reportingWindow.reportedAvenues || [], fields.reportedAvenues || [])
    || !arraysMatch(reportingWindow.pendingAvenues || [], fields.pendingAvenues || [])
    || !arraysMatch(reportingWindow.missingAvenues || [], fields.missingAvenues || [])
    || !arraysMatch(reportingWindow.missingDescriptionAvenues || [], fields.missingDescriptionAvenues || [])
    || !objectsMatch(reportingWindow.avenueReportStatuses || {}, fields.avenueReportStatuses || {})
    || Number(reportingWindow.reportedAvenueCount || 0) !== Number(fields.reportedAvenueCount || 0)
    || Number(reportingWindow.requiredAvenueCount || 0) !== Number(fields.requiredAvenueCount || 0);
}

function partialReportingWindowStatus(reportingWindow = {}) {
  const status = cleanLower(reportingWindow.status, 40);
  if (['configured', 'not_open', 'open', 'active', 'failed', 'no_recipient'].includes(status)) return status;
  return reportingWindow.remindersSent > 0 ? 'active' : 'open';
}

async function reportingCoverageEventData({ targetId, bodEventId = '', eventData = null } = {}) {
  if (eventData && typeof eventData === 'object') return eventData;
  const safeBodEventId = safeDocumentId(bodEventId) || safeDocumentId(targetId);
  if (!safeBodEventId) return {};
  const snap = await db.collection('bodEvents').doc(safeBodEventId).get().catch(() => null);
  return snap?.exists ? (snap.data() || {}) : {};
}

async function loadLiveReportingReminderCoverage(reminder = {}, eventData = null) {
  if (isSpecialReportingWindow(reminder)) return specialReportingWindowCoverage(reminder);
  const linkedEventData = eventData && typeof eventData === 'object'
    ? eventData
    : await reportingCoverageEventData({
        targetId: queueLinkedTargetId(reminder),
        bodEventId: queueLinkedBodEventId(reminder),
      });
  return evaluateReportingWindowAvenueCoverage(reminder, linkedEventData || {});
}

function reportingReminderLogMetadata(reminder = {}, coverage = {}, recipientCount = 0) {
  const audience = reportingReminderAudienceConfig(reminder, coverage);
  return {
    requiredAvenues: audience.requiredAvenues,
    pendingAvenues: audience.pendingAvenues,
    pendingAvenueCount: audience.pendingAvenueCount,
    reportedAvenues: audience.reportedAvenues,
    recipientCount,
  };
}

async function persistLiveReportingCoverage(doc, reminder, coverage, now) {
  if (isSpecialReportingWindow(reminder) || !coverage) return false;
  const coverageFields = reportingCoveragePersistenceFields(coverage, now);
  const fields = coverage.complete === true
    ? {
        ...coverageFields,
        status: 'completed',
        completedAt: now,
        completionReason: 'report_submitted',
        eventReportStatus: 'recorded',
        failureReason: '',
      }
    : {
        ...coverageFields,
        status: partialReportingWindowStatus(reminder),
        completedAt: admin.firestore.FieldValue.delete(),
        completionReason: '',
      };
  if (coverage.complete !== true && !reportingCoverageChanged(reminder, coverageFields)) return false;
  await doc.ref.set({
    ...fields,
    updatedAt: now,
  }, { merge: true });
  return true;
}

async function completeReportingWindowFromLiveCoverage(doc, reminder, coverage, now) {
  await persistLiveReportingCoverage(doc, reminder, coverage, now);
  await writeReminderHistory([reminderHistoryPayload({
    reminder,
    status: 'skipped',
    errorCode: 'report_submitted',
    attemptNumber: reminder.remindersSent,
    maxReminders: reminder.maxReminders,
    sentAt: now,
  })]);
}

async function completeLinkedWorkflowRemindersForTarget({ targetType, targetId, reminderType, reason, now = admin.firestore.Timestamp.now(), metadata = {} }) {
  const safeTargetId = safeDocumentId(targetId);
  const normalizedReminderType = cleanLower(reminderType, 80);
  const normalizedTargetType = cleanLower(targetType, 80);
  if (!safeTargetId || !normalizedReminderType || !normalizedTargetType) return { completed: 0, reportingWindowIds: [] };

  const snap = await db.collection(REMINDERS_COLLECTION)
    .where('recordType', '==', EVENT_REMINDER_RECORD_TYPE)
    .where('targetType', '==', normalizedTargetType)
    .where('targetId', '==', safeTargetId)
    .get()
    .catch(() => null);
  if (!snap?.docs?.length) return { completed: 0, reportingWindowIds: [] };

  const reportingWindowIds = new Set();
  let completed = 0;
  const batch = db.batch();
  snap.docs.forEach((doc) => {
    const reminder = normalizeReminderConfig(doc.id, doc.data() || {});
    if (!reminder || reminder.reminderType !== normalizedReminderType) return;
    if (reminder.status === 'completed') return;
    batch.set(doc.ref, {
      status: 'completed',
      completedAt: now,
      completionReason: reason,
      failureReason: '',
      updatedAt: now,
    }, { merge: true });
    if (reminder.reportingWindowId) reportingWindowIds.add(reminder.reportingWindowId);
    completed += 1;
  });
  if (!completed) return { completed: 0, reportingWindowIds: [] };
  await batch.commit();

  for (const reportingWindowId of reportingWindowIds) {
    const statusFields = normalizedReminderType === 'mom_submission'
      ? { momStatus: 'uploaded', momUploadedAt: now, momCompletionReason: reason }
      : { attendanceStatus: 'marked', attendanceMarkedAt: now, attendanceCompletionReason: reason };
    await updateReportingWindowWorkflowFields(reportingWindowId, {
      ...statusFields,
      workflowStatus: 'in_progress',
      ...metadata,
    }, now);
    await writeReminderSystemLog({
      access: { uid: 'system', displayName: 'System', storedRole: 'system' },
      action: 'stopped',
      status: 'success',
      targetType: normalizedReminderType,
      targetId: reportingWindowId,
      targetLabel: reportingWindowId,
      details: `${normalizedReminderType} reminder stopped after ${reason}.`,
      source: 'completeLinkedWorkflowRemindersForTarget',
      relatedDocPath: `${REMINDERS_COLLECTION}/${reportingWindowId}`,
      metadata: {
        reportingWindowId,
        targetType: normalizedTargetType,
        targetId: safeTargetId,
        reason,
      },
    }, { safe: true });
  }

  return { completed, reportingWindowIds: Array.from(reportingWindowIds) };
}

async function linkReportingWindowToTarget({ reportingWindow, targetType, targetId, bodEventId = '', access = null, now = admin.firestore.Timestamp.now(), match = null, eventData = null }) {
  const safeTargetId = safeDocumentId(targetId);
  const normalizedTargetType = cleanLower(targetType, 80);
  if (!reportingWindow?.id || !safeTargetId || !sourceForTargetType(normalizedTargetType)) {
    return { ok: false, reminderIds: [], complete: false };
  }
  const safeBodEventId = safeDocumentId(bodEventId) || safeTargetId;
  const specialWindow = isSpecialReportingWindow(reportingWindow);
  const coverage = specialWindow
    ? null
    : evaluateReportingWindowAvenueCoverage(
        reportingWindow,
        await reportingCoverageEventData({ targetId: safeTargetId, bodEventId: safeBodEventId, eventData }),
      );
  const coverageFields = coverage ? reportingCoveragePersistenceFields(coverage, now) : {};

  const fields = {
    workflowStatus: 'in_progress',
    linkedTargetType: normalizedTargetType,
    linkedTargetId: safeTargetId,
    linkedEventId: safeTargetId,
    linkedBodEventId: safeBodEventId,
    failureReason: '',
    possibleMatchStatus: '',
    ...coverageFields,
  };
  if (specialWindow || coverage?.complete === true) {
    fields.status = 'completed';
    fields.completedAt = now;
    fields.completionReason = 'report_submitted';
    fields.eventReportStatus = 'recorded';
  } else {
    fields.status = partialReportingWindowStatus(reportingWindow);
    fields.completedAt = admin.firestore.FieldValue.delete();
    fields.completionReason = '';
  }
  if (normalizedTargetType === 'bod_meeting') fields.linkedMeetingId = safeTargetId;
  await updateReportingWindowWorkflowFields(reportingWindow.id, fields, now);

  const reminderIds = await upsertWorkflowReminderConfigs({
    reportingWindow,
    targetType: normalizedTargetType,
    targetId: safeTargetId,
    enabled: true,
    requiresBodToolsRecord: false,
    access,
    now,
  });

  const alreadyLinked = reportingWindow.linkedTargetId === safeTargetId
    && (reportingWindow.linkedBodEventId || reportingWindow.linkedEventId || '') === safeBodEventId;
  const shouldLog = !alreadyLinked || (coverage && reportingCoverageChanged(reportingWindow, coverageFields));
  if (shouldLog) {
    await writeReminderSystemLog({
      access: access || { uid: 'system', displayName: 'System', storedRole: 'system' },
      action: 'linked',
      status: coverage?.complete === false ? 'info' : 'success',
      targetType: 'avenue_reporting_window',
      targetId: reportingWindow.id,
      targetLabel: reportingWindow.targetName,
      targetAudience: reportingWindowAudienceLabel(reportingWindow),
      details: coverage
        ? `BOD event linked to reporting window; coverage ${coverage.reportedCount}/${coverage.totalAvenues}. MOM and attendance reminders started.`
        : 'BOD event linked to reporting window; MOM and attendance reminders started.',
      source: 'linkReportingWindowToTarget',
      relatedDocPath: `${REMINDERS_COLLECTION}/${reportingWindow.id}`,
      metadata: {
        reportingWindowId: reportingWindow.id,
        avenue: reportingWindow.avenue,
        avenues: reportingWindowAvenuesForReminder(reportingWindow),
        avenuesLabel: reportingWindowAudienceLabel(reportingWindow),
        targetType: normalizedTargetType,
        targetId: safeTargetId,
        bodEventId: safeBodEventId,
        match,
        coverage,
        reminderIds,
      },
    }, { safe: true });
  }

  return {
    ok: true,
    reminderIds,
    coverage,
    complete: specialWindow || coverage?.complete === true,
    eventReportStatus: fields.eventReportStatus,
  };
}

async function activePositionKeysByUidForReminderRole(recipientRole) {
  const result = new Map();
  const normalizedRole = normalizeReminderRecipientRole(recipientRole);
  const snap = await db.collection('bodPositionAssignments').where('active', '==', true).get().catch(() => null);
  if (!snap) return result;
  snap.forEach(doc => {
    const assignment = doc.data() || {};
    const uid = safeDocumentId(assignment.uid);
    const positionKey = positionHelpers.normalizePositionKey(assignment.positionKey);
    if (!uid || !positionKey || assignment.active !== true) return;
    if (!reminderRecipientMatchesRole({ role: 'bod', positionKeys: [positionKey] }, normalizedRole)) return;
    const existing = result.get(uid) || [];
    if (!existing.includes(positionKey)) result.set(uid, [...existing, positionKey]);
  });
  return result;
}

async function activePositionKeysByUidForAvenue(avenue) {
  const allowed = new Set(avenueRecipientPositionKeys(avenue));
  const result = new Map();
  if (!allowed.size) return result;
  const snap = await db.collection('bodPositionAssignments').where('active', '==', true).get().catch(() => null);
  if (!snap) return result;
  snap.forEach(doc => {
    const assignment = doc.data() || {};
    const uid = safeDocumentId(assignment.uid);
    const positionKey = positionHelpers.normalizePositionKey(assignment.positionKey);
    if (!uid || !positionKey || assignment.active !== true || !allowed.has(positionKey)) return;
    const existing = result.get(uid) || [];
    if (!existing.includes(positionKey)) result.set(uid, [...existing, positionKey]);
  });
  return result;
}

async function candidateUidsForReminderRole(recipientRole) {
  const normalizedRole = normalizeReminderRecipientRole(recipientRole);
  const candidateUids = new Set();
  const positionKeysByUid = await activePositionKeysByUidForReminderRole(normalizedRole);
  positionKeysByUid.forEach((_, uid) => candidateUids.add(uid));

  const [rolesSnap, usersSnap] = await Promise.all([
    db.collection('roles').get().catch(() => null),
    db.collection('users').get().catch(() => null),
  ]);

  rolesSnap?.forEach(doc => {
    const data = doc.data() || {};
    const status = cleanLower(data.status || data.roleStatus || 'approved', 40);
    if (status !== 'approved') return;
    const positionKeys = canonicalPositionKeys(data.positionKeys, data.clubPosition, data.position);
    if (reminderRecipientMatchesRole({ role: data.role, positionKeys }, normalizedRole)) candidateUids.add(doc.id);
  });

  usersSnap?.forEach(doc => {
    const data = doc.data() || {};
    if (!isApprovedActiveUserRecord(data)) return;
    const positionKeys = canonicalPositionKeys(data.positionKeys, data.clubPosition, data.position);
    if (reminderRecipientMatchesRole({ role: data.role || data.storedRole, positionKeys }, normalizedRole)) {
      candidateUids.add(doc.id);
    }
  });

  return { candidateUids: Array.from(candidateUids), positionKeysByUid };
}

async function candidateUidsForAvenue(avenue) {
  const allowed = new Set(avenueRecipientPositionKeys(avenue));
  const candidateUids = new Set();
  const positionKeysByUid = await activePositionKeysByUidForAvenue(avenue);
  positionKeysByUid.forEach((_, uid) => candidateUids.add(uid));

  if (!allowed.size) return { candidateUids: [], positionKeysByUid };

  const [rolesSnap, usersSnap] = await Promise.all([
    db.collection('roles').get().catch(() => null),
    db.collection('users').get().catch(() => null),
  ]);

  rolesSnap?.forEach(doc => {
    const data = doc.data() || {};
    const status = cleanLower(data.status || data.roleStatus || 'approved', 40);
    if (status !== 'approved') return;
    const keys = canonicalPositionKeys(data.positionKeys, data.clubPosition, data.position).filter(key => allowed.has(key));
    if (!keys.length) return;
    candidateUids.add(doc.id);
    const existing = positionKeysByUid.get(doc.id) || [];
    positionKeysByUid.set(doc.id, Array.from(new Set(existing.concat(keys))));
  });

  usersSnap?.forEach(doc => {
    const data = doc.data() || {};
    if (!isApprovedActiveUserRecord(data)) return;
    const keys = canonicalPositionKeys(data.positionKeys, data.clubPosition, data.position).filter(key => allowed.has(key));
    if (!keys.length) return;
    candidateUids.add(doc.id);
    const existing = positionKeysByUid.get(doc.id) || [];
    positionKeysByUid.set(doc.id, Array.from(new Set(existing.concat(keys))));
  });

  return { candidateUids: Array.from(candidateUids), positionKeysByUid };
}

async function candidateUidsForAvenues(avenues = []) {
  const candidateUids = new Set();
  const positionKeysByUid = new Map();
  for (const avenue of normalizeReportingAvenues(avenues)) {
    const result = await candidateUidsForAvenue(avenue);
    result.candidateUids.forEach(uid => candidateUids.add(uid));
    result.positionKeysByUid.forEach((keys, uid) => {
      const existing = positionKeysByUid.get(uid) || [];
      positionKeysByUid.set(uid, Array.from(new Set(existing.concat(keys))));
    });
  }
  return { candidateUids: Array.from(candidateUids), positionKeysByUid };
}

async function resolveReminderRecipients(recipientRole) {
  const normalizedRole = normalizeReminderRecipientRole(recipientRole);
  const { candidateUids, positionKeysByUid } = await candidateUidsForReminderRole(normalizedRole);
  if (!candidateUids.length) return [];
  const [userSnapsByUid, roleSnapsByUid, authUsersByUid] = await Promise.all([
    getFirestoreDocsById('users', candidateUids),
    getFirestoreDocsById('roles', candidateUids),
    getAuthUsersById(candidateUids),
  ]);
  return dedupeReminderRecipients(candidateUids
    .map(uid => buildEligibleReminderRecipient(uid, {
      authRecord: authUsersByUid.get(uid),
      userSnap: userSnapsByUid.get(uid),
      roleSnap: roleSnapsByUid.get(uid),
      positionKeys: positionKeysByUid.get(uid) || [],
    }))
    .filter(Boolean)
    .filter(recipient => reminderRecipientMatchesRole(recipient, normalizedRole)));
}

async function resolveAvenueReportingRecipients(reminder, options = {}) {
  const hasScopedAvenues = Object.prototype.hasOwnProperty.call(options, 'avenues');
  const scopedAvenues = normalizeReportingAvenues(options.avenues || []);
  const avenues = hasScopedAvenues ? scopedAvenues : reportingWindowAvenuesForReminder(reminder);
  if (reminder.recipientRole === 'secretary') return resolveReminderRecipients('secretary');
  const { candidateUids, positionKeysByUid } = await candidateUidsForAvenues(avenues);
  if (!candidateUids.length) return [];
  const allowed = new Set(reportingWindowRecipientPositionKeys(avenues));
  const [userSnapsByUid, roleSnapsByUid, authUsersByUid] = await Promise.all([
    getFirestoreDocsById('users', candidateUids),
    getFirestoreDocsById('roles', candidateUids),
    getAuthUsersById(candidateUids),
  ]);
  return dedupeReminderRecipients(candidateUids
    .map(uid => buildEligibleReminderRecipient(uid, {
      authRecord: authUsersByUid.get(uid),
      userSnap: userSnapsByUid.get(uid),
      roleSnap: roleSnapsByUid.get(uid),
      positionKeys: positionKeysByUid.get(uid) || [],
    }))
    .filter(Boolean)
    .filter(recipient => normalizePositionKeys(recipient.positionKeys).some(key => allowed.has(key))));
}

async function loadReminderTarget(config) {
  const collectionName = targetCollectionForReminder(config);
  if (!collectionName || !config.targetId) return null;
  const ref = db.collection(collectionName).doc(config.targetId);
  const snapshot = await ref.get();
  if (!snapshot.exists) return { ref, snapshot, data: null };
  return {
    ref,
    snapshot,
    data: snapshot.data() || {},
    targetType: config.targetType,
    targetId: config.targetId,
  };
}

function reminderHistoryPayload({ reminder, recipient = {}, status, errorCode = '', attemptNumber, maxReminders, sentAt }) {
  const avenues = reportingWindowAvenuesForReminder(reminder);
  return {
    reminderId: reminder.id,
    reminderType: reminder.reminderType,
    targetType: reminder.targetType,
    targetId: reminder.targetId,
    targetName: reminder.targetName,
    targetDate: reminder.targetDate,
    avenue: reminder.avenue || avenues[0] || '',
    avenues,
    avenuesLabel: cleanText(reminder.avenuesLabel, 160) || reportingAvenuesLabel(avenues),
    recipientRole: reminder.recipientRole,
    recipientUid: cleanText(recipient.uid, 160),
    recipientEmail: cleanLower(recipient.email, 320),
    sentAt,
    status,
    errorCode,
    attemptNumber,
    maxReminders,
  };
}

async function writeReminderHistory(items = []) {
  if (!items.length) return;
  let batch = db.batch();
  let operations = 0;
  for (const item of items) {
    const ref = db.collection(REMINDER_EMAIL_HISTORY_COLLECTION).doc();
    batch.set(ref, item);
    operations += 1;
    if (operations >= 450) {
      await batch.commit();
      batch = db.batch();
      operations = 0;
    }
  }
  if (operations) await batch.commit();
}

async function sendReminderMessages({ reminder, recipients }) {
  const summary = { attempted: recipients.length, sent: 0, failed: 0, skippedInvalidEmail: 0 };
  const results = [];
  if (!recipients.length) return { summary, results, failureReason: 'no_recipients' };
  if (!EMAIL_USER || !EMAIL_PASS) {
    recipients.forEach(recipient => results.push({ recipient, status: 'failed', errorCode: 'email_not_configured' }));
    summary.failed = recipients.length;
    return { summary, results, failureReason: 'email_not_configured' };
  }

  for (const recipient of recipients) {
    const email = normalizeMomEmailAddress(recipient.email);
    if (!email.ok) {
      summary.failed += 1;
      summary.skippedInvalidEmail += 1;
      results.push({ recipient, status: 'failed', errorCode: email.code || 'invalid_email' });
      continue;
    }
    const message = buildReminderEmail({ reminder, recipient });
    try {
      await reminderTransporter.sendMail({
        from: `"RCPH Platform" <${EMAIL_USER}>`,
        to: email.email,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      summary.sent += 1;
      results.push({ recipient, status: 'sent', errorCode: '' });
    } catch (error) {
      summary.failed += 1;
      results.push({ recipient, status: 'failed', errorCode: cleanText(error?.code || 'smtp_failed', 80) });
      logger.warn('Reminder email recipient send failed.', { reminderId: reminder.id, uid: recipient.uid, code: error?.code || '', message: error?.message || '' });
    }
  }

  const accounted = summary.sent + summary.failed;
  if (accounted < summary.attempted) summary.failed += summary.attempted - accounted;
  return { summary, results, failureReason: summary.sent ? '' : 'smtp_failed' };
}

async function completeReminder(doc, reminder, reason, now, historyStatus = 'skipped') {
  await doc.ref.set({
    status: 'completed',
    completedAt: now,
    completionReason: reason,
    updatedAt: now,
  }, { merge: true });
  await writeReminderHistory([reminderHistoryPayload({
    reminder,
    status: historyStatus,
    errorCode: reason,
    attemptNumber: reminder.remindersSent,
    maxReminders: reminder.maxReminders,
    sentAt: now,
  })]);
}

async function failReminder(doc, reminder, status, reason, now, recipient = {}) {
  await doc.ref.set({
    status,
    failureReason: reason,
    updatedAt: now,
  }, { merge: true });
  await writeReminderHistory([reminderHistoryPayload({
    reminder,
    recipient,
    status,
    errorCode: reason,
    attemptNumber: reminder.remindersSent + 1,
    maxReminders: reminder.maxReminders,
    sentAt: now,
  })]);
}

function eventDateFromBodEvent(data = {}) {
  return cleanText(data.date || data.eventStart || data.startDate, 40);
}

function eventNameFromBodEvent(data = {}) {
  return cleanText(data.name || data.title, 180);
}

function eventAvenueKeys(data = {}) {
  const source = Array.isArray(data.avenues)
    ? data.avenues
    : (Array.isArray(data.avenue) ? data.avenue : [data.avenue]);
  return source.map(normalizeAvenueKey).filter(Boolean);
}

function reportingWindowExpectedTargetType(reminder = {}) {
  const avenue = reportingWindowAvenuesForReminder(reminder)[0] || normalizeAvenueKey(reminder.avenue);
  return avenue === 'BOD_MEETING' ? 'bod_meeting' : 'club_event';
}

function bodEventTargetForWorkflow(doc) {
  const data = doc.data() || {};
  const type = cleanText(data.type, 80);
  if (type === 'bodMeeting' || data.syncedMeetingId) {
    return {
      targetType: 'bod_meeting',
      targetId: safeDocumentId(data.syncedMeetingId || doc.id),
      bodEventId: doc.id,
      data,
    };
  }
  if (type === 'clubEvent' || data.syncedEventId || !type) {
    return {
      targetType: 'club_event',
      targetId: safeDocumentId(data.syncedEventId || doc.id),
      bodEventId: doc.id,
      data,
    };
  }
  return {
    targetType: '',
    targetId: '',
    bodEventId: doc.id,
    data,
  };
}

function bodEventMatchesReportingWindowShape(reminder, data, targetType) {
  if (eventDateFromBodEvent(data) !== reminder.conductedDate) return false;
  const expectedTargetType = reportingWindowExpectedTargetType(reminder);
  if (targetType !== expectedTargetType) return false;
  const avenueKey = reportingWindowAvenuesForReminder(reminder)[0] || normalizeAvenueKey(reminder.avenue);
  if (avenueKey === 'BOD_MEETING') return true;
  return eventAvenueKeys(data).includes(avenueKey);
}

async function findReportingWindowBodEventMatch(reminder) {
  const expectedTargetType = reportingWindowExpectedTargetType(reminder);
  const snap = await db.collection('bodEvents').get().catch(() => null);
  if (!snap) {
    return { submitted: false, detection: 'bod_events_unavailable' };
  }

  const exact = [];
  const scored = [];
  snap.docs.forEach((doc) => {
    const target = bodEventTargetForWorkflow(doc);
    const data = target.data || {};
    if (!target.targetType || !target.targetId) return;
    if (data.archived === true || cleanLower(data.status, 40) === 'deleted') return;
    if (cleanText(data.reportingWindowId || data.reminderId, 180) === reminder.id) {
      exact.push({ ...target, confidence: 1, matchType: 'reportingWindowId' });
      return;
    }
    if (!bodEventMatchesReportingWindowShape(reminder, data, target.targetType)) return;
    const confidence = normalizedNameSimilarity(reminder.targetName, eventNameFromBodEvent(data));
    scored.push({ ...target, confidence, matchType: 'strict_fallback' });
  });

  if (exact.length === 1) {
    return { submitted: true, detection: 'reportingWindowId', match: exact[0] };
  }
  if (exact.length > 1) {
    return {
      submitted: false,
      detection: 'ambiguous_reportingWindowId',
      possibleMatchCount: exact.length,
    };
  }

  const strong = scored
    .filter(match => match.confidence >= 0.88)
    .sort((a, b) => b.confidence - a.confidence);
  if (strong.length === 1 || (strong.length > 1 && strong[0].confidence - strong[1].confidence >= 0.02)) {
    return { submitted: true, detection: 'strict_fallback', match: strong[0] };
  }

  const possible = scored
    .filter(match => match.confidence >= 0.7)
    .sort((a, b) => b.confidence - a.confidence)[0];
  if (possible) {
    return {
      submitted: false,
      detection: 'possible_match_not_auto_submitted',
      possibleMatchId: possible.bodEventId,
      possibleMatchConfidence: possible.confidence,
      expectedTargetType,
    };
  }

  return { submitted: false, detection: 'none' };
}

async function hasAvenueReportSubmission(reminder) {
  return findReportingWindowBodEventMatch(reminder);
}

function attendanceCollectionAndFieldForReminder(reminder, target) {
  const targetType = cleanLower(reminder?.targetType || target?.targetType, 80);
  const data = target?.data || {};
  if (targetType === 'bod_meeting' || cleanText(data.type, 80) === 'bodMeeting' || data.syncedMeetingId) {
    return {
      collectionName: 'bodAttendance',
      fieldId: safeDocumentId(data.syncedMeetingId || reminder?.targetId || target?.targetId),
      detection: 'at_least_one_present_absent_bod_attendance',
    };
  }
  return {
    collectionName: 'attendance',
    fieldId: safeDocumentId(data.syncedEventId || reminder?.targetId || target?.targetId),
    detection: 'at_least_one_present_absent',
  };
}

async function hasAttendanceSubmission(reminder, target) {
  const context = attendanceCollectionAndFieldForReminder(reminder, target);
  if (!context.collectionName || !context.fieldId) {
    return { submitted: false, detection: 'invalid_attendance_target', markedCount: 0 };
  }
  const snap = await db.collection(context.collectionName).get().catch(() => null);
  if (!snap) return { submitted: false, detection: 'attendance_collection_unavailable', markedCount: 0 };
  let markedCount = 0;
  snap.forEach((doc) => {
    const value = (doc.data() || {})[context.fieldId];
    if (attendanceValueIsMarked(value)) markedCount += 1;
  });
  return {
    submitted: markedCount > 0,
    detection: context.detection,
    markedCount,
    collectionName: context.collectionName,
    fieldId: context.fieldId,
  };
}

async function processEventReminderDoc(doc) {
  const config = normalizeReminderConfig(doc.id, doc.data() || {});
  const skipReason = reminderSkipReason(config);
  if (skipReason) return { outcome: 'skipped', reason: skipReason };

  const now = admin.firestore.Timestamp.now();
  const target = await loadReminderTarget(config);
  if (!target?.data) {
    await failReminder(doc, config, 'failed', 'target_not_found', now);
    return { outcome: 'failed', reason: 'target_not_found' };
  }

  const reminder = {
    ...config,
    targetName: targetNameFromData(config, target.data),
    targetDate: targetDateFromData(config, target.data),
  };

  if (reminder.reminderType === 'mom_submission' && hasMomMetadata(target.data)) {
    await completeReminder(doc, reminder, 'mom_uploaded', now, 'skipped');
    if (reminder.reportingWindowId) {
      await updateReportingWindowWorkflowFields(reminder.reportingWindowId, {
        momStatus: 'uploaded',
        momUploadedAt: now,
        momCompletionReason: 'mom_uploaded',
      }, now);
      await writeReminderSystemLog({
        access: { uid: 'system', displayName: 'System', storedRole: 'system' },
        action: 'stopped',
        status: 'success',
        targetType: 'mom_submission',
        targetId: reminder.reportingWindowId,
        targetLabel: reminder.targetName,
        details: 'MOM reminder stopped after MOM upload metadata was found.',
        source: 'processEventReminderDoc',
        relatedDocPath: `${REMINDERS_COLLECTION}/${reminder.reportingWindowId}`,
        metadata: {
          reportingWindowId: reminder.reportingWindowId,
          targetType: reminder.targetType,
          targetId: reminder.targetId,
          completionRule: 'hasMomMetadata',
        },
      }, { safe: true });
    }
    return { outcome: 'completed', reason: 'mom_uploaded' };
  }

  if (reminder.reminderType === 'attendance_marking') {
    const attendance = await hasAttendanceSubmission(reminder, target);
    if (attendance.submitted) {
      await completeReminder(doc, reminder, 'attendance_marked', now, 'skipped');
      if (reminder.reportingWindowId) {
        await updateReportingWindowWorkflowFields(reminder.reportingWindowId, {
          attendanceStatus: 'marked',
          attendanceMarkedAt: now,
          attendanceCompletionReason: 'attendance_marked',
          attendanceCompletionRule: attendance.detection,
          attendanceMarkedCount: attendance.markedCount,
        }, now);
        await writeReminderSystemLog({
          access: { uid: 'system', displayName: 'System', storedRole: 'system' },
          action: 'stopped',
          status: 'success',
          targetType: 'attendance_marking',
          targetId: reminder.reportingWindowId,
          targetLabel: reminder.targetName,
          details: 'Attendance reminder stopped after marked attendance values were found.',
          source: 'processEventReminderDoc',
          relatedDocPath: `${REMINDERS_COLLECTION}/${reminder.reportingWindowId}`,
          metadata: {
            reportingWindowId: reminder.reportingWindowId,
            targetType: reminder.targetType,
            targetId: reminder.targetId,
            completionRule: attendance.detection,
            markedCount: attendance.markedCount,
          },
        }, { safe: true });
      }
      return { outcome: 'completed', reason: 'attendance_marked' };
    }
  }

  const recipients = await resolveReminderRecipients(reminder.recipientRole);
  if (!recipients.length) {
    await failReminder(doc, reminder, 'no_recipient', 'no_eligible_recipient', now);
    return { outcome: 'noRecipient', reason: 'no_eligible_recipient' };
  }

  const { summary, results, failureReason } = await sendReminderMessages({ reminder, recipients });
  const attemptNumber = reminder.remindersSent + 1;
  await writeReminderHistory(results.map(result => reminderHistoryPayload({
    reminder,
    recipient: result.recipient,
    status: result.status,
    errorCode: result.errorCode,
    attemptNumber,
    maxReminders: reminder.maxReminders,
    sentAt: now,
  })));

  if (!summary.sent) {
    await doc.ref.set({
      status: 'failed',
      failureReason: failureReason || 'smtp_failed',
      updatedAt: now,
    }, { merge: true });
    return { outcome: 'failed', reason: failureReason || 'smtp_failed' };
  }

  const next = nextSentState(reminder);
  await doc.ref.set({
    status: next.status,
    remindersSent: next.remindersSent,
    lastReminderSentAt: now,
    updatedAt: now,
    ...(next.status === 'completed' ? { completedAt: now, completionReason: next.completionReason } : { failureReason: '' }),
  }, { merge: true });

  return {
    outcome: next.status === 'completed' ? 'completed' : 'sent',
    reason: next.completionReason,
    sent: summary.sent,
    failed: summary.failed,
  };
}

async function setReportingWindowStatus(doc, status, now, extra = {}) {
  await doc.ref.set({
    status,
    updatedAt: now,
    ...extra,
  }, { merge: true });
}

async function createOrActivateAvenueReportingLock(doc, reminder, now) {
  const lockId = reminder.lockId || avenueReportingLockId(reminder.id);
  const lockRef = db.collection('locks').doc(lockId);
  const lockSnap = await lockRef.get();
  const alreadyActive = lockSnap.exists && lockSnap.data()?.status === 'active' && lockSnap.data()?.locked === true;
  const payload = avenueReportingLockPayload({ ...reminder, lockId }, now);
  await lockRef.set({
    ...payload,
    createdAt: lockSnap.exists ? (lockSnap.data()?.createdAt || now) : now,
  }, { merge: true });
  await doc.ref.set({
    status: 'locked',
    lockId,
    lockedAt: now,
    lockReason: AVENUE_REPORTING_LOCK_REASON,
    completionReason: AVENUE_REPORTING_LOCK_REASON,
    updatedAt: now,
  }, { merge: true });

  if (!alreadyActive) {
    await writeReminderHistory([reminderHistoryPayload({
      reminder,
      status: 'locked',
      errorCode: AVENUE_REPORTING_LOCK_REASON,
      attemptNumber: reminder.remindersSent,
      maxReminders: reminder.maxReminders,
      sentAt: now,
    })]);
    await writeReminderSystemLog({
      access: { uid: 'system', displayName: 'System', storedRole: 'system' },
      category: 'lock',
      action: 'locked',
      status: 'active',
      targetType: 'avenue_reporting_window',
      targetId: reminder.id,
      targetLabel: reminder.targetName || reminder.eventName || reminder.avenue,
      targetAudience: reportingWindowAudienceLabel(reminder),
      details: 'Avenue reporting window locked after deadline.',
      source: 'createOrActivateAvenueReportingLock',
      relatedDocPath: `locks/${lockId}`,
      metadata: {
        avenue: reminder.avenue,
        avenues: reportingWindowAvenuesForReminder(reminder),
        avenuesLabel: reportingWindowAudienceLabel(reminder),
        reportingWindowId: reminder.id,
        lockReason: AVENUE_REPORTING_LOCK_REASON,
      },
    }, { safe: true });
  }

  return { created: !alreadyActive, lockId };
}

async function processAvenueReportingWindowDoc(doc, options = {}) {
  const normalized = normalizeReportingWindowConfig(doc.id, doc.data() || {});
  const reminder = normalized ? {
    ...normalized,
    bodToolsUrl: normalized.bodToolsUrl || bodToolsPrefillUrl(normalized.id),
  } : null;
  if (!reminder) return { outcome: 'skipped', reason: 'invalid_reporting_window' };

  const now = admin.firestore.Timestamp.now();
  const nowMillis = now.toMillis();
  const scheduleRuntimeState = reportingWindowRuntimeState(reminder, nowMillis);
  const runtimeState = options.forceSend === true && scheduleRuntimeState !== 'not_open'
    ? (nowMillis >= reminder.lockAtMillis ? 'lock_due' : (reminder.remindersSent > 0 ? 'active' : 'open'))
    : scheduleRuntimeState;
  if (runtimeState === 'completed' || runtimeState === 'locked' || runtimeState === 'unlocked' || runtimeState === 'no_recipient') {
    return { outcome: 'skipped', reason: runtimeState };
  }

  let liveCoverage = null;
  let liveCoveragePersisted = false;
  const submitted = await hasAvenueReportSubmission(reminder);
  if (submitted.submitted) {
    const linked = await linkReportingWindowToTarget({
      reportingWindow: reminder,
      targetType: submitted.match.targetType,
      targetId: submitted.match.targetId,
      bodEventId: submitted.match.bodEventId,
      eventData: submitted.match.data,
      access: { uid: 'system', displayName: 'System', storedRole: 'system' },
      now,
      match: {
        detection: submitted.detection,
        confidence: submitted.match.confidence,
        matchType: submitted.match.matchType,
      },
    });
    if (linked.complete === true) {
      await writeReminderHistory([reminderHistoryPayload({
        reminder,
        status: 'skipped',
        errorCode: 'report_submitted',
        attemptNumber: reminder.remindersSent,
        maxReminders: reminder.maxReminders,
        sentAt: now,
      })]);
      return { outcome: 'alreadySubmitted', reason: 'report_submitted' };
    }
    liveCoverage = linked.coverage || null;
    liveCoveragePersisted = Boolean(linked.coverage);
  }
  if (submitted.possibleMatchId) {
    await doc.ref.set({
      possibleMatchStatus: 'possible_match',
      possibleMatchId: submitted.possibleMatchId,
      possibleMatchConfidence: submitted.possibleMatchConfidence,
      possibleMatchDetection: submitted.detection,
      updatedAt: now,
    }, { merge: true });
  }

  if (!liveCoverage) liveCoverage = await loadLiveReportingReminderCoverage(reminder);
  const liveAudience = reportingReminderAudienceConfig(reminder, liveCoverage);
  if (liveAudience.complete === true) {
    await completeReportingWindowFromLiveCoverage(doc, reminder, liveCoverage, now);
    return { outcome: 'alreadySubmitted', reason: 'report_submitted' };
  }
  if (!liveCoveragePersisted) await persistLiveReportingCoverage(doc, reminder, liveCoverage, now);

  if (runtimeState === 'not_open') {
    if (reminder.status !== 'not_open') await setReportingWindowStatus(doc, 'not_open', now);
    return { outcome: 'skipped', reason: 'not_open' };
  }

  if (runtimeState === 'lock_due') {
    if (reminder.lockEnabled !== true) {
      await setReportingWindowStatus(doc, reminder.remindersSent > 0 ? 'active' : 'open', now, {
        lockReason: '',
      });
      return { outcome: 'skipped', reason: 'lock_disabled' };
    }
    const lock = await createOrActivateAvenueReportingLock(doc, reminder, now);
    return { outcome: 'locked', reason: AVENUE_REPORTING_LOCK_REASON, lockId: lock.lockId };
  }

  const openStatus = reminder.remindersSent > 0 ? 'active' : 'open';
  if (reminder.remindersEnabled !== true) {
    if (reminder.status !== openStatus) await setReportingWindowStatus(doc, openStatus, now);
    return { outcome: 'skipped', reason: 'reminders_disabled' };
  }

  if (reminder.remindersSent >= reminder.maxReminders) {
    if (reminder.status !== 'active') await setReportingWindowStatus(doc, 'active', now);
    return { outcome: 'skipped', reason: 'max_reminders_reached' };
  }

  const sendReminder = withReportingReminderPendingAudience(reminder, liveCoverage);
  const recipients = await resolveAvenueReportingRecipients(sendReminder, { avenues: sendReminder.pendingAvenues });
  if (!recipients.length) {
    await failReminder(doc, sendReminder, 'no_recipient', 'no_eligible_recipient', now);
    await writeReminderSystemLog({
      access: { uid: 'system', displayName: 'System', storedRole: 'system' },
      action: 'no_recipient',
      status: 'failed',
      targetType: 'avenue_reporting_window',
      targetId: reminder.id,
      targetLabel: reminder.targetName,
      targetAudience: reportingWindowAudienceLabel(sendReminder),
      details: 'No eligible recipients found for the pending avenue reporting audience.',
      source: 'processAvenueReportingWindowDoc',
      relatedDocPath: `${REMINDERS_COLLECTION}/${reminder.id}`,
      metadata: {
        reportingWindowId: reminder.id,
        avenue: reminder.avenue,
        avenues: reportingWindowAvenuesForReminder(reminder),
        avenuesLabel: reportingWindowAudienceLabel(reminder),
        pendingAvenuesLabel: reportingWindowAudienceLabel(sendReminder),
        ...reportingReminderLogMetadata(reminder, liveCoverage, 0),
      },
    }, { safe: true });
    return { outcome: 'noRecipient', reason: 'no_eligible_recipient' };
  }

  const { summary, results, failureReason } = await sendReminderMessages({ reminder: sendReminder, recipients });
  const attemptNumber = reminder.remindersSent + 1;
  await writeReminderHistory(results.map(result => reminderHistoryPayload({
    reminder: sendReminder,
    recipient: result.recipient,
    status: result.status,
    errorCode: result.errorCode,
    attemptNumber,
    maxReminders: reminder.maxReminders,
    sentAt: now,
  })));

  if (!summary.sent) {
    await doc.ref.set({
      status: 'failed',
      failureReason: failureReason || 'smtp_failed',
      updatedAt: now,
    }, { merge: true });
    return { outcome: 'failed', reason: failureReason || 'smtp_failed' };
  }

  const next = nextAvenueReportingSentState(reminder);
  await doc.ref.set({
    status: next.status,
    remindersSent: next.remindersSent,
    lastReminderSentAt: now,
    failureReason: '',
    completionReason: '',
    updatedAt: now,
  }, { merge: true });
  await writeReminderSystemLog({
    access: { uid: 'system', displayName: 'System', storedRole: 'system' },
    action: 'sent',
    status: 'success',
    targetType: 'avenue_reporting_window',
    targetId: reminder.id,
    targetLabel: reminder.targetName,
    targetAudience: reportingWindowAudienceLabel(sendReminder),
    details: `${summary.sent}/${summary.attempted} reporting workflow email recipients sent.`,
    source: 'processAvenueReportingWindowDoc',
    relatedDocPath: `${REMINDERS_COLLECTION}/${reminder.id}`,
    metadata: {
      reportingWindowId: reminder.id,
      avenue: reminder.avenue,
      avenues: reportingWindowAvenuesForReminder(reminder),
      avenuesLabel: reportingWindowAudienceLabel(reminder),
      pendingAvenuesLabel: reportingWindowAudienceLabel(sendReminder),
      ...reportingReminderLogMetadata(reminder, liveCoverage, recipients.length),
      sent: summary.sent,
      failed: summary.failed,
      bodToolsUrl: reminder.bodToolsUrl,
    },
  }, { safe: true });

  return { outcome: 'sent', sent: summary.sent, failed: summary.failed, pendingAvenues: sendReminder.pendingAvenues };
}

async function processReminderDoc(doc) {
  const data = doc.data() || {};
  if (cleanText(data.recordType || data.type, 80) === REPORTING_WINDOW_RECORD_TYPE) {
    return processAvenueReportingWindowDoc(doc);
  }
  return processEventReminderDoc(doc);
}

async function runReminderSweep({ trigger = 'manual', actor = null } = {}) {
  const summary = {
    ok: true,
    trigger,
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    completed: 0,
    noRecipient: 0,
    locked: 0,
    alreadySubmitted: 0,
    attendanceCompletionDetection: 'at_least_one_present_absent',
    avenueReportSubmissionDetection: 'reportingWindowId_or_strict_fallback',
  };

  const snap = await db.collection(REMINDERS_COLLECTION).get();
  for (const doc of snap.docs) {
    const result = await processReminderDoc(doc);
    if (result.outcome === 'skipped') {
      summary.skipped += 1;
      continue;
    }
    summary.processed += 1;
    if (result.outcome === 'sent') summary.sent += 1;
    else if (result.outcome === 'completed') {
      if (result.sent > 0) summary.sent += 1;
      summary.completed += 1;
    } else if (result.outcome === 'alreadySubmitted') {
      summary.completed += 1;
      summary.alreadySubmitted += 1;
    } else if (result.outcome === 'noRecipient') summary.noRecipient += 1;
    else if (result.outcome === 'locked') summary.locked += 1;
    else if (result.outcome === 'failed') summary.failed += 1;
  }

  logger.info('Reminder email sweep complete.', summary);
  await writeReminderSystemLog({
    access: actor || { uid: trigger === 'scheduled' ? 'system' : '', displayName: trigger === 'scheduled' ? 'System' : 'Unknown user', storedRole: trigger === 'scheduled' ? 'system' : '' },
    category: 'reminder',
    action: 'swept',
    status: summary.failed > 0 ? 'failed' : 'success',
    targetType: 'reminder_sweep',
    targetId: trigger,
    targetLabel: `${trigger} reminder sweep`,
    details: `${summary.processed} processed; ${summary.sent} sent; ${summary.failed} failed; ${summary.locked} locked`,
    source: 'runReminderSweep',
    relatedDocPath: '',
    metadata: summary,
  }, { safe: true });
  return summary;
}

async function writeReminderTemplateTestAudit({ access, templateType, recipientEmail, status, errorCode = '' }) {
  const sentAt = admin.firestore.Timestamp.now();
  await db.collection(REMINDER_TEMPLATE_TEST_HISTORY_COLLECTION).doc().set({
    templateType,
    recipientEmail,
    sentBy: cleanText(access.uid, 160),
    sentByName: cleanText(access.displayName, 180) || 'Unknown user',
    sentAt,
    status,
    errorCode,
  });
  return sentAt;
}

function reminderPayloadSource(raw = {}) {
  return raw && typeof raw.payload === 'object' && !Array.isArray(raw.payload)
    ? raw.payload
    : raw;
}

function assertReminderPayloadRecordType(payload = {}, expectedRecordType) {
  const recordType = cleanText(payload.recordType || payload.type, 80);
  if (recordType !== expectedRecordType) {
    throw new HttpsError('invalid-argument', 'Reminder payload type is invalid.');
  }
}

async function requireReminderDocument(reminderId, expectedRecordType) {
  const safeId = safeDocumentId(reminderId);
  if (!safeId) throw new HttpsError('invalid-argument', 'Choose a valid reminder record.');
  const ref = db.collection(REMINDERS_COLLECTION).doc(safeId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Reminder record not found.');
  const data = snap.data() || {};
  assertReminderPayloadRecordType(data, expectedRecordType);
  return { id: safeId, ref, snap, data };
}

const createReportingWindowReminder = onCall(CALLABLE_OPTIONS, async (request) => {
  const access = await requireAdminPanelReminderAccess(request, 'create reporting windows');
  const payload = reminderPayloadSource(request.data || {});
  assertReminderPayloadRecordType(payload, REPORTING_WINDOW_RECORD_TYPE);
  const target = db.collection(REMINDERS_COLLECTION).doc();
  const targetName = cleanText(payload.targetName || payload.eventName || payload.name, 180);
  if (!targetName) throw new HttpsError('invalid-argument', 'Event/meeting name is required.');
  const now = admin.firestore.Timestamp.now();
  const draftPayload = {
    ...payload,
    targetName,
    eventName: targetName,
    bodToolsUrl: bodToolsPrefillUrl(target.id),
    eventReportStatus: 'pending',
    momStatus: 'pending',
    attendanceStatus: 'pending',
    workflowStatus: 'created',
    possibleMatchStatus: '',
    createdBy: access.uid,
    createdByName: access.displayName || 'Unknown user',
    updatedBy: access.uid,
    updatedByName: access.displayName || 'Unknown user',
    createdAt: now,
    updatedAt: now,
  };
  const normalized = normalizeReportingWindowConfig(target.id, draftPayload);
  if (!normalized) throw new HttpsError('invalid-argument', 'Reporting window payload is invalid.');
  const persistedPayload = {
    ...draftPayload,
    avenue: normalized.avenue,
    avenueLabel: normalized.avenueLabel,
    avenues: normalized.avenues,
    avenueLabels: normalized.avenueLabels,
    avenuesLabel: normalized.avenuesLabel,
    anchorDate: normalized.anchorDate,
    reportingDeadlineAnchorDate: normalized.reportingDeadlineAnchorDate,
    countdownStartAt: new Date(normalized.countdownStartAt),
    reportingAvailableAt: new Date(normalized.reportingAvailableAt),
    reportingOpensAt: new Date(normalized.reportingOpensAt),
    windowOpensAt: new Date(normalized.windowOpensAt),
    reportingDueAt: new Date(normalized.reportingDueAt),
    reportDueAt: new Date(normalized.reportDueAt),
    lockAt: new Date(normalized.lockAt),
    timezone: normalized.timezone,
    recipientRole: normalized.recipientRole,
    recipientPositionKeys: normalized.recipientPositionKeys,
  };
  await target.set(persistedPayload);
  await writeReminderSystemLog({
    access,
    action: 'created',
    status: 'active',
    targetType: 'avenue_reporting_window',
    targetId: target.id,
    targetLabel: targetName || normalized.avenue,
    targetAudience: reportingWindowAudienceLabel(normalized),
    details: 'Reporting window reminder created.',
    source: 'createReportingWindowReminder',
    relatedDocPath: `${REMINDERS_COLLECTION}/${target.id}`,
    metadata: {
      avenue: normalized.avenue,
      avenues: normalized.avenues,
      avenuesLabel: normalized.avenuesLabel,
      conductedDate: normalized.conductedDate,
      remindersEnabled: normalized.remindersEnabled === true,
      lockEnabled: normalized.lockEnabled === true,
    },
  });

  if (isSpecialReportingWindow(normalized)) {
    await upsertWorkflowReminderConfigs({
      reportingWindow: normalized,
      targetType: 'avenue_reporting_window',
      targetId: normalized.id,
      enabled: persistedPayload.remindersEnabled === true,
      requiresBodToolsRecord: true,
      access,
      now,
    });
  }

  let initialEmail = { outcome: 'skipped', reason: 'reminders_disabled' };
  if (persistedPayload.remindersEnabled === true) {
    const snap = await target.get();
    initialEmail = await processAvenueReportingWindowDoc(snap, { forceSend: true });
  }

  return { ok: true, reminderId: target.id, initialEmail };
});

const getBodReportingQueue = onCall(CALLABLE_OPTIONS, async (request) => {
  await requireBodToolsReportingAccess(request, 'view the BOD reporting queue');
  const nowMillis = Date.now();
  const reminderSnap = await db.collection(REMINDERS_COLLECTION).get();
  const reportingWindows = reminderSnap.docs
    .map(doc => normalizeReportingWindowConfig(doc.id, doc.data() || {}))
    .filter(Boolean);
  const linkedBodEventIds = reportingWindows
    .filter(reminder => !isSpecialReportingWindow(reminder))
    .map(queueLinkedBodEventId)
    .filter(Boolean);
  const reportingLockIds = reportingWindows
    .map(reminder => safeDocumentId(reminder.lockId))
    .filter(Boolean);
  const [linkedBodEvents, queueAssignees, reportingLocks] = await Promise.all([
    getFirestoreDocsById('bodEvents', linkedBodEventIds),
    loadBodReportingQueueAssignees(),
    getFirestoreDocsById('locks', reportingLockIds),
  ]);

  const items = reportingWindows.reduce((list, reminder) => {
    const linkedBodEventId = queueLinkedBodEventId(reminder);
    const eventSnap = linkedBodEventId ? linkedBodEvents.get(linkedBodEventId) : null;
    const lockSnap = reminder.lockId ? reportingLocks.get(reminder.lockId) : null;
    const coverage = reportingWindowQueueCoverage(reminder, eventSnap?.exists ? eventSnap.data() || {} : {});
    if (!shouldIncludeBodReportingQueueItem(reminder, coverage)) return list;
    const responsibilities = buildBodReportingQueueResponsibilities(reminder.avenues, queueAssignees);
    list.push(shapeBodReportingQueueItem({
      reminder,
      coverage,
      responsibilities,
      nowMillis,
      lock: lockSnap?.exists ? lockSnap.data() || {} : null,
    }));
    return list;
  }, []);

  items.sort(compareBodReportingQueueItems);
  return { ok: true, items };
});

const getReportingWindowPrefill = onCall(CALLABLE_OPTIONS, async (request) => {
  await requireBodToolsReportingAccess(request, 'open BOD Tools');

  const reportingWindowId = safeDocumentId(request.data?.reportingWindowId || request.data?.reminderId);
  if (!reportingWindowId) throw new HttpsError('invalid-argument', 'Choose a valid reporting window.');
  const snap = await db.collection(REMINDERS_COLLECTION).doc(reportingWindowId).get();
  if (!snap.exists) throw new HttpsError('not-found', 'Reporting window not found.');
  const reminder = normalizeReportingWindowConfig(snap.id, snap.data() || {});
  if (!reminder) throw new HttpsError('failed-precondition', 'This record is not a reporting window.');
  const lifecycle = resolveReportingWindowLifecycle(reminder, { nowMillis: Date.now() });
  if (lifecycle.effectiveLocked) {
    throw new HttpsError('failed-precondition', 'This reporting window is locked.');
  }

  const normalizedAvenueKey = normalizeAvenueKey(reminder.avenue);
  const isBodMeetingWindow = normalizedAvenueKey === 'BOD_MEETING';
  const prefillAvenues = isBodMeetingWindow ? ['BOD'] : reminder.avenues;
  const prefillAvenueLabels = isBodMeetingWindow ? ['Board of Directors'] : reminder.avenueLabels;
  const prefillAvenuesLabel = isBodMeetingWindow ? 'Board of Directors' : reminder.avenuesLabel;
  return {
    ok: true,
    reportingWindowId: reminder.id,
    avenue: isBodMeetingWindow ? 'BOD' : reminder.avenue,
    avenues: prefillAvenues,
    avenueLabel: isBodMeetingWindow ? 'Board of Directors' : reminder.avenueLabel,
    avenueLabels: prefillAvenueLabels,
    avenuesLabel: prefillAvenuesLabel,
    eventName: reminder.targetName,
    name: reminder.targetName,
    conductedDate: reminder.conductedDate,
    date: reminder.conductedDate,
    time: reminder.eventTime,
    targetType: reportingWindowExpectedTargetType(reminder),
    bodToolsCreateSupported: true,
    warning: isSpecialReportingWindow(reminder) ? GBM_BOD_TOOLS_RECORD_WARNING : '',
    note: 'Please do not change the prefilled event name unless an Admin/President has asked you to correct it.',
  };
});

const upsertEventReminderConfig = onCall(CALLABLE_OPTIONS, async (request) => {
  const access = await requireAdminPanelReminderAccess(request, 'configure event reminders');
  const payload = reminderPayloadSource(request.data || {});
  assertReminderPayloadRecordType(payload, EVENT_REMINDER_RECORD_TYPE);
  const configId = safeDocumentId(payload.configId || payload.id);
  if (!configId) throw new HttpsError('invalid-argument', 'Reminder config ID is invalid.');
  const target = db.collection(REMINDERS_COLLECTION).doc(configId);
  const snap = await target.get();
  const now = admin.firestore.FieldValue.serverTimestamp();
  await target.set({
    ...payload,
    updatedBy: access.uid,
    updatedByName: access.displayName || 'Unknown user',
    updatedAt: now,
    ...(snap.exists ? {} : {
      createdBy: access.uid,
      createdByName: access.displayName || 'Unknown user',
      createdAt: now,
    }),
  }, { merge: true });
  await writeReminderSystemLog({
    access,
    action: snap.exists ? 'updated' : 'created',
    status: 'active',
    targetType: payload.targetType || payload.reminderType || 'event_reminder',
    targetId: payload.targetId || configId,
    targetLabel: payload.targetName || payload.name || payload.reminderType,
    targetAudience: payload.recipientRole,
    details: `${payload.reminderType || 'Reminder'} configured.`,
    source: 'upsertEventReminderConfig',
    relatedDocPath: `${REMINDERS_COLLECTION}/${configId}`,
    metadata: {
      reminderType: payload.reminderType,
      source: payload.source,
      targetType: payload.targetType,
      targetId: payload.targetId,
    },
  });
  return { ok: true, reminderId: configId };
});

const stopEventReminderConfig = onCall(CALLABLE_OPTIONS, async (request) => {
  const access = await requireAdminPanelReminderAccess(request, 'stop event reminders');
  const reminder = await requireReminderDocument(request.data?.reminderId || request.data?.configId, EVENT_REMINDER_RECORD_TYPE);
  const now = admin.firestore.FieldValue.serverTimestamp();
  await reminder.ref.set({
    enabled: false,
    disabled: true,
    status: 'stopped',
    stoppedAt: now,
    stoppedBy: access.uid,
    stoppedByName: access.displayName || 'Unknown user',
    stoppedReason: 'admin_removed',
    updatedBy: access.uid,
    updatedByName: access.displayName || 'Unknown user',
    updatedAt: now,
  }, { merge: true });
  await writeReminderSystemLog({
    access,
    action: 'updated',
    status: 'inactive',
    targetType: reminder.data.targetType || reminder.data.reminderType || 'event_reminder',
    targetId: reminder.data.targetId || reminder.id,
    targetLabel: reminder.data.targetName || reminder.data.name || reminder.data.reminderType,
    targetAudience: reminder.data.recipientRole,
    details: 'Event reminder stopped by admin.',
    source: 'stopEventReminderConfig',
    relatedDocPath: `${REMINDERS_COLLECTION}/${reminder.id}`,
    metadata: {
      reminderType: reminder.data.reminderType,
      stoppedReason: 'admin_removed',
    },
  });
  return { ok: true, reminderId: reminder.id };
});

const markReportingWindowSubmitted = onCall(CALLABLE_OPTIONS, async (request) => {
  const access = await requireAdminPanelReminderAccess(request, 'mark reporting windows completed');
  const reminder = await requireReminderDocument(request.data?.reportingWindowId || request.data?.reminderId, REPORTING_WINDOW_RECORD_TYPE);
  const adminNote = cleanText(request.data?.adminNote, 500);
  const now = admin.firestore.FieldValue.serverTimestamp();
  await reminder.ref.set({
    remindersEnabled: false,
    status: 'completed',
    completedAt: now,
    completedBy: access.uid,
    completedByName: access.displayName || 'Unknown user',
    completionReason: 'report_submitted',
    failureReason: '',
    adminNote,
    updatedBy: access.uid,
    updatedByName: access.displayName || 'Unknown user',
    updatedAt: now,
  }, { merge: true });
  await writeReminderSystemLog({
    access,
    action: 'completed',
    status: 'inactive',
    targetType: 'avenue_reporting_window',
    targetId: reminder.id,
    targetLabel: reminder.data.targetName || reminder.data.eventName || reminder.data.avenue,
    targetAudience: reportingWindowAudienceLabel(reminder.data),
    details: 'Reporting window marked completed.',
    source: 'markReportingWindowSubmitted',
    relatedDocPath: `${REMINDERS_COLLECTION}/${reminder.id}`,
    metadata: {
      avenue: reminder.data.avenue,
      avenues: reportingWindowAvenuesForReminder(reminder.data),
      avenuesLabel: reportingWindowAudienceLabel(reminder.data),
      completionReason: 'report_submitted',
      hasAdminNote: Boolean(adminNote),
    },
  });
  return { ok: true, reminderId: reminder.id };
});

const stopReportingWindowReminders = onCall(CALLABLE_OPTIONS, async (request) => {
  const access = await requireAdminPanelReminderAccess(request, 'stop reporting window reminders');
  const reminder = await requireReminderDocument(request.data?.reportingWindowId || request.data?.reminderId, REPORTING_WINDOW_RECORD_TYPE);
  const adminNote = cleanText(request.data?.adminNote, 500);
  const now = admin.firestore.FieldValue.serverTimestamp();
  await reminder.ref.set({
    remindersEnabled: false,
    completionReason: 'reminders_disabled',
    stoppedAt: now,
    stoppedBy: access.uid,
    stoppedByName: access.displayName || 'Unknown user',
    stoppedReason: 'reminders_disabled',
    adminNote,
    updatedBy: access.uid,
    updatedByName: access.displayName || 'Unknown user',
    updatedAt: now,
  }, { merge: true });
  await writeReminderSystemLog({
    access,
    action: 'updated',
    status: 'inactive',
    targetType: 'avenue_reporting_window',
    targetId: reminder.id,
    targetLabel: reminder.data.targetName || reminder.data.eventName || reminder.data.avenue,
    targetAudience: reportingWindowAudienceLabel(reminder.data),
    details: 'Reporting window reminder emails stopped.',
    source: 'stopReportingWindowReminders',
    relatedDocPath: `${REMINDERS_COLLECTION}/${reminder.id}`,
    metadata: {
      avenue: reminder.data.avenue,
      avenues: reportingWindowAvenuesForReminder(reminder.data),
      avenuesLabel: reportingWindowAudienceLabel(reminder.data),
      stoppedReason: 'reminders_disabled',
      hasAdminNote: Boolean(adminNote),
    },
  });
  return { ok: true, reminderId: reminder.id };
});

const updateReportingWindowAdminNote = onCall(CALLABLE_OPTIONS, async (request) => {
  const access = await requireAdminPanelReminderAccess(request, 'update reporting window notes');
  const reminder = await requireReminderDocument(request.data?.reportingWindowId || request.data?.reminderId, REPORTING_WINDOW_RECORD_TYPE);
  const adminNote = cleanText(request.data?.adminNote, 500);
  const now = admin.firestore.FieldValue.serverTimestamp();
  await reminder.ref.set({
    adminNote,
    noteUpdatedAt: now,
    noteUpdatedBy: access.uid,
    noteUpdatedByName: access.displayName || 'Unknown user',
    updatedBy: access.uid,
    updatedByName: access.displayName || 'Unknown user',
    updatedAt: now,
  }, { merge: true });
  await writeReminderSystemLog({
    access,
    action: 'updated',
    status: 'info',
    targetType: 'avenue_reporting_window',
    targetId: reminder.id,
    targetLabel: reminder.data.targetName || reminder.data.eventName || reminder.data.avenue,
    targetAudience: reportingWindowAudienceLabel(reminder.data),
    details: 'Reporting window admin note updated.',
    source: 'updateReportingWindowAdminNote',
    relatedDocPath: `${REMINDERS_COLLECTION}/${reminder.id}`,
    metadata: {
      avenue: reminder.data.avenue,
      avenues: reportingWindowAvenuesForReminder(reminder.data),
      avenuesLabel: reportingWindowAudienceLabel(reminder.data),
      hasAdminNote: Boolean(adminNote),
    },
  });
  return { ok: true, reminderId: reminder.id };
});

const sendReminderTemplateTestEmail = onCall(CALLABLE_OPTIONS, async (request) => {
  const access = await requireAdminPanelReminderAccess(request, 'send reminder template tests');
  const templateType = normalizeReminderTemplateTestType(request.data?.templateType);
  if (!templateType) {
    throw new HttpsError('invalid-argument', 'Choose a valid reminder test template.');
  }

  const email = normalizeMomEmailAddress(request.data?.recipientEmail);
  if (!email.ok) {
    throw new HttpsError('invalid-argument', 'Enter a valid recipient email address.');
  }

  const message = buildReminderTemplateTestEmail({ templateType });
  if (!message) {
    throw new HttpsError('invalid-argument', 'Choose a valid reminder test template.');
  }

  if (!EMAIL_USER || !EMAIL_PASS) {
    await writeReminderTemplateTestAudit({
      access,
      templateType,
      recipientEmail: email.email,
      status: 'failed',
      errorCode: 'email_not_configured',
    });
    await writeReminderSystemLog({
      access,
      category: 'email',
      action: 'failed',
      status: 'failed',
      targetType: 'reminder_template_test',
      targetId: templateType,
      targetLabel: templateType,
      targetAudience: email.email,
      details: 'Reminder template test email failed: email not configured.',
      source: 'sendReminderTemplateTestEmail',
      metadata: {
        templateType,
        recipientEmail: email.email,
        errorCode: 'email_not_configured',
      },
    }, { safe: true });
    throw new HttpsError('failed-precondition', 'Reminder email SMTP is not configured.');
  }

  try {
    await reminderTransporter.sendMail({
      from: `"RCPH Platform" <${EMAIL_USER}>`,
      to: email.email,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    await writeReminderTemplateTestAudit({
      access,
      templateType,
      recipientEmail: email.email,
      status: 'sent',
    });
    await writeReminderSystemLog({
      access,
      category: 'email',
      action: 'sent',
      status: 'success',
      targetType: 'reminder_template_test',
      targetId: templateType,
      targetLabel: templateType,
      targetAudience: email.email,
      details: 'Reminder template test email sent.',
      source: 'sendReminderTemplateTestEmail',
      metadata: {
        templateType,
        recipientEmail: email.email,
      },
    }, { safe: true });
    return {
      ok: true,
      templateType,
      recipientEmail: email.email,
      status: 'sent',
    };
  } catch (error) {
    const errorCode = cleanText(error?.code || 'smtp_failed', 80);
    await writeReminderTemplateTestAudit({
      access,
      templateType,
      recipientEmail: email.email,
      status: 'failed',
      errorCode,
    });
    await writeReminderSystemLog({
      access,
      category: 'email',
      action: 'failed',
      status: 'failed',
      targetType: 'reminder_template_test',
      targetId: templateType,
      targetLabel: templateType,
      targetAudience: email.email,
      details: 'Reminder template test email failed.',
      source: 'sendReminderTemplateTestEmail',
      metadata: {
        templateType,
        recipientEmail: email.email,
        errorCode,
      },
    }, { safe: true });
    logger.warn('Reminder template test email failed.', { templateType, recipientEmail: email.email, code: errorCode, message: error?.message || '' });
    throw new HttpsError('internal', 'The reminder template test email could not be sent.');
  }
});

const unlockAvenueReportingWindow = onCall(CALLABLE_OPTIONS, async (request) => {
  const access = await requireAdminPanelReminderAccess(request, 'unlock avenue reporting windows');
  const reminderId = safeDocumentId(request.data?.reportingWindowId || request.data?.reminderId);
  if (!reminderId) throw new HttpsError('invalid-argument', 'Choose a valid reporting window.');
  const unlockReason = cleanText(request.data?.unlockReason || 'Administrative override', 500) || 'Administrative override';
  const ref = db.collection(REMINDERS_COLLECTION).doc(reminderId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Reporting window not found.');
  const reminder = normalizeReportingWindowConfig(snap.id, snap.data() || {});
  if (!reminder) throw new HttpsError('failed-precondition', 'This record is not an avenue reporting window.');
  const now = admin.firestore.Timestamp.now();
  const lockId = reminder.lockId || avenueReportingLockId(reminder.id);
  const lockRef = db.collection('locks').doc(lockId);
  const batch = db.batch();
  batch.set(lockRef, {
    locked: false,
    status: 'unlocked',
    unlockedAt: now,
    unlockedBy: access.uid,
    unlockedByName: cleanText(access.displayName, 180) || 'Unknown user',
    unlockReason,
    updatedAt: now,
  }, { merge: true });
  batch.set(ref, {
    status: 'unlocked',
    lockId,
    unlockedAt: now,
    unlockedBy: access.uid,
    unlockedByName: cleanText(access.displayName, 180) || 'Unknown user',
    unlockReason,
    lockReason: '',
    updatedAt: now,
  }, { merge: true });
  await batch.commit();
  await writeReminderSystemLog({
    access,
    category: 'lock',
    action: 'unlocked',
    status: 'inactive',
    targetType: 'avenue_reporting_window',
    targetId: reminder.id,
    targetLabel: reminder.targetName || reminder.eventName || reminder.avenue,
    targetAudience: reportingWindowAudienceLabel(reminder),
    details: unlockReason,
    source: 'unlockAvenueReportingWindow',
    relatedDocPath: `locks/${lockId}`,
    metadata: {
      avenue: reminder.avenue,
      avenues: reportingWindowAvenuesForReminder(reminder),
      avenuesLabel: reportingWindowAudienceLabel(reminder),
      reportingWindowId: reminder.id,
      unlockReason,
    },
  });
  return { ok: true, reportingWindowId: reminder.id, lockId, status: 'unlocked' };
});

const sendScheduledReminderEmails = onSchedule({
  region: 'us-central1',
  schedule: 'every day 00:00',
  timeZone: 'Asia/Kolkata',
  timeoutSeconds: 300,
  memory: '512MiB',
}, async () => {
  await runReminderSweep({ trigger: 'scheduled' });
});

const runReminderEmailSweep = onCall(CALLABLE_OPTIONS, async (request) => {
  const access = await requireAdminPanelReminderAccess(request, 'run reminder emails');
  return runReminderSweep({ trigger: 'manual', actor: access });
});

module.exports = {
  createReportingWindowReminder,
  getBodReportingQueue,
  getReportingWindowPrefill,
  upsertEventReminderConfig,
  stopEventReminderConfig,
  markReportingWindowSubmitted,
  stopReportingWindowReminders,
  updateReportingWindowAdminNote,
  sendScheduledReminderEmails,
  runReminderEmailSweep,
  sendReminderTemplateTestEmail,
  unlockAvenueReportingWindow,
  runReminderSweep,
  linkReportingWindowToTarget,
  completeLinkedWorkflowRemindersForTarget,
  resolveReminderRecipients,
  resolveAvenueReportingRecipients,
  processReminderDoc,
  processAvenueReportingWindowDoc,
  hasAvenueReportSubmission,
  hasAttendanceSubmission,
  findReportingWindowBodEventMatch,
  buildBodReportingQueueResponsibilities,
  compareBodReportingQueueItems,
  reportingWindowQueueCoverage,
  shapeBodReportingQueueItem,
  shouldIncludeBodReportingQueueItem,
  bodToolsPrefillUrl,
};
