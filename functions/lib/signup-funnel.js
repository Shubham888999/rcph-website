'use strict';

// Signup funnel: attribution sanitizing, Prospect field rules, the officer
// notification on new signups, member invite codes and the funnel report.
// Everything is dependency-injected so scripts/verify-signup-funnel.js can run
// it without loading index.js.

const crypto = require('crypto');
const { isCurrentHolderAccount } = require('./position-holders');
const { WEBSITE_DIRECTOR_POSITION_KEY } = require('./positions');
const { stripRotaractorPrefix } = require('./member-name');

const INVITE_CODES_COLLECTION = 'inviteCodes';
const INVITE_LINK_BASE_URL = 'https://rcph3131.org/join?ref=';
// No 0/o/1/l/i, so a code survives being read out or retyped from a screenshot.
const INVITE_CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const INVITE_CODE_LENGTH = 8;
const INVITE_CODE_PATTERN = new RegExp(`^[${INVITE_CODE_ALPHABET}]{${INVITE_CODE_LENGTH}}$`);
const INVITE_CODE_MAX_ATTEMPTS = 5;
const INVITE_ELIGIBLE_ROLES = new Set(['gbm', 'bod', 'admin', 'president']);
const MEMBER_ROLES = INVITE_ELIGIBLE_ROLES;

const SIGNUP_SOURCE_MAX_LENGTH = 60;
const LANDING_PATH_MAX_LENGTH = 120;
const DIRECT_SOURCE = 'direct';
const PROSPECT_GENDERS = new Set(['woman', 'man', 'non-binary', 'self-describe', 'prefer-not-to-say']);

// Who hears about new signups, besides the club inbox. Edit here.
const SIGNUP_NOTIFY_POSITION_KEYS = Object.freeze([
  'president',
  'mdo',
  'secretary',
  'immediate-past-president',
  WEBSITE_DIRECTOR_POSITION_KEY,
]);
const OFFICER_NOTIFICATION_SENDER = '"RCPH Support" <no-reply@rcph3131.org>';
const ACCOUNTS_AND_ROLES_URL = 'https://rcph3131.org/admin/requests';
// The callable has to wait for the send (Cloud Run stops the CPU after the
// response), so the wait is capped instead of being left to the SMTP timeouts.
const OFFICER_NOTIFICATION_TIMEOUT_MS = 8000;

const FUNNEL_DEFAULT_DAYS = 30;
const FUNNEL_MAX_DAYS = 365;
const FUNNEL_PATH_BY_CONSENT_SOURCE = Object.freeze({
  'prospect-signup': 'prospect',
  'member-signup': 'member',
  'district-official-signup': 'district',
});

function cleanText(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function normalizeRoleValue(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeFlag(value) {
  if (typeof value === 'boolean') return value;
  return ['true', 'yes', '1'].includes(String(value || '').trim().toLowerCase());
}

function sanitizeSignupSource(value) {
  if (typeof value !== 'string') return '';
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '')
    .slice(0, SIGNUP_SOURCE_MAX_LENGTH)
    .replace(/-+$/, '');
}

// Path only: query strings and fragments can carry personal data.
function sanitizeLandingPath(value) {
  if (typeof value !== 'string') return '';
  const path = value.trim().split(/[?#]/)[0].slice(0, LANDING_PATH_MAX_LENGTH);
  return /^\/(?!\/)[A-Za-z0-9/_.~-]*$/.test(path) ? path : '';
}

function normalizeInviteCode(value) {
  const code = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return INVITE_CODE_PATTERN.test(code) ? code : '';
}

function generateInviteCode(randomInt = crypto.randomInt) {
  let code = '';
  for (let index = 0; index < INVITE_CODE_LENGTH; index += 1) {
    code += INVITE_CODE_ALPHABET[randomInt(INVITE_CODE_ALPHABET.length)];
  }
  return code;
}

// Only phone stays required here; name, email, date of birth and consents are
// checked by assertProspectRequiredFields once the auth identity is known.
function normalizeProspectSignupData(data, { HttpsError }) {
  const phone = cleanText(data.phone, 40);
  const gender = cleanText(data.gender, 40).toLowerCase();
  const genderSelfDescribe = gender === 'self-describe'
    ? cleanText(data.genderSelfDescribe ?? data.genderSelfDescription, 160)
    : '';
  const previousRotaract = normalizeFlag(data.previousRotaract);
  const referred = normalizeFlag(data.referred);

  if (!phone) {
    throw new HttpsError('invalid-argument', 'Phone is required.');
  }
  if (gender && !PROSPECT_GENDERS.has(gender)) {
    throw new HttpsError('invalid-argument', 'Choose a listed gender option.');
  }

  return {
    phone,
    gender,
    genderSelfDescribe,
    hobbies: cleanText(data.hobbies, 600),
    previousRotaract,
    previousRotaractDetails: previousRotaract ? cleanText(data.previousRotaractDetails, 1200) : 'N/A',
    joinReason: cleanText(data.joinReason, 1200),
    referred,
    referredBy: referred ? cleanText(data.referredBy, 160) : 'N/A',
  };
}

function assertProspectRequiredFields({ data, email, dateOfBirth, consent }, { HttpsError }) {
  if (!cleanText(data.name, 120)) {
    throw new HttpsError('invalid-argument', 'Full name is required.');
  }
  if (!email) {
    throw new HttpsError('invalid-argument', 'Email is required.');
  }
  if (!dateOfBirth) {
    throw new HttpsError('invalid-argument', 'Date of birth is required.');
  }
  if (consent?.termsAccepted !== true || consent?.privacyAccepted !== true) {
    throw new HttpsError('invalid-argument', 'Terms and Privacy acceptance are required.');
  }
}

function isApprovedActiveAccount(userData, roleData) {
  if (!isCurrentHolderAccount(userData) || !roleData) return false;
  return String(roleData.status || 'approved').toLowerCase() === 'approved'
    && roleData.active !== false
    && normalizeRoleValue(roleData.role) === normalizeRoleValue(userData.role);
}

// Keeps attribution from the first request when a pending signup is resubmitted.
function attributionForWrite(existing, attribution) {
  const result = {};
  Object.entries(attribution || {}).forEach(([field, value]) => {
    if (value && !existing?.[field]) result[field] = value;
  });
  return result;
}

function signupPathLabel(signup) {
  const role = normalizeRoleValue(signup.requestedRole);
  if (role === 'prospect') return 'Prospect';
  if (role === 'districtofficial') return 'District Official access request';
  return `Member access request (${role === 'gbm' ? 'GBM' : role === 'bod' ? 'BOD' : role === 'admin' ? 'Admin' : 'unspecified role'})`;
}

function signupNotificationSubject(signup) {
  const role = normalizeRoleValue(signup.requestedRole);
  if (role === 'prospect') return 'New Prospect Signup - RCPH';
  if (role === 'gbm') return 'New GBM Signup - RCPH';
  if (role === 'bod') return 'New BOD Access Request - RCPH';
  if (role === 'admin') return 'New Admin Access Request - RCPH';
  if (role === 'districtofficial') return 'New District Official Access Request - RCPH';
  return 'New Account Signup - RCPH';
}

function signupNotificationHighlight(signup) {
  return normalizeRoleValue(signup.requestedRole) === 'prospect'
    ? 'Prospect account active immediately (auto-approved). It is listed under Approved, not Pending.'
    : 'Pending approval. Action required in Accounts & Roles.';
}

function formatSignupTimeIst(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  const formatted = date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
  return `${formatted} IST`;
}

function signupReferredByLabel(signup) {
  const freeText = cleanText(signup.referredBy, 160);
  return cleanText(signup.referredByName, 160) || (freeText === 'N/A' ? '' : freeText) || 'N/A';
}

// Rows are an explicit whitelist: date of birth must never reach this email.
function signupNotificationRows(signup) {
  const rows = [
    ['Name', cleanText(signup.name, 160) || 'N/A'],
    ['Path', signupPathLabel(signup)],
    ['Phone', cleanText(signup.phone, 40) || 'N/A'],
    ['Email', cleanText(signup.email, 320) || 'N/A'],
    ['Source', cleanText(signup.signupSource, SIGNUP_SOURCE_MAX_LENGTH) || DIRECT_SOURCE],
    ['Referred by', signupReferredByLabel(signup)],
    ['Signup time', formatSignupTimeIst(signup.createdAt)],
  ];
  const districtPosition = cleanText(signup.districtOfficialPosition, 180);
  if (districtPosition) rows.splice(2, 0, ['District position', districtPosition]);
  return rows;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildSignupNotificationEmail(signup) {
  const rows = signupNotificationRows(signup);
  const highlight = signupNotificationHighlight(signup);
  return {
    subject: signupNotificationSubject(signup),
    text: [
      'New RCPH signup',
      '',
      highlight,
      '',
      ...rows.map(([label, value]) => `${label}: ${value}`),
      '',
      `Accounts & Roles: ${ACCOUNTS_AND_ROLES_URL}`,
    ].join('\n'),
    html: `
    <div style="font-family:Arial,sans-serif;color:#1f1f1f;line-height:1.5;max-width:760px;">
      <h2 style="color:#9b6814;margin-bottom:8px;">New RCPH signup</h2>
      <p style="padding:12px 14px;background:#fff7df;border-left:4px solid #f4b43a;"><strong>${escapeHtml(highlight)}</strong></p>
      <table style="border-collapse:collapse;width:100%;margin:18px 0;">${rows.map(([label, value]) => `
        <tr>
          <th style="padding:8px 12px;border:1px solid #e6e6e6;text-align:left;background:#faf7ef;vertical-align:top;">${escapeHtml(label)}</th>
          <td style="padding:8px 12px;border:1px solid #e6e6e6;white-space:pre-wrap;">${escapeHtml(value)}</td>
        </tr>`).join('')}</table>
      <p><a href="${ACCOUNTS_AND_ROLES_URL}">Open Accounts &amp; Roles</a></p>
    </div>`,
  };
}

function funnelPathForUser(userData) {
  const fromConsent = FUNNEL_PATH_BY_CONSENT_SOURCE[userData.consentSource];
  if (fromConsent) return fromConsent;
  // Accounts from before consent tracking. requestedRole is not usable alone:
  // approval overwrites it, so a promoted Prospect would read as a member path.
  const signupType = normalizeRoleValue(userData.signupType);
  if (signupType === 'prospect') return 'prospect';
  if (signupType === 'district-official') return 'district';
  return userData.requestedRole ? 'member' : '';
}

function normalizeFunnelDays(value) {
  const days = Math.floor(Number(value));
  if (!Number.isFinite(days) || days < 1) return FUNNEL_DEFAULT_DAYS;
  return Math.min(days, FUNNEL_MAX_DAYS);
}

function addFunnelRow(rows, key, approved, member) {
  const row = rows.get(key) || { key, signups: 0, approved: 0, member: 0 };
  row.signups += 1;
  if (approved) row.approved += 1;
  if (member) row.member += 1;
  rows.set(key, row);
}

function sortedFunnelRows(rows) {
  return Array.from(rows.values()).sort((a, b) => b.signups - a.signups || a.key.localeCompare(b.key));
}

function summarizeSignupFunnel(users) {
  const bySource = new Map();
  const byPath = new Map();
  const totals = { signups: 0, approved: 0, member: 0 };
  users.forEach((userData) => {
    const path = funnelPathForUser(userData);
    if (!path) return;
    const approved = isCurrentHolderAccount(userData);
    const member = approved && MEMBER_ROLES.has(normalizeRoleValue(userData.role));
    totals.signups += 1;
    if (approved) totals.approved += 1;
    if (member) totals.member += 1;
    addFunnelRow(bySource, cleanText(userData.signupSource, SIGNUP_SOURCE_MAX_LENGTH) || DIRECT_SOURCE, approved, member);
    addFunnelRow(byPath, path, approved, member);
  });
  return { ...totals, bySource: sortedFunnelRows(bySource), byPath: sortedFunnelRows(byPath) };
}

function createSignupFunnelService(deps) {
  const {
    db,
    admin,
    HttpsError,
    positionHelpers,
    transporter,
    emailConfigured,
    clubInboxRecipients,
    assertFunnelAuthority,
    logger = console,
    now = () => Date.now(),
    randomInt = crypto.randomInt,
    notificationTimeoutMs = OFFICER_NOTIFICATION_TIMEOUT_MS,
  } = deps;

  async function resolveReferrer(rawCode, signupUid) {
    const code = normalizeInviteCode(rawCode);
    if (!code) return {};
    const codeSnap = await db.collection(INVITE_CODES_COLLECTION).doc(code).get();
    const referrerUid = codeSnap.exists ? cleanText(codeSnap.data()?.uid, 128) : '';
    if (!referrerUid || referrerUid === signupUid) return {};
    const userSnap = await db.collection('users').doc(referrerUid).get();
    const referrer = userSnap.exists ? (userSnap.data() || {}) : null;
    if (!isCurrentHolderAccount(referrer) || !INVITE_ELIGIBLE_ROLES.has(normalizeRoleValue(referrer.role))) return {};
    return {
      referredByUid: referrerUid,
      referredByName: stripRotaractorPrefix(cleanText(referrer.name, 160)),
    };
  }

  // Never throws: a bad or unreadable code must not cost anyone their signup.
  async function resolveSignupAttribution(data, signupUid) {
    const attribution = {
      signupSource: sanitizeSignupSource(data.signupSource),
      landingPath: sanitizeLandingPath(data.landingPath),
    };
    try {
      Object.assign(attribution, await resolveReferrer(data.referralCode, signupUid));
    } catch (err) {
      logger.warn('Signup referral lookup failed', { uid: signupUid, message: err?.message || String(err) });
    }
    return attribution;
  }

  // Current holders of SIGNUP_NOTIFY_POSITION_KEYS, deduplicated by email, approved active accounts only.
  async function resolveOfficerRecipients() {
    const assignmentSnap = await db.collection('bodPositionAssignments').where('active', '==', true).get();
    const uids = new Set();
    assignmentSnap.forEach((snap) => {
      const assignment = snap.data() || {};
      const positionKey = SIGNUP_NOTIFY_POSITION_KEYS.find(key => positionHelpers.isActivePositionAssignment(assignment.uid, key, assignment));
      if (positionKey) uids.add(assignment.uid);
    });
    const ids = Array.from(uids).sort();
    if (!ids.length) return [];
    const [userSnaps, roleSnaps] = await Promise.all([
      db.getAll(...ids.map(uid => db.collection('users').doc(uid))),
      db.getAll(...ids.map(uid => db.collection('roles').doc(uid))),
    ]);
    const emails = new Set();
    ids.forEach((uid, index) => {
      const userData = userSnaps[index]?.exists ? (userSnaps[index].data() || {}) : null;
      const roleData = roleSnaps[index]?.exists ? (roleSnaps[index].data() || {}) : null;
      if (!isApprovedActiveAccount(userData, roleData)) return;
      const email = cleanText(userData.email, 320).toLowerCase();
      if (/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) emails.add(email);
    });
    return Array.from(emails);
  }

  async function sendOfficerNotification(signup) {
    if (!emailConfigured) return { sent: false, reason: 'email-not-configured' };
    let officers = [];
    try {
      officers = await resolveOfficerRecipients();
    } catch (err) {
      // The club inbox still hears about the signup when officers can't be resolved.
      logger.warn('Signup notification officer lookup failed', { uid: signup.uid, message: err?.message || String(err) });
    }
    const recipients = Array.from(new Set([...officers, ...clubInboxRecipients()]));
    if (!recipients.length) return { sent: false, reason: 'no-recipients' };
    await transporter.sendMail({
      from: OFFICER_NOTIFICATION_SENDER,
      to: recipients.join(', '),
      ...buildSignupNotificationEmail(signup),
    });
    return { sent: true, recipients };
  }

  // Best effort: never throws, and never holds a signup longer than the cap.
  async function notifyOfficersOfSignup(signup) {
    let timer;
    try {
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Officer notification timed out.')), notificationTimeoutMs);
      });
      const result = await Promise.race([sendOfficerNotification(signup), timeout]);
      if (!result.sent) logger.warn('Signup notification skipped', { uid: signup.uid, reason: result.reason });
      return result;
    } catch (err) {
      logger.warn('Signup notification email failed', {
        uid: signup.uid,
        requestedRole: signup.requestedRole,
        message: err?.message || String(err),
      });
      return { sent: false, reason: 'send-failed' };
    } finally {
      clearTimeout(timer);
    }
  }

  async function assertInviteEligible(uid) {
    const [userSnap, roleSnap] = await Promise.all([
      db.collection('users').doc(uid).get(),
      db.collection('roles').doc(uid).get(),
    ]);
    const userData = userSnap.exists ? (userSnap.data() || {}) : null;
    const roleData = roleSnap.exists ? (roleSnap.data() || {}) : null;
    if (!isApprovedActiveAccount(userData, roleData) || !INVITE_ELIGIBLE_ROLES.has(normalizeRoleValue(userData.role))) {
      throw new HttpsError('permission-denied', 'Invite links are available to approved members only.');
    }
  }

  async function getOrCreateInviteCode(uid) {
    const userRef = db.collection('users').doc(uid);
    return db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      const existing = normalizeInviteCode(userSnap.data()?.inviteCode);
      if (existing) return existing;
      for (let attempt = 0; attempt < INVITE_CODE_MAX_ATTEMPTS; attempt += 1) {
        const code = generateInviteCode(randomInt);
        const codeRef = db.collection(INVITE_CODES_COLLECTION).doc(code);
        const codeSnap = await tx.get(codeRef);
        if (codeSnap.exists) continue;
        tx.set(codeRef, { uid, createdAt: admin.firestore.FieldValue.serverTimestamp() });
        tx.set(userRef, { inviteCode: code }, { merge: true });
        return code;
      }
      throw new HttpsError('unavailable', 'Could not create an invite link. Please try again.');
    });
  }

  async function getMyInviteLink({ uid }) {
    await assertInviteEligible(uid);
    const code = await getOrCreateInviteCode(uid);
    const countSnap = await db.collection('users').where('referredByUid', '==', uid).count().get();
    return {
      code,
      url: `${INVITE_LINK_BASE_URL}${code}`,
      referredCount: Number(countSnap.data()?.count) || 0,
    };
  }

  async function getSignupFunnel({ uid, days }) {
    await assertFunnelAuthority(uid);
    const windowDays = normalizeFunnelDays(days);
    const since = admin.firestore.Timestamp.fromMillis(now() - windowDays * 24 * 60 * 60 * 1000);
    const snap = await db.collection('users').where('createdAt', '>=', since).get();
    const users = [];
    snap.forEach(doc => users.push(doc.data() || {}));
    return { days: windowDays, ...summarizeSignupFunnel(users) };
  }

  return {
    attributionForWrite,
    getMyInviteLink,
    getSignupFunnel,
    notifyOfficersOfSignup,
    resolveOfficerRecipients,
    resolveSignupAttribution,
  };
}

module.exports = {
  ACCOUNTS_AND_ROLES_URL,
  INVITE_CODES_COLLECTION,
  INVITE_CODE_LENGTH,
  LANDING_PATH_MAX_LENGTH,
  OFFICER_NOTIFICATION_SENDER,
  SIGNUP_NOTIFY_POSITION_KEYS,
  SIGNUP_SOURCE_MAX_LENGTH,
  assertProspectRequiredFields,
  attributionForWrite,
  buildSignupNotificationEmail,
  createSignupFunnelService,
  generateInviteCode,
  normalizeFunnelDays,
  normalizeInviteCode,
  normalizeProspectSignupData,
  sanitizeLandingPath,
  sanitizeSignupSource,
  summarizeSignupFunnel,
};
