'use strict';

const crypto = require('crypto');
const { Readable } = require('stream');
const {
  VISIT_UPLOAD_ALLOWED_ORIGINS,
  createGoogleDriveClient,
  httpStatusFromServiceError,
  parseMultipartUpload,
  sendJson,
} = require('./visit-drive');
const {
  LETTERHEAD_EXCHANGES_COLLECTION,
  normalizeStoredExchange,
} = require('./letterhead-exchanges');
const { stripRotaractorPrefix } = require('./member-name');

const IMAGE_UPLOAD_SESSION_COLLECTION = 'letterheadExchangeImageUploadSessions';
const IMAGE_ACCESS_SESSION_COLLECTION = 'letterheadExchangeImageAccessSessions';
const IMAGE_MAX_BYTES = 15 * 1024 * 1024;
const IMAGE_MAX_COUNT = 10;
const IMAGE_SESSION_TTL_MS = 30 * 60 * 1000;
const IMAGE_ACCESS_TTL_MS = 5 * 60 * 1000;
const FOLDER_LOCK_TTL_MS = 90 * 1000;
const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';
const DRIVE_AUTH_MODES = Object.freeze(['oauth', 'shared-drive']);
const IMAGE_MIME_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);
const IMAGE_MIME_BY_EXTENSION = Object.freeze({
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
});
const FORBIDDEN_UPLOAD_FIELDS = Object.freeze([
  'driveFileId',
  'driveFolderId',
  'driveFileUrl',
  'rootFolderId',
  'folderId',
  'appProperties',
  'uploadedBy',
  'uploaderUid',
  'sha256',
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

function normalizeDocumentId(value, fieldName, HttpsError) {
  const id = text(value, 160);
  if (!id || /[\\/]/.test(id) || hasControlCharacter(id)) {
    throw makeError(HttpsError, 'invalid-argument', `${fieldName} is invalid.`);
  }
  return id;
}

function assertAllowedFields(data, allowedFields, HttpsError, label = 'Letterhead Exchange image request') {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw makeError(HttpsError, 'invalid-argument', `${label} must be an object.`);
  }
  const unknown = Object.keys(data).find(key => !allowedFields.has(key));
  if (unknown) throw makeError(HttpsError, 'invalid-argument', `Unsupported ${label} field: ${unknown}.`);
}

function normalizeSafeFileName(value, HttpsError) {
  if (typeof value !== 'string' || hasControlCharacter(value)) {
    throw makeError(HttpsError, 'invalid-argument', 'A safe image file name is required.');
  }
  const fileName = value
    .split(/[\\/]/)
    .pop()
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180)
    .trim();
  if (!fileName || !/\.[A-Za-z0-9]{1,12}$/.test(fileName)) {
    throw makeError(HttpsError, 'invalid-argument', 'A valid JPG, PNG, or WebP image file name is required.');
  }
  return fileName;
}

function extensionForFileName(fileName) {
  const match = String(fileName || '').toLowerCase().match(/\.([a-z0-9]{1,12})$/);
  return match ? match[1] : '';
}

function normalizeImageMimeType(value, HttpsError) {
  const mimeType = cleanLower(value, 120);
  if (!IMAGE_MIME_TYPES.includes(mimeType)) {
    throw makeError(HttpsError, 'invalid-argument', 'Use a JPG, PNG, or WebP image.');
  }
  return mimeType;
}

function validateFileExtensionMatchesMime(fileName, mimeType, HttpsError) {
  const extension = extensionForFileName(fileName);
  if (IMAGE_MIME_BY_EXTENSION[extension] !== mimeType) {
    throw makeError(HttpsError, 'invalid-argument', 'Image file extension must match its file type.');
  }
}

function normalizeImageSizeBytes(value, HttpsError) {
  const sizeBytes = Number(value);
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
    throw makeError(HttpsError, 'invalid-argument', 'Image file size is required.');
  }
  if (sizeBytes > IMAGE_MAX_BYTES) {
    throw makeError(HttpsError, 'invalid-argument', 'Image must be 15 MB or smaller.');
  }
  return sizeBytes;
}

function normalizeExpectedFile(raw = {}, HttpsError) {
  assertAllowedFields(raw, new Set(['fileName', 'mimeType', 'sizeBytes']), HttpsError, 'Letterhead Exchange image file');
  const fileName = normalizeSafeFileName(raw.fileName, HttpsError);
  const mimeType = normalizeImageMimeType(raw.mimeType, HttpsError);
  validateFileExtensionMatchesMime(fileName, mimeType, HttpsError);
  return {
    fileName,
    mimeType,
    sizeBytes: normalizeImageSizeBytes(raw.sizeBytes, HttpsError),
  };
}

function normalizeFiles(value, HttpsError) {
  if (!Array.isArray(value)) {
    throw makeError(HttpsError, 'invalid-argument', 'files must be an array.');
  }
  if (!value.length) {
    throw makeError(HttpsError, 'invalid-argument', 'Select at least one image.');
  }
  if (value.length > IMAGE_MAX_COUNT) {
    throw makeError(HttpsError, 'invalid-argument', `You can attach up to ${IMAGE_MAX_COUNT} images to one exchange.`);
  }
  return value.map(file => normalizeExpectedFile(file, HttpsError));
}

function normalizeProof(value, HttpsError) {
  const proof = String(value == null ? '' : value).trim();
  if (!proof || proof.length > 240 || hasControlCharacter(proof)) {
    throw makeError(HttpsError, 'invalid-argument', 'Valid upload proof is required.');
  }
  return proof;
}

function normalizeSessionId(value, HttpsError) {
  const sessionId = text(value, 160);
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(sessionId)) {
    throw makeError(HttpsError, 'invalid-argument', 'Valid image upload session ID is required.');
  }
  return sessionId;
}

function generateProof() {
  return crypto.randomBytes(24).toString('hex');
}

function randomLockId() {
  return crypto.randomBytes(12).toString('hex');
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hashProof(proof) {
  return sha256Hex(String(proof || ''));
}

function proofMatches(proof, expectedHash) {
  const actual = Buffer.from(hashProof(proof), 'hex');
  const expected = Buffer.from(String(expectedHash || ''), 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function requestOrigin(req) {
  if (!req) return '';
  if (typeof req.get === 'function') return req.get('origin') || req.get('Origin') || '';
  return req.headers?.origin || req.headers?.Origin || '';
}

function allowedConfiguredOrigin(origin, allowedOrigins = VISIT_UPLOAD_ALLOWED_ORIGINS) {
  return Boolean(origin) && allowedOrigins.some((item) => {
    if (typeof item === 'string') return item === origin;
    if (item instanceof RegExp) return item.test(origin);
    return false;
  });
}

function setImageCorsHeaders(req, res, allowedOrigins, methods = 'POST, OPTIONS') {
  const origin = requestOrigin(req);
  res.set('Vary', 'Origin');
  if (!allowedConfiguredOrigin(origin, allowedOrigins)) return false;
  res.set('Access-Control-Allow-Origin', origin);
  res.set('Access-Control-Allow-Methods', methods);
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Max-Age', '3600');
  return true;
}

function timestampToMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const millis = Date.parse(value);
    return Number.isFinite(millis) ? millis : 0;
  }
  return 0;
}

function timestampToIso(value) {
  const millis = timestampToMillis(value);
  return millis ? new Date(millis).toISOString() : '';
}

function createTimestampFactory(admin, nowMillis) {
  return function timestamp(offsetMs = 0) {
    const millis = nowMillis() + offsetMs;
    if (admin?.firestore?.Timestamp?.fromMillis) return admin.firestore.Timestamp.fromMillis(millis);
    return new Date(millis).toISOString();
  };
}

function sniffMimeType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return '';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return '';
}

function assertImageBytes(buffer, mimeType, HttpsError) {
  if (!Buffer.isBuffer(buffer) || buffer.length <= 0) {
    throw makeError(HttpsError, 'invalid-argument', 'Image file is required.');
  }
  if (buffer.length > IMAGE_MAX_BYTES) {
    throw makeError(HttpsError, 'invalid-argument', 'Image must be 15 MB or smaller.');
  }
  if (sniffMimeType(buffer) !== mimeType) {
    throw makeError(HttpsError, 'invalid-argument', 'Uploaded image content does not match the selected image type.');
  }
}

function normalizeDriveFile(raw = {}) {
  return {
    id: text(raw.id, 300),
    name: text(raw.name, 300),
    mimeType: cleanLower(raw.mimeType, 120),
    sizeBytes: Number(raw.sizeBytes ?? raw.size) || 0,
    parents: Array.isArray(raw.parents) ? raw.parents.map(item => text(item, 300)).filter(Boolean) : [],
    appProperties: raw.appProperties && typeof raw.appProperties === 'object' ? { ...raw.appProperties } : {},
    trashed: raw.trashed === true,
  };
}

function escapeDriveQueryString(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function normalizeDriveFolderName(value, fallback = 'Letterhead Exchange') {
  const name = text(value || fallback, 160)
    .replace(/[\\/:*?"<>|\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return name || fallback;
}

function shortExchangeId(exchangeId) {
  return text(exchangeId, 160).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 8) || 'exchange';
}

function uniqueExternalClubNames(exchange = {}) {
  const seen = new Set();
  const names = [];
  for (const participant of Array.isArray(exchange.externalParticipants) ? exchange.externalParticipants : []) {
    const name = normalizeDriveFolderName(participant?.clubName, '');
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

function buildExchangeFolderName(exchangeId, exchange = {}) {
  const clubs = uniqueExternalClubNames(exchange);
  const primary = clubs[0] || 'Letterhead Exchange';
  const additional = Math.max(0, clubs.length - 1);
  const suffix = shortExchangeId(exchangeId);
  const date = text(exchange.exchangeDate, 20) || 'undated';
  const clubPart = `${primary}${additional ? ` + ${additional}` : ''}`;
  const maxClubLength = Math.max(20, 150 - date.length - suffix.length);
  return normalizeDriveFolderName(`${date} - ${clubPart.slice(0, maxClubLength).trim()} - ${suffix}`);
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
  throw error;
}

function getLetterheadExchangeDriveConfig(env = process.env) {
  const authMode = text(env.LETTERHEAD_EXCHANGES_DRIVE_AUTH_MODE || env.RESOLUTION_DRIVE_AUTH_MODE || env.VISIT_DRIVE_AUTH_MODE || 'oauth', 40).toLowerCase();
  const rootFolderId = text(env.LETTERHEAD_EXCHANGES_ROOT_FOLDER_ID, 300);
  if (!DRIVE_AUTH_MODES.includes(authMode) || !rootFolderId) {
    serviceConfigError('Letterhead Exchange image storage is not configured.');
  }
  return { authMode, rootFolderId };
}

function createLetterheadExchangeDriveService(options = {}) {
  let driveClient = options.driveClient || null;

  function getConfig() {
    return options.config || getLetterheadExchangeDriveConfig(options.env || process.env);
  }

  function getDriveClient() {
    if (!driveClient) {
      const config = getConfig();
      driveClient = createGoogleDriveClient({
        ...options,
        config: { authMode: config.authMode },
        getSecret: name => getSecretValue(options, name),
      });
    }
    return driveClient;
  }

  async function listMatchingFolders(parentId, name) {
    const query = [
      `'${escapeDriveQueryString(parentId)}' in parents`,
      `name = '${escapeDriveQueryString(name)}'`,
      `mimeType = '${DRIVE_FOLDER_MIME}'`,
      'trashed = false',
    ].join(' and ');
    const response = await getDriveClient().files.list({
      q: query,
      fields: 'files(id,name)',
      spaces: 'drive',
      pageSize: 10,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    return response.data.files || [];
  }

  async function getOrCreateUniqueFolder(parentId, rawName) {
    const name = normalizeDriveFolderName(rawName);
    const matches = await listMatchingFolders(parentId, name);
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      const error = new Error('Duplicate Letterhead Exchange Drive folders found.');
      error.code = 'failed-precondition';
      error.status = 500;
      throw error;
    }
    const response = await getDriveClient().files.create({
      requestBody: {
        name,
        mimeType: DRIVE_FOLDER_MIME,
        parents: [parentId],
      },
      fields: 'id,name',
      supportsAllDrives: true,
    });
    return response.data;
  }

  async function ensureExchangeFolder({ folderName }) {
    const config = getConfig();
    return getOrCreateUniqueFolder(config.rootFolderId, folderName);
  }

  async function uploadImageFile({ folderId, fileName, mimeType, buffer, appProperties }) {
    const response = await getDriveClient().files.create({
      requestBody: {
        name: fileName,
        mimeType,
        parents: [folderId],
        appProperties,
      },
      media: {
        mimeType,
        body: Readable.from(buffer),
      },
      fields: 'id,name,mimeType,size,parents,appProperties,trashed',
      supportsAllDrives: true,
    });
    return normalizeDriveFile(response.data);
  }

  async function getFileMetadata(fileId) {
    const response = await getDriveClient().files.get({
      fileId: text(fileId, 300),
      fields: 'id,name,mimeType,size,parents,appProperties,trashed',
      supportsAllDrives: true,
    });
    return normalizeDriveFile(response.data);
  }

  async function downloadFile(fileId) {
    const response = await getDriveClient().files.get(
      { fileId: text(fileId, 300), alt: 'media', supportsAllDrives: true },
      { responseType: 'arraybuffer' }
    );
    return Buffer.from(response.data);
  }

  return {
    ensureExchangeFolder,
    uploadImageFile,
    getFileMetadata,
    downloadFile,
  };
}

function publicImageMetadata(image = {}) {
  return {
    imageId: text(image.imageId || image.uploadSessionId, 160),
    fileName: text(image.fileName || image.originalName, 180),
    mimeType: cleanLower(image.mimeType, 120),
    sizeBytes: Number(image.sizeBytes) || 0,
    uploadedAt: timestampToIso(image.uploadedAt),
    uploadedByUid: text(image.uploadedByUid || image.uploadedBy, 160),
    uploadedByName: text(image.uploadedByName, 160),
    uploadSessionId: text(image.uploadSessionId, 160),
    storageProvider: text(image.storageProvider, 40) || 'googleDrive',
  };
}

function rawImages(exchange = {}) {
  return Array.isArray(exchange.images) ? exchange.images.slice() : [];
}

function usableExchange(data = {}) {
  const status = cleanLower(data.status || 'active', 40);
  return status === 'active';
}

function exchangeImageCount(exchange = {}) {
  return rawImages(exchange).length;
}

function uploadedFileName(exchangeId, sessionId, originalName) {
  const base = normalizeDriveFolderName(originalName, 'image');
  return `${shortExchangeId(exchangeId)}_${shortExchangeId(sessionId)}_${base}`.slice(0, 180).trim();
}

function normalizeActor(uid, role, raw = {}) {
  return {
    uid,
    role: text(role, 80),
    name: stripRotaractorPrefix(text(raw.name || raw.displayName || raw.email || uid, 160)) || uid,
  };
}

function httpStatus(error) {
  return httpStatusFromServiceError(error);
}

function createLetterheadExchangeImageService(options = {}) {
  const db = options.db;
  const admin = options.admin || {};
  const HttpsError = options.HttpsError || Error;
  const drive = options.drive || createLetterheadExchangeDriveService(options);
  const assertLetterheadExchangeAccess = options.assertLetterheadExchangeAccess;
  const getActorProfile = options.getActorProfile;
  const writeLog = options.writeLog;
  const logger = options.logger || console;
  const parseUpload = options.parseMultipartUpload || parseMultipartUpload;
  const allowedOrigins = options.allowedOrigins || VISIT_UPLOAD_ALLOWED_ORIGINS;
  const uploadEndpoint = options.uploadEndpoint || options.env?.LETTERHEAD_EXCHANGE_IMAGE_UPLOAD_ENDPOINT || 'https://us-central1-rcph-admin.cloudfunctions.net/uploadLetterheadExchangeImage';
  const downloadEndpoint = options.downloadEndpoint || options.env?.LETTERHEAD_EXCHANGE_IMAGE_DOWNLOAD_ENDPOINT || 'https://us-central1-rcph-admin.cloudfunctions.net/downloadLetterheadExchangeImage';
  const nowMillis = typeof options.nowMillis === 'function' ? options.nowMillis : () => Date.now();
  const timestamp = createTimestampFactory(admin, nowMillis);

  if (!db || typeof db.collection !== 'function') {
    throw new Error('Firestore db is required for Letterhead Exchange images.');
  }
  if (typeof assertLetterheadExchangeAccess !== 'function') {
    throw new Error('assertLetterheadExchangeAccess is required for Letterhead Exchange images.');
  }

  function exchangeRef(exchangeId) {
    return db.collection(LETTERHEAD_EXCHANGES_COLLECTION).doc(exchangeId);
  }

  function sessionRef(sessionId) {
    return db.collection(IMAGE_UPLOAD_SESSION_COLLECTION).doc(sessionId);
  }

  function accessRef(accessId) {
    return db.collection(IMAGE_ACCESS_SESSION_COLLECTION).doc(accessId);
  }

  async function requireAccess(uid, request) {
    if (!uid) throw makeError(HttpsError, 'unauthenticated', 'Sign in required.');
    const access = await assertLetterheadExchangeAccess(uid);
    const role = text(access?.role || access, 80);
    if (!role) throw makeError(HttpsError, 'permission-denied', 'Approved Letterhead Exchange access required.');
    const actorRaw = typeof getActorProfile === 'function' ? await getActorProfile(uid, request) : {};
    return {
      access: { ...(access && typeof access === 'object' ? access : {}), uid, role },
      actor: normalizeActor(uid, role, actorRaw),
    };
  }

  function readExchangeFromSnap(snap, exchangeId) {
    if (!snap?.exists) throw makeError(HttpsError, 'not-found', 'Letterhead Exchange was not found.');
    const exchange = snap.data() || {};
    if (!usableExchange(exchange)) throw makeError(HttpsError, 'failed-precondition', 'Letterhead Exchange is not active.');
    return { exchangeId, exchange };
  }

  async function loadExchange(exchangeId) {
    const snap = await exchangeRef(exchangeId).get();
    return readExchangeFromSnap(snap, exchangeId);
  }

  async function ensureDriveFolder(exchangeId, actor) {
    const ref = exchangeRef(exchangeId);
    const lockOwner = randomLockId();
    let folder = null;
    let exchangeForFolder = null;
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const { exchange } = readExchangeFromSnap(snap, exchangeId);
      if (text(exchange.driveFolderId, 300)) {
        folder = {
          id: text(exchange.driveFolderId, 300),
          name: text(exchange.driveFolderName, 220) || buildExchangeFolderName(exchangeId, exchange),
        };
        return;
      }
      const lockActive = exchange.driveFolderStatus === 'creating'
        && timestampToMillis(exchange.driveFolderLockExpiresAt) > nowMillis();
      if (lockActive) {
        throw makeError(HttpsError, 'failed-precondition', 'Letterhead Exchange image folder is being prepared. Try again shortly.');
      }
      exchangeForFolder = { ...exchange };
      tx.update(ref, {
        driveFolderStatus: 'creating',
        driveFolderLockOwner: lockOwner,
        driveFolderLockExpiresAt: timestamp(FOLDER_LOCK_TTL_MS),
      });
    });
    if (folder) return folder;

    const folderName = buildExchangeFolderName(exchangeId, exchangeForFolder);
    let createdFolder;
    try {
      createdFolder = await drive.ensureExchangeFolder({ exchangeId, exchange: exchangeForFolder, folderName });
    } catch (error) {
      await ref.set({
        driveFolderStatus: 'failed',
        driveFolderErrorCode: text(error?.code || 'drive-folder-failed', 80),
        driveFolderLockOwner: '',
        driveFolderLockExpiresAt: null,
      }, { merge: true }).catch(() => {});
      throw error;
    }

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const { exchange } = readExchangeFromSnap(snap, exchangeId);
      if (text(exchange.driveFolderId, 300)) {
        folder = {
          id: text(exchange.driveFolderId, 300),
          name: text(exchange.driveFolderName, 220) || folderName,
        };
        return;
      }
      if (exchange.driveFolderLockOwner !== lockOwner) {
        throw makeError(HttpsError, 'failed-precondition', 'Letterhead Exchange image folder setup changed. Try again.');
      }
      folder = {
        id: text(createdFolder.id, 300),
        name: normalizeDriveFolderName(createdFolder.name || folderName),
      };
      tx.update(ref, {
        driveFolderId: folder.id,
        driveFolderName: folder.name,
        driveFolderStatus: 'ready',
        driveFolderLockOwner: '',
        driveFolderLockExpiresAt: null,
        driveFolderErrorCode: '',
        updatedAt: timestamp(),
        updatedByUid: actor.uid,
        updatedByName: actor.name,
      });
    });
    return folder;
  }

  async function createUploadSession(uid, data = {}, context = {}) {
    assertAllowedFields(data, new Set(['exchangeId', 'files']), HttpsError);
    const { access, actor } = await requireAccess(uid, context.request);
    const exchangeId = normalizeDocumentId(data.exchangeId, 'exchangeId', HttpsError);
    const expectedFiles = normalizeFiles(data.files, HttpsError);
    const { exchange } = await loadExchange(exchangeId);
    const existingImageCount = exchangeImageCount(exchange);
    if (existingImageCount + expectedFiles.length > IMAGE_MAX_COUNT) {
      throw makeError(HttpsError, 'resource-exhausted', `A Letterhead Exchange can have at most ${IMAGE_MAX_COUNT} images.`);
    }
    const folder = await ensureDriveFolder(exchangeId, actor);
    const refs = expectedFiles.map(() => db.collection(IMAGE_UPLOAD_SESSION_COLLECTION).doc());
    const proofPairs = expectedFiles.map(() => generateProof());
    const createdAt = timestamp();
    const expiresAt = timestamp(IMAGE_SESSION_TTL_MS);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(exchangeRef(exchangeId));
      const { exchange: freshExchange } = readExchangeFromSnap(snap, exchangeId);
      if (exchangeImageCount(freshExchange) + expectedFiles.length > IMAGE_MAX_COUNT) {
        throw makeError(HttpsError, 'resource-exhausted', `A Letterhead Exchange can have at most ${IMAGE_MAX_COUNT} images.`);
      }
      expectedFiles.forEach((expected, index) => {
        tx.set(refs[index], {
          uid,
          actorRole: access.role,
          exchangeId,
          status: 'pending',
          expected,
          proofHash: hashProof(proofPairs[index]),
          driveFileId: '',
          driveFolderId: folder.id,
          driveFolderName: folder.name,
          sha256: '',
          createdAt,
          updatedAt: createdAt,
          expiresAt,
          uploadedAt: null,
          finalizedAt: null,
          errorCode: '',
        });
      });
    });
    if (typeof writeLog === 'function') {
      await writeLog({
        uid,
        request: context.request,
        authority: access,
        actor,
        exchangeId,
        action: 'image_upload_session_created',
        metadata: {
          requestedImageCount: expectedFiles.length,
          existingImageCount,
          pendingImageCount: refs.length,
          totalSizeBytes: expectedFiles.reduce((sum, file) => sum + file.sizeBytes, 0),
          mimeTypes: Array.from(new Set(expectedFiles.map(file => file.mimeType))).sort(),
        },
      });
    }
    return {
      ok: true,
      exchangeId,
      uploadEndpoint,
      maxSizeBytes: IMAGE_MAX_BYTES,
      maxImages: IMAGE_MAX_COUNT,
      expiresAt: timestampToIso(expiresAt),
      sessions: refs.map((ref, index) => ({
        sessionId: ref.id,
        proof: proofPairs[index],
        fileName: expectedFiles[index].fileName,
        mimeType: expectedFiles[index].mimeType,
        sizeBytes: expectedFiles[index].sizeBytes,
        expiresAt: timestampToIso(expiresAt),
      })),
    };
  }

  function normalizeUploadFields(fields = {}) {
    const forbidden = FORBIDDEN_UPLOAD_FIELDS.filter(field => text(fields[field], 1000));
    if (forbidden.length) {
      throw makeError(HttpsError, 'invalid-argument', 'Drive destination and file metadata must be selected by the trusted server.');
    }
    const metadata = {
      exchangeId: normalizeDocumentId(fields.exchangeId, 'exchangeId', HttpsError),
      sessionId: normalizeSessionId(fields.sessionId, HttpsError),
      proof: normalizeProof(fields.proof, HttpsError),
      ...normalizeExpectedFile({
        fileName: fields.fileName,
        mimeType: fields.mimeType,
        sizeBytes: fields.sizeBytes,
      }, HttpsError),
    };
    return metadata;
  }

  function metadataMatches(session, metadata) {
    const expected = session.expected || {};
    return session.exchangeId === metadata.exchangeId
      && expected.fileName === metadata.fileName
      && expected.mimeType === metadata.mimeType
      && Number(expected.sizeBytes) === Number(metadata.sizeBytes);
  }

  async function markUploadFailed(sessionId, code) {
    if (!sessionId) return;
    await sessionRef(sessionId).set({
      status: 'failed',
      errorCode: text(code || 'image-upload-failed', 80),
      updatedAt: timestamp(),
    }, { merge: true }).catch(() => {});
  }

  async function reserveSessionForUpload(metadata) {
    const ref = sessionRef(metadata.sessionId);
    let sessionData = null;
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw makeError(HttpsError, 'not-found', 'Image upload session was not found.');
      const session = snap.data() || {};
      if (session.status !== 'pending') {
        throw makeError(HttpsError, 'already-exists', 'Image upload session was already used.');
      }
      if (timestampToMillis(session.expiresAt) <= nowMillis()) {
        throw makeError(HttpsError, 'failed-precondition', 'Image upload session expired.');
      }
      if (!proofMatches(metadata.proof, session.proofHash)) {
        throw makeError(HttpsError, 'permission-denied', 'Image upload session is invalid.');
      }
      if (!metadataMatches(session, metadata)) {
        throw makeError(HttpsError, 'failed-precondition', 'Selected image does not match the upload session.');
      }
      sessionData = { ...session, sessionId: metadata.sessionId };
      tx.update(ref, {
        status: 'uploading',
        updatedAt: timestamp(),
      });
    });
    return sessionData;
  }

  function assertDriveMetadata(file, session) {
    const expected = session.expected || {};
    const props = file?.appProperties || {};
    if (
      !file?.id
      || file.trashed
      || file.id !== session.driveFileId
      || file.mimeType !== expected.mimeType
      || Number(file.sizeBytes) !== Number(expected.sizeBytes)
      || !file.parents.includes(session.driveFolderId)
      || props.documentType !== 'letterhead-exchange-image'
      || props.exchangeId !== session.exchangeId
      || props.uploadSessionId !== session.sessionId
      || props.uploaderUid !== session.uid
      || props.sha256 !== session.sha256
    ) {
      throw makeError(HttpsError, 'failed-precondition', 'Uploaded image metadata does not match the approved session.');
    }
  }

  async function uploadHttp(req, res) {
    const corsAllowed = setImageCorsHeaders(req, res, allowedOrigins);
    if (req.method === 'OPTIONS') {
      return corsAllowed
        ? res.status(204).send('')
        : sendJson(res, 403, { ok: false, code: 'permission-denied', message: 'Origin is not allowed.' });
    }
    if (!corsAllowed) {
      return sendJson(res, 403, { ok: false, code: 'permission-denied', message: 'Origin is not allowed.' });
    }
    if (req.method !== 'POST') {
      res.set('Allow', 'POST, OPTIONS');
      return sendJson(res, 405, { ok: false, code: 'method-not-allowed', message: 'POST required.' });
    }
    let metadata = null;
    let reservedSessionId = '';
    try {
      const parsed = await parseUpload(req, { maxBytes: IMAGE_MAX_BYTES });
      metadata = normalizeUploadFields(parsed.fields);
      const file = parsed.file || {};
      if (file.sizeBytes !== metadata.sizeBytes || file.buffer?.length !== metadata.sizeBytes) {
        throw makeError(HttpsError, 'invalid-argument', 'Uploaded image size does not match the approved session.');
      }
      if (file.mimeType && cleanLower(file.mimeType, 120) !== metadata.mimeType) {
        throw makeError(HttpsError, 'invalid-argument', 'Uploaded image type does not match the approved session.');
      }
      assertImageBytes(file.buffer, metadata.mimeType, HttpsError);
      const session = await reserveSessionForUpload(metadata);
      reservedSessionId = metadata.sessionId;
      const contentHash = sha256Hex(file.buffer);
      const appProperties = {
        documentType: 'letterhead-exchange-image',
        exchangeId: metadata.exchangeId,
        uploadSessionId: metadata.sessionId,
        uploaderUid: session.uid,
        sha256: contentHash,
      };
      const driveFile = await drive.uploadImageFile({
        folderId: session.driveFolderId,
        fileName: uploadedFileName(metadata.exchangeId, metadata.sessionId, metadata.fileName),
        mimeType: metadata.mimeType,
        buffer: file.buffer,
        appProperties,
      });
      const uploadedAt = timestamp();
      await sessionRef(metadata.sessionId).update({
        status: 'uploaded',
        driveFileId: driveFile.id,
        sha256: contentHash,
        uploadedAt,
        updatedAt: uploadedAt,
      });
      return sendJson(res, 200, {
        ok: true,
        sessionId: metadata.sessionId,
        uploaded: {
          fileName: metadata.fileName,
          mimeType: metadata.mimeType,
          sizeBytes: metadata.sizeBytes,
          uploadedAt: timestampToIso(uploadedAt),
        },
      });
    } catch (error) {
      if (reservedSessionId) await markUploadFailed(reservedSessionId, error?.code || 'image-upload-failed');
      logger.warn('Letterhead Exchange image upload rejected.', {
        code: error?.code || error?.httpsCode || 'image-upload-failed',
        sessionId: metadata?.sessionId || null,
      });
      return sendJson(res, httpStatus(error), {
        ok: false,
        code: error?.code || error?.httpsCode || 'image-upload-failed',
        message: error?.message || 'Image upload failed.',
      });
    }
  }

  async function verifyUploadedSession(session) {
    const file = await drive.getFileMetadata(session.driveFileId);
    assertDriveMetadata(file, session);
    return file;
  }

  function imageAlreadyFinalized(images, sessionId) {
    return images.find(image => text(image.uploadSessionId || image.imageId, 160) === sessionId) || null;
  }

  async function finalizeUpload(uid, data = {}, context = {}) {
    assertAllowedFields(data, new Set(['exchangeId', 'sessionId']), HttpsError);
    const { access, actor } = await requireAccess(uid, context.request);
    const exchangeId = normalizeDocumentId(data.exchangeId, 'exchangeId', HttpsError);
    const sessionId = normalizeSessionId(data.sessionId, HttpsError);
    const initialSessionSnap = await sessionRef(sessionId).get();
    if (!initialSessionSnap.exists) throw makeError(HttpsError, 'not-found', 'Image upload session was not found.');
    const initialSession = { ...initialSessionSnap.data(), sessionId };
    if (initialSession.status === 'uploaded') {
      if (timestampToMillis(initialSession.expiresAt) <= nowMillis()) {
        throw makeError(HttpsError, 'failed-precondition', 'Image upload session expired.');
      }
      await verifyUploadedSession(initialSession);
    }

    let response;
    await db.runTransaction(async (tx) => {
      const exchangeSnap = await tx.get(exchangeRef(exchangeId));
      const { exchange } = readExchangeFromSnap(exchangeSnap, exchangeId);
      const sessionSnap = await tx.get(sessionRef(sessionId));
      if (!sessionSnap.exists) throw makeError(HttpsError, 'not-found', 'Image upload session was not found.');
      const session = { ...sessionSnap.data(), sessionId };
      if (session.exchangeId !== exchangeId) {
        throw makeError(HttpsError, 'failed-precondition', 'Image upload session does not belong to this exchange.');
      }
      if (session.uid !== uid) {
        throw makeError(HttpsError, 'permission-denied', 'Image upload session belongs to another user.');
      }
      const images = rawImages(exchange);
      const finalized = imageAlreadyFinalized(images, sessionId);
      if (session.status === 'finalized' && finalized) {
        response = {
          ok: true,
          unchanged: true,
          exchange: normalizeStoredExchange(exchangeId, exchange),
          image: publicImageMetadata(finalized),
        };
        return;
      }
      if (session.status !== 'uploaded') {
        throw makeError(HttpsError, 'failed-precondition', 'Image upload is not ready to finalize.');
      }
      if (timestampToMillis(session.expiresAt) <= nowMillis()) {
        throw makeError(HttpsError, 'failed-precondition', 'Image upload session expired.');
      }
      if (finalized) {
        tx.update(sessionRef(sessionId), {
          status: 'finalized',
          finalizedAt: timestamp(),
          updatedAt: timestamp(),
        });
        response = {
          ok: true,
          unchanged: true,
          exchange: normalizeStoredExchange(exchangeId, exchange),
          image: publicImageMetadata(finalized),
        };
        return;
      }
      if (images.length >= IMAGE_MAX_COUNT) {
        throw makeError(HttpsError, 'resource-exhausted', `A Letterhead Exchange can have at most ${IMAGE_MAX_COUNT} images.`);
      }
      const now = timestamp();
      const readyImage = {
        imageId: sessionId,
        storageProvider: 'googleDrive',
        driveFileId: session.driveFileId,
        fileName: session.expected.fileName,
        mimeType: session.expected.mimeType,
        sizeBytes: session.expected.sizeBytes,
        sha256: session.sha256,
        uploadedAt: session.uploadedAt || now,
        uploadedByUid: session.uid,
        uploadedByName: actor.name,
        uploadSessionId: sessionId,
      };
      const nextImages = images.concat(readyImage);
      const exchangePatch = {
        images: nextImages,
        imageCount: nextImages.length,
        updatedAt: now,
        updatedByUid: uid,
        updatedByName: actor.name,
      };
      tx.update(exchangeRef(exchangeId), exchangePatch);
      tx.update(sessionRef(sessionId), {
        status: 'finalized',
        finalizedAt: now,
        updatedAt: now,
      });
      response = {
        ok: true,
        unchanged: false,
        exchange: normalizeStoredExchange(exchangeId, { ...exchange, ...exchangePatch }),
        image: publicImageMetadata(readyImage),
      };
    });
    if (!response.unchanged && typeof writeLog === 'function') {
      await writeLog({
        uid,
        request: context.request,
        authority: access,
        actor,
        exchangeId,
        action: 'image_uploaded',
        metadata: {
          imageCountAdded: 1,
          newImageCount: response.exchange.imageCount,
          mimeType: response.image.mimeType,
          sizeBytes: response.image.sizeBytes,
        },
      });
    }
    return response;
  }

  function findRawImage(exchange, imageId) {
    const id = text(imageId, 160);
    return rawImages(exchange).find(image => text(image.imageId || image.uploadSessionId, 160) === id) || null;
  }

  async function getImageAccess(uid, data = {}, context = {}) {
    assertAllowedFields(data, new Set(['exchangeId', 'imageId']), HttpsError);
    await requireAccess(uid, context.request);
    const exchangeId = normalizeDocumentId(data.exchangeId, 'exchangeId', HttpsError);
    const imageId = normalizeSessionId(data.imageId, HttpsError);
    const { exchange } = await loadExchange(exchangeId);
    const image = findRawImage(exchange, imageId);
    if (!image || !text(image.driveFileId, 300)) {
      throw makeError(HttpsError, 'not-found', 'Letterhead Exchange image was not found.');
    }
    const proof = generateProof();
    const createdAt = timestamp();
    const expiresAt = timestamp(IMAGE_ACCESS_TTL_MS);
    const ref = db.collection(IMAGE_ACCESS_SESSION_COLLECTION).doc();
    await ref.set({
      uid,
      exchangeId,
      imageId,
      driveFileId: text(image.driveFileId, 300),
      fileName: text(image.fileName, 180),
      mimeType: cleanLower(image.mimeType, 120),
      sizeBytes: Number(image.sizeBytes) || 0,
      sha256: text(image.sha256, 80),
      proofHash: hashProof(proof),
      status: 'active',
      createdAt,
      expiresAt,
    });
    return {
      ok: true,
      exchangeId,
      image: publicImageMetadata(image),
      accessId: ref.id,
      proof,
      downloadEndpoint,
      expiresAt: timestampToIso(expiresAt),
    };
  }

  async function downloadImageHttp(req, res) {
    const method = String(req.method || 'GET').toUpperCase();
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'no-referrer');
    if (method === 'OPTIONS') {
      const corsAllowed = setImageCorsHeaders(req, res, allowedOrigins, 'GET, HEAD, OPTIONS');
      return corsAllowed
        ? res.status(204).send('')
        : sendJson(res, 403, { ok: false, code: 'permission-denied', message: 'Origin is not allowed.' });
    }
    if (!['GET', 'HEAD'].includes(method)) {
      res.set('Allow', 'GET, HEAD, OPTIONS');
      return sendJson(res, 405, { ok: false, code: 'method-not-allowed', message: 'Use GET to load this image.' });
    }
    const origin = requestOrigin(req);
    if (origin) {
      const corsAllowed = setImageCorsHeaders(req, res, allowedOrigins, 'GET, HEAD, OPTIONS');
      if (!corsAllowed) return sendJson(res, 403, { ok: false, code: 'permission-denied', message: 'Origin is not allowed.' });
    }
    try {
      const accessId = normalizeSessionId(req.query?.accessId, HttpsError);
      const proof = normalizeProof(req.query?.proof, HttpsError);
      const snap = await accessRef(accessId).get();
      if (!snap.exists) throw makeError(HttpsError, 'not-found', 'Image access link was not found.');
      const access = snap.data() || {};
      if (access.status !== 'active' || timestampToMillis(access.expiresAt) <= nowMillis()) {
        throw makeError(HttpsError, 'failed-precondition', 'Image access link expired.');
      }
      if (!proofMatches(proof, access.proofHash)) {
        throw makeError(HttpsError, 'permission-denied', 'Image access link is invalid.');
      }
      const file = await drive.getFileMetadata(access.driveFileId);
      if (
        file.trashed
        || file.id !== access.driveFileId
        || file.mimeType !== access.mimeType
        || Number(file.sizeBytes) !== Number(access.sizeBytes)
      ) {
        throw makeError(HttpsError, 'failed-precondition', 'Letterhead Exchange image metadata is invalid.');
      }
      const buffer = await drive.downloadFile(access.driveFileId);
      if (
        !Buffer.isBuffer(buffer)
        || buffer.length !== Number(access.sizeBytes)
        || buffer.length > IMAGE_MAX_BYTES
        || sniffMimeType(buffer) !== access.mimeType
        || (access.sha256 && sha256Hex(buffer) !== access.sha256)
      ) {
        throw makeError(HttpsError, 'failed-precondition', 'Letterhead Exchange image content is invalid.');
      }
      res.set('Content-Type', access.mimeType);
      res.set('Content-Length', String(buffer.length));
      res.set('Content-Disposition', `inline; filename="${text(access.fileName, 180).replace(/"/g, '')}"`);
      res.set('Cache-Control', 'private, no-store, max-age=0');
      if (method === 'HEAD') return res.status(200).send('');
      return res.status(200).send(buffer);
    } catch (error) {
      logger.warn('Letterhead Exchange image access rejected.', { code: error?.code || error?.httpsCode || 'image-access-failed' });
      return sendJson(res, httpStatus(error), {
        ok: false,
        code: error?.code || error?.httpsCode || 'image-access-failed',
        message: error?.message || 'Image could not be loaded.',
      });
    }
  }

  return {
    createUploadSession,
    uploadHttp,
    finalizeUpload,
    getImageAccess,
    downloadImageHttp,
  };
}

module.exports = {
  IMAGE_UPLOAD_SESSION_COLLECTION,
  IMAGE_ACCESS_SESSION_COLLECTION,
  IMAGE_MAX_BYTES,
  IMAGE_MAX_COUNT,
  IMAGE_SESSION_TTL_MS,
  IMAGE_ACCESS_TTL_MS,
  FOLDER_LOCK_TTL_MS,
  IMAGE_MIME_TYPES,
  getLetterheadExchangeDriveConfig,
  buildExchangeFolderName,
  normalizeExpectedFile,
  sniffMimeType,
  proofMatches,
  createLetterheadExchangeDriveService,
  createLetterheadExchangeImageService,
};
