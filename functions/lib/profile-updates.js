'use strict';

const { stripRotaractorPrefix } = require('./member-name');

const CONTROL_CHAR_PATTERN = /[\u0000-\u001f\u007f]/;
const ACTIVE_ROLES = new Set(['prospect', 'gbm', 'bod', 'admin', 'president']);
const PROFILE_AUDIT_COLLECTION = 'profileChangeAudit';
const COMMON_PROFILE_FIELDS = [
  'name',
  'phone',
  'dateOfBirth',
  'gender',
  'genderSelfDescribe',
  'hobbies',
];
const PROSPECT_PROFILE_FIELDS = [
  'previousRotaract',
  'previousRotaractDetails',
  'joinReason',
  'referred',
  'referredBy',
];
const PROFILE_CONTROL_FIELDS = new Set(['targetUid', 'memberId']);
const PROTECTED_PROFILE_FIELDS = new Set([
  'uid',
  'id',
  'email',
  'rid',
  'role',
  'requestedRole',
  'status',
  'active',
  'positionKeys',
  'clubPosition',
  'position',
  'authority',
  'provider',
  'approval',
  'approvedAt',
  'approvedBy',
  'createdAt',
  'createdBy',
  'memberType',
  'signupType',
]);
const GENDERS = new Set([
  '',
  'woman',
  'man',
  'non-binary',
  'self-describe',
  'prefer-not-to-say',
]);

class ProfileUpdateValidationError extends Error {
  constructor(message, code = 'invalid-argument') {
    super(message);
    this.code = code;
  }
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function hasOwn(source, field) {
  return Object.prototype.hasOwnProperty.call(source || {}, field);
}

function normalizeRole(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeUid(value, field = 'targetUid') {
  if (typeof value !== 'string') {
    throw new ProfileUpdateValidationError(`${field} is required.`);
  }
  const uid = value.trim();
  if (!uid || uid.includes('/') || CONTROL_CHAR_PATTERN.test(uid) || uid.length > 128) {
    throw new ProfileUpdateValidationError(`${field} must be a valid UID.`);
  }
  return uid;
}

function normalizeStringField(value, {
  field,
  max,
  required = false,
  lower = false,
  stripPrefix = false,
} = {}) {
  if (value === undefined || value === null) {
    if (required) throw new ProfileUpdateValidationError(`${field} is required.`);
    return '';
  }
  if (typeof value !== 'string') {
    throw new ProfileUpdateValidationError(`${field} must be a string.`);
  }
  let normalized = value.trim();
  if (stripPrefix) normalized = stripRotaractorPrefix(normalized);
  if (lower) normalized = normalized.toLowerCase();
  if (required && !normalized) {
    throw new ProfileUpdateValidationError(`${field} is required.`);
  }
  if (normalized.length > max) {
    throw new ProfileUpdateValidationError(`${field} must be ${max} characters or fewer.`);
  }
  if (CONTROL_CHAR_PATTERN.test(normalized)) {
    throw new ProfileUpdateValidationError(`${field} cannot include control characters.`);
  }
  return normalized;
}

function todayDateString(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function daysInMonth(year, month) {
  if (month === 2) {
    if (year % 400 === 0) return 29;
    if (year % 100 === 0) return 28;
    return year % 4 === 0 ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function normalizeDateOfBirth(value, options = {}) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string') {
    throw new ProfileUpdateValidationError('dateOfBirth must be a YYYY-MM-DD string.');
  }
  const date = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ProfileUpdateValidationError('dateOfBirth must be a YYYY-MM-DD date.');
  }
  const [year, month, day] = date.split('-').map(Number);
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new ProfileUpdateValidationError('dateOfBirth must be a valid date.');
  }
  if (date < '1900-01-01') {
    throw new ProfileUpdateValidationError('dateOfBirth must be on or after 1900-01-01.');
  }
  const today = options.today || todayDateString(options.now || new Date());
  if (date > today) {
    throw new ProfileUpdateValidationError('dateOfBirth cannot be in the future.');
  }
  return date;
}

function normalizeBooleanField(value, field) {
  if (typeof value !== 'boolean') {
    throw new ProfileUpdateValidationError(`${field} must be a boolean.`);
  }
  return value;
}

function profileFieldsForRole(role) {
  return normalizeRole(role) === 'prospect'
    ? [...COMMON_PROFILE_FIELDS, ...PROSPECT_PROFILE_FIELDS]
    : COMMON_PROFILE_FIELDS.slice();
}

function isSupportedProfileField(field, role) {
  return profileFieldsForRole(role).includes(field);
}

function normalizeProfileUpdatePayload(data, role, options = {}) {
  if (!isPlainObject(data)) {
    throw new ProfileUpdateValidationError('Profile update payload required.');
  }

  const profile = {};
  for (const field of Object.keys(data)) {
    if (PROFILE_CONTROL_FIELDS.has(field)) continue;
    if (PROTECTED_PROFILE_FIELDS.has(field)) {
      throw new ProfileUpdateValidationError(`${field} cannot be updated from profile tools.`);
    }
    if (!isSupportedProfileField(field, role)) {
      throw new ProfileUpdateValidationError(`Unsupported profile field: ${field}.`);
    }
  }

  if (hasOwn(data, 'name')) {
    profile.name = normalizeStringField(data.name, {
      field: 'name',
      max: 160,
      required: true,
      stripPrefix: true,
    });
  }
  if (hasOwn(data, 'phone')) {
    profile.phone = normalizeStringField(data.phone, { field: 'phone', max: 40 });
  }
  if (hasOwn(data, 'dateOfBirth')) {
    profile.dateOfBirth = normalizeDateOfBirth(data.dateOfBirth, options);
  }
  if (hasOwn(data, 'gender')) {
    const gender = normalizeStringField(data.gender, { field: 'gender', max: 40, lower: true });
    if (!GENDERS.has(gender)) {
      throw new ProfileUpdateValidationError('gender must be a supported option.');
    }
    profile.gender = gender;
    if (gender !== 'self-describe') profile.genderSelfDescribe = '';
  }
  if (hasOwn(data, 'genderSelfDescribe')) {
    profile.genderSelfDescribe = normalizeStringField(data.genderSelfDescribe, {
      field: 'genderSelfDescribe',
      max: 160,
    });
  }
  if (hasOwn(data, 'hobbies')) {
    profile.hobbies = normalizeStringField(data.hobbies, { field: 'hobbies', max: 600 });
  }

  if (normalizeRole(role) === 'prospect') {
    if (hasOwn(data, 'previousRotaract')) {
      profile.previousRotaract = normalizeBooleanField(data.previousRotaract, 'previousRotaract');
      if (profile.previousRotaract === false && !hasOwn(data, 'previousRotaractDetails')) {
        profile.previousRotaractDetails = 'N/A';
      }
    }
    if (hasOwn(data, 'previousRotaractDetails')) {
      profile.previousRotaractDetails = normalizeStringField(data.previousRotaractDetails, {
        field: 'previousRotaractDetails',
        max: 1200,
      });
    }
    if (hasOwn(data, 'joinReason')) {
      profile.joinReason = normalizeStringField(data.joinReason, { field: 'joinReason', max: 1200 });
    }
    if (hasOwn(data, 'referred')) {
      profile.referred = normalizeBooleanField(data.referred, 'referred');
      if (profile.referred === false && !hasOwn(data, 'referredBy')) {
        profile.referredBy = 'N/A';
      }
    }
    if (hasOwn(data, 'referredBy')) {
      profile.referredBy = normalizeStringField(data.referredBy, {
        field: 'referredBy',
        max: 160,
        stripPrefix: true,
      });
    }
  }

  return profile;
}

function safeText(value, max = 300) {
  return String(value || '').trim().slice(0, max);
}

function safeBoolean(value) {
  return value === true;
}

function safeFieldValue(field, data = {}) {
  if (field === 'name') return stripRotaractorPrefix(safeText(data.name, 160));
  if (field === 'phone') return safeText(data.phone, 40);
  if (field === 'dateOfBirth') {
    try {
      return normalizeDateOfBirth(data.dateOfBirth, { today: '9999-12-31' });
    } catch {
      return '';
    }
  }
  if (field === 'gender') {
    const gender = safeText(data.gender, 40).toLowerCase();
    return GENDERS.has(gender) ? gender : '';
  }
  if (field === 'genderSelfDescribe') return safeText(data.genderSelfDescribe, 160);
  if (field === 'hobbies') return safeText(data.hobbies, 600);
  if (field === 'previousRotaract') return safeBoolean(data.previousRotaract);
  if (field === 'previousRotaractDetails') return safeText(data.previousRotaractDetails || 'N/A', 1200);
  if (field === 'joinReason') return safeText(data.joinReason, 1200);
  if (field === 'referred') return safeBoolean(data.referred);
  if (field === 'referredBy') return stripRotaractorPrefix(safeText(data.referredBy || 'N/A', 160));
  return '';
}

function safeProfileFromUserData(data = {}, role, extras = {}) {
  const cleanRole = normalizeRole(role);
  const profile = {
    ...extras,
    name: safeFieldValue('name', data),
    email: safeText(data.email, 320).toLowerCase(),
    role: cleanRole,
    phone: safeFieldValue('phone', data),
    dateOfBirth: safeFieldValue('dateOfBirth', data),
    gender: safeFieldValue('gender', data),
    genderSelfDescribe: safeFieldValue('genderSelfDescribe', data),
    hobbies: safeFieldValue('hobbies', data),
  };
  if (cleanRole === 'prospect') {
    profile.previousRotaract = safeFieldValue('previousRotaract', data);
    profile.previousRotaractDetails = safeFieldValue('previousRotaractDetails', data);
    profile.joinReason = safeFieldValue('joinReason', data);
    profile.referred = safeFieldValue('referred', data);
    profile.referredBy = safeFieldValue('referredBy', data);
  }
  return profile;
}

function ensureRoleDoc(data, uid, label) {
  const role = normalizeRole(data?.role);
  if (!ACTIVE_ROLES.has(role) || String(data?.status || 'approved').toLowerCase() !== 'approved') {
    throw new ProfileUpdateValidationError(`${label || uid} must have an approved active role.`, 'permission-denied');
  }
  return role;
}

function ensureActorUser(data) {
  if (!data || String(data.status || '').toLowerCase() !== 'approved' || data.active === false) {
    throw new ProfileUpdateValidationError('Approved active account required.', 'permission-denied');
  }
}

function finalizeProfileUpdate(profile, current, role) {
  const final = { ...profile };
  const effectiveGender = hasOwn(final, 'gender')
    ? final.gender
    : safeFieldValue('gender', current);
  const effectiveSelfDescription = hasOwn(final, 'genderSelfDescribe')
    ? final.genderSelfDescribe
    : safeFieldValue('genderSelfDescribe', current);

  if (effectiveGender === 'self-describe' && !effectiveSelfDescription) {
    throw new ProfileUpdateValidationError('genderSelfDescribe is required when gender is self-describe.');
  }
  if (effectiveGender !== 'self-describe' && hasOwn(final, 'genderSelfDescribe')) {
    final.genderSelfDescribe = '';
  }

  if (normalizeRole(role) === 'prospect') {
    const effectivePrevious = hasOwn(final, 'previousRotaract')
      ? final.previousRotaract
      : safeFieldValue('previousRotaract', current);
    const effectivePreviousDetails = hasOwn(final, 'previousRotaractDetails')
      ? final.previousRotaractDetails
      : safeFieldValue('previousRotaractDetails', current);
    if (effectivePrevious && !effectivePreviousDetails) {
      throw new ProfileUpdateValidationError('previousRotaractDetails is required when previousRotaract is true.');
    }
    if (!effectivePrevious && hasOwn(final, 'previousRotaract')) {
      final.previousRotaractDetails = 'N/A';
    }

    const effectiveReferred = hasOwn(final, 'referred')
      ? final.referred
      : safeFieldValue('referred', current);
    const effectiveReferredBy = hasOwn(final, 'referredBy')
      ? final.referredBy
      : safeFieldValue('referredBy', current);
    if (effectiveReferred && !effectiveReferredBy) {
      throw new ProfileUpdateValidationError('referredBy is required when referred is true.');
    }
    if (!effectiveReferred && hasOwn(final, 'referred')) {
      final.referredBy = 'N/A';
    }
  }

  return final;
}

function changedOnly(profile, current) {
  const changedFields = [];
  const before = {};
  const after = {};

  for (const field of Object.keys(profile)) {
    const currentValue = safeFieldValue(field, current);
    if (currentValue !== profile[field]) {
      changedFields.push(field);
      before[field] = currentValue;
      after[field] = profile[field];
    }
  }

  return { changedFields, before, after };
}

function serializeAuditDoc(id, data = {}) {
  const changedFields = Array.isArray(data.changedFields)
    ? data.changedFields.filter(field => typeof field === 'string')
    : [];
  const before = isPlainObject(data.before) ? data.before : {};
  const after = isPlainObject(data.after) ? data.after : {};
  const createdAtDate = data.createdAt?.toDate?.();
  return {
    id,
    action: data.action === 'profile_updated' ? 'profile_updated' : '',
    targetUid: safeText(data.targetUid, 128),
    targetRole: normalizeRole(data.targetRole),
    actorUid: safeText(data.actorUid, 128),
    actorRole: normalizeRole(data.actorRole),
    actorName: stripRotaractorPrefix(safeText(data.actorName, 160)),
    source: data.source === 'self' ? 'self' : 'admin',
    changedFields,
    before,
    after,
    createdAt: createdAtDate instanceof Date && !Number.isNaN(createdAtDate.getTime())
      ? createdAtDate.toISOString()
      : '',
  };
}

function createProfileUpdateService({ db, admin, HttpsError }) {
  function toHttps(err, fallbackMessage) {
    if (err instanceof HttpsError) return err;
    if (err instanceof ProfileUpdateValidationError) {
      return new HttpsError(err.code || 'invalid-argument', err.message);
    }
    return new HttpsError('internal', fallbackMessage || 'Profile update failed.');
  }

  async function loadActor(actorUid) {
    const uid = normalizeUid(actorUid, 'actorUid');
    const [authRecord, userSnap, roleSnap] = await Promise.all([
      admin.auth().getUser(uid),
      db.collection('users').doc(uid).get(),
      db.collection('roles').doc(uid).get(),
    ]);
    const userData = userSnap.exists ? (userSnap.data() || {}) : null;
    const roleData = roleSnap.exists ? (roleSnap.data() || {}) : null;
    if (authRecord.disabled === true) {
      throw new ProfileUpdateValidationError('Approved active account required.', 'permission-denied');
    }
    ensureActorUser(userData);
    const role = ensureRoleDoc(roleData, uid, 'Actor');
    return { uid, role, userData, roleData };
  }

  async function resolveTargetUidFromData(data) {
    if (hasOwn(data, 'targetUid')) return normalizeUid(data.targetUid, 'targetUid');
    if (!hasOwn(data, 'memberId')) {
      throw new ProfileUpdateValidationError('targetUid is required.');
    }

    const memberId = normalizeUid(data.memberId, 'memberId');
    const memberSnap = await db.collection('members').doc(memberId).get();
    if (!memberSnap.exists) {
      throw new ProfileUpdateValidationError('Member profile not found.', 'not-found');
    }
    const member = memberSnap.data() || {};
    const candidates = [
      member.userId,
      member.uid,
      memberId,
    ].map(value => String(value || '').trim()).filter(Boolean);
    for (const candidate of [...new Set(candidates)]) {
      const uid = normalizeUid(candidate, 'targetUid');
      const userSnap = await db.collection('users').doc(uid).get();
      if (userSnap.exists) return uid;
    }
    throw new ProfileUpdateValidationError('Linked user profile not found for this member.', 'not-found');
  }

  async function loadTarget(targetUid) {
    const uid = normalizeUid(targetUid, 'targetUid');
    const [userSnap, roleSnap] = await Promise.all([
      db.collection('users').doc(uid).get(),
      db.collection('roles').doc(uid).get(),
    ]);
    if (!userSnap.exists) {
      throw new ProfileUpdateValidationError('User profile not found.', 'not-found');
    }
    const roleData = roleSnap.exists ? (roleSnap.data() || {}) : null;
    const role = ensureRoleDoc(roleData, uid, 'Target');
    return { uid, role, userData: userSnap.data() || {}, roleData };
  }

  async function loadProjectionRefs(targetUid) {
    const collections = ['members', 'bodMembers'];
    const refs = new Map();
    for (const collectionName of collections) {
      const direct = db.collection(collectionName).doc(targetUid);
      refs.set(direct.path, direct);
      const [userIdSnap, uidSnap] = await Promise.all([
        db.collection(collectionName).where('userId', '==', targetUid).get(),
        db.collection(collectionName).where('uid', '==', targetUid).get(),
      ]);
      userIdSnap.docs.forEach(doc => refs.set(doc.ref.path, doc.ref));
      uidSnap.docs.forEach(doc => refs.set(doc.ref.path, doc.ref));
    }
    return [...refs.values()];
  }

  async function updateProfile({ actorUid, targetUid, data, source }) {
    try {
      const actor = await loadActor(actorUid);
      const target = await loadTarget(targetUid);
      const projectionRefs = await loadProjectionRefs(target.uid);
      const userRef = db.collection('users').doc(target.uid);
      const roleRef = db.collection('roles').doc(target.uid);
      const now = admin.firestore.FieldValue.serverTimestamp();
      let result = null;

      await db.runTransaction(async (tx) => {
        const targetUserSnap = await tx.get(userRef);
        const targetRoleSnap = await tx.get(roleRef);
        if (!targetUserSnap.exists) {
          throw new ProfileUpdateValidationError('User profile not found.', 'not-found');
        }
        const current = targetUserSnap.data() || {};
        const currentRole = ensureRoleDoc(targetRoleSnap.exists ? targetRoleSnap.data() || {} : null, target.uid, 'Target');
        const profile = finalizeProfileUpdate(
          normalizeProfileUpdatePayload(data, currentRole),
          current,
          currentRole
        );
        const projectionSnaps = await Promise.all(projectionRefs.map(ref => tx.get(ref)));
        const diff = changedOnly(profile, current);

        if (!diff.changedFields.length) {
          result = {
            ok: true,
            changed: false,
            changedFields: [],
            profile: safeProfileFromUserData(current, currentRole, { uid: target.uid }),
          };
          return;
        }

        tx.set(userRef, {
          ...diff.after,
          updatedAt: now,
          profileUpdatedAt: now,
          profileUpdatedBy: actor.uid,
          profileUpdatedSource: source === 'self' ? 'self' : 'admin',
        }, { merge: true });

        if (hasOwn(diff.after, 'name')) {
          projectionSnaps.forEach((snap) => {
            if (!snap.exists) return;
            tx.set(snap.ref, {
              name: diff.after.name,
              updatedAt: now,
              updatedBy: actor.uid,
            }, { merge: true });
          });
        }

        const auditRef = db.collection(PROFILE_AUDIT_COLLECTION).doc();
        tx.set(auditRef, {
          action: 'profile_updated',
          targetUid: target.uid,
          targetRole: currentRole,
          actorUid: actor.uid,
          actorRole: actor.role,
          actorName: safeFieldValue('name', actor.userData),
          source: source === 'self' ? 'self' : 'admin',
          changedFields: diff.changedFields,
          before: diff.before,
          after: diff.after,
          createdAt: now,
        });

        result = {
          ok: true,
          changed: true,
          changedFields: diff.changedFields,
          profile: safeProfileFromUserData({ ...current, ...diff.after }, currentRole, { uid: target.uid }),
        };
      });

      return result;
    } catch (err) {
      throw toHttps(err, 'Profile update failed.');
    }
  }

  async function updateSelfProfile({ actorUid, data }) {
    const uid = normalizeUid(actorUid, 'actorUid');
    return updateProfile({ actorUid: uid, targetUid: uid, data: data || {}, source: 'self' });
  }

  async function updateAdminProfile({ actorUid, data }) {
    try {
      const targetUid = await resolveTargetUidFromData(data || {});
      return updateProfile({ actorUid, targetUid, data: data || {}, source: 'admin' });
    } catch (err) {
      throw toHttps(err, 'Profile update failed.');
    }
  }

  async function getProfileChangeHistory({ actorUid, targetUid, limit, cursor }) {
    try {
      await loadActor(actorUid);
      const uid = normalizeUid(targetUid, 'targetUid');
      const requestedLimit = Number.isInteger(limit) ? limit : 20;
      if (requestedLimit < 1 || requestedLimit > 50) {
        throw new ProfileUpdateValidationError('limit must be between 1 and 50.');
      }

      let query = db.collectionGroup(PROFILE_AUDIT_COLLECTION)
        .where('targetUid', '==', uid)
        .orderBy('createdAt', 'desc')
        .orderBy(admin.firestore.FieldPath.documentId(), 'desc')
        .limit(requestedLimit);

      if (cursor) {
        const cursorId = normalizeUid(cursor, 'cursor');
        const cursorSnap = await db.collection(PROFILE_AUDIT_COLLECTION).doc(cursorId).get();
        if (!cursorSnap.exists) {
          throw new ProfileUpdateValidationError('History cursor is no longer available.');
        }
        query = query.startAfter(cursorSnap);
      }

      const snap = await query.get();
      const entries = snap.docs.map(doc => serializeAuditDoc(doc.id, doc.data() || {}));
      return {
        ok: true,
        history: entries,
        nextCursor: snap.docs.length === requestedLimit ? snap.docs[snap.docs.length - 1].id : null,
      };
    } catch (err) {
      throw toHttps(err, 'Profile history could not be loaded.');
    }
  }

  return {
    getProfileChangeHistory,
    normalizeDateOfBirth,
    normalizeProfileUpdatePayload,
    safeProfileFromUserData,
    updateAdminProfile,
    updateSelfProfile,
  };
}

module.exports = {
  ACTIVE_ROLES,
  COMMON_PROFILE_FIELDS,
  PROFILE_AUDIT_COLLECTION,
  PROSPECT_PROFILE_FIELDS,
  ProfileUpdateValidationError,
  createProfileUpdateService,
  normalizeDateOfBirth,
  normalizeProfileUpdatePayload,
  safeProfileFromUserData,
};
