'use strict';

const crypto = require('crypto');
const defaultPositionHelpers = require('./positions');

const VISIT_TYPES = Object.freeze({
  clubAssembly: Object.freeze({
    visitType: 'clubAssembly',
    displayTitle: 'Club Assembly',
    sortOrder: 1,
  }),
  dzrVisit: Object.freeze({
    visitType: 'dzrVisit',
    displayTitle: 'DZR Visit',
    sortOrder: 2,
  }),
  drrVisit: Object.freeze({
    visitType: 'drrVisit',
    displayTitle: 'DRR Visit',
    sortOrder: 3,
  }),
});

const VISIT_TYPE_KEYS = Object.freeze(['clubAssembly', 'dzrVisit', 'drrVisit']);
const VISIT_ACCESS_ROLES = Object.freeze(['bod', 'admin', 'president']);
const VISIT_ADMIN_ROLES = Object.freeze(['admin', 'president']);
const VISIT_ACCESS_ROLE_SET = new Set(VISIT_ACCESS_ROLES);
const VISIT_ADMIN_ROLE_SET = new Set(VISIT_ADMIN_ROLES);

const DEFAULT_MAX_ACTIVE_FILES = 40;
const DEFAULT_MAX_FILES_PER_SELECTION = 10;
const DEFAULT_MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const MIN_FILE_SIZE_BYTES = 1024 * 1024;
const VISIT_UPLOAD_TYPE = 'visitsubmission';
const VISIT_UPLOAD_PURPOSE = 'visitSubmission';
const VISIT_UPLOAD_SESSION_TTL_MS = 30 * 60 * 1000;
const VISIT_UPLOAD_TICKET_TTL_MS = 10 * 60 * 1000;
const VISIT_UPLOAD_TICKET_DELETE_GRACE_MS = 24 * 60 * 60 * 1000;
const VISIT_UPLOAD_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const VISIT_UPLOAD_RATE_LIMIT = 50;
const VISIT_SUBMISSION_STATUSES = Object.freeze(['active', 'replaced', 'admin-removed', 'archived']);
const VISIT_UPLOAD_SESSION_ACTIVE_STATUSES = Object.freeze(['pending', 'partial']);
const VISIT_UPLOAD_SESSION_TERMINAL_STATUSES = Object.freeze(['finalized', 'cancelled', 'expired']);
const VISIT_ALLOWED_MIME_BY_EXTENSION = Object.freeze({
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  csv: 'text/csv',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
});
const VISIT_DANGEROUS_EXTENSIONS = new Set([
  'exe',
  'bat',
  'cmd',
  'ps1',
  'sh',
  'js',
  'html',
  'svg',
  'zip',
  'rar',
  '7z',
]);

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function clone(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function makeVisitSubmissionError(code, message, details) {
  const err = new Error(message);
  err.httpsCode = code;
  err.code = code;
  err.details = details || {};
  return err;
}

function normalizeText(value, max = 1000) {
  if (value == null) return '';
  return String(value).trim().replace(/\s+/g, ' ').slice(0, max);
}

function nowMillis(clock) {
  return clock && typeof clock.now === 'function' ? clock.now() : Date.now();
}

function generateRandomHex(bytes = 32, tokenGenerator) {
  if (tokenGenerator && typeof tokenGenerator.randomHex === 'function') {
    return tokenGenerator.randomHex(bytes);
  }
  return crypto.randomBytes(bytes).toString('hex');
}

function hashSecret(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function timestampFromMillis(adapter, millis) {
  if (adapter && typeof adapter.timestampFromMillis === 'function') {
    return adapter.timestampFromMillis(millis);
  }
  return millis;
}

function timestampToMillis(value) {
  if (typeof value === 'number') return value;
  if (value && typeof value.toMillis === 'function') return value.toMillis();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeUploadText(value, max = 200) {
  return String(value || '')
    .replace(/[\\/:*?"<>|\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s]+/, '')
    .replace(/[.\s]+$/, '')
    .slice(0, max)
    .trim();
}

function fileExtension(fileName) {
  const match = String(fileName || '').toLowerCase().match(/\.([a-z0-9]{1,12})$/);
  return match ? match[1] : '';
}

function sanitizeVisitFileName(value) {
  const cleaned = normalizeUploadText(String(value || '').split(/[\\/]/).pop() || '', 180);
  if (!cleaned) {
    throw makeVisitSubmissionError('invalid-argument', 'File name is required.');
  }
  const extension = fileExtension(cleaned);
  if (!extension) {
    throw makeVisitSubmissionError('invalid-argument', 'File extension is required.');
  }
  if (VISIT_DANGEROUS_EXTENSIONS.has(extension)) {
    throw makeVisitSubmissionError('invalid-argument', 'Unsupported file extension.');
  }
  if (!VISIT_ALLOWED_MIME_BY_EXTENSION[extension]) {
    throw makeVisitSubmissionError('invalid-argument', 'Unsupported file extension.');
  }
  return cleaned;
}

function validateVisitFileType(fileName, mimeTypeValue) {
  const safeName = sanitizeVisitFileName(fileName);
  const extension = fileExtension(safeName);
  const mimeType = normalizeText(mimeTypeValue, 160).toLowerCase();
  const expectedMime = VISIT_ALLOWED_MIME_BY_EXTENSION[extension];
  if (!expectedMime || mimeType !== expectedMime) {
    throw makeVisitSubmissionError('invalid-argument', 'Unsupported upload file type.');
  }
  return { safeName, extension, mimeType };
}

function validateVisitFileSize(value, maxBytes) {
  const sizeBytes = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
    throw makeVisitSubmissionError('invalid-argument', 'Valid upload size is required.');
  }
  if (sizeBytes > maxBytes) {
    throw makeVisitSubmissionError('invalid-argument', 'Upload file is too large.');
  }
  return sizeBytes;
}

function buildStorageFileName({ safeName, extension, visitType, positionKey, clientFileId }, tokenGenerator) {
  const base = safeName.slice(0, Math.max(1, 150 - extension.length)).replace(/\.[^.]+$/, '').trim() || 'submission';
  const suffix = generateRandomHex(6, tokenGenerator);
  return `${visitType}_${positionKey}_${normalizeUploadText(clientFileId, 32) || 'file'}_${suffix}_${base}.${extension}`;
}

function normalizeClientFileId(value) {
  const clientFileId = normalizeText(value, 80);
  if (!clientFileId || !/^[A-Za-z0-9._:-]{1,80}$/.test(clientFileId)) {
    throw makeVisitSubmissionError('invalid-argument', 'Valid clientFileId is required.');
  }
  return clientFileId;
}

function normalizeSubmissionId(value) {
  const submissionId = normalizeText(value, 160);
  if (!submissionId || /[\\/]/.test(submissionId)) {
    throw makeVisitSubmissionError('invalid-argument', 'Valid submission ID is required.');
  }
  return submissionId;
}

function normalizeSessionId(value) {
  const sessionId = normalizeText(value, 160);
  if (!sessionId || /[\\/]/.test(sessionId)) {
    throw makeVisitSubmissionError('invalid-argument', 'Valid upload session ID is required.');
  }
  return sessionId;
}

function normalizeRawVisitTicket(value) {
  const ticket = normalizeText(value, 100).toLowerCase();
  if (!/^[a-f0-9]{64}$/i.test(ticket)) {
    throw makeVisitSubmissionError('invalid-argument', 'Valid upload ticket is required.');
  }
  return ticket;
}

function normalizeDriveId(value, label) {
  const cleaned = normalizeText(value, 256);
  if (!cleaned || !/^[A-Za-z0-9_-]{8,256}$/.test(cleaned)) {
    throw makeVisitSubmissionError('invalid-argument', `${label} is invalid.`);
  }
  return cleaned;
}

function normalizeDriveUrl(value) {
  const cleaned = normalizeText(value, 1000);
  if (!cleaned || !/^https:\/\/drive\.google\.com\//.test(cleaned)) {
    throw makeVisitSubmissionError('invalid-argument', 'Drive file URL is invalid.');
  }
  return cleaned;
}

function normalizeSubmissionStatus(value) {
  const status = normalizeText(value || 'active', 40).toLowerCase();
  if (!VISIT_SUBMISSION_STATUSES.includes(status)) {
    throw makeVisitSubmissionError('invalid-argument', 'Invalid submission status.');
  }
  return status;
}

function encodeModerationCursor(createdAt, id) {
  if (!id) return null;
  return Buffer.from(JSON.stringify({ createdAt: createdAt ?? null, id }), 'utf8').toString('base64url');
}

function decodeModerationCursor(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8'));
    if (!parsed || typeof parsed.id !== 'string' || parsed.id.includes('/')) {
      throw new Error('Invalid cursor.');
    }
    return { createdAt: parsed.createdAt ?? null, id: parsed.id };
  } catch {
    throw makeVisitSubmissionError('invalid-argument', 'Invalid moderation cursor.');
  }
}

function sortableCreatedAt(value) {
  const millis = timestampToMillis(value);
  return millis || 0;
}

function normalizeRole(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeVisitType(value) {
  const visitType = String(value || '').trim();
  if (!VISIT_TYPES[visitType]) {
    throw makeVisitSubmissionError('invalid-argument', 'Unknown visit type.', { visitType });
  }
  return visitType;
}

function getVisitTypeDefinition(value) {
  const visitType = normalizeVisitType(value);
  return { ...VISIT_TYPES[visitType] };
}

function getActivePositionDefinitions(positionHelpers = defaultPositionHelpers) {
  return positionHelpers.POSITION_KEYS
    .map(key => positionHelpers.getPositionDefinition(key))
    .filter(definition => definition && definition.active !== false);
}

function normalizeCanonicalPositionKey(value, positionHelpers = defaultPositionHelpers) {
  const key = positionHelpers.normalizePositionKey(value);
  const definition = key ? positionHelpers.getPositionDefinition(key) : null;
  if (!key || !definition || definition.active === false) {
    throw makeVisitSubmissionError('invalid-argument', 'Unknown position key.', { positionKey: value });
  }
  return key;
}

function normalizeCanonicalPositionKeys(values, positionHelpers = defaultPositionHelpers) {
  const normalized = positionHelpers.normalizePositionKeys(Array.isArray(values) ? values : []);
  if (normalized.unknownValues.length) {
    throw makeVisitSubmissionError('failed-precondition', 'Position assignments contain unknown values.', {
      unknownValues: normalized.unknownValues,
    });
  }
  const inactiveKeys = normalized.positionKeys.filter((key) => {
    const definition = positionHelpers.getPositionDefinition(key);
    return !definition || definition.active === false;
  });
  if (inactiveKeys.length) {
    throw makeVisitSubmissionError('failed-precondition', 'Position assignments contain inactive values.', {
      inactiveKeys,
    });
  }
  return normalized.positionKeys.slice();
}

function visitPositionDocId(visitTypeValue, positionKeyValue, positionHelpers = defaultPositionHelpers) {
  const visitType = normalizeVisitType(visitTypeValue);
  const positionKey = normalizeCanonicalPositionKey(positionKeyValue, positionHelpers);
  return `${visitType}_${positionKey}`;
}

function isExplicitlyUidLinked(record, uid) {
  if (!record || typeof record !== 'object') return false;
  if (record.authLinked === false || record.userId === null || record.uid === null) return false;
  if (String(record.userId || '') === uid) return true;
  if (String(record.uid || '') === uid) return true;
  return record.createdFromUser === true || record.authLinked === true;
}

function resolvePositionKeysFromIdentity(userData, bodMemberData, uid, positionHelpers = defaultPositionHelpers) {
  if (userData && hasOwn(userData, 'positionKeys')) {
    const keys = normalizeCanonicalPositionKeys(userData.positionKeys, positionHelpers);
    return { positionKeys: keys, source: 'users.positionKeys', warnings: [] };
  }

  if (bodMemberData) {
    if (!isExplicitlyUidLinked(bodMemberData, uid)) {
      return {
        positionKeys: [],
        source: null,
        warnings: ['Skipped bodMembers.positionKeys because the record is not explicitly UID-linked.'],
      };
    }
    if (hasOwn(bodMemberData, 'positionKeys')) {
      const keys = normalizeCanonicalPositionKeys(bodMemberData.positionKeys, positionHelpers);
      return { positionKeys: keys, source: 'bodMembers.positionKeys', warnings: [] };
    }
  }

  return { positionKeys: [], source: null, warnings: [] };
}

function resolveAccessContextFromRecords(uid, records, positionHelpers = defaultPositionHelpers) {
  if (!uid) {
    throw makeVisitSubmissionError('unauthenticated', 'Sign in required.');
  }

  const userData = records?.user || null;
  const roleData = records?.role || null;
  const bodMemberData = records?.bodMember || null;
  if (!userData) {
    throw makeVisitSubmissionError('permission-denied', 'Approved Visit Submission access required.');
  }

  const userStatus = normalizeStatus(userData?.status);
  const roleStatus = normalizeStatus(roleData?.status);

  if (userStatus !== 'approved' || userData?.active === false) {
    throw makeVisitSubmissionError('permission-denied', 'Approved Visit Submission access required.');
  }

  const userRole = normalizeRole(userData?.role);
  const roleDocRole = normalizeRole(roleData?.role);
  if (!['prospect', 'gbm', 'bod', 'admin', 'president'].includes(userRole)) {
    throw makeVisitSubmissionError('permission-denied', 'Approved Visit Submission access required.');
  }

  if (roleData) {
    if (roleDocRole !== userRole) {
      throw makeVisitSubmissionError('failed-precondition', 'User role and role document do not match.');
    }
    if (roleStatus !== 'approved') {
      throw makeVisitSubmissionError('permission-denied', 'Approved Visit Submission access required.');
    }
  }

  const positionResolution = resolvePositionKeysFromIdentity(userData, bodMemberData, uid, positionHelpers);
  const isManager = VISIT_ADMIN_ROLE_SET.has(userRole);
  const canAccessVisitSystem = isManager || (userRole === 'bod' && positionResolution.positionKeys.length > 0);

  if (!canAccessVisitSystem) {
    throw makeVisitSubmissionError('permission-denied', 'Visit Submission access required.');
  }

  return {
    uid,
    role: userRole,
    status: 'approved',
    positionKeys: positionResolution.positionKeys.slice(),
    positionSource: positionResolution.source,
    positionWarnings: positionResolution.warnings.slice(),
    isApproved: true,
    canAccessVisitSystem,
    canManageVisitSystem: isManager,
  };
}

function assertManageAccess(access) {
  if (!access?.canManageVisitSystem) {
    throw makeVisitSubmissionError('permission-denied', 'Admin or president Visit Submission access required.');
  }
}

function assertFolderAccess(access, positionKey) {
  if (access?.canManageVisitSystem) return;
  if (!access || access.role !== 'bod' || !access.positionKeys.includes(positionKey)) {
    throw makeVisitSubmissionError('permission-denied', 'You do not have access to this position folder.');
  }
}

function buildVisitConfigDefaults(visitTypeValue, actorUid, now) {
  const visit = getVisitTypeDefinition(visitTypeValue);
  return {
    visitType: visit.visitType,
    displayTitle: visit.displayTitle,
    description: '',
    enabled: true,
    submissionOpen: true,
    visitDate: null,
    submissionDeadline: null,
    instructions: '',
    createdAt: now,
    createdBy: actorUid,
    updatedAt: now,
    updatedBy: actorUid,
  };
}

function buildVisitPositionDefaults(visitTypeValue, positionKeyValue, actorUid, now, positionHelpers = defaultPositionHelpers) {
  const visit = getVisitTypeDefinition(visitTypeValue);
  const positionKey = normalizeCanonicalPositionKey(positionKeyValue, positionHelpers);
  const definition = positionHelpers.getPositionDefinition(positionKey);
  return {
    visitType: visit.visitType,
    visitDisplayTitle: visit.displayTitle,
    positionKey,
    positionTitle: definition.displayTitle,
    avenueCode: definition.avenueCode,
    enabled: true,
    submissionOpen: true,
    locked: false,
    lockReason: '',
    maxActiveFiles: DEFAULT_MAX_ACTIVE_FILES,
    maxFilesPerSelection: DEFAULT_MAX_FILES_PER_SELECTION,
    maxFileSizeBytes: DEFAULT_MAX_FILE_SIZE_BYTES,
    activeFileCount: 0,
    createdAt: now,
    createdBy: actorUid,
    updatedAt: now,
    updatedBy: actorUid,
  };
}

function coerceMaybeDate(value, fieldName) {
  if (value === null || value === '') return null;
  if (typeof value === 'string') {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw makeVisitSubmissionError('invalid-argument', `${fieldName} must be a valid date string.`);
    }
    return value;
  }
  if (value && typeof value.toDate === 'function') return value;
  if (value instanceof Date) return value.toISOString();
  throw makeVisitSubmissionError('invalid-argument', `${fieldName} must be null or a valid date string.`);
}

function validateConfigUpdate(input) {
  const updates = {};
  if (hasOwn(input, 'description')) updates.description = normalizeText(input.description, 2000);
  if (hasOwn(input, 'enabled')) {
    if (typeof input.enabled !== 'boolean') throw makeVisitSubmissionError('invalid-argument', 'enabled must be boolean.');
    updates.enabled = input.enabled;
  }
  if (hasOwn(input, 'submissionOpen')) {
    if (typeof input.submissionOpen !== 'boolean') {
      throw makeVisitSubmissionError('invalid-argument', 'submissionOpen must be boolean.');
    }
    updates.submissionOpen = input.submissionOpen;
  }
  if (hasOwn(input, 'visitDate')) updates.visitDate = coerceMaybeDate(input.visitDate, 'visitDate');
  if (hasOwn(input, 'submissionDeadline')) {
    updates.submissionDeadline = coerceMaybeDate(input.submissionDeadline, 'submissionDeadline');
  }
  if (hasOwn(input, 'instructions')) updates.instructions = normalizeText(input.instructions, 4000);
  return updates;
}

function validateIntegerLimit(value, fieldName, min, max) {
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue < min || numberValue > max) {
    throw makeVisitSubmissionError('invalid-argument', `${fieldName} must be between ${min} and ${max}.`);
  }
  return numberValue;
}

function validateFolderUpdate(input) {
  const updates = {};
  if (hasOwn(input, 'enabled')) {
    if (typeof input.enabled !== 'boolean') throw makeVisitSubmissionError('invalid-argument', 'enabled must be boolean.');
    updates.enabled = input.enabled;
  }
  if (hasOwn(input, 'submissionOpen')) {
    if (typeof input.submissionOpen !== 'boolean') {
      throw makeVisitSubmissionError('invalid-argument', 'submissionOpen must be boolean.');
    }
    updates.submissionOpen = input.submissionOpen;
  }
  if (hasOwn(input, 'locked')) {
    if (typeof input.locked !== 'boolean') throw makeVisitSubmissionError('invalid-argument', 'locked must be boolean.');
    updates.locked = input.locked;
    updates.lockReason = input.locked ? normalizeText(input.lockReason, 500) : '';
  } else if (hasOwn(input, 'lockReason')) {
    updates.lockReason = normalizeText(input.lockReason, 500);
  }
  if (hasOwn(input, 'maxActiveFiles')) {
    updates.maxActiveFiles = validateIntegerLimit(input.maxActiveFiles, 'maxActiveFiles', 1, 100);
  }
  if (hasOwn(input, 'maxFilesPerSelection')) {
    updates.maxFilesPerSelection = validateIntegerLimit(input.maxFilesPerSelection, 'maxFilesPerSelection', 1, 10);
  }
  if (hasOwn(input, 'maxFileSizeBytes')) {
    updates.maxFileSizeBytes = validateIntegerLimit(
      input.maxFileSizeBytes,
      'maxFileSizeBytes',
      MIN_FILE_SIZE_BYTES,
      DEFAULT_MAX_FILE_SIZE_BYTES
    );
  }
  return updates;
}

function safeDiff(oldData, updates) {
  return Object.keys(updates).reduce((diff, field) => {
    const oldValue = oldData ? oldData[field] : undefined;
    const newValue = updates[field];
    if (JSON.stringify(oldValue ?? null) !== JSON.stringify(newValue ?? null)) {
      diff[field] = { oldValue: oldValue ?? null, newValue };
    }
    return diff;
  }, {});
}

function buildAuditPayload(action, access, details, now) {
  return {
    action,
    actorUid: access.uid,
    actorRole: access.role,
    visitType: details.visitType || null,
    positionKey: details.positionKey || null,
    submissionId: details.submissionId || null,
    details: details.details || {},
    createdAt: now,
  };
}

function shapeConfig(configData, visitTypeValue, actorUid, now) {
  return {
    ...buildVisitConfigDefaults(visitTypeValue, actorUid || 'system', now || null),
    ...(configData || {}),
  };
}

function shapePosition(positionData, visitTypeValue, positionKeyValue, actorUid, now, positionHelpers) {
  return {
    ...buildVisitPositionDefaults(visitTypeValue, positionKeyValue, actorUid || 'system', now || null, positionHelpers),
    ...(positionData || {}),
  };
}

function submissionActionPermissions(submission, access) {
  const isActive = (submission.status || 'active') === 'active';
  if (!isActive || !access) {
    return { canWithdraw: false, canReplace: false, canRemove: false };
  }
  if (access.canManageVisitSystem === true) {
    return { canWithdraw: false, canReplace: true, canRemove: true };
  }
  const positionKey = submission.positionKey || '';
  const authorizedPosition = Array.isArray(access.positionKeys) && access.positionKeys.includes(positionKey);
  const ownsSubmission = submission.uploadedByUid === access.uid;
  return {
    canWithdraw: authorizedPosition && ownsSubmission,
    canReplace: authorizedPosition && ownsSubmission,
    canRemove: false,
  };
}

function shapeSubmission(submission, access) {
  const permissions = submissionActionPermissions(submission, access);
  return {
    submissionId: submission.submissionId || submission.id || '',
    visitType: submission.visitType,
    positionKey: submission.positionKey,
    positionTitle: submission.positionTitle || '',
    uploadedByUid: submission.uploadedByUid || '',
    uploadedByName: submission.uploadedByName || '',
    uploadedByRole: submission.uploadedByRole || '',
    fileName: submission.fileName || '',
    originalFileName: submission.originalFileName || submission.fileName || '',
    mimeType: submission.mimeType || '',
    sizeBytes: Number(submission.sizeBytes || 0),
    fileUrl: submission.fileUrl || submission.driveFileUrl || '',
    status: submission.status || 'active',
    createdAt: submission.createdAt || null,
    updatedAt: submission.updatedAt || null,
    canWithdraw: permissions.canWithdraw,
    canReplace: permissions.canReplace,
    canRemove: permissions.canRemove,
  };
}

function buildFolderResponse(config, folder, access) {
  const authorized = access.canManageVisitSystem || access.positionKeys.includes(folder.positionKey);
  const canUpload = Boolean(
    authorized
      && config.enabled !== false
      && config.submissionOpen !== false
      && folder.enabled !== false
      && folder.submissionOpen !== false
      && folder.locked !== true
  );
  return {
    folderId: visitPositionDocId(folder.visitType, folder.positionKey),
    visitType: folder.visitType,
    positionKey: folder.positionKey,
    positionTitle: folder.positionTitle,
    avenueCode: folder.avenueCode,
    enabled: folder.enabled !== false,
    submissionOpen: folder.submissionOpen !== false,
    locked: folder.locked === true,
    lockReason: folder.lockReason || '',
    activeFileCount: Number(folder.activeFileCount || 0),
    maxActiveFiles: Number(folder.maxActiveFiles || DEFAULT_MAX_ACTIVE_FILES),
    maxFilesPerSelection: Number(folder.maxFilesPerSelection || DEFAULT_MAX_FILES_PER_SELECTION),
    maxFileSizeBytes: Number(folder.maxFileSizeBytes || DEFAULT_MAX_FILE_SIZE_BYTES),
    canOpen: authorized,
    canUpload,
    canManage: access.canManageVisitSystem === true,
  };
}

function createFirestoreVisitSubmissionAdapter(db, admin) {
  const FieldValue = admin.firestore.FieldValue;
  return {
    serverTimestamp() {
      return FieldValue.serverTimestamp();
    },
    async getDoc(collection, id) {
      const snap = await db.collection(collection).doc(id).get();
      return { exists: snap.exists, id: snap.id, data: snap.exists ? (snap.data() || {}) : null };
    },
    async setDoc(collection, id, data, options) {
      await db.collection(collection).doc(id).set(data, options || {});
      return { ok: true };
    },
    async updateDoc(collection, id, data) {
      await db.collection(collection).doc(id).update(data);
      return { ok: true };
    },
    async createDoc(collection, id, data) {
      await db.collection(collection).doc(id).create(data);
      return { ok: true };
    },
    async addDoc(collection, data) {
      const ref = await db.collection(collection).add(data);
      return { id: ref.id };
    },
    newDocId(collection) {
      return db.collection(collection).doc().id;
    },
    timestampFromMillis(millis) {
      return admin.firestore.Timestamp.fromMillis(millis);
    },
    async runTransaction(callback) {
      return db.runTransaction(async (tx) => {
        const txAdapter = {
          async getDoc(collection, id) {
            const snap = await tx.get(db.collection(collection).doc(id));
            return { exists: snap.exists, id: snap.id, data: snap.exists ? (snap.data() || {}) : null };
          },
          setDoc(collection, id, data, options) {
            tx.set(db.collection(collection).doc(id), data, options || {});
          },
          updateDoc(collection, id, data) {
            tx.update(db.collection(collection).doc(id), data);
          },
          createDoc(collection, id, data) {
            tx.create(db.collection(collection).doc(id), data);
          },
        };
        return callback(txAdapter);
      });
    },
    async listDocs(collection) {
      const snap = await db.collection(collection).get();
      return snap.docs.map(doc => ({ id: doc.id, data: doc.data() || {} }));
    },
    async queryActiveSubmissionsForVisit(visitType) {
      const snap = await db.collection('visitSubmissions')
        .where('visitType', '==', visitType)
        .where('status', '==', 'active')
        .get();
      return snap.docs.map(doc => ({ id: doc.id, data: doc.data() || {} }));
    },
    async queryActiveSubmissionsForPositions(visitType, positionKeys) {
      const uniqueKeys = Array.from(new Set((Array.isArray(positionKeys) ? positionKeys : []).filter(Boolean)));
      if (!uniqueKeys.length) return [];
      const results = new Map();
      for (const positionKey of uniqueKeys) {
        const snap = await db.collection('visitSubmissions')
          .where('visitType', '==', visitType)
          .where('positionKey', '==', positionKey)
          .where('status', '==', 'active')
          .get();
        snap.docs.forEach(doc => results.set(doc.id, { id: doc.id, data: doc.data() || {} }));
      }
      return Array.from(results.values());
    },
    async querySubmissions(filters) {
      let query = db.collection('visitSubmissions');
      if (filters.visitType) query = query.where('visitType', '==', filters.visitType);
      if (filters.positionKey) query = query.where('positionKey', '==', filters.positionKey);
      if (filters.status) query = query.where('status', '==', filters.status);
      query = query
        .orderBy('createdAt', 'desc')
        .orderBy(admin.firestore.FieldPath.documentId(), 'desc');
      if (filters.cursor) {
        query = query.startAfter(filters.cursor.createdAt, filters.cursor.id);
      }
      query = query.limit((filters.limit || 25) + 1);
      const snap = await query.get();
      return snap.docs.map(doc => ({ id: doc.id, data: doc.data() || {} }));
    },
    async queryExpiredUploadSessions(nowValue, limit) {
      const snap = await db.collection('visitSubmissionUploadSessions')
        .where('status', 'in', VISIT_UPLOAD_SESSION_ACTIVE_STATUSES)
        .where('expiresAtMillis', '<=', nowValue)
        .limit(limit || 25)
        .get();
      return snap.docs.map(doc => ({ id: doc.id, data: doc.data() || {} }));
    },
    async queryActiveUploadSessionsForFolder(visitType, positionKey) {
      const snap = await db.collection('visitSubmissionUploadSessions')
        .where('visitType', '==', visitType)
        .where('positionKey', '==', positionKey)
        .where('status', 'in', VISIT_UPLOAD_SESSION_ACTIVE_STATUSES)
        .get();
      return snap.docs.map(doc => ({ id: doc.id, data: doc.data() || {} }));
    },
  };
}

function createMemoryVisitSubmissionAdapter(initialData) {
  const store = clone(initialData || {});
  const writes = [];
  let autoId = 1;

  function ensureCollection(collection) {
    if (!store[collection]) store[collection] = {};
    return store[collection];
  }

  return {
    store,
    writes,
    serverTimestamp() {
      return 'SERVER_TIMESTAMP';
    },
    async getDoc(collection, id) {
      const docs = store[collection] || {};
      const data = docs[id];
      return { exists: Boolean(data), id, data: data ? clone(data) : null };
    },
    async setDoc(collection, id, data, options) {
      const docs = ensureCollection(collection);
      docs[id] = options?.merge ? { ...(docs[id] || {}), ...clone(data) } : clone(data);
      writes.push({ type: 'set', collection, id, options: options || {}, data: clone(data) });
      return { ok: true };
    },
    async updateDoc(collection, id, data) {
      const docs = ensureCollection(collection);
      if (!docs[id]) throw makeVisitSubmissionError('not-found', 'Document not found.');
      docs[id] = { ...docs[id], ...clone(data) };
      writes.push({ type: 'update', collection, id, data: clone(data) });
      return { ok: true };
    },
    async createDoc(collection, id, data) {
      const docs = ensureCollection(collection);
      if (docs[id]) throw makeVisitSubmissionError('already-exists', 'Document already exists.');
      docs[id] = clone(data);
      writes.push({ type: 'create', collection, id, data: clone(data) });
      return { ok: true };
    },
    async addDoc(collection, data) {
      const id = `audit-${autoId++}`;
      ensureCollection(collection)[id] = clone(data);
      writes.push({ type: 'add', collection, id, data: clone(data) });
      return { id };
    },
    newDocId(collection) {
      return `${collection}-${autoId++}`;
    },
    timestampFromMillis(millis) {
      return millis;
    },
    async runTransaction(callback) {
      return callback({
        getDoc: this.getDoc,
        setDoc: (collection, id, data, options) => {
          const docs = ensureCollection(collection);
          docs[id] = options?.merge ? { ...(docs[id] || {}), ...clone(data) } : clone(data);
          writes.push({ type: 'tx.set', collection, id, options: options || {}, data: clone(data) });
        },
        updateDoc: (collection, id, data) => {
          const docs = ensureCollection(collection);
          if (!docs[id]) throw makeVisitSubmissionError('not-found', 'Document not found.');
          docs[id] = { ...docs[id], ...clone(data) };
          writes.push({ type: 'tx.update', collection, id, data: clone(data) });
        },
        createDoc: (collection, id, data) => {
          const docs = ensureCollection(collection);
          if (docs[id]) throw makeVisitSubmissionError('already-exists', 'Document already exists.');
          docs[id] = clone(data);
          writes.push({ type: 'tx.create', collection, id, data: clone(data) });
        },
      });
    },
    async listDocs(collection) {
      const docs = store[collection] || {};
      return Object.keys(docs).map(id => ({ id, data: clone(docs[id]) }));
    },
    async queryActiveSubmissionsForVisit(visitType) {
      const docs = store.visitSubmissions || {};
      return Object.keys(docs)
        .filter((id) => {
          const doc = docs[id] || {};
          return doc.visitType === visitType
            && doc.status === 'active';
        })
        .map(id => ({ id, data: clone(docs[id]) }));
    },
    async queryActiveSubmissionsForPositions(visitType, positionKeys) {
      const allowed = new Set((Array.isArray(positionKeys) ? positionKeys : []).filter(Boolean));
      if (!allowed.size) return [];
      const docs = store.visitSubmissions || {};
      return Object.keys(docs)
        .filter((id) => {
          const doc = docs[id] || {};
          return doc.visitType === visitType
            && doc.status === 'active'
            && allowed.has(doc.positionKey);
        })
        .map(id => ({ id, data: clone(docs[id]) }));
    },
    async querySubmissions(filters) {
      const docs = store.visitSubmissions || {};
      const cursor = filters.cursor || null;
      return Object.keys(docs)
        .filter((id) => {
          const doc = docs[id] || {};
          return (!filters.visitType || doc.visitType === filters.visitType)
            && (!filters.positionKey || doc.positionKey === filters.positionKey)
            && (!filters.status || doc.status === filters.status);
        })
        .sort((a, b) => {
          const createdDiff = sortableCreatedAt(docs[b].createdAt) - sortableCreatedAt(docs[a].createdAt);
          return createdDiff || String(b).localeCompare(String(a));
        })
        .filter((id) => {
          if (!cursor) return true;
          const doc = docs[id] || {};
          const created = sortableCreatedAt(doc.createdAt);
          const cursorCreated = sortableCreatedAt(cursor.createdAt);
          if (created < cursorCreated) return true;
          if (created > cursorCreated) return false;
          return String(id).localeCompare(String(cursor.id)) < 0;
        })
        .slice(0, (filters.limit || 25) + 1)
        .map(id => ({ id, data: clone(docs[id]) }));
    },
    async queryExpiredUploadSessions(nowValue, limit) {
      const docs = store.visitSubmissionUploadSessions || {};
      return Object.keys(docs)
        .filter((id) => {
          const doc = docs[id] || {};
          return VISIT_UPLOAD_SESSION_ACTIVE_STATUSES.includes(doc.status)
            && Number(doc.expiresAtMillis || 0) <= nowValue;
        })
        .slice(0, limit || 25)
        .map(id => ({ id, data: clone(docs[id]) }));
    },
    async queryActiveUploadSessionsForFolder(visitType, positionKey) {
      const docs = store.visitSubmissionUploadSessions || {};
      return Object.keys(docs)
        .filter((id) => {
          const doc = docs[id] || {};
          return doc.visitType === visitType
            && doc.positionKey === positionKey
            && VISIT_UPLOAD_SESSION_ACTIVE_STATUSES.includes(doc.status);
        })
        .map(id => ({ id, data: clone(docs[id]) }));
    },
  };
}

function createVisitSubmissionService(options) {
  const adapter = options?.adapter || createFirestoreVisitSubmissionAdapter(options.db, options.admin);
  const positionHelpers = options?.positionHelpers || defaultPositionHelpers;
  const clock = options?.clock || null;
  const tokenGenerator = options?.tokenGenerator || null;

  async function resolveAccessContext(uid) {
    if (!uid) throw makeVisitSubmissionError('unauthenticated', 'Sign in required.');
    const [userSnap, roleSnap, bodMemberSnap] = await Promise.all([
      adapter.getDoc('users', uid),
      adapter.getDoc('roles', uid),
      adapter.getDoc('bodMembers', uid),
    ]);
    return resolveAccessContextFromRecords(uid, {
      user: userSnap.exists ? userSnap.data : null,
      role: roleSnap.exists ? roleSnap.data : null,
      bodMember: bodMemberSnap.exists ? bodMemberSnap.data : null,
    }, positionHelpers);
  }

  async function initializeStructure(uid) {
    const access = await resolveAccessContext(uid);
    assertManageAccess(access);
    const now = adapter.serverTimestamp();
    let createdConfigCount = 0;
    let existingConfigCount = 0;
    let createdPositionCount = 0;
    let existingPositionCount = 0;
    const warnings = [];

    for (const visitType of VISIT_TYPE_KEYS) {
      const configSnap = await adapter.getDoc('visitSubmissionConfig', visitType);
      if (configSnap.exists) {
        existingConfigCount += 1;
      } else {
        await adapter.setDoc('visitSubmissionConfig', visitType, buildVisitConfigDefaults(visitType, uid, now), { merge: false });
        createdConfigCount += 1;
      }

      for (const definition of getActivePositionDefinitions(positionHelpers)) {
        const docId = visitPositionDocId(visitType, definition.key, positionHelpers);
        const folderSnap = await adapter.getDoc('visitSubmissionPositions', docId);
        if (folderSnap.exists) {
          existingPositionCount += 1;
        } else {
          await adapter.setDoc(
            'visitSubmissionPositions',
            docId,
            buildVisitPositionDefaults(visitType, definition.key, uid, now, positionHelpers),
            { merge: false }
          );
          createdPositionCount += 1;
        }
      }
    }

    await adapter.addDoc('visitSubmissionAudit', buildAuditPayload('visitSubmissionInitialized', access, {
      details: { createdConfigCount, existingConfigCount, createdPositionCount, existingPositionCount },
    }, now));

    return {
      ok: true,
      createdConfigCount,
      existingConfigCount,
      createdPositionCount,
      existingPositionCount,
      warnings,
    };
  }

  async function loadVisitConfig(visitType) {
    const snap = await adapter.getDoc('visitSubmissionConfig', visitType);
    if (!snap.exists) {
      throw makeVisitSubmissionError(
        'failed-precondition',
        'Visit Submission structure has not been initialized.'
      );
    }
    return shapeConfig(snap.data, visitType, null, null);
  }

  async function loadFolder(visitType, positionKey) {
    const docId = visitPositionDocId(visitType, positionKey, positionHelpers);
    const snap = await adapter.getDoc('visitSubmissionPositions', docId);
    if (!snap.exists) {
      throw makeVisitSubmissionError('not-found', 'Visit Submission structure is incomplete.');
    }
    return shapePosition(snap.data, visitType, positionKey, null, null, positionHelpers);
  }

  function accessiblePositionKeys(access) {
    return access.canManageVisitSystem
      ? getActivePositionDefinitions(positionHelpers).map(definition => definition.key)
      : access.positionKeys.slice();
  }

  async function getDashboard(uid) {
    const access = await resolveAccessContext(uid);
    const allowedPositions = accessiblePositionKeys(access);
    const totalPositionCount = getActivePositionDefinitions(positionHelpers).length;
    const visits = [];

    try {
      for (const visitType of VISIT_TYPE_KEYS) {
        const config = await loadVisitConfig(visitType);
        const folders = await Promise.all(allowedPositions.map(key => loadFolder(visitType, key)));
        const lockedPositionCount = folders.filter(folder => folder.locked === true).length;
        const activeSubmissionDocs = access.canManageVisitSystem
          ? await adapter.queryActiveSubmissionsForVisit(visitType)
          : await adapter.queryActiveSubmissionsForPositions(visitType, allowedPositions);
        const activeSubmissionCount = activeSubmissionDocs.length;

        visits.push({
          visitType,
          displayTitle: config.displayTitle,
          description: config.description || '',
          enabled: config.enabled !== false,
          submissionOpen: config.submissionOpen !== false,
          visitDate: config.visitDate || null,
          submissionDeadline: config.submissionDeadline || null,
          accessiblePositionCount: allowedPositions.length,
          totalPositionCount,
          activeSubmissionCount,
          lockedPositionCount,
        });
      }
    } catch (err) {
      if ((err?.httpsCode || err?.code) === 'not-found') {
        throw makeVisitSubmissionError(
          'failed-precondition',
          'Visit Submission structure is incomplete.'
        );
      }
      throw err;
    }

    return {
      access: {
        role: access.role,
        positionKeys: access.positionKeys.slice(),
        canManage: access.canManageVisitSystem === true,
      },
      visits,
    };
  }

  async function getFolders(uid, visitTypeInput) {
    const access = await resolveAccessContext(uid);
    const visitType = normalizeVisitType(visitTypeInput);
    const config = await loadVisitConfig(visitType);
    const folders = await Promise.all(accessiblePositionKeys(access).map(key => loadFolder(visitType, key)));
    return {
      access: {
        role: access.role,
        positionKeys: access.positionKeys.slice(),
        canManage: access.canManageVisitSystem === true,
      },
      visit: {
        visitType,
        displayTitle: config.displayTitle,
        description: config.description || '',
        enabled: config.enabled !== false,
        submissionOpen: config.submissionOpen !== false,
        visitDate: config.visitDate || null,
        submissionDeadline: config.submissionDeadline || null,
        instructions: config.instructions || '',
      },
      folders: folders.map(folder => buildFolderResponse(config, folder, access)),
    };
  }

  async function getFolder(uid, visitTypeInput, positionKeyInput) {
    const access = await resolveAccessContext(uid);
    const visitType = normalizeVisitType(visitTypeInput);
    const positionKey = normalizeCanonicalPositionKey(positionKeyInput, positionHelpers);
    assertFolderAccess(access, positionKey);

    const [config, folder, submissions] = await Promise.all([
      loadVisitConfig(visitType),
      loadFolder(visitType, positionKey),
      adapter.queryActiveSubmissionsForPositions(visitType, [positionKey]),
    ]);

    return {
      access: {
        role: access.role,
        positionKeys: access.positionKeys.slice(),
        canManage: access.canManageVisitSystem === true,
      },
      visit: {
        visitType,
        displayTitle: config.displayTitle,
        description: config.description || '',
        enabled: config.enabled !== false,
        submissionOpen: config.submissionOpen !== false,
        visitDate: config.visitDate || null,
        submissionDeadline: config.submissionDeadline || null,
        instructions: config.instructions || '',
      },
      folder: buildFolderResponse(config, folder, access),
      submissions: submissions.map(doc => shapeSubmission({ id: doc.id, ...doc.data }, access)),
      limits: {
        maxActiveFiles: Number(folder.maxActiveFiles || DEFAULT_MAX_ACTIVE_FILES),
        maxFilesPerSelection: Number(folder.maxFilesPerSelection || DEFAULT_MAX_FILES_PER_SELECTION),
        maxFileSizeBytes: Number(folder.maxFileSizeBytes || DEFAULT_MAX_FILE_SIZE_BYTES),
      },
    };
  }

  async function updateConfig(uid, input) {
    const access = await resolveAccessContext(uid);
    assertManageAccess(access);
    const visitType = normalizeVisitType(input?.visitType);
    const updates = validateConfigUpdate(input || {});
    if (!Object.keys(updates).length) {
      throw makeVisitSubmissionError('invalid-argument', 'At least one mutable configuration field is required.');
    }
    const snap = await adapter.getDoc('visitSubmissionConfig', visitType);
    if (!snap.exists) {
      throw makeVisitSubmissionError('not-found', 'Visit Submission configuration has not been initialized.');
    }
    const diff = safeDiff(snap.data, updates);
    const now = adapter.serverTimestamp();
    if (Object.keys(diff).length) {
      await adapter.updateDoc('visitSubmissionConfig', visitType, {
        ...updates,
        updatedAt: now,
        updatedBy: uid,
      });
      await adapter.addDoc('visitSubmissionAudit', buildAuditPayload('visitConfigUpdated', access, {
        visitType,
        details: { changedFields: Object.keys(diff), changes: diff },
      }, now));
    }
    return { ok: true, visitType, changedFields: Object.keys(diff) };
  }

  async function updateFolder(uid, input) {
    const access = await resolveAccessContext(uid);
    assertManageAccess(access);
    const visitType = normalizeVisitType(input?.visitType);
    const positionKey = normalizeCanonicalPositionKey(input?.positionKey, positionHelpers);
    const updates = validateFolderUpdate(input || {});
    if (!Object.keys(updates).length) {
      throw makeVisitSubmissionError('invalid-argument', 'At least one mutable folder field is required.');
    }
    const docId = visitPositionDocId(visitType, positionKey, positionHelpers);
    const snap = await adapter.getDoc('visitSubmissionPositions', docId);
    if (!snap.exists) {
      throw makeVisitSubmissionError('not-found', 'Visit position folder has not been initialized.');
    }
    const diff = safeDiff(snap.data, updates);
    const now = adapter.serverTimestamp();
    if (Object.keys(diff).length) {
      await adapter.updateDoc('visitSubmissionPositions', docId, {
        ...updates,
        updatedAt: now,
        updatedBy: uid,
      });
      await adapter.addDoc('visitSubmissionAudit', buildAuditPayload('visitFolderUpdated', access, {
        visitType,
        positionKey,
        details: { changedFields: Object.keys(diff), changes: diff },
      }, now));
    }
    return { ok: true, visitType, positionKey, changedFields: Object.keys(diff) };
  }

  function normalizeUploadFileDescriptors(files, folder, visitType, positionKey) {
    const inputFiles = Array.isArray(files) ? files : [];
    const folderSelectionLimit = Number(folder.maxFilesPerSelection || DEFAULT_MAX_FILES_PER_SELECTION);
    const maxFilesPerSelection = Math.min(DEFAULT_MAX_FILES_PER_SELECTION, folderSelectionLimit);
    if (!inputFiles.length) {
      throw makeVisitSubmissionError('invalid-argument', 'Select at least one file.');
    }
    if (inputFiles.length > maxFilesPerSelection) {
      throw makeVisitSubmissionError('resource-exhausted', 'Too many files selected.');
    }

    const seenClientIds = new Set();
    return inputFiles.map((file) => {
      const clientFileId = normalizeClientFileId(file.clientFileId);
      if (seenClientIds.has(clientFileId)) {
        throw makeVisitSubmissionError('invalid-argument', 'Duplicate clientFileId values are not allowed.');
      }
      seenClientIds.add(clientFileId);
      const { safeName, extension, mimeType } = validateVisitFileType(file.fileName, file.mimeType);
      const sizeBytes = validateVisitFileSize(file.sizeBytes, Number(folder.maxFileSizeBytes || DEFAULT_MAX_FILE_SIZE_BYTES));
      const storageFileName = buildStorageFileName({ safeName, extension, visitType, positionKey, clientFileId }, tokenGenerator);
      return {
        clientFileId,
        originalFileName: safeName,
        fileName: storageFileName,
        mimeType,
        sizeBytes,
        status: 'reserved',
      };
    });
  }

  function assertVisitFolderAllowsUpload(config, folder) {
    if (config.enabled === false) throw makeVisitSubmissionError('failed-precondition', 'Visit submissions are disabled.');
    if (config.submissionOpen === false) throw makeVisitSubmissionError('failed-precondition', 'Visit submissions are closed.');
    if (folder.enabled === false) throw makeVisitSubmissionError('failed-precondition', 'This position folder is disabled.');
    if (folder.submissionOpen === false) throw makeVisitSubmissionError('failed-precondition', 'This position folder is closed.');
    if (folder.locked === true) throw makeVisitSubmissionError('failed-precondition', 'This position folder is locked.');
  }

  async function updateVisitUploadRateLimit(tx, uid, nowValue) {
    const rateLimitId = `${uid}_${VISIT_UPLOAD_TYPE}`;
    const snap = await tx.getDoc('driveUploadRateLimits', rateLimitId);
    const existing = snap.exists ? (snap.data || {}) : {};
    const windowStart = nowValue - VISIT_UPLOAD_RATE_LIMIT_WINDOW_MS;
    const recent = Array.isArray(existing.createdAtMillis)
      ? existing.createdAtMillis.filter(value => Number.isSafeInteger(value) && value > windowStart)
      : [];
    if (recent.length >= VISIT_UPLOAD_RATE_LIMIT) {
      throw makeVisitSubmissionError('resource-exhausted', 'Too many upload sessions requested. Try again later.');
    }
    recent.push(nowValue);
    tx.setDoc('driveUploadRateLimits', rateLimitId, {
      uid,
      uploadType: VISIT_UPLOAD_TYPE,
      uploadPurpose: VISIT_UPLOAD_PURPOSE,
      limit: VISIT_UPLOAD_RATE_LIMIT,
      windowMs: VISIT_UPLOAD_RATE_LIMIT_WINDOW_MS,
      createdAtMillis: recent.slice(-VISIT_UPLOAD_RATE_LIMIT),
      updatedAt: adapter.serverTimestamp(),
    }, { merge: true });
  }

  async function createUploadSession(uid, input, replacementOptions = {}) {
    const access = await resolveAccessContext(uid);
    const visitType = normalizeVisitType(input?.visitType);
    const positionKey = normalizeCanonicalPositionKey(input?.positionKey, positionHelpers);
    assertFolderAccess(access, positionKey);

    const [config, folder] = await Promise.all([
      loadVisitConfig(visitType),
      loadFolder(visitType, positionKey),
    ]);
    assertVisitFolderAllowsUpload(config, folder);

    const files = normalizeUploadFileDescriptors(input?.files, folder, visitType, positionKey);
    const nowValue = nowMillis(clock);
    const expiresAtMillis = nowValue + VISIT_UPLOAD_SESSION_TTL_MS;
    const sessionId = adapter.newDocId('visitSubmissionUploadSessions');
    const folderId = visitPositionDocId(visitType, positionKey, positionHelpers);
    const replacingSubmissionId = replacementOptions.replacesSubmissionId || null;

    const tickets = files.map((file) => {
      const ticket = generateRandomHex(32, tokenGenerator);
      const ticketHash = hashSecret(ticket);
      const uploadProof = generateRandomHex(32, tokenGenerator);
      const uploadProofHash = hashSecret(uploadProof);
      return {
        ...file,
        ticket,
        ticketHash,
        uploadProof,
        uploadProofHash,
        expiresAtMillis: nowValue + VISIT_UPLOAD_TICKET_TTL_MS,
        deleteAtMillis: nowValue + VISIT_UPLOAD_TICKET_TTL_MS + VISIT_UPLOAD_TICKET_DELETE_GRACE_MS,
      };
    });

    await adapter.runTransaction(async (tx) => {
      const folderSnap = await tx.getDoc('visitSubmissionPositions', folderId);
      if (!folderSnap.exists) {
        throw makeVisitSubmissionError('not-found', 'Visit Submission structure is incomplete.');
      }
      const latestFolder = shapePosition(folderSnap.data, visitType, positionKey, null, null, positionHelpers);
      assertVisitFolderAllowsUpload(config, latestFolder);
      await updateVisitUploadRateLimit(tx, uid, nowValue);

      const activeFileCount = Number(latestFolder.activeFileCount || 0);
      const reservedFileCount = Number(latestFolder.reservedFileCount || 0);
      const maxActiveFiles = Number(latestFolder.maxActiveFiles || DEFAULT_MAX_ACTIVE_FILES);
      if (!replacingSubmissionId && activeFileCount + reservedFileCount + files.length > maxActiveFiles) {
        throw makeVisitSubmissionError('resource-exhausted', 'This position folder has reached its active file limit.');
      }

      tx.updateDoc('visitSubmissionPositions', folderId, {
        reservedFileCount: Math.max(0, reservedFileCount) + files.length,
        updatedAt: adapter.serverTimestamp(),
        updatedBy: uid,
      });

      tx.createDoc('visitSubmissionUploadSessions', sessionId, {
        sessionId,
        actorUid: uid,
        actorRole: access.role,
        actorName: access.name || '',
        visitType,
        positionKey,
        positionTitle: folder.positionTitle,
        avenueCode: folder.avenueCode,
        folderId,
        status: 'pending',
        fileCount: files.length,
        reservedFileCount: files.length,
        finalizedFileCount: 0,
        cancelledFileCount: 0,
        replacesSubmissionId: replacingSubmissionId,
        expectedFiles: tickets.map(file => ({
          clientFileId: file.clientFileId,
          fileName: file.fileName,
          originalFileName: file.originalFileName,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
          ticketHash: file.ticketHash,
          status: 'reserved',
        })),
        expiresAt: timestampFromMillis(adapter, expiresAtMillis),
        expiresAtMillis,
        createdAt: adapter.serverTimestamp(),
        updatedAt: adapter.serverTimestamp(),
      });

      for (const file of tickets) {
        tx.createDoc('driveUploadTickets', file.ticketHash, {
          uid,
          role: access.role,
          uploadType: VISIT_UPLOAD_TYPE,
          uploadPurpose: VISIT_UPLOAD_PURPOSE,
          sessionId,
          clientFileId: file.clientFileId,
          visitType,
          positionKey,
          fileName: file.fileName,
          originalFileName: file.originalFileName,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
          uploadProofHash: file.uploadProofHash,
          expiresAt: timestampFromMillis(adapter, file.expiresAtMillis),
          expiresAtMillis: file.expiresAtMillis,
          deleteAt: timestampFromMillis(adapter, file.deleteAtMillis),
          used: false,
          finalized: false,
          createdAt: adapter.serverTimestamp(),
        });
      }
    });

    await adapter.addDoc('visitSubmissionAudit', buildAuditPayload('visitUploadSessionCreated', access, {
      visitType,
      positionKey,
      details: {
        sessionId,
        fileCount: files.length,
        replacesSubmissionId: replacingSubmissionId,
      },
    }, adapter.serverTimestamp()));

    return {
      ok: true,
      sessionId,
      visitType,
      positionKey,
      expiresAt: expiresAtMillis,
      uploadType: 'visitSubmission',
      files: tickets.map(file => ({
        clientFileId: file.clientFileId,
        ticket: file.ticket,
        fileName: file.fileName,
        originalFileName: file.originalFileName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        expiresAt: file.expiresAtMillis,
      })),
    };
  }

  async function validateVisitUploadTicketWithProof(input) {
    const ticket = normalizeRawVisitTicket(input?.ticket);
    const ticketHash = hashSecret(ticket);
    const uploadProof = generateRandomHex(32, tokenGenerator);
    const uploadProofHash = hashSecret(uploadProof);
    const sessionId = normalizeSessionId(input?.sessionId);
    const clientFileId = normalizeClientFileId(input?.clientFileId);
    const fileName = sanitizeVisitFileName(input?.fileName);
    const mimeType = normalizeText(input?.mimeType, 160).toLowerCase();
    const sizeBytes = validateVisitFileSize(input?.sizeBytes, DEFAULT_MAX_FILE_SIZE_BYTES);
    const nowValue = nowMillis(clock);
    let response;

    await adapter.runTransaction(async (tx) => {
      const ticketSnap = await tx.getDoc('driveUploadTickets', ticketHash);
      if (!ticketSnap.exists) throw makeVisitSubmissionError('not-found', 'Upload ticket not found.');
      const ticketData = ticketSnap.data || {};
      if (ticketData.uploadType !== VISIT_UPLOAD_TYPE || ticketData.uploadPurpose !== VISIT_UPLOAD_PURPOSE) {
        throw makeVisitSubmissionError('invalid-argument', 'Invalid upload ticket type.');
      }
      if (ticketData.used === true) throw makeVisitSubmissionError('already-exists', 'Upload ticket already used.');
      if (Number(ticketData.expiresAtMillis || timestampToMillis(ticketData.expiresAt)) <= nowValue) {
        throw makeVisitSubmissionError('failed-precondition', 'Upload ticket expired.');
      }
      if (
        ticketData.sessionId !== sessionId
        || ticketData.clientFileId !== clientFileId
        || ticketData.fileName !== fileName
        || ticketData.mimeType !== mimeType
        || Number(ticketData.sizeBytes) !== sizeBytes
      ) {
        throw makeVisitSubmissionError('failed-precondition', 'Upload ticket metadata mismatch.');
      }
      const sessionSnap = await tx.getDoc('visitSubmissionUploadSessions', sessionId);
      if (!sessionSnap.exists) throw makeVisitSubmissionError('not-found', 'Upload session not found.');
      const session = sessionSnap.data || {};
      if (!VISIT_UPLOAD_SESSION_ACTIVE_STATUSES.includes(session.status)) {
        throw makeVisitSubmissionError('failed-precondition', 'Upload session is not active.');
      }
      if (Number(session.expiresAtMillis || timestampToMillis(session.expiresAt)) <= nowValue) {
        throw makeVisitSubmissionError('failed-precondition', 'Upload session expired.');
      }

      tx.updateDoc('driveUploadTickets', ticketHash, {
        used: true,
        usedAt: adapter.serverTimestamp(),
        uploadProofHash,
        driveUploadCompleted: false,
        completionProofUsed: false,
      });
      const expectedFiles = (session.expectedFiles || []).map(file => (
        file.clientFileId === clientFileId
          ? { ...file, status: 'ticket-consumed', consumedAtMillis: nowValue }
          : file
      ));
      tx.updateDoc('visitSubmissionUploadSessions', sessionId, {
        expectedFiles,
        status: 'partial',
        updatedAt: adapter.serverTimestamp(),
      });
      response = {
        ok: true,
        uploadType: 'visitSubmission',
        safeFileName: ticketData.fileName,
        originalFileName: ticketData.originalFileName,
        visitType: ticketData.visitType,
        visitDisplayTitle: getVisitTypeDefinition(ticketData.visitType).displayTitle,
        positionKey: ticketData.positionKey,
        positionTitle: positionHelpers.getPositionDefinition(ticketData.positionKey)?.displayTitle || ticketData.positionKey,
        avenueCode: positionHelpers.getPositionDefinition(ticketData.positionKey)?.avenueCode || '',
        sessionId,
        clientFileId,
        mimeType: ticketData.mimeType,
        sizeBytes: ticketData.sizeBytes,
        uploaderUid: ticketData.uid,
        uploadProof,
      };
    });

    return response;
  }

  async function completeDriveUpload(input) {
    const ticket = normalizeRawVisitTicket(input?.ticket);
    const ticketHash = hashSecret(ticket);
    const sessionId = normalizeSessionId(input?.sessionId);
    const clientFileId = normalizeClientFileId(input?.clientFileId);
    const fileName = sanitizeVisitFileName(input?.fileName);
    const mimeType = normalizeText(input?.mimeType, 160).toLowerCase();
    const sizeBytes = validateVisitFileSize(input?.sizeBytes, DEFAULT_MAX_FILE_SIZE_BYTES);
    const uploadProofHash = hashSecret(normalizeText(input?.uploadProof, 100));
    const driveFileId = normalizeDriveId(input?.driveFileId, 'Drive file ID');
    const driveFolderId = normalizeDriveId(input?.driveFolderId, 'Drive folder ID');
    const driveFileUrl = normalizeDriveUrl(input?.driveFileUrl || input?.fileUrl);
    const finalFileName = sanitizeVisitFileName(input?.finalFileName || input?.fileName);
    const completionProof = generateRandomHex(32, tokenGenerator);
    const completionProofHash = hashSecret(completionProof);
    let response;

    await adapter.runTransaction(async (tx) => {
      const [ticketSnap, sessionSnap] = await Promise.all([
        tx.getDoc('driveUploadTickets', ticketHash),
        tx.getDoc('visitSubmissionUploadSessions', sessionId),
      ]);
      if (!ticketSnap.exists) throw makeVisitSubmissionError('not-found', 'Upload ticket not found.');
      if (!sessionSnap.exists) throw makeVisitSubmissionError('not-found', 'Upload session not found.');
      const ticketData = ticketSnap.data || {};
      const session = sessionSnap.data || {};
      if (ticketData.uploadType !== VISIT_UPLOAD_TYPE || ticketData.uploadPurpose !== VISIT_UPLOAD_PURPOSE) {
        throw makeVisitSubmissionError('invalid-argument', 'Invalid upload ticket type.');
      }
      if (ticketData.used !== true) {
        throw makeVisitSubmissionError('failed-precondition', 'Upload ticket has not been consumed.');
      }
      if (ticketData.driveUploadCompleted === true) {
        throw makeVisitSubmissionError('already-exists', 'Drive upload completion already recorded.');
      }
      if (ticketData.uploadProofHash !== uploadProofHash) {
        throw makeVisitSubmissionError('permission-denied', 'Upload proof is invalid.');
      }
      if (
        ticketData.sessionId !== sessionId
        || ticketData.clientFileId !== clientFileId
        || ticketData.fileName !== fileName
        || ticketData.mimeType !== mimeType
        || Number(ticketData.sizeBytes) !== sizeBytes
      ) {
        throw makeVisitSubmissionError('failed-precondition', 'Upload completion metadata mismatch.');
      }
      if (!VISIT_UPLOAD_SESSION_ACTIVE_STATUSES.includes(session.status)) {
        throw makeVisitSubmissionError('failed-precondition', 'Upload session is not active.');
      }

      const expectedFiles = (session.expectedFiles || []).map((file) => (
        file.clientFileId === clientFileId
          ? {
            ...file,
            status: 'drive-upload-completed',
            completedAtMillis: nowMillis(clock),
          }
          : file
      ));
      tx.updateDoc('visitSubmissionUploadSessions', sessionId, {
        expectedFiles,
        status: 'partial',
        updatedAt: adapter.serverTimestamp(),
      });
      tx.updateDoc('driveUploadTickets', ticketHash, {
        driveUploadCompleted: true,
        driveUploadCompletedAt: adapter.serverTimestamp(),
        completionProofHash,
        completionProofUsed: false,
        driveFileId,
        driveFolderId,
        driveFileUrl,
        finalFileName,
      });
      response = {
        ok: true,
        uploadType: 'visitSubmission',
        sessionId,
        clientFileId,
        visitType: ticketData.visitType,
        positionKey: ticketData.positionKey,
        completionProof,
      };
    });

    return response;
  }

  async function finalizeUpload(uid, input) {
    const access = await resolveAccessContext(uid);
    const sessionId = normalizeSessionId(input?.sessionId);
    const clientFileId = normalizeClientFileId(input?.clientFileId);
    const ticket = normalizeRawVisitTicket(input?.ticket);
    const ticketHash = hashSecret(ticket);
    const completionProofHash = hashSecret(normalizeText(input?.completionProof || input?.uploadProof, 100));
    const nowValue = nowMillis(clock);
    const submissionId = adapter.newDocId('visitSubmissions');
    let result;

    await adapter.runTransaction(async (tx) => {
      const [sessionSnap, ticketSnap] = await Promise.all([
        tx.getDoc('visitSubmissionUploadSessions', sessionId),
        tx.getDoc('driveUploadTickets', ticketHash),
      ]);
      if (!sessionSnap.exists) throw makeVisitSubmissionError('not-found', 'Upload session not found.');
      if (!ticketSnap.exists) throw makeVisitSubmissionError('not-found', 'Upload ticket not found.');
      const session = sessionSnap.data || {};
      const ticketData = ticketSnap.data || {};
      if (ticketData.finalized === true) {
        throw makeVisitSubmissionError('already-exists', 'Upload has already been finalized.');
      }
      if (session.actorUid !== uid || ticketData.uid !== uid) {
        throw makeVisitSubmissionError('permission-denied', 'Upload session is not valid for this user.');
      }
      assertFolderAccess(access, session.positionKey);
      if (ticketData.sessionId !== sessionId || ticketData.clientFileId !== clientFileId) {
        throw makeVisitSubmissionError('failed-precondition', 'Upload ticket metadata mismatch.');
      }
      if (ticketData.used !== true) {
        throw makeVisitSubmissionError('failed-precondition', 'Upload ticket has not been validated by the trusted uploader.');
      }
      if (ticketData.driveUploadCompleted !== true) {
        throw makeVisitSubmissionError('failed-precondition', 'Trusted Drive upload completion has not been recorded.');
      }
      if (ticketData.completionProofUsed === true) {
        throw makeVisitSubmissionError('already-exists', 'Upload completion proof already used.');
      }
      if (ticketData.completionProofHash !== completionProofHash) {
        throw makeVisitSubmissionError('permission-denied', 'Upload completion proof is invalid.');
      }
      if (Number(session.expiresAtMillis || 0) <= nowValue) {
        throw makeVisitSubmissionError('failed-precondition', 'Upload session expired.');
      }

      const folderId = session.folderId || visitPositionDocId(session.visitType, session.positionKey, positionHelpers);
      const folderSnap = await tx.getDoc('visitSubmissionPositions', folderId);
      if (!folderSnap.exists) throw makeVisitSubmissionError('not-found', 'Visit Submission structure is incomplete.');
      const folder = folderSnap.data || {};
      const driveFileId = ticketData.driveFileId;
      const driveFolderId = ticketData.driveFolderId;
      const driveFileUrl = ticketData.driveFileUrl;
      if (!driveFileId || !driveFolderId || !driveFileUrl) {
        throw makeVisitSubmissionError('failed-precondition', 'Trusted Drive upload completion is incomplete.');
      }
      if (folder.driveFolderId && folder.driveFolderId !== driveFolderId) {
        throw makeVisitSubmissionError('failed-precondition', 'Trusted Drive folder does not match this position folder.');
      }
      const expectedFiles = session.expectedFiles || [];
      const expectedFile = expectedFiles.find(file => file.clientFileId === clientFileId);
      if (!expectedFile) throw makeVisitSubmissionError('failed-precondition', 'Upload session file was not expected.');
      if (expectedFile.status === 'finalized') {
        const existingId = expectedFile.submissionId;
        result = { ok: true, submissionId: existingId, alreadyFinalized: true };
        return;
      }

      const activeFileCount = Math.max(0, Number(folder.activeFileCount || 0));
      const reservedFileCount = Math.max(0, Number(folder.reservedFileCount || 0));
      const replacingSubmissionId = session.replacesSubmissionId || null;
      const submission = {
        submissionId,
        visitType: session.visitType,
        positionKey: session.positionKey,
        positionTitle: session.positionTitle,
        uploadedByUid: uid,
        uploadedByName: access.name || session.actorName || uid,
        uploadedByRole: access.role,
        fileName: expectedFile.fileName,
        originalFileName: expectedFile.originalFileName,
        mimeType: expectedFile.mimeType,
        sizeBytes: expectedFile.sizeBytes,
        driveFileId,
        driveFileUrl,
        driveFolderId,
        uploadSessionId: sessionId,
        clientFileId,
        replacesSubmissionId: replacingSubmissionId,
        status: 'active',
        createdAt: adapter.serverTimestamp(),
        updatedAt: adapter.serverTimestamp(),
        deletedAt: null,
        deletedByUid: null,
        deleteReason: '',
      };
      tx.createDoc('visitSubmissions', submissionId, submission);

      let nextActiveFileCount = activeFileCount + 1;
      if (replacingSubmissionId) {
        if (Number(session.fileCount || 0) !== 1) {
          throw makeVisitSubmissionError('failed-precondition', 'Replacement sessions must contain exactly one file.');
        }
        const oldSnap = await tx.getDoc('visitSubmissions', replacingSubmissionId);
        if (!oldSnap.exists) throw makeVisitSubmissionError('not-found', 'Replaced submission not found.');
        const oldData = oldSnap.data || {};
        if (oldData.status !== 'active') {
          throw makeVisitSubmissionError('failed-precondition', 'Replaced submission is not active.');
        }
        if (oldData.visitType !== session.visitType || oldData.positionKey !== session.positionKey) {
          throw makeVisitSubmissionError('failed-precondition', 'Replacement submission scope changed.');
        }
        tx.updateDoc('visitSubmissions', replacingSubmissionId, {
          status: 'replaced',
          replacedBySubmissionId: submissionId,
          updatedAt: adapter.serverTimestamp(),
        });
        nextActiveFileCount = activeFileCount;
      }

      const nextFiles = expectedFiles.map(file => (
        file.clientFileId === clientFileId
          ? { ...file, status: 'finalized', submissionId, finalizedAtMillis: nowValue }
          : file
      ));
      const finalizedFileCount = nextFiles.filter(file => file.status === 'finalized').length;
      const sessionStatus = finalizedFileCount >= Number(session.fileCount || nextFiles.length) ? 'finalized' : 'partial';
      tx.updateDoc('visitSubmissionUploadSessions', sessionId, {
        expectedFiles: nextFiles,
        finalizedFileCount,
        status: sessionStatus,
        updatedAt: adapter.serverTimestamp(),
      });
      tx.updateDoc('driveUploadTickets', ticketHash, {
        finalized: true,
        finalizedAt: adapter.serverTimestamp(),
        completionProofUsed: true,
        submissionId,
      });
      tx.updateDoc('visitSubmissionPositions', folderId, {
        activeFileCount: nextActiveFileCount,
        reservedFileCount: Math.max(0, reservedFileCount - 1),
        driveFolderId: folder.driveFolderId || driveFolderId,
        driveFolderStatus: 'ready',
        updatedAt: adapter.serverTimestamp(),
        updatedBy: uid,
      });

      result = { ok: true, submissionId, visitType: session.visitType, positionKey: session.positionKey };
    });

    await adapter.addDoc('visitSubmissionAudit', buildAuditPayload('visitSubmissionFinalized', access, {
      visitType: result?.visitType || null,
      positionKey: result?.positionKey || null,
      submissionId: result?.submissionId || null,
      details: { sessionId, clientFileId, alreadyFinalized: result?.alreadyFinalized === true },
    }, adapter.serverTimestamp()));
    return result;
  }

  async function releaseSessionReservations(access, sessionId, targetStatus, actionName) {
    let released = 0;
    let visitType = null;
    let positionKey = null;
    await adapter.runTransaction(async (tx) => {
      const sessionSnap = await tx.getDoc('visitSubmissionUploadSessions', sessionId);
      if (!sessionSnap.exists) throw makeVisitSubmissionError('not-found', 'Upload session not found.');
      const session = sessionSnap.data || {};
      visitType = session.visitType;
      positionKey = session.positionKey;
      if (session.actorUid !== access.uid && !access.canManageVisitSystem) {
        throw makeVisitSubmissionError('permission-denied', 'Upload session is not valid for this user.');
      }
      if (VISIT_UPLOAD_SESSION_TERMINAL_STATUSES.includes(session.status)) return;
      const files = (session.expectedFiles || []).map((file) => {
        if (file.status === 'finalized' || file.status === 'cancelled' || file.status === 'expired') return file;
        released += 1;
        return { ...file, status: targetStatus };
      });
      const folderId = session.folderId || visitPositionDocId(session.visitType, session.positionKey, positionHelpers);
      const folderSnap = await tx.getDoc('visitSubmissionPositions', folderId);
      if (folderSnap.exists && released > 0) {
        const folder = folderSnap.data || {};
        tx.updateDoc('visitSubmissionPositions', folderId, {
          reservedFileCount: Math.max(0, Number(folder.reservedFileCount || 0) - released),
          updatedAt: adapter.serverTimestamp(),
          updatedBy: access.uid,
        });
      }
      tx.updateDoc('visitSubmissionUploadSessions', sessionId, {
        expectedFiles: files,
        status: targetStatus === 'expired' ? 'expired' : 'cancelled',
        reservedFileCount: 0,
        updatedAt: adapter.serverTimestamp(),
      });
    });
    await adapter.addDoc('visitSubmissionAudit', buildAuditPayload(actionName, access, {
      visitType,
      positionKey,
      details: { sessionId, releasedReservations: released },
    }, adapter.serverTimestamp()));
    return { ok: true, sessionId, releasedReservations: released };
  }

  async function cancelUploadSession(uid, input) {
    const access = await resolveAccessContext(uid);
    const sessionId = normalizeSessionId(input?.sessionId);
    return releaseSessionReservations(access, sessionId, 'cancelled', 'visitUploadSessionCancelled');
  }

  async function cleanupExpiredUploadSessions(uid, input) {
    const access = await resolveAccessContext(uid);
    assertManageAccess(access);
    const limit = validateIntegerLimit(input?.limit || 25, 'limit', 1, 50);
    const expired = await adapter.queryExpiredUploadSessions(nowMillis(clock), limit);
    let releasedReservations = 0;
    for (const session of expired) {
      const result = await releaseSessionReservations(access, session.id, 'expired', 'visitUploadSessionExpired');
      releasedReservations += result.releasedReservations;
    }
    return { ok: true, expiredSessionCount: expired.length, releasedReservations };
  }

  async function archiveSubmission(uid, input, mode) {
    const access = await resolveAccessContext(uid);
    const submissionId = normalizeSubmissionId(input?.submissionId);
    const reason = normalizeText(input?.reason, 500);
    let auditDetails = null;
    await adapter.runTransaction(async (tx) => {
      const snap = await tx.getDoc('visitSubmissions', submissionId);
      if (!snap.exists) throw makeVisitSubmissionError('not-found', 'Submission not found.');
      const submission = snap.data || {};
      if (submission.status !== 'active') {
        throw makeVisitSubmissionError('failed-precondition', 'Submission is not active.');
      }
      const positionKey = normalizeCanonicalPositionKey(submission.positionKey, positionHelpers);
      if (mode === 'withdraw') {
        assertFolderAccess(access, positionKey);
        if (submission.uploadedByUid !== uid) {
          throw makeVisitSubmissionError('permission-denied', 'Only the uploader may withdraw this submission.');
        }
      } else {
        assertManageAccess(access);
      }
      const folderId = visitPositionDocId(submission.visitType, positionKey, positionHelpers);
      const folderSnap = await tx.getDoc('visitSubmissionPositions', folderId);
      if (folderSnap.exists) {
        const folder = folderSnap.data || {};
        tx.updateDoc('visitSubmissionPositions', folderId, {
          activeFileCount: Math.max(0, Number(folder.activeFileCount || 0) - 1),
          updatedAt: adapter.serverTimestamp(),
          updatedBy: uid,
        });
      }
      const status = mode === 'withdraw' ? 'archived' : 'admin-removed';
      tx.updateDoc('visitSubmissions', submissionId, {
        status,
        deletedAt: adapter.serverTimestamp(),
        deletedByUid: uid,
        deleteReason: mode === 'withdraw' ? 'withdrawn-by-uploader' : reason,
        updatedAt: adapter.serverTimestamp(),
      });
      auditDetails = { visitType: submission.visitType, positionKey, submissionId, status };
    });
    await adapter.addDoc('visitSubmissionAudit', buildAuditPayload(
      mode === 'withdraw' ? 'visitSubmissionWithdrawn' : 'visitSubmissionRemoved',
      access,
      {
        visitType: auditDetails?.visitType,
        positionKey: auditDetails?.positionKey,
        submissionId,
        details: { reason: mode === 'withdraw' ? 'withdrawn-by-uploader' : reason },
      },
      adapter.serverTimestamp()
    ));
    return { ok: true, submissionId, status: auditDetails.status };
  }

  async function withdrawSubmission(uid, input) {
    return archiveSubmission(uid, input, 'withdraw');
  }

  async function removeSubmission(uid, input) {
    return archiveSubmission(uid, input, 'remove');
  }

  async function replaceSubmission(uid, input) {
    const access = await resolveAccessContext(uid);
    const replacesSubmissionId = normalizeSubmissionId(input?.replacesSubmissionId || input?.submissionId);
    const replacementFiles = Array.isArray(input?.files) ? input.files : [];
    if (replacementFiles.length !== 1) {
      throw makeVisitSubmissionError('invalid-argument', 'Replacement requires exactly one file.');
    }
    const snap = await adapter.getDoc('visitSubmissions', replacesSubmissionId);
    if (!snap.exists) throw makeVisitSubmissionError('not-found', 'Submission not found.');
    const submission = snap.data || {};
    if (submission.status !== 'active') {
      throw makeVisitSubmissionError('failed-precondition', 'Submission is not active.');
    }
    const positionKey = normalizeCanonicalPositionKey(submission.positionKey, positionHelpers);
    assertFolderAccess(access, positionKey);
    if (!access.canManageVisitSystem && submission.uploadedByUid !== uid) {
      throw makeVisitSubmissionError('permission-denied', 'Only the uploader may replace this submission.');
    }
    return createUploadSession(uid, {
      visitType: submission.visitType,
      positionKey,
      files: replacementFiles,
    }, {
      replacesSubmissionId,
      oldUploadedByUid: submission.uploadedByUid || null,
    });
  }

  async function reconcileFolderCount(uid, input) {
    const access = await resolveAccessContext(uid);
    assertManageAccess(access);
    const visitType = normalizeVisitType(input?.visitType);
    const positionKey = normalizeCanonicalPositionKey(input?.positionKey, positionHelpers);
    const folderId = visitPositionDocId(visitType, positionKey, positionHelpers);
    const [activeDocs, activeSessions, folderSnap] = await Promise.all([
      adapter.queryActiveSubmissionsForPositions(visitType, [positionKey]),
      adapter.queryActiveUploadSessionsForFolder(visitType, positionKey),
      adapter.getDoc('visitSubmissionPositions', folderId),
    ]);
    if (!folderSnap.exists) throw makeVisitSubmissionError('not-found', 'Visit Submission structure is incomplete.');
    const previousActiveFileCount = Math.max(0, Number(folderSnap.data?.activeFileCount || 0));
    const previousReservedFileCount = Math.max(0, Number(folderSnap.data?.reservedFileCount || 0));
    const reservedStatuses = new Set(['reserved', 'ticket-consumed', 'drive-upload-completed']);
    const reservedFileCount = activeSessions.reduce((sum, session) => {
      const files = Array.isArray(session.data.expectedFiles) ? session.data.expectedFiles : [];
      return sum + files.filter(file => reservedStatuses.has(file.status)).length;
    }, 0);
    await adapter.updateDoc('visitSubmissionPositions', folderId, {
      activeFileCount: activeDocs.length,
      reservedFileCount,
      updatedAt: adapter.serverTimestamp(),
      updatedBy: uid,
    });
    await adapter.addDoc('visitSubmissionAudit', buildAuditPayload('visitFolderCountReconciled', access, {
      visitType,
      positionKey,
      details: {
        previousActiveFileCount,
        newActiveFileCount: activeDocs.length,
        previousReservedFileCount,
        newReservedFileCount: reservedFileCount,
        activeSessionCount: activeSessions.length,
      },
    }, adapter.serverTimestamp()));
    return { ok: true, visitType, positionKey, activeFileCount: activeDocs.length, reservedFileCount };
  }

  async function getModerationData(uid, input) {
    const access = await resolveAccessContext(uid);
    assertManageAccess(access);
    const visitType = input?.visitType ? normalizeVisitType(input.visitType) : null;
    const positionKey = input?.positionKey ? normalizeCanonicalPositionKey(input.positionKey, positionHelpers) : null;
    const status = input?.status ? normalizeSubmissionStatus(input.status) : 'active';
    const limit = validateIntegerLimit(input?.limit || 25, 'limit', 1, 50);
    const cursor = decodeModerationCursor(input?.cursor || null);
    const submissions = await adapter.querySubmissions({ visitType, positionKey, status, limit, cursor });
    const pageItems = submissions.slice(0, limit);
    const hasMore = submissions.length > limit;
    const last = pageItems[pageItems.length - 1] || null;
    return {
      ok: true,
      submissions: pageItems.map(doc => ({
        ...shapeSubmission({ id: doc.id, ...doc.data }, access),
        driveFileId: doc.data.driveFileId || '',
        driveFolderId: doc.data.driveFolderId || '',
        deletedAt: doc.data.deletedAt || null,
        deletedByUid: doc.data.deletedByUid || null,
        deleteReason: doc.data.deleteReason || '',
        replacesSubmissionId: doc.data.replacesSubmissionId || null,
        replacedBySubmissionId: doc.data.replacedBySubmissionId || null,
      })),
      pageSize: pageItems.length,
      limit,
      nextCursor: hasMore && last ? encodeModerationCursor(last.data.createdAt, last.id) : null,
      hasMore,
    };
  }

  return {
    resolveAccessContext,
    initializeStructure,
    getDashboard,
    getFolders,
    getFolder,
    updateConfig,
    updateFolder,
    createUploadSession,
    validateVisitUploadTicketWithProof,
    completeDriveUpload,
    finalizeUpload,
    withdrawSubmission,
    removeSubmission,
    replaceSubmission,
    reconcileFolderCount,
    getModerationData,
    cleanupExpiredUploadSessions,
    cancelUploadSession,
  };
}

module.exports = {
  VISIT_TYPES,
  VISIT_TYPE_KEYS,
  VISIT_ACCESS_ROLES,
  VISIT_ADMIN_ROLES,
  DEFAULT_MAX_ACTIVE_FILES,
  DEFAULT_MAX_FILES_PER_SELECTION,
  DEFAULT_MAX_FILE_SIZE_BYTES,
  MIN_FILE_SIZE_BYTES,
  VISIT_UPLOAD_TYPE,
  VISIT_UPLOAD_PURPOSE,
  VISIT_UPLOAD_SESSION_TTL_MS,
  VISIT_UPLOAD_TICKET_TTL_MS,
  VISIT_ALLOWED_MIME_BY_EXTENSION,
  VISIT_DANGEROUS_EXTENSIONS,
  VISIT_SUBMISSION_STATUSES,
  makeVisitSubmissionError,
  hashSecret,
  sanitizeVisitFileName,
  validateVisitFileType,
  validateVisitFileSize,
  normalizeVisitType,
  getVisitTypeDefinition,
  getActivePositionDefinitions,
  normalizeCanonicalPositionKey,
  normalizeCanonicalPositionKeys,
  visitPositionDocId,
  resolveAccessContextFromRecords,
  validateConfigUpdate,
  validateFolderUpdate,
  buildVisitConfigDefaults,
  buildVisitPositionDefaults,
  buildAuditPayload,
  submissionActionPermissions,
  shapeSubmission,
  buildFolderResponse,
  createFirestoreVisitSubmissionAdapter,
  createMemoryVisitSubmissionAdapter,
  createVisitSubmissionService,
};
