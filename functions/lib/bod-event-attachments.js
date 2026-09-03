const crypto = require('crypto');
const { createGoogleDriveClient } = require('./visit-drive');

const BOD_EVENT_ATTACHMENT_SOURCE = 'appsScriptFinalize';
const BOD_EVENT_ATTACHMENT_STORAGE_PROVIDER = 'googleDrive';
const BOD_EVENT_ATTACHMENTS_COLLECTION = 'attachments';
const BOD_EVENT_FINALIZATIONS_COLLECTION = 'driveUploadFinalizations';
const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';
const DEFAULT_ALLOWED_MIME_TYPES = Object.freeze([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const DRIVE_AUTH_MODES = Object.freeze(['oauth', 'shared-drive']);
const INACTIVE_EVENT_STATUSES = new Set([
  'archived',
  'cancelled',
  'canceled',
  'deleted',
  'inactive',
  'removed',
]);

function makeError(HttpsError, code, message, details) {
  return new HttpsError(code, message, details);
}

function text(value, max = 500) {
  return String(value == null ? '' : value).trim().replace(/\s+/g, ' ').slice(0, max);
}

function cleanLower(value, max = 120) {
  return text(value, max).toLowerCase();
}

function hasControlCharacter(value) {
  return /[\x00-\x1F\x7F]/.test(String(value || ''));
}

function normalizeDocumentId(value, fieldName, HttpsError, max = 160) {
  const id = text(value, max);
  if (!id || /[\\/]/.test(id) || hasControlCharacter(id)) {
    throw makeError(HttpsError, 'invalid-argument', `${fieldName} is invalid.`);
  }
  return id;
}

function normalizeDriveId(value, fieldName, HttpsError) {
  const id = text(value, 300);
  if (!id || /[\\/]/.test(id) || hasControlCharacter(id)) {
    throw makeError(HttpsError, 'invalid-argument', `${fieldName} is invalid.`);
  }
  return id;
}

function normalizeProof(value, HttpsError) {
  const proof = String(value == null ? '' : value).trim();
  if (!proof || proof.length > 240 || hasControlCharacter(proof)) {
    throw makeError(HttpsError, 'invalid-argument', 'Valid finalize proof is required.');
  }
  return proof;
}

function hashBodEventFinalizeProof(proof) {
  return crypto.createHash('sha256').update(String(proof || ''), 'utf8').digest('hex');
}

function proofMatches(proof, expectedHash) {
  if (!/^[a-f0-9]{64}$/i.test(String(expectedHash || ''))) return false;
  const actual = Buffer.from(hashBodEventFinalizeProof(proof), 'hex');
  const expected = Buffer.from(String(expectedHash || ''), 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function generateBodEventFinalizeProof(randomBytes = crypto.randomBytes) {
  return randomBytes(32).toString('base64url');
}

function normalizeSha256(value, HttpsError) {
  const raw = String(value == null ? '' : value).trim();
  const sha256 = raw.toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(sha256) || raw.length !== 64) {
    throw makeError(HttpsError, 'invalid-argument', 'Valid SHA-256 is required.');
  }
  return sha256;
}

function normalizeFileName(value, HttpsError) {
  if (typeof value !== 'string' || hasControlCharacter(value)) {
    throw makeError(HttpsError, 'invalid-argument', 'Valid file name is required.');
  }
  const fileName = value
    .split(/[\\/]/)
    .pop()
    .replace(/[\\/:*?"<>|\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s]+/, '')
    .replace(/[.\s]+$/, '')
    .slice(0, 180)
    .trim();
  if (!fileName) {
    throw makeError(HttpsError, 'invalid-argument', 'Valid file name is required.');
  }
  return fileName;
}

function normalizeMimeType(value, HttpsError, allowedMimeTypes = DEFAULT_ALLOWED_MIME_TYPES) {
  const mimeType = cleanLower(value, 120);
  if (!allowedMimeTypes.has(mimeType)) {
    throw makeError(HttpsError, 'invalid-argument', 'Unsupported upload file type.');
  }
  return mimeType;
}

function normalizeSizeBytes(value, HttpsError, maxBytes) {
  const sizeBytes = Number(value);
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
    throw makeError(HttpsError, 'invalid-argument', 'Valid upload size is required.');
  }
  if (Number.isSafeInteger(maxBytes) && sizeBytes > maxBytes) {
    throw makeError(HttpsError, 'invalid-argument', 'Upload file is too large.');
  }
  return sizeBytes;
}

function normalizeOptionalDriveUrl(value) {
  const url = text(value, 700);
  return /^https:\/\/drive\.google\.com\//i.test(url) ? url : '';
}

function normalizeDriveFile(raw = {}) {
  return {
    id: text(raw.id, 300),
    name: text(raw.name, 300),
    mimeType: cleanLower(raw.mimeType, 120),
    sizeBytes: Number(raw.sizeBytes ?? raw.size) || 0,
    parents: Array.isArray(raw.parents) ? raw.parents.map(item => text(item, 300)).filter(Boolean) : [],
    trashed: raw.trashed === true,
    webViewLink: normalizeOptionalDriveUrl(raw.webViewLink),
  };
}

function sanitizeBodFolderPart(value, maxLength, fallback = 'untitled') {
  const cleaned = String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|#%{}~&\x00-\x1F]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .trim();
  return cleaned || fallback;
}

function buildBodEventUploadFolderName({ eventDate, eventName, uploadGroupId }) {
  return [
    sanitizeBodFolderPart(eventDate, 30, 'undated'),
    sanitizeBodFolderPart(eventName, 100, 'event'),
    sanitizeBodFolderPart(uploadGroupId, 100, 'group'),
  ].join('_').slice(0, 220);
}

function extractDriveFolderId(value) {
  const raw = text(value, 700);
  if (!raw) return '';
  const folderMatch = raw.match(/\/folders\/([A-Za-z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];
  if (!/^https?:\/\//i.test(raw) && /^[A-Za-z0-9_-]{10,300}$/.test(raw)) return raw;
  return '';
}

function normalizeAuthoritativeBodUploadEvent(eventId, raw = {}, HttpsError) {
  const normalizedEventId = normalizeDocumentId(eventId, 'Event ID', HttpsError, 128);
  const eventName = text(raw.name, 180);
  const eventDate = text(raw.date || raw.eventStart, 20);
  const eventType = text(raw.type || 'clubEvent', 40);
  const status = cleanLower(raw.status, 40);
  const terminalFieldPresent = [
    'archivedAt',
    'deletedAt',
    'disabledAt',
    'endedAt',
    'historicalAt',
    'inactiveAt',
    'removedAt',
    'revokedAt',
  ].some(field => Object.prototype.hasOwnProperty.call(raw || {}, field));

  if (!eventName) throw makeError(HttpsError, 'failed-precondition', 'BOD event name is missing.');
  if (!eventDate) throw makeError(HttpsError, 'failed-precondition', 'BOD event date is missing.');
  if (eventType !== 'clubEvent') {
    throw makeError(HttpsError, 'failed-precondition', 'BOD meetings cannot have event report attachments.');
  }
  if (
    raw.active === false
    || raw.archived === true
    || raw.deleted === true
    || raw.disabled === true
    || raw.removed === true
    || INACTIVE_EVENT_STATUSES.has(status)
    || terminalFieldPresent
  ) {
    throw makeError(HttpsError, 'failed-precondition', 'BOD event is not active for new uploads.');
  }

  return {
    eventId: normalizedEventId,
    eventName,
    eventDate,
    eventType,
    status,
    driveFolderId: extractDriveFolderId(raw.driveFolderId || raw.driveFolder),
  };
}

function timestampToMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const millis = Date.parse(value);
    return Number.isFinite(millis) ? millis : 0;
  }
  return 0;
}

function serverTimestamp(admin) {
  return admin?.firestore?.FieldValue?.serverTimestamp
    ? admin.firestore.FieldValue.serverTimestamp()
    : new Date().toISOString();
}

function getSecretValue(options, name) {
  const boundSecret = options.secrets?.[name];
  if (boundSecret && typeof boundSecret.value === 'function') return boundSecret.value();
  if (typeof options.getSecret === 'function') return options.getSecret(name);
  return (options.env || process.env)[name];
}

function serviceConfigError(message) {
  const error = new Error(message);
  error.code = 'failed-precondition';
  error.status = 500;
  error.httpStatus = 500;
  throw error;
}

function getBodEventUploadDriveConfig(env = process.env) {
  const authMode = cleanLower(
    env.BOD_EVENT_UPLOAD_DRIVE_AUTH_MODE
      || env.BOD_DRIVE_AUTH_MODE
      || env.RESOLUTION_DRIVE_AUTH_MODE
      || env.VISIT_DRIVE_AUTH_MODE
      || 'oauth',
    40
  );
  const rootFolderId = text(env.BOD_EVENT_UPLOAD_ROOT_FOLDER_ID || env.BOD_ROOT_FOLDER_ID, 300);
  if (!DRIVE_AUTH_MODES.includes(authMode) || !rootFolderId) {
    serviceConfigError('BOD event upload storage is not configured.');
  }
  return { authMode, rootFolderId };
}

function createBodEventDriveMetadataService(options = {}) {
  let driveClient = options.driveClient || null;
  const config = options.config || getBodEventUploadDriveConfig(options.env || process.env);

  function getDriveClient() {
    if (!driveClient) {
      driveClient = createGoogleDriveClient({
        ...options,
        config: { authMode: config.authMode },
        getSecret: (name) => getSecretValue(options, name),
      });
    }
    return driveClient;
  }

  async function getFileMetadata(fileId) {
    const response = await getDriveClient().files.get({
      fileId: text(fileId, 300),
      fields: 'id,name,mimeType,size,parents,trashed,webViewLink',
      supportsAllDrives: true,
    });
    return normalizeDriveFile(response.data);
  }

  async function getFolderMetadata(folderId) {
    const response = await getDriveClient().files.get({
      fileId: text(folderId, 300),
      fields: 'id,name,mimeType,parents,trashed,webViewLink',
      supportsAllDrives: true,
    });
    return normalizeDriveFile(response.data);
  }

  async function downloadFile(fileId) {
    const response = await getDriveClient().files.get({
      fileId: text(fileId, 300),
      alt: 'media',
      supportsAllDrives: true,
    }, { responseType: 'arraybuffer' });
    const data = response.data;
    if (Buffer.isBuffer(data)) return data;
    if (data instanceof ArrayBuffer) return Buffer.from(data);
    if (ArrayBuffer.isView(data)) {
      return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    }
    if (typeof data === 'string') return Buffer.from(data, 'binary');
    return Buffer.from([]);
  }

  return {
    rootFolderId: config.rootFolderId,
    getFileMetadata,
    getFolderMetadata,
    downloadFile,
  };
}

function finalizationMatchesRequest(session, payload) {
  return session.eventId === payload.eventId
    && session.uploadGroupId === payload.uploadGroupId
    && session.fileName === payload.fileName
    && session.mimeType === payload.mimeType
    && Number(session.sizeBytes) === payload.sizeBytes;
}

function finalizedStateMatchesRequest(session, payload) {
  return finalizationMatchesRequest(session, payload)
    && session.driveFileId === payload.driveFileId
    && session.driveFolderId === payload.driveFolderId
    && session.sha256 === payload.sha256;
}

function attachmentMatchesRequest(attachment, session, payload) {
  return attachment.storageProvider === BOD_EVENT_ATTACHMENT_STORAGE_PROVIDER
    && attachment.source === BOD_EVENT_ATTACHMENT_SOURCE
    && attachment.fileName === session.fileName
    && attachment.mimeType === session.mimeType
    && Number(attachment.sizeBytes) === Number(session.sizeBytes)
    && attachment.driveFolderId === payload.driveFolderId
    && attachment.uploadGroupId === session.uploadGroupId
    && attachment.uploadedByUid === session.uid
    && attachment.sha256 === payload.sha256;
}

function normalizeFinalizationPayload(data = {}, HttpsError, options = {}) {
  const allowedMimeTypes = new Set(options.allowedMimeTypes || DEFAULT_ALLOWED_MIME_TYPES);
  return {
    uploadType: cleanLower(data.uploadType || 'bod', 20),
    finalizeId: normalizeDocumentId(data.finalizeId, 'Finalize ID', HttpsError, 160),
    finalizeProof: normalizeProof(data.finalizeProof, HttpsError),
    eventId: normalizeDocumentId(data.eventId, 'Event ID', HttpsError, 128),
    uploadGroupId: normalizeDocumentId(data.uploadGroupId, 'Upload group ID', HttpsError, 100),
    driveFileId: normalizeDriveId(data.driveFileId || data.fileId, 'Drive file ID', HttpsError),
    driveFolderId: normalizeDriveId(data.driveFolderId || data.folderId, 'Drive folder ID', HttpsError),
    fileName: normalizeFileName(data.fileName, HttpsError),
    mimeType: normalizeMimeType(data.mimeType, HttpsError, allowedMimeTypes),
    sizeBytes: normalizeSizeBytes(data.sizeBytes, HttpsError, options.maxBytes),
    sha256: normalizeSha256(data.sha256, HttpsError),
    fileUrl: normalizeOptionalDriveUrl(data.fileUrl),
  };
}

function assertPendingSession(session, payload, HttpsError, nowMillis) {
  if (session.uploadType !== 'bod' || session.status !== 'pending') {
    throw makeError(HttpsError, 'failed-precondition', 'BOD upload finalization is not pending.');
  }
  if (!proofMatches(payload.finalizeProof, session.proofHash)) {
    throw makeError(HttpsError, 'permission-denied', 'Invalid finalize proof.');
  }
  if (!finalizationMatchesRequest(session, payload)) {
    throw makeError(HttpsError, 'failed-precondition', 'BOD upload finalization metadata mismatch.');
  }
  const expiresAtMillis = timestampToMillis(session.expiresAt);
  if (!expiresAtMillis || expiresAtMillis <= nowMillis) {
    throw makeError(HttpsError, 'deadline-exceeded', 'BOD upload finalization expired.');
  }
}

function assertFinalizedSessionRetry(session, payload, HttpsError) {
  if (!proofMatches(payload.finalizeProof, session.proofHash)) {
    throw makeError(HttpsError, 'permission-denied', 'Invalid finalize proof.');
  }
  if (!finalizedStateMatchesRequest(session, payload)) {
    throw makeError(HttpsError, 'already-exists', 'BOD upload finalization was already used for a different file.');
  }
}

function assertDriveFolder(folder, session, payload, rootFolderId, HttpsError) {
  const expectedFolderName = session.expectedFolderName || buildBodEventUploadFolderName(session);
  if (!folder || folder.id !== payload.driveFolderId || folder.trashed === true) {
    throw makeError(HttpsError, 'failed-precondition', 'BOD upload folder is not valid.');
  }
  if (folder.mimeType !== DRIVE_FOLDER_MIME) {
    throw makeError(HttpsError, 'failed-precondition', 'BOD upload folder is not valid.');
  }
  if (!folder.parents.includes(rootFolderId)) {
    throw makeError(HttpsError, 'failed-precondition', 'BOD upload folder is outside the approved root.');
  }
  if (folder.name !== expectedFolderName) {
    throw makeError(HttpsError, 'failed-precondition', 'BOD upload folder name does not match the approved event.');
  }
}

function assertDriveFile(file, session, payload, HttpsError) {
  if (!file || file.id !== payload.driveFileId || file.trashed === true) {
    throw makeError(HttpsError, 'failed-precondition', 'BOD upload file is not valid.');
  }
  if (file.name !== session.fileName) {
    throw makeError(HttpsError, 'failed-precondition', 'BOD upload file name does not match the approved ticket.');
  }
  if (file.mimeType !== session.mimeType) {
    throw makeError(HttpsError, 'failed-precondition', 'BOD upload file type does not match the approved ticket.');
  }
  if (Number(file.sizeBytes) !== Number(session.sizeBytes)) {
    throw makeError(HttpsError, 'failed-precondition', 'BOD upload file size does not match the approved ticket.');
  }
  if (!file.parents.includes(payload.driveFolderId)) {
    throw makeError(HttpsError, 'failed-precondition', 'BOD upload file is outside the verified event folder.');
  }
}

function createBodEventAttachmentService(options = {}) {
  const { db, admin, HttpsError } = options;
  if (!db || !HttpsError) throw new Error('BOD event attachment service requires db and HttpsError.');
  const maxBytes = options.maxBytes;
  const allowedMimeTypes = new Set(options.allowedMimeTypes || DEFAULT_ALLOWED_MIME_TYPES);
  const nowMillis = options.nowMillis || (() => Date.now());
  let driveService = options.drive || null;

  function getDriveService() {
    if (!driveService) driveService = createBodEventDriveMetadataService(options);
    return driveService;
  }

  function finalizationRef(finalizeId) {
    return db.collection(BOD_EVENT_FINALIZATIONS_COLLECTION).doc(finalizeId);
  }

  function eventRef(eventId) {
    return db.collection('bodEvents').doc(eventId);
  }

  function uploadGroupRef(uploadGroupId) {
    return db.collection('driveUploadGroups').doc(uploadGroupId);
  }

  function attachmentRef(payload) {
    return eventRef(payload.eventId)
      .collection(BOD_EVENT_ATTACHMENTS_COLLECTION)
      .doc(payload.driveFileId);
  }

  async function loadApprovedPendingSession(payload) {
    const snap = await finalizationRef(payload.finalizeId).get();
    if (!snap.exists) throw makeError(HttpsError, 'not-found', 'BOD upload finalization not found.');
    const session = snap.data() || {};

    if (session.status === 'finalized') {
      assertFinalizedSessionRetry(session, payload, HttpsError);
      return { session, finalized: true };
    }

    assertPendingSession(session, payload, HttpsError, nowMillis());
    return { session, finalized: false };
  }

  async function verifyDriveMetadata(session, payload) {
    const drive = getDriveService();
    let rawFolder;
    let rawFile;
    try {
      rawFolder = await drive.getFolderMetadata(payload.driveFolderId);
    } catch {
      throw makeError(HttpsError, 'failed-precondition', 'BOD upload folder is not valid.');
    }
    try {
      rawFile = await drive.getFileMetadata(payload.driveFileId);
    } catch {
      throw makeError(HttpsError, 'failed-precondition', 'BOD upload file is not valid.');
    }
    const folder = normalizeDriveFile(rawFolder);
    const file = normalizeDriveFile(rawFile);
    assertDriveFolder(folder, session, payload, drive.rootFolderId, HttpsError);
    assertDriveFile(file, session, payload, HttpsError);
    return { folder, file };
  }

  function assertEventAndGroup(eventSnap, groupSnap, session, payload) {
    if (!eventSnap.exists) throw makeError(HttpsError, 'not-found', 'BOD event not found.');
    const event = eventSnap.data() || {};
    const eventType = text(event.type || 'clubEvent', 40);
    if (eventType !== 'clubEvent') {
      throw makeError(HttpsError, 'failed-precondition', 'BOD meetings cannot have event report attachments.');
    }

    if (!groupSnap.exists) throw makeError(HttpsError, 'failed-precondition', 'BOD upload group is not valid.');
    const group = groupSnap.data() || {};
    if (group.uid !== session.uid) {
      throw makeError(HttpsError, 'permission-denied', 'BOD upload group is not valid for this user.');
    }
    if (group.eventId) {
      if (group.eventId !== session.eventId) {
        throw makeError(HttpsError, 'failed-precondition', 'BOD upload group is bound to a different event.');
      }
    } else if (group.eventName !== session.eventName || group.eventDate !== session.eventDate) {
      throw makeError(HttpsError, 'failed-precondition', 'BOD upload group is not valid for this event.');
    }
    if (group.driveFolderId && group.driveFolderId !== payload.driveFolderId) {
      throw makeError(HttpsError, 'failed-precondition', 'BOD upload group folder does not match this file.');
    }
  }

  async function finalizeAppsScriptUpload(data = {}) {
    const payload = normalizeFinalizationPayload(data, HttpsError, { allowedMimeTypes, maxBytes });
    if (payload.uploadType !== 'bod') {
      throw makeError(HttpsError, 'invalid-argument', 'Invalid upload type.');
    }

    const preflight = await loadApprovedPendingSession(payload);
    if (preflight.finalized) {
      return {
        ok: true,
        unchanged: true,
        eventId: payload.eventId,
        uploadGroupId: payload.uploadGroupId,
        driveFileId: payload.driveFileId,
        attachmentPath: attachmentRef(payload).path,
      };
    }

    const { folder, file } = await verifyDriveMetadata(preflight.session, payload);
    const verifiedFileUrl = file.webViewLink || payload.fileUrl;

    return db.runTransaction(async (tx) => {
      const finalizeSnap = await tx.get(finalizationRef(payload.finalizeId));
      if (!finalizeSnap.exists) throw makeError(HttpsError, 'not-found', 'BOD upload finalization not found.');
      const session = finalizeSnap.data() || {};

      if (session.status === 'finalized') {
        assertFinalizedSessionRetry(session, payload, HttpsError);
        return {
          ok: true,
          unchanged: true,
          eventId: payload.eventId,
          uploadGroupId: payload.uploadGroupId,
          driveFileId: payload.driveFileId,
          attachmentPath: attachmentRef(payload).path,
        };
      }

      assertPendingSession(session, payload, HttpsError, nowMillis());

      const eventDocumentRef = eventRef(session.eventId);
      const groupRef = uploadGroupRef(session.uploadGroupId);
      const attachmentDocumentRef = attachmentRef(payload);
      const [eventSnap, groupSnap, attachmentSnap] = await Promise.all([
        tx.get(eventDocumentRef),
        tx.get(groupRef),
        tx.get(attachmentDocumentRef),
      ]);

      assertEventAndGroup(eventSnap, groupSnap, session, payload);

      if (attachmentSnap.exists) {
        const existing = attachmentSnap.data() || {};
        if (!attachmentMatchesRequest(existing, session, payload)) {
          throw makeError(HttpsError, 'already-exists', 'BOD attachment already exists for a different upload.');
        }
      }

      const now = serverTimestamp(admin);
      const attachment = {
        storageProvider: BOD_EVENT_ATTACHMENT_STORAGE_PROVIDER,
        fileName: session.fileName,
        mimeType: session.mimeType,
        sizeBytes: Number(session.sizeBytes),
        driveFolderId: payload.driveFolderId,
        uploadGroupId: session.uploadGroupId,
        uploadedByUid: session.uid,
        uploadedAt: now,
        createdAt: now,
        verifiedAt: now,
        source: BOD_EVENT_ATTACHMENT_SOURCE,
        sha256: payload.sha256,
        ...(verifiedFileUrl ? { fileUrl: verifiedFileUrl } : {}),
      };

      if (!attachmentSnap.exists) {
        tx.create(attachmentDocumentRef, attachment);
      }
      tx.set(groupRef, {
        eventId: session.eventId,
        driveFolderId: payload.driveFolderId,
        driveFolderName: folder.name,
        updatedAt: now,
      }, { merge: true });
      tx.update(finalizationRef(payload.finalizeId), {
        status: 'finalized',
        driveFileId: payload.driveFileId,
        driveFolderId: payload.driveFolderId,
        sha256: payload.sha256,
        fileUrl: verifiedFileUrl,
        attachmentPath: attachmentDocumentRef.path,
        finalizedAt: now,
        updatedAt: now,
      });

      return {
        ok: true,
        unchanged: false,
        eventId: session.eventId,
        uploadGroupId: session.uploadGroupId,
        driveFileId: payload.driveFileId,
        attachmentPath: attachmentDocumentRef.path,
      };
    });
  }

  return {
    finalizeAppsScriptUpload,
  };
}

module.exports = {
  BOD_EVENT_ATTACHMENT_SOURCE,
  BOD_EVENT_ATTACHMENT_STORAGE_PROVIDER,
  BOD_EVENT_ATTACHMENTS_COLLECTION,
  BOD_EVENT_FINALIZATIONS_COLLECTION,
  DRIVE_FOLDER_MIME,
  DEFAULT_ALLOWED_MIME_TYPES,
  buildBodEventUploadFolderName,
  createBodEventAttachmentService,
  createBodEventDriveMetadataService,
  generateBodEventFinalizeProof,
  getBodEventUploadDriveConfig,
  hashBodEventFinalizeProof,
  normalizeDocumentId,
  normalizeAuthoritativeBodUploadEvent,
  normalizeFinalizationPayload,
};
