const functions = require('firebase-functions');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const positionHelpers = require('./lib/positions');

admin.initializeApp();
const db = admin.firestore();
const ADMIN_INVITE_CODE = process.env.ADMIN_INVITE_CODE;
const EMAIL_USER = process.env.EMAIL_USER || process.env.SMTP_USER || '';
const EMAIL_PASS = process.env.EMAIL_PASS || process.env.SMTP_PASS || '';
const DEFAULT_SIGNUP_NOTIFY_TO = 'rcph3131@gmail.com';
const CALLABLE_OPTIONS = {
  region: 'us-central1',
  cors: [
    'https://rcph3131.org',
    'https://www.rcph3131.org',
    'http://localhost:5000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
  ],
};

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
const APPROVABLE_ROLES = new Set(['gbm', 'bod', 'admin']);
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
const DRIVE_UPLOAD_TYPES = new Set(['bod', 'treasury']);
const PROSPECT_CRITERIA = Object.freeze({
  requiredGbm: 2,
  requiredAvenueEvents: 2,
  duesRequired: true,
});
const PROSPECT_GENDERS = new Set(['woman', 'man', 'non-binary', 'self-describe', 'prefer-not-to-say']);
const PROSPECT_AVENUES = new Set(['ISD', 'CMD', 'CSD', 'PDD', 'RRRO', 'PRO', 'DEI']);

function normalizeRole(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeText(value, max = 300) {
  return String(value || '').trim().slice(0, max);
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
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
    return 'Prospect Member auto-approved. Onboarding criteria: 2 GBMs, 2 Avenue Events, and Dues Paid.';
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

async function assertAdminOrPresident(uid) {
  const active = await getActiveRole(uid);
  if (!active || (active.role !== 'admin' && active.role !== 'president')) {
    throw new HttpsError('permission-denied', 'Admin or president access required.');
  }
  return active.role;
}

async function assertPresident(uid) {
  const active = await getActiveRole(uid);
  if (!active || active.role !== 'president') {
    throw new HttpsError('permission-denied', 'President access required.');
  }
  return active.role;
}

async function assertBodAdminOrPresident(uid) {
  const active = await getActiveRole(uid);
  if (!active || !['bod', 'admin', 'president'].includes(active.role)) {
    throw new HttpsError('permission-denied', 'Approved BOD, admin, or president access required.');
  }
  return active.role;
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
  const name = normalizeText(
    data.name || record?.displayName || request.auth?.token?.name || email.split('@')[0],
    120
  );

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
    name: profile.name || existing.name || '',
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

async function assertBodEventsUnlockedForRole(role) {
  const lockSnap = await db.collection('locks').doc('bodEvents').get();
  const locked = lockSnap.exists && lockSnap.data()?.locked === true;
  if (locked && role !== 'president') {
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

async function assertPanelUnlockedForRole(panelKey, role, label) {
  const lockSnap = await db.collection('locks').doc(panelKey).get();
  const locked = lockSnap.exists && lockSnap.data()?.locked === true;
  if (locked && role !== 'president') {
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
    name: normalizeText(userData.name || record?.displayName || request.auth?.token?.name || request.auth?.token?.email || uid, 140),
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

function prospectCompletion(gbmAttended, avenueEventsAttended, duesPaid, criteria = PROSPECT_CRITERIA) {
  const requiredGbm = Math.max(1, Number(criteria.requiredGbm) || PROSPECT_CRITERIA.requiredGbm);
  const requiredAvenueEvents = Math.max(1, Number(criteria.requiredAvenueEvents) || PROSPECT_CRITERIA.requiredAvenueEvents);
  const duesRequired = criteria.duesRequired !== false;
  const checks = [
    gbmAttended >= requiredGbm,
    avenueEventsAttended >= requiredAvenueEvents,
  ];
  const progressParts = [
    Math.min(gbmAttended / requiredGbm, 1),
    Math.min(avenueEventsAttended / requiredAvenueEvents, 1),
  ];
  if (duesRequired) {
    checks.push(duesPaid === true);
    progressParts.push(duesPaid === true ? 1 : 0);
  }
  const completedCount = checks.filter(Boolean).length;
  const totalCount = checks.length;
  const percent = progressParts.length
    ? Math.round((progressParts.reduce((sum, value) => sum + value, 0) / progressParts.length) * 100)
    : 0;

  return {
    criteria: { requiredGbm, requiredAvenueEvents, duesRequired },
    completedCount,
    totalCount,
    percent,
    ready: completedCount === totalCount,
  };
}

async function recalcProspectProgress(uid, options = {}) {
  const progressRef = db.collection('prospectProgress').doc(uid);
  const attendanceRef = db.collection('attendance').doc(uid);
  const [eventsSnap, attendanceSnap, progressSnap] = await Promise.all([
    options.eventsSnap ? Promise.resolve(options.eventsSnap) : db.collection('events').get(),
    attendanceRef.get(),
    progressRef.get(),
  ]);
  const attendance = attendanceSnap.exists ? (attendanceSnap.data() || {}) : {};
  const current = progressSnap.exists ? (progressSnap.data() || {}) : {};
  let gbmAttended = 0;
  let avenueEventsAttended = 0;

  eventsSnap.docs.forEach(doc => {
    if (attendance[doc.id] !== true) return;
    const event = doc.data() || {};
    if (String(event.type || 'clubEvent') !== 'clubEvent') return;
    if (isGbmEvent(event)) gbmAttended += 1;
    if (isAvenueEvent(event)) avenueEventsAttended += 1;
  });

  const duesPaid = current.duesPaid === true;
  const completion = prospectCompletion(gbmAttended, avenueEventsAttended, duesPaid, current.criteria);
  const promoted = String(current.status || '').toLowerCase() === 'promoted';
  const now = admin.firestore.FieldValue.serverTimestamp();
  const update = {
    uid,
    gbmAttended,
    avenueEventsAttended,
    duesPaid,
    whatsappJoined: current.whatsappJoined === true,
    criteria: completion.criteria,
    completedCount: completion.completedCount,
    totalCount: completion.totalCount,
    percent: completion.percent,
    ready: completion.ready,
    status: promoted ? 'promoted' : (completion.ready ? 'ready' : 'in_progress'),
    createdAt: current.createdAt || now,
    updatedAt: now,
  };
  await progressRef.set(update, { merge: true });
  return {
    uid,
    gbmAttended,
    avenueEventsAttended,
    duesPaid,
    whatsappJoined: update.whatsappJoined,
    criteria: completion.criteria,
    completedCount: completion.completedCount,
    totalCount: completion.totalCount,
    percent: completion.percent,
    ready: completion.ready,
    status: update.status,
  };
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
            name: profile.name || current.name || '',
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
        whatsappJoined: currentProgress.whatsappJoined === true,
        criteria: {
          requiredGbm: Math.max(1, Number(currentCriteria.requiredGbm) || PROSPECT_CRITERIA.requiredGbm),
          requiredAvenueEvents: Math.max(1, Number(currentCriteria.requiredAvenueEvents) || PROSPECT_CRITERIA.requiredAvenueEvents),
          duesRequired: currentCriteria.duesRequired !== false,
        },
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
      name: profile.name,
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
  await assertAdminOrPresident(approverUid);

  const data = request.data || {};
  const targetUid = normalizeText(data.targetUid, 128);
  const approvedRole = normalizeRole(data.approvedRole);
  if (!targetUid || !APPROVABLE_ROLES.has(approvedRole)) {
    throw new HttpsError('invalid-argument', 'Valid target user and approved role required.');
  }

  const targetRole = await getActiveRole(targetUid);
  if (targetRole?.role === 'president') {
    throw new HttpsError('failed-precondition', 'President role is manual-only.');
  }

  const positionFallbacks = {
    gbm: 'Member',
    bod: 'BOD',
    admin: 'Admin',
  };
  const clubPosition = normalizeClubPosition(data.clubPosition, positionFallbacks[approvedRole]);
  const addToBodAttendance = approvedRole === 'bod' || data.addToBodAttendance === true;
  const eventIds = Object.keys(await buildNaMapFromCollection('events'));
  const districtEventIds = Object.keys(await buildNaMapFromCollection('districtEvents'));
  const bodMeetingIds = Object.keys(await buildNaMapFromCollection('bodMeetings'));

  const targetUserRef = db.collection('users').doc(targetUid);
  const targetRoleRef = db.collection('roles').doc(targetUid);
  const memberRef = db.collection('members').doc(targetUid);
  const attendanceRef = db.collection('attendance').doc(targetUid);
  const districtAttendanceRef = db.collection('districtAttendance').doc(targetUid);
  const bodMemberRef = db.collection('bodMembers').doc(targetUid);
  const bodAttendanceRef = db.collection('bodAttendance').doc(targetUid);
  const now = admin.firestore.FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    const [
      userSnap,
      memberSnap,
      attendanceSnap,
      districtAttendanceSnap,
      bodMemberSnap,
      bodAttendanceSnap,
    ] = await Promise.all([
      tx.get(targetUserRef),
      tx.get(memberRef),
      tx.get(attendanceRef),
      tx.get(districtAttendanceRef),
      tx.get(bodMemberRef),
      tx.get(bodAttendanceRef),
    ]);
    if (!userSnap.exists) {
      throw new HttpsError('not-found', 'User profile not found.');
    }
    const userData = userSnap.data() || {};
    const profile = {
      uid: targetUid,
      name: normalizeText(userData.name || userData.email || targetUid, 120),
      email: normalizeEmail(userData.email || ''),
    };

    tx.set(targetUserRef, {
      status: 'approved',
      role: approvedRole,
      requestedRole: approvedRole,
      clubPosition,
      addToBodAttendance,
      approvedAt: now,
      approvedBy: approverUid,
      updatedAt: now,
      rejectedAt: null,
      rejectedBy: null,
      rejectReason: null,
    }, { merge: true });

    tx.set(targetRoleRef, {
      role: approvedRole,
      status: 'approved',
      approvedBy: approverUid,
      updatedAt: now,
    }, { merge: true });

    setMemberProfileDoc(tx, memberRef, memberSnap, profile, approvedRole, clubPosition, now);
    setDocPreservingExistingAttendance(tx, attendanceRef, attendanceSnap, eventIds, now);
    setDocPreservingExistingAttendance(tx, districtAttendanceRef, districtAttendanceSnap, districtEventIds, now);

    if (addToBodAttendance) {
      setMemberProfileDoc(tx, bodMemberRef, bodMemberSnap, profile, approvedRole, clubPosition, now);
      setDocPreservingExistingAttendance(tx, bodAttendanceRef, bodAttendanceSnap, bodMeetingIds, now);
    }
  });

  return { ok: true, role: approvedRole };
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
  await assertAdminOrPresident(actorUid);

  const data = request.data || {};
  const targetUid = normalizeText(data.targetUid, 128);
  const role = normalizeRole(data.role);
  if (!targetUid || !APPROVABLE_ROLES.has(role)) {
    throw new HttpsError('invalid-argument', 'Valid target user and role required.');
  }

  const targetRole = await getActiveRole(targetUid);
  if (targetRole?.role === 'president') {
    throw new HttpsError('failed-precondition', 'President role is manual-only.');
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  await Promise.all([
    db.collection('users').doc(targetUid).set({
      status: 'approved',
      role,
      requestedRole: role,
      approvedAt: now,
      approvedBy: actorUid,
      updatedAt: now,
      rejectedAt: null,
      rejectedBy: null,
      rejectReason: null,
    }, { merge: true }),
    db.collection('roles').doc(targetUid).set({
      role,
      status: 'approved',
      updatedAt: now,
      approvedBy: actorUid,
    }, { merge: true }),
  ]);

  return { ok: true, role };
});

exports.getMyAccess = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const [userSnap, roleSnap] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.collection('roles').doc(uid).get(),
  ]);

  return {
    ok: true,
    uid,
    user: userSnap.exists ? userSnap.data() : null,
    role: roleSnap.exists ? roleSnap.data() : null,
  };
});

exports.getProspectManagementData = onCall(CALLABLE_OPTIONS, async (request) => {
  const actorUid = requireAuth(request);
  await assertAdminOrPresident(actorUid);

  const [roleProspectsSnap, typeProspectsSnap, initialProgressSnap, eventsSnap] = await Promise.all([
    db.collection('users').where('role', '==', 'prospect').get(),
    db.collection('users').where('memberType', '==', 'prospect').get(),
    db.collection('prospectProgress').get(),
    db.collection('events').get(),
  ]);
  const usersByUid = new Map();
  [...roleProspectsSnap.docs, ...typeProspectsSnap.docs].forEach(doc => {
    usersByUid.set(doc.id, { id: doc.id, ...(doc.data() || {}) });
  });

  const activeProspectUids = Array.from(usersByUid.values())
    .filter(user => normalizeRole(user.role) === 'prospect' || normalizeRole(user.memberType) === 'prospect')
    .map(user => user.id);
  await Promise.all(activeProspectUids.map(uid => recalcProspectProgress(uid, { eventsSnap })));

  const refreshedProgressSnap = await db.collection('prospectProgress').get();
  const progressDocs = refreshedProgressSnap.docs.length ? refreshedProgressSnap.docs : initialProgressSnap.docs;
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
      const activeProspect = normalizeRole(user.role) === 'prospect'
        || normalizeRole(user.memberType) === 'prospect';
      if (!activeProspect && !promoted) return null;

      const gbmAttended = Math.max(0, Number(progress.gbmAttended) || 0);
      const avenueEventsAttended = Math.max(0, Number(progress.avenueEventsAttended) || 0);
      const duesPaid = progress.duesPaid === true;
      const completion = prospectCompletion(gbmAttended, avenueEventsAttended, duesPaid, progress.criteria);
      const status = promoted ? 'promoted' : (completion.ready ? 'ready' : 'in_progress');
      return {
        uid,
        name: normalizeText(user.name || user.email || uid, 160),
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
        whatsappJoined: progress.whatsappJoined === true,
        criteria: completion.criteria,
        completedCount: completion.completedCount,
        totalCount: completion.totalCount,
        percent: completion.percent,
        ready: !promoted && completion.ready,
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
      needGbm: prospects.filter(item => item.status !== 'promoted' && item.gbmAttended < item.criteria.requiredGbm).length,
      needAvenue: prospects.filter(item => item.status !== 'promoted' && item.avenueEventsAttended < item.criteria.requiredAvenueEvents).length,
      needDues: prospects.filter(item => item.status !== 'promoted' && !item.duesPaid).length,
    },
  };
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
  if (!user || (normalizeRole(user.role) !== 'prospect' && normalizeRole(user.memberType) !== 'prospect')) {
    throw new HttpsError('failed-precondition', 'Active prospect account required.');
  }

  await db.collection('prospectProgress').doc(uid).set({
    uid,
    duesPaid,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  const progress = await recalcProspectProgress(uid);
  return { ok: true, uid, progress };
});

exports.recalculateProspectProgress = onCall(CALLABLE_OPTIONS, async (request) => {
  const actorUid = requireAuth(request);
  await assertAdminOrPresident(actorUid);
  const uid = normalizeText(request.data?.uid, 128);
  if (!uid) throw new HttpsError('invalid-argument', 'Prospect uid is required.');

  const userSnap = await db.collection('users').doc(uid).get();
  const user = userSnap.exists ? (userSnap.data() || {}) : null;
  if (!user || (normalizeRole(user.role) !== 'prospect' && normalizeRole(user.memberType) !== 'prospect')) {
    throw new HttpsError('failed-precondition', 'Active prospect account required.');
  }
  const progress = await recalcProspectProgress(uid);
  return { ok: true, uid, progress };
});

exports.promoteProspectToGbm = onCall(CALLABLE_OPTIONS, async (request) => {
  const actorUid = requireAuth(request);
  await assertAdminOrPresident(actorUid);
  const uid = normalizeText(request.data?.uid, 128);
  if (!uid) throw new HttpsError('invalid-argument', 'Prospect uid is required.');

  await recalcProspectProgress(uid);
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
      && (normalizeRole(user.role) === 'prospect' || normalizeRole(user.memberType) === 'prospect')
      && (!role || normalizeRole(role.role) === 'prospect');
    if (!activeProspect) {
      throw new HttpsError('failed-precondition', 'Active prospect account required.');
    }

    const gbmAttended = Math.max(0, Number(progress.gbmAttended) || 0);
    const avenueEventsAttended = Math.max(0, Number(progress.avenueEventsAttended) || 0);
    const duesPaid = progress.duesPaid === true;
    const completion = prospectCompletion(gbmAttended, avenueEventsAttended, duesPaid, progress.criteria);
    if (!completion.ready) {
      throw new HttpsError('failed-precondition', 'Prospect has not completed all promotion criteria.');
    }

    const profile = {
      uid,
      name: normalizeText(user.name || user.email || uid, 120),
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
      completedCount: completion.completedCount,
      totalCount: completion.totalCount,
      percent: 100,
      promotedAt: now,
      promotedBy: actorUid,
      updatedAt: now,
    }, { merge: true });
  });

  return { ok: true, uid, role: 'gbm', status: 'promoted' };
});

exports.getMyDashboardStats = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const active = await getActiveRole(uid);
  if (!active || !ACTIVE_ROLES.has(active.role)) {
    throw new HttpsError('failed-precondition', 'Approved account required.');
  }

  if (active.role === 'prospect') {
    const [userSnap, progressSnap, eventsSnap] = await Promise.all([
      db.collection('users').doc(uid).get(),
      db.collection('prospectProgress').doc(uid).get(),
      db.collection('events').get(),
    ]);
    const userData = userSnap.exists ? (userSnap.data() || {}) : {};
    const progressData = progressSnap.exists ? (progressSnap.data() || {}) : {};
    const storedCriteria = progressData.criteria || {};
    const criteria = {
      requiredGbm: Math.max(1, Number(storedCriteria.requiredGbm) || PROSPECT_CRITERIA.requiredGbm),
      requiredAvenueEvents: Math.max(1, Number(storedCriteria.requiredAvenueEvents) || PROSPECT_CRITERIA.requiredAvenueEvents),
      duesRequired: storedCriteria.duesRequired !== false,
    };
    const gbmAttended = Math.max(0, Number(progressData.gbmAttended) || 0);
    const avenueEventsAttended = Math.max(0, Number(progressData.avenueEventsAttended) || 0);
    const duesPaid = progressData.duesPaid === true;
    const completion = prospectCompletion(gbmAttended, avenueEventsAttended, duesPaid, criteria);
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
        gbmAttended,
        avenueEventsAttended,
        duesPaid,
        whatsappJoined: progressData.whatsappJoined === true,
        criteria: completion.criteria,
        completedCount: completion.completedCount,
        totalCount: completion.totalCount,
        percent: completion.percent,
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
  ] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.collection('members').doc(uid).get(),
    db.collection('attendance').doc(uid).get(),
    db.collection('events').get(),
    db.collection('districtAttendance').doc(uid).get(),
    db.collection('districtEvents').get(),
    db.collection('members').get(),
    db.collection('attendance').get(),
  ]);

  const userData = userSnap.exists ? (userSnap.data() || {}) : {};
  const memberData = memberSnap.exists ? (memberSnap.data() || {}) : {};
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
    profile: {
      uid,
      name: userData.name || memberData.name || request.auth?.token?.name || '',
      email: userData.email || memberData.email || request.auth?.token?.email || '',
      role: active.role,
      clubPosition: userData.clubPosition || '',
      memberName: memberData.name || '',
      memberPosition: memberData.position || '',
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
  const role = await assertBodAdminOrPresident(uid);
  await assertBodEventsUnlockedForRole(role);

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
    role,
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
  const role = await assertAdminOrPresident(uid);
  await assertPanelUnlockedForRole('treasury', role, 'Treasury');

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
    role,
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

exports.submitBodEvent = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const role = await assertBodAdminOrPresident(uid);
  await assertBodEventsUnlockedForRole(role);

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

  return {
    ok: true,
    eventId,
    attendanceRowsUpdated,
    eventCreated,
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

  return {
    ok: true,
    eventId: bodEventId,
    attendanceRowsUpdated,
    eventCreated,
  };
});

exports.updateBodEvent = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const role = await assertBodAdminOrPresident(uid);
  await assertBodEventsUnlockedForRole(role);

  const eventId = validateEventDocId(request.data?.eventId);
  if (!eventId) throw new HttpsError('invalid-argument', 'Event ID is required.');
  await assertBodEventRecordIsClubEvent(eventId);

  const payload = normalizeBodEventPayload(request.data || {});
  const userProfile = await getCallableUserProfile(uid, request);
  const now = admin.firestore.FieldValue.serverTimestamp();

  await writeSyncedBodEvent({ eventId, payload, uid, userProfile, now });
  const attendanceRowsUpdated = await initializeAttendanceForEvent(eventId, now);

  return {
    ok: true,
    eventId,
    attendanceRowsUpdated,
  };
});

exports.archiveBodEvent = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const role = await assertBodAdminOrPresident(uid);
  await assertBodEventsUnlockedForRole(role);

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

  return { ok: true, eventId };
});

exports.createAdminClubEvent = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const role = await assertAdminOrPresident(uid);
  await assertPanelUnlockedForRole('attendance', role, 'Attendance Manager');

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

  return { ok: true, eventId, eventCreated, attendanceRowsUpdated };
});

exports.updateAdminClubEvent = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const role = await assertAdminOrPresident(uid);
  await assertPanelUnlockedForRole('attendance', role, 'Attendance Manager');

  const eventId = validateEventDocId(request.data?.eventId);
  if (!eventId) throw new HttpsError('invalid-argument', 'Event ID is required.');

  const userProfile = await getCallableUserProfile(uid, request);
  const payload = normalizeClubEventPayload(request.data || {}, userProfile, 'adminAttendanceManager');
  const now = admin.firestore.FieldValue.serverTimestamp();

  await writeSyncedBodEvent({ eventId, payload, uid, userProfile, now });
  const attendanceRowsUpdated = await initializeAttendanceForEvent(eventId, now);
  return { ok: true, eventId, attendanceRowsUpdated };
});

exports.archiveAdminClubEvent = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const role = await assertAdminOrPresident(uid);
  await assertPanelUnlockedForRole('attendance', role, 'Attendance Manager');

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
  return { ok: true, eventId };
});

exports.createBodMeetingSynced = onCall(CALLABLE_OPTIONS, async (request) => {
  const uid = requireAuth(request);
  const role = await assertAdminOrPresident(uid);
  await assertPanelUnlockedForRole('bodAttendance', role, 'BOD Attendance');

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
  const role = await assertAdminOrPresident(uid);
  await assertPanelUnlockedForRole('bodAttendance', role, 'BOD Attendance');

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
  const role = await assertAdminOrPresident(uid);
  await assertPanelUnlockedForRole('bodAttendance', role, 'BOD Attendance');

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
  const role = await assertAdminOrPresident(uid);
  await assertPanelUnlockedForRole('attendance', role, 'District Attendance');

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
  const role = await assertAdminOrPresident(uid);
  await assertPanelUnlockedForRole('attendance', role, 'District Attendance');

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
  const role = await assertAdminOrPresident(uid);
  await assertPanelUnlockedForRole('attendance', role, 'District Attendance');

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
  await assertPresident(actorUid);

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
