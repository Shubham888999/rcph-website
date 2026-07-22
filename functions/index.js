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
  createVisitDashboardService,
} = require('./lib/visit-dashboards');
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
const {
  ANNOUNCEMENT_ATTACHMENT_EMAIL_MAX_BYTES,
  createAnnouncementAttachmentService,
} = require('./lib/announcement-attachments');
const bodAvenueReport = require('./lib/bod-avenue-report');
const bodEventSchema = require('./lib/bod-event-schema');
const { createBodManagementService } = require('./lib/bod-management');
const { createBodPhotoUploadService } = require('./lib/bod-photo-upload');
const momFunctions = require('./lib/momFunctions');
const reminderFunctions = require('./lib/reminderFunctions');
const { stripRotaractorPrefix } = require('./lib/member-name');
const {
  MemberProfileValidationError,
  normalizeRid,
  normalizeStoredRid,
} = require('./lib/member-profile');
const {
  ProfileUpdateValidationError,
  createProfileUpdateService,
  normalizeDateOfBirth,
} = require('./lib/profile-updates');

const { createProfileRemovalService } = require('./lib/profile-removal');

admin.initializeApp();
const db = admin.firestore();
const rolePositionAssignments = createPositionAssignmentService({
  db,
  admin,
  HttpsError,
  positionHelpers,
});
const profileUpdates = createProfileUpdateService({
  db,
  admin,
  HttpsError,
});

const profileRemoval = createProfileRemovalService({
  db,
  admin,
  HttpsError,
  assertAdminOrPresidentAuthority,
  assertApprovedActiveCallableAccount,
  getAuthorityContext,
});
const visitSubmissions = createVisitSubmissionService({
  db,
  admin,
  positionHelpers,
});
const visitDashboards = createVisitDashboardService({
  db,
  admin,
  positionHelpers,
  assertAdmin: assertAdminOrPresidentAuthority,
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
const RESOLUTION_OFFICIAL_EMAIL = normalizeEmail(process.env.RESOLUTION_OFFICIAL_EMAIL || DEFAULT_SIGNUP_NOTIFY_TO);
const RESOLUTION_DASHBOARD_URL = normalizeText(process.env.RCPH_DASHBOARD_URL || process.env.RESOLUTION_DASHBOARD_URL || 'https://www.rcph3131.org/dashboard', 500);
const CALLABLE_OPTIONS = {
  region: 'us-central1',
  cors: [
    'https://rcph3131.org',
    'https://www.rcph3131.org',
    'https://rcph-admin.web.app',
    'https://rcph-admin.firebaseapp.com',

    'https://rcph-admin-staging-2.web.app',
    'https://rcph-admin-staging-2.firebaseapp.com',
    /^https:\/\/rcph-admin-staging-2--[a-z0-9-]+\.web\.app$/,

    'http://localhost:5000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    /^http:\/\/localhost:\d+$/,
    /^http:\/\/127\.0\.0\.1:\d+$/,
  ],
};
const RESOLUTION_DRIVE_SECRETS = [VISIT_DRIVE_CLIENT_ID, VISIT_DRIVE_CLIENT_SECRET, VISIT_DRIVE_REFRESH_TOKEN];
const RESOLUTION_PDF_CALLABLE_OPTIONS = { ...CALLABLE_OPTIONS, timeoutSeconds: 300, memory: '1GiB', secrets: RESOLUTION_DRIVE_SECRETS };
const BOD_PHOTO_CALLABLE_OPTIONS = { ...CALLABLE_OPTIONS, timeoutSeconds: 120, memory: '512MiB', secrets: RESOLUTION_DRIVE_SECRETS };
const ANNOUNCEMENT_ATTACHMENT_SECRETS = RESOLUTION_DRIVE_SECRETS;
const ANNOUNCEMENT_ATTACHMENT_CALLABLE_OPTIONS = { ...CALLABLE_OPTIONS, timeoutSeconds: 120, memory: '512MiB', secrets: ANNOUNCEMENT_ATTACHMENT_SECRETS };
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
const announcementAttachments = createAnnouncementAttachmentService({
  db,
  admin,
  env: process.env,
  secrets: { VISIT_DRIVE_CLIENT_ID, VISIT_DRIVE_CLIENT_SECRET, VISIT_DRIVE_REFRESH_TOKEN },
  getManagerContext: async uid => {
    await assertApprovedActiveCallableAccount(uid);
    return assertAdminOrPresidentAuthority(uid);
  },
  logger: console,
  uploadEndpoint: 'https://us-central1-rcph-admin.cloudfunctions.net/uploadAnnouncementAttachment',
});
const bodManagement = createBodManagementService({
  db,
  admin,
  HttpsError,
  assertApprovedActiveCallableAccount,
  getAuthorityContext,
  logger: console,
});
const bodPhotoUploads = createBodPhotoUploadService({
  db,
  admin,
  HttpsError,
  bodManagement,
  env: process.env,
  secrets: { VISIT_DRIVE_CLIENT_ID, VISIT_DRIVE_CLIENT_SECRET, VISIT_DRIVE_REFRESH_TOKEN },
  allowedOrigins: CALLABLE_OPTIONS.cors,
  logger: console,
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

const DISTRICT_OFFICIAL_ROLE = 'districtOfficial';
const DISTRICT_OFFICIAL_SIGNUP_TYPE = 'district-official';
const DISTRICT_OFFICIAL_POSITIONS = new Set([
  'DRR',
  'DZR',
  'District Secretary',
  'District Council Member',
  'District Official',
  'Other',
]);
const ACTIVE_ROLES = new Set(['prospect', 'gbm', 'bod', 'admin', 'president']);
const REQUESTABLE_ROLES = new Set(['prospect', 'gbm', 'bod', 'admin', DISTRICT_OFFICIAL_ROLE]);
const APPROVABLE_ROLES = new Set(['gbm', 'bod', 'admin', 'president', DISTRICT_OFFICIAL_ROLE]);
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
const ADMIN_MAINTENANCE_AUDIT_COLLECTION = 'adminMaintenanceAudit';
const FINE_EVENT_SOURCES = new Set([
  'events',
  'bodMeetings',
  'districtEvents',
]);

const FINE_REASONS = new Set([
  'missing_badge',
  'late',
]);
const RESOLUTION_DELETION_AUDIT_COLLECTION = 'resolutionDeletionAudit';

function normalizeRole(value) {
  const role = String(value || '').trim();
  if (role.toLowerCase().replace(/[\s_-]+/g, '') === 'districtofficial') {
    return DISTRICT_OFFICIAL_ROLE;
  }
  return role.toLowerCase();
}

function normalizeText(value, max = 300) {
  return String(value || '').trim().slice(0, max);
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeFineDate(value, field = 'date') {
  const date = normalizeText(value, 20);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new HttpsError(
      'invalid-argument',
      `${field} must be a valid YYYY-MM-DD date.`
    );
  }

  const [year, month, day] =
    date.split('-').map(Number);

  const parsed =
    new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    throw new HttpsError(
      'invalid-argument',
      `${field} must be a valid date.`
    );
  }

  return date;
}

function normalizeFineAmount(value) {
  const amount = Number(value);

  if (
    !Number.isFinite(amount)
    || amount <= 0
    || amount > 1000000
  ) {
    throw new HttpsError(
      'invalid-argument',
      'Fine amount must be greater than zero.'
    );
  }

  return Math.round(amount * 100) / 100;
}

function validateFineDocumentId(value) {
  const fineId = normalizeText(value, 128);

  if (
    !fineId
    || fineId.includes('/')
    || /[\u0000-\u001f\u007f]/.test(fineId)
  ) {
    throw new HttpsError(
      'invalid-argument',
      'Valid fine ID required.'
    );
  }

  return fineId;
}

function normalizeFineReason(value) {
  const reason = normalizeText(value, 120);

  if (!FINE_REASONS.has(reason)) {
    throw new HttpsError(
      'invalid-argument',
      'Unsupported fine reason.'
    );
  }

  return reason;
}

function getFineEventRef(eventSource, eventId) {
  if (!FINE_EVENT_SOURCES.has(eventSource)) {
    throw new HttpsError(
      'invalid-argument',
      'Unsupported event source.'
    );
  }

  const safeEventId =
    validateEventDocId(eventId);

  if (!safeEventId) {
    throw new HttpsError(
      'invalid-argument',
      'Event or meeting is required.'
    );
  }

  return db
    .collection(eventSource)
    .doc(safeEventId);
}

function resolveFineEventSnapshot({
  eventSource,
  eventId,
  eventData,
}) {
  if (!eventData || eventData.archived === true) {
    throw new HttpsError(
      'failed-precondition',
      'The selected event is unavailable.'
    );
  }

  const eventName =
    normalizeText(eventData.name, 180);

  const eventDate =
    normalizeFineDate(
      eventData.date || eventData.eventStart,
      'eventDate'
    );

  if (!eventName) {
    throw new HttpsError(
      'failed-precondition',
      'The selected event has no valid name.'
    );
  }

  let eventType = '';

  if (eventSource === 'bodMeetings') {
    eventType = 'bodMeeting';
  } else if (eventSource === 'districtEvents') {
    eventType = 'districtEvent';
  } else {
    if (
      eventData.districtEventId
      || eventData.type === 'districtEvent'
      || eventData.kind === 'districtEvent'
    ) {
      throw new HttpsError(
        'invalid-argument',
        'Select this record from District Events.'
      );
    }

    const avenues =
      Array.isArray(eventData.avenue)
        ? eventData.avenue
        : [];

    const isGbm = avenues.some(
      (avenue) =>
        String(avenue).trim().toUpperCase()
        === 'GBM'
    );

    eventType =
      isGbm ? 'gbm' : 'clubEvent';
  }

  return {
    eventId,
    eventSource,
    eventType,
    eventName,
    eventDate,
  };
}

function treasuryAvenueForFine(
  eventType,
  eventData
) {
  if (eventType === 'gbm') return 'GBM';
  if (eventType === 'districtEvent') {
    return 'Other';
  }

  if (
    eventType === 'clubEvent'
    && Array.isArray(eventData?.avenue)
  ) {
    const first =
      eventData.avenue
        .map((item) =>
          String(item || '')
            .trim()
            .toUpperCase()
        )
        .find(Boolean);

    if (first) return first;
  }

  return 'Club';
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
    attachmentSessionId: source.attachmentSessionId ? validateAnnouncementDocId(source.attachmentSessionId, 'attachmentSessionId') : '',
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
    attachment: announcementAttachments.reportSafeAttachment(announcement.attachment),
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
  if (['published', 'failed', 'publishing', 'archived'].includes(status)) return status;
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
    attachment: announcementAttachments.reportSafeAttachment(data?.attachment),
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

async function getAnnouncementForAttachmentAccess(uid, announcementId) {
  const safeAnnouncementId = validateAnnouncementDocId(announcementId, 'announcementId');
  await assertApprovedActiveCallableAccount(uid);

  let canManage = false;
  try {
    await assertAdminOrPresidentAuthority(uid);
    canManage = true;
  } catch {
    canManage = false;
  }

  const announcementSnap = await db.collection(ANNOUNCEMENTS_COLLECTION).doc(safeAnnouncementId).get();
  if (!announcementSnap.exists) throw new HttpsError('not-found', 'Announcement not found.');
  const announcement = announcementSnap.data() || {};
  if (canManage) return { id: safeAnnouncementId, ...announcement };

  const deliverySnap = await db
    .collection(ANNOUNCEMENT_DELIVERIES_COLLECTION)
    .doc(announcementDeliveryId(safeAnnouncementId, uid))
    .get();
  if (!deliverySnap.exists) throw new HttpsError('permission-denied', 'Announcement is not available to this account.');
  const delivery = deliverySnap.data() || {};
  if (delivery.uid !== uid || delivery.dashboardStatus === 'dismissed') {
    throw new HttpsError('permission-denied', 'Announcement is not available to this account.');
  }
  if (announcement.status !== 'published' || isAnnouncementExpired(announcement.expiresAt || delivery.expiresAt)) {
    throw new HttpsError('not-found', 'Announcement not found.');
  }
  return { id: safeAnnouncementId, ...announcement };
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

function normalizeSignupConsentData(data, requestedRole) {
  const termsAccepted = data.termsAccepted === true;
  const privacyAccepted = data.privacyAccepted === true;
  if (requestedRole === DISTRICT_OFFICIAL_ROLE && (!termsAccepted || !privacyAccepted)) {
    throw new HttpsError('invalid-argument', 'Terms and Privacy acceptance are required.');
  }
  const expectedSource = requestedRole === 'prospect'
    ? 'prospect-signup'
    : requestedRole === DISTRICT_OFFICIAL_ROLE
      ? 'district-official-signup'
      : 'member-signup';
  return {
    termsAccepted,
    termsVersion: normalizeText(data.termsVersion, 40),
    privacyAccepted,
    privacyVersion: normalizeText(data.privacyVersion, 40),
    communicationsOptIn: data.communicationsOptIn === true,
    communicationsVersion: normalizeText(data.communicationsVersion, 40),
    consentSource: expectedSource,
    legalEffectiveDate: normalizeText(data.legalEffectiveDate, 40),
  };
}

function normalizeDistrictOfficialSignupData(data) {
  const position = normalizeText(data.districtOfficialPosition || data.districtPosition || data.position, 120);
  if (!DISTRICT_OFFICIAL_POSITIONS.has(position)) {
    throw new HttpsError('invalid-argument', 'District Official position is required.');
  }
  return {
    role: DISTRICT_OFFICIAL_ROLE,
    requestedRole: DISTRICT_OFFICIAL_ROLE,
    signupType: DISTRICT_OFFICIAL_SIGNUP_TYPE,
    position,
    districtOfficialPosition: position,
    districtPosition: position,
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

async function sendAnnouncementEmails({ announcementId, announcement, recipients, emailAttachment = null }) {
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
        attachments: emailAttachment ? [emailAttachment] : undefined,
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
  if (role === DISTRICT_OFFICIAL_ROLE) return 'New District Official Access Request - RCPH';
  return 'New Account Signup - RCPH';
}

function getSignupNotificationHighlight(userData) {
  const role = normalizeRole(userData.requestedRole || userData.role);
  if (role === 'prospect') {
    return 'Prospect Member auto-approved. Onboarding criteria: 3 consecutive eligible meetings/events, then dues paid.';
  }
  if (role === 'gbm') return 'GBM auto-approved.';
  if (role === 'bod' || role === 'admin' || role === DISTRICT_OFFICIAL_ROLE) {
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
    ['RID', signupEmailValue(userData.rid)],
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

  if (role === DISTRICT_OFFICIAL_ROLE) {
    rows.push(['District position', signupEmailValue(userData.districtOfficialPosition || userData.districtPosition || userData.position)]);
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

async function commitFirestoreOperations(operations, batchSize = 450) {
  let batch = db.batch();
  let count = 0;
  for (const apply of operations) {
    apply(batch);
    count += 1;
    if (count >= batchSize) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }
  if (count > 0) await batch.commit();
}

function throwMemberProfileError(err, fallbackMessage) {
  if (err instanceof MemberProfileValidationError) {
    throw new HttpsError(err.code || 'invalid-argument', err.message);
  }
  throwCallableServiceError(err, fallbackMessage);
}

function throwProfileUpdateError(err, fallbackMessage) {
  if (err instanceof ProfileUpdateValidationError) {
    throw new HttpsError(err.code || 'invalid-argument', err.message);
  }
  throwCallableServiceError(err, fallbackMessage);
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
  hasSergeantAtArmsPosition: false,
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

const sergeantDefinition = positionHelpers.getPositionDefinition('saa');
const canHoldSergeantAtArmsAuthority = ['bod', 'admin', 'president'].includes(active.role)
  && sergeantDefinition?.active === true;

if (
  !canHoldWebsiteDirectorAuthority
  && !canHoldPresidentAuthority
  && !canHoldSergeantAtArmsAuthority
) {
  return base;
}

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
let hasSergeantAtArmsPosition = false;

if (
  canHoldSergeantAtArmsAuthority
  && isApprovedActiveUserRecord(userData)
  && positionKeysAreWellFormed
  && metadata.positionKeys.includes('saa')
) {
  const assignmentSnap = preloaded.saaAssignmentSnap
    || await db.collection('bodPositionAssignments').doc(`saa_${uid}`).get();

  hasSergeantAtArmsPosition = isActivePositionAssignment(
    uid,
    'saa',
    assignmentSnap
  );
}
  return {
    ...base,
    positionKeys: metadata.positionKeys.slice(),
    positionSource: resolved.source,
    authority: {
  isPresidentRole: active.role === 'president',
  hasWebsiteDirectorPosition,
  hasSergeantAtArmsPosition,
  hasPresidentAuthority: hasPresidentPosition || hasWebsiteDirectorPosition,
},
  };
}
function hasOrdinaryAdminAuthority(authority) {
  return Boolean(
    authority?.role
    && (
      authority.role === 'admin'
      || authority.authority?.hasPresidentAuthority === true
      || authority.authority?.hasSergeantAtArmsPosition === true
    )
  );
}

function rolePositionSyncAuthority(authority) {
  return {
    actorRole: normalizeRole(authority?.role),
    actorHasPresidentAuthority: authority?.authority?.hasPresidentAuthority === true,
    actorHasAdminPanelAuthority: hasOrdinaryAdminAuthority(authority),
  };
}

function hasLockToolsAuthority(authority, userData) {
  return Boolean(
    isApprovedActiveUserRecord(userData)
    && authority?.role
    && (
      authority.role === 'admin'
      || authority.role === 'president'
      || authority.authority?.hasPresidentAuthority === true
    )
  );
}

function hasResolutionToolsAuthority({ role, userData, resolutionManager }) {
  return Boolean(
    isApprovedActiveUserRecord(userData)
    && (
      role === 'admin'
      || role === 'president'
      || resolutionManager === true
    )
  );
}

async function assertAdminOrPresident(uid) {
  const authority = await getAuthorityContext(uid);

  if (!hasOrdinaryAdminAuthority(authority)) {
    throw new HttpsError(
      'permission-denied',
      'Administrative access required.'
    );
  }

  return authority.role;
}

async function assertAdminOrPresidentAuthority(uid) {
  const authority = await getAuthorityContext(uid);

  if (!hasOrdinaryAdminAuthority(authority)) {
    throw new HttpsError(
      'permission-denied',
      'Administrative access required.'
    );
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
  if (!allowed) throw new HttpsError('permission-denied', 'Resolution tools access required.');
  return {
    uid,
    role,
    name: stripRotaractorPrefix(normalizeText(account.userData.name || account.authRecord.displayName || account.authRecord.email, 160)),
    position: role === 'admin' ? 'Admin' : role === 'president' || presidentPosition ? 'President' : 'Secretary',
  };
}

async function hasResolutionManagerAuthority(uid, preloaded = {}) {
  try {
    const active = preloaded.activeRole || await getActiveRole(uid);
    const userSnap = preloaded.userSnap || await db.collection('users').doc(uid).get();
    const userData = userSnap.exists ? (userSnap.data() || {}) : {};
    if (!active || !isApprovedActiveUserRecord(userData)) return false;
    if (active.role === 'admin' || active.role === 'president') return true;
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
    if (!uid || data.active !== true || !positionHelpers.isResolutionVoterPosition(positionKey)) return;
    const definition = positionHelpers.getPositionDefinition(positionKey);
    if (!definition) return;
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
      email: normalizeEmail(user.email || ''),
      role,
      position: positions.map(item => item.displayTitle).join(', '),
      positionKeys: positions.map(item => item.key),
      eligibilityReason: 'active_bod_position',
      active: true,
    });
  });
  return voters.sort((a, b) => a.position.localeCompare(b.position) || a.name.localeCompare(b.name));
}

function validateResolutionCustomCount(payload, eligibleCount) {
  if (resolutionModel.normalizeApprovalMethod(payload.approvalMethod) === 'record_only') return;
  if (payload.votingRule === 'custom_approval_count'
    && (!Number.isInteger(payload.customApprovalCount)
      || payload.customApprovalCount < 1
      || payload.customApprovalCount > eligibleCount)) {
    throw new HttpsError('invalid-argument', 'Custom approval count must not exceed the eligible voter count.');
  }
}

function resolveSelectedResolutionVoters(payload, voters) {
  if (resolutionModel.normalizeApprovalMethod(payload.approvalMethod) === 'record_only') return [];
  if (!Array.isArray(payload.eligibleVoterIds)) {
    throw new HttpsError('failed-precondition', 'Select at least one eligible voter before opening voting.');
  }
  const seen = new Set();
  const selectedIds = [];
  payload.eligibleVoterIds.forEach(item => {
    if (typeof item !== 'string' || !item.trim() || item.trim().length > 128 || item.includes('/')) {
      throw new HttpsError('failed-precondition', 'Saved eligible voter selection is invalid.');
    }
    const uid = normalizeText(item, 128);
    if (uid && !seen.has(uid)) {
      seen.add(uid);
      selectedIds.push(uid);
    }
  });
  if (!selectedIds.length) {
    throw new HttpsError('failed-precondition', 'Select at least one eligible voter before opening voting.');
  }
  const voterByUid = new Map(voters.map(voter => [voter.uid, voter]));
  const missingIds = selectedIds.filter(uid => !voterByUid.has(uid));
  if (missingIds.length) {
    throw new HttpsError('failed-precondition', 'Selected eligible voters must be active UID-linked BOD members.');
  }
  return selectedIds.map(uid => voterByUid.get(uid));
}

function resolutionMethodLabel(method, processingMode = '') {
  const normalized = resolutionModel.normalizeApprovalMethod(method);
  if (normalized === 'hybrid_email') {
    return resolutionModel.isAuthenticatedFinalHybrid(normalized, processingMode)
      ? 'Website Vote with Prepared Email'
      : 'Hybrid Email Confirmation';
  }
  if (normalized === 'record_only') return 'Record Only / No Voting';
  return 'Website Voting';
}

function shortResolutionHash(hash) {
  return normalizeText(hash, 128).slice(0, 12).toUpperCase();
}

function stableResolutionJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableResolutionJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableResolutionJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

function buildResolutionDocumentHash(resolution) {
  if (resolutionUploads.sourceMode(resolution) === 'uploadedPdf' && resolution.uploadedSource?.sha256) {
    return normalizeText(resolution.uploadedSource.sha256, 128);
  }
  const snapshot = {
    resolutionNumber: normalizeText(resolution.resolutionNumber, 80),
    title: normalizeText(resolution.title, 220),
    body: typeof resolution.body === 'string' ? resolution.body.slice(0, 20000) : '',
    notes: typeof resolution.notes === 'string' ? resolution.notes.slice(0, 10000) : '',
    meetingId: normalizeText(resolution.meetingId, 160),
    meetingTitle: normalizeText(resolution.meetingTitle, 220),
    meetingDate: normalizeText(resolution.meetingDate, 20),
    proposedByUid: normalizeText(resolution.proposedByUid, 128),
    secondedByUid: normalizeText(resolution.secondedByUid, 128),
    documentSourceMode: resolutionUploads.sourceMode(resolution),
    pdfLayoutMode: resolution.pdfLayoutMode === 'custom' ? 'custom' : 'standard',
    pdfSections: resolutionModel.normalizePdfSections(resolution.pdfSections),
    resolutionPageConfig: resolutionModel.normalizeResolutionPageConfig(resolution.resolutionPageConfig, resolution),
    generatedPageOrder: resolutionModel.normalizeGeneratedPageOrder(resolution.generatedPageOrder),
  };
  return crypto.createHash('sha256').update(stableResolutionJson(snapshot), 'utf8').digest('hex');
}

function resolutionDeadlineText(resolution) {
  return normalizeText(resolution.votingDeadline || resolution.deadline, 80) || 'Until voting is closed by the Resolution manager.';
}

function resolutionTitleReference(resolution, separator = ' - ') {
  const number = normalizeText(resolution?.resolutionNumber, 80);
  const title = normalizeText(resolution?.title, 220);
  if (!title) return number ? `Resolution ${number}` : 'Resolution';
  return number ? `Resolution ${number}${separator}${title}` : `Resolution${separator}${title}`;
}

function buildDefaultOfficialEmailSubject(resolution) {
  return resolutionTitleReference(resolution);
}

function buildDefaultOfficialEmailBody(resolution, documentShortHash, actor) {
  const presidentName = stripRotaractorPrefix(normalizeText(actor?.name || resolution.openedByName || 'President', 160));
  return [
    'Dear Board Members,',
    '',
    `This email is being issued to formally document the resolution discussed during our online Board Meeting held on ${normalizeText(resolution.meetingDate, 20) || '[MEETING DATE]'} at [MEETING TIME].`,
    '',
    'As per procedure, the following resolution is read and presented for approval.',
    '',
    'To officially pass this resolution, each Board Member is required to review the attached resolution and submit their final vote through the RCPH Member Dashboard.',
    '',
    'After a vote is submitted, the dashboard prepares an optional confirmation email for additional documentation.',
    '',
    'A confirmed vote submitted through the authenticated RCPH Member Dashboard is official, final, and counted immediately.',
    '',
    resolutionTitleReference(resolution, ': '),
    '',
    'Document Fingerprint:',
    documentShortHash || '[SHORT HASH]',
    '',
    'Voting Deadline:',
    resolutionDeadlineText(resolution),
    '',
    'Warm regards,',
    `Rtr. ${presidentName}`,
    'President | RIY',
    'Rotaract Club of Pune Heritage',
  ].join('\n');
}

function buildDashboardResolutionNotice({ resolution, voter, documentShortHash }) {
  const authenticatedFinal = resolutionModel.isAuthenticatedFinalHybrid(resolution.approvalMethod, resolution.voteProcessingMode);
  return [
    `Dear Rtr. ${stripRotaractorPrefix(normalizeText(voter.name, 160))},`,
    '',
    `${resolutionTitleReference(resolution, ': ')} is now open for voting.`,
    '',
    'Please review the attached resolution from the official email and submit your vote through your Member Dashboard.',
    '',
    'Dashboard:',
    RESOLUTION_DASHBOARD_URL,
    '',
    'Voting Deadline:',
    resolutionDeadlineText(resolution),
    '',
    'Document Fingerprint:',
    documentShortHash,
    '',
    authenticatedFinal
      ? 'After confirming your dashboard vote, you may send the prepared confirmation email as an optional supporting record.'
      : 'After submitting your vote, use the "Open prepared email reply" option and send the confirmation from your registered email address.',
  ].join('\n');
}

async function sendResolutionDashboardNotifications({ resolutionId, resolution, voters, documentShortHash }) {
  const summary = { attempted: voters.length, sent: 0, failed: 0, skipped: 0 };
  if (!voters.length) return summary;
  if (!EMAIL_USER || !EMAIL_PASS) {
    summary.skipped = voters.length;
    return summary;
  }
  for (const voter of voters) {
    const email = normalizeEmail(voter.email);
    if (!email || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) {
      summary.failed += 1;
      continue;
    }
    try {
      await transporter.sendMail({
        from: `"RCPH Platform" <${EMAIL_USER}>`,
        to: email,
        subject: `Action Required: Vote on ${resolutionTitleReference(resolution)}`,
        text: buildDashboardResolutionNotice({ resolution, voter, documentShortHash }),
      });
      summary.sent += 1;
    } catch (error) {
      summary.failed += 1;
      console.warn('Resolution dashboard notification failed.', { resolutionId, uid: voter.uid, code: error?.code || 'smtp_failed' });
    }
  }
  return summary;
}

async function sendOfficialResolutionEmail({ resolutionId, resolution, voters }) {
  const recipients = voters.map(voter => normalizeEmail(voter.email)).filter(email => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email));
  const summary = { attempted: recipients.length, sent: 0, failed: 0, skipped: 0, attachment: 'none' };
  if (!recipients.length) return summary;
  if (!EMAIL_USER || !EMAIL_PASS) {
    summary.skipped = recipients.length;
    return summary;
  }
  const mail = {
    from: `"RCPH Platform" <${EMAIL_USER}>`,
    to: recipients.join(', '),
    replyTo: normalizeEmail(resolution.clubReplyToEmail || RESOLUTION_OFFICIAL_EMAIL) || undefined,
    subject: normalizeText(resolution.officialEmailSubject, 220) || buildDefaultOfficialEmailSubject(resolution),
    text: typeof resolution.officialEmailBody === 'string' ? resolution.officialEmailBody.slice(0, 8000) : buildDefaultOfficialEmailBody(resolution, resolution.originalDocumentShortHash, null),
  };
  if (resolutionUploads.sourceMode(resolution) === 'uploadedPdf' && resolution.uploadedSource?.driveFileId && resolution.uploadedSource?.sha256) {
    try {
      const downloaded = await resolutionDrive.downloadSourceFile({
        driveFileId: resolution.uploadedSource.driveFileId,
        resolutionId,
        uploadId: resolution.uploadedSource.uploadId,
        sha256: resolution.uploadedSource.sha256,
      });
      mail.attachments = [{
        filename: normalizeText(resolution.uploadedSource.originalFileName, 180) || 'resolution.pdf',
        content: downloaded.bytes,
        contentType: 'application/pdf',
      }];
      summary.attachment = 'uploaded_pdf';
    } catch (error) {
      console.warn('Resolution official email attachment unavailable.', { resolutionId, code: error?.code || 'attachment_failed' });
      summary.attachment = 'unavailable';
    }
  }
  try {
    const info = await transporter.sendMail(mail);
    summary.sent = recipients.length;
    summary.messageId = normalizeText(info?.messageId, 240);
  } catch (error) {
    summary.failed = recipients.length;
    console.warn('Resolution official email failed.', { resolutionId, code: error?.code || 'smtp_failed' });
  }
  return summary;
}

function publicResolutionFields(id, data) {
  const documentSourceMode = resolutionUploads.sourceMode(data);
  const uploadedSource = resolutionUploads.reportSafeSource(data.uploadedSource);
  const merge = resolutionUploads.reportSafeMerge(data.merge, data.finalizedMergedPdf);
  const isDraft = data.status === 'draft';
  const isFinal = ['passed', 'rejected', 'closed_without_decision'].includes(data.status);
  const eligibleVoterIds = Array.isArray(data.eligibleVoterIds)
    ? data.eligibleVoterIds.map(item => normalizeText(item, 128)).filter(Boolean)
    : Array.isArray(data.eligibleVoterUids) ? data.eligibleVoterUids.map(item => normalizeText(item, 128)).filter(Boolean) : [];
  const eligibleVoterUids = Array.isArray(data.eligibleVoterUids)
    ? data.eligibleVoterUids.map(item => normalizeText(item, 128)).filter(Boolean)
    : [];
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
    approvalMethod: resolutionModel.normalizeApprovalMethod(data.approvalMethod),
    voteProcessingMode: resolutionModel.normalizeVoteProcessingMode(data.voteProcessingMode),
    votingRule: resolutionModel.normalizeVotingRule(data.votingRule),
    customApprovalCount: Number.isInteger(data.customApprovalCount) ? data.customApprovalCount : null,
    appendVoteTable: data.appendVoteTable !== false,
    emailEvidenceRequired: data.emailEvidenceRequired === true,
    originalDocumentHash: normalizeText(data.originalDocumentHash, 128),
    originalDocumentShortHash: normalizeText(data.originalDocumentShortHash, 24),
    originalDocumentVersion: Number.isInteger(data.originalDocumentVersion) && data.originalDocumentVersion > 0 ? data.originalDocumentVersion : 1,
    votingOpenedAt: timestampToIso(data.votingOpenedAt || data.openedAt),
    votingClosedAt: timestampToIso(data.votingClosedAt || data.closedAt),
    votingOpenedBy: normalizeText(data.votingOpenedBy || data.openedByUid, 128),
    votingClosedBy: normalizeText(data.votingClosedBy || data.closedByUid, 128),
    eligibleVoterIds,
    officialEmailSubject: normalizeText(data.officialEmailSubject, 220),
    officialEmailBody: typeof data.officialEmailBody === 'string' ? data.officialEmailBody.slice(0, 8000) : '',
    officialEmailSentAt: timestampToIso(data.officialEmailSentAt),
    officialEmailSentBy: normalizeText(data.officialEmailSentBy, 160),
    officialEmailRecipients: Array.isArray(data.officialEmailRecipients) ? data.officialEmailRecipients.map(item => normalizeText(item, 220)).filter(Boolean) : [],
    clubReplyToEmail: normalizeText(data.clubReplyToEmail || RESOLUTION_OFFICIAL_EMAIL, 220),
    finalResult: resolutionModel.normalizeResolutionStatus(data.finalResult || data.result),
    finalPdfHash: normalizeText(data.finalPdfHash, 128),
    auditBundleHash: normalizeText(data.auditBundleHash, 128),
    eligibleVoterCount: eligibleVoterUids.length || eligibleVoterIds.length,
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
    resolutionPageConfig: resolutionModel.normalizeResolutionPageConfig(data.resolutionPageConfig, data),
    generatedPageOrder: resolutionModel.normalizeGeneratedPageOrder(data.generatedPageOrder),
    finalizedResolutionPageConfigSnapshot: data.finalizedResolutionPageConfigSnapshot ? resolutionModel.normalizeResolutionPageConfig(data.finalizedResolutionPageConfigSnapshot, data) : null,
    finalizedGeneratedPageOrderSnapshot: data.finalizedGeneratedPageOrderSnapshot ? resolutionModel.normalizeGeneratedPageOrder(data.finalizedGeneratedPageOrderSnapshot) : null,
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

function countResolutionVotes(votes, approvalMethod = 'website', voteProcessingMode = '') {
  const choices = resolutionModel.voteCountsForMethod(votes, approvalMethod, voteProcessingMode);
  return {
    approveCount: choices.filter(choice => choice === 'approve').length,
    rejectCount: choices.filter(choice => choice === 'reject').length,
    abstainCount: choices.filter(choice => choice === 'abstain').length,
    votesReceivedCount: choices.length,
  };
}

function buildFinalizedVoteRows(resolution, votes, config) {
  const method = resolutionModel.normalizeApprovalMethod(resolution.approvalMethod);
  const authenticatedFinal = resolutionModel.isAuthenticatedFinalHybrid(method, resolution.voteProcessingMode);
  const validVotes = (Array.isArray(votes) ? votes : []).filter(vote => {
    if (vote?.superseded === true) return false;
    const status = resolutionModel.normalizeEmailConfirmationStatus(vote?.emailConfirmationStatus);
    if (status === 'invalidated_document_changed' || status === 'superseded') return false;
    if (method === 'hybrid_email' && !authenticatedFinal) return status === 'email_verified';
    return true;
  });
  const voteByUid = new Map(validVotes.map(vote => [normalizeText(vote?.voterUid, 128), vote]));
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
  return validVotes.map(vote => ({
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
      emailConfirmationStatus: resolutionModel.normalizeEmailConfirmationStatus(vote.emailConfirmationStatus),
      preparedReplyText: typeof vote.preparedReplyText === 'string' ? vote.preparedReplyText.slice(0, 8000) : '',
      preparedReplyReference: normalizeText(vote.preparedReplyReference, 160),
      emailConfirmedAt: timestampToIso(vote.emailConfirmedAt),
      emailSentClaimedAt: timestampToIso(vote.emailSentClaimedAt),
      emailRejectedAt: timestampToIso(vote.emailRejectedAt),
      emailVerificationNote: normalizeText(vote.emailVerificationNote, 1000),
      requiredSenderEmail: normalizeEmail(vote.voterEmail || ''),
      documentHash: normalizeText(vote.documentHash, 128),
      documentShortHash: normalizeText(vote.documentShortHash, 24),
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

function ridSignupResult(status, memberId = '') {
  return {
    ridStatus: status,
    ridConflict: status === 'conflict',
    ...(memberId ? { memberId } : {}),
  };
}

function applySignupRidToPayload(payload, existing, rid, memberId) {
  if (!rid) return ridSignupResult('not-provided', memberId);
  const existingRid = normalizeStoredRid(existing.rid);
  if (!existingRid) {
    payload.rid = rid;
    return ridSignupResult('saved', memberId);
  }
  if (existingRid === rid) return ridSignupResult('already-matched', memberId);
  return ridSignupResult('conflict', memberId);
}

async function findMemberMatchForSignup(tx, uid, email) {
  const uidRef = db.collection('members').doc(uid);
  const uidSnap = await tx.get(uidRef);
  if (uidSnap.exists) {
    return { ref: uidRef, snap: uidSnap, match: 'uid' };
  }

  if (email) {
    const emailSnap = await tx.get(
      db.collection('members').where('email', '==', email).limit(2)
    );
    if (emailSnap.docs.length === 1) {
      const snap = emailSnap.docs[0];
      return { ref: snap.ref, snap, match: 'email' };
    }
    if (emailSnap.docs.length > 1) {
      return { ref: uidRef, snap: uidSnap, match: 'ambiguous-email' };
    }
  }

  return { ref: uidRef, snap: uidSnap, match: 'new' };
}

function setMemberProfileDoc(tx, ref, snap, profile, approvedRole, clubPosition, now, options = {}) {
  const existing = snap.exists ? (snap.data() || {}) : {};
  const payload = {
    name: stripRotaractorPrefix(profile.name || existing.name || ''),
    email: profile.email || existing.email || '',
    role: approvedRole,
    position: clubPosition,
    userId: profile.uid,
    createdFromUser: true,
    active: true,
    createdAt: existing.createdAt || now,
    updatedAt: now,
  };
  const ridResult = applySignupRidToPayload(payload, existing, options.rid || '', ref.id);
  tx.set(ref, payload, { merge: true });
  return ridResult;
}

function setSignupRidOnExistingMember(tx, ref, snap, rid, now, uid) {
  if (!rid) return ridSignupResult('not-provided', ref?.id || '');
  if (!snap?.exists) return ridSignupResult('unmatched');
  const existing = snap.data() || {};
  const payload = {
    updatedAt: now,
    updatedBy: uid,
  };
  const result = applySignupRidToPayload(payload, existing, rid, ref.id);
  if (result.ridStatus === 'saved') {
    tx.set(ref, payload, { merge: true });
  }
  return result;
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

function normalizeLegacyClubEventDescriptionFields(raw) {
  const desc = normalizeText(raw.desc || raw.description, 2500);
  const avenue = normalizeStringArray(raw.avenue, 12, 40);
  let avenueDescriptions = {};
  if (raw.avenueDescriptions !== undefined && raw.avenueDescriptions !== null) {
    try {
      const bodAvenues = bodEventSchema.normalizeBodAvenues(avenue);
      avenueDescriptions = bodEventSchema.normalizeAvenueDescriptions({
        avenues: bodAvenues,
        avenueDescriptions: raw.avenueDescriptions,
        fallbackDescription: desc,
      });
    } catch (error) {
      if (error instanceof bodEventSchema.BodEventSchemaError) {
        throw new HttpsError('invalid-argument', error.message);
      }
      throw error;
    }
  }
  return { desc, description: desc, avenue, avenues: avenue, avenueDescriptions };
}

function normalizeBodEventPayload(raw, options = {}) {
  const hasCollaborationFields = ['rcphRole', 'hostClub', 'collaborators', 'collaborationNotes']
    .some(field => Object.prototype.hasOwnProperty.call(raw || {}, field));
  const hasReportFinanceField = Object.prototype.hasOwnProperty.call(raw || {}, 'reportFinance');
  const name = normalizeText(raw.name, 180);
  const conductedBy = normalizeText(raw.conductedBy, 140);
  const date = normalizeText(raw.date || raw.eventStart, 20);
  const endDate = normalizeText(raw.endDate || raw.eventEnd || date, 20);
  const time = normalizeText(raw.time || raw.eventTime, 20);
  let bodDescriptionFields;
  try {
    bodDescriptionFields = options.allowNonBodAvenues
      ? normalizeLegacyClubEventDescriptionFields(raw || {})
      : bodEventSchema.normalizeBodEventDescriptionFields(raw || {});
  } catch (error) {
    if (error instanceof bodEventSchema.BodEventSchemaError) {
      throw new HttpsError('invalid-argument', error.message);
    }
    throw error;
  }
  let reportFinance;
  try {
    reportFinance = bodEventSchema.normalizeBodReportFinance(raw.reportFinance);
  } catch (error) {
    if (error instanceof bodEventSchema.BodEventSchemaError) {
      throw new HttpsError('invalid-argument', error.message);
    }
    throw error;
  }
  const { desc, description, avenue, avenues, avenueDescriptions } = bodDescriptionFields;
  const imageLinks = normalizeStringArray(raw.imageLinks || raw.driveLinks || raw.uploadedFileUrls, 30, 700);
  const driveLinks = normalizeStringArray(raw.driveLinks || imageLinks, 30, 700);
  const driveFolder = normalizeText(raw.driveFolder || raw.driveFolderId, 700);

  if (!name) throw new HttpsError('invalid-argument', 'Event name is required.');
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
    description,
    avenue,
    avenues,
    avenueDescriptions,
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
    reportFinance,
    _hasCollaborationFields: hasCollaborationFields,
    _hasReportFinanceField: hasReportFinanceField,
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
  }, { allowNonBodAvenues: true });
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
  const participantIds = await loadGeneralAttendanceParticipantIds();

  const attendanceSnaps = await Promise.all(
    participantIds.map(participantId => db.collection('attendance').doc(participantId).get())
  );

  let batch = db.batch();
  let batchOps = 0;
  let attendanceRowsUpdated = 0;

  for (let i = 0; i < participantIds.length; i += 1) {
    const participantId = participantIds[i];
    const attendanceSnap = attendanceSnaps[i];
    const existing = attendanceSnap.exists ? (attendanceSnap.data() || {}) : {};

    if (Object.prototype.hasOwnProperty.call(existing, eventId)) continue;

    const payload = {
      [eventId]: 'NA',
      updatedAt: now,
    };
    if (!attendanceSnap.exists || !existing.createdAt) payload.createdAt = now;

    batch.set(db.collection('attendance').doc(participantId), payload, { merge: true });
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

function isApprovedGeneralAttendanceUser(user = {}) {
  const role = normalizeRole(user.role);
  const memberType = normalizeRole(user.memberType);
  const status = normalizeRole(user.status);
  return user.active !== false
    && status === 'approved'
    && (role === 'prospect' || role === 'gbm' || memberType === 'prospect' || memberType === 'member');
}

async function loadGeneralAttendanceParticipantIds() {
  const [membersSnap, usersSnap] = await Promise.all([
    db.collection('members').get(),
    db.collection('users').get(),
  ]);
  const ids = [];
  const seen = new Set();
  const add = (id) => {
    const safeId = normalizeText(id, 128);
    if (!safeId || safeId.includes('/') || seen.has(safeId)) return;
    seen.add(safeId);
    ids.push(safeId);
  };
  membersSnap.docs
    .filter(doc => (doc.data() || {}).active !== false)
    .forEach(doc => {
      const data = doc.data() || {};
      const userId = normalizeText(data.userId || data.uid || '', 128);
      add(userId || doc.id);
    });
  usersSnap.docs
    .filter(doc => isApprovedGeneralAttendanceUser(doc.data() || {}))
    .forEach(doc => add(doc.id));
  return ids;
}

async function initializeAttendanceFieldForCollection(memberCollection, attendanceCollection, fieldId, now, options = {}) {
  const participantIds = options.includeGeneralAttendanceUsers === true
    ? await loadGeneralAttendanceParticipantIds()
    : (await db.collection(memberCollection).get()).docs
        .filter(doc => (doc.data() || {}).active !== false)
        .map(doc => doc.id);
  const attendanceSnaps = await Promise.all(
    participantIds.map(participantId => db.collection(attendanceCollection).doc(participantId).get())
  );

  let batch = db.batch();
  let batchOps = 0;
  let rowsUpdated = 0;

  for (let i = 0; i < participantIds.length; i += 1) {
    const participantId = participantIds[i];
    const attendanceSnap = attendanceSnaps[i];
    const existing = attendanceSnap.exists ? (attendanceSnap.data() || {}) : {};
    if (Object.prototype.hasOwnProperty.call(existing, fieldId)) continue;

    const payload = { [fieldId]: 'NA', updatedAt: now };
    if (!attendanceSnap.exists || !existing.createdAt) payload.createdAt = now;
    batch.set(db.collection(attendanceCollection).doc(participantId), payload, { merge: true });
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

function normalizeStoredBodReportFinance(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    try {
      return bodEventSchema.normalizeBodReportFinance(value);
    } catch {
      // Stored malformed report-only finance should not block unrelated edits.
    }
  }
  return bodEventSchema.normalizeBodReportFinance();
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
  const reportFinance = payload._hasReportFinanceField || (!bodSnap.exists && !eventSnap.exists)
    ? (payload.reportFinance || bodEventSchema.normalizeBodReportFinance())
    : normalizeStoredBodReportFinance(existingBod.reportFinance, existingEvent.reportFinance);

  const bodEventDoc = {
    name: payload.name,
    conductedBy: payload.conductedBy,
    date: payload.date,
    endDate: payload.endDate,
    time: payload.time,
    desc: payload.desc,
    description: payload.description || payload.desc,
    avenue: payload.avenue,
    avenues: payload.avenues || payload.avenue,
    avenueDescriptions: payload.avenueDescriptions || {},
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
    reportFinance,
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
    description: payload.description || payload.desc,
    avenue: payload.avenue,
    avenues: payload.avenues || payload.avenue,
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
    : signupType === DISTRICT_OFFICIAL_ROLE
      ? DISTRICT_OFFICIAL_ROLE
    : normalizeRole(data.requestedRole);

  if (!REQUESTABLE_ROLES.has(requestedRole)) {
    throw new HttpsError('invalid-argument', 'Choose Prospect, GBM, BOD, Admin, or District Official.');
  }
  if (requestedRole === 'president') {
    throw new HttpsError('permission-denied', 'President accounts are manual-only.');
  }

  if (requestedRole === DISTRICT_OFFICIAL_ROLE) {
    const availability = await visitDashboards.getSignupAvailability();
    if (availability?.available !== true) {
      throw new HttpsError('failed-precondition', 'District Official signup is not currently open.');
    }
  }

  const districtOfficialSignup = requestedRole === DISTRICT_OFFICIAL_ROLE
    ? normalizeDistrictOfficialSignupData(data)
    : null;
  const signupConsent = normalizeSignupConsentData(data, requestedRole);

  if (requestedRole === 'admin') {
    const expected = ADMIN_INVITE_CODE;
    if (!expected) {
      throw new HttpsError('failed-precondition', 'Server invite code is not configured.');
    }
    if (!inviteCodeMatches(data.inviteCode, expected)) {
      throw new HttpsError('permission-denied', 'Invalid admin invite code.');
    }
  }

  let signupRid = '';
  try {
    signupRid = normalizeRid(data.rid);
  } catch (err) {
    throwMemberProfileError(err, 'Invalid member RID.');
  }
  if ((requestedRole === 'prospect' || requestedRole === DISTRICT_OFFICIAL_ROLE) && signupRid) {
    throw new HttpsError('invalid-argument', 'RID is only accepted for existing-member signup.');
  }

  const profile = await buildProfileFromAuth(uid, request, data);
  let signupDateOfBirth = '';
  try {
    signupDateOfBirth = normalizeDateOfBirth(data.dateOfBirth);
  } catch (err) {
    throwProfileUpdateError(err, 'Invalid date of birth.');
  }
  const commonSignupData = {
    phone: normalizeText(data.phone, 40),
    dateOfBirth: signupDateOfBirth,
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

    const approvedExistingSignupRole = ACTIVE_ROLES.has(existingRole) || existingRole === DISTRICT_OFFICIAL_ROLE;
    if (roleData && approvedExistingSignupRole && isApprovedRoleDoc(roleData, existingRole)) {
      let ridResult = ridSignupResult(signupRid ? 'unmatched' : 'not-provided');
      if (signupRid && existingRole !== 'prospect') {
        const memberMatch = await findMemberMatchForSignup(tx, uid, profile.email);
        ridResult = setSignupRidOnExistingMember(tx, memberMatch.ref, memberMatch.snap, signupRid, now, uid);
      }
      const approvedProfile = {
        ...profile,
        ...(existingRole === 'prospect' && prospectSignup ? prospectSignup : {}),
        ...(existingRole === DISTRICT_OFFICIAL_ROLE && districtOfficialSignup ? districtOfficialSignup : {}),
        ...signupConsent,
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
      return { status: 'approved', role: existingRole, existing: true, shouldNotify: false, ...ridResult };
    }

    const userData = userSnap.exists ? (userSnap.data() || {}) : null;
    if (userData && String(userData.status || '').toLowerCase() === 'approved') {
      let ridResult = ridSignupResult(signupRid ? 'unmatched' : 'not-provided');
      if (signupRid && normalizeRole(userData.role) !== 'prospect') {
        const memberMatch = await findMemberMatchForSignup(tx, uid, profile.email);
        ridResult = setSignupRidOnExistingMember(tx, memberMatch.ref, memberMatch.snap, signupRid, now, uid);
      }
      return {
        status: 'approved',
        role: normalizeRole(userData.role),
        existing: true,
        shouldNotify: false,
        ...ridResult,
      };
    }

    const baseProfileData = requestedRole === DISTRICT_OFFICIAL_ROLE ? {} : commonSignupData;
    const base = {
      ...profile,
      ...baseProfileData,
      ...signupConsent,
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
      const memberMatch = await findMemberMatchForSignup(tx, uid, profile.email);
      const memberRef = memberMatch.ref;
      const memberSnap = memberMatch.snap;
      const attendanceRef = db.collection('attendance').doc(memberRef.id);
      const districtAttendanceRef = db.collection('districtAttendance').doc(memberRef.id);
      const [attendanceSnap, districtAttendanceSnap] = await Promise.all([
        tx.get(attendanceRef),
        tx.get(districtAttendanceRef),
      ]);
      const ridResult = setMemberProfileDoc(
        tx,
        memberRef,
        memberSnap,
        profile,
        'gbm',
        clubPosition,
        now,
        { rid: signupRid }
      );

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
      setDocPreservingExistingAttendance(tx, attendanceRef, attendanceSnap, eventIds, now);
      setDocPreservingExistingAttendance(tx, districtAttendanceRef, districtAttendanceSnap, districtEventIds, now);
      return { status: 'approved', role: 'gbm', existing: false, shouldNotify: !userSnap.exists, ...ridResult };
    }

    let pendingRidResult = ridSignupResult(signupRid ? 'unmatched' : 'not-provided');
    if (signupRid) {
      const memberMatch = await findMemberMatchForSignup(tx, uid, profile.email);
      pendingRidResult = setSignupRidOnExistingMember(tx, memberMatch.ref, memberMatch.snap, signupRid, now, uid);
    }
    const pendingRidMetadata = signupRid
      ? {
          requestedRid: signupRid,
          requestedRidStatus: pendingRidResult.ridStatus,
          requestedRidConflict: pendingRidResult.ridConflict === true,
          requestedRidMemberId: pendingRidResult.memberId || '',
        }
      : {};

    tx.set(userRef, {
      ...base,
      ...(districtOfficialSignup || {}),
      ...pendingRidMetadata,
      role: requestedRole === DISTRICT_OFFICIAL_ROLE ? DISTRICT_OFFICIAL_ROLE : 'pending',
      status: 'pending',
      createdAt: userData?.createdAt || now,
    }, { merge: true });
    return {
      status: 'pending',
      role: requestedRole === DISTRICT_OFFICIAL_ROLE ? DISTRICT_OFFICIAL_ROLE : 'pending',
      requestedRole,
      existing: false,
      shouldNotify: !userSnap.exists,
      ...pendingRidResult,
    };
  });

  if (result.shouldNotify) {
    const notificationData = {
      uid,
      name: stripRotaractorPrefix(profile.name),
      email: profile.email,
      phone: commonSignupData.phone,
      rid: signupRid,
      requestedRole,
      role: result.role,
      signupType: requestedRole === 'prospect'
        ? 'prospect'
        : requestedRole === DISTRICT_OFFICIAL_ROLE
          ? DISTRICT_OFFICIAL_SIGNUP_TYPE
          : 'internal',
      status: result.status,
      gender: commonSignupData.gender,
      genderSelfDescribe: commonSignupData.genderSelfDescribe,
      ...(prospectSignup || {}),
      ...(districtOfficialSignup || {}),
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

exports.updateMemberProfile = onCall(CALLABLE_OPTIONS, async (request) => {
  const actorUid = requireAuth(request);
  await assertAdminOrPresidentAuthority(actorUid);

  try {
    return await profileUpdates.updateAdminProfile({
      actorUid,
      data: request.data || {},
    });
  } catch (err) {
    throwProfileUpdateError(err, 'Profile update failed.');
  }
});

exports.updateMyProfile = onCall(CALLABLE_OPTIONS, async (request) => {
  const actorUid = requireAuth(request);

  try {
    return await profileUpdates.updateSelfProfile({
      actorUid,
      data: request.data || {},
    });
  } catch (err) {
    throwProfileUpdateError(err, 'Profile update failed.');
  }
});

exports.getProfileChangeHistory = onCall(CALLABLE_OPTIONS, async (request) => {
  const actorUid = requireAuth(request);
  await assertAdminOrPresidentAuthority(actorUid);
  const data = request.data || {};

  try {
    return await profileUpdates.getProfileChangeHistory({
      actorUid,
      targetUid: data.targetUid,
      limit: Number.isInteger(data.limit) ? data.limit : undefined,
      cursor: data.cursor || null,
    });
  } catch (err) {
    throwProfileUpdateError(err, 'Profile history could not be loaded.');
  }
});


exports.approveUserRole = onCall(CALLABLE_OPTIONS, async (request) => {
  const approverUid = requireAuth(request);
  const approverAuthority = await assertAdminOrPresidentAuthority(approverUid);
  const approverSyncAuthority = rolePositionSyncAuthority(approverAuthority);

  const data = request.data || {};
  const targetUid = normalizeText(data.targetUid, 128);
  const approvedRole = normalizeRole(data.approvedRole);
  if (!targetUid || !APPROVABLE_ROLES.has(approvedRole)) {
    throw new HttpsError('invalid-argument', 'Valid target user and approved role required.');
  }

  const positionKeysProvided = Object.prototype.hasOwnProperty.call(data, 'positionKeys');
  const syncOptions = {
    actorUid: approverUid,
    ...approverSyncAuthority,
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
  const actorSyncAuthority = rolePositionSyncAuthority(actorAuthority);

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
    ...actorSyncAuthority,
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

exports.previewRemovePersonProfile = onCall(CALLABLE_OPTIONS, async (request) => {
  const actorUid = requireAuth(request);
  return profileRemoval.previewRemovePersonProfile({
    actorUid,
    data: request.data || {},
  });
});

exports.removePersonProfile = onCall(CALLABLE_OPTIONS, async (request) => {
  const actorUid = requireAuth(request);
  return profileRemoval.removePersonProfile({
    actorUid,
    data: request.data || {},
  });
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
  const actorSyncAuthority = rolePositionSyncAuthority(actorAuthority);

  const data = request.data || {};
  const targetUid = normalizeText(data.targetUid, 128);
  const role = normalizeRole(data.role);
  if (!targetUid || !APPROVABLE_ROLES.has(role)) {
    throw new HttpsError('invalid-argument', 'Valid target user and role required.');
  }

  const positionKeysProvided = Object.prototype.hasOwnProperty.call(data, 'positionKeys');
  const result = await syncUserAccessAndPositionsWithAttendance({
    actorUid,
    ...actorSyncAuthority,
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

exports.getVisitSignupAvailability = onCall(CALLABLE_OPTIONS, async () => {
  try {
    return await visitDashboards.getSignupAvailability();
  } catch (err) {
    throwCallableServiceError(err, 'Visit signup availability request failed.');
  }
});

exports.getVisitDashboardConfigs = onCall(CALLABLE_OPTIONS, async (request) => {
  try {
    const uid = requireAuth(request);
    return await visitDashboards.getConfigs(uid);
  } catch (err) {
    throwCallableServiceError(err, 'Visit dashboard config request failed.');
  }
});

exports.updateVisitDashboardConfig = onCall(CALLABLE_OPTIONS, async (request) => {
  try {
    const uid = requireAuth(request);
    return await visitDashboards.updateConfig(uid, request.data || {});
  } catch (err) {
    throwCallableServiceError(err, 'Visit dashboard config update failed.');
  }
});

exports.getVisitDashboardFolderOptions = onCall(CALLABLE_OPTIONS, async (request) => {
  try {
    const uid = requireAuth(request);
    return await visitDashboards.getFolderOptions(uid, request.data?.visitType);
  } catch (err) {
    throwCallableServiceError(err, 'Visit dashboard folder options request failed.');
  }
});

exports.getVisitDashboardData = onCall(CALLABLE_OPTIONS, async (request) => {
  try {
    const uid = requireAuth(request);
    const [userSnap, activeRole] = await Promise.all([
      db.collection('users').doc(uid).get(),
      getActiveRole(uid),
    ]);
    return await visitDashboards.getDashboardData({
      uid,
      visitType: request.data?.visitType,
      role: activeRole?.role || '',
      roleData: activeRole?.data || null,
      userData: userSnap.exists ? (userSnap.data() || {}) : null,
    });
  } catch (err) {
    throwCallableServiceError(err, 'Visit dashboard data request failed.');
  }
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
const [
  userSnap,
  roleSnap,
  cwdAssignmentSnap,
  presidentAssignmentSnap,
  saaAssignmentSnap,
] = await Promise.all([
  db.collection('users').doc(uid).get(),
  db.collection('roles').doc(uid).get(),
  db.collection('bodPositionAssignments')
    .doc(`${positionHelpers.WEBSITE_DIRECTOR_POSITION_KEY}_${uid}`)
    .get(),
  db.collection('bodPositionAssignments').doc(`president_${uid}`).get(),
  db.collection('bodPositionAssignments').doc(`saa_${uid}`).get(),
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
  saaAssignmentSnap,
});
  const resolutionManager = await hasResolutionManagerAuthority(uid, { activeRole, userSnap });
  const userData = userSnap.exists ? (userSnap.data() || {}) : null;
  const canAccessLockTools = hasLockToolsAuthority(authorityContext, userData);
  const canAccessResolutionTools = hasResolutionToolsAuthority({
    role: authorityContext.role,
    userData,
    resolutionManager,
  });
  const visitDashboardAccess = isApprovedActiveUserRecord(userData) && role
    ? await visitDashboards.getAccessForRole({ role, roleData })
    : visitDashboards.emptyAccess();

  return {
    ok: true,
    uid,
    user: userSnap.exists ? userSnap.data() : null,
    role: roleSnap.exists ? roleSnap.data() : null,
    positionKeys: authorityContext.positionKeys,
    positionSource: authorityContext.positionSource,
    authority: authorityContext.authority,
    resolutionManager,
    canAccessLockTools,
    canAccessResolutionTools,
    ...visitDashboardAccess,
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
        dateOfBirth: profileUpdates.safeProfileFromUserData(user, 'prospect').dateOfBirth,
        gender: normalizeText(user.gender, 40).toLowerCase(),
        genderSelfDescribe: normalizeText(user.genderSelfDescribe, 160),
        hobbies: normalizeText(user.hobbies, 600),
        previousRotaract: user.previousRotaract === true,
        joinReason: normalizeText(user.joinReason, 1200),
        referred: user.referred === true,
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

exports.deleteProspectAccount = onCall(CALLABLE_OPTIONS, async (request) => {
  const actorUid = requireAuth(request);
  const actorAuthority = await assertAdminOrPresidentAuthority(actorUid);
  await assertApprovedActiveCallableAccount(actorUid);
  const uid = normalizeText(request.data?.uid, 128);
  if (!uid || uid.includes('/')) throw new HttpsError('invalid-argument', 'Prospect uid is required.');
  if (uid === actorUid) throw new HttpsError('failed-precondition', 'You cannot delete your own account.');

  const refs = {
    user: db.collection('users').doc(uid),
    role: db.collection('roles').doc(uid),
    progress: db.collection('prospectProgress').doc(uid),
    member: db.collection('members').doc(uid),
    attendance: db.collection('attendance').doc(uid),
    districtAttendance: db.collection('districtAttendance').doc(uid),
    bodMember: db.collection('bodMembers').doc(uid),
    bodAttendance: db.collection('bodAttendance').doc(uid),
  };
  const [
    userSnap,
    roleSnap,
    progressSnap,
    memberSnap,
    attendanceSnap,
    districtAttendanceSnap,
    bodMemberSnap,
    bodAttendanceSnap,
    memberByUserIdSnap,
    memberByUidSnap,
    bodMemberByUserIdSnap,
    bodMemberByUidSnap,
    deliverySnap,
  ] = await Promise.all([
    refs.user.get(),
    refs.role.get(),
    refs.progress.get(),
    refs.member.get(),
    refs.attendance.get(),
    refs.districtAttendance.get(),
    refs.bodMember.get(),
    refs.bodAttendance.get(),
    db.collection('members').where('userId', '==', uid).get(),
    db.collection('members').where('uid', '==', uid).get(),
    db.collection('bodMembers').where('userId', '==', uid).get(),
    db.collection('bodMembers').where('uid', '==', uid).get(),
    db.collection(ANNOUNCEMENT_DELIVERIES_COLLECTION).where('uid', '==', uid).get(),
  ]);
  const user = userSnap.exists ? (userSnap.data() || {}) : null;
  const progress = progressSnap.exists ? (progressSnap.data() || {}) : {};
  const role = roleSnap.exists ? (roleSnap.data() || {}) : {};
  if (!user || user.active === false || normalizeRole(user.status) !== 'approved' || !isActiveProspectRecord(user) || isPromotedProspectRecord(user, progress)) {
    throw new HttpsError('failed-precondition', 'Only a current approved Prospect account can be deleted.');
  }
  if (roleSnap.exists && normalizeRole(role.role) && normalizeRole(role.role) !== 'prospect') {
    throw new HttpsError('failed-precondition', 'The account is no longer a Prospect.');
  }

  let authDeleted = false;
  let authMissing = false;
  try {
    await admin.auth().deleteUser(uid);
    authDeleted = true;
  } catch (err) {
    if (err?.code === 'auth/user-not-found') authMissing = true;
    else throw new HttpsError('unavailable', 'Firebase Auth user could not be deleted.');
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  const deletedPaths = [];
  const deletedPathSet = new Set();
  const operations = [];
  function deleteRefIfExists(ref, exists) {
    if (!exists || deletedPathSet.has(ref.path)) return;
    deletedPathSet.add(ref.path);
    deletedPaths.push(ref.path);
    operations.push(batch => batch.delete(ref));
  }
  function deleteIfExists(ref, snap) {
    deleteRefIfExists(ref, snap.exists);
  }
  deleteIfExists(refs.user, userSnap);
  deleteIfExists(refs.role, roleSnap);
  deleteIfExists(refs.progress, progressSnap);
  deleteIfExists(refs.member, memberSnap);
  deleteIfExists(refs.attendance, attendanceSnap);
  deleteIfExists(refs.districtAttendance, districtAttendanceSnap);
  deleteIfExists(refs.bodMember, bodMemberSnap);
  deleteIfExists(refs.bodAttendance, bodAttendanceSnap);
  [memberByUserIdSnap, memberByUidSnap, bodMemberByUserIdSnap, bodMemberByUidSnap].forEach(querySnap => {
    querySnap.docs.forEach(doc => deleteRefIfExists(doc.ref, true));
  });
  deliverySnap.docs.forEach(doc => {
    deleteRefIfExists(doc.ref, true);
  });
  const auditRef = db.collection(ADMIN_MAINTENANCE_AUDIT_COLLECTION).doc();
  operations.push(batch => batch.set(auditRef, {
    action: 'prospect_deleted',
    actorUid,
    actorRole: actorAuthority.role || '',
    targetUid: uid,
    targetEmail: normalizeEmail(user.email || ''),
    targetName: stripRotaractorPrefix(normalizeText(user.name || '', 160)),
    authDeleted,
    authMissing,
    deletedPaths,
    deletedDeliveryCount: deliverySnap.size,
    createdAt: now,
  }));
  await commitFirestoreOperations(operations);

  return { ok: true, uid, authDeleted, authMissing, deletedPaths };
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

exports.createFine = onCall(
  CALLABLE_OPTIONS,
  async (request) => {
    const actorUid = requireAuth(request);

    const authority =
      await assertAdminOrPresidentAuthority(
        actorUid
      );

    await assertApprovedActiveCallableAccount(
      actorUid
    );

    await assertPanelUnlockedForRole(
      'fines',
      authority,
      'Fines'
    );

    await assertPanelUnlockedForRole(
      'treasury',
      authority,
      'Treasury'
    );

    const data = request.data || {};

    const fineId =
      validateFineDocumentId(data.fineId);

    const memberId =
      normalizeText(data.memberId, 128);

    if (
      !memberId
      || memberId.includes('/')
    ) {
      throw new HttpsError(
        'invalid-argument',
        'Valid member required.'
      );
    }

    const reason =
      normalizeFineReason(data.reason);

    const amount =
      normalizeFineAmount(data.amount);

    const fineDate =
      normalizeFineDate(
        data.date,
        'date'
      );

    const eventSource =
      normalizeText(data.eventSource, 40);

    const eventId =
      validateEventDocId(data.eventId);

    const memberRef =
      db.collection('members').doc(memberId);

    const eventRef =
      getFineEventRef(
        eventSource,
        eventId
      );

    const fineRef =
      db.collection('fines').doc(fineId);

    const treasuryEntryId =
      `fine_${fineId}`;

    const treasuryRef =
      db
        .collection('treasury')
        .doc(treasuryEntryId);

    const auditRef =
      db
        .collection(
          ADMIN_MAINTENANCE_AUDIT_COLLECTION
        )
        .doc();

    const actorProfile =
      await getCallableUserProfile(
        actorUid,
        request
      );

    let created = false;

    await db.runTransaction(async (tx) => {
      const [
        memberSnap,
        eventSnap,
        fineSnap,
        treasurySnap,
      ] = await Promise.all([
        tx.get(memberRef),
        tx.get(eventRef),
        tx.get(fineRef),
        tx.get(treasuryRef),
      ]);

      if (!memberSnap.exists) {
        throw new HttpsError(
          'not-found',
          'Member not found.'
        );
      }

      const memberData =
        memberSnap.data() || {};

      if (memberData.active === false) {
        throw new HttpsError(
          'failed-precondition',
          'Inactive members cannot receive fines.'
        );
      }

      if (!eventSnap.exists) {
        throw new HttpsError(
          'not-found',
          'Event or meeting not found.'
        );
      }

      const eventData =
        eventSnap.data() || {};

      const event =
        resolveFineEventSnapshot({
          eventSource,
          eventId,
          eventData,
        });

      /*
       * Safe idempotency:
       * if both linked records already exist and
       * match each other, return success without
       * creating duplicates.
       */
      if (
        fineSnap.exists
        || treasurySnap.exists
      ) {
        const existingFine =
          fineSnap.exists
            ? fineSnap.data() || {}
            : {};

        const existingTreasury =
          treasurySnap.exists
            ? treasurySnap.data() || {}
            : {};

        const validExistingPair =
          fineSnap.exists
          && treasurySnap.exists
          && existingFine.treasuryEntryId
            === treasuryEntryId
          && existingTreasury.source
            === 'fine'
          && existingTreasury.fineId
            === fineId;

        if (validExistingPair) {
          created = false;
          return;
        }

        throw new HttpsError(
          'already-exists',
          'A conflicting Fine or Treasury record already exists.'
        );
      }

      const now =
        admin.firestore.FieldValue
          .serverTimestamp();

      const memberName =
        stripRotaractorPrefix(
          normalizeText(
            memberData.name
              || data.memberName,
            160
          )
        );

      if (!memberName) {
        throw new HttpsError(
          'failed-precondition',
          'Member name is unavailable.'
        );
      }

      const treasuryAvenue =
        treasuryAvenueForFine(
          event.eventType,
          eventData
        );

      const finePayload = {
        memberId,
        memberName,
        reason,
        amount,
        date: fineDate,

        eventId: event.eventId,
        eventSource: event.eventSource,
        eventType: event.eventType,
        eventName: event.eventName,
        eventDate: event.eventDate,

        treasuryEntryId,

        createdAt: now,
        createdBy: actorUid,
        createdByName:
          actorProfile.name || '',
        updatedAt: now,
        updatedBy: actorUid,
      };

      const treasuryPayload = {
        title: `Fine - ${reason}`,
        name: `Fine - ${reason}`,

        type: 'income',
        amount,
        date: fineDate,

        avenue: treasuryAvenue,

        purpose:
          `Fine - ${reason} - ${memberName}`,

        linkedEventName:
          event.eventName,

        paidBy: memberName,
        paidByType: 'member',
        paidByMemberId: memberId,

        paidTo: '',
        paidToType: '',
        paidToMemberId: '',

        paymentMode: '',
        referenceNumber:
          `FINE-${fineId}`,

        reimbursementStatus:
          'Not Applicable',

        reimbursedTo: '',
        reimbursementDate: '',

        source: 'fine',
        fineId,

        memberId,
        memberName,

        eventId: event.eventId,
        eventSource: event.eventSource,
        eventType: event.eventType,
        eventName: event.eventName,
        eventDate: event.eventDate,

        createdAt: now,
        createdByUid: actorUid,
        createdByName:
          actorProfile.name || '',

        updatedAt: now,
        updatedByUid: actorUid,
        updatedByName:
          actorProfile.name || '',
      };

      tx.create(fineRef, finePayload);

      tx.create(
        treasuryRef,
        treasuryPayload
      );

      tx.set(auditRef, {
        action: 'fine_created',
        actorUid,
        actorRole:
          authority.role || '',
        fineId,
        treasuryEntryId,
        memberId,
        memberName,
        amount,
        reason,
        eventId: event.eventId,
        eventSource:
          event.eventSource,
        eventName: event.eventName,
        createdAt: now,
      });

      created = true;
    });

    return {
      ok: true,
      created,
      fineId,
      treasuryEntryId,
    };
  }
);

exports.deleteFine = onCall(
  CALLABLE_OPTIONS,
  async (request) => {
    const actorUid = requireAuth(request);

    const authority =
      await assertAdminOrPresidentAuthority(
        actorUid
      );

    await assertApprovedActiveCallableAccount(
      actorUid
    );

    await assertPanelUnlockedForRole(
      'fines',
      authority,
      'Fines'
    );

    await assertPanelUnlockedForRole(
      'treasury',
      authority,
      'Treasury'
    );

    const fineId =
      validateFineDocumentId(
        request.data?.fineId
      );

    const fineRef =
      db.collection('fines').doc(fineId);

    const auditRef =
      db
        .collection(
          ADMIN_MAINTENANCE_AUDIT_COLLECTION
        )
        .doc();

    let treasuryDeleted = false;

    await db.runTransaction(async (tx) => {
      const fineSnap =
        await tx.get(fineRef);

      if (!fineSnap.exists) {
        throw new HttpsError(
          'not-found',
          'Fine not found.'
        );
      }

      const fineData =
        fineSnap.data() || {};

      /*
       * New Fines store treasuryEntryId.
       * Historical Fines may not.
       */
      const treasuryEntryId =
        normalizeText(
          fineData.treasuryEntryId,
          128
        );

      let treasuryRef = null;
      let treasurySnap = null;

      if (treasuryEntryId) {
        treasuryRef =
          db
            .collection('treasury')
            .doc(treasuryEntryId);

        treasurySnap =
          await tx.get(treasuryRef);
      }

      if (treasurySnap?.exists) {
        const treasuryData =
          treasurySnap.data() || {};

        if (
          treasuryData.source !== 'fine'
          || treasuryData.fineId !== fineId
        ) {
          throw new HttpsError(
            'failed-precondition',
            'The linked Treasury record does not match this Fine.'
          );
        }

        tx.delete(treasuryRef);
        treasuryDeleted = true;
      }

      const now =
        admin.firestore.FieldValue
          .serverTimestamp();

      tx.set(auditRef, {
        action: 'fine_deleted',
        actorUid,
        actorRole:
          authority.role || '',

        fineId,
        treasuryEntryId:
          treasuryEntryId || null,

        treasuryDeleted,

        memberId:
          normalizeText(
            fineData.memberId,
            128
          ),

        memberName:
          normalizeText(
            fineData.memberName,
            160
          ),

        amount:
          Number(fineData.amount) || 0,

        reason:
          normalizeText(
            fineData.reason,
            120
          ),

        eventId:
          normalizeText(
            fineData.eventId,
            128
          ),

        eventName:
          normalizeText(
            fineData.eventName,
            180
          ),

        historicalFineWithoutLink:
          !treasuryEntryId,

        createdAt: now,
      });

      tx.delete(fineRef);
    });

    return {
      ok: true,
      fineId,
      treasuryDeleted,
    };
  }
);

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

exports.createAnnouncementAttachmentUploadSession = onCall(ANNOUNCEMENT_ATTACHMENT_CALLABLE_OPTIONS, async (request) => {
  const actorUid = requireAuth(request);
  try {
    return await announcementAttachments.createUploadSession(actorUid, request.data || {});
  } catch (err) {
    throwCallableServiceError(err, 'Could not prepare announcement attachment upload.');
  }
});

exports.removeAnnouncementAttachmentUpload = onCall(ANNOUNCEMENT_ATTACHMENT_CALLABLE_OPTIONS, async (request) => {
  const actorUid = requireAuth(request);
  try {
    return await announcementAttachments.removeUpload(actorUid, request.data || {});
  } catch (err) {
    throwCallableServiceError(err, 'Could not remove announcement attachment.');
  }
});

exports.publishAnnouncement = onCall(ANNOUNCEMENT_ATTACHMENT_CALLABLE_OPTIONS, async (request) => {
  const actorUid = requireAuth(request);
  await assertAdminOrPresidentAuthority(actorUid);
  await assertApprovedActiveCallableAccount(actorUid);

  const announcement = normalizeAnnouncementPayload(request.data || {});
  const announcementRef = db.collection(ANNOUNCEMENTS_COLLECTION).doc();
  const announcementId = announcementRef.id;
  const timestamp = admin.firestore.FieldValue.serverTimestamp();
  let reservedAttachmentSessionId = '';
  let attachment = null;
  let emailAttachment = null;

  try {
    if (announcement.attachmentSessionId) {
      attachment = await announcementAttachments.reserveForPublish(actorUid, announcement.attachmentSessionId, announcementId);
      reservedAttachmentSessionId = announcement.attachmentSessionId;
      if (announcement.emailRequested) {
        if (attachment.sizeBytes > ANNOUNCEMENT_ATTACHMENT_EMAIL_MAX_BYTES) {
          throw new HttpsError('failed-precondition', 'Attachment is too large for announcement email delivery.');
        }
        const downloaded = await announcementAttachments.downloadAttachmentBytes(attachment);
        emailAttachment = announcementAttachments.emailAttachmentFromBytes(attachment, downloaded.bytes);
      }
    }

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
      attachment,
    });

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

    if (reservedAttachmentSessionId) {
      await announcementAttachments.markPublished(actorUid, reservedAttachmentSessionId, announcementId);
    }

    let emailSummary = { ...ANNOUNCEMENT_EMAIL_SUMMARY_DEFAULT };
    if (announcement.emailRequested) {
      try {
        emailSummary = await sendAnnouncementEmails({
          announcementId,
          announcement,
          recipients,
          emailAttachment,
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
        attachment: announcementAttachments.reportSafeAttachment(attachment),
      },
      emailSummary,
    };
  } catch (err) {
    if (reservedAttachmentSessionId) await announcementAttachments.releaseReservation(actorUid, reservedAttachmentSessionId, announcementId);
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

exports.archiveAnnouncement = onCall(CALLABLE_OPTIONS, async (request) => {
  const actorUid = requireAuth(request);
  const actorAuthority = await assertAdminOrPresidentAuthority(actorUid);
  await assertApprovedActiveCallableAccount(actorUid);
  const announcementId = validateAnnouncementDocId(request.data?.announcementId, 'announcementId');
  const announcementRef = db.collection(ANNOUNCEMENTS_COLLECTION).doc(announcementId);
  const auditRef = db.collection(ADMIN_MAINTENANCE_AUDIT_COLLECTION).doc();
  const now = admin.firestore.FieldValue.serverTimestamp();

  await db.runTransaction(async tx => {
    const snap = await tx.get(announcementRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Announcement not found.');
    const data = snap.data() || {};
    if (data.status === 'archived') return;
    if (data.status !== 'published') {
      throw new HttpsError('failed-precondition', 'Only published announcements are archived. Unpublished announcements may be deleted.');
    }
    tx.set(announcementRef, {
      status: 'archived',
      archivedFromStatus: data.status,
      archivedAt: now,
      archivedBy: actorUid,
      updatedAt: now,
    }, { merge: true });
    tx.set(auditRef, {
      action: 'announcement_archived',
      actorUid,
      actorRole: actorAuthority.role || '',
      announcementId,
      title: normalizeText(data.title, 160),
      previousStatus: data.status,
      recipientCount: normalizeNonNegativeInteger(data.recipientCount, 0),
      createdAt: now,
    });
  });

  return { ok: true, announcementId, status: 'archived' };
});

exports.deleteAnnouncement = onCall(ANNOUNCEMENT_ATTACHMENT_CALLABLE_OPTIONS, async (request) => {
  const actorUid = requireAuth(request);
  const actorAuthority = await assertAdminOrPresidentAuthority(actorUid);
  await assertApprovedActiveCallableAccount(actorUid);
  const announcementId = validateAnnouncementDocId(request.data?.announcementId, 'announcementId');
  const announcementRef = db.collection(ANNOUNCEMENTS_COLLECTION).doc(announcementId);
  const [announcementSnap, deliveriesSnap] = await Promise.all([
    announcementRef.get(),
    db.collection(ANNOUNCEMENT_DELIVERIES_COLLECTION).where('announcementId', '==', announcementId).get(),
  ]);
  if (!announcementSnap.exists) throw new HttpsError('not-found', 'Announcement not found.');
  const data = announcementSnap.data() || {};
  const status = normalizeAnnouncementHistoryStatus(data.status);
  if (status === 'published' || (status === 'archived' && data.archivedFromStatus === 'published')) {
    throw new HttpsError('failed-precondition', 'Published announcements must be archived, not deleted.');
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  const deletedPaths = [announcementRef.path, ...deliveriesSnap.docs.map(doc => doc.ref.path)];
  const auditRef = db.collection(ADMIN_MAINTENANCE_AUDIT_COLLECTION).doc();
  const operations = [
    batch => batch.set(auditRef, {
      action: 'announcement_deleted',
      actorUid,
      actorRole: actorAuthority.role || '',
      announcementId,
      title: normalizeText(data.title, 160),
      previousStatus: data.status || '',
      recipientCount: normalizeNonNegativeInteger(data.recipientCount, 0),
      deliveryCount: deliveriesSnap.size,
      deletedPaths,
      createdAt: now,
    }),
    batch => batch.delete(announcementRef),
    ...deliveriesSnap.docs.map(doc => batch => batch.delete(doc.ref)),
  ];
  await commitFirestoreOperations(operations);

  let attachmentRemoved = false;
  if (data.attachment?.status === 'ready') {
    try {
      const result = await announcementAttachments.deleteAttachmentFile(data.attachment);
      attachmentRemoved = result.removed === true;
    } catch (err) {
      console.warn('Announcement attachment cleanup after delete failed.', { announcementId, code: err?.code || 'drive-delete-failed' });
    }
  }

  return { ok: true, announcementId, deletedPaths, attachmentRemoved };
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
  if (payload.approvalMethod !== 'record_only' && !voters.length) throw new HttpsError('failed-precondition', 'No UID-linked active BOD voters are available.');
  const selectedVoters = resolveSelectedResolutionVoters(payload, voters);
  validateResolutionCustomCount(payload, selectedVoters.length);
  const voterByUid = new Map(voters.map(voter => [voter.uid, voter]));
  const proposer = payload.proposedByUid ? voterByUid.get(payload.proposedByUid) : { name: '', position: '' };
  const seconder = payload.secondedByUid ? voterByUid.get(payload.secondedByUid) : { name: '', position: '' };
  if (payload.proposedByUid && !proposer) throw new HttpsError('failed-precondition', 'Proposer must be an active UID-linked BOD member.');
  if (payload.secondedByUid && !seconder) throw new HttpsError('failed-precondition', 'Seconder must be an active UID-linked BOD member.');
  const meeting = meetingSnap.data() || {};
  if (!normalizeText(meeting.name, 220) || !/^\d{4}-\d{2}-\d{2}$/.test(String(meeting.date || ''))) {
    throw new HttpsError('failed-precondition', 'Linked BOD meeting is incomplete.');
  }
  return {
    payload,
    meeting: { id: meetingSnap.id, title: normalizeText(meeting.name, 220), date: String(meeting.date) },
    proposer,
    seconder,
    selectedVoters,
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
  const numberRef = prepared.payload.resolutionNumber
    ? db.collection(RESOLUTION_NUMBER_INDEX_COLLECTION).doc(resolutionNumberIndexId(prepared.payload.resolutionNumber))
    : null;
  const now = resolutionTimestamp();
  await db.runTransaction(async tx => {
    if (numberRef) {
      const numberSnap = await tx.get(numberRef);
      if (numberSnap.exists) throw new HttpsError('already-exists', 'Resolution number already exists.');
    }
    tx.set(resolutionRef, {
      ...prepared.payload,
      meetingTitle: prepared.meeting.title,
      meetingDate: prepared.meeting.date,
      proposedByName: prepared.proposer.name,
      proposedByPosition: prepared.proposer.position,
      secondedByName: prepared.seconder.name,
      secondedByPosition: prepared.seconder.position,
      status: 'draft',
      voteProcessingMode: '',
      eligibleVoters: [],
      eligibleVoterUids: [],
      eligibleVoterIds: prepared.payload.eligibleVoterIds,
      eligibleVoterSnapshot: [],
      originalDocumentHash: '',
      originalDocumentShortHash: '',
      originalDocumentVersion: 1,
      openedAt: null,
      openedByUid: null,
      openedByName: null,
      openedByPosition: null,
      votingOpenedAt: null,
      votingOpenedBy: null,
      closedAt: null,
      closedByUid: null,
      closedByName: null,
      closedByPosition: null,
      votingClosedAt: null,
      votingClosedBy: null,
      officialEmailSentAt: null,
      officialEmailSentBy: null,
      emailEvidenceRequired: false,
      finalResult: null,
      finalPdfHash: '',
      auditBundleHash: '',
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
    if (numberRef) tx.set(numberRef, { resolutionId: resolutionRef.id, resolutionNumber: prepared.payload.resolutionNumber, createdAt: now });
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
    const oldNumberRef = existing.resolutionNumber
      ? db.collection(RESOLUTION_NUMBER_INDEX_COLLECTION).doc(resolutionNumberIndexId(existing.resolutionNumber))
      : null;
    const newNumberRef = prepared.payload.resolutionNumber
      ? db.collection(RESOLUTION_NUMBER_INDEX_COLLECTION).doc(resolutionNumberIndexId(prepared.payload.resolutionNumber))
      : null;
    const numberChanged = (oldNumberRef?.id || '') !== (newNumberRef?.id || '');
    if (numberChanged) {
      if (newNumberRef) {
        const newNumberSnap = await tx.get(newNumberRef);
        if (newNumberSnap.exists && newNumberSnap.data()?.resolutionId !== resolutionId) {
          throw new HttpsError('already-exists', 'Resolution number already exists.');
        }
      }
      if (oldNumberRef) tx.delete(oldNumberRef);
      if (newNumberRef) tx.set(newNumberRef, { resolutionId, resolutionNumber: prepared.payload.resolutionNumber, createdAt: existing.createdAt || now, updatedAt: now });
    }
    tx.update(resolutionRef, {
      ...prepared.payload,
      meetingTitle: prepared.meeting.title,
      meetingDate: prepared.meeting.date,
      proposedByName: prepared.proposer.name,
      proposedByPosition: prepared.proposer.position,
      secondedByName: prepared.seconder.name,
      secondedByPosition: prepared.seconder.position,
      voteProcessingMode: '',
      emailEvidenceRequired: false,
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
    if (existing.status !== 'draft') throw new HttpsError('failed-precondition', 'The Resolution PDF source cannot change after voting opens.');
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
  const approvalMethod = resolutionModel.normalizeApprovalMethod(before.approvalMethod);
  const voteProcessingMode = approvalMethod === 'hybrid_email' ? 'authenticated_final' : '';
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
  if (approvalMethod !== 'record_only' && !voters.length) throw new HttpsError('failed-precondition', 'No UID-linked active BOD voters are available.');
  const selectedVoters = resolveSelectedResolutionVoters(before, voters);
  validateResolutionCustomCount(before, selectedVoters.length);
  const resolutionRef = meetingCheck.ref;
  const now = resolutionTimestamp();
  const documentHash = buildResolutionDocumentHash(before);
  const documentShortHash = shortResolutionHash(documentHash);
  const eligibleSnapshot = resolutionModel.buildEligibleVoterSnapshot(selectedVoters, selectedVoters.map(voter => voter.uid));
  const officialEmailSubject = normalizeText(before.officialEmailSubject, 220) || buildDefaultOfficialEmailSubject(before);
  const officialEmailBody = normalizeText(before.officialEmailBody, 8000) || buildDefaultOfficialEmailBody(before, documentShortHash, actor);
  const commonFrozenFields = {
    eligibleVoters: eligibleSnapshot.map(voter => ({ uid: voter.uid, name: voter.name, email: voter.email, role: voter.role, position: voter.position, eligibilityReason: voter.eligibilityReason, active: voter.active })),
    eligibleVoterUids: eligibleSnapshot.map(voter => voter.uid),
    eligibleVoterIds: eligibleSnapshot.map(voter => voter.uid),
    eligibleVoterSnapshot: eligibleSnapshot,
    originalDocumentHash: documentHash,
    originalDocumentShortHash: documentShortHash,
    originalDocumentVersion: Number.isInteger(before.originalDocumentVersion) && before.originalDocumentVersion > 0 ? before.originalDocumentVersion : 1,
    officialEmailSubject,
    officialEmailBody,
    officialEmailRecipients: eligibleSnapshot.map(voter => voter.email).filter(Boolean),
    clubReplyToEmail: normalizeEmail(before.clubReplyToEmail || RESOLUTION_OFFICIAL_EMAIL),
    voteProcessingMode,
    emailEvidenceRequired: false,
  };
  await db.runTransaction(async tx => {
    const snap = await tx.get(resolutionRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Resolution not found.');
    const data = snap.data() || {};
    if (data.status !== 'draft') throw new HttpsError('failed-precondition', 'Only a draft resolution may be opened.');
    if (approvalMethod === 'record_only') {
      tx.update(resolutionRef, {
        ...commonFrozenFields,
        status: 'closed_without_decision',
        result: 'closed_without_decision',
        finalResult: 'closed_without_decision',
        approveCount: 0,
        rejectCount: 0,
        abstainCount: 0,
        votesReceivedCount: 0,
        openedAt: now,
        openedByUid: actor.uid,
        openedByName: actor.name,
        openedByPosition: actor.position,
        votingOpenedAt: now,
        votingOpenedBy: actor.uid,
        closedAt: now,
        closedByUid: actor.uid,
        closedByName: actor.name,
        closedByPosition: actor.position,
        votingClosedAt: now,
        votingClosedBy: actor.uid,
        finalizedPdfLayoutMode: data.pdfLayoutMode === 'custom' ? 'custom' : 'standard',
        finalizedPdfSectionsSnapshot: data.pdfLayoutMode === 'custom' ? resolutionModel.normalizePdfSections(data.pdfSections) : [],
        updatedAt: now,
      });
      setResolutionAudit(tx, resolutionRef, 'document_finalized', actor, now, { metadata: { documentHash, documentShortHash } });
      setResolutionAudit(tx, resolutionRef, 'approval_method_selected', actor, now, { newValue: { approvalMethod, voteProcessingMode } });
      setResolutionAudit(tx, resolutionRef, 'record_only_archived', actor, now, { previousValue: { status: 'draft' }, newValue: { status: 'closed_without_decision' } });
      return;
    }
    tx.update(resolutionRef, {
      ...commonFrozenFields,
      status: 'open',
      openedAt: now,
      openedByUid: actor.uid,
      openedByName: actor.name,
      openedByPosition: actor.position,
      votingOpenedAt: now,
      votingOpenedBy: actor.uid,
      updatedAt: now,
    });
    setResolutionAudit(tx, resolutionRef, 'document_finalized', actor, now, { metadata: { documentHash, documentShortHash } });
    setResolutionAudit(tx, resolutionRef, 'approval_method_selected', actor, now, { newValue: { approvalMethod, voteProcessingMode } });
    setResolutionAudit(tx, resolutionRef, 'voter_list_frozen', actor, now, { metadata: { eligibleVoterCount: eligibleSnapshot.length } });
    if (approvalMethod === 'hybrid_email') {
      setResolutionAudit(tx, resolutionRef, 'official_email_prepared', actor, now, { metadata: { recipientCount: eligibleSnapshot.length, documentShortHash } });
    }
    setResolutionAudit(tx, resolutionRef, 'voting_opened', actor, now, {
      previousValue: { status: 'draft' },
      newValue: { status: 'open' },
      metadata: { eligibleVoterCount: eligibleSnapshot.length, approvalMethod, voteProcessingMode },
    });
  });
  if (approvalMethod === 'record_only') return { ok: true, resolutionId, status: 'closed_without_decision', documentHash, documentShortHash };
  if (approvalMethod === 'hybrid_email') {
    const frozenForMail = {
      ...before,
      ...commonFrozenFields,
      openedAt: now,
      openedByName: actor.name,
      openedByPosition: actor.position,
    };
    const [officialSummary, noticeSummary] = await Promise.all([
      sendOfficialResolutionEmail({ resolutionId, resolution: frozenForMail, voters: eligibleSnapshot }),
      sendResolutionDashboardNotifications({ resolutionId, resolution: frozenForMail, voters: eligibleSnapshot, documentShortHash }),
    ]);
    const sentAt = officialSummary.sent > 0 ? resolutionTimestamp() : null;
    await resolutionRef.set({
      officialEmailSentAt: sentAt,
      officialEmailSentBy: officialSummary.sent > 0 ? actor.uid : '',
      officialEmailMessageId: officialSummary.messageId || '',
      officialEmailSummary: officialSummary,
      dashboardNotificationSummary: noticeSummary,
      dashboardNotificationsSentAt: noticeSummary.sent > 0 ? resolutionTimestamp() : null,
      updatedAt: resolutionTimestamp(),
    }, { merge: true });
    await resolutionRef.collection('audit').add({
      action: officialSummary.sent > 0 ? 'official_email_sent' : 'official_email_prepared',
      actorUid: actor.uid,
      actorName: actor.name,
      actorPosition: actor.position,
      timestamp: resolutionTimestamp(),
      previousValue: null,
      newValue: { sent: officialSummary.sent, failed: officialSummary.failed, skipped: officialSummary.skipped },
      metadata: officialSummary,
    });
    await resolutionRef.collection('audit').add({
      action: 'dashboard_notifications_sent',
      actorUid: actor.uid,
      actorName: actor.name,
      actorPosition: actor.position,
      timestamp: resolutionTimestamp(),
      previousValue: null,
      newValue: { sent: noticeSummary.sent, failed: noticeSummary.failed, skipped: noticeSummary.skipped },
      metadata: noticeSummary,
    });
  }
  return { ok: true, resolutionId, eligibleVoterCount: eligibleSnapshot.length };
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
    const approvalMethod = resolutionModel.normalizeApprovalMethod(resolution.approvalMethod);
    if (approvalMethod === 'record_only') throw new HttpsError('failed-precondition', 'This resolution is record-only and does not accept votes.');
    const voteProcessingMode = resolutionModel.normalizeVoteProcessingMode(resolution.voteProcessingMode);
    const authenticatedFinalHybrid = resolutionModel.isAuthenticatedFinalHybrid(approvalMethod, voteProcessingMode);
    const previous = voteSnap.exists ? (voteSnap.data() || {}) : {};
    const previousChoice = resolutionModel.normalizeVoteChoice(previous.choice);
    const previousEmailStatus = resolutionModel.normalizeEmailConfirmationStatus(previous.emailConfirmationStatus);
    const previousActive = previous.superseded !== true && !['superseded', 'invalidated_document_changed'].includes(previousEmailStatus);
    const documentHash = normalizeText(resolution.originalDocumentHash || buildResolutionDocumentHash(resolution), 128);
    const documentShortHash = normalizeText(resolution.originalDocumentShortHash || shortResolutionHash(documentHash), 24);
    if (previousChoice && authenticatedFinalHybrid) {
      if (previousActive && previousChoice === choice) {
        responseVote = {
          choice: previousChoice,
          selectedVote: previousChoice,
          submittedAt: timestampToIso(previous.submittedAt),
          updatedAt: timestampToIso(previous.updatedAt),
          emailConfirmationStatus: previousEmailStatus || 'submitted',
          preparedReplyText: typeof previous.preparedReplyText === 'string' ? previous.preparedReplyText.slice(0, 8000) : '',
          preparedReplyReference: normalizeText(previous.preparedReplyReference, 160),
          requiredSenderEmail: normalizeEmail(previous.voterEmail || voter.email || ''),
          documentHash: normalizeText(previous.documentHash || documentHash, 128),
          documentShortHash: normalizeText(previous.documentShortHash || documentShortHash, 24),
        };
        return;
      }
      throw new HttpsError('failed-precondition', 'This vote is final and cannot be changed.');
    }
    if (previousChoice && approvalMethod === 'hybrid_email' && resolutionModel.isHybridVoteChoiceLocked(previousEmailStatus)) {
      throw new HttpsError('failed-precondition', 'This hybrid vote is locked after email confirmation is claimed.');
    }
    const reference = `RCPH-${resolutionId.slice(0, 8)}-${uid.slice(0, 6)}-${crypto.randomBytes(4).toString('hex')}`.toUpperCase();
    const submittedAt = approvalMethod === 'hybrid_email' ? now : (previous.submittedAt || now);
    const emailConfirmationStatus = approvalMethod === 'hybrid_email' ? authenticatedFinalHybrid ? 'submitted' : 'email_pending' : 'submitted';
    const preparedReplyText = approvalMethod === 'hybrid_email' ? resolutionModel.buildPreparedReplyText({
      voterName: voter.name,
      resolutionNumber: resolution.resolutionNumber,
      title: resolution.title,
      choice,
      documentShortHash,
      reference,
      submittedAt: timestampToIso(submittedAt),
    }) : '';
    if (previousChoice && approvalMethod === 'hybrid_email') {
      tx.set(resolutionRef.collection('voteHistory').doc(), {
        ...previous,
        superseded: true,
        supersededBy: reference,
        supersededAt: now,
      });
      setResolutionAudit(tx, resolutionRef, 'vote_superseded', {
        uid,
        name: stripRotaractorPrefix(normalizeText(voter.name, 160)),
        position: normalizeText(voter.position, 240),
      }, now, { previousValue: { choice: previousChoice, reference: previous.preparedReplyReference || '' }, newValue: { choice, reference } });
    }
    tx.set(voteRef, {
      resolutionId,
      voterUid: uid,
      voterEmail: normalizeEmail(voter.email || ''),
      voterName: stripRotaractorPrefix(normalizeText(voter.name, 160)),
      voterPosition: normalizeText(voter.position, 240),
      choice,
      selectedVote: choice,
      submittedAt,
      submittedBy: uid,
      updatedAt: now,
      emailConfirmationStatus,
      preparedReplyText,
      preparedReplyReference: approvalMethod === 'hybrid_email' ? reference : '',
      emailConfirmedAt: null,
      emailSentClaimedAt: null,
      emailRejectedAt: null,
      emailVerificationNote: '',
      emailMessageId: '',
      emailThreadId: '',
      emailSender: '',
      superseded: false,
      supersededBy: '',
      documentHash,
      documentShortHash,
      auditVersion: Number.isInteger(previous.auditVersion) ? previous.auditVersion + 1 : 1,
    }, { merge: false });
    setResolutionAudit(tx, resolutionRef, previousChoice ? 'vote_changed' : 'vote_submitted', {
      uid,
      name: stripRotaractorPrefix(normalizeText(voter.name, 160)),
      position: normalizeText(voter.position, 240),
    }, now, {
      previousValue: previousChoice || null,
      newValue: { choice, emailConfirmationStatus, reference: approvalMethod === 'hybrid_email' ? reference : '', voteProcessingMode },
    });
    if (approvalMethod === 'hybrid_email') {
      setResolutionAudit(tx, resolutionRef, authenticatedFinalHybrid ? 'prepared_email_generated' : 'prepared_reply_generated', {
        uid,
        name: stripRotaractorPrefix(normalizeText(voter.name, 160)),
        position: normalizeText(voter.position, 240),
      }, now, { metadata: { reference, documentShortHash, documentHash, voteProcessingMode } });
    }
    responseVote = {
      choice,
      selectedVote: choice,
      submittedAt: timestampToIso(submittedAt),
      updatedAt: timestampToIso(now),
      emailConfirmationStatus,
      preparedReplyText,
      preparedReplyReference: approvalMethod === 'hybrid_email' ? reference : '',
      requiredSenderEmail: approvalMethod === 'hybrid_email' ? normalizeEmail(voter.email || '') : '',
      documentHash,
      documentShortHash,
    };
  });
  return { ok: true, resolutionId, vote: responseVote };
});

exports.markResolutionEmailSent = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const resolutionId = validateAnnouncementDocId(request.data?.resolutionId, 'resolutionId');
  const suppliedChoice = resolutionModel.normalizeVoteChoice(request.data?.choice);
  const suppliedReference = normalizeText(request.data?.voteReference, 160);
  const suppliedHash = normalizeText(request.data?.documentHash, 128);
  const resolutionRef = db.collection(RESOLUTIONS_COLLECTION).doc(resolutionId);
  const voteRef = resolutionRef.collection('votes').doc(uid);
  const now = resolutionTimestamp();
  let responseVote = null;
  await db.runTransaction(async tx => {
    const [resolutionSnap, voteSnap] = await Promise.all([tx.get(resolutionRef), tx.get(voteRef)]);
    if (!resolutionSnap.exists) throw new HttpsError('not-found', 'Resolution not found.');
    if (!voteSnap.exists) throw new HttpsError('failed-precondition', 'Submit your vote before marking the email as sent.');
    const resolution = resolutionSnap.data() || {};
    const vote = voteSnap.data() || {};
    if (resolution.status !== 'open') throw new HttpsError('failed-precondition', 'Voting is closed.');
    if (resolutionModel.normalizeApprovalMethod(resolution.approvalMethod) !== 'hybrid_email') throw new HttpsError('failed-precondition', 'Email confirmation is only used for hybrid resolutions.');
    if (resolutionModel.isAuthenticatedFinalHybrid(resolution.approvalMethod, resolution.voteProcessingMode)) throw new HttpsError('failed-precondition', 'Prepared confirmation email is optional for this resolution and does not need to be marked sent.');
    if (vote.voterUid !== uid) throw new HttpsError('permission-denied', 'You can only update your own confirmation status.');
    const choice = resolutionModel.normalizeVoteChoice(vote.choice);
    const emailStatus = resolutionModel.normalizeEmailConfirmationStatus(vote.emailConfirmationStatus);
    const claimableStatus = emailStatus || 'email_pending';
    const reference = normalizeText(vote.preparedReplyReference, 160);
    const documentHash = normalizeText(vote.documentHash, 128);
    const documentShortHash = normalizeText(vote.documentShortHash, 24);
    if (!choice) throw new HttpsError('failed-precondition', 'Submit your vote before marking the email as sent.');
    if (!suppliedChoice || suppliedChoice !== choice) throw new HttpsError('failed-precondition', 'Selected vote changed. Refresh and resend the current prepared email.');
    if (!suppliedReference || suppliedReference !== reference) throw new HttpsError('failed-precondition', 'Vote reference changed. Refresh and resend the current prepared email.');
    if (!suppliedHash || (suppliedHash !== documentHash && suppliedHash !== documentShortHash)) throw new HttpsError('failed-precondition', 'Document fingerprint changed. Refresh and resend the current prepared email.');
    if (emailStatus === 'email_sent_claimed') {
      responseVote = {
        choice,
        selectedVote: choice,
        submittedAt: timestampToIso(vote.submittedAt),
        updatedAt: timestampToIso(vote.updatedAt),
        emailConfirmationStatus: 'email_sent_claimed',
        emailSentClaimedAt: timestampToIso(vote.emailSentClaimedAt),
        preparedReplyText: typeof vote.preparedReplyText === 'string' ? vote.preparedReplyText.slice(0, 8000) : '',
        preparedReplyReference: reference,
        requiredSenderEmail: normalizeEmail(vote.voterEmail || ''),
        documentHash,
        documentShortHash,
      };
      return;
    }
    if (emailStatus === 'email_verified') throw new HttpsError('failed-precondition', 'This vote is already verified.');
    if (!['email_pending', 'email_rejected'].includes(claimableStatus)) throw new HttpsError('failed-precondition', 'This vote cannot be marked as sent.');
    tx.update(voteRef, {
      emailConfirmationStatus: 'email_sent_claimed',
      emailSentClaimedAt: now,
      updatedAt: now,
    });
    setResolutionAudit(tx, resolutionRef, 'email_sent_claimed', {
      uid,
      name: normalizeText(vote.voterName, 160),
      position: normalizeText(vote.voterPosition, 240),
    }, now, { metadata: { reference } });
    responseVote = {
      choice,
      selectedVote: choice,
      submittedAt: timestampToIso(vote.submittedAt),
      updatedAt: timestampToIso(now),
      emailConfirmationStatus: 'email_sent_claimed',
      emailSentClaimedAt: timestampToIso(now),
      preparedReplyText: typeof vote.preparedReplyText === 'string' ? vote.preparedReplyText.slice(0, 8000) : '',
      preparedReplyReference: reference,
      requiredSenderEmail: normalizeEmail(vote.voterEmail || ''),
      documentHash,
      documentShortHash,
    };
  });
  return { ok: true, resolutionId, vote: responseVote };
});

exports.verifyResolutionEmailConfirmation = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const actor = await getResolutionManagerContext(uid);
  const resolutionId = validateAnnouncementDocId(request.data?.resolutionId, 'resolutionId');
  const voterUid = validateAnnouncementDocId(request.data?.voterUid, 'voterUid');
  const action = normalizeText(request.data?.action || request.data?.status, 80);
  const nextStatus = action === 'email_rejected' || action === 'reject' ? 'email_rejected' : 'email_verified';
  const senderEmail = normalizeEmail(request.data?.senderEmail);
  const note = normalizeText(request.data?.note, 1000);
  const messageId = normalizeText(request.data?.messageId, 240);
  const threadId = normalizeText(request.data?.threadId, 240);
  const suppliedReference = normalizeText(request.data?.voteReference, 160);
  const suppliedHash = normalizeText(request.data?.documentHash, 128);
  const receivedAtInput = normalizeText(request.data?.receivedAt, 80);
  const receivedAtDate = receivedAtInput && Number.isFinite(Date.parse(receivedAtInput)) ? new Date(receivedAtInput) : null;
  const receivedAt = receivedAtDate ? admin.firestore.Timestamp.fromDate(receivedAtDate) : resolutionTimestamp();
  const resolutionRef = db.collection(RESOLUTIONS_COLLECTION).doc(resolutionId);
  const voteRef = resolutionRef.collection('votes').doc(voterUid);
  const now = resolutionTimestamp();
  await db.runTransaction(async tx => {
    const [resolutionSnap, voteSnap] = await Promise.all([tx.get(resolutionRef), tx.get(voteRef)]);
    if (!resolutionSnap.exists) throw new HttpsError('not-found', 'Resolution not found.');
    if (!voteSnap.exists) throw new HttpsError('not-found', 'Vote not found.');
    const resolution = resolutionSnap.data() || {};
    const vote = voteSnap.data() || {};
    if (resolutionModel.normalizeApprovalMethod(resolution.approvalMethod) !== 'hybrid_email') throw new HttpsError('failed-precondition', 'Email verification is only used for hybrid resolutions.');
    if (resolutionModel.isAuthenticatedFinalHybrid(resolution.approvalMethod, resolution.voteProcessingMode)) throw new HttpsError('failed-precondition', 'Admin email verification is not used for authenticated-final resolutions.');
    const recordedEmail = normalizeEmail(vote.voterEmail);
    const reference = normalizeText(vote.preparedReplyReference, 160);
    const documentHash = normalizeText(vote.documentHash, 128);
    const documentShortHash = normalizeText(vote.documentShortHash, 24);
    const currentStatus = resolutionModel.normalizeEmailConfirmationStatus(vote.emailConfirmationStatus);
    if (vote.superseded === true || ['superseded', 'invalidated_document_changed'].includes(currentStatus)) {
      throw new HttpsError('failed-precondition', 'This vote is no longer active.');
    }
    if (currentStatus !== 'email_sent_claimed') {
      throw new HttpsError('failed-precondition', 'Only a claimed confirmation email can be verified or rejected.');
    }
    if (nextStatus === 'email_verified') {
      if (!senderEmail || senderEmail !== recordedEmail) throw new HttpsError('failed-precondition', 'Sender email does not match the registered voter email.');
      if (!suppliedReference || suppliedReference !== reference) throw new HttpsError('failed-precondition', 'Vote reference does not match.');
      if (!suppliedHash || (suppliedHash !== documentHash && suppliedHash !== documentShortHash)) throw new HttpsError('failed-precondition', 'Document fingerprint does not match.');
    }
    tx.update(voteRef, {
      emailConfirmationStatus: nextStatus,
      emailConfirmedAt: nextStatus === 'email_verified' ? receivedAt : null,
      emailRejectedAt: nextStatus === 'email_rejected' ? now : null,
      emailVerificationNote: note,
      emailSender: senderEmail,
      emailMessageId: messageId,
      emailThreadId: threadId,
      updatedAt: now,
    });
    setResolutionAudit(tx, resolutionRef, nextStatus === 'email_verified' ? 'email_verified' : 'email_rejected', actor, now, {
      newValue: {
        voterUid,
        status: nextStatus,
        reference,
        senderEmail,
        messageId,
      },
      metadata: {
        note,
        documentHash: suppliedHash,
        receivedAt: timestampToIso(receivedAt),
      },
    });
  });
  return { ok: true, resolutionId, voterUid, emailConfirmationStatus: nextStatus };
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
      approvalMethod: resolution.approvalMethod,
      voteProcessingMode: resolution.voteProcessingMode,
    });
    const finalizedPdfSectionsSnapshot = resolution.pdfLayoutMode === 'custom' ? resolutionModel.normalizePdfSections(resolution.pdfSections) : [];
    assertFirestoreSafeResolutionSections(finalizedPdfSectionsSnapshot, 'finalizedPdfSectionsSnapshot');
    const finalizedResolutionPageConfigSnapshot = resolutionModel.normalizeResolutionPageConfig(resolution.resolutionPageConfig, resolution);
    const finalizedGeneratedPageOrderSnapshot = resolutionModel.normalizeGeneratedPageOrder(resolution.generatedPageOrder);
    resolutionModel.assertNoNestedArrays(finalizedResolutionPageConfigSnapshot, 'finalizedResolutionPageConfigSnapshot');
    uploadedMode = resolutionUploads.sourceMode(resolution) === 'uploadedPdf';
    const uploadedFinalization = uploadedMode ? {
      finalizedUploadedSourceSnapshot: { ...resolution.uploadedSource },
      finalizedVotesTableConfigSnapshot: resolutionModel.normalizeUploadedVotesTableConfig(resolution.uploadedVotesTableConfig),
      finalizedResolutionPageConfigSnapshot,
      finalizedGeneratedPageOrderSnapshot,
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
      votingClosedAt: now,
      votingClosedBy: actor.uid,
      finalResult: finalResult.result,
      finalizedPdfLayoutMode: resolution.pdfLayoutMode === 'custom' ? 'custom' : 'standard',
      finalizedPdfSectionsSnapshot,
      finalizedResolutionPageConfigSnapshot,
      finalizedGeneratedPageOrderSnapshot,
      auditBundleHash: crypto.createHash('sha256').update(stableResolutionJson({
        resolutionId,
        result: finalResult.result,
        counts: finalResult,
        closedAt: now.toMillis ? now.toMillis() : Date.now(),
      }), 'utf8').digest('hex'),
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
    setResolutionAudit(tx, resolutionRef, 'final_result_calculated', actor, now, { newValue: { result: finalResult.result } });
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

exports.deleteResolution = onCall(RESOLUTION_PDF_CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const actor = await getResolutionManagerContext(uid);
  const resolutionId = validateAnnouncementDocId(request.data?.resolutionId, 'resolutionId');
  const resolutionRef = db.collection(RESOLUTIONS_COLLECTION).doc(resolutionId);
  const [resolutionSnap, votesSnap, auditSnap] = await Promise.all([
    resolutionRef.get(),
    resolutionRef.collection('votes').limit(1).get(),
    resolutionRef.collection('audit').orderBy('timestamp', 'asc').get(),
  ]);
  if (!resolutionSnap.exists) throw new HttpsError('not-found', 'Resolution not found.');
  const data = resolutionSnap.data() || {};
  if (!['draft', 'cancelled'].includes(data.status)) {
    throw new HttpsError('failed-precondition', 'Only draft or cancelled resolutions may be deleted.');
  }
  if (!votesSnap.empty) {
    throw new HttpsError('failed-precondition', 'Resolutions with vote records cannot be deleted.');
  }
  const mergeStatus = normalizeText(data.merge?.status, 40);
  if (data.finalizedMergedPdf?.driveFileId || data.finalPdfHash || data.finalizedUploadedSourceSnapshot?.driveFileId || ['ready', 'processing', 'pending'].includes(mergeStatus)) {
    throw new HttpsError('failed-precondition', 'Finalized resolution artifacts must be preserved.');
  }

  const now = resolutionTimestamp();
  const numberRef = data.resolutionNumber
    ? db.collection(RESOLUTION_NUMBER_INDEX_COLLECTION).doc(resolutionNumberIndexId(data.resolutionNumber))
    : null;
  const numberSnap = numberRef ? await numberRef.get() : null;
  const auditEntries = auditSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) }));
  const sourceToDelete = data.uploadedSource?.status === 'ready' ? data.uploadedSource : null;
  const deletionAuditRef = db.collection(RESOLUTION_DELETION_AUDIT_COLLECTION).doc(resolutionId);
  const deletedPaths = [resolutionRef.path, ...auditSnap.docs.map(doc => doc.ref.path)];
  const operations = [
    batch => batch.set(deletionAuditRef, {
      action: 'resolution_deleted',
      resolutionId,
      actorUid: actor.uid,
      actorName: actor.name,
      actorPosition: actor.position,
      deletedAt: now,
      previousStatus: data.status || '',
      resolutionNumber: normalizeText(data.resolutionNumber, 80),
      title: normalizeText(data.title, 220),
      meetingId: normalizeText(data.meetingId, 160),
      meetingTitle: normalizeText(data.meetingTitle, 220),
      createdByUid: normalizeText(data.createdByUid, 128),
      createdAt: data.createdAt || null,
      auditEntries,
      deletedPaths,
      uploadedSource: sourceToDelete ? {
        uploadId: normalizeText(sourceToDelete.uploadId, 160),
        driveFileId: normalizeText(sourceToDelete.driveFileId, 300),
        sha256: normalizeText(sourceToDelete.sha256, 128),
      } : null,
    }),
    batch => batch.delete(resolutionRef),
    ...auditSnap.docs.map(doc => batch => batch.delete(doc.ref)),
  ];
  if (numberRef && numberSnap?.exists && numberSnap.data()?.resolutionId === resolutionId) {
    deletedPaths.push(numberRef.path);
    operations.push(batch => batch.delete(numberRef));
  }
  await commitFirestoreOperations(operations);

  let sourceRemoved = false;
  if (sourceToDelete?.driveFileId) {
    try {
      await resolutionDrive.deleteSourceFile({
        driveFileId: sourceToDelete.driveFileId,
        resolutionId,
        uploadId: sourceToDelete.uploadId,
        sha256: sourceToDelete.sha256,
      });
      sourceRemoved = true;
    } catch (err) {
      console.warn('Deleted Resolution source PDF cleanup failed.', { resolutionId, code: err?.code || 'drive-delete-failed' });
    }
    if (sourceToDelete.uploadId) {
      const sessions = await db.collection('resolutionPdfUploadSessions').where('uploadId', '==', sourceToDelete.uploadId).get();
      const sessionOps = sessions.docs.map(doc => batch => batch.set(doc.ref, {
        status: 'deleted',
        deletedAt: resolutionTimestamp(),
        updatedAt: resolutionTimestamp(),
      }, { merge: true }));
      if (sessionOps.length) await commitFirestoreOperations(sessionOps);
    }
  }

  return { ok: true, resolutionId, sourceRemoved, deletedPaths };
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
    return { ...fields, ...countResolutionVotes(votesSnap.docs.map(vote => vote.data() || {}), data.approvalMethod, data.voteProcessingMode) };
  }));
  return {
    ok: true,
    resolutions,
    meetings: meetingsSnap.docs.map(snap => ({ id: snap.id, name: normalizeText(snap.data()?.name, 220), date: normalizeText(snap.data()?.date, 20), archived: snap.data()?.archived === true })).filter(item => item.name && item.date),
    roster: voters.map(voter => ({ uid: voter.uid, name: voter.name, email: voter.email || '', role: voter.role || 'bod', position: voter.position, active: voter.active !== false })),
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
  const liveCounts = data.status === 'open' ? countResolutionVotes(voteData.map(item => item.data), data.approvalMethod, data.voteProcessingMode) : {};
  return {
    ok: true,
    resolution: {
      ...publicResolutionFields(resolutionId, data),
      ...liveCounts,
      eligibleVoters: Array.isArray(data.eligibleVoters) ? data.eligibleVoters.map(voter => ({
        uid: normalizeText(voter?.uid, 128),
        name: normalizeText(voter?.name, 160),
        email: normalizeEmail(voter?.email),
        role: normalizeText(voter?.role, 40),
        position: normalizeText(voter?.position, 240),
        eligibilityReason: normalizeText(voter?.eligibilityReason, 240),
        active: voter?.active !== false,
      })).filter(voter => voter.uid) : [],
    },
    votes: voteData.map(item => {
      const vote = item.data;
      return {
        voterUid: item.id,
        resolutionId: normalizeText(vote.resolutionId, 160),
        voterEmail: normalizeEmail(vote.voterEmail),
        voterName: normalizeText(vote.voterName, 160),
        voterPosition: normalizeText(vote.voterPosition, 240),
        choice: resolutionModel.normalizeVoteChoice(vote.choice),
        selectedVote: resolutionModel.normalizeVoteChoice(vote.selectedVote || vote.choice),
        submittedAt: timestampToIso(vote.submittedAt),
        submittedBy: normalizeText(vote.submittedBy, 128),
        updatedAt: timestampToIso(vote.updatedAt),
        emailConfirmationStatus: resolutionModel.normalizeEmailConfirmationStatus(vote.emailConfirmationStatus),
        preparedReplyText: typeof vote.preparedReplyText === 'string' ? vote.preparedReplyText.slice(0, 8000) : '',
        preparedReplyReference: normalizeText(vote.preparedReplyReference, 160),
        emailConfirmedAt: timestampToIso(vote.emailConfirmedAt),
        emailSentClaimedAt: timestampToIso(vote.emailSentClaimedAt),
        emailRejectedAt: timestampToIso(vote.emailRejectedAt),
        emailVerificationNote: normalizeText(vote.emailVerificationNote, 1000),
        emailMessageId: normalizeText(vote.emailMessageId, 240),
        emailThreadId: normalizeText(vote.emailThreadId, 240),
        emailSender: normalizeEmail(vote.emailSender),
        superseded: vote.superseded === true,
        supersededBy: normalizeText(vote.supersededBy, 160),
        documentHash: normalizeText(vote.documentHash, 128),
        documentShortHash: normalizeText(vote.documentShortHash, 24),
        auditVersion: Number.isInteger(vote.auditVersion) ? vote.auditVersion : 1,
      };
    }),
    audit: auditSnap.docs.map(snap => {
      const audit = snap.data() || {};
      return { id: snap.id, action: normalizeText(audit.action, 80), actorName: normalizeText(audit.actorName, 160), actorPosition: normalizeText(audit.actorPosition, 240), timestamp: timestampToIso(audit.timestamp), previousValue: audit.previousValue ?? null, newValue: audit.newValue ?? null, metadata: audit.metadata && typeof audit.metadata === 'object' ? audit.metadata : {} };
    }),
    canonicalVoters: canonicalVoters.map(voter => ({ uid: voter.uid, name: voter.name, email: voter.email || '', role: voter.role || 'bod', position: voter.position, active: voter.active !== false })),
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
exports.uploadAnnouncementAttachment = onRequest({ region: 'us-central1', timeoutSeconds: 120, memory: '512MiB', maxInstances: 5, concurrency: 10, secrets: ANNOUNCEMENT_ATTACHMENT_SECRETS }, (req, res) => announcementAttachments.uploadHttp(req, res));
exports.downloadAnnouncementAttachment = onRequest({ region: 'us-central1', timeoutSeconds: 60, memory: '256MiB', maxInstances: 10, concurrency: 20, secrets: ANNOUNCEMENT_ATTACHMENT_SECRETS }, (req, res) => announcementAttachments.streamDownload(req, res, getAnnouncementForAttachmentAccess));
exports.cleanupAnnouncementAttachmentUploads = onSchedule({ region: 'us-central1', schedule: 'every day 03:45', timeZone: 'Asia/Kolkata', timeoutSeconds: 300, memory: '256MiB', secrets: ANNOUNCEMENT_ATTACHMENT_SECRETS }, () => announcementAttachments.cleanupExpiredSessions());

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
        ...profileUpdates.safeProfileFromUserData({
          ...userData,
          name: userData.name || request.auth?.token?.name || '',
          email: userData.email || request.auth?.token?.email || '',
        }, 'prospect', { uid }),
        clubPosition: 'Prospect',
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
      ...profileUpdates.safeProfileFromUserData({
        ...userData,
        name: userData.name || memberData.name || request.auth?.token?.name || '',
        email: userData.email || memberData.email || request.auth?.token?.email || '',
      }, active.role, { uid }),
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

exports.getBodManagementBoard = onCall(CALLABLE_OPTIONS, async (request) => {
  try {
    const actorUid = requireAuth(request);
    return await bodManagement.getBodManagementBoard(request.data || {}, actorUid);
  } catch (err) {
    throwCallableServiceError(err, 'Could not load BOD Management board.');
  }
});

exports.saveBodSectionPublication = onCall(CALLABLE_OPTIONS, async (request) => {
  try {
    const actorUid = requireAuth(request);
    return await bodManagement.saveBodSectionPublication(request.data || {}, actorUid);
  } catch (err) {
    throwCallableServiceError(err, 'Could not save BOD Management status.');
  }
});

exports.publishBodSection = onCall(CALLABLE_OPTIONS, async (request) => {
  try {
    const actorUid = requireAuth(request);
    return await bodManagement.publishBodSection(
      request.data || {},
      actorUid
    );
  } catch (err) {
    throwCallableServiceError(err, 'Could not publish BOD section.');
  }
});

exports.upsertBodProfile = onCall(CALLABLE_OPTIONS, async (request) => {
  try {
    const actorUid = requireAuth(request);
    return await bodManagement.upsertBodProfile(request.data || {}, actorUid);
  } catch (err) {
    throwCallableServiceError(err, 'Could not save BOD profile.');
  }
});

exports.archiveBodProfile = onCall(CALLABLE_OPTIONS, async (request) => {
  try {
    const actorUid = requireAuth(request);
    return await bodManagement.archiveBodProfile(request.data || {}, actorUid);
  } catch (err) {
    throwCallableServiceError(err, 'Could not archive BOD profile.');
  }
});

exports.restoreBodProfile = onCall(CALLABLE_OPTIONS, async (request) => {
  try {
    const actorUid = requireAuth(request);
    return await bodManagement.restoreBodProfile(request.data || {}, actorUid);
  } catch (err) {
    throwCallableServiceError(err, 'Could not restore BOD profile.');
  }
});

exports.reorderBodProfiles = onCall(CALLABLE_OPTIONS, async (request) => {
  try {
    const actorUid = requireAuth(request);
    return await bodManagement.reorderBodProfiles(request.data || {}, actorUid);
  } catch (err) {
    throwCallableServiceError(err, 'Could not reorder BOD profiles.');
  }
});

exports.createBodPhotoUploadSession = onCall(CALLABLE_OPTIONS, async (request) => {
  try {
    const actorUid = requireAuth(request);
    return await bodPhotoUploads.createUploadSession(request.data || {}, actorUid);
  } catch (err) {
    throwCallableServiceError(err, 'Could not create BOD photo upload session.');
  }
});

exports.finalizeBodPhotoUpload = onCall(BOD_PHOTO_CALLABLE_OPTIONS, async (request) => {
  try {
    const actorUid = requireAuth(request);
    return await bodPhotoUploads.finalizeUpload(request.data || {}, actorUid);
  } catch (err) {
    throwCallableServiceError(err, 'Could not finalize BOD photo upload.');
  }
});

exports.removeBodProfilePhoto = onCall(CALLABLE_OPTIONS, async (request) => {
  try {
    const actorUid = requireAuth(request);
    return await bodPhotoUploads.removePhoto(request.data || {}, actorUid);
  } catch (err) {
    throwCallableServiceError(err, 'Could not remove BOD profile photo.');
  }
});

exports.cleanupExpiredBodPhotoUploadSessions = onCall(BOD_PHOTO_CALLABLE_OPTIONS, async (request) => {
  try {
    const actorUid = requireAuth(request);
    return await bodPhotoUploads.cleanupExpiredSessions(request.data || {}, actorUid);
  } catch (err) {
    throwCallableServiceError(err, 'Could not clean up BOD photo upload sessions.');
  }
});

exports.uploadBodProfilePhoto = onRequest(
  { region: 'us-central1', timeoutSeconds: 120, memory: '512MiB', maxInstances: 5, concurrency: 10, secrets: RESOLUTION_DRIVE_SECRETS },
  (req, res) => bodPhotoUploads.uploadHttp(req, res)
);
exports.getPublicBodBoard = onRequest(
  {
    region: 'us-central1',
    cors: CALLABLE_OPTIONS.cors,
  },
  (req, res) =>
    bodManagement.handlePublicBodBoardRequest(req, res)
);

exports.downloadPublishedBodPhoto = onRequest(
  {
    region: 'us-central1',
    timeoutSeconds: 120,
    memory: '512MiB',
    maxInstances: 5,
    concurrency: 10,
    secrets: RESOLUTION_DRIVE_SECRETS,
  },
  (req, res) =>
    bodPhotoUploads.downloadPublishedPhotoHttp(req, res)
);


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
    .filter(assignment => bodAvenueReport.isReportAvenueDirectorAssignment(assignment, avenueCode, positionHelpers))
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
    description: bodData.description || bodData.desc,
    avenue: bodData.avenue || bodData.avenues,
    avenues: bodData.avenues || bodData.avenue,
    avenueDescriptions: bodData.avenueDescriptions,
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
  const attendanceRowsUpdated = await initializeAttendanceFieldForCollection('members', 'districtAttendance', districtEventId, now, { includeGeneralAttendanceUsers: true });
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
  const attendanceRowsUpdated = await initializeAttendanceFieldForCollection('members', 'districtAttendance', districtEventId, now, { includeGeneralAttendanceUsers: true });
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
exports.getMomEmailRecipientOptions = momFunctions.getMomEmailRecipientOptions;
exports.createMomUploadSession = momFunctions.createMomUploadSession;
exports.uploadMomPdf = momFunctions.uploadMomPdf;
exports.finalizeMomUpload = momFunctions.finalizeMomUpload;
exports.downloadMomPdf = momFunctions.downloadMomPdf;
exports.sendMomEmail = momFunctions.sendMomEmail;
exports.sendScheduledReminderEmails = reminderFunctions.sendScheduledReminderEmails;
exports.runReminderEmailSweep = reminderFunctions.runReminderEmailSweep;
exports.sendReminderTemplateTestEmail = reminderFunctions.sendReminderTemplateTestEmail;
exports.unlockAvenueReportingWindow = reminderFunctions.unlockAvenueReportingWindow;
