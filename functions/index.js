const functions = require('firebase-functions');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const positionHelpers = require('./lib/positions');
const { createPositionAssignmentService } = require('./lib/position-assignments');
const {
  VISIT_UPLOAD_TYPE,
  createVisitSubmissionService,
} = require('./lib/visit-submissions');
const {
  createFirestoreFolderLockManager,
  createVisitHttpUploadHandler,
} = require('./lib/visit-drive');
const {
  PROSPECT_CRITERIA_V2,
  calculateProspectMembershipProgress,
} = require('./lib/prospect-membership-criteria');
const resolutionModel = require('./lib/resolutions');
const { createResolutionDriveService } = require('./lib/resolution-drive');
const { createResolutionUploadService } = require('./lib/resolution-upload');
const bodAvenueReport = require('./lib/bod-avenue-report');
const { stripRotaractorPrefix } = require('./lib/member-name');

admin.initializeApp();
const db = admin.firestore();
const rolePositionAssignments = createPositionAssignmentService({
  db,
  admin,
  HttpsError,
  positionHelpers,
});
const visitSubmissions = createVisitSubmissionService({
  db,
  admin,
  positionHelpers,
});
const VISIT_DRIVE_CLIENT_ID = defineSecret('VISIT_DRIVE_CLIENT_ID');
const VISIT_DRIVE_CLIENT_SECRET = defineSecret('VISIT_DRIVE_CLIENT_SECRET');
const VISIT_DRIVE_REFRESH_TOKEN = defineSecret('VISIT_DRIVE_REFRESH_TOKEN');
const visitFolderLockManager = createFirestoreFolderLockManager({
  db,
  admin,
});
const uploadVisitSubmissionFileHandler = createVisitHttpUploadHandler({
  visitService: visitSubmissions,
  folderLockManager: visitFolderLockManager,
  secrets: {
    VISIT_DRIVE_CLIENT_ID,
    VISIT_DRIVE_CLIENT_SECRET,
    VISIT_DRIVE_REFRESH_TOKEN,
  },
  logger: console,
});
const ADMIN_INVITE_CODE = process.env.ADMIN_INVITE_CODE;
const EMAIL_USER = process.env.EMAIL_USER || process.env.SMTP_USER || '';
const EMAIL_PASS = process.env.EMAIL_PASS || process.env.SMTP_PASS || '';
const DEFAULT_SIGNUP_NOTIFY_TO = 'rcph3131@gmail.com';
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
    /^http:\/\/localhost:\d+$/,
    /^http:\/\/127\.0\.0\.1:\d+$/,
  ],
};
const RESOLUTION_DRIVE_SECRETS = [VISIT_DRIVE_CLIENT_ID, VISIT_DRIVE_CLIENT_SECRET, VISIT_DRIVE_REFRESH_TOKEN];
const RESOLUTION_PDF_CALLABLE_OPTIONS = { ...CALLABLE_OPTIONS, timeoutSeconds: 300, memory: '1GiB', secrets: RESOLUTION_DRIVE_SECRETS };
const resolutionDrive = createResolutionDriveService({
  env: process.env,
  secrets: { VISIT_DRIVE_CLIENT_ID, VISIT_DRIVE_CLIENT_SECRET, VISIT_DRIVE_REFRESH_TOKEN },
});
const resolutionUploads = createResolutionUploadService({
  db,
  admin,
  drive: resolutionDrive,
  getManagerContext: getResolutionManagerContext,
  logger: console,
  uploadEndpoint: 'https://us-central1-rcph-admin.cloudfunctions.net/uploadResolutionSourcePdf',
});

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

function genOtp() {
  return (Math.floor(100000 + Math.random() * 900000)).toString();
}

exports.requestPasswordOtp = functions.https.onCall(async (data) => {
  const email = (data?.email || '').trim().toLowerCase();
  if (!email) throw new functions.https.HttpsError('invalid-argument', 'Email required.');

  // ensure user exists
  let userRecord;
  try {
    userRecord = await admin.auth().getUserByEmail(email);
  } catch {
    return { ok: true }; // avoid leaking info
  }

  const otp = genOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 10 * 60 * 1000);

  await db.collection('passwordResets').doc(email).set({
    otpHash, expiresAt, attempts: 0, lastSentAt: admin.firestore.Timestamp.now()
  }, { merge: true });

  await transporter.sendMail({
    from: '"RCPH Support" <no-reply@rcph3131.org>',
    to: email,
    subject: 'Your password reset code',
    html: `<p>Your OTP is <b>${otp}</b>. It expires in 10 minutes.</p>`,
  });

  return { ok: true };
});

exports.resetPasswordWithOtp = functions.https.onCall(async (data) => {
  const email = (data?.email || '').trim().toLowerCase();
  const otp = (data?.otp || '').trim();
  const newPassword = (data?.newPassword || '').trim();
  if (!email || !otp || !newPassword)
    throw new functions.https.HttpsError('invalid-argument', 'Missing fields.');

  const ref = db.collection('passwordResets').doc(email);
  const doc = await ref.get();
  if (!doc.exists) throw new functions.https.HttpsError('failed-precondition', 'No code requested.');

  const { otpHash, expiresAt, attempts = 0 } = doc.data();
  if (attempts >= 5) throw new functions.https.HttpsError('resource-exhausted', 'Too many attempts.');
  if (expiresAt.toMillis() < Date.now())
    throw new functions.https.HttpsError('deadline-exceeded', 'Code expired.');

  const match = await bcrypt.compare(otp, otpHash);
  await ref.set({ attempts: attempts + 1 }, { merge: true });
  if (!match) throw new functions.https.HttpsError('permission-denied', 'Invalid code.');

  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().updateUser(user.uid, { password: newPassword });
  await ref.delete();

  return { ok: true };
});

const ACTIVE_ROLES = new Set(['prospect', 'gbm', 'bod', 'admin', 'president']);
const REQUESTABLE_ROLES = new Set(['prospect', 'gbm', 'bod', 'admin']);
const APPROVABLE_ROLES = new Set(['gbm', 'bod', 'admin', 'president']);
const RCPH_CLUB_NAME = 'Rotaract Club of Pune Heritage';
const DRIVE_UPLOAD_SHARED_SECRET = defineSecret('DRIVE_UPLOAD_SHARED_SECRET');
const DRIVE_UPLOAD_TICKET_TTL_MS = 5 * 60 * 1000;
const DRIVE_UPLOAD_TICKET_DELETE_GRACE_MS = 24 * 60 * 60 * 1000;
const DRIVE_UPLOAD_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const BOD_UPLOAD_MAX_BYTES = 15 * 1024 * 1024;
const TREASURY_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const DRIVE_UPLOAD_ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const DRIVE_UPLOAD_TYPES = new Set(['bod', 'treasury', VISIT_UPLOAD_TYPE]);
const PROSPECT_CRITERIA = PROSPECT_CRITERIA_V2;
const PROSPECT_GENDERS = new Set(['woman', 'man', 'non-binary', 'self-describe', 'prefer-not-to-say']);
const PROSPECT_AVENUES = new Set(['ISD', 'CMD', 'CSD', 'PDD', 'RRRO', 'PRO', 'DEI']);
const CLUB_SETTINGS_COLLECTION = 'clubSettings';
const PUBLIC_DASHBOARD_SETTINGS_DOC = 'publicDashboard';
const CLUB_RANKING_DEFAULT = Object.freeze({
  enabled: false,
  value: '',
  subtitle: '',
});
const ANNOUNCEMENTS_COLLECTION = 'announcements';
const ANNOUNCEMENT_DELIVERIES_COLLECTION = 'announcementDeliveries';
const ANNOUNCEMENT_TARGET_ROLES = new Set(['all', 'prospect', 'gbm', 'bod', 'admin', 'president']);
const ANNOUNCEMENT_ACCOUNT_ROLES = new Set(['prospect', 'gbm', 'bod', 'admin', 'president']);
const ANNOUNCEMENT_PRIORITIES = new Set(['normal', 'important', 'urgent']);
const ANNOUNCEMENT_EMAIL_SUMMARY_DEFAULT = Object.freeze({
  attempted: 0,
  sent: 0,
  failed: 0,
});
const ANNOUNCEMENT_MAX_EXPLICIT_USERS = 200;
const ANNOUNCEMENT_MAX_TARGET_ROLES = 6;
const ANNOUNCEMENT_MAX_ID_LENGTH = 128;
const ANNOUNCEMENT_DELIVERY_BATCH_SIZE = 450;
const ANNOUNCEMENT_AUTH_LOOKUP_CHUNK_SIZE = 100;
const ANNOUNCEMENT_EXPIRY_MAX_MS = 365 * 24 * 60 * 60 * 1000;
const ANNOUNCEMENT_EMAIL_MAX_RECIPIENTS = 500;
const RESOLUTIONS_COLLECTION = 'resolutions';
const RESOLUTION_NUMBER_INDEX_COLLECTION = 'resolutionNumberIndex';

function normalizeRole(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeText(value, max = 300) {
  return String(value || '').trim().slice(0, max);
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function hasPlainTextControlChars(value) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

function hasMarkupLikeCharacters(value) {
  return /[<>]/.test(value);
}

function normalizeClubRanking(raw = {}, options = {}) {
  const strict = options.strict === true;
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const enabled = source.enabled;
  const value = source.value;
  const subtitle = source.subtitle;

  if (strict && typeof enabled !== 'boolean') {
    throw new HttpsError('invalid-argument', 'enabled must be a boolean.');
  }
  if (strict && (Array.isArray(value) || (value && typeof value === 'object'))) {
    throw new HttpsError('invalid-argument', 'value must be plain text.');
  }
  if (strict && (Array.isArray(subtitle) || (subtitle && typeof subtitle === 'object'))) {
    throw new HttpsError('invalid-argument', 'subtitle must be plain text.');
  }
  if (strict && value !== undefined && value !== null && typeof value !== 'string') {
    throw new HttpsError('invalid-argument', 'value must be a string.');
  }
  if (strict && subtitle !== undefined && subtitle !== null && typeof subtitle !== 'string') {
    throw new HttpsError('invalid-argument', 'subtitle must be a string.');
  }

  const normalizedEnabled = typeof enabled === 'boolean' ? enabled : CLUB_RANKING_DEFAULT.enabled;
  let normalizedValue = typeof value === 'string' ? value.trim() : '';
  let normalizedSubtitle = typeof subtitle === 'string' ? subtitle.trim() : '';

  if (strict && (hasPlainTextControlChars(normalizedValue) || hasMarkupLikeCharacters(normalizedValue))) {
    throw new HttpsError('invalid-argument', 'value must be plain text.');
  }
  if (strict && (hasPlainTextControlChars(normalizedSubtitle) || hasMarkupLikeCharacters(normalizedSubtitle))) {
    throw new HttpsError('invalid-argument', 'subtitle must be plain text.');
  }
  if (strict && normalizedValue.length > 80) {
    throw new HttpsError('invalid-argument', 'value must be 80 characters or fewer.');
  }
  if (strict && normalizedSubtitle.length > 120) {
    throw new HttpsError('invalid-argument', 'subtitle must be 120 characters or fewer.');
  }
  if (strict && normalizedEnabled && !normalizedValue) {
    throw new HttpsError('invalid-argument', 'value is required when club ranking is enabled.');
  }

  if (!strict) {
    normalizedValue = normalizedValue.replace(/[\u0000-\u001f\u007f<>]/g, '').slice(0, 80);
    normalizedSubtitle = normalizedSubtitle.replace(/[\u0000-\u001f\u007f<>]/g, '').slice(0, 120);
  }

  return {
    enabled: normalizedEnabled,
    value: normalizedValue,
    subtitle: normalizedSubtitle,
  };
}

function hasUnsafeAnnouncementBodyControlChars(value) {
  return /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
}

function normalizeAnnouncementTextField(value, {
  field,
  max,
  required = false,
  allowLineBreaks = false,
} = {}) {
  if (Array.isArray(value) || (value && typeof value === 'object')) {
    throw new HttpsError('invalid-argument', `${field} must be plain text.`);
  }
  if (value === undefined || value === null) {
    if (required) throw new HttpsError('invalid-argument', `${field} is required.`);
    return '';
  }
  if (typeof value !== 'string') {
    throw new HttpsError('invalid-argument', `${field} must be a string.`);
  }

  const normalized = value.trim();
  if (required && !normalized) {
    throw new HttpsError('invalid-argument', `${field} is required.`);
  }
  if (normalized.length > max) {
    throw new HttpsError('invalid-argument', `${field} must be ${max} characters or fewer.`);
  }
  const hasUnsafeControls = allowLineBreaks
    ? hasUnsafeAnnouncementBodyControlChars(normalized)
    : hasPlainTextControlChars(normalized);
  if (hasUnsafeControls || hasMarkupLikeCharacters(normalized)) {
    throw new HttpsError('invalid-argument', `${field} must be plain text.`);
  }
  return normalized;
}

function normalizeAnnouncementPriority(value) {
  if (value === undefined || value === null || value === '') return 'normal';
  if (typeof value !== 'string' || Array.isArray(value)) {
    throw new HttpsError('invalid-argument', 'priority must be a string.');
  }
  const priority = value.trim().toLowerCase();
  if (!priority) return 'normal';
  if (!ANNOUNCEMENT_PRIORITIES.has(priority)) {
    throw new HttpsError('invalid-argument', 'priority must be normal, important, or urgent.');
  }
  return priority;
}

function normalizeAnnouncementAction(raw = {}) {
  const actionText = normalizeAnnouncementTextField(raw.actionText, {
    field: 'actionText',
    max: 80,
    required: false,
  });
  const actionUrl = normalizeAnnouncementTextField(raw.actionUrl, {
    field: 'actionUrl',
    max: 1000,
    required: false,
  });

  if ((actionText && !actionUrl) || (!actionText && actionUrl)) {
    throw new HttpsError('invalid-argument', 'actionText and actionUrl must be supplied together.');
  }
  if (!actionText && !actionUrl) {
    return { actionText: '', actionUrl: '' };
  }

  let parsed;
  try {
    parsed = new URL(actionUrl);
  } catch {
    throw new HttpsError('invalid-argument', 'actionUrl must be a valid absolute https URL.');
  }
  if (parsed.protocol !== 'https:' || !parsed.hostname) {
    throw new HttpsError('invalid-argument', 'actionUrl must be a valid absolute https URL.');
  }

  return { actionText, actionUrl: parsed.toString() };
}

function normalizeAnnouncementTargets(raw = {}) {
  const rawRoles = raw.targetRoles === undefined || raw.targetRoles === null ? [] : raw.targetRoles;
  const rawUserIds = raw.targetUserIds === undefined || raw.targetUserIds === null ? [] : raw.targetUserIds;

  if (!Array.isArray(rawRoles)) {
    throw new HttpsError('invalid-argument', 'targetRoles must be an array.');
  }
  if (!Array.isArray(rawUserIds)) {
    throw new HttpsError('invalid-argument', 'targetUserIds must be an array.');
  }
  if (rawRoles.length > ANNOUNCEMENT_MAX_TARGET_ROLES) {
    throw new HttpsError('invalid-argument', 'targetRoles contains too many values.');
  }
  if (rawUserIds.length > ANNOUNCEMENT_MAX_EXPLICIT_USERS) {
    throw new HttpsError('invalid-argument', 'targetUserIds contains too many values.');
  }

  const targetRoles = [];
  const roleSeen = new Set();
  for (const item of rawRoles) {
    if (typeof item !== 'string') {
      throw new HttpsError('invalid-argument', 'targetRoles must contain strings only.');
    }
    const role = item.trim().toLowerCase();
    if (!role || !ANNOUNCEMENT_TARGET_ROLES.has(role)) {
      throw new HttpsError('invalid-argument', 'targetRoles contains an unsupported role.');
    }
    if (!roleSeen.has(role)) {
      roleSeen.add(role);
      targetRoles.push(role);
    }
  }
  const normalizedRoles = roleSeen.has('all') ? ['all'] : targetRoles;

  const targetUserIds = [];
  const uidSeen = new Set();
  for (const item of rawUserIds) {
    const uid = validateAnnouncementDocId(item, 'targetUserIds');
    if (uid.includes('@')) {
      throw new HttpsError('invalid-argument', 'targetUserIds must contain UIDs, not email addresses.');
    }
    if (!uidSeen.has(uid)) {
      uidSeen.add(uid);
      targetUserIds.push(uid);
    }
  }

  if (!normalizedRoles.length && !targetUserIds.length) {
    throw new HttpsError('invalid-argument', 'At least one target role or target user is required.');
  }

  return {
    targetRoles: normalizedRoles,
    targetUserIds,
  };
}

function normalizeAnnouncementExpiry(value, nowMillis = Date.now()) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new HttpsError('invalid-argument', 'expiresAt must be an ISO date-time string or null.');
  }
  const expiresMillis = Date.parse(value);
  if (!Number.isFinite(expiresMillis)) {
    throw new HttpsError('invalid-argument', 'expiresAt must be a valid ISO date-time string.');
  }
  if (expiresMillis <= nowMillis) {
    throw new HttpsError('invalid-argument', 'expiresAt must be in the future.');
  }
  if (expiresMillis > nowMillis + ANNOUNCEMENT_EXPIRY_MAX_MS) {
    throw new HttpsError('invalid-argument', 'expiresAt must be no more than one year in the future.');
  }
  return admin.firestore.Timestamp.fromMillis(expiresMillis);
}

function normalizeAnnouncementSendEmail(value) {
  if (value === undefined || value === null) return false;
  if (typeof value !== 'boolean') {
    throw new HttpsError('invalid-argument', 'sendEmail must be a boolean when supplied.');
  }
  return value;
}

function normalizeAnnouncementPayload(raw = {}) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  if (source !== raw) {
    throw new HttpsError('invalid-argument', 'Announcement payload must be an object.');
  }
  const { targetRoles, targetUserIds } = normalizeAnnouncementTargets(source);
  const action = normalizeAnnouncementAction(source);
  return {
    title: normalizeAnnouncementTextField(source.title, {
      field: 'title',
      max: 160,
      required: true,
    }),
    body: normalizeAnnouncementTextField(source.body, {
      field: 'body',
      max: 5000,
      required: true,
      allowLineBreaks: true,
    }),
    priority: normalizeAnnouncementPriority(source.priority),
    actionText: action.actionText,
    actionUrl: action.actionUrl,
    targetRoles,
    targetUserIds,
    expiresAt: normalizeAnnouncementExpiry(source.expiresAt),
    emailRequested: normalizeAnnouncementSendEmail(source.sendEmail),
  };
}

function validateAnnouncementDocId(value, field = 'announcementId') {
  if (typeof value !== 'string') {
    throw new HttpsError('invalid-argument', `${field} must be a string.`);
  }
  const id = value.trim();
  if (!id) throw new HttpsError('invalid-argument', `${field} is required.`);
  if (id.length > ANNOUNCEMENT_MAX_ID_LENGTH) {
    throw new HttpsError('invalid-argument', `${field} is too long.`);
  }
  if (id.includes('/') || hasPlainTextControlChars(id)) {
    throw new HttpsError('invalid-argument', `${field} is invalid.`);
  }
  return id;
}

function announcementDeliveryId(announcementId, uid) {
  const safeAnnouncementId = validateAnnouncementDocId(announcementId, 'announcementId');
  const safeUid = validateAnnouncementDocId(uid, 'uid');
  return `${safeAnnouncementId}_${safeUid}`;
}

function timestampToMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function timestampToIso(value) {
  const millis = timestampToMillis(value);
  return millis ? new Date(millis).toISOString() : null;
}

function normalizeNonNegativeInteger(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.floor(number));
}

function isAnnouncementExpired(expiresAt, nowMillis = Date.now()) {
  const expiresMillis = timestampToMillis(expiresAt);
  return expiresMillis !== null && expiresMillis <= nowMillis;
}

function normalizePublishedAnnouncementForDashboard(id, announcement, delivery, nowMillis = Date.now()) {
  if (!announcement || announcement.status !== 'published') return null;
  if (isAnnouncementExpired(announcement.expiresAt || delivery.expiresAt, nowMillis)) return null;

  const title = typeof announcement.title === 'string'
    ? announcement.title.trim().replace(/[\u0000-\u001f\u007f<>]/g, '').slice(0, 160)
    : '';
  const body = typeof announcement.body === 'string'
    ? announcement.body.trim().replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<>]/g, '').slice(0, 5000)
    : '';
  if (!title || !body) return null;

  const priority = ANNOUNCEMENT_PRIORITIES.has(String(announcement.priority || '').toLowerCase())
    ? String(announcement.priority).toLowerCase()
    : 'normal';
  const actionText = typeof announcement.actionText === 'string'
    ? announcement.actionText.trim().replace(/[\u0000-\u001f\u007f<>]/g, '').slice(0, 80)
    : '';
  const actionUrl = typeof announcement.actionUrl === 'string'
    ? announcement.actionUrl.trim()
    : '';
  let safeActionUrl = '';
  if (actionText && actionUrl) {
    try {
      const parsed = new URL(actionUrl);
      if (parsed.protocol === 'https:' && parsed.hostname) safeActionUrl = parsed.toString();
    } catch {
      safeActionUrl = '';
    }
  }

  return {
    id,
    title,
    body,
    priority,
    actionText: safeActionUrl ? actionText : '',
    actionUrl: safeActionUrl,
    publishedAt: timestampToIso(announcement.publishedAt || delivery.publishedAt),
    expiresAt: timestampToIso(announcement.expiresAt || delivery.expiresAt),
    read: delivery.dashboardStatus === 'read'
      || delivery.dashboardStatus === 'dismissed'
      || !!delivery.readAt,
  };
}

function normalizeAnnouncementHistoryRequest(raw = {}) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  if (source !== raw) {
    throw new HttpsError('invalid-argument', 'History request must be an object.');
  }
  const allowedFields = new Set(['limit', 'cursor']);
  Object.keys(source).forEach(key => {
    if (!allowedFields.has(key)) {
      throw new HttpsError('invalid-argument', 'Unsupported history request field.');
    }
  });

  let limit = 20;
  if (source.limit !== undefined && source.limit !== null) {
    if (!Number.isInteger(source.limit)) {
      throw new HttpsError('invalid-argument', 'limit must be an integer.');
    }
    if (source.limit < 1 || source.limit > 50) {
      throw new HttpsError('invalid-argument', 'limit must be between 1 and 50.');
    }
    limit = source.limit;
  }

  let cursor = null;
  if (source.cursor !== undefined && source.cursor !== null && source.cursor !== '') {
    cursor = validateAnnouncementDocId(source.cursor, 'cursor');
  }

  return { limit, cursor };
}

function normalizeAnnouncementHistoryStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  if (['published', 'failed', 'publishing'].includes(status)) return status;
  return 'unknown';
}

function normalizeAnnouncementHistoryBodyPreview(value) {
  if (typeof value !== 'string') return '';
  const normalized = value
    .trim()
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ');
  if (normalized.length <= 240) return normalized;
  return `${normalized.slice(0, 240).trimEnd()}...`;
}

function normalizeAnnouncementHistoryRoles(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const roles = [];
  value.forEach(item => {
    if (typeof item !== 'string') return;
    const role = item.trim().toLowerCase();
    if (!ANNOUNCEMENT_TARGET_ROLES.has(role) || seen.has(role)) return;
    seen.add(role);
    roles.push(role);
  });
  return seen.has('all') ? ['all'] : roles;
}

function normalizeAnnouncementHistoryEmailSummary(raw = {}) {
  const attempted = normalizeNonNegativeInteger(raw?.attempted, 0);
  const sent = Math.min(normalizeNonNegativeInteger(raw?.sent, 0), attempted);
  const failed = Math.min(normalizeNonNegativeInteger(raw?.failed, 0), Math.max(0, attempted - sent));
  return { attempted, sent, failed };
}

function normalizeAnnouncementHistoryItem(id, data, dashboardSummary = {}) {
  let safeId;
  try {
    safeId = validateAnnouncementDocId(id, 'announcementId');
  } catch {
    return null;
  }

  const title = typeof data?.title === 'string'
    ? data.title.trim().replace(/[\u0000-\u001f\u007f<>]/g, '').slice(0, 160)
    : '';
  if (!title) return null;

  const priorityValue = String(data?.priority || '').trim().toLowerCase();
  const priority = ANNOUNCEMENT_PRIORITIES.has(priorityValue) ? priorityValue : 'normal';
  const status = normalizeAnnouncementHistoryStatus(data?.status);
  const targetRoles = normalizeAnnouncementHistoryRoles(data?.targetRoles);
  const explicitRecipientCount = Array.isArray(data?.targetUserIds)
    ? Math.min(data.targetUserIds.length, ANNOUNCEMENT_MAX_EXPLICIT_USERS)
    : 0;
  const recipientCount = normalizeNonNegativeInteger(data?.recipientCount, 0);
  const unread = normalizeNonNegativeInteger(dashboardSummary.unread, 0);
  const read = normalizeNonNegativeInteger(dashboardSummary.read, 0);
  const dismissed = normalizeNonNegativeInteger(dashboardSummary.dismissed, 0);
  const dashboardTotal = unread + read + dismissed;
  const scale = recipientCount > 0 && dashboardTotal > recipientCount ? recipientCount / dashboardTotal : 1;

  return {
    id: safeId,
    title,
    bodyPreview: normalizeAnnouncementHistoryBodyPreview(data?.body),
    priority,
    status,
    targetRoles,
    explicitRecipientCount,
    recipientCount,
    dashboardSummary: {
      unread: Math.floor(unread * scale),
      read: Math.floor(read * scale),
      dismissed: Math.floor(dismissed * scale),
    },
    emailRequested: data?.emailRequested === true,
    emailSummary: normalizeAnnouncementHistoryEmailSummary(data?.emailSummary || {}),
    publishedAt: timestampToIso(data?.publishedAt),
    expiresAt: timestampToIso(data?.expiresAt),
    createdAt: timestampToIso(data?.createdAt),
  };
}

async function getAnnouncementDashboardSummaries(announcementIds) {
  const summaries = new Map();
  announcementIds.forEach(id => {
    summaries.set(id, { unread: 0, read: 0, dismissed: 0 });
  });

  for (const chunk of chunkArray(announcementIds, 10)) {
    if (!chunk.length) continue;
    const snap = await db
      .collection(ANNOUNCEMENT_DELIVERIES_COLLECTION)
      .where('announcementId', 'in', chunk)
      .get();
    snap.forEach(doc => {
      const data = doc.data() || {};
      const announcementId = data.announcementId;
      if (!summaries.has(announcementId)) return;
      const status = String(data.dashboardStatus || 'unread').toLowerCase();
      if (!['unread', 'read', 'dismissed'].includes(status)) return;
      summaries.get(announcementId)[status] += 1;
    });
  }

  return summaries;
}

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function getFirestoreDocsById(collectionName, ids) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  const result = new Map();
  for (const chunk of chunkArray(uniqueIds, ANNOUNCEMENT_DELIVERY_BATCH_SIZE)) {
    const refs = chunk.map(id => db.collection(collectionName).doc(id));
    const snaps = await db.getAll(...refs);
    snaps.forEach(snap => result.set(snap.id, snap));
  }
  return result;
}

async function getAuthUsersById(ids) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  const result = new Map();
  for (const chunk of chunkArray(uniqueIds, ANNOUNCEMENT_AUTH_LOOKUP_CHUNK_SIZE)) {
    const response = await admin.auth().getUsers(chunk.map(uid => ({ uid })));
    response.users.forEach(user => result.set(user.uid, user));
  }
  return result;
}

function roleMatchesAnnouncementTarget(role, targetRoles) {
  return targetRoles.includes('all') || targetRoles.includes(role);
}

function buildEligibleAnnouncementRecipient(uid, { authRecord, userSnap, roleSnap }) {
  if (!authRecord || authRecord.disabled === true || !userSnap?.exists || !roleSnap?.exists) return null;
  const userData = userSnap.data() || {};
  const roleData = roleSnap.data() || {};
  const role = normalizeRole(roleData.role);
  const roleStatus = String(roleData.status || 'approved').toLowerCase();
  if (!isApprovedActiveUserRecord(userData)) return null;
  if (!ANNOUNCEMENT_ACCOUNT_ROLES.has(role) || roleStatus !== 'approved') return null;

  return {
    uid,
    name: stripRotaractorPrefix(normalizeText(userData.name || authRecord.displayName || authRecord.email || uid, 160)),
    email: normalizeEmail(userData.email || authRecord.email || ''),
    role,
  };
}

async function getEligibleAnnouncementRecipientsForUids(candidateIds) {
  const uniqueIds = Array.from(new Set(candidateIds.filter(Boolean)));
  if (!uniqueIds.length) return [];

  const [userSnapsByUid, roleSnapsByUid, authUsersByUid] = await Promise.all([
    getFirestoreDocsById('users', uniqueIds),
    getFirestoreDocsById('roles', uniqueIds),
    getAuthUsersById(uniqueIds),
  ]);

  const recipients = [];
  for (const uid of uniqueIds) {
    const recipient = buildEligibleAnnouncementRecipient(uid, {
      authRecord: authUsersByUid.get(uid),
      userSnap: userSnapsByUid.get(uid),
      roleSnap: roleSnapsByUid.get(uid),
    });
    if (recipient) recipients.push(recipient);
  }
  return recipients;
}

async function getAllEligibleAnnouncementRecipients() {
  const rolesSnap = await db.collection('roles').get();
  const candidateUids = [];
  rolesSnap.forEach(doc => {
    const data = doc.data() || {};
    const role = normalizeRole(data.role);
    const status = String(data.status || 'approved').toLowerCase();
    if (!ANNOUNCEMENT_ACCOUNT_ROLES.has(role) || status !== 'approved') return;
    candidateUids.push(doc.id);
  });
  return getEligibleAnnouncementRecipientsForUids(candidateUids);
}

function sortAnnouncementRecipientsForDirectory(recipients) {
  return recipients
    .slice()
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))
      || String(a.email || '').localeCompare(String(b.email || ''))
      || String(a.uid || '').localeCompare(String(b.uid || '')));
}

async function resolveAnnouncementRecipients({ targetRoles, targetUserIds }) {
  const explicitUidSet = new Set(targetUserIds);
  const candidateUids = new Set(targetUserIds);
  const hasRoleTarget = targetRoles.length > 0;

  if (hasRoleTarget) {
    const rolesSnap = await db.collection('roles').get();
    rolesSnap.forEach(doc => {
      const data = doc.data() || {};
      const role = normalizeRole(data.role);
      const status = String(data.status || 'approved').toLowerCase();
      if (!ANNOUNCEMENT_ACCOUNT_ROLES.has(role) || status !== 'approved') return;
      if (!roleMatchesAnnouncementTarget(role, targetRoles)) return;
      candidateUids.add(doc.id);
    });
  }

  const recipients = await getEligibleAnnouncementRecipientsForUids(Array.from(candidateUids));
  return recipients
    .filter(recipient => explicitUidSet.has(recipient.uid)
      || roleMatchesAnnouncementTarget(recipient.role, targetRoles))
    .sort((a, b) => a.uid.localeCompare(b.uid));
}

async function writeAnnouncementDeliveries({ announcementId, announcement, recipients, timestamp }) {
  let batch = db.batch();
  let ops = 0;
  const emailStatus = announcement.emailRequested ? 'pending' : 'not_requested';

  async function commitIfNeeded(force = false) {
    if (ops > 0 && (force || ops >= ANNOUNCEMENT_DELIVERY_BATCH_SIZE)) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }

  for (const recipient of recipients) {
    const deliveryRef = db
      .collection(ANNOUNCEMENT_DELIVERIES_COLLECTION)
      .doc(announcementDeliveryId(announcementId, recipient.uid));
    batch.set(deliveryRef, {
      announcementId,
      uid: recipient.uid,
      title: announcement.title,
      priority: announcement.priority,
      publishedAt: timestamp,
      expiresAt: announcement.expiresAt || null,
      dashboardStatus: 'unread',
      readAt: null,
      dismissedAt: null,
      emailStatus,
      emailSentAt: null,
      emailErrorCode: '',
      createdAt: timestamp,
      updatedAt: timestamp,
    }, { merge: false });
    ops += 1;
    await commitIfNeeded();
  }

  await commitIfNeeded(true);
}

async function getDashboardAnnouncementsForUser(uid) {
  try {
    const nowMillis = Date.now();
    const deliveriesSnap = await db
      .collection(ANNOUNCEMENT_DELIVERIES_COLLECTION)
      .where('uid', '==', uid)
      .get();

    const deliveries = [];
    deliveriesSnap.forEach(doc => {
      const data = doc.data() || {};
      if (data.uid !== uid) return;
      if (data.dashboardStatus === 'dismissed') return;
      if (!data.announcementId || typeof data.announcementId !== 'string') return;
      if (isAnnouncementExpired(data.expiresAt, nowMillis)) return;
      deliveries.push({ id: doc.id, ...data });
    });

    if (!deliveries.length) return [];

    const announcementIds = deliveries
      .map(delivery => delivery.announcementId)
      .filter(id => {
        try {
          validateAnnouncementDocId(id, 'announcementId');
          return true;
        } catch {
          return false;
        }
      });
    const announcementSnapsById = await getFirestoreDocsById(ANNOUNCEMENTS_COLLECTION, announcementIds);
    const rendered = [];

    deliveries.forEach(delivery => {
      const snap = announcementSnapsById.get(delivery.announcementId);
      if (!snap?.exists) return;
      const item = normalizePublishedAnnouncementForDashboard(
        snap.id,
        snap.data() || {},
        delivery,
        nowMillis
      );
      if (item) rendered.push(item);
    });

    return rendered
      .sort((a, b) => (timestampToMillis(b.publishedAt) || 0) - (timestampToMillis(a.publishedAt) || 0)
        || String(b.id).localeCompare(String(a.id)))
      .slice(0, 5);
  } catch (err) {
    console.warn('Could not load dashboard announcements', uid, err?.message || String(err));
    return [];
  }
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  return ['true', 'yes', '1'].includes(String(value || '').trim().toLowerCase());
}

function normalizeProspectSignupData(data) {
  const phone = normalizeText(data.phone, 40);
  const gender = normalizeText(data.gender, 40).toLowerCase();
  const genderSelfDescribe = gender === 'self-describe'
    ? normalizeText(data.genderSelfDescribe ?? data.genderSelfDescription, 160)
    : '';
  const hobbies = normalizeText(data.hobbies, 600);
  const previousRotaract = normalizeBoolean(data.previousRotaract);
  const previousRotaractDetails = previousRotaract
    ? normalizeText(data.previousRotaractDetails, 1200)
    : 'N/A';
  const joinReason = normalizeText(data.joinReason, 1200);
  const referred = normalizeBoolean(data.referred);
  const referredBy = referred ? normalizeText(data.referredBy, 160) : 'N/A';

  if (!phone || !PROSPECT_GENDERS.has(gender) || !hobbies || !joinReason) {
    throw new HttpsError('invalid-argument', 'Phone, gender, hobbies, and reason for joining are required.');
  }
  if (gender === 'self-describe' && !genderSelfDescribe) {
    throw new HttpsError('invalid-argument', 'Please provide the gender self-description.');
  }
  if (previousRotaract && !previousRotaractDetails) {
    throw new HttpsError('invalid-argument', 'Previous Rotaract experience is required.');
  }
  if (referred && !referredBy) {
    throw new HttpsError('invalid-argument', 'Referrer name is required.');
  }

  return {
    phone,
    gender,
    genderSelfDescribe,
    hobbies,
    previousRotaract,
    previousRotaractDetails,
    joinReason,
    referred,
    referredBy,
  };
}

function escapeEmailHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeAnnouncementEmailAddress(value) {
  const email = normalizeEmail(value);
  if (!email) return { ok: false, email: '', code: 'missing_email' };
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) {
    return { ok: false, email: '', code: 'invalid_email' };
  }
  return { ok: true, email, code: '' };
}

function announcementPriorityEmailPrefix(priority) {
  if (priority === 'urgent') return '[URGENT][RCPH]';
  if (priority === 'important') return '[IMPORTANT][RCPH]';
  return '[RCPH]';
}

function announcementPriorityEmailLabel(priority) {
  if (priority === 'urgent') return 'Urgent';
  if (priority === 'important') return 'Important';
  return 'Normal';
}

function formatAnnouncementEmailDate(value) {
  if (!value) return '';
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
}

function buildAnnouncementEmailSubject(announcement) {
  return `${announcementPriorityEmailPrefix(announcement.priority)} ${announcement.title}`;
}

function buildAnnouncementEmailText(announcement) {
  const lines = [
    'Rotaract Club of Pune Heritage',
    '',
    `Priority: ${announcementPriorityEmailLabel(announcement.priority)}`,
    '',
    announcement.title,
    '',
    announcement.body,
  ];
  if (announcement.actionText && announcement.actionUrl) {
    lines.push('', `${announcement.actionText}: ${announcement.actionUrl}`);
  }
  const expires = formatAnnouncementEmailDate(announcement.expiresAt);
  if (expires) {
    lines.push('', `Expires: ${expires}`);
  }
  lines.push('', 'This announcement is also available on your RCPH dashboard.');
  return lines.join('\n');
}

function buildAnnouncementEmailHtml(announcement) {
  const priorityLabel = escapeEmailHtml(announcementPriorityEmailLabel(announcement.priority));
  const title = escapeEmailHtml(announcement.title);
  const body = escapeEmailHtml(announcement.body).replace(/\r?\n/g, '<br>');
  const expires = formatAnnouncementEmailDate(announcement.expiresAt);
  const action = announcement.actionText && announcement.actionUrl
    ? `<p style="margin:22px 0;"><a href="${escapeEmailHtml(announcement.actionUrl)}" style="display:inline-block;padding:11px 16px;border-radius:8px;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:700;">${escapeEmailHtml(announcement.actionText)}</a></p>`
    : '';
  const expiryHtml = expires
    ? `<p style="margin:14px 0 0;color:#596364;font-size:14px;">Expires: ${escapeEmailHtml(expires)}</p>`
    : '';

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#172124;background:#f6fbfb;padding:24px;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dce8e8;border-radius:12px;padding:24px;">
        <p style="margin:0 0 10px;color:#0f766e;font-weight:800;letter-spacing:.04em;text-transform:uppercase;">Rotaract Club of Pune Heritage</p>
        <p style="margin:0 0 14px;color:#7a5b12;font-weight:800;">${priorityLabel}</p>
        <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#111827;">${title}</h1>
        <div style="font-size:16px;color:#243133;">${body}</div>
        ${action}
        ${expiryHtml}
        <p style="margin:22px 0 0;color:#596364;font-size:14px;">This announcement is also available on your RCPH dashboard.</p>
      </div>
    </div>
  `;
}

async function updateAnnouncementDeliveryEmailStatus(announcementId, uid, fields) {
  await db
    .collection(ANNOUNCEMENT_DELIVERIES_COLLECTION)
    .doc(announcementDeliveryId(announcementId, uid))
    .set({
      ...fields,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
}

function safeAnnouncementLogId(value) {
  const text = String(value || '');
  if (text.length <= 12) return text;
  return `${text.slice(0, 6)}...${text.slice(-4)}`;
}

async function tryUpdateAnnouncementDeliveryEmailStatus(announcementId, uid, fields) {
  try {
    await updateAnnouncementDeliveryEmailStatus(announcementId, uid, fields);
    return true;
  } catch (err) {
    console.warn('Announcement email delivery status could not be persisted', {
      announcementId,
      uid: safeAnnouncementLogId(uid),
      intendedStatus: fields?.emailStatus || '',
      message: err?.message || String(err),
    });
    return false;
  }
}

async function markAnnouncementEmailFailures(announcementId, recipients, code, options = {}) {
  const pendingOnly = options.pendingOnly === true;
  let batch = db.batch();
  let ops = 0;
  for (const recipient of recipients) {
    const deliveryRef = db
      .collection(ANNOUNCEMENT_DELIVERIES_COLLECTION)
      .doc(announcementDeliveryId(announcementId, recipient.uid));
    if (pendingOnly) {
      const snap = await deliveryRef.get();
      if (!snap.exists || snap.data()?.emailStatus !== 'pending') {
        continue;
      }
    }
    batch.set(
      deliveryRef,
      {
        emailStatus: 'failed',
        emailSentAt: null,
        emailErrorCode: code,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    ops += 1;
    if (ops >= ANNOUNCEMENT_DELIVERY_BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }
  if (ops) await batch.commit();
}

async function tryMarkAnnouncementEmailFailures(announcementId, recipients, code, options = {}) {
  try {
    await markAnnouncementEmailFailures(announcementId, recipients, code, options);
    return true;
  } catch (err) {
    console.warn('Announcement bulk email failure status could not be persisted', {
      announcementId,
      recipientCount: recipients.length,
      intendedStatus: 'failed',
      code,
      message: err?.message || String(err),
    });
    return false;
  }
}

async function sendAnnouncementEmails({ announcementId, announcement, recipients }) {
  const summary = { attempted: recipients.length, sent: 0, failed: 0 };
  if (!recipients.length) return summary;

  if (recipients.length > ANNOUNCEMENT_EMAIL_MAX_RECIPIENTS) {
    await tryMarkAnnouncementEmailFailures(announcementId, recipients, 'email_recipient_limit');
    summary.failed = recipients.length;
    return summary;
  }

  if (!EMAIL_USER || !EMAIL_PASS) {
    await tryMarkAnnouncementEmailFailures(announcementId, recipients, 'email_not_configured');
    summary.failed = recipients.length;
    console.warn('Announcement email skipped: EMAIL_USER/EMAIL_PASS (or SMTP_USER/SMTP_PASS) is not configured.', {
      announcementId,
      recipientCount: recipients.length,
    });
    return summary;
  }

  const subject = buildAnnouncementEmailSubject(announcement);
  const text = buildAnnouncementEmailText(announcement);
  const html = buildAnnouncementEmailHtml(announcement);

  for (const recipient of recipients) {
    const email = normalizeAnnouncementEmailAddress(recipient.email);
    if (!email.ok) {
      summary.failed += 1;
      await tryUpdateAnnouncementDeliveryEmailStatus(announcementId, recipient.uid, {
        emailStatus: 'failed',
        emailSentAt: null,
        emailErrorCode: email.code,
      });
      continue;
    }

    let smtpSent = false;
    try {
      await transporter.sendMail({
        from: `"RCPH Platform" <${EMAIL_USER}>`,
        to: email.email,
        subject,
        text,
        html,
      });
      smtpSent = true;
    } catch (err) {
      summary.failed += 1;
      await tryUpdateAnnouncementDeliveryEmailStatus(announcementId, recipient.uid, {
        emailStatus: 'failed',
        emailSentAt: null,
        emailErrorCode: 'smtp_failed',
      });
    }

    if (smtpSent) {
      summary.sent += 1;
      const persisted = await tryUpdateAnnouncementDeliveryEmailStatus(announcementId, recipient.uid, {
        emailStatus: 'sent',
        emailSentAt: admin.firestore.FieldValue.serverTimestamp(),
        emailErrorCode: '',
      });
      if (!persisted) {
        console.warn('Announcement email sent but delivery status could not be persisted', {
          announcementId,
          uid: safeAnnouncementLogId(recipient.uid),
        });
      }
    }
  }

  const accounted = summary.sent + summary.failed;
  if (accounted < summary.attempted) {
    summary.failed += summary.attempted - accounted;
  } else if (accounted > summary.attempted) {
    summary.failed = Math.max(0, summary.attempted - summary.sent);
  }

  console.info('Announcement email summary', {
    announcementId,
    recipientCount: recipients.length,
    sent: summary.sent,
    failed: summary.failed,
  });
  return summary;
}

function signupEmailValue(value, fallback = 'N/A') {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  const normalized = normalizeText(value, 2000);
  return normalized || fallback;
}

function getSignupNotificationRecipients() {
  const configured = normalizeText(
    process.env.SIGNUP_NOTIFY_TO || process.env.EMAIL_TO || DEFAULT_SIGNUP_NOTIFY_TO,
    1200
  );
  const recipients = configured
    .split(/[;,\s]+/)
    .map(address => address.trim().toLowerCase())
    .filter(address => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address));

  return recipients.length ? Array.from(new Set(recipients)) : [DEFAULT_SIGNUP_NOTIFY_TO];
}

function getSignupNotificationSubject(userData) {
  const role = normalizeRole(userData.requestedRole || userData.role);
  if (role === 'prospect') return 'New Prospect Signup - RCPH';
  if (role === 'gbm') return 'New GBM Signup - RCPH';
  if (role === 'bod') return 'New BOD Access Request - RCPH';
  if (role === 'admin') return 'New Admin Access Request - RCPH';
  return 'New Account Signup - RCPH';
}

function getSignupNotificationHighlight(userData) {
  const role = normalizeRole(userData.requestedRole || userData.role);
  if (role === 'prospect') {
    return 'Prospect Member auto-approved. Onboarding criteria: 3 consecutive eligible meetings/events, then dues paid.';
  }
  if (role === 'gbm') return 'GBM auto-approved.';
  if (role === 'bod' || role === 'admin') {
    return 'Pending approval. Admin action required in Account Requests.';
  }
  return 'A new RCPH account was created.';
}

function getSignupNotificationRows(userData) {
  const role = normalizeRole(userData.requestedRole || userData.role);
  const gender = signupEmailValue(userData.gender);
  const describedGender = normalizeText(userData.genderSelfDescribe, 160);
  const rows = [
    ['Full name', signupEmailValue(userData.name)],
    ['Email', signupEmailValue(userData.email)],
    ['Phone', signupEmailValue(userData.phone)],
    ['Requested role', signupEmailValue(role)],
    ['Signup type', signupEmailValue(userData.signupType)],
    ['Status', signupEmailValue(userData.status)],
    ['Gender', describedGender ? `${gender} (${describedGender})` : gender],
  ];

  if (role === 'prospect') {
    rows.push(
      ['Hobbies / interests', signupEmailValue(userData.hobbies)],
      ['Previous Rotaract member', signupEmailValue(userData.previousRotaract)],
      ['Previous Rotaract experience', signupEmailValue(userData.previousRotaractDetails)],
      ['Reason for joining RCPH', signupEmailValue(userData.joinReason)],
      ['Referred by', signupEmailValue(userData.referredBy)]
    );
  }

  rows.push(
    ['Created timestamp', signupEmailValue(userData.createdAt)],
    ['Firebase UID', signupEmailValue(userData.uid)]
  );
  return rows;
}

function buildSignupNotificationHtml(userData) {
  const highlight = escapeEmailHtml(getSignupNotificationHighlight(userData));
  const rows = getSignupNotificationRows(userData)
    .map(([label, value]) => `
      <tr>
        <th style="padding:8px 12px;border:1px solid #e6e6e6;text-align:left;background:#faf7ef;vertical-align:top;">${escapeEmailHtml(label)}</th>
        <td style="padding:8px 12px;border:1px solid #e6e6e6;white-space:pre-wrap;">${escapeEmailHtml(value)}</td>
      </tr>`)
    .join('');

  return `
    <div style="font-family:Arial,sans-serif;color:#1f1f1f;line-height:1.5;max-width:760px;">
      <h2 style="color:#9b6814;margin-bottom:8px;">New RCPH account notification</h2>
      <p style="padding:12px 14px;background:#fff7df;border-left:4px solid #f4b43a;"><strong>${highlight}</strong></p>
      <table style="border-collapse:collapse;width:100%;margin:18px 0;">${rows}</table>
      <p><strong>Please review this user in the RCPH Admin Panel if approval/action is required.</strong></p>
    </div>`;
}

function buildSignupNotificationText(userData) {
  const rows = getSignupNotificationRows(userData)
    .map(([label, value]) => `${label}: ${value}`)
    .join('\n');

  return [
    'New RCPH account notification',
    '',
    getSignupNotificationHighlight(userData),
    '',
    rows,
    '',
    'Please review this user in the RCPH Admin Panel if approval/action is required.',
  ].join('\n');
}

async function sendSignupNotificationEmail(userData) {
  if (!EMAIL_USER || !EMAIL_PASS) {
    console.warn('Signup notification email skipped: EMAIL_USER/EMAIL_PASS (or SMTP_USER/SMTP_PASS) is not configured.');
    return { sent: false, reason: 'email-not-configured' };
  }

  const recipients = getSignupNotificationRecipients();
  await transporter.sendMail({
    from: `"RCPH Platform" <${EMAIL_USER}>`,
    to: recipients,
    subject: getSignupNotificationSubject(userData),
    text: buildSignupNotificationText(userData),
    html: buildSignupNotificationHtml(userData),
  });
  return { sent: true };
}

function normalizeClubPosition(value, fallback) {
  const cleaned = normalizeText(value, 120).replace(/\s+/g, ' ');
  return cleaned || fallback;
}

function requireAuth(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  return uid;
}

function throwCallableServiceError(err, fallbackMessage) {
  if (err instanceof HttpsError) throw err;
  const code = err?.httpsCode || err?.code;
  const callableCodes = new Set([
    'unauthenticated',
    'permission-denied',
    'failed-precondition',
    'invalid-argument',
    'not-found',
    'already-exists',
    'resource-exhausted',
    'internal',
  ]);
  if (callableCodes.has(code)) {
    throw new HttpsError(code, err.message || fallbackMessage, err.details || {});
  }
  console.warn(fallbackMessage, { message: err?.message || String(err) });
  throw new HttpsError('internal', fallbackMessage);
}

function safeProviderFromAuth(request, fallback) {
  const provider = request.auth?.token?.firebase?.sign_in_provider || fallback || '';
  if (provider === 'google.com') return 'google';
  if (provider === 'password') return 'password';
  return provider ? String(provider).slice(0, 40) : 'password';
}

function isApprovedRoleDoc(data, role) {
  return data
    && normalizeRole(data.role) === role
    && String(data.status || 'approved').toLowerCase() === 'approved';
}

async function getActiveRole(uid) {
  const snap = await db.collection('roles').doc(uid).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  const role = normalizeRole(data.role);
  if (!ACTIVE_ROLES.has(role)) return null;
  if (String(data.status || 'approved').toLowerCase() !== 'approved') return null;
  return { role, data };
}

function isApprovedActiveUserRecord(data) {
  return data
    && String(data.status || '').toLowerCase() === 'approved'
    && data.active !== false;
}

async function assertApprovedActiveCallableAccount(uid) {
  const [authRecord, userSnap] = await Promise.all([
    admin.auth().getUser(uid),
    db.collection('users').doc(uid).get(),
  ]);
  const userData = userSnap.exists ? (userSnap.data() || {}) : null;
  if (authRecord.disabled === true || !isApprovedActiveUserRecord(userData)) {
    throw new HttpsError('permission-denied', 'Approved active account required.');
  }
  return { authRecord, userData };
}

async function getPublicDashboardClubRanking() {
  try {
    const snap = await db
      .collection(CLUB_SETTINGS_COLLECTION)
      .doc(PUBLIC_DASHBOARD_SETTINGS_DOC)
      .get();
    const data = snap.exists ? (snap.data() || {}) : {};
    return normalizeClubRanking(data.clubRanking || {}, { strict: false });
  } catch (err) {
    console.warn('Could not load public dashboard club ranking', err?.message || String(err));
    return { ...CLUB_RANKING_DEFAULT };
  }
}

function isActivePositionAssignment(uid, positionKey, snap) {
  if (!snap || !snap.exists) return false;
  return positionHelpers.isActivePositionAssignment(uid, positionKey, snap.data() || {});
}

async function getAuthorityContext(uid, preloaded = {}) {
  const active = preloaded.activeRole || await getActiveRole(uid);
  const base = {
    uid,
    role: active?.role || '',
    status: active ? 'approved' : '',
    positionKeys: [],
    positionSource: null,
    authority: {
      isPresidentRole: active?.role === 'president',
      hasWebsiteDirectorPosition: false,
      hasPresidentAuthority: false,
    },
  };

  if (!active) return base;

  const cwdDefinition = positionHelpers.getPositionDefinition(positionHelpers.WEBSITE_DIRECTOR_POSITION_KEY);
  const canHoldWebsiteDirectorAuthority = ['bod', 'admin', 'president'].includes(active.role)
    && cwdDefinition?.active === true;

  const presidentDefinition = positionHelpers.getPositionDefinition('president');
  const canHoldPresidentAuthority = ['bod', 'admin', 'president'].includes(active.role)
    && presidentDefinition?.active === true;
  if (!canHoldWebsiteDirectorAuthority && !canHoldPresidentAuthority) return base;

  const userSnap = preloaded.userSnap || await db.collection('users').doc(uid).get();
  const userData = userSnap.exists ? (userSnap.data() || {}) : null;
  const resolved = positionHelpers.resolvePositionKeysFromRecords({
    users: userData,
    roles: active.data,
  });
  const metadata = positionHelpers.derivePositionMetadata(resolved.positionKeys);
  const positionKeysAreWellFormed = !(metadata.unknownValues && metadata.unknownValues.length)
    && !(metadata.inactiveKeys && metadata.inactiveKeys.length);

  let hasWebsiteDirectorPosition = false;
  if (
    canHoldWebsiteDirectorAuthority
    && isApprovedActiveUserRecord(userData)
    && positionKeysAreWellFormed
    && metadata.positionKeys.includes(positionHelpers.WEBSITE_DIRECTOR_POSITION_KEY)
  ) {
    const assignmentSnap = preloaded.cwdAssignmentSnap
      || await db.collection('bodPositionAssignments').doc(`${positionHelpers.WEBSITE_DIRECTOR_POSITION_KEY}_${uid}`).get();
    hasWebsiteDirectorPosition = isActivePositionAssignment(
      uid,
      positionHelpers.WEBSITE_DIRECTOR_POSITION_KEY,
      assignmentSnap
    );
  }

  let hasPresidentPosition = false;
  if (
    canHoldPresidentAuthority
    && isApprovedActiveUserRecord(userData)
    && positionKeysAreWellFormed
    && metadata.positionKeys.includes('president')
  ) {
    const assignmentSnap = preloaded.presidentAssignmentSnap
      || await db.collection('bodPositionAssignments').doc(`president_${uid}`).get();
    hasPresidentPosition = isActivePositionAssignment(uid, 'president', assignmentSnap);
  }

  return {
    ...base,
    positionKeys: metadata.positionKeys.slice(),
    positionSource: resolved.source,
    authority: {
      isPresidentRole: active.role === 'president',
      hasWebsiteDirectorPosition,
      hasPresidentAuthority: hasPresidentPosition || hasWebsiteDirectorPosition,
    },
  };
}

async function assertAdminOrPresident(uid) {
  const authority = await getAuthorityContext(uid);
  if (!authority.role || (authority.role !== 'admin' && !authority.authority.hasPresidentAuthority)) {
    throw new HttpsError('permission-denied', 'Admin or president access required.');
  }
  return authority.role;
}

async function assertAdminOrPresidentAuthority(uid) {
  const authority = await getAuthorityContext(uid);
  if (!authority.role || (authority.role !== 'admin' && !authority.authority.hasPresidentAuthority)) {
    throw new HttpsError('permission-denied', 'Admin or president access required.');
  }
  return authority;
}

async function assertPresidentAuthority(uid) {
  const authority = await getAuthorityContext(uid);
  if (!authority.authority.hasPresidentAuthority) {
    throw new HttpsError('permission-denied', 'President authority required.');
  }
  return authority;
}

async function assertBodAdminOrPresident(uid) {
  const authority = await getAuthorityContext(uid);
  if (!authority.role || !['bod', 'admin', 'president'].includes(authority.role)) {
    throw new HttpsError('permission-denied', 'Approved BOD, admin, or president access required.');
  }
  return authority.role;
}

function isActiveResolutionPositionAssignment(uid, snap, positionKey) {
  if (!snap?.exists) return false;
  const data = snap.data() || {};
  return data.active === true && data.uid === uid && data.positionKey === positionKey;
}

async function getResolutionManagerContext(uid) {
  const [active, account, secretaryAssignment, presidentAssignment] = await Promise.all([
    getActiveRole(uid),
    assertApprovedActiveCallableAccount(uid),
    db.collection('bodPositionAssignments').doc(`secretary_${uid}`).get(),
    db.collection('bodPositionAssignments').doc(`president_${uid}`).get(),
  ]);
  const role = active?.role || '';
  const secretary = isActiveResolutionPositionAssignment(uid, secretaryAssignment, 'secretary');
  const presidentPosition = isActiveResolutionPositionAssignment(uid, presidentAssignment, 'president');
  const allowed = resolutionModel.canManageResolutions({
    role,
    userActive: account.userData.active !== false,
    userApproved: String(account.userData.status || '').toLowerCase() === 'approved',
    secretaryAssignmentActive: secretary || presidentPosition,
  });
  if (!allowed) throw new HttpsError('permission-denied', 'President or Secretary authority required.');
  return {
    uid,
    role,
    name: stripRotaractorPrefix(normalizeText(account.userData.name || account.authRecord.displayName || account.authRecord.email, 160)),
    position: role === 'president' || presidentPosition ? 'President' : 'Secretary',
  };
}

async function hasResolutionManagerAuthority(uid, preloaded = {}) {
  try {
    const active = preloaded.activeRole || await getActiveRole(uid);
    const userSnap = preloaded.userSnap || await db.collection('users').doc(uid).get();
    const userData = userSnap.exists ? (userSnap.data() || {}) : {};
    if (!active || !isApprovedActiveUserRecord(userData)) return false;
    if (active.role === 'president') return true;
    const [secretarySnap, presidentSnap] = await Promise.all([
      db.collection('bodPositionAssignments').doc(`secretary_${uid}`).get(),
      db.collection('bodPositionAssignments').doc(`president_${uid}`).get(),
    ]);
    return isActiveResolutionPositionAssignment(uid, secretarySnap, 'secretary')
      || isActiveResolutionPositionAssignment(uid, presidentSnap, 'president');
  } catch {
    return false;
  }
}

function resolutionNumberIndexId(number) {
  return crypto.createHash('sha256').update(String(number || '').trim().toLowerCase()).digest('hex');
}

function resolutionTimestamp() {
  return admin.firestore.Timestamp.now();
}

function resolutionAuditPayload(action, actor, timestamp, options = {}) {
  return {
    action,
    actorUid: actor.uid,
    actorName: actor.name,
    actorPosition: actor.position,
    timestamp,
    previousValue: options.previousValue ?? null,
    newValue: options.newValue ?? null,
    metadata: options.metadata && typeof options.metadata === 'object' ? options.metadata : {},
  };
}

function setResolutionAudit(tx, resolutionRef, action, actor, timestamp, options) {
  tx.set(resolutionRef.collection('audit').doc(), resolutionAuditPayload(action, actor, timestamp, options));
}

async function loadActiveResolutionVoters() {
  const assignmentsSnap = await db.collection('bodPositionAssignments').where('active', '==', true).get();
  const byUid = new Map();
  assignmentsSnap.forEach(snap => {
    const data = snap.data() || {};
    const uid = normalizeText(data.uid, 128);
    const positionKey = normalizeText(data.positionKey, 80).toLowerCase();
    const definition = positionHelpers.getPositionDefinition(positionKey);
    if (!uid || !definition?.active || data.active !== true) return;
    const current = byUid.get(uid) || { uid, positions: new Map() };
    current.positions.set(definition.key, definition);
    byUid.set(uid, current);
  });
  const uids = Array.from(byUid.keys()).sort();
  if (!uids.length) return [];
  const [userSnaps, roleSnaps, bodMemberSnaps] = await Promise.all([
    db.getAll(...uids.map(uid => db.collection('users').doc(uid))),
    db.getAll(...uids.map(uid => db.collection('roles').doc(uid))),
    db.getAll(...uids.map(uid => db.collection('bodMembers').doc(uid))),
  ]);
  const voters = [];
  uids.forEach((uid, index) => {
    const user = userSnaps[index]?.exists ? (userSnaps[index].data() || {}) : {};
    const roleData = roleSnaps[index]?.exists ? (roleSnaps[index].data() || {}) : {};
    const bodMember = bodMemberSnaps[index]?.exists ? (bodMemberSnaps[index].data() || {}) : {};
    const role = normalizeRole(roleData.role);
    if (!isApprovedActiveUserRecord(user)
      || String(roleData.status || 'approved').toLowerCase() !== 'approved'
      || !['bod', 'admin', 'president'].includes(role)) return;
    const positions = Array.from(byUid.get(uid).positions.values()).sort((a, b) => a.sortOrder - b.sortOrder);
    const name = stripRotaractorPrefix(normalizeText(user.name || bodMember.name, 160));
    if (!name || !positions.length) return;
    voters.push({
      uid,
      name,
      position: positions.map(item => item.displayTitle).join(', '),
      positionKeys: positions.map(item => item.key),
    });
  });
  return voters.sort((a, b) => a.position.localeCompare(b.position) || a.name.localeCompare(b.name));
}

function validateResolutionCustomCount(payload, eligibleCount) {
  if (payload.votingRule === 'custom_approval_count'
    && (!Number.isInteger(payload.customApprovalCount)
      || payload.customApprovalCount < 1
      || payload.customApprovalCount > eligibleCount)) {
    throw new HttpsError('invalid-argument', 'Custom approval count must not exceed the eligible voter count.');
  }
}

function publicResolutionFields(id, data) {
  const documentSourceMode = resolutionUploads.sourceMode(data);
  const uploadedSource = resolutionUploads.reportSafeSource(data.uploadedSource);
  const merge = resolutionUploads.reportSafeMerge(data.merge, data.finalizedMergedPdf);
  const isDraft = data.status === 'draft';
  const isFinal = ['passed', 'rejected', 'closed_without_decision'].includes(data.status);
  return {
    id,
    resolutionNumber: normalizeText(data.resolutionNumber, 80),
    title: normalizeText(data.title, 220),
    body: typeof data.body === 'string' ? data.body.slice(0, 20000) : '',
    notes: typeof data.notes === 'string' ? data.notes.slice(0, 10000) : '',
    meetingId: normalizeText(data.meetingId, 160),
    meetingTitle: normalizeText(data.meetingTitle, 220),
    meetingDate: normalizeText(data.meetingDate, 20),
    proposedByUid: normalizeText(data.proposedByUid, 128),
    proposedByName: normalizeText(data.proposedByName, 160),
    proposedByPosition: normalizeText(data.proposedByPosition, 240),
    secondedByUid: normalizeText(data.secondedByUid, 128),
    secondedByName: normalizeText(data.secondedByName, 160),
    secondedByPosition: normalizeText(data.secondedByPosition, 240),
    status: resolutionModel.normalizeResolutionStatus(data.status),
    votingRule: resolutionModel.normalizeVotingRule(data.votingRule),
    customApprovalCount: Number.isInteger(data.customApprovalCount) ? data.customApprovalCount : null,
    eligibleVoterCount: Array.isArray(data.eligibleVoterUids) ? data.eligibleVoterUids.length : 0,
    approveCount: Math.max(0, Number(data.approveCount) || 0),
    rejectCount: Math.max(0, Number(data.rejectCount) || 0),
    abstainCount: Math.max(0, Number(data.abstainCount) || 0),
    votesReceivedCount: Math.max(0, Number(data.votesReceivedCount) || 0),
    result: resolutionModel.normalizeResolutionStatus(data.result),
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
    openedAt: timestampToIso(data.openedAt),
    closedAt: timestampToIso(data.closedAt),
    cancelledAt: timestampToIso(data.cancelledAt),
    openedByName: normalizeText(data.openedByName, 160),
    closedByName: normalizeText(data.closedByName, 160),
    cancelledByName: normalizeText(data.cancelledByName, 160),
    pdfLayoutMode: data.pdfLayoutMode === 'custom' ? 'custom' : 'standard',
    pdfSections: resolutionModel.normalizePdfSections(data.pdfSections),
    finalizedPdfLayoutMode: data.finalizedPdfLayoutMode === 'custom' ? 'custom' : data.finalizedPdfLayoutMode === 'standard' ? 'standard' : '',
    finalizedPdfSectionsSnapshot: resolutionModel.normalizePdfSections(data.finalizedPdfSectionsSnapshot),
    documentSourceMode,
    uploadedVotesTableConfig: resolutionModel.normalizeUploadedVotesTableConfig(data.uploadedVotesTableConfig),
    uploadedSource,
    merge,
    canUpload: isDraft && documentSourceMode === 'uploadedPdf',
    canReplace: isDraft && documentSourceMode === 'uploadedPdf' && Boolean(uploadedSource),
    canRemove: isDraft && documentSourceMode === 'uploadedPdf' && Boolean(uploadedSource),
    canPreviewSource: documentSourceMode === 'uploadedPdf' && Boolean(uploadedSource),
    canRetryMerge: isFinal && documentSourceMode === 'uploadedPdf' && ['pending', 'failed'].includes(merge.status),
    canDownloadFinal: isFinal && documentSourceMode === 'uploadedPdf' && merge.status === 'ready',
  };
}

function countResolutionVotes(votes) {
  const choices = (Array.isArray(votes) ? votes : []).map(vote => resolutionModel.normalizeVoteChoice(vote?.choice)).filter(Boolean);
  return {
    approveCount: choices.filter(choice => choice === 'approve').length,
    rejectCount: choices.filter(choice => choice === 'reject').length,
    abstainCount: choices.filter(choice => choice === 'abstain').length,
    votesReceivedCount: choices.length,
  };
}

function buildFinalizedVoteRows(resolution, votes, config) {
  const voteByUid = new Map((Array.isArray(votes) ? votes : []).map(vote => [normalizeText(vote?.voterUid, 128), vote]));
  if (config.voterScope === 'all') {
    return (Array.isArray(resolution.eligibleVoters) ? resolution.eligibleVoters : []).map(voter => {
      const vote = voteByUid.get(normalizeText(voter?.uid, 128));
      return {
        name: stripRotaractorPrefix(normalizeText(vote?.voterName || voter?.name || 'Not available', 160)),
        position: normalizeText(vote?.voterPosition || voter?.position || 'Not available', 240),
        vote: resolutionModel.normalizeVoteChoice(vote?.choice) || 'didNotVote',
        submittedAt: vote?.submittedAt || null,
      };
    });
  }
  return (Array.isArray(votes) ? votes : []).map(vote => ({
    name: stripRotaractorPrefix(normalizeText(vote?.voterName || 'Not available', 160)),
    position: normalizeText(vote?.voterPosition || 'Not available', 240),
    vote: resolutionModel.normalizeVoteChoice(vote?.choice) || 'didNotVote',
    submittedAt: vote?.submittedAt || null,
  }));
}

async function getOpenResolutionsForUser(uid) {
  const snap = await db.collection(RESOLUTIONS_COLLECTION)
    .where('eligibleVoterUids', 'array-contains', uid)
    .get();
  const rows = await Promise.all(snap.docs.map(async resolutionSnap => {
    const data = resolutionSnap.data() || {};
    if (data.status !== 'open' || !Array.isArray(data.eligibleVoterUids) || !data.eligibleVoterUids.includes(uid)) return null;
    const voter = (Array.isArray(data.eligibleVoters) ? data.eligibleVoters : []).find(item => item?.uid === uid);
    if (!voter) return null;
    const voteSnap = await resolutionSnap.ref.collection('votes').doc(uid).get();
    const vote = voteSnap.exists ? (voteSnap.data() || {}) : {};
    const fields = publicResolutionFields(resolutionSnap.id, data);
    delete fields.proposedByUid;
    delete fields.secondedByUid;
    delete fields.pdfSections;
    delete fields.finalizedPdfSectionsSnapshot;
    delete fields.finalizedPdfLayoutMode;
    delete fields.uploadedSource;
    delete fields.uploadedVotesTableConfig;
    delete fields.merge;
    delete fields.canUpload;
    delete fields.canReplace;
    delete fields.canRemove;
    delete fields.canPreviewSource;
    delete fields.canRetryMerge;
    delete fields.canDownloadFinal;
    return {
      ...fields,
      currentVote: resolutionModel.normalizeVoteChoice(vote.choice),
      submittedAt: timestampToIso(vote.submittedAt),
      voteUpdatedAt: timestampToIso(vote.updatedAt),
    };
  }));
  return rows.filter(Boolean).sort((a, b) => String(b.openedAt).localeCompare(String(a.openedAt)) || b.id.localeCompare(a.id));
}

function inviteCodeMatches(inputCode, expectedCode) {
  const input = normalizeText(inputCode, 200);
  const expected = normalizeText(expectedCode, 200);
  if (!input || !expected) return false;

  const inputBuffer = Buffer.from(input);
  const expectedBuffer = Buffer.from(expected);
  if (inputBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(inputBuffer, expectedBuffer);
}

async function buildProfileFromAuth(uid, request, data) {
  let record = null;
  try {
    record = await admin.auth().getUser(uid);
  } catch (err) {
    console.warn('Could not load auth user while building profile', uid, err?.message);
  }

  const email = normalizeEmail(record?.email || request.auth?.token?.email || data.email);
  const name = stripRotaractorPrefix(normalizeText(
    data.name || record?.displayName || request.auth?.token?.name || email.split('@')[0],
    120
  ));

  return {
    uid,
    name,
    email,
    provider: safeProviderFromAuth(request, data.provider),
  };
}

async function buildNaMapFromCollection(collectionName) {
  const snap = await db.collection(collectionName).get();
  const out = {};
  snap.forEach(doc => { out[doc.id] = 'NA'; });
  return out;
}

function setDocPreservingExistingAttendance(tx, ref, snap, eventIds, now) {
  const existing = snap.exists ? (snap.data() || {}) : {};
  const payload = { updatedAt: now };
  if (!snap.exists || !existing.createdAt) payload.createdAt = now;

  eventIds.forEach((id) => {
    if (!Object.prototype.hasOwnProperty.call(existing, id)) {
      payload[id] = 'NA';
    }
  });

  tx.set(ref, payload, { merge: true });
}

function setMemberProfileDoc(tx, ref, snap, profile, approvedRole, clubPosition, now) {
  const existing = snap.exists ? (snap.data() || {}) : {};
  tx.set(ref, {
    name: stripRotaractorPrefix(profile.name || existing.name || ''),
    email: profile.email || existing.email || '',
    role: approvedRole,
    position: clubPosition,
    userId: profile.uid,
    createdFromUser: true,
    active: true,
    createdAt: existing.createdAt || now,
    updatedAt: now,
  }, { merge: true });
}

const GENERAL_MEMBER_ATTENDANCE_ROLES = new Set(['gbm', 'bod', 'admin', 'president']);

async function ensureAttendanceRowsForRolePositionSync(uid, role, hasBodPosition) {
  const normalizedRole = normalizeRole(role);
  if (!GENERAL_MEMBER_ATTENDANCE_ROLES.has(normalizedRole)) {
    return { ok: true, generalAttendance: false, bodAttendance: false, skipped: true };
  }

  const [eventMap, districtEventMap, bodMeetingMap] = await Promise.all([
    buildNaMapFromCollection('events'),
    buildNaMapFromCollection('districtEvents'),
    hasBodPosition ? buildNaMapFromCollection('bodMeetings') : Promise.resolve({}),
  ]);
  const eventIds = Object.keys(eventMap);
  const districtEventIds = Object.keys(districtEventMap);
  const bodMeetingIds = Object.keys(bodMeetingMap);
  const attendanceRef = db.collection('attendance').doc(uid);
  const districtAttendanceRef = db.collection('districtAttendance').doc(uid);
  const bodAttendanceRef = db.collection('bodAttendance').doc(uid);
  const now = admin.firestore.FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    const refs = [attendanceRef, districtAttendanceRef];
    if (hasBodPosition) refs.push(bodAttendanceRef);
    const snaps = await Promise.all(refs.map(ref => tx.get(ref)));
    setDocPreservingExistingAttendance(tx, attendanceRef, snaps[0], eventIds, now);
    setDocPreservingExistingAttendance(tx, districtAttendanceRef, snaps[1], districtEventIds, now);
    if (hasBodPosition) {
      setDocPreservingExistingAttendance(tx, bodAttendanceRef, snaps[2], bodMeetingIds, now);
    }
  });

  return {
    ok: true,
    generalAttendance: true,
    bodAttendance: hasBodPosition === true,
  };
}

async function syncUserAccessAndPositionsWithAttendance(options) {
  const result = await rolePositionAssignments.syncUserRoleAndPositions(options);
  try {
    const attendanceSync = await ensureAttendanceRowsForRolePositionSync(
      result.targetUid,
      result.role,
      result.bodRosterActive
    );
    return { ...result, attendanceSync };
  } catch (err) {
    console.warn('Role/position authority updated but attendance initialization failed', {
      targetUid: result.targetUid,
      role: result.role,
      message: err?.message || String(err),
    });
    return {
      ...result,
      attendanceSync: {
        ok: false,
        message: 'Role and position data was updated, but attendance initialization needs retry.',
      },
    };
  }
}

function normalizeStringArray(value, maxItems = 20, maxLength = 180) {
  const input = Array.isArray(value) ? value : (value ? [value] : []);
  const seen = new Set();
  const out = [];
  input.forEach(item => {
    const cleaned = normalizeText(item, maxLength);
    if (!cleaned || seen.has(cleaned)) return;
    seen.add(cleaned);
    out.push(cleaned);
  });
  return out.slice(0, maxItems);
}

function validateEventDocId(eventId) {
  const cleaned = normalizeText(eventId, 128);
  if (cleaned && cleaned.includes('/')) {
    throw new HttpsError('invalid-argument', 'Invalid event ID.');
  }
  return cleaned;
}

function normalizeUploadFileName(value) {
  const raw = value === undefined || value === null ? '' : String(value).trim();
  if (raw.length > 180) {
    throw new HttpsError('invalid-argument', 'File name must be 180 characters or fewer.');
  }
  const cleaned = normalizeText(raw, 180)
    .replace(/[\\/:*?"<>|\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s]+/, '')
    .replace(/[.\s]+$/, '')
    .trim();
  if (!cleaned) throw new HttpsError('invalid-argument', 'File name is required.');
  return cleaned;
}

function validateDriveUploadMimeType(value) {
  const mimeType = normalizeText(value, 120).toLowerCase();
  if (!DRIVE_UPLOAD_ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new HttpsError('invalid-argument', 'Unsupported upload file type.');
  }
  return mimeType;
}

function validateDriveUploadSizeBytes(value, maxBytes) {
  const sizeBytes = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
    throw new HttpsError('invalid-argument', 'Valid upload size is required.');
  }
  if (sizeBytes > maxBytes) {
    throw new HttpsError('invalid-argument', 'Upload file is too large.');
  }
  return sizeBytes;
}

function generateDriveUploadTicket() {
  return crypto.randomBytes(32).toString('hex');
}

function hashDriveUploadTicket(ticket) {
  return crypto.createHash('sha256').update(String(ticket || ''), 'utf8').digest('hex');
}

function timingSafeSharedSecretMatches(providedValue, expectedValue) {
  const provided = typeof providedValue === 'string' ? providedValue : '';
  const expected = typeof expectedValue === 'string' ? expectedValue : '';
  if (!provided || !expected) return false;
  const providedHash = crypto.createHash('sha256').update(provided, 'utf8').digest();
  const expectedHash = crypto.createHash('sha256').update(expected, 'utf8').digest();
  return crypto.timingSafeEqual(providedHash, expectedHash);
}

function validateDriveUploadType(value) {
  const uploadType = normalizeText(value, 20).toLowerCase();
  if (!DRIVE_UPLOAD_TYPES.has(uploadType)) {
    throw new HttpsError('invalid-argument', 'Invalid upload type.');
  }
  return uploadType;
}

function normalizeDriveUploadText(value, max, label, { required = false } = {}) {
  const raw = value === undefined || value === null ? '' : String(value).trim();
  if (raw.length > max) {
    throw new HttpsError('invalid-argument', `${label} must be ${max} characters or fewer.`);
  }
  const cleaned = normalizeText(raw, max);
  if (required && !cleaned) {
    throw new HttpsError('invalid-argument', `${label} is required.`);
  }
  return cleaned;
}

function generateDriveUploadGroupId() {
  return crypto.randomBytes(16).toString('hex');
}

function hasSuppliedDriveUploadGroupId(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function normalizeDriveUploadGroupId(value, { required = false } = {}) {
  const supplied = hasSuppliedDriveUploadGroupId(value);
  if (!supplied) {
    if (required) throw new HttpsError('invalid-argument', 'Upload group ID is required.');
    return generateDriveUploadGroupId();
  }
  const raw = String(value).trim();
  if (raw.length > 100) {
    throw new HttpsError('invalid-argument', 'Upload group ID must be 100 characters or fewer.');
  }
  const uploadGroupId = normalizeText(raw, 100);
  if (!/^(?=.*[A-Za-z0-9])[A-Za-z0-9._:-]{1,100}$/.test(uploadGroupId)) {
    throw new HttpsError('invalid-argument', 'Invalid upload group ID.');
  }
  return uploadGroupId;
}

function assertBodUploadGroupMatches(groupSnap, { uid, eventName, eventDate }) {
  if (!groupSnap?.exists) {
    throw new HttpsError('failed-precondition', 'Upload group is not valid for this event.');
  }

  const groupData = groupSnap.data() || {};
  if (groupData.uid !== uid) {
    throw new HttpsError('permission-denied', 'Upload group is not valid for this user.');
  }
  if (groupData.eventName !== eventName || groupData.eventDate !== eventDate) {
    throw new HttpsError('failed-precondition', 'Upload group is not valid for this event.');
  }
}

function validateDriveTransactionId(value) {
  const raw = value === undefined || value === null ? '' : String(value).trim();
  if (raw.length > 128) {
    throw new HttpsError('invalid-argument', 'Transaction ID must be 128 characters or fewer.');
  }
  const transactionId = normalizeText(raw, 128);
  if (!transactionId || /[\\/]/.test(transactionId)) {
    throw new HttpsError('invalid-argument', 'Valid transaction ID is required.');
  }
  return transactionId;
}

function validateDriveTransactionType(value) {
  const transactionType = normalizeText(value, 20).toLowerCase();
  if (transactionType !== 'income' && transactionType !== 'expense') {
    throw new HttpsError('invalid-argument', 'Transaction type must be income or expense.');
  }
  return transactionType;
}

function validateDriveTransactionAmount(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new HttpsError('invalid-argument', 'Valid transaction amount is required.');
  }
  const transactionAmount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(transactionAmount) || transactionAmount < 0) {
    throw new HttpsError('invalid-argument', 'Valid transaction amount is required.');
  }
  return transactionAmount;
}

function normalizeRawDriveUploadTicket(value) {
  const ticket = normalizeText(value, 100);
  if (!/^[a-f0-9]{64}$/i.test(ticket)) {
    throw new HttpsError('invalid-argument', 'Valid upload ticket is required.');
  }
  return ticket.toLowerCase();
}

async function assertDriveUploadRateLimit(tx, { uid, uploadType, limit, nowMillis, rateLimitRef, rateLimitSnap }) {
  const ref = rateLimitRef || db.collection('driveUploadRateLimits').doc(`${uid}_${uploadType}`);
  const snap = rateLimitSnap || await tx.get(ref);
  const existing = snap.exists ? (snap.data() || {}) : {};
  const windowStart = nowMillis - DRIVE_UPLOAD_RATE_LIMIT_WINDOW_MS;
  const recentCreatedAtMillis = Array.isArray(existing.createdAtMillis)
    ? existing.createdAtMillis
      .filter(value => Number.isSafeInteger(value) && value > windowStart)
      .slice(-limit)
    : [];

  if (recentCreatedAtMillis.length >= limit) {
    throw new HttpsError('resource-exhausted', 'Too many upload tickets requested. Try again later.');
  }

  recentCreatedAtMillis.push(nowMillis);
  tx.set(ref, {
    uid,
    uploadType,
    limit,
    windowMs: DRIVE_UPLOAD_RATE_LIMIT_WINDOW_MS,
    createdAtMillis: recentCreatedAtMillis,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function createDriveUploadTicketDoc({ uid, role, uploadType, limit, metadata, bodUploadGroup = null }) {
  const ticket = generateDriveUploadTicket();
  const ticketHash = hashDriveUploadTicket(ticket);
  const nowMillis = Date.now();
  const expiresAtMillis = nowMillis + DRIVE_UPLOAD_TICKET_TTL_MS;
  const deleteAtMillis = expiresAtMillis + DRIVE_UPLOAD_TICKET_DELETE_GRACE_MS;
  const ticketRef = db.collection('driveUploadTickets').doc(ticketHash);
  const rateLimitRef = db.collection('driveUploadRateLimits').doc(`${uid}_${uploadType}`);
  const uploadGroupRef = bodUploadGroup
    ? db.collection('driveUploadGroups').doc(bodUploadGroup.uploadGroupId)
    : null;

  await db.runTransaction(async (tx) => {
    const uploadGroupSnap = bodUploadGroup?.supplied ? await tx.get(uploadGroupRef) : null;
    const rateLimitSnap = await tx.get(rateLimitRef);

    await assertDriveUploadRateLimit(tx, {
      uid,
      uploadType,
      limit,
      nowMillis,
      rateLimitRef,
      rateLimitSnap,
    });

    if (bodUploadGroup) {
      const groupTimestamp = admin.firestore.FieldValue.serverTimestamp();
      if (bodUploadGroup.supplied) {
        assertBodUploadGroupMatches(uploadGroupSnap, bodUploadGroup);
        tx.set(uploadGroupRef, { updatedAt: groupTimestamp }, { merge: true });
      } else {
        tx.create(uploadGroupRef, {
          uploadGroupId: bodUploadGroup.uploadGroupId,
          uid,
          eventName: bodUploadGroup.eventName,
          eventDate: bodUploadGroup.eventDate,
          createdAt: groupTimestamp,
          updatedAt: groupTimestamp,
        });
      }
    }

    tx.create(ticketRef, {
      uid,
      role,
      uploadType,
      ...metadata,
      expiresAt: admin.firestore.Timestamp.fromMillis(expiresAtMillis),
      deleteAt: admin.firestore.Timestamp.fromMillis(deleteAtMillis),
      used: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      usedAt: null,
    });
  });

  return { ticket, expiresAtMillis };
}

function sendDriveUploadJson(res, status, payload) {
  res.status(status)
    .set('Content-Type', 'application/json; charset=utf-8')
    .set('Cache-Control', 'no-store')
    .send(JSON.stringify(payload));
}

function parseDriveUploadRequestBody(req) {
  const body = req.body;
  if (body && typeof body === 'object' && !Buffer.isBuffer(body)) return body;
  if (Buffer.isBuffer(body)) return JSON.parse(body.toString('utf8'));
  if (typeof body === 'string') return JSON.parse(body || '{}');
  return {};
}

function httpError(status, message) {
  const err = new Error(message);
  err.httpStatus = status;
  return err;
}

function httpStatusFromHttpsError(err) {
  if (err instanceof SyntaxError) return 400;
  const statusByCode = {
    'invalid-argument': 400,
    unauthenticated: 401,
    'permission-denied': 403,
    'not-found': 404,
    'already-exists': 409,
    'failed-precondition': 412,
    'resource-exhausted': 429,
    'deadline-exceeded': 410,
  };
  return statusByCode[err?.code] || 500;
}

function normalizeVisibility(value, fallback = 'public') {
  const cleaned = normalizeText(value, 40).toLowerCase();
  if (cleaned === 'public' || cleaned === 'internal') return cleaned;
  return fallback;
}

function normalizeEventType(value, fallback = 'clubEvent') {
  const cleaned = normalizeText(value, 40);
  const allowed = new Set(['clubEvent', 'bodMeeting', 'districtEvent']);
  return allowed.has(cleaned) ? cleaned : fallback;
}

function normalizeRcphRole(value) {
  const cleaned = normalizeText(value, 40).toLowerCase();
  const allowed = new Set(['host', 'cohost', 'collaborator', 'participant']);
  return allowed.has(cleaned) ? cleaned : 'host';
}

function normalizeCollaborators(value) {
  const input = Array.isArray(value) ? value : [];
  const seen = new Set();
  const out = [];

  input.forEach((item) => {
    const rawName = typeof item === 'string' ? item : item?.name;
    const rawType = typeof item === 'object' ? item?.type : '';
    const name = normalizeText(rawName, 180).replace(/\s+/g, ' ');
    const type = normalizeText(rawType || 'unspecified', 60).replace(/\s+/g, ' ') || 'unspecified';
    const key = name.toLowerCase();
    if (!name || seen.has(key)) return;
    seen.add(key);
    out.push({ name, type });
  });

  return out.slice(0, 20);
}

function timestampCreatedAt(existing, now) {
  return existing.createdAt || now;
}

function normalizeBodEventPayload(raw) {
  const hasCollaborationFields = ['rcphRole', 'hostClub', 'collaborators', 'collaborationNotes']
    .some(field => Object.prototype.hasOwnProperty.call(raw || {}, field));
  const name = normalizeText(raw.name, 180);
  const conductedBy = normalizeText(raw.conductedBy, 140);
  const date = normalizeText(raw.date || raw.eventStart, 20);
  const endDate = normalizeText(raw.endDate || raw.eventEnd || date, 20);
  const time = normalizeText(raw.time || raw.eventTime, 20);
  const desc = normalizeText(raw.desc || raw.description, 2500);
  const avenue = normalizeStringArray(raw.avenue, 12, 40);
  const imageLinks = normalizeStringArray(raw.imageLinks || raw.driveLinks || raw.uploadedFileUrls, 30, 700);
  const driveLinks = normalizeStringArray(raw.driveLinks || imageLinks, 30, 700);
  const driveFolder = normalizeText(raw.driveFolder || raw.driveFolderId, 700);

  if (!name) throw new HttpsError('invalid-argument', 'Event name is required.');
  if (!conductedBy) throw new HttpsError('invalid-argument', 'Conducted by is required.');
  if (!date) throw new HttpsError('invalid-argument', 'Start date is required.');
  if (!endDate) throw new HttpsError('invalid-argument', 'End date is required.');
  if (!avenue.length) throw new HttpsError('invalid-argument', 'Select at least one avenue.');

  const source = normalizeText(raw.source, 80);
  const type = normalizeEventType(raw.type, 'clubEvent');
  const visibility = normalizeVisibility(raw.visibility, 'public');
  const rcphRole = normalizeRcphRole(raw.rcphRole);
  const hostClub = normalizeText(raw.hostClub, 180).replace(/\s+/g, ' ') || RCPH_CLUB_NAME;
  const collaborators = normalizeCollaborators(raw.collaborators);
  const collaborationNotes = normalizeText(raw.collaborationNotes, 1000);

  return {
    name,
    conductedBy,
    date,
    endDate,
    time,
    desc,
    avenue,
    imageLinks,
    driveLinks,
    driveFolder,
    source,
    type,
    visibility,
    rcphRole,
    hostClub,
    collaborators,
    collaborationNotes,
    _hasCollaborationFields: hasCollaborationFields,
  };
}

function normalizeClubEventPayload(raw, userProfile, source = 'adminAttendanceManager') {
  const avenues = normalizeStringArray(raw.avenue, 12, 40);
  const payload = normalizeBodEventPayload({
    ...raw,
    conductedBy: raw.conductedBy || userProfile.name || 'Admin',
    endDate: raw.endDate || raw.date,
    avenue: avenues.length ? avenues : ['Club'],
    source,
    type: 'clubEvent',
    visibility: 'public',
  });
  return {
    ...payload,
    source,
    type: 'clubEvent',
    visibility: 'public',
  };
}

function normalizeBodMeetingPayload(raw) {
  const name = normalizeText(raw.name, 180);
  const date = normalizeText(raw.date, 20);
  const desc = normalizeText(raw.desc || raw.description, 1200);
  if (!name) throw new HttpsError('invalid-argument', 'Meeting name is required.');
  if (!date) throw new HttpsError('invalid-argument', 'Meeting date is required.');
  return {
    name,
    date,
    endDate: date,
    desc,
    avenue: ['BOD'],
    type: 'bodMeeting',
    source: 'adminBodAttendance',
    visibility: 'internal',
  };
}

function normalizeDistrictEventPayload(raw) {
  const name = normalizeText(raw.name, 180);
  const date = normalizeText(raw.date, 20);
  const endDate = normalizeText(raw.endDate || raw.date, 20);
  const desc = normalizeText(raw.desc || raw.description, 1200);
  const visibility = raw.showOnHomepage === true
    ? 'public'
    : normalizeVisibility(raw.visibility, 'internal');
  if (!name) throw new HttpsError('invalid-argument', 'District event name is required.');
  if (!date) throw new HttpsError('invalid-argument', 'District event date is required.');
  return {
    name,
    date,
    endDate,
    desc,
    avenue: ['District'],
    type: 'districtEvent',
    source: 'districtAttendance',
    visibility,
  };
}

function hasPresidentAuthorityValue(roleOrAuthority) {
  if (roleOrAuthority && typeof roleOrAuthority === 'object') {
    return roleOrAuthority.authority?.hasPresidentAuthority === true;
  }
  return roleOrAuthority === 'president';
}

async function assertBodEventsUnlockedForRole(roleOrAuthority) {
  const lockSnap = await db.collection('locks').doc('bodEvents').get();
  const locked = lockSnap.exists && lockSnap.data()?.locked === true;
  if (locked && !hasPresidentAuthorityValue(roleOrAuthority)) {
    throw new HttpsError('failed-precondition', 'BOD event submissions are locked.');
  }
}

async function assertBodEventRecordIsClubEvent(eventId) {
  const snap = await db.collection('bodEvents').doc(eventId).get();
  if (!snap.exists) return;
  const type = normalizeEventType((snap.data() || {}).type, 'clubEvent');
  if (type !== 'clubEvent') {
    throw new HttpsError('failed-precondition', 'This record is managed from its admin panel.');
  }
}

async function assertPanelUnlockedForRole(panelKey, roleOrAuthority, label) {
  const lockSnap = await db.collection('locks').doc(panelKey).get();
  const locked = lockSnap.exists && lockSnap.data()?.locked === true;
  if (locked && !hasPresidentAuthorityValue(roleOrAuthority)) {
    throw new HttpsError('failed-precondition', `${label || panelKey} is locked.`);
  }
}

async function getCallableUserProfile(uid, request) {
  let record = null;
  try {
    record = await admin.auth().getUser(uid);
  } catch (err) {
    console.warn('Could not load auth user for BOD event', uid, err?.message);
  }
  const userSnap = await db.collection('users').doc(uid).get().catch(() => null);
  const userData = userSnap?.exists ? (userSnap.data() || {}) : {};

  return {
    email: normalizeEmail(userData.email || record?.email || request.auth?.token?.email || ''),
    name: stripRotaractorPrefix(normalizeText(userData.name || record?.displayName || request.auth?.token?.name || request.auth?.token?.email || uid, 140)),
  };
}

async function initializeAttendanceForEvent(eventId, now) {
  const membersSnap = await db.collection('members').get();
  const activeMembers = membersSnap.docs.filter(doc => (doc.data() || {}).active !== false);

  const attendanceSnaps = await Promise.all(
    activeMembers.map(memberDoc => db.collection('attendance').doc(memberDoc.id).get())
  );

  let batch = db.batch();
  let batchOps = 0;
  let attendanceRowsUpdated = 0;

  for (let i = 0; i < activeMembers.length; i += 1) {
    const memberDoc = activeMembers[i];
    const attendanceSnap = attendanceSnaps[i];
    const existing = attendanceSnap.exists ? (attendanceSnap.data() || {}) : {};

    if (Object.prototype.hasOwnProperty.call(existing, eventId)) continue;

    const payload = {
      [eventId]: 'NA',
      updatedAt: now,
    };
    if (!attendanceSnap.exists || !existing.createdAt) payload.createdAt = now;

    batch.set(db.collection('attendance').doc(memberDoc.id), payload, { merge: true });
    batchOps += 1;
    attendanceRowsUpdated += 1;

    if (batchOps >= 450) {
      await batch.commit();
      batch = db.batch();
      batchOps = 0;
    }
  }

  if (batchOps > 0) await batch.commit();
  return attendanceRowsUpdated;
}

async function initializeAttendanceFieldForCollection(memberCollection, attendanceCollection, fieldId, now) {
  const membersSnap = await db.collection(memberCollection).get();
  const activeMembers = membersSnap.docs.filter(doc => (doc.data() || {}).active !== false);
  const attendanceSnaps = await Promise.all(
    activeMembers.map(memberDoc => db.collection(attendanceCollection).doc(memberDoc.id).get())
  );

  let batch = db.batch();
  let batchOps = 0;
  let rowsUpdated = 0;

  for (let i = 0; i < activeMembers.length; i += 1) {
    const memberDoc = activeMembers[i];
    const attendanceSnap = attendanceSnaps[i];
    const existing = attendanceSnap.exists ? (attendanceSnap.data() || {}) : {};
    if (Object.prototype.hasOwnProperty.call(existing, fieldId)) continue;

    const payload = { [fieldId]: 'NA', updatedAt: now };
    if (!attendanceSnap.exists || !existing.createdAt) payload.createdAt = now;
    batch.set(db.collection(attendanceCollection).doc(memberDoc.id), payload, { merge: true });
    batchOps += 1;
    rowsUpdated += 1;

    if (batchOps >= 450) {
      await batch.commit();
      batch = db.batch();
      batchOps = 0;
    }
  }

  if (batchOps > 0) await batch.commit();
  return rowsUpdated;
}

async function writeSyncedBodEvent({ eventId, payload, uid, userProfile, now, preserveCreatedAt = true }) {
  const bodRef = db.collection('bodEvents').doc(eventId);
  const eventRef = db.collection('events').doc(eventId);
  const [bodSnap, eventSnap] = await Promise.all([bodRef.get(), eventRef.get()]);
  const existingBod = bodSnap.exists ? (bodSnap.data() || {}) : {};
  const existingEvent = eventSnap.exists ? (eventSnap.data() || {}) : {};
  const driveFolderRaw = String(payload.driveFolder || '').trim();
  const folderMatch = driveFolderRaw.match(/\/folders\/([a-zA-Z0-9_-]+)/) || driveFolderRaw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  const driveFolderId = folderMatch ? folderMatch[1] : (driveFolderRaw && !driveFolderRaw.includes('http') ? driveFolderRaw : '');
  const source = payload.source || existingBod.source || existingEvent.source || 'bodEventManager';
  const type = normalizeEventType(payload.type || existingBod.type || existingEvent.type, 'clubEvent');
  const visibility = normalizeVisibility(payload.visibility || existingBod.visibility || existingEvent.visibility, 'public');
  const shouldUsePayloadCollab = payload._hasCollaborationFields || (!bodSnap.exists && !eventSnap.exists);
  const rcphRole = shouldUsePayloadCollab
    ? (payload.rcphRole || 'host')
    : normalizeRcphRole(existingBod.rcphRole || existingEvent.rcphRole);
  const hostClub = shouldUsePayloadCollab
    ? (payload.hostClub || RCPH_CLUB_NAME)
    : (normalizeText(existingBod.hostClub || existingEvent.hostClub, 180).replace(/\s+/g, ' ') || RCPH_CLUB_NAME);
  const collaborators = shouldUsePayloadCollab
    ? (payload.collaborators || [])
    : normalizeCollaborators(existingBod.collaborators || existingEvent.collaborators || []);
  const collaborationNotes = shouldUsePayloadCollab
    ? (payload.collaborationNotes || '')
    : normalizeText(existingBod.collaborationNotes || existingEvent.collaborationNotes, 1000);

  const bodEventDoc = {
    name: payload.name,
    conductedBy: payload.conductedBy,
    date: payload.date,
    endDate: payload.endDate,
    time: payload.time,
    desc: payload.desc,
    description: payload.desc,
    avenue: payload.avenue,
    imageLinks: payload.imageLinks,
    driveFolder: payload.driveFolder,
    driveFolderId: driveFolderId || existingBod.driveFolderId || '',
    driveLinks: payload.driveLinks,
    previewLink: payload.imageLinks[0] || existingBod.previewLink || '',
    eventStart: payload.date,
    eventEnd: payload.endDate,
    eventTime: payload.time,
    status: 'synced',
    syncedEventId: eventId,
    source,
    type,
    visibility,
    rcphRole,
    hostClub,
    collaborators,
    collaborationNotes,
    archived: false,
    createdBy: existingBod.createdBy || uid,
    createdByEmail: existingBod.createdByEmail || userProfile.email,
    createdByName: existingBod.createdByName || userProfile.name,
    createdByNameSearch: (existingBod.createdByName || userProfile.name || userProfile.email || '').toLowerCase().split(/\s+/).filter(Boolean),
    createdAt: preserveCreatedAt ? timestampCreatedAt(existingBod, now) : now,
    updatedAt: now,
  };

  const eventDoc = {
    name: payload.name,
    date: payload.date,
    endDate: payload.endDate,
    desc: payload.desc,
    avenue: payload.avenue,
    source,
    bodEventId: eventId,
    type,
    visibility,
    rcphRole,
    hostClub,
    collaborators,
    collaborationNotes,
    conductedBy: payload.conductedBy,
    createdBy: existingEvent.createdBy || uid,
    createdAt: preserveCreatedAt ? timestampCreatedAt(existingEvent, now) : now,
    updatedAt: now,
    archived: false,
  };

  const batch = db.batch();
  batch.set(bodRef, bodEventDoc, { merge: true });
  batch.set(eventRef, eventDoc, { merge: true });
  await batch.commit();

  return { eventCreated: !eventSnap.exists };
}

async function writeBodMeetingSynced({ meetingId, payload, uid, userProfile, now }) {
  const meetingRef = db.collection('bodMeetings').doc(meetingId);
  const bodEventRef = db.collection('bodEvents').doc(meetingId);
  const [meetingSnap, bodEventSnap] = await Promise.all([meetingRef.get(), bodEventRef.get()]);
  const existingMeeting = meetingSnap.exists ? (meetingSnap.data() || {}) : {};
  const existingBodEvent = bodEventSnap.exists ? (bodEventSnap.data() || {}) : {};

  const batch = db.batch();
  batch.set(meetingRef, {
    name: payload.name,
    date: payload.date,
    endDate: payload.endDate,
    desc: payload.desc,
    type: 'bodMeeting',
    source: 'adminBodAttendance',
    visibility: 'internal',
    archived: false,
    createdBy: existingMeeting.createdBy || uid,
    createdAt: timestampCreatedAt(existingMeeting, now),
    updatedAt: now,
  }, { merge: true });

  batch.set(bodEventRef, {
    name: payload.name,
    date: payload.date,
    endDate: payload.endDate,
    eventStart: payload.date,
    eventEnd: payload.endDate,
    desc: payload.desc,
    description: payload.desc,
    avenue: payload.avenue,
    type: 'bodMeeting',
    source: 'adminBodAttendance',
    visibility: 'internal',
    status: 'synced',
    syncedMeetingId: meetingId,
    archived: false,
    createdBy: existingBodEvent.createdBy || uid,
    createdByEmail: existingBodEvent.createdByEmail || userProfile.email,
    createdByName: existingBodEvent.createdByName || userProfile.name,
    createdAt: timestampCreatedAt(existingBodEvent, now),
    updatedAt: now,
  }, { merge: true });

  await batch.commit();
  return { meetingCreated: !meetingSnap.exists };
}

async function writeDistrictEventSynced({ districtEventId, payload, uid, userProfile, now }) {
  const districtRef = db.collection('districtEvents').doc(districtEventId);
  const bodEventRef = db.collection('bodEvents').doc(districtEventId);
  const publicEventRef = db.collection('events').doc(districtEventId);
  const [districtSnap, bodEventSnap, publicEventSnap] = await Promise.all([
    districtRef.get(),
    bodEventRef.get(),
    publicEventRef.get(),
  ]);
  const existingDistrict = districtSnap.exists ? (districtSnap.data() || {}) : {};
  const existingBodEvent = bodEventSnap.exists ? (bodEventSnap.data() || {}) : {};
  const existingPublicEvent = publicEventSnap.exists ? (publicEventSnap.data() || {}) : {};
  const isPublic = payload.visibility === 'public';

  const batch = db.batch();
  batch.set(districtRef, {
    name: payload.name,
    date: payload.date,
    endDate: payload.endDate,
    desc: payload.desc,
    type: 'districtEvent',
    source: 'districtAttendance',
    visibility: payload.visibility,
    archived: false,
    createdBy: existingDistrict.createdBy || uid,
    createdAt: timestampCreatedAt(existingDistrict, now),
    updatedAt: now,
  }, { merge: true });

  batch.set(bodEventRef, {
    name: payload.name,
    date: payload.date,
    endDate: payload.endDate,
    eventStart: payload.date,
    eventEnd: payload.endDate,
    desc: payload.desc,
    description: payload.desc,
    avenue: payload.avenue,
    type: 'districtEvent',
    source: 'districtAttendance',
    visibility: payload.visibility,
    status: 'synced',
    syncedDistrictEventId: districtEventId,
    archived: false,
    createdBy: existingBodEvent.createdBy || uid,
    createdByEmail: existingBodEvent.createdByEmail || userProfile.email,
    createdByName: existingBodEvent.createdByName || userProfile.name,
    createdAt: timestampCreatedAt(existingBodEvent, now),
    updatedAt: now,
  }, { merge: true });

  if (isPublic) {
    batch.set(publicEventRef, {
      name: payload.name,
      date: payload.date,
      endDate: payload.endDate,
      desc: payload.desc,
      avenue: payload.avenue,
      type: 'districtEvent',
      source: 'districtAttendance',
      districtEventId,
      visibility: 'public',
      archived: false,
      createdBy: existingPublicEvent.createdBy || uid,
      createdAt: timestampCreatedAt(existingPublicEvent, now),
      updatedAt: now,
    }, { merge: true });
  } else if (publicEventSnap.exists) {
    batch.set(publicEventRef, {
      visibility: 'internal',
      archived: true,
      archivedAt: now,
      archivedBy: uid,
      updatedAt: now,
    }, { merge: true });
  }

  await batch.commit();
  return { districtEventCreated: !districtSnap.exists, publicEventCreated: isPublic && !publicEventSnap.exists };
}

function normalizeAvenuesForStats(avenue) {
  const values = Array.isArray(avenue) ? avenue : (avenue ? [avenue] : []);
  const cleaned = values
    .map(item => normalizeText(item, 60))
    .filter(Boolean);
  return cleaned.length ? cleaned : ['Other'];
}

function attendanceLabel(value) {
  if (value === true) return 'Present';
  if (value === false) return 'Absent';
  return 'NA';
}

function attendanceMonth(dateValue) {
  const raw = normalizeText(dateValue, 20);
  if (!raw) return 'Unknown';
  return raw.slice(0, 7);
}

function percentage(present, totalCounted) {
  return totalCounted ? Math.round((present / totalCounted) * 100) : 0;
}

function prospectEventAvenues(event) {
  const avenues = Array.isArray(event?.avenue) ? event.avenue : (event?.avenue ? [event.avenue] : []);
  return new Set(avenues.map(value => normalizeText(value, 40).toUpperCase()).filter(Boolean));
}

function isGbmEvent(event) {
  return prospectEventAvenues(event).has('GBM');
}

function isAvenueEvent(event) {
  const avenues = prospectEventAvenues(event);
  return Array.from(PROSPECT_AVENUES).some(avenue => avenues.has(avenue));
}

const PROSPECT_PROGRESS_LOGICAL_FIELDS = [
  'uid',
  'criteriaVersion',
  'criteria',
  'gbmAttended',
  'avenueEventsAttended',
  'duesPaid',
  'duesDue',
  'ready',
  'status',
  'completedCount',
  'totalCount',
  'percent',
  'currentConsecutiveAttendance',
  'maximumConsecutiveAttendance',
  'requiredConsecutiveAttendance',
  'attendanceProgressCount',
  'attendanceRequirementMet',
  'qualifyingEventIds',
  'qualifyingEvents',
  'attendanceRequirementMetAt',
  'fourthEligibleActivityId',
  'fourthEligibleActivityDate',
  'whatsappJoined',
];

function comparableProspectProgress(data = {}) {
  return PROSPECT_PROGRESS_LOGICAL_FIELDS.reduce((out, field) => {
    out[field] = data[field] === undefined ? null : data[field];
    return out;
  }, {});
}

function prospectProgressChanged(current, next) {
  return JSON.stringify(comparableProspectProgress(current)) !== JSON.stringify(comparableProspectProgress(next));
}

function isPromotedProspectRecord(user = {}, progress = {}) {
  return normalizeRole(progress.status) === 'promoted'
    || user.promotedFromProspect === true
    || Boolean(progress.promotedAt);
}

function isActiveProspectRecord(user = {}) {
  const role = normalizeRole(user.role);
  const memberType = normalizeRole(user.memberType);
  const status = normalizeRole(user.status);
  return (role === 'prospect' || memberType === 'prospect')
    && status !== 'pending'
    && status !== 'rejected'
    && status !== 'declined';
}

async function recalcProspectProgress(uid, options = {}) {
  const progressRef = db.collection('prospectProgress').doc(uid);
  const attendanceRef = db.collection('attendance').doc(uid);
  const userRef = db.collection('users').doc(uid);
  const [eventsSnap, attendanceSnap, progressSnap, userSnap] = await Promise.all([
    options.eventsSnap ? Promise.resolve(options.eventsSnap) : db.collection('events').get(),
    attendanceRef.get(),
    progressRef.get(),
    options.user ? Promise.resolve(null) : userRef.get(),
  ]);
  const attendance = attendanceSnap.exists ? (attendanceSnap.data() || {}) : {};
  const current = progressSnap.exists ? (progressSnap.data() || {}) : {};
  const user = options.user || (userSnap?.exists ? (userSnap.data() || {}) : {});
  const events = Array.isArray(options.events)
    ? options.events
    : (eventsSnap?.docs || []).map(doc => ({ id: doc.id, ...(doc.data() || {}) }));
  const calculation = calculateProspectMembershipProgress({
    uid,
    user,
    currentProgress: current,
    attendance,
    events,
    now: options.now || new Date(),
  });

  const promoted = isPromotedProspectRecord(user, current);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const update = {
    ...calculation,
    whatsappJoined: current.whatsappJoined === true,
    status: promoted ? 'promoted' : (calculation.ready ? 'ready' : 'in_progress'),
    createdAt: current.createdAt || now,
    updatedAt: now,
    recalculatedAt: now,
  };
  const changed = prospectProgressChanged(current, update);
  if (changed || options.forceWrite === true) {
    await progressRef.set(update, { merge: true });
  }
  return {
    ...calculation,
    whatsappJoined: update.whatsappJoined,
    status: update.status,
    changed,
  };
}

async function loadProspectUserAndProgressMaps() {
  const [roleProspectsSnap, typeProspectsSnap, progressSnap] = await Promise.all([
    db.collection('users').where('role', '==', 'prospect').get(),
    db.collection('users').where('memberType', '==', 'prospect').get(),
    db.collection('prospectProgress').get(),
  ]);
  const usersByUid = new Map();
  [...roleProspectsSnap.docs, ...typeProspectsSnap.docs].forEach(doc => {
    usersByUid.set(doc.id, { id: doc.id, ...(doc.data() || {}) });
  });
  const progressByUid = new Map(progressSnap.docs.map(doc => [doc.id, doc.data() || {}]));
  return { usersByUid, progressByUid, progressSnap };
}

async function recalcAllActiveProspects(options = {}) {
  const eventsSnap = options.eventsSnap || (await db.collection('events').get());
  const { usersByUid, progressByUid } = await loadProspectUserAndProgressMaps();
  const summary = {
    processed: 0,
    updated: 0,
    unchanged: 0,
    failed: 0,
    ready: 0,
    attendanceComplete: 0,
    duesPending: 0,
    skippedPromoted: 0,
    skippedInactive: 0,
    failures: [],
  };

  for (const user of usersByUid.values()) {
    const progress = progressByUid.get(user.id) || {};
    if (isPromotedProspectRecord(user, progress)) {
      summary.skippedPromoted += 1;
      continue;
    }
    if (!isActiveProspectRecord(user)) {
      summary.skippedInactive += 1;
      continue;
    }

    try {
      const result = await recalcProspectProgress(user.id, { eventsSnap, user });
      summary.processed += 1;
      if (result.changed) summary.updated += 1;
      else summary.unchanged += 1;
      if (result.ready) summary.ready += 1;
      if (result.attendanceRequirementMet) summary.attendanceComplete += 1;
      if (result.duesDue && !result.duesPaid) summary.duesPending += 1;
    } catch (err) {
      summary.processed += 1;
      summary.failed += 1;
      summary.failures.push({
        uid: user.id,
        message: err?.message || 'Unknown recalculation error',
      });
    }
  }

  return summary;
}

function isDashboardClubEvent(event) {
  return event
    && event.archived !== true
    && String(event.visibility || 'public').toLowerCase() !== 'internal'
    && String(event.type || 'clubEvent') === 'clubEvent';
}

function summarizeAttendanceForEvents(attendanceData, events) {
  let present = 0;
  let absent = 0;
  let na = 0;
  const avenueMap = new Map();
  const monthMap = new Map();

  events.forEach(event => {
    const value = attendanceData[event.id];
    const counted = value === true || value === false;
    if (value === true) present += 1;
    else if (value === false) absent += 1;
    else na += 1;

    const avenues = normalizeAvenuesForStats(event.avenue);
    avenues.forEach(avenue => {
      if (!avenueMap.has(avenue)) avenueMap.set(avenue, { avenue, totalCounted: 0, present: 0, absent: 0 });
      const row = avenueMap.get(avenue);
      if (counted) {
        row.totalCounted += 1;
        if (value === true) row.present += 1;
        else row.absent += 1;
      }
    });

    const month = attendanceMonth(event.date);
    if (!monthMap.has(month)) monthMap.set(month, { month, totalCounted: 0, present: 0, absent: 0 });
    const monthRow = monthMap.get(month);
    if (counted) {
      monthRow.totalCounted += 1;
      if (value === true) monthRow.present += 1;
      else monthRow.absent += 1;
    }
  });

  const totalCounted = present + absent;
  return {
    totalCounted,
    present,
    absent,
    na,
    percentage: percentage(present, totalCounted),
    avenueBreakdown: Array.from(avenueMap.values())
      .filter(row => row.totalCounted > 0)
      .map(row => ({ ...row, percentage: percentage(row.present, row.totalCounted) }))
      .sort((a, b) => b.totalCounted - a.totalCounted || a.avenue.localeCompare(b.avenue)),
    monthlyBreakdown: Array.from(monthMap.values())
      .filter(row => row.totalCounted > 0)
      .map(row => ({ ...row, percentage: percentage(row.present, row.totalCounted) }))
      .sort((a, b) => a.month.localeCompare(b.month)),
  };
}

function safeEventForDashboard(event, value) {
  return {
    id: event.id,
    name: event.name || '',
    date: event.date || '',
    endDate: event.endDate || '',
    avenue: normalizeAvenuesForStats(event.avenue),
    value: value === true ? true : value === false ? false : 'NA',
    label: attendanceLabel(value),
    type: event.type || 'clubEvent',
    desc: event.desc || event.description || '',
  };
}

exports.createUserProfileAfterSignup = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const data = request.data || {};
  const signupType = normalizeRole(data.signupType);
  const requestedRole = signupType === 'prospect'
    ? 'prospect'
    : normalizeRole(data.requestedRole);

  if (!REQUESTABLE_ROLES.has(requestedRole)) {
    throw new HttpsError('invalid-argument', 'Choose Prospect, GBM, BOD, or Admin.');
  }
  if (requestedRole === 'president') {
    throw new HttpsError('permission-denied', 'President accounts are manual-only.');
  }

  if (requestedRole === 'admin') {
    const expected = ADMIN_INVITE_CODE;
    if (!expected) {
      throw new HttpsError('failed-precondition', 'Server invite code is not configured.');
    }
    if (!inviteCodeMatches(data.inviteCode, expected)) {
      throw new HttpsError('permission-denied', 'Invalid admin invite code.');
    }
  }

  const profile = await buildProfileFromAuth(uid, request, data);
  const commonSignupData = {
    phone: normalizeText(data.phone, 40),
    gender: normalizeText(data.gender, 40).toLowerCase(),
    genderSelfDescribe: normalizeText(data.genderSelfDescribe ?? data.genderSelfDescription, 160),
  };
  const prospectSignup = requestedRole === 'prospect' ? normalizeProspectSignupData(data) : null;
  const now = admin.firestore.FieldValue.serverTimestamp();
  const userRef = db.collection('users').doc(uid);
  const roleRef = db.collection('roles').doc(uid);
  const prospectProgressRef = db.collection('prospectProgress').doc(uid);
  let eventIds = [];
  let districtEventIds = [];

  if (requestedRole === 'gbm') {
    const [eventMap, districtEventMap] = await Promise.all([
      buildNaMapFromCollection('events'),
      buildNaMapFromCollection('districtEvents'),
    ]);
    eventIds = Object.keys(eventMap);
    districtEventIds = Object.keys(districtEventMap);
  }

  const result = await db.runTransaction(async (tx) => {
    const [userSnap, roleSnap] = await Promise.all([tx.get(userRef), tx.get(roleRef)]);
    const roleData = roleSnap.exists ? (roleSnap.data() || {}) : null;
    const existingRole = roleData ? normalizeRole(roleData.role) : '';

    if (roleData && ACTIVE_ROLES.has(existingRole) && isApprovedRoleDoc(roleData, existingRole)) {
      const approvedProfile = {
        ...profile,
        ...(existingRole === 'prospect' && prospectSignup ? prospectSignup : {}),
        role: existingRole,
        requestedRole: existingRole === 'president' ? 'admin' : existingRole,
        status: 'approved',
        updatedAt: now,
        approvedAt: roleData.approvedAt || now,
        approvedBy: roleData.approvedBy || 'system',
        rejectedAt: null,
        rejectedBy: null,
        rejectReason: null,
      };
      if (!userSnap.exists) {
        tx.set(userRef, { ...approvedProfile, createdAt: now });
      } else {
        const current = userSnap.data() || {};
        if (String(current.status || '').toLowerCase() !== 'approved') {
          tx.set(userRef, approvedProfile, { merge: true });
        } else {
          tx.set(userRef, {
            name: stripRotaractorPrefix(profile.name || current.name || ''),
            email: profile.email || current.email || '',
            provider: profile.provider || current.provider || '',
            updatedAt: now,
          }, { merge: true });
        }
      }
      return { status: 'approved', role: existingRole, existing: true, shouldNotify: false };
    }

    const userData = userSnap.exists ? (userSnap.data() || {}) : null;
    if (userData && String(userData.status || '').toLowerCase() === 'approved') {
      return {
        status: 'approved',
        role: normalizeRole(userData.role),
        existing: true,
        shouldNotify: false,
      };
    }

    const base = {
      ...profile,
      ...commonSignupData,
      requestedRole,
      updatedAt: now,
      approvedAt: null,
      approvedBy: null,
      rejectedAt: null,
      rejectedBy: null,
      rejectReason: null,
    };

    if (requestedRole === 'prospect') {
      const progressSnap = await tx.get(prospectProgressRef);
      const currentProgress = progressSnap.exists ? (progressSnap.data() || {}) : {};
      const currentCriteria = currentProgress.criteria || {};

      tx.set(userRef, {
        ...base,
        ...prospectSignup,
        role: 'prospect',
        requestedRole: 'prospect',
        memberType: 'prospect',
        signupType: 'prospect',
        clubPosition: 'Prospect',
        status: 'approved',
        approvedAt: now,
        approvedBy: 'system',
        createdAt: userData?.createdAt || now,
      }, { merge: true });
      tx.set(roleRef, {
        role: 'prospect',
        status: 'approved',
        updatedAt: now,
        approvedBy: 'system',
      }, { merge: true });
      tx.set(prospectProgressRef, {
        uid,
        gbmAttended: Math.max(0, Number(currentProgress.gbmAttended) || 0),
        avenueEventsAttended: Math.max(0, Number(currentProgress.avenueEventsAttended) || 0),
        duesPaid: currentProgress.duesPaid === true,
        duesDue: currentProgress.attendanceRequirementMet === true,
        ready: currentProgress.attendanceRequirementMet === true && currentProgress.duesPaid === true,
        whatsappJoined: currentProgress.whatsappJoined === true,
        criteriaVersion: PROSPECT_CRITERIA.criteriaVersion,
        criteria: {
          ...PROSPECT_CRITERIA,
          ...(currentCriteria || {}),
          criteriaVersion: PROSPECT_CRITERIA.criteriaVersion,
          requiredConsecutiveAttendance: PROSPECT_CRITERIA.requiredConsecutiveAttendance,
          duesRequired: currentCriteria.duesRequired !== false,
        },
        currentConsecutiveAttendance: Math.max(0, Number(currentProgress.currentConsecutiveAttendance) || 0),
        maximumConsecutiveAttendance: Math.max(0, Number(currentProgress.maximumConsecutiveAttendance) || 0),
        requiredConsecutiveAttendance: PROSPECT_CRITERIA.requiredConsecutiveAttendance,
        attendanceProgressCount: Math.max(0, Number(currentProgress.attendanceProgressCount) || 0),
        attendanceRequirementMet: currentProgress.attendanceRequirementMet === true,
        qualifyingEventIds: Array.isArray(currentProgress.qualifyingEventIds) ? currentProgress.qualifyingEventIds : [],
        qualifyingEvents: Array.isArray(currentProgress.qualifyingEvents) ? currentProgress.qualifyingEvents : [],
        attendanceRequirementMetAt: currentProgress.attendanceRequirementMetAt || null,
        fourthEligibleActivityId: currentProgress.fourthEligibleActivityId || null,
        fourthEligibleActivityDate: currentProgress.fourthEligibleActivityDate || null,
        completedCount: [currentProgress.attendanceRequirementMet === true, currentProgress.duesPaid === true].filter(Boolean).length,
        totalCount: 2,
        percent: Math.max(0, Math.min(100, Number(currentProgress.percent) || 0)),
        status: currentProgress.attendanceRequirementMet === true && currentProgress.duesPaid === true ? 'ready' : 'in_progress',
        createdAt: currentProgress.createdAt || now,
        updatedAt: now,
      }, { merge: true });
      return {
        status: 'approved',
        role: 'prospect',
        requestedRole: 'prospect',
        existing: false,
        shouldNotify: !userSnap.exists,
      };
    }

    if (requestedRole === 'gbm') {
      const clubPosition = 'Member';
      const memberRef = db.collection('members').doc(uid);
      const attendanceRef = db.collection('attendance').doc(uid);
      const districtAttendanceRef = db.collection('districtAttendance').doc(uid);
      const [memberSnap, attendanceSnap, districtAttendanceSnap] = await Promise.all([
        tx.get(memberRef),
        tx.get(attendanceRef),
        tx.get(districtAttendanceRef),
      ]);

      tx.set(userRef, {
        ...base,
        role: 'gbm',
        clubPosition,
        addToBodAttendance: false,
        status: 'approved',
        approvedAt: now,
        approvedBy: 'system',
        createdAt: userData?.createdAt || now,
      }, { merge: true });
      tx.set(roleRef, {
        role: 'gbm',
        status: 'approved',
        updatedAt: now,
        approvedBy: 'system',
      }, { merge: true });
      setMemberProfileDoc(tx, memberRef, memberSnap, profile, 'gbm', clubPosition, now);
      setDocPreservingExistingAttendance(tx, attendanceRef, attendanceSnap, eventIds, now);
      setDocPreservingExistingAttendance(tx, districtAttendanceRef, districtAttendanceSnap, districtEventIds, now);
      return { status: 'approved', role: 'gbm', existing: false, shouldNotify: !userSnap.exists };
    }

    tx.set(userRef, {
      ...base,
      role: 'pending',
      status: 'pending',
      createdAt: userData?.createdAt || now,
    }, { merge: true });
    return {
      status: 'pending',
      role: 'pending',
      requestedRole,
      existing: false,
      shouldNotify: !userSnap.exists,
    };
  });

  if (result.shouldNotify) {
    const notificationData = {
      uid,
      name: stripRotaractorPrefix(profile.name),
      email: profile.email,
      phone: commonSignupData.phone,
      requestedRole,
      role: result.role,
      signupType: requestedRole === 'prospect' ? 'prospect' : 'internal',
      status: result.status,
      gender: commonSignupData.gender,
      genderSelfDescribe: commonSignupData.genderSelfDescribe,
      ...(prospectSignup || {}),
      createdAt: new Date().toISOString(),
    };

    try {
      await sendSignupNotificationEmail(notificationData);
    } catch (err) {
      console.warn('Signup notification email failed', {
        uid,
        requestedRole,
        message: err?.message || String(err),
      });
    }
  }

  const { shouldNotify, ...signupResult } = result;
  return { ok: true, ...signupResult };
});

exports.approveUserRole = onCall(CALLABLE_OPTIONS, async (request) => {
  const approverUid = requireAuth(request);
  const approverAuthority = await assertAdminOrPresidentAuthority(approverUid);
  const approverRole = approverAuthority.role;

  const data = request.data || {};
  const targetUid = normalizeText(data.targetUid, 128);
  const approvedRole = normalizeRole(data.approvedRole);
  if (!targetUid || !APPROVABLE_ROLES.has(approvedRole)) {
    throw new HttpsError('invalid-argument', 'Valid target user and approved role required.');
  }

  const positionKeysProvided = Object.prototype.hasOwnProperty.call(data, 'positionKeys');
  const syncOptions = {
    actorUid: approverUid,
    actorRole: approverRole,
    actorHasPresidentAuthority: approverAuthority.authority.hasPresidentAuthority,
    targetUid,
    role: approvedRole,
    confirmJointPositionKeys: data.confirmJointPositionKeys || [],
    operationSource: 'accountApproval',
    positionKeysProvided,
  };
  if (positionKeysProvided) {
    syncOptions.positionKeys = data.positionKeys;
  } else if (approvedRole !== 'gbm') {
    syncOptions.legacyClubPosition = data.clubPosition;
  }

  const result = await syncUserAccessAndPositionsWithAttendance(syncOptions);
  return {
    ok: true,
    role: result.role,
    positionKeys: result.positionKeys,
    positionTitles: result.positionTitles,
    avenueCodes: result.avenueCodes,
    addedPositionKeys: result.addedPositionKeys,
    removedPositionKeys: result.removedPositionKeys,
    jointPositionKeys: result.jointPositionKeys,
    bodRosterActive: result.bodRosterActive,
    attendanceSync: result.attendanceSync,
  };
});

exports.updateUserAccessAndPositions = onCall(CALLABLE_OPTIONS, async (request) => {
  const actorUid = requireAuth(request);
  const actorAuthority = await assertAdminOrPresidentAuthority(actorUid);
  const actorRole = actorAuthority.role;

  const data = request.data || {};
  const targetUid = normalizeText(data.targetUid, 128);
  const role = normalizeRole(data.role);
  const operationSource = normalizeText(data.operationSource || 'roleMaintenance', 80);
  if (!targetUid || !APPROVABLE_ROLES.has(role)) {
    throw new HttpsError('invalid-argument', 'Valid target user and role required.');
  }

  const positionKeysProvided = Object.prototype.hasOwnProperty.call(data, 'positionKeys');
  const result = await syncUserAccessAndPositionsWithAttendance({
    actorUid,
    actorRole,
    actorHasPresidentAuthority: actorAuthority.authority.hasPresidentAuthority,
    targetUid,
    role,
    positionKeys: data.positionKeys,
    positionKeysProvided,
    confirmJointPositionKeys: data.confirmJointPositionKeys || [],
    operationSource,
  });

  return {
    ok: true,
    targetUid: result.targetUid,
    role: result.role,
    positionKeys: result.positionKeys,
    positionTitles: result.positionTitles,
    avenueCodes: result.avenueCodes,
    addedPositionKeys: result.addedPositionKeys,
    removedPositionKeys: result.removedPositionKeys,
    jointPositionKeys: result.jointPositionKeys,
    bodRosterActive: result.bodRosterActive,
    attendanceSync: result.attendanceSync,
  };
});

exports.rejectUserRoleRequest = onCall(CALLABLE_OPTIONS, async (request) => {
  const approverUid = requireAuth(request);
  await assertAdminOrPresident(approverUid);

  const data = request.data || {};
  const targetUid = normalizeText(data.targetUid, 128);
  if (!targetUid) throw new HttpsError('invalid-argument', 'Target user required.');

  const rejectReason = normalizeText(data.rejectReason, 500) || null;
  const targetUserRef = db.collection('users').doc(targetUid);
  const targetRoleRef = db.collection('roles').doc(targetUid);
  const now = admin.firestore.FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    const [userSnap, roleSnap] = await Promise.all([
      tx.get(targetUserRef),
      tx.get(targetRoleRef),
    ]);
    if (!userSnap.exists) {
      throw new HttpsError('not-found', 'User profile not found.');
    }

    const roleData = roleSnap.exists ? (roleSnap.data() || {}) : null;
    const activeRole = normalizeRole(roleData?.role);
    if (activeRole === 'president') {
      throw new HttpsError('failed-precondition', 'President role is manual-only.');
    }

    tx.set(targetUserRef, {
      status: 'rejected',
      role: 'pending',
      rejectedAt: now,
      rejectedBy: approverUid,
      rejectReason,
      updatedAt: now,
    }, { merge: true });

    if (roleSnap.exists && activeRole !== 'admin' && activeRole !== 'president') {
      tx.delete(targetRoleRef);
    }
  });

  return { ok: true };
});

exports.updateUserRole = onCall(CALLABLE_OPTIONS, async (request) => {
  const actorUid = requireAuth(request);
  const actorAuthority = await assertAdminOrPresidentAuthority(actorUid);
  const actorRole = actorAuthority.role;

  const data = request.data || {};
  const targetUid = normalizeText(data.targetUid, 128);
  const role = normalizeRole(data.role);
  if (!targetUid || !APPROVABLE_ROLES.has(role)) {
    throw new HttpsError('invalid-argument', 'Valid target user and role required.');
  }

  const positionKeysProvided = Object.prototype.hasOwnProperty.call(data, 'positionKeys');
  const result = await syncUserAccessAndPositionsWithAttendance({
    actorUid,
    actorRole,
    actorHasPresidentAuthority: actorAuthority.authority.hasPresidentAuthority,
    targetUid,
    role,
    positionKeys: data.positionKeys,
    positionKeysProvided,
    confirmJointPositionKeys: data.confirmJointPositionKeys || [],
    operationSource: 'roleMaintenance',
  });

  return {
    ok: true,
    role: result.role,
    positionKeys: result.positionKeys,
    positionTitles: result.positionTitles,
    avenueCodes: result.avenueCodes,
    addedPositionKeys: result.addedPositionKeys,
    removedPositionKeys: result.removedPositionKeys,
    jointPositionKeys: result.jointPositionKeys,
    bodRosterActive: result.bodRosterActive,
    attendanceSync: result.attendanceSync,
  };
});

exports.initializeVisitSubmissionStructure = onCall(CALLABLE_OPTIONS, async (request) => {
  try {
    const uid = requireAuth(request);
    return await visitSubmissions.initializeStructure(uid);
  } catch (err) {
    throwCallableServiceError(err, 'Visit Submission initialization failed.');
  }
});

exports.getVisitSubmissionDashboard = onCall(CALLABLE_OPTIONS, async (request) => {
  try {
    const uid = requireAuth(request);
    return await visitSubmissions.getDashboard(uid);
  } catch (err) {
    throwCallableServiceError(err, 'Visit Submission dashboard request failed.');
  }
});

exports.getVisitSubmissionFolders = onCall(CALLABLE_OPTIONS, async (request) => {
  try {
    const uid = requireAuth(request);
    return await visitSubmissions.getFolders(uid, request.data?.visitType);
  } catch (err) {
    throwCallableServiceError(err, 'Visit Submission folders request failed.');
  }
});

exports.getVisitSubmissionFolder = onCall(CALLABLE_OPTIONS, async (request) => {
  try {
    const uid = requireAuth(request);
    return await visitSubmissions.getFolder(
      uid,
      request.data?.visitType,
      request.data?.positionKey
    );
  } catch (err) {
    throwCallableServiceError(err, 'Visit Submission folder request failed.');
  }
});

exports.updateVisitSubmissionConfig = onCall(CALLABLE_OPTIONS, async (request) => {
  try {
    const uid = requireAuth(request);
    return await visitSubmissions.updateConfig(uid, request.data || {});
  } catch (err) {
    throwCallableServiceError(err, 'Visit Submission configuration update failed.');
  }
});

exports.updateVisitSubmissionFolder = onCall(CALLABLE_OPTIONS, async (request) => {
  try {
    const uid = requireAuth(request);
    return await visitSubmissions.updateFolder(uid, request.data || {});
  } catch (err) {
    throwCallableServiceError(err, 'Visit Submission folder update failed.');
  }
});

exports.createVisitSubmissionUploadSession = onCall(CALLABLE_OPTIONS, async (request) => {
  try {
    const uid = requireAuth(request);
    return await visitSubmissions.createUploadSession(uid, request.data || {});
  } catch (err) {
    throwCallableServiceError(err, 'Visit Submission upload session creation failed.');
  }
});

exports.finalizeVisitSubmissionUpload = onCall(CALLABLE_OPTIONS, async (request) => {
  try {
    const uid = requireAuth(request);
    return await visitSubmissions.finalizeUpload(uid, request.data || {});
  } catch (err) {
    throwCallableServiceError(err, 'Visit Submission upload finalization failed.');
  }
});

exports.withdrawVisitSubmission = onCall(CALLABLE_OPTIONS, async (request) => {
  try {
    const uid = requireAuth(request);
    return await visitSubmissions.withdrawSubmission(uid, request.data || {});
  } catch (err) {
    throwCallableServiceError(err, 'Visit Submission withdrawal failed.');
  }
});

exports.removeVisitSubmission = onCall(CALLABLE_OPTIONS, async (request) => {
  try {
    const uid = requireAuth(request);
    return await visitSubmissions.removeSubmission(uid, request.data || {});
  } catch (err) {
    throwCallableServiceError(err, 'Visit Submission removal failed.');
  }
});

exports.replaceVisitSubmission = onCall(CALLABLE_OPTIONS, async (request) => {
  try {
    const uid = requireAuth(request);
    return await visitSubmissions.replaceSubmission(uid, request.data || {});
  } catch (err) {
    throwCallableServiceError(err, 'Visit Submission replacement failed.');
  }
});

exports.reconcileVisitSubmissionFolderCount = onCall(CALLABLE_OPTIONS, async (request) => {
  try {
    const uid = requireAuth(request);
    return await visitSubmissions.reconcileFolderCount(uid, request.data || {});
  } catch (err) {
    throwCallableServiceError(err, 'Visit Submission count reconciliation failed.');
  }
});

exports.getVisitSubmissionModerationData = onCall(CALLABLE_OPTIONS, async (request) => {
  try {
    const uid = requireAuth(request);
    return await visitSubmissions.getModerationData(uid, request.data || {});
  } catch (err) {
    throwCallableServiceError(err, 'Visit Submission moderation request failed.');
  }
});

exports.cleanupExpiredVisitUploadSessions = onCall(CALLABLE_OPTIONS, async (request) => {
  try {
    const uid = requireAuth(request);
    return await visitSubmissions.cleanupExpiredUploadSessions(uid, request.data || {});
  } catch (err) {
    throwCallableServiceError(err, 'Visit Submission upload session cleanup failed.');
  }
});

exports.cancelVisitSubmissionUploadSession = onCall(CALLABLE_OPTIONS, async (request) => {
  try {
    const uid = requireAuth(request);
    return await visitSubmissions.cancelUploadSession(uid, request.data || {});
  } catch (err) {
    throwCallableServiceError(err, 'Visit Submission upload session cancellation failed.');
  }
});

exports.uploadVisitSubmissionFile = onRequest({
  region: 'us-central1',
  timeoutSeconds: 120,
  memory: '512MiB',
  maxInstances: 5,
  concurrency: 10,
  secrets: [
    VISIT_DRIVE_CLIENT_ID,
    VISIT_DRIVE_CLIENT_SECRET,
    VISIT_DRIVE_REFRESH_TOKEN,
  ],
}, uploadVisitSubmissionFileHandler);

exports.getMyAccess = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const [userSnap, roleSnap, cwdAssignmentSnap, presidentAssignmentSnap] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.collection('roles').doc(uid).get(),
    db.collection('bodPositionAssignments').doc(`${positionHelpers.WEBSITE_DIRECTOR_POSITION_KEY}_${uid}`).get(),
    db.collection('bodPositionAssignments').doc(`president_${uid}`).get(),
  ]);
  const roleData = roleSnap.exists ? (roleSnap.data() || {}) : null;
  const role = roleData && String(roleData.status || 'approved').toLowerCase() === 'approved'
    ? normalizeRole(roleData.role)
    : '';
  const activeRole = role && ACTIVE_ROLES.has(role) ? { role, data: roleData } : null;
  const authorityContext = await getAuthorityContext(uid, {
    activeRole,
    userSnap,
    cwdAssignmentSnap,
    presidentAssignmentSnap,
  });
  const resolutionManager = await hasResolutionManagerAuthority(uid, { activeRole, userSnap });

  return {
    ok: true,
    uid,
    user: userSnap.exists ? userSnap.data() : null,
    role: roleSnap.exists ? roleSnap.data() : null,
    positionKeys: authorityContext.positionKeys,
    positionSource: authorityContext.positionSource,
    authority: authorityContext.authority,
    resolutionManager,
  };
});

exports.getProspectManagementData = onCall(CALLABLE_OPTIONS, async (request) => {
  const actorUid = requireAuth(request);
  await assertAdminOrPresident(actorUid);

  const eventsSnap = await db.collection('events').get();
  const initial = await loadProspectUserAndProgressMaps();
  const activeProspectUsers = Array.from(initial.usersByUid.values())
    .filter(user => isActiveProspectRecord(user) && !isPromotedProspectRecord(user, initial.progressByUid.get(user.id) || {}));
  await Promise.all(activeProspectUsers.map(user => recalcProspectProgress(user.id, { eventsSnap, user })));

  const { usersByUid } = await loadProspectUserAndProgressMaps();
  const refreshedProgressSnap = await db.collection('prospectProgress').get();
  const progressDocs = refreshedProgressSnap.docs;
  const missingUserUids = progressDocs
    .map(doc => doc.id)
    .filter(uid => !usersByUid.has(uid));
  const missingUserSnaps = await Promise.all(
    missingUserUids.map(uid => db.collection('users').doc(uid).get())
  );
  missingUserSnaps.forEach(snap => {
    if (snap.exists) usersByUid.set(snap.id, { id: snap.id, ...(snap.data() || {}) });
  });

  const progressByUid = new Map(progressDocs.map(doc => [doc.id, doc.data() || {}]));
  const prospects = Array.from(new Set([...usersByUid.keys(), ...progressByUid.keys()]))
    .map(uid => {
      const user = usersByUid.get(uid) || { id: uid };
      const progress = progressByUid.get(uid) || {};
      const promoted = String(progress.status || '').toLowerCase() === 'promoted'
        || user.promotedFromProspect === true;
      const activeProspect = isActiveProspectRecord(user);
      if (!activeProspect && !promoted) return null;

      const gbmAttended = Math.max(0, Number(progress.gbmAttended) || 0);
      const avenueEventsAttended = Math.max(0, Number(progress.avenueEventsAttended) || 0);
      const duesPaid = progress.duesPaid === true;
      const attendanceRequirementMet = progress.attendanceRequirementMet === true;
      const duesDue = progress.duesDue === true || attendanceRequirementMet;
      const ready = attendanceRequirementMet === true && duesPaid === true;
      const status = promoted ? 'promoted' : (ready ? 'ready' : 'in_progress');
      const requiredConsecutiveAttendance = Math.max(
        1,
        Number(progress.requiredConsecutiveAttendance || progress.criteria?.requiredConsecutiveAttendance)
          || PROSPECT_CRITERIA.requiredConsecutiveAttendance
      );
      const currentConsecutiveAttendance = Math.max(0, Number(progress.currentConsecutiveAttendance) || 0);
      const maximumConsecutiveAttendance = Math.max(0, Number(progress.maximumConsecutiveAttendance) || 0);
      const attendanceProgressCount = attendanceRequirementMet
        ? requiredConsecutiveAttendance
        : Math.min(currentConsecutiveAttendance, requiredConsecutiveAttendance);
      const percent = Math.max(0, Math.min(100, Number(progress.percent) || Math.round((attendanceProgressCount / requiredConsecutiveAttendance) * 100)));
      return {
        uid,
        name: stripRotaractorPrefix(normalizeText(user.name || user.email || uid, 160)),
        email: normalizeEmail(user.email || ''),
        phone: normalizeText(user.phone, 40),
        hobbies: normalizeText(user.hobbies, 600),
        joinReason: normalizeText(user.joinReason, 1200),
        referredBy: normalizeText(user.referredBy || 'N/A', 160),
        previousRotaractDetails: normalizeText(user.previousRotaractDetails || 'N/A', 1200),
        role: normalizeRole(user.role),
        memberType: normalizeRole(user.memberType),
        status,
        gbmAttended,
        avenueEventsAttended,
        duesPaid,
        duesDue,
        whatsappJoined: progress.whatsappJoined === true,
        criteriaVersion: Number(progress.criteriaVersion) || PROSPECT_CRITERIA.criteriaVersion,
        criteria: {
          ...PROSPECT_CRITERIA,
          ...(progress.criteria || {}),
          criteriaVersion: PROSPECT_CRITERIA.criteriaVersion,
          requiredConsecutiveAttendance,
        },
        currentConsecutiveAttendance,
        maximumConsecutiveAttendance,
        requiredConsecutiveAttendance,
        attendanceProgressCount,
        attendanceRequirementMet,
        qualifyingEventIds: Array.isArray(progress.qualifyingEventIds) ? progress.qualifyingEventIds : [],
        qualifyingEvents: Array.isArray(progress.qualifyingEvents) ? progress.qualifyingEvents : [],
        attendanceRequirementMetAt: progress.attendanceRequirementMetAt || null,
        fourthEligibleActivityId: progress.fourthEligibleActivityId || null,
        fourthEligibleActivityDate: progress.fourthEligibleActivityDate || null,
        completedCount: Math.max(0, Number(progress.completedCount) || [attendanceRequirementMet, duesPaid].filter(Boolean).length),
        totalCount: Math.max(1, Number(progress.totalCount) || 2),
        percent,
        ready: !promoted && ready,
        promotedAt: progress.promotedAt || user.promotedAt || null,
        createdAt: user.createdAt || progress.createdAt || null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    ok: true,
    prospects,
    summary: {
      total: prospects.length,
      active: prospects.filter(item => item.status !== 'promoted').length,
      ready: prospects.filter(item => item.ready).length,
      promoted: prospects.filter(item => item.status === 'promoted').length,
      attendanceComplete: prospects.filter(item => item.status !== 'promoted' && item.attendanceRequirementMet).length,
      duesPending: prospects.filter(item => item.status !== 'promoted' && item.duesDue && !item.duesPaid).length,
      duesNotYetDue: prospects.filter(item => item.status !== 'promoted' && !item.duesDue && !item.duesPaid).length,
    },
  };
});

exports.recalculateAllProspectProgress = onCall(CALLABLE_OPTIONS, async (request) => {
  const actorUid = requireAuth(request);
  await assertAdminOrPresident(actorUid);
  const summary = await recalcAllActiveProspects();
  return { ok: true, summary };
});

exports.updateProspectDues = onCall(CALLABLE_OPTIONS, async (request) => {
  const actorUid = requireAuth(request);
  await assertAdminOrPresident(actorUid);
  const uid = normalizeText(request.data?.uid, 128);
  const duesPaid = request.data?.duesPaid;
  if (!uid || typeof duesPaid !== 'boolean') {
    throw new HttpsError('invalid-argument', 'Prospect uid and duesPaid boolean are required.');
  }

  const userSnap = await db.collection('users').doc(uid).get();
  const user = userSnap.exists ? (userSnap.data() || {}) : null;
  if (!user || !isActiveProspectRecord(user)) {
    throw new HttpsError('failed-precondition', 'Active prospect account required.');
  }

  await db.collection('prospectProgress').doc(uid).set({
    uid,
    duesPaid,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  const progress = await recalcProspectProgress(uid, { user });
  return { ok: true, uid, progress };
});

exports.recalculateProspectProgress = onCall(CALLABLE_OPTIONS, async (request) => {
  const actorUid = requireAuth(request);
  await assertAdminOrPresident(actorUid);
  const uid = normalizeText(request.data?.uid, 128);
  if (!uid) throw new HttpsError('invalid-argument', 'Prospect uid is required.');

  const userSnap = await db.collection('users').doc(uid).get();
  const user = userSnap.exists ? (userSnap.data() || {}) : null;
  if (!user || !isActiveProspectRecord(user)) {
    throw new HttpsError('failed-precondition', 'Active prospect account required.');
  }
  const progress = await recalcProspectProgress(uid, { user });
  return { ok: true, uid, progress };
});

exports.promoteProspectToGbm = onCall(CALLABLE_OPTIONS, async (request) => {
  const actorUid = requireAuth(request);
  await assertAdminOrPresident(actorUid);
  const uid = normalizeText(request.data?.uid, 128);
  if (!uid) throw new HttpsError('invalid-argument', 'Prospect uid is required.');

  const initialUserSnap = await db.collection('users').doc(uid).get();
  const initialProgressSnap = await db.collection('prospectProgress').doc(uid).get();
  const initialUser = initialUserSnap.exists ? (initialUserSnap.data() || {}) : null;
  const initialProgress = initialProgressSnap.exists ? (initialProgressSnap.data() || {}) : {};
  if (initialUser && isPromotedProspectRecord(initialUser, initialProgress)) {
    return { ok: true, uid, role: normalizeRole(initialUser.role) || 'gbm', status: 'promoted', alreadyPromoted: true };
  }
  if (!initialUser || !isActiveProspectRecord(initialUser)) {
    throw new HttpsError('failed-precondition', 'Active prospect account required.');
  }

  const recalculated = await recalcProspectProgress(uid, { user: initialUser });
  if (!(recalculated.attendanceRequirementMet === true && recalculated.duesPaid === true && recalculated.ready === true)) {
    throw new HttpsError('failed-precondition', 'Prospect has not completed the attendance requirement and dues payment.');
  }

  const [eventMap, districtEventMap] = await Promise.all([
    buildNaMapFromCollection('events'),
    buildNaMapFromCollection('districtEvents'),
  ]);
  const eventIds = Object.keys(eventMap);
  const districtEventIds = Object.keys(districtEventMap);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const userRef = db.collection('users').doc(uid);
  const roleRef = db.collection('roles').doc(uid);
  const progressRef = db.collection('prospectProgress').doc(uid);
  const memberRef = db.collection('members').doc(uid);
  const attendanceRef = db.collection('attendance').doc(uid);
  const districtAttendanceRef = db.collection('districtAttendance').doc(uid);

  await db.runTransaction(async tx => {
    const [userSnap, roleSnap, progressSnap, memberSnap, attendanceSnap, districtAttendanceSnap] = await Promise.all([
      tx.get(userRef),
      tx.get(roleRef),
      tx.get(progressRef),
      tx.get(memberRef),
      tx.get(attendanceRef),
      tx.get(districtAttendanceRef),
    ]);
    const user = userSnap.exists ? (userSnap.data() || {}) : null;
    const role = roleSnap.exists ? (roleSnap.data() || {}) : null;
    const progress = progressSnap.exists ? (progressSnap.data() || {}) : {};
    const activeProspect = user
      && isActiveProspectRecord(user)
      && (!role || normalizeRole(role.role) === 'prospect');
    if (!activeProspect) {
      throw new HttpsError('failed-precondition', 'Active prospect account required.');
    }

    const attendanceRequirementMet = progress.attendanceRequirementMet === true;
    const duesPaid = progress.duesPaid === true;
    const ready = progress.ready === true;
    if (!(attendanceRequirementMet && duesPaid && ready)) {
      throw new HttpsError('failed-precondition', 'Prospect has not completed the attendance requirement and dues payment.');
    }

    const profile = {
      uid,
      name: stripRotaractorPrefix(normalizeText(user.name || user.email || uid, 120)),
      email: normalizeEmail(user.email || ''),
    };
    tx.set(userRef, {
      role: 'gbm',
      requestedRole: 'gbm',
      status: 'approved',
      memberType: 'member',
      clubPosition: 'Member',
      addToBodAttendance: false,
      promotedFromProspect: true,
      promotedAt: now,
      promotedBy: actorUid,
      approvedAt: now,
      approvedBy: actorUid,
      updatedAt: now,
    }, { merge: true });
    tx.set(roleRef, {
      role: 'gbm',
      status: 'approved',
      approvedBy: actorUid,
      updatedAt: now,
    }, { merge: true });
    setMemberProfileDoc(tx, memberRef, memberSnap, profile, 'gbm', 'Member', now);
    setDocPreservingExistingAttendance(tx, attendanceRef, attendanceSnap, eventIds, now);
    setDocPreservingExistingAttendance(tx, districtAttendanceRef, districtAttendanceSnap, districtEventIds, now);
    tx.set(progressRef, {
      status: 'promoted',
      ready: true,
      attendanceRequirementMet,
      duesPaid,
      duesDue: true,
      completedCount: Math.max(0, Number(progress.completedCount) || 2),
      totalCount: Math.max(1, Number(progress.totalCount) || 2),
      percent: 100,
      promotedAt: now,
      promotedBy: actorUid,
      updatedAt: now,
    }, { merge: true });
  });

  return { ok: true, uid, role: 'gbm', status: 'promoted' };
});

exports.updateClubRanking = onCall(CALLABLE_OPTIONS, async (request) => {
  const actorUid = requireAuth(request);
  await assertAdminOrPresidentAuthority(actorUid);
  await assertApprovedActiveCallableAccount(actorUid);

  const clubRanking = normalizeClubRanking(request.data || {}, { strict: true });
  const now = admin.firestore.FieldValue.serverTimestamp();
  await db
    .collection(CLUB_SETTINGS_COLLECTION)
    .doc(PUBLIC_DASHBOARD_SETTINGS_DOC)
    .set({
      clubRanking: {
        ...clubRanking,
        updatedAt: now,
        updatedBy: actorUid,
      },
    }, { merge: true });

  return {
    success: true,
    clubRanking,
  };
});

exports.getAnnouncementRecipientOptions = onCall(CALLABLE_OPTIONS, async (request) => {
  const actorUid = requireAuth(request);
  await assertAdminOrPresidentAuthority(actorUid);
  await assertApprovedActiveCallableAccount(actorUid);

  const recipients = sortAnnouncementRecipientsForDirectory(
    await getAllEligibleAnnouncementRecipients()
  );

  return {
    success: true,
    recipients: recipients.map(recipient => ({
      uid: recipient.uid,
      name: recipient.name,
      email: recipient.email,
      role: recipient.role,
    })),
  };
});

exports.getAnnouncementHistory = onCall(CALLABLE_OPTIONS, async (request) => {
  const actorUid = requireAuth(request);
  await assertAdminOrPresidentAuthority(actorUid);
  await assertApprovedActiveCallableAccount(actorUid);

  const { limit, cursor } = normalizeAnnouncementHistoryRequest(request.data || {});
  let query = db
    .collection(ANNOUNCEMENTS_COLLECTION)
    .orderBy('createdAt', 'desc')
    .limit(limit + 1);

  if (cursor) {
    const cursorSnap = await db.collection(ANNOUNCEMENTS_COLLECTION).doc(cursor).get();
    if (!cursorSnap.exists) {
      throw new HttpsError('invalid-argument', 'History cursor was not found.');
    }
    query = db
      .collection(ANNOUNCEMENTS_COLLECTION)
      .orderBy('createdAt', 'desc')
      .startAfter(cursorSnap)
      .limit(limit + 1);
  }

  const snap = await query.get();
  const pageDocs = snap.docs.slice(0, limit);
  const announcementIds = pageDocs
    .map(doc => doc.id)
    .filter(id => {
      try {
        validateAnnouncementDocId(id, 'announcementId');
        return true;
      } catch {
        return false;
      }
    });
  const summaries = await getAnnouncementDashboardSummaries(announcementIds);
  const announcements = [];

  pageDocs.forEach(doc => {
    const item = normalizeAnnouncementHistoryItem(
      doc.id,
      doc.data() || {},
      summaries.get(doc.id) || {}
    );
    if (item) announcements.push(item);
  });

  return {
    success: true,
    announcements,
    nextCursor: snap.docs.length > limit && pageDocs.length
      ? pageDocs[pageDocs.length - 1].id
      : null,
  };
});

exports.publishAnnouncement = onCall(CALLABLE_OPTIONS, async (request) => {
  const actorUid = requireAuth(request);
  await assertAdminOrPresidentAuthority(actorUid);
  await assertApprovedActiveCallableAccount(actorUid);

  const announcement = normalizeAnnouncementPayload(request.data || {});
  const announcementRef = db.collection(ANNOUNCEMENTS_COLLECTION).doc();
  const announcementId = announcementRef.id;
  const timestamp = admin.firestore.FieldValue.serverTimestamp();

  await announcementRef.set({
    title: announcement.title,
    body: announcement.body,
    priority: announcement.priority,
    actionText: announcement.actionText,
    actionUrl: announcement.actionUrl,
    targetRoles: announcement.targetRoles,
    targetUserIds: announcement.targetUserIds,
    status: 'publishing',
    recipientCount: 0,
    publishedAt: timestamp,
    expiresAt: announcement.expiresAt,
    createdBy: actorUid,
    createdAt: timestamp,
    updatedAt: timestamp,
    emailRequested: announcement.emailRequested,
    emailSummary: { ...ANNOUNCEMENT_EMAIL_SUMMARY_DEFAULT },
  });

  try {
    const recipients = await resolveAnnouncementRecipients({
      targetRoles: announcement.targetRoles,
      targetUserIds: announcement.targetUserIds,
    });

    if (!recipients.length) {
      await announcementRef.set({
        status: 'failed',
        failureReason: 'no_eligible_recipients',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      throw new HttpsError('failed-precondition', 'No eligible announcement recipients found.');
    }

    await writeAnnouncementDeliveries({
      announcementId,
      announcement,
      recipients,
      timestamp,
    });

    await announcementRef.set({
      status: 'published',
      recipientCount: recipients.length,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    let emailSummary = { ...ANNOUNCEMENT_EMAIL_SUMMARY_DEFAULT };
    if (announcement.emailRequested) {
      try {
        emailSummary = await sendAnnouncementEmails({
          announcementId,
          announcement,
          recipients,
        });
      } catch (emailErr) {
        console.warn('Announcement email processing failed after dashboard publish', {
          announcementId,
          recipientCount: recipients.length,
          message: emailErr?.message || String(emailErr),
        });
        emailSummary = {
          attempted: recipients.length,
          sent: 0,
          failed: recipients.length,
        };
        await tryMarkAnnouncementEmailFailures(announcementId, recipients, 'smtp_failed', { pendingOnly: true });
      }
      await announcementRef.set({
        emailRequested: true,
        emailSummary,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true }).catch(summaryErr => {
        console.warn('Could not update announcement email summary', announcementId, summaryErr?.message || String(summaryErr));
      });
    }

    return {
      success: true,
      announcementId,
      recipientCount: recipients.length,
      announcement: {
        title: announcement.title,
        body: announcement.body,
        priority: announcement.priority,
        actionText: announcement.actionText,
        actionUrl: announcement.actionUrl,
        targetRoles: announcement.targetRoles,
        targetUserIds: announcement.targetUserIds,
        status: 'published',
        emailRequested: announcement.emailRequested,
      },
      emailSummary,
    };
  } catch (err) {
    if (!(err instanceof HttpsError && err.code === 'failed-precondition')) {
      await announcementRef.set({
        status: 'failed',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true }).catch(markErr => {
        console.warn('Could not mark announcement publish failure', announcementId, markErr?.message || String(markErr));
      });
    }
    throwCallableServiceError(err, 'Could not publish announcement.');
  }
});

exports.markAnnouncementRead = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const announcementId = validateAnnouncementDocId(request.data?.announcementId, 'announcementId');
  const deliveryRef = db
    .collection(ANNOUNCEMENT_DELIVERIES_COLLECTION)
    .doc(announcementDeliveryId(announcementId, uid));

  await db.runTransaction(async tx => {
    const snap = await tx.get(deliveryRef);
    if (!snap.exists || snap.data()?.uid !== uid) {
      throw new HttpsError('not-found', 'Announcement delivery not found.');
    }
    const data = snap.data() || {};
    if (data.dashboardStatus === 'dismissed') return;
    if (data.dashboardStatus === 'read' && data.readAt) return;

    tx.set(deliveryRef, {
      dashboardStatus: 'read',
      readAt: data.readAt || admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  return { success: true };
});

exports.markAnnouncementUnread = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const announcementId = validateAnnouncementDocId(request.data?.announcementId, 'announcementId');
  const deliveryRef = db
    .collection(ANNOUNCEMENT_DELIVERIES_COLLECTION)
    .doc(announcementDeliveryId(announcementId, uid));

  await db.runTransaction(async tx => {
    const snap = await tx.get(deliveryRef);
    if (!snap.exists || snap.data()?.uid !== uid) {
      throw new HttpsError('not-found', 'Announcement delivery not found.');
    }
    const data = snap.data() || {};
    if (data.dashboardStatus === 'dismissed') return;
    if (data.dashboardStatus === 'unread' && !data.readAt) return;

    tx.set(deliveryRef, {
      dashboardStatus: 'unread',
      readAt: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  return { success: true };
});

exports.dismissAnnouncement = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const announcementId = validateAnnouncementDocId(request.data?.announcementId, 'announcementId');
  const deliveryRef = db
    .collection(ANNOUNCEMENT_DELIVERIES_COLLECTION)
    .doc(announcementDeliveryId(announcementId, uid));

  await db.runTransaction(async tx => {
    const snap = await tx.get(deliveryRef);
    if (!snap.exists || snap.data()?.uid !== uid) {
      throw new HttpsError('not-found', 'Announcement delivery not found.');
    }
    const data = snap.data() || {};
    if (data.dashboardStatus === 'dismissed') return;

    const update = {
      dashboardStatus: 'dismissed',
      dismissedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (!data.readAt) {
      update.readAt = admin.firestore.FieldValue.serverTimestamp();
    }
    tx.set(deliveryRef, update, { merge: true });
  });

  return { success: true };
});

async function prepareResolutionDraftInput(raw) {
  const validation = resolutionModel.validateDraftInput(raw || {});
  if (!validation.ok) throw new HttpsError('invalid-argument', validation.errors[0], { errors: validation.errors });
  const payload = validation.payload;
  assertFirestoreSafeResolutionSections(payload.pdfSections, 'pdfSections');
  const [meetingSnap, voters] = await Promise.all([
    db.collection('bodMeetings').doc(payload.meetingId).get(),
    loadActiveResolutionVoters(),
  ]);
  if (!meetingSnap.exists || meetingSnap.data()?.archived === true) {
    throw new HttpsError('not-found', 'Linked BOD meeting not found.');
  }
  if (!voters.length) throw new HttpsError('failed-precondition', 'No UID-linked active BOD voters are available.');
  validateResolutionCustomCount(payload, voters.length);
  const voterByUid = new Map(voters.map(voter => [voter.uid, voter]));
  const proposer = voterByUid.get(payload.proposedByUid);
  const seconder = voterByUid.get(payload.secondedByUid);
  if (!proposer || !seconder) throw new HttpsError('failed-precondition', 'Proposer and seconder must be active UID-linked BOD members.');
  const meeting = meetingSnap.data() || {};
  if (!normalizeText(meeting.name, 220) || !/^\d{4}-\d{2}-\d{2}$/.test(String(meeting.date || ''))) {
    throw new HttpsError('failed-precondition', 'Linked BOD meeting is incomplete.');
  }
  return {
    payload,
    meeting: { id: meetingSnap.id, title: normalizeText(meeting.name, 220), date: String(meeting.date) },
    proposer,
    seconder,
  };
}

function assertFirestoreSafeResolutionSections(value, path) {
  try {
    resolutionModel.assertNoNestedArrays(value, path);
  } catch (error) {
    throw new HttpsError('invalid-argument', error.message);
  }
}

exports.createResolutionDraft = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const actor = await getResolutionManagerContext(uid);
  const prepared = await prepareResolutionDraftInput(request.data || {});
  const resolutionRef = db.collection(RESOLUTIONS_COLLECTION).doc();
  const numberRef = db.collection(RESOLUTION_NUMBER_INDEX_COLLECTION).doc(resolutionNumberIndexId(prepared.payload.resolutionNumber));
  const now = resolutionTimestamp();
  await db.runTransaction(async tx => {
    const numberSnap = await tx.get(numberRef);
    if (numberSnap.exists) throw new HttpsError('already-exists', 'Resolution number already exists.');
    tx.set(resolutionRef, {
      ...prepared.payload,
      meetingTitle: prepared.meeting.title,
      meetingDate: prepared.meeting.date,
      proposedByName: prepared.proposer.name,
      proposedByPosition: prepared.proposer.position,
      secondedByName: prepared.seconder.name,
      secondedByPosition: prepared.seconder.position,
      status: 'draft',
      eligibleVoters: [],
      eligibleVoterUids: [],
      openedAt: null,
      openedByUid: null,
      openedByName: null,
      openedByPosition: null,
      closedAt: null,
      closedByUid: null,
      closedByName: null,
      closedByPosition: null,
      result: null,
      approveCount: 0,
      rejectCount: 0,
      abstainCount: 0,
      votesReceivedCount: 0,
      createdAt: now,
      createdByUid: actor.uid,
      createdByName: actor.name,
      updatedAt: now,
    });
    tx.set(numberRef, { resolutionId: resolutionRef.id, resolutionNumber: prepared.payload.resolutionNumber, createdAt: now });
    setResolutionAudit(tx, resolutionRef, 'resolution_created', actor, now, { newValue: { status: 'draft' } });
  });
  return { ok: true, resolutionId: resolutionRef.id };
});

exports.updateResolutionDraft = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const actor = await getResolutionManagerContext(uid);
  const resolutionId = validateAnnouncementDocId(request.data?.resolutionId, 'resolutionId');
  const prepared = await prepareResolutionDraftInput(request.data || {});
  const resolutionRef = db.collection(RESOLUTIONS_COLLECTION).doc(resolutionId);
  const now = resolutionTimestamp();
  await db.runTransaction(async tx => {
    const snap = await tx.get(resolutionRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Resolution not found.');
    const existing = snap.data() || {};
    if (existing.status !== 'draft') throw new HttpsError('failed-precondition', 'Only draft resolutions may be edited.');
    if (resolutionUploads.sourceMode(existing) === 'uploadedPdf'
      && prepared.payload.documentSourceMode !== 'uploadedPdf'
      && existing.uploadedSource?.status === 'ready') {
      throw new HttpsError('failed-precondition', 'Remove the uploaded source PDF before changing the document source.');
    }
    const oldNumberRef = db.collection(RESOLUTION_NUMBER_INDEX_COLLECTION).doc(resolutionNumberIndexId(existing.resolutionNumber));
    const newNumberRef = db.collection(RESOLUTION_NUMBER_INDEX_COLLECTION).doc(resolutionNumberIndexId(prepared.payload.resolutionNumber));
    const numberChanged = oldNumberRef.id !== newNumberRef.id;
    if (numberChanged) {
      const newNumberSnap = await tx.get(newNumberRef);
      if (newNumberSnap.exists && newNumberSnap.data()?.resolutionId !== resolutionId) {
        throw new HttpsError('already-exists', 'Resolution number already exists.');
      }
      tx.delete(oldNumberRef);
      tx.set(newNumberRef, { resolutionId, resolutionNumber: prepared.payload.resolutionNumber, createdAt: existing.createdAt || now, updatedAt: now });
    }
    tx.update(resolutionRef, {
      ...prepared.payload,
      meetingTitle: prepared.meeting.title,
      meetingDate: prepared.meeting.date,
      proposedByName: prepared.proposer.name,
      proposedByPosition: prepared.proposer.position,
      secondedByName: prepared.seconder.name,
      secondedByPosition: prepared.seconder.position,
      updatedAt: now,
    });
    setResolutionAudit(tx, resolutionRef, 'draft_edited', actor, now, {
      previousValue: { resolutionNumber: existing.resolutionNumber, title: existing.title, meetingId: existing.meetingId },
      newValue: { resolutionNumber: prepared.payload.resolutionNumber, title: prepared.payload.title, meetingId: prepared.payload.meetingId },
    });
  });
  return { ok: true, resolutionId };
});

exports.updateResolutionPdfLayout = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const actor = await getResolutionManagerContext(uid);
  const resolutionId = validateAnnouncementDocId(request.data?.resolutionId, 'resolutionId');
  const validation = resolutionModel.validatePdfLayout(request.data || {});
  if (!validation.ok) throw new HttpsError('invalid-argument', validation.errors[0], { errors: validation.errors });
  assertFirestoreSafeResolutionSections(validation.payload.pdfSections, 'pdfSections');
  const resolutionRef = db.collection(RESOLUTIONS_COLLECTION).doc(resolutionId);
  const now = resolutionTimestamp();
  await db.runTransaction(async tx => {
    const snap = await tx.get(resolutionRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Resolution not found.');
    const existing = snap.data() || {};
    if (!['draft', 'open'].includes(existing.status)) throw new HttpsError('failed-precondition', 'Only draft or open resolution layouts may be edited.');
    if (existing.status === 'draft'
      && resolutionUploads.sourceMode(existing) === 'uploadedPdf'
      && validation.payload.documentSourceMode !== 'uploadedPdf'
      && existing.uploadedSource?.status === 'ready') {
      throw new HttpsError('failed-precondition', 'Remove the uploaded source PDF before changing the document source.');
    }
    if (existing.status === 'open' && resolutionUploads.sourceMode(existing) !== validation.payload.documentSourceMode) {
      throw new HttpsError('failed-precondition', 'The Resolution PDF source cannot change after voting opens.');
    }
    tx.update(resolutionRef, { ...validation.payload, updatedAt: now });
    setResolutionAudit(tx, resolutionRef, 'pdf_layout_edited', actor, now, {
      previousValue: { pdfLayoutMode: existing.pdfLayoutMode === 'custom' ? 'custom' : 'standard' },
      newValue: { pdfLayoutMode: validation.payload.pdfLayoutMode, sectionCount: validation.payload.pdfSections.length },
    });
  });
  return { ok: true, resolutionId };
});

exports.openResolutionVoting = onCall(RESOLUTION_PDF_CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const actor = await getResolutionManagerContext(uid);
  const resolutionId = validateAnnouncementDocId(request.data?.resolutionId, 'resolutionId');
  const [voters, meetingCheck] = await Promise.all([
    loadActiveResolutionVoters(),
    db.collection(RESOLUTIONS_COLLECTION).doc(resolutionId).get(),
  ]);
  if (!meetingCheck.exists) throw new HttpsError('not-found', 'Resolution not found.');
  const before = meetingCheck.data() || {};
  if (resolutionUploads.sourceMode(before) === 'uploadedPdf') {
    if (before.uploadedSource?.status !== 'ready') throw new HttpsError('failed-precondition', 'A ready uploaded PDF is required before voting can open.');
    if (!before.uploadedVotesTableConfig || typeof before.uploadedVotesTableConfig !== 'object') throw new HttpsError('failed-precondition', 'A valid uploaded PDF Votes Table configuration is required.');
    resolutionModel.normalizeUploadedVotesTableConfig(before.uploadedVotesTableConfig);
    await resolutionUploads.assertSourceObject(before.uploadedSource, resolutionId).catch(error => {
      throw new HttpsError('failed-precondition', error.message || 'The uploaded PDF is unavailable.');
    });
  }
  const linkedMeeting = await db.collection('bodMeetings').doc(String(before.meetingId || '')).get();
  if (!linkedMeeting.exists || linkedMeeting.data()?.archived === true) throw new HttpsError('failed-precondition', 'Linked BOD meeting is unavailable.');
  if (!voters.length) throw new HttpsError('failed-precondition', 'No UID-linked active BOD voters are available.');
  validateResolutionCustomCount(before, voters.length);
  const resolutionRef = meetingCheck.ref;
  const now = resolutionTimestamp();
  await db.runTransaction(async tx => {
    const snap = await tx.get(resolutionRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Resolution not found.');
    const data = snap.data() || {};
    if (data.status !== 'draft') throw new HttpsError('failed-precondition', 'Only a draft resolution may be opened.');
    tx.update(resolutionRef, {
      status: 'open',
      eligibleVoters: voters.map(voter => ({ uid: voter.uid, name: voter.name, position: voter.position })),
      eligibleVoterUids: voters.map(voter => voter.uid),
      openedAt: now,
      openedByUid: actor.uid,
      openedByName: actor.name,
      openedByPosition: actor.position,
      updatedAt: now,
    });
    setResolutionAudit(tx, resolutionRef, 'voting_opened', actor, now, {
      previousValue: { status: 'draft' },
      newValue: { status: 'open' },
      metadata: { eligibleVoterCount: voters.length },
    });
  });
  return { ok: true, resolutionId, eligibleVoterCount: voters.length };
});

exports.submitResolutionVote = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const resolutionId = validateAnnouncementDocId(request.data?.resolutionId, 'resolutionId');
  const choice = resolutionModel.normalizeVoteChoice(request.data?.choice);
  if (!choice) throw new HttpsError('invalid-argument', 'Vote must be approve, reject, or abstain.');
  const resolutionRef = db.collection(RESOLUTIONS_COLLECTION).doc(resolutionId);
  const voteRef = resolutionRef.collection('votes').doc(uid);
  const now = resolutionTimestamp();
  let responseVote = null;
  await db.runTransaction(async tx => {
    const [resolutionSnap, voteSnap] = await Promise.all([tx.get(resolutionRef), tx.get(voteRef)]);
    if (!resolutionSnap.exists) throw new HttpsError('not-found', 'Resolution not found.');
    const resolution = resolutionSnap.data() || {};
    if (resolution.status !== 'open') throw new HttpsError('failed-precondition', 'Voting is closed.');
    const voter = (Array.isArray(resolution.eligibleVoters) ? resolution.eligibleVoters : []).find(item => item?.uid === uid);
    if (!voter || !Array.isArray(resolution.eligibleVoterUids) || !resolution.eligibleVoterUids.includes(uid)) {
      throw new HttpsError('permission-denied', 'You are not an eligible voter for this resolution.');
    }
    const previous = voteSnap.exists ? (voteSnap.data() || {}) : {};
    const previousChoice = resolutionModel.normalizeVoteChoice(previous.choice);
    tx.set(voteRef, {
      voterUid: uid,
      voterName: stripRotaractorPrefix(normalizeText(voter.name, 160)),
      voterPosition: normalizeText(voter.position, 240),
      choice,
      submittedAt: previous.submittedAt || now,
      updatedAt: now,
    }, { merge: false });
    setResolutionAudit(tx, resolutionRef, previousChoice ? 'vote_changed' : 'vote_submitted', {
      uid,
      name: stripRotaractorPrefix(normalizeText(voter.name, 160)),
      position: normalizeText(voter.position, 240),
    }, now, {
      previousValue: previousChoice || null,
      newValue: choice,
    });
    responseVote = { choice, submittedAt: timestampToIso(previous.submittedAt || now), updatedAt: timestampToIso(now) };
  });
  return { ok: true, resolutionId, vote: responseVote };
});

exports.getMyOpenResolutions = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const active = await getActiveRole(uid);
  if (!active || !ACTIVE_ROLES.has(active.role)) throw new HttpsError('failed-precondition', 'Approved account required.');
  return { ok: true, openResolutions: await getOpenResolutionsForUser(uid) };
});

exports.closeResolutionVoting = onCall(RESOLUTION_PDF_CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const actor = await getResolutionManagerContext(uid);
  const resolutionId = validateAnnouncementDocId(request.data?.resolutionId, 'resolutionId');
  const resolutionRef = db.collection(RESOLUTIONS_COLLECTION).doc(resolutionId);
  const now = resolutionTimestamp();
  const finalizationId = crypto.randomUUID();
  let finalResult = null;
  let uploadedMode = false;
  await db.runTransaction(async tx => {
    const resolutionSnap = await tx.get(resolutionRef);
    if (!resolutionSnap.exists) throw new HttpsError('not-found', 'Resolution not found.');
    const resolution = resolutionSnap.data() || {};
    if (resolution.status !== 'open') throw new HttpsError('failed-precondition', 'Only an open resolution may be closed.');
    const votesSnap = await tx.get(resolutionRef.collection('votes'));
    const votes = votesSnap.docs.map(snap => snap.data() || {});
    finalResult = resolutionModel.calculateResolutionResult({
      votingRule: resolution.votingRule,
      customApprovalCount: resolution.customApprovalCount,
      eligibleVoterCount: Array.isArray(resolution.eligibleVoterUids) ? resolution.eligibleVoterUids.length : 0,
      votes,
    });
    const finalizedPdfSectionsSnapshot = resolution.pdfLayoutMode === 'custom' ? resolutionModel.normalizePdfSections(resolution.pdfSections) : [];
    assertFirestoreSafeResolutionSections(finalizedPdfSectionsSnapshot, 'finalizedPdfSectionsSnapshot');
    uploadedMode = resolutionUploads.sourceMode(resolution) === 'uploadedPdf';
    const uploadedFinalization = uploadedMode ? {
      finalizedUploadedSourceSnapshot: { ...resolution.uploadedSource },
      finalizedVotesTableConfigSnapshot: resolutionModel.normalizeUploadedVotesTableConfig(resolution.uploadedVotesTableConfig),
      finalizedVoteRowsSnapshot: buildFinalizedVoteRows(resolution, votes, resolutionModel.normalizeUploadedVotesTableConfig(resolution.uploadedVotesTableConfig)),
      merge: { status: 'pending', finalizationId, attemptCount: 0, lastErrorCode: '', createdAt: now, updatedAt: now },
    } : {};
    tx.update(resolutionRef, {
      ...finalResult,
      status: finalResult.status,
      result: finalResult.result,
      closedAt: now,
      closedByUid: actor.uid,
      closedByName: actor.name,
      closedByPosition: actor.position,
      finalizedPdfLayoutMode: resolution.pdfLayoutMode === 'custom' ? 'custom' : 'standard',
      finalizedPdfSectionsSnapshot,
      ...uploadedFinalization,
      updatedAt: now,
    });
    setResolutionAudit(tx, resolutionRef, 'voting_closed', actor, now, {
      previousValue: { status: 'open' },
      newValue: { status: finalResult.status, result: finalResult.result },
      metadata: {
        approveCount: finalResult.approveCount,
        rejectCount: finalResult.rejectCount,
        abstainCount: finalResult.abstainCount,
        votesReceivedCount: finalResult.votesReceivedCount,
      },
    });
    setResolutionAudit(tx, resolutionRef, 'result_finalized', actor, now, { newValue: { result: finalResult.result } });
  });
  let merge = null;
  if (uploadedMode) {
    try { merge = await resolutionUploads.processMerge(resolutionId); }
    catch (error) { merge = { ok: false, status: 'failed', code: error.code || 'merge-failed' }; }
  }
  return { ok: true, resolutionId, ...finalResult, closedAt: timestampToIso(now), merge };
});

exports.cancelResolution = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const actor = await getResolutionManagerContext(uid);
  const resolutionId = validateAnnouncementDocId(request.data?.resolutionId, 'resolutionId');
  const resolutionRef = db.collection(RESOLUTIONS_COLLECTION).doc(resolutionId);
  const now = resolutionTimestamp();
  await db.runTransaction(async tx => {
    const snap = await tx.get(resolutionRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Resolution not found.');
    const data = snap.data() || {};
    if (!['draft', 'open'].includes(data.status)) throw new HttpsError('failed-precondition', 'Finalized or cancelled resolutions cannot be cancelled.');
    tx.update(resolutionRef, {
      status: 'cancelled',
      result: null,
      cancelledAt: now,
      cancelledByUid: actor.uid,
      cancelledByName: actor.name,
      cancelledByPosition: actor.position,
      updatedAt: now,
    });
    setResolutionAudit(tx, resolutionRef, 'resolution_cancelled', actor, now, {
      previousValue: { status: data.status },
      newValue: { status: 'cancelled' },
    });
  });
  return { ok: true, resolutionId };
});

exports.getAdminResolutions = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  await getResolutionManagerContext(uid);
  const [resolutionsSnap, meetingsSnap, voters] = await Promise.all([
    db.collection(RESOLUTIONS_COLLECTION).orderBy('createdAt', 'desc').limit(100).get(),
    db.collection('bodMeetings').orderBy('date', 'desc').limit(100).get(),
    loadActiveResolutionVoters(),
  ]);
  const resolutions = await Promise.all(resolutionsSnap.docs.map(async snap => {
    const data = snap.data() || {};
    const fields = publicResolutionFields(snap.id, data);
    if (data.status !== 'open') return fields;
    const votesSnap = await snap.ref.collection('votes').get();
    return { ...fields, ...countResolutionVotes(votesSnap.docs.map(vote => vote.data() || {})) };
  }));
  return {
    ok: true,
    resolutions,
    meetings: meetingsSnap.docs.map(snap => ({ id: snap.id, name: normalizeText(snap.data()?.name, 220), date: normalizeText(snap.data()?.date, 20), archived: snap.data()?.archived === true })).filter(item => item.name && item.date),
    roster: voters.map(voter => ({ uid: voter.uid, name: voter.name, position: voter.position })),
  };
});

exports.getResolutionDetails = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  await getResolutionManagerContext(uid);
  const resolutionId = validateAnnouncementDocId(request.data?.resolutionId, 'resolutionId');
  const resolutionRef = db.collection(RESOLUTIONS_COLLECTION).doc(resolutionId);
  const [resolutionSnap, votesSnap, auditSnap, canonicalVoters] = await Promise.all([
    resolutionRef.get(),
    resolutionRef.collection('votes').orderBy('updatedAt', 'asc').get(),
    resolutionRef.collection('audit').orderBy('timestamp', 'asc').get(),
    loadActiveResolutionVoters(),
  ]);
  if (!resolutionSnap.exists) throw new HttpsError('not-found', 'Resolution not found.');
  const data = resolutionSnap.data() || {};
  const voteData = votesSnap.docs.map(snap => ({ id: snap.id, data: snap.data() || {} }));
  const liveCounts = data.status === 'open' ? countResolutionVotes(voteData.map(item => item.data)) : {};
  return {
    ok: true,
    resolution: {
      ...publicResolutionFields(resolutionId, data),
      ...liveCounts,
      eligibleVoters: Array.isArray(data.eligibleVoters) ? data.eligibleVoters.map(voter => ({ uid: normalizeText(voter?.uid, 128), name: normalizeText(voter?.name, 160), position: normalizeText(voter?.position, 240) })).filter(voter => voter.uid) : [],
    },
    votes: voteData.map(item => {
      const vote = item.data;
      return { voterUid: item.id, voterName: normalizeText(vote.voterName, 160), voterPosition: normalizeText(vote.voterPosition, 240), choice: resolutionModel.normalizeVoteChoice(vote.choice), submittedAt: timestampToIso(vote.submittedAt), updatedAt: timestampToIso(vote.updatedAt) };
    }),
    audit: auditSnap.docs.map(snap => {
      const audit = snap.data() || {};
      return { id: snap.id, action: normalizeText(audit.action, 80), actorName: normalizeText(audit.actorName, 160), actorPosition: normalizeText(audit.actorPosition, 240), timestamp: timestampToIso(audit.timestamp), previousValue: audit.previousValue ?? null, newValue: audit.newValue ?? null, metadata: audit.metadata && typeof audit.metadata === 'object' ? audit.metadata : {} };
    }),
    canonicalVoters: canonicalVoters.map(voter => ({ uid: voter.uid, name: voter.name, position: voter.position })),
  };
});

function throwResolutionUploadCallableError(error) {
  const allowed = new Set(['invalid-argument', 'not-found', 'already-exists', 'failed-precondition', 'permission-denied', 'unauthenticated', 'resource-exhausted', 'aborted', 'unavailable']);
  const code = allowed.has(error?.code) ? error.code : 'internal';
  throw new HttpsError(code, error?.message || 'The Resolution PDF request failed.');
}

exports.createResolutionPdfUploadSession = onCall(RESOLUTION_PDF_CALLABLE_OPTIONS, async request => {
  try { return await resolutionUploads.createUploadSession(requireAuth(request), request.data || {}); }
  catch (error) { throwResolutionUploadCallableError(error); }
});

exports.finalizeResolutionPdfUpload = onCall(RESOLUTION_PDF_CALLABLE_OPTIONS, async request => {
  try { return await resolutionUploads.finalizeUpload(requireAuth(request), request.data || {}); }
  catch (error) { throwResolutionUploadCallableError(error); }
});

exports.removeResolutionSourcePdf = onCall(RESOLUTION_PDF_CALLABLE_OPTIONS, async request => {
  try { return await resolutionUploads.removeSource(requireAuth(request), request.data || {}); }
  catch (error) { throwResolutionUploadCallableError(error); }
});

exports.retryResolutionPdfMerge = onCall(RESOLUTION_PDF_CALLABLE_OPTIONS, async request => {
  try { return await resolutionUploads.retryMerge(requireAuth(request), request.data || {}); }
  catch (error) { throwResolutionUploadCallableError(error); }
});

exports.uploadResolutionSourcePdf = onRequest({ region: 'us-central1', timeoutSeconds: 120, memory: '512MiB', maxInstances: 5, concurrency: 10, secrets: RESOLUTION_DRIVE_SECRETS }, (req, res) => resolutionUploads.uploadHttp(req, res));
exports.downloadResolutionSourcePdf = onRequest({ region: 'us-central1', timeoutSeconds: 60, memory: '256MiB', maxInstances: 10, concurrency: 20, secrets: RESOLUTION_DRIVE_SECRETS }, (req, res) => resolutionUploads.streamSourcePdf(req, res));
exports.downloadFinalizedResolutionPdf = onRequest({ region: 'us-central1', timeoutSeconds: 60, memory: '256MiB', maxInstances: 10, concurrency: 20, secrets: RESOLUTION_DRIVE_SECRETS }, (req, res) => resolutionUploads.streamFinalPdf(req, res));
exports.cleanupResolutionPdfUploads = onSchedule({ region: 'us-central1', schedule: 'every day 03:30', timeZone: 'Asia/Kolkata', timeoutSeconds: 300, memory: '256MiB', secrets: RESOLUTION_DRIVE_SECRETS }, () => resolutionUploads.cleanupExpiredSessions());

exports.getMyDashboardStats = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const active = await getActiveRole(uid);
  if (!active || !ACTIVE_ROLES.has(active.role)) {
    throw new HttpsError('failed-precondition', 'Approved account required.');
  }
  const [clubRanking, announcements, openResolutions] = await Promise.all([
    getPublicDashboardClubRanking(),
    getDashboardAnnouncementsForUser(uid),
    getOpenResolutionsForUser(uid),
  ]);

  if (active.role === 'prospect') {
    const [userSnap, eventsSnap] = await Promise.all([
      db.collection('users').doc(uid).get(),
      db.collection('events').get(),
    ]);
    const userData = userSnap.exists ? (userSnap.data() || {}) : {};
    const progressData = await recalcProspectProgress(uid, { user: userData, eventsSnap });
    const today = new Date().toISOString().slice(0, 10);
    const upcomingEvents = eventsSnap.docs
      .map(doc => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter(event => event.archived !== true
        && String(event.visibility || 'public').toLowerCase() !== 'internal'
        && String(event.date || '') >= today)
      .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
      .slice(0, 5)
      .map(event => ({
        id: event.id,
        name: event.name || '',
        date: event.date || '',
        endDate: event.endDate || '',
        avenue: normalizeAvenuesForStats(event.avenue),
        desc: event.desc || event.description || '',
        type: event.type || 'clubEvent',
      }));

    return {
      ok: true,
      mode: 'prospect',
      clubRanking,
      announcements,
      openResolutions,
      profile: {
        uid,
        name: userData.name || request.auth?.token?.name || '',
        email: userData.email || request.auth?.token?.email || '',
        role: 'prospect',
        clubPosition: 'Prospect',
        phone: userData.phone || '',
        gender: userData.gender || '',
        hobbies: userData.hobbies || '',
        joinReason: userData.joinReason || '',
        referredBy: userData.referredBy || 'N/A',
        previousRotaractDetails: userData.previousRotaractDetails || 'N/A',
      },
      prospectProgress: {
        criteriaVersion: progressData.criteriaVersion,
        criteria: progressData.criteria,
        gbmAttended: progressData.gbmAttended,
        avenueEventsAttended: progressData.avenueEventsAttended,
        currentConsecutiveAttendance: progressData.currentConsecutiveAttendance,
        maximumConsecutiveAttendance: progressData.maximumConsecutiveAttendance,
        requiredConsecutiveAttendance: progressData.requiredConsecutiveAttendance,
        attendanceProgressCount: progressData.attendanceProgressCount,
        attendanceRequirementMet: progressData.attendanceRequirementMet,
        qualifyingEventIds: progressData.qualifyingEventIds,
        qualifyingEvents: progressData.qualifyingEvents,
        attendanceRequirementMetAt: progressData.attendanceRequirementMetAt,
        fourthEligibleActivityId: progressData.fourthEligibleActivityId,
        fourthEligibleActivityDate: progressData.fourthEligibleActivityDate,
        duesDue: progressData.duesDue,
        duesPaid: progressData.duesPaid,
        ready: progressData.ready,
        whatsappJoined: progressData.whatsappJoined === true,
        completedCount: progressData.completedCount,
        totalCount: progressData.totalCount,
        percent: progressData.percent,
      },
      upcomingEvents,
    };
  }

  const [
    userSnap,
    memberSnap,
    myAttendanceSnap,
    eventsSnap,
    districtAttendanceSnap,
    districtEventsSnap,
    membersSnap,
    allAttendanceSnap,
    cwdAssignmentSnap,
  ] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.collection('members').doc(uid).get(),
    db.collection('attendance').doc(uid).get(),
    db.collection('events').get(),
    db.collection('districtAttendance').doc(uid).get(),
    db.collection('districtEvents').get(),
    db.collection('members').get(),
    db.collection('attendance').get(),
    db.collection('bodPositionAssignments').doc(`${positionHelpers.WEBSITE_DIRECTOR_POSITION_KEY}_${uid}`).get(),
  ]);

  const userData = userSnap.exists ? (userSnap.data() || {}) : {};
  const memberData = memberSnap.exists ? (memberSnap.data() || {}) : {};
  const authorityContext = await getAuthorityContext(uid, {
    activeRole: active,
    userSnap,
    cwdAssignmentSnap,
  });
  const myAttendanceData = myAttendanceSnap.exists ? (myAttendanceSnap.data() || {}) : {};
  const districtAttendanceData = districtAttendanceSnap.exists ? (districtAttendanceSnap.data() || {}) : {};

  const events = eventsSnap.docs
    .map(doc => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter(isDashboardClubEvent)
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));

  const districtEvents = districtEventsSnap.docs
    .map(doc => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter(event => event.archived !== true)
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));

  const attendanceSummary = summarizeAttendanceForEvents(myAttendanceData, events);
  const recentEvents = events
    .slice()
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    .slice(0, 8)
    .map(event => safeEventForDashboard(event, myAttendanceData[event.id]));

  const districtSummary = summarizeAttendanceForEvents(districtAttendanceData, districtEvents);
  const recentDistrictEvents = districtEvents
    .slice()
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    .slice(0, 8)
    .map(event => safeEventForDashboard({ ...event, type: 'districtEvent' }, districtAttendanceData[event.id]));

  const publicEvents = eventsSnap.docs
    .map(doc => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter(event => event.archived !== true && String(event.visibility || 'public').toLowerCase() !== 'internal');

  const eventsByAvenueMap = new Map();
  events.forEach(event => {
    normalizeAvenuesForStats(event.avenue).forEach(avenue => {
      eventsByAvenueMap.set(avenue, (eventsByAvenueMap.get(avenue) || 0) + 1);
    });
  });
  const eventsByAvenue = Array.from(eventsByAvenueMap.entries())
    .map(([avenue, count]) => ({ avenue, count }))
    .sort((a, b) => b.count - a.count || a.avenue.localeCompare(b.avenue));

  const attendanceByMemberId = {};
  allAttendanceSnap.forEach(doc => {
    attendanceByMemberId[doc.id] = doc.data() || {};
  });

  const activeMembers = membersSnap.docs
    .map(doc => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter(member => member.active !== false);

  const ranked = activeMembers
    .map(member => {
      const summary = summarizeAttendanceForEvents(attendanceByMemberId[member.id] || {}, events);
      return {
        id: member.id,
        present: summary.present,
        totalCounted: summary.totalCounted,
        percentage: summary.percentage,
      };
    })
    .filter(row => row.totalCounted > 0)
    .sort((a, b) => b.percentage - a.percentage || b.present - a.present || a.id.localeCompare(b.id));

  const myRankIndex = ranked.findIndex(row => row.id === uid);
  const totalClubCounted = ranked.reduce((sum, row) => sum + row.totalCounted, 0);
  const totalClubPresent = ranked.reduce((sum, row) => sum + row.present, 0);

  const today = new Date().toISOString().slice(0, 10);
  const upcomingEvents = publicEvents
    .filter(event => String(event.date || '') >= today)
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
    .slice(0, 5)
    .map(event => ({
      id: event.id,
      name: event.name || '',
      date: event.date || '',
      endDate: event.endDate || '',
      avenue: normalizeAvenuesForStats(event.avenue),
      desc: event.desc || event.description || '',
      type: event.type || 'clubEvent',
    }));

  return {
    ok: true,
    clubRanking,
    announcements,
    openResolutions,
    profile: {
      uid,
      name: userData.name || memberData.name || request.auth?.token?.name || '',
      email: userData.email || memberData.email || request.auth?.token?.email || '',
      role: active.role,
      clubPosition: userData.clubPosition || '',
      memberName: memberData.name || '',
      memberPosition: memberData.position || '',
      positionKeys: authorityContext.positionKeys,
      authority: authorityContext.authority,
    },
    myAttendance: {
      ...attendanceSummary,
      recent: recentEvents,
    },
    districtAttendance: {
      totalCounted: districtSummary.totalCounted,
      present: districtSummary.present,
      absent: districtSummary.absent,
      na: districtSummary.na,
      percentage: districtSummary.percentage,
      recent: recentDistrictEvents,
    },
    clubStats: {
      totalEvents: events.length,
      totalPublicEvents: publicEvents.length,
      eventsByAvenue,
      mostActiveAvenue: eventsByAvenue[0]?.avenue || '',
      clubAverageAttendance: percentage(totalClubPresent, totalClubCounted),
      myRank: myRankIndex >= 0 ? myRankIndex + 1 : null,
      rankedMemberCount: ranked.length,
    },
    upcomingEvents,
  };
});

exports.syncExistingRolesToUsers = onCall(CALLABLE_OPTIONS, async (request) => {
  const actorUid = requireAuth(request);
  await assertAdminOrPresident(actorUid);

  const rolesSnap = await db.collection('roles').get();
  let created = 0;
  let batch = db.batch();
  let batchOps = 0;
  const now = admin.firestore.FieldValue.serverTimestamp();

  for (const roleDoc of rolesSnap.docs) {
    const uid = roleDoc.id;
    const roleData = roleDoc.data() || {};
    const role = normalizeRole(roleData.role);
    if (!ACTIVE_ROLES.has(role)) continue;
    if (String(roleData.status || 'approved').toLowerCase() !== 'approved') continue;

    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (userSnap.exists) continue;

    let record = null;
    try {
      record = await admin.auth().getUser(uid);
    } catch (err) {
      console.warn('syncExistingRolesToUsers missing auth record', uid, err?.message);
    }

    batch.set(userRef, {
      uid,
      name: normalizeText(record?.displayName || record?.email || uid, 120),
      email: normalizeEmail(record?.email || ''),
      provider: 'legacy',
      role,
      requestedRole: role === 'president' ? 'admin' : role,
      status: 'approved',
      createdAt: now,
      updatedAt: now,
      approvedAt: roleData.approvedAt || now,
      approvedBy: roleData.approvedBy || 'legacy',
      rejectedAt: null,
      rejectedBy: null,
      rejectReason: null,
    });
    created += 1;
    batchOps += 1;

    if (batchOps >= 450) {
      await batch.commit();
      batch = db.batch();
      batchOps = 0;
    }
  }

  if (batchOps > 0) await batch.commit();
  return { ok: true, created };
});

exports.createBodUploadTicket = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const authority = await getAuthorityContext(uid);
  if (!authority.role || !['bod', 'admin', 'president'].includes(authority.role)) {
    throw new HttpsError('permission-denied', 'Approved BOD, admin, or president access required.');
  }
  await assertBodEventsUnlockedForRole(authority);

  const data = request.data || {};
  const fileName = normalizeUploadFileName(data.fileName);
  const mimeType = validateDriveUploadMimeType(data.mimeType);
  const sizeBytes = validateDriveUploadSizeBytes(data.sizeBytes, BOD_UPLOAD_MAX_BYTES);
  const eventName = normalizeDriveUploadText(data.eventName, 180, 'Event name', { required: true });
  const eventDate = normalizeDriveUploadText(data.eventDate, 20, 'Event date', { required: true });
  const suppliedUploadGroupId = hasSuppliedDriveUploadGroupId(data.uploadGroupId);
  const uploadGroupId = normalizeDriveUploadGroupId(data.uploadGroupId);

  const { ticket, expiresAtMillis } = await createDriveUploadTicketDoc({
    uid,
    role: authority.role,
    uploadType: 'bod',
    limit: 30,
    metadata: {
      fileName,
      mimeType,
      sizeBytes,
      eventName,
      eventDate,
      uploadGroupId,
    },
    bodUploadGroup: {
      supplied: suppliedUploadGroupId,
      uploadGroupId,
      uid,
      eventName,
      eventDate,
    },
  });

  return {
    ticket,
    expiresAt: expiresAtMillis,
    uploadGroupId,
    fileName,
    mimeType,
    sizeBytes,
  };
});

exports.createTreasuryUploadTicket = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const authority = await assertAdminOrPresidentAuthority(uid);
  await assertPanelUnlockedForRole('treasury', authority, 'Treasury');

  const data = request.data || {};
  const fileName = normalizeUploadFileName(data.fileName);
  const mimeType = validateDriveUploadMimeType(data.mimeType);
  const sizeBytes = validateDriveUploadSizeBytes(data.sizeBytes, TREASURY_UPLOAD_MAX_BYTES);
  const transactionId = validateDriveTransactionId(data.transactionId);
  const transactionDate = normalizeDriveUploadText(data.transactionDate, 20, 'Transaction date', { required: true });
  const transactionPurpose = normalizeDriveUploadText(data.transactionPurpose, 180, 'Transaction purpose', { required: true });
  const transactionType = validateDriveTransactionType(data.transactionType);
  const transactionAmount = validateDriveTransactionAmount(data.transactionAmount);

  const { ticket, expiresAtMillis } = await createDriveUploadTicketDoc({
    uid,
    role: authority.role,
    uploadType: 'treasury',
    limit: 20,
    metadata: {
      fileName,
      mimeType,
      sizeBytes,
      transactionId,
      transactionDate,
      transactionPurpose,
      transactionType,
      transactionAmount,
    },
  });

  return {
    ticket,
    expiresAt: expiresAtMillis,
    fileName,
    mimeType,
    sizeBytes,
    transactionId,
    transactionDate,
    transactionPurpose,
    transactionType,
    transactionAmount,
  };
});

exports.validateDriveUploadTicket = onRequest({
  region: 'us-central1',
  secrets: [DRIVE_UPLOAD_SHARED_SECRET],
  timeoutSeconds: 30,
  memory: '256MiB',
  maxInstances: 5,
  concurrency: 20,
}, async (req, res) => {
  if (req.method !== 'POST') {
    res.set('Allow', 'POST');
    return sendDriveUploadJson(res, 405, {
      ok: false,
      error: 'method-not-allowed',
      message: 'POST required.',
    });
  }

  if (!timingSafeSharedSecretMatches(req.get('x-rcph-drive-secret'), DRIVE_UPLOAD_SHARED_SECRET.value())) {
    return sendDriveUploadJson(res, 403, {
      ok: false,
      error: 'permission-denied',
      message: 'Forbidden.',
    });
  }

  try {
    const data = parseDriveUploadRequestBody(req);
    const uploadType = validateDriveUploadType(data.uploadType);
    const ticket = normalizeRawDriveUploadTicket(data.ticket);
    if (uploadType === VISIT_UPLOAD_TYPE) {
      const response = await visitSubmissions.validateVisitUploadTicketWithProof({
        ...data,
        ticket,
      });
      return sendDriveUploadJson(res, 200, response);
    }
    const fileName = normalizeUploadFileName(data.fileName);
    const mimeType = validateDriveUploadMimeType(data.mimeType);
    const maxBytes = uploadType === 'bod' ? BOD_UPLOAD_MAX_BYTES : TREASURY_UPLOAD_MAX_BYTES;
    const sizeBytes = validateDriveUploadSizeBytes(data.sizeBytes, maxBytes);
    const uploadGroupId = uploadType === 'bod'
      ? normalizeDriveUploadGroupId(data.uploadGroupId, { required: true })
      : '';
    const transactionId = uploadType === 'treasury'
      ? validateDriveTransactionId(data.transactionId)
      : '';
    const ticketHash = hashDriveUploadTicket(ticket);
    const ticketRef = db.collection('driveUploadTickets').doc(ticketHash);
    const nowMillis = Date.now();

    const response = await db.runTransaction(async (tx) => {
      const ticketSnap = await tx.get(ticketRef);
      if (!ticketSnap.exists) throw httpError(404, 'Upload ticket not found.');

      const ticketData = ticketSnap.data() || {};
      const expiresAtMillis = typeof ticketData.expiresAt?.toMillis === 'function'
        ? ticketData.expiresAt.toMillis()
        : Number(ticketData.expiresAt || 0);

      if (ticketData.used === true) throw httpError(409, 'Upload ticket already used.');
      if (!expiresAtMillis || expiresAtMillis <= nowMillis) {
        throw httpError(410, 'Upload ticket expired.');
      }
      if (
        ticketData.uploadType !== uploadType
        || ticketData.fileName !== fileName
        || ticketData.mimeType !== mimeType
        || ticketData.sizeBytes !== sizeBytes
        || (uploadType === 'bod' && ticketData.uploadGroupId !== uploadGroupId)
        || (uploadType === 'treasury' && ticketData.transactionId !== transactionId)
      ) {
        throw httpError(409, 'Upload ticket metadata mismatch.');
      }

      tx.update(ticketRef, {
        used: true,
        usedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      if (uploadType === 'bod') {
        return {
          ok: true,
          uploadType: 'bod',
          safeFileName: ticketData.fileName,
          uploadGroupId: ticketData.uploadGroupId,
          eventName: ticketData.eventName,
          eventDate: ticketData.eventDate,
          uploaderUid: ticketData.uid,
        };
      }

      return {
        ok: true,
        uploadType: 'treasury',
        safeFileName: ticketData.fileName,
        transactionId: ticketData.transactionId,
        transactionDate: ticketData.transactionDate,
        transactionPurpose: ticketData.transactionPurpose,
        transactionType: ticketData.transactionType,
        transactionAmount: ticketData.transactionAmount,
        uploaderUid: ticketData.uid,
      };
    });

    return sendDriveUploadJson(res, 200, response);
  } catch (err) {
    const status = err?.httpStatus || httpStatusFromHttpsError(err);
    const message = status >= 500 ? 'Upload ticket validation failed.' : err.message;
    return sendDriveUploadJson(res, status, {
      ok: false,
      error: status >= 500 ? 'internal' : 'upload-ticket-rejected',
      message,
    });
  }
});

exports.completeVisitSubmissionDriveUpload = onRequest({
  region: 'us-central1',
  secrets: [DRIVE_UPLOAD_SHARED_SECRET],
  timeoutSeconds: 30,
  memory: '256MiB',
  maxInstances: 5,
  concurrency: 20,
}, async (req, res) => {
  if (req.method !== 'POST') {
    res.set('Allow', 'POST');
    return sendDriveUploadJson(res, 405, {
      ok: false,
      error: 'method-not-allowed',
      message: 'POST required.',
    });
  }

  if (!timingSafeSharedSecretMatches(req.get('x-rcph-drive-secret'), DRIVE_UPLOAD_SHARED_SECRET.value())) {
    return sendDriveUploadJson(res, 403, {
      ok: false,
      error: 'permission-denied',
      message: 'Forbidden.',
    });
  }

  try {
    const data = parseDriveUploadRequestBody(req);
    const uploadType = validateDriveUploadType(data.uploadType);
    if (uploadType !== VISIT_UPLOAD_TYPE) {
      throw new HttpsError('invalid-argument', 'Invalid upload type.');
    }
    const response = await visitSubmissions.completeDriveUpload(data);
    return sendDriveUploadJson(res, 200, response);
  } catch (err) {
    const status = err?.httpStatus || httpStatusFromHttpsError(err);
    const message = status >= 500 ? 'Visit upload completion failed.' : err.message;
    return sendDriveUploadJson(res, status, {
      ok: false,
      error: status >= 500 ? 'internal' : 'visit-upload-completion-rejected',
      message,
    });
  }
});

exports.submitBodEvent = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const authority = await getAuthorityContext(uid);
  if (!authority.role || !['bod', 'admin', 'president'].includes(authority.role)) {
    throw new HttpsError('permission-denied', 'Approved BOD, admin, or president access required.');
  }
  await assertBodEventsUnlockedForRole(authority);

  const data = request.data || {};
  const eventId = validateEventDocId(data.eventId) || db.collection('events').doc().id;
  const payload = normalizeBodEventPayload(data);
  const userProfile = await getCallableUserProfile(uid, request);
  const now = admin.firestore.FieldValue.serverTimestamp();

  const { eventCreated } = await writeSyncedBodEvent({
    eventId,
    payload,
    uid,
    userProfile,
    now,
  });
  const attendanceRowsUpdated = await initializeAttendanceForEvent(eventId, now);
  const prospectProgressSummary = await recalcAllActiveProspects();

  return {
    ok: true,
    eventId,
    attendanceRowsUpdated,
    eventCreated,
    prospectProgressSummary,
  };
});

exports.getBodAvenueReportDirectors = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  await Promise.all([
    assertBodAdminOrPresident(uid),
    assertApprovedActiveCallableAccount(uid),
  ]);
  const avenueCode = bodAvenueReport.normalizeReportAvenueCode(request.data?.avenueCode);
  if (!avenueCode) throw new HttpsError('invalid-argument', 'A valid report avenue is required.');

  const assignmentsSnap = await db.collection('bodPositionAssignments').where('active', '==', true).get();
  const assignments = assignmentsSnap.docs.map(doc => doc.data() || {});
  const candidateUids = Array.from(new Set(assignments
    .filter(assignment => {
      const definition = positionHelpers.getPositionDefinition(assignment.positionKey);
      return definition?.active === true && definition.avenueCode === avenueCode;
    })
    .map(assignment => normalizeText(assignment.uid, 128))
    .filter(Boolean)));
  const [userSnaps, roleSnaps] = candidateUids.length ? await Promise.all([
    db.getAll(...candidateUids.map(candidateUid => db.collection('users').doc(candidateUid))),
    db.getAll(...candidateUids.map(candidateUid => db.collection('roles').doc(candidateUid))),
  ]) : [[], []];
  const usersByUid = new Map(candidateUids.map((candidateUid, index) => [
    candidateUid,
    userSnaps[index]?.exists ? (userSnaps[index].data() || {}) : null,
  ]));
  const rolesByUid = new Map(candidateUids.map((candidateUid, index) => [
    candidateUid,
    roleSnaps[index]?.exists ? (roleSnaps[index].data() || {}) : null,
  ]));

  return {
    ok: true,
    avenueCode,
    assignmentBasis: 'current-active',
    directors: bodAvenueReport.buildSafeAvenueDirectorRows({
      avenueCode,
      assignments,
      usersByUid,
      rolesByUid,
      positionHelpers,
    }),
  };
});

exports.syncBodEventToAttendance = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  await assertAdminOrPresident(uid);

  const bodEventId = validateEventDocId(request.data?.bodEventId);
  if (!bodEventId) throw new HttpsError('invalid-argument', 'BOD event ID is required.');

  const bodSnap = await db.collection('bodEvents').doc(bodEventId).get();
  if (!bodSnap.exists) throw new HttpsError('not-found', 'BOD event not found.');

  const bodData = bodSnap.data() || {};
  if (normalizeEventType(bodData.type, 'clubEvent') !== 'clubEvent') {
    throw new HttpsError('failed-precondition', 'Only club events can sync to attendance.');
  }
  const payload = normalizeBodEventPayload({
    ...bodData,
    date: bodData.date || bodData.eventStart,
    endDate: bodData.endDate || bodData.eventEnd,
    time: bodData.time || bodData.eventTime,
    desc: bodData.desc || bodData.description,
    imageLinks: bodData.imageLinks || (bodData.previewLink ? [bodData.previewLink] : []),
    driveFolder: bodData.driveFolder || bodData.driveFolderId,
    driveLinks: bodData.driveLinks || bodData.imageLinks,
  });
  const userProfile = await getCallableUserProfile(uid, request);
  const now = admin.firestore.FieldValue.serverTimestamp();

  const { eventCreated } = await writeSyncedBodEvent({
    eventId: bodEventId,
    payload,
    uid: bodData.createdBy || uid,
    userProfile: {
      email: bodData.createdByEmail || userProfile.email,
      name: bodData.createdByName || userProfile.name,
    },
    now,
  });
  const attendanceRowsUpdated = await initializeAttendanceForEvent(bodEventId, now);
  const prospectProgressSummary = await recalcAllActiveProspects();

  return {
    ok: true,
    eventId: bodEventId,
    attendanceRowsUpdated,
    eventCreated,
    prospectProgressSummary,
  };
});

exports.updateBodEvent = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const authority = await getAuthorityContext(uid);
  if (!authority.role || !['bod', 'admin', 'president'].includes(authority.role)) {
    throw new HttpsError('permission-denied', 'Approved BOD, admin, or president access required.');
  }
  await assertBodEventsUnlockedForRole(authority);

  const eventId = validateEventDocId(request.data?.eventId);
  if (!eventId) throw new HttpsError('invalid-argument', 'Event ID is required.');
  await assertBodEventRecordIsClubEvent(eventId);

  const payload = normalizeBodEventPayload(request.data || {});
  const userProfile = await getCallableUserProfile(uid, request);
  const now = admin.firestore.FieldValue.serverTimestamp();

  await writeSyncedBodEvent({ eventId, payload, uid, userProfile, now });
  const attendanceRowsUpdated = await initializeAttendanceForEvent(eventId, now);
  const prospectProgressSummary = await recalcAllActiveProspects();

  return {
    ok: true,
    eventId,
    attendanceRowsUpdated,
    prospectProgressSummary,
  };
});

exports.archiveBodEvent = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const authority = await getAuthorityContext(uid);
  if (!authority.role || !['bod', 'admin', 'president'].includes(authority.role)) {
    throw new HttpsError('permission-denied', 'Approved BOD, admin, or president access required.');
  }
  await assertBodEventsUnlockedForRole(authority);

  const eventId = validateEventDocId(request.data?.eventId);
  if (!eventId) throw new HttpsError('invalid-argument', 'Event ID is required.');
  await assertBodEventRecordIsClubEvent(eventId);

  const now = admin.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();
  batch.set(db.collection('bodEvents').doc(eventId), {
    status: 'deleted',
    archived: true,
    deletedAt: now,
    deletedBy: uid,
    updatedAt: now,
  }, { merge: true });
  batch.set(db.collection('events').doc(eventId), {
    archived: true,
    archivedAt: now,
    archivedBy: uid,
    updatedAt: now,
  }, { merge: true });
  await batch.commit();
  const prospectProgressSummary = await recalcAllActiveProspects();

  return { ok: true, eventId, prospectProgressSummary };
});

exports.createAdminClubEvent = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const authority = await assertAdminOrPresidentAuthority(uid);
  await assertPanelUnlockedForRole('attendance', authority, 'Attendance Manager');

  const userProfile = await getCallableUserProfile(uid, request);
  const payload = normalizeClubEventPayload(request.data || {}, userProfile, 'adminAttendanceManager');
  const eventId = validateEventDocId(request.data?.eventId) || db.collection('events').doc().id;
  const now = admin.firestore.FieldValue.serverTimestamp();

  const { eventCreated } = await writeSyncedBodEvent({
    eventId,
    payload,
    uid,
    userProfile,
    now,
  });
  const attendanceRowsUpdated = await initializeAttendanceForEvent(eventId, now);
  const prospectProgressSummary = await recalcAllActiveProspects();

  return { ok: true, eventId, eventCreated, attendanceRowsUpdated, prospectProgressSummary };
});

exports.updateAdminClubEvent = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const authority = await assertAdminOrPresidentAuthority(uid);
  await assertPanelUnlockedForRole('attendance', authority, 'Attendance Manager');

  const eventId = validateEventDocId(request.data?.eventId);
  if (!eventId) throw new HttpsError('invalid-argument', 'Event ID is required.');

  const userProfile = await getCallableUserProfile(uid, request);
  const payload = normalizeClubEventPayload(request.data || {}, userProfile, 'adminAttendanceManager');
  const now = admin.firestore.FieldValue.serverTimestamp();

  await writeSyncedBodEvent({ eventId, payload, uid, userProfile, now });
  const attendanceRowsUpdated = await initializeAttendanceForEvent(eventId, now);
  const prospectProgressSummary = await recalcAllActiveProspects();
  return { ok: true, eventId, attendanceRowsUpdated, prospectProgressSummary };
});

exports.archiveAdminClubEvent = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const authority = await assertAdminOrPresidentAuthority(uid);
  await assertPanelUnlockedForRole('attendance', authority, 'Attendance Manager');

  const eventId = validateEventDocId(request.data?.eventId);
  if (!eventId) throw new HttpsError('invalid-argument', 'Event ID is required.');

  const now = admin.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();
  batch.set(db.collection('events').doc(eventId), {
    archived: true,
    archivedAt: now,
    archivedBy: uid,
    updatedAt: now,
  }, { merge: true });
  batch.set(db.collection('bodEvents').doc(eventId), {
    archived: true,
    status: 'deleted',
    archivedAt: now,
    archivedBy: uid,
    updatedAt: now,
  }, { merge: true });
  await batch.commit();
  const prospectProgressSummary = await recalcAllActiveProspects();
  return { ok: true, eventId, prospectProgressSummary };
});

exports.createBodMeetingSynced = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const authority = await assertAdminOrPresidentAuthority(uid);
  await assertPanelUnlockedForRole('bodAttendance', authority, 'BOD Attendance');

  const meetingId = validateEventDocId(request.data?.meetingId) || db.collection('bodMeetings').doc().id;
  const payload = normalizeBodMeetingPayload(request.data || {});
  const userProfile = await getCallableUserProfile(uid, request);
  const now = admin.firestore.FieldValue.serverTimestamp();

  const { meetingCreated } = await writeBodMeetingSynced({ meetingId, payload, uid, userProfile, now });
  const attendanceRowsUpdated = await initializeAttendanceFieldForCollection('bodMembers', 'bodAttendance', meetingId, now);
  return { ok: true, meetingId, meetingCreated, attendanceRowsUpdated };
});

exports.updateBodMeetingSynced = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const authority = await assertAdminOrPresidentAuthority(uid);
  await assertPanelUnlockedForRole('bodAttendance', authority, 'BOD Attendance');

  const meetingId = validateEventDocId(request.data?.meetingId);
  if (!meetingId) throw new HttpsError('invalid-argument', 'Meeting ID is required.');

  const payload = normalizeBodMeetingPayload(request.data || {});
  const userProfile = await getCallableUserProfile(uid, request);
  const now = admin.firestore.FieldValue.serverTimestamp();

  await writeBodMeetingSynced({ meetingId, payload, uid, userProfile, now });
  const attendanceRowsUpdated = await initializeAttendanceFieldForCollection('bodMembers', 'bodAttendance', meetingId, now);
  return { ok: true, meetingId, attendanceRowsUpdated };
});

exports.archiveBodMeetingSynced = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const authority = await assertAdminOrPresidentAuthority(uid);
  await assertPanelUnlockedForRole('bodAttendance', authority, 'BOD Attendance');

  const meetingId = validateEventDocId(request.data?.meetingId);
  if (!meetingId) throw new HttpsError('invalid-argument', 'Meeting ID is required.');

  const now = admin.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();
  batch.set(db.collection('bodMeetings').doc(meetingId), {
    archived: true,
    archivedAt: now,
    archivedBy: uid,
    updatedAt: now,
  }, { merge: true });
  batch.set(db.collection('bodEvents').doc(meetingId), {
    archived: true,
    status: 'deleted',
    archivedAt: now,
    archivedBy: uid,
    updatedAt: now,
  }, { merge: true });
  await batch.commit();
  return { ok: true, meetingId };
});

exports.createDistrictEventSynced = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const authority = await assertAdminOrPresidentAuthority(uid);
  await assertPanelUnlockedForRole('attendance', authority, 'District Attendance');

  const districtEventId = validateEventDocId(request.data?.districtEventId) || db.collection('districtEvents').doc().id;
  const payload = normalizeDistrictEventPayload(request.data || {});
  const userProfile = await getCallableUserProfile(uid, request);
  const now = admin.firestore.FieldValue.serverTimestamp();

  const result = await writeDistrictEventSynced({ districtEventId, payload, uid, userProfile, now });
  const attendanceRowsUpdated = await initializeAttendanceFieldForCollection('members', 'districtAttendance', districtEventId, now);
  return { ok: true, districtEventId, attendanceRowsUpdated, ...result };
});

exports.updateDistrictEventSynced = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const authority = await assertAdminOrPresidentAuthority(uid);
  await assertPanelUnlockedForRole('attendance', authority, 'District Attendance');

  const districtEventId = validateEventDocId(request.data?.districtEventId);
  if (!districtEventId) throw new HttpsError('invalid-argument', 'District event ID is required.');

  const payload = normalizeDistrictEventPayload(request.data || {});
  const userProfile = await getCallableUserProfile(uid, request);
  const now = admin.firestore.FieldValue.serverTimestamp();

  const result = await writeDistrictEventSynced({ districtEventId, payload, uid, userProfile, now });
  const attendanceRowsUpdated = await initializeAttendanceFieldForCollection('members', 'districtAttendance', districtEventId, now);
  return { ok: true, districtEventId, attendanceRowsUpdated, ...result };
});

exports.archiveDistrictEventSynced = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const authority = await assertAdminOrPresidentAuthority(uid);
  await assertPanelUnlockedForRole('attendance', authority, 'District Attendance');

  const districtEventId = validateEventDocId(request.data?.districtEventId);
  if (!districtEventId) throw new HttpsError('invalid-argument', 'District event ID is required.');

  const now = admin.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();
  batch.set(db.collection('districtEvents').doc(districtEventId), {
    archived: true,
    archivedAt: now,
    archivedBy: uid,
    updatedAt: now,
  }, { merge: true });
  batch.set(db.collection('events').doc(districtEventId), {
    archived: true,
    archivedAt: now,
    archivedBy: uid,
    updatedAt: now,
  }, { merge: true });
  batch.set(db.collection('bodEvents').doc(districtEventId), {
    archived: true,
    status: 'deleted',
    archivedAt: now,
    archivedBy: uid,
    updatedAt: now,
  }, { merge: true });
  await batch.commit();
  return { ok: true, districtEventId };
});

const CLEAN_SLATE_CONFIRM_TEXT = 'RESET RCPH RIY DATA';
const CLEAN_SLATE_ALLOWED_COLLECTIONS = new Set([
  'attendance',
  'bodAttendance',
  'bodEvents',
  'bodMeetings',
  'bodMembers',
  'districtAttendance',
  'districtEvents',
  'events',
  'fines',
  'members',
  'treasury',
]);
const CLEAN_SLATE_NEVER_DELETE = new Set(['users', 'roles', 'passwordResets']);

async function countTopLevelCollection(collectionName) {
  const snap = await db.collection(collectionName).get();
  return snap.size;
}

async function deleteTopLevelCollection(collectionName) {
  const snap = await db.collection(collectionName).get();
  let deleted = 0;
  let batch = db.batch();
  let batchOps = 0;

  for (const doc of snap.docs) {
    batch.delete(doc.ref);
    deleted += 1;
    batchOps += 1;

    if (batchOps >= 450) {
      await batch.commit();
      batch = db.batch();
      batchOps = 0;
    }
  }

  if (batchOps > 0) await batch.commit();
  return deleted;
}

// President-only reset helper for RIY rollover. Use only after an external backup.
exports.cleanSlateForNewRiy = onCall(CALLABLE_OPTIONS, async (request) => {
  const actorUid = requireAuth(request);
  await assertPresidentAuthority(actorUid);

  const data = request.data || {};
  const confirmText = normalizeText(data.confirmText, 80);
  const dryRun = data.dryRun !== false;
  const requestedCollections = Array.isArray(data.deleteCollections)
    ? data.deleteCollections.map(c => normalizeText(c, 80)).filter(Boolean)
    : [];

  if (confirmText !== CLEAN_SLATE_CONFIRM_TEXT) {
    throw new HttpsError('failed-precondition', `Type "${CLEAN_SLATE_CONFIRM_TEXT}" to confirm.`);
  }
  if (!requestedCollections.length) {
    throw new HttpsError('invalid-argument', 'Select at least one collection to reset.');
  }

  const uniqueCollections = Array.from(new Set(requestedCollections));
  const blocked = uniqueCollections.filter(c =>
    CLEAN_SLATE_NEVER_DELETE.has(c) || !CLEAN_SLATE_ALLOWED_COLLECTIONS.has(c)
  );
  if (blocked.length) {
    throw new HttpsError('permission-denied', `Collection reset is not allowed for: ${blocked.join(', ')}`);
  }

  const results = {};
  for (const collectionName of uniqueCollections) {
    results[collectionName] = dryRun
      ? await countTopLevelCollection(collectionName)
      : await deleteTopLevelCollection(collectionName);
  }

  return {
    ok: true,
    dryRun,
    collections: uniqueCollections,
    counts: results,
  };
});
