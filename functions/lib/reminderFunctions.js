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
  REPORTING_WINDOW_RECORD_TYPE,
  AVENUE_REPORTING_LOCK_REASON,
  cleanLower,
  cleanText,
  safeDocumentId,
  avenueRecipientPositionKeys,
  normalizeReminderConfig,
  normalizeReportingWindowConfig,
  normalizeReminderRecipientRole,
  reminderSkipReason,
  reportingWindowRuntimeState,
  targetCollectionForReminder,
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
  normalizeMomAccess,
  normalizeMomEmailAddress,
  normalizePositionKeys,
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
const ADMIN_PANEL_POSITION_KEYS = new Set(['cwd', 'co-cwd', 'saa', 'co-saa', 'sergeant', 'sergeant-at-arms']);

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
  const snap = await db.collection('bodPositionAssignments').where('uid', '==', uid).get().catch(() => null);
  if (!snap) return [];
  return snap.docs
    .map(doc => doc.data() || {})
    .filter(assignment => assignment.active === true)
    .map(assignment => positionHelpers.normalizePositionKey(assignment.positionKey))
    .filter(Boolean);
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
  return normalizeMomAccess({ uid, user: mergedUser, role: mergedRole, token });
}

function hasAdminPanelAuthority(access = {}) {
  if (access.isApproved !== true) return false;
  if (['admin', 'president'].includes(access.storedRole)) return true;
  if (access.hasPresidentAuthority === true) return true;
  return normalizePositionKeys(access.positionKeys).some(key => ADMIN_PANEL_POSITION_KEYS.has(key));
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

async function resolveAvenueReportingRecipients(reminder) {
  if (reminder.recipientRole === 'secretary') return resolveReminderRecipients('secretary');
  const { candidateUids, positionKeysByUid } = await candidateUidsForAvenue(reminder.avenue);
  if (!candidateUids.length) return [];
  const allowed = new Set(avenueRecipientPositionKeys(reminder.avenue));
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
  return { ref, snapshot, data: snapshot.data() || {} };
}

function reminderHistoryPayload({ reminder, recipient = {}, status, errorCode = '', attemptNumber, maxReminders, sentAt }) {
  return {
    reminderId: reminder.id,
    reminderType: reminder.reminderType,
    targetType: reminder.targetType,
    targetId: reminder.targetId,
    targetName: reminder.targetName,
    targetDate: reminder.targetDate,
    avenue: reminder.avenue || '',
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

async function hasAvenueReportSubmission() {
  return {
    submitted: false,
    detection: 'deferred_no_persisted_report_submission_source',
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
    return { outcome: 'completed', reason: 'mom_uploaded' };
  }

  // Attendance completion is intentionally deferred until a reliable persisted completion flag exists.
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
  }

  return { created: !alreadyActive, lockId };
}

async function processAvenueReportingWindowDoc(doc) {
  const reminder = normalizeReportingWindowConfig(doc.id, doc.data() || {});
  if (!reminder) return { outcome: 'skipped', reason: 'invalid_reporting_window' };

  const now = admin.firestore.Timestamp.now();
  const nowMillis = now.toMillis();
  const runtimeState = reportingWindowRuntimeState(reminder, nowMillis);
  if (runtimeState === 'completed' || runtimeState === 'locked' || runtimeState === 'unlocked' || runtimeState === 'no_recipient') {
    return { outcome: 'skipped', reason: runtimeState };
  }

  const submitted = await hasAvenueReportSubmission(reminder);
  if (submitted.submitted) {
    await setReportingWindowStatus(doc, 'completed', now, {
      completedAt: now,
      completionReason: 'report_submitted',
      failureReason: '',
    });
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

  const recipients = await resolveAvenueReportingRecipients(reminder);
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

  const next = nextAvenueReportingSentState(reminder);
  await doc.ref.set({
    status: next.status,
    remindersSent: next.remindersSent,
    lastReminderSentAt: now,
    failureReason: '',
    completionReason: '',
    updatedAt: now,
  }, { merge: true });

  return { outcome: 'sent', sent: summary.sent, failed: summary.failed };
}

async function processReminderDoc(doc) {
  const data = doc.data() || {};
  if (cleanText(data.recordType || data.type, 80) === REPORTING_WINDOW_RECORD_TYPE) {
    return processAvenueReportingWindowDoc(doc);
  }
  return processEventReminderDoc(doc);
}

async function runReminderSweep({ trigger = 'manual' } = {}) {
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
    attendanceCompletionDetection: 'deferred',
    avenueReportSubmissionDetection: 'deferred_no_persisted_report_submission_source',
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
  await requireAdminPanelReminderAccess(request, 'run reminder emails');
  return runReminderSweep({ trigger: 'manual' });
});

module.exports = {
  sendScheduledReminderEmails,
  runReminderEmailSweep,
  sendReminderTemplateTestEmail,
  unlockAvenueReportingWindow,
  runReminderSweep,
  resolveReminderRecipients,
  resolveAvenueReportingRecipients,
  processReminderDoc,
  processAvenueReportingWindowDoc,
  hasAvenueReportSubmission,
};