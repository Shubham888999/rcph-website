'use strict';

const crypto = require('crypto');
const { Readable } = require('stream');
const {
  parseMultipartUpload: defaultParseMultipartUpload,
  createGoogleDriveClient,
} = require('./visit-drive');
const {
  DEFAULT_BOARD_ID,
  BOARDS_COLLECTION,
  SETTINGS_COLLECTION,
  PUBLIC_SETTINGS_DOC,
  CLUB_BOARD_SECTION,
  LEADERSHIP_SECTION,
  SECTION_KEYS,
  PHOTO_MAX_BYTES,
  PHOTO_MIME_TYPES,
  normalizeStoredPhoto,
  adminSafePhoto,
  profileHasReadyPhoto,
  nextPhotoVersion,
  previousPhotoSummary,
  normalizeStoredProfile,
  normalizeBoardData,
  normalizeSettingData,
  validateBoardId,
  validateSectionKey,
  validateRevision,
  validateProfileId,
  auditPayload,
} = require('./bod-management');

const SESSION_COLLECTION = 'bodProfilePhotoUploadSessions';
const RATE_LIMIT_COLLECTION = 'bodProfilePhotoUploadRateLimits';
const SESSION_TTL_MS = 30 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_COUNT = 12;
const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;
const CLEANUP_LIMIT = 25;
const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';
const SECTION_FOLDER_NAMES = Object.freeze({
  [CLUB_BOARD_SECTION]: 'Club Board',
  [LEADERSHIP_SECTION]: 'Leadership Beyond Our Club',
});
const ALLOWED_ORIGINS = Object.freeze([
  'https://rcph3131.org',
  'https://www.rcph3131.org',
  'https://rcph-admin.web.app',
  'https://rcph-admin.firebaseapp.com',
  'http://localhost:5000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
]);
const MULTIPART_FIELDS = new Set([
  'sessionId',
  'proof',
  'boardId',
  'profileId',
  'sectionKey',
  'fileName',
  'mimeType',
  'sizeBytes',
]);
const FORBIDDEN_FIELDS = new Set([
  'driveFileId',
  'driveFolderId',
  'driveFileUrl',
  'rootFolderId',
  'folderId',
  'photoVersion',
  'photoVersionCandidate',
  'uploadedBy',
  'uploaderUid',
  'sha256',
  'appProperties',
]);

function makeError(HttpsError, code, message, details) {
  return new HttpsError(code, message, details);
}

function text(value, max = 500) {
  return String(value == null ? '' : value).trim().replace(/\s+/g, ' ').slice(0, max);
}

function hasControlCharacter(value) {
  return /[\x00-\x1F\x7F]/.test(String(value || ''));
}

function normalizeSafeFileName(value, HttpsError) {
  if (typeof value !== 'string' || hasControlCharacter(value) || /[\\/]/.test(value)) {
    throw makeError(HttpsError, 'invalid-argument', 'A safe photo file name is required.');
  }
  const fileName = value.trim().replace(/\s+/g, ' ');
  if (!fileName || fileName.length > 180) {
    throw makeError(HttpsError, 'invalid-argument', 'Photo file name must be 180 characters or fewer.');
  }
  return fileName;
}

function normalizeMimeType(value, HttpsError) {
  const mimeType = text(value, 120).toLowerCase();
  if (!PHOTO_MIME_TYPES.includes(mimeType)) {
    throw makeError(HttpsError, 'invalid-argument', 'Use a JPEG, PNG, or WebP image.');
  }
  return mimeType;
}

function normalizeSizeBytes(value, HttpsError) {
  const sizeBytes = Number(value);
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
    throw makeError(HttpsError, 'invalid-argument', 'Photo file size is required.');
  }
  if (sizeBytes > PHOTO_MAX_BYTES) {
    throw makeError(HttpsError, 'invalid-argument', 'Photo must be 5 MB or smaller.');
  }
  return sizeBytes;
}

function normalizeSessionId(value, HttpsError) {
  const sessionId = text(value, 160);
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(sessionId)) {
    throw makeError(HttpsError, 'invalid-argument', 'Valid upload session ID is required.');
  }
  return sessionId;
}

function normalizeProof(value, HttpsError) {
  const proof = String(value == null ? '' : value).trim();
  if (!proof || proof.length > 240 || hasControlCharacter(proof)) {
    throw makeError(HttpsError, 'invalid-argument', 'Valid upload proof is required.');
  }
  return proof;
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hashProof(proof) {
  return crypto.createHash('sha256').update(String(proof || ''), 'utf8').digest('hex');
}

function proofMatches(proof, expectedHash) {
  const actual = Buffer.from(hashProof(proof), 'hex');
  const expected = Buffer.from(String(expectedHash || ''), 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
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
    throw makeError(HttpsError, 'invalid-argument', 'Photo file is required.');
  }
  if (buffer.length > PHOTO_MAX_BYTES) {
    throw makeError(HttpsError, 'invalid-argument', 'Photo must be 5 MB or smaller.');
  }
  const detected = sniffMimeType(buffer);
  if (detected !== mimeType) {
    throw makeError(HttpsError, 'invalid-argument', 'Uploaded photo content does not match the selected image type.');
  }
}

function timestampToMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const millis = new Date(value).getTime();
    return Number.isNaN(millis) ? 0 : millis;
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

function normalizeDriveFile(raw = {}) {
  return {
    id: text(raw.id, 300),
    name: text(raw.name, 300),
    mimeType: text(raw.mimeType, 120).toLowerCase(),
    sizeBytes: Number(raw.sizeBytes ?? raw.size) || 0,
    parents: Array.isArray(raw.parents) ? raw.parents.map((item) => text(item, 300)).filter(Boolean) : [],
    appProperties: raw.appProperties && typeof raw.appProperties === 'object' ? { ...raw.appProperties } : {},
    trashed: raw.trashed === true,
  };
}

function escapeDriveQueryString(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function normalizeFolderName(value, fallback = 'Folder') {
  const name = text(value || fallback, 160)
    .replace(/[\\/:*?"<>|\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return name || fallback;
}

function getSecretValue(options, name) {
  const boundSecret = options.secrets?.[name];
  if (boundSecret && typeof boundSecret.value === 'function') return boundSecret.value();
  if (typeof options.getSecret === 'function') return options.getSecret(name);
  return (options.env || process.env)[name];
}

function getBodPhotoDriveConfig(env = process.env) {
  const authMode = text(env.BOD_PHOTO_DRIVE_AUTH_MODE || env.RESOLUTION_DRIVE_AUTH_MODE || env.VISIT_DRIVE_AUTH_MODE || 'oauth', 40).toLowerCase();
  const rootFolderId = text(env.BOD_PHOTO_ROOT_FOLDER_ID, 300);
  if (!['oauth', 'shared-drive'].includes(authMode) || !rootFolderId) {
    const err = new Error('BOD photo storage is not configured.');
    err.code = 'failed-precondition';
    err.status = 500;
    throw err;
  }
  return { authMode, rootFolderId };
}

function boardFolderName(boardId) {
  const match = String(boardId || '').match(/^riy-(\d{4})-(\d{2})$/);
  return match ? `RIY ${match[1]}-${match[2]}` : normalizeFolderName(boardId, 'RIY Board');
}

function versionedFileName(profileId, version, originalName) {
  return `${profileId}_v${String(version).padStart(3, '0')}_${originalName}`;
}

function createBodPhotoDriveService(options = {}) {
  let driveClient = options.driveClient || null;

  function getConfig() {
    return options.config || getBodPhotoDriveConfig(options.env || process.env);
  }

  function getDriveClient() {
    if (!driveClient) {
      const config = getConfig();
      driveClient = createGoogleDriveClient({
        ...options,
        config: { authMode: config.authMode },
        getSecret: (name) => getSecretValue(options, name),
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
    const name = normalizeFolderName(rawName);
    const matches = await listMatchingFolders(parentId, name);
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      const err = new Error('Duplicate BOD photo Drive folders found.');
      err.code = 'failed-precondition';
      err.status = 500;
      throw err;
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

  async function ensureProfileFolder({ boardId, sectionKey, profileId }) {
    const config = getConfig();
    const riyFolder = await getOrCreateUniqueFolder(config.rootFolderId, boardFolderName(boardId));
    const sectionFolder = await getOrCreateUniqueFolder(riyFolder.id, SECTION_FOLDER_NAMES[sectionKey] || sectionKey);
    const profileFolder = await getOrCreateUniqueFolder(sectionFolder.id, profileId);
    return {
      rootFolderId: config.rootFolderId,
      riyFolderId: riyFolder.id,
      sectionFolderId: sectionFolder.id,
      profileFolderId: profileFolder.id,
    };
  }

  async function uploadPhotoFile({ folderId, fileName, mimeType, buffer, appProperties }) {
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

async function findPublishedPhotoFile({
  boardId,
  sectionKey,
  profileId,
  photoVersion,
}) {
  const propertyFilters = {
    documentType: 'bod-profile-photo',
    boardId,
    sectionKey,
    profileId,
    photoVersionCandidate: String(photoVersion),
  };

  const query = [
    ...Object.entries(propertyFilters).map(
      ([key, value]) =>
        `appProperties has { key='${escapeDriveQueryString(key)}' and value='${escapeDriveQueryString(value)}' }`
    ),
    'trashed = false',
  ].join(' and ');

  const response = await getDriveClient().files.list({
    q: query,
    fields: 'files(id,name,mimeType,size,parents,appProperties,trashed)',
    spaces: 'drive',
    pageSize: 10,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const files = (response.data.files || []).map(normalizeDriveFile);

  if (files.length > 1) {
    const error = new Error(
      'Duplicate published BOD photo versions were found.'
    );
    error.code = 'failed-precondition';
    error.status = 500;
    throw error;
  }

  return files[0] || null;
}
async function downloadFile(fileId) {
  const normalizedFileId = text(fileId, 300);

  if (!normalizedFileId) {
    const error = new Error('Drive file ID is required.');
    error.code = 'not-found';
    error.status = 404;
    throw error;
  }

  const response = await getDriveClient().files.get(
    {
      fileId: normalizedFileId,
      alt: 'media',
      supportsAllDrives: true,
    },
    {
      responseType: 'arraybuffer',
    }
  );

  return Buffer.from(response.data);
}

  async function deleteFile(fileId) {
    if (!text(fileId, 300)) return;
    await getDriveClient().files.delete({
      fileId: text(fileId, 300),
      supportsAllDrives: true,
    });
  }

return {
  ensureProfileFolder,
  uploadPhotoFile,
  getFileMetadata,
  findPublishedPhotoFile,
  downloadFile,
  deleteFile,
};
}

function originAllowed(origin, allowedOrigins) {
  if (!origin) return false;
  return allowedOrigins.some((entry) => (
    typeof entry === 'string' ? entry === origin : entry?.test?.(origin)
  ));
}

function setCors(req, res, allowedOrigins) {
  const origin = String(req.get?.('origin') || req.headers?.origin || '');
  res.set('Vary', 'Origin');
  if (!originAllowed(origin, allowedOrigins)) return false;
  res.set('Access-Control-Allow-Origin', origin);
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Max-Age', '3600');
  return true;
}

function sendJson(res, status, payload) {
  return res.status(status).set('Cache-Control', 'no-store').json(payload);
}

function httpStatus(error) {
  if (Number.isInteger(error?.status)) return error.status;
  const map = {
    'invalid-argument': 400,
    unauthenticated: 401,
    'permission-denied': 403,
    'not-found': 404,
    'already-exists': 409,
    aborted: 409,
    'failed-precondition': 412,
    'resource-exhausted': 429,
    internal: 500,
  };
  return map[error?.code || error?.httpsCode] || 500;
}

function assertAllowedFields(input, allowed, HttpsError) {
  const unknown = Object.keys(input || {}).filter((key) => !allowed.has(key));
  if (unknown.length) {
    throw makeError(HttpsError, 'invalid-argument', `Unsupported BOD photo field: ${unknown[0]}.`);
  }
}

function normalizeUploadRequestFields(fields, HttpsError) {
  const supplied = fields && typeof fields === 'object' ? fields : {};
  const unknown = Object.keys(supplied).filter((key) => !MULTIPART_FIELDS.has(key));
  const forbidden = Object.keys(supplied).filter((key) => FORBIDDEN_FIELDS.has(key));
  if (unknown.length || forbidden.length) {
    throw makeError(HttpsError, 'invalid-argument', 'Upload destination and Drive metadata must be selected by the trusted server.');
  }
  return {
    sessionId: normalizeSessionId(supplied.sessionId, HttpsError),
    proof: normalizeProof(supplied.proof, HttpsError),
    boardId: validateBoardId(supplied.boardId, HttpsError),
    profileId: validateProfileId(supplied.profileId, HttpsError),
    sectionKey: validateSectionKey(supplied.sectionKey, HttpsError),
    fileName: normalizeSafeFileName(supplied.fileName, HttpsError),
    mimeType: normalizeMimeType(supplied.mimeType, HttpsError),
    sizeBytes: normalizeSizeBytes(supplied.sizeBytes, HttpsError),
  };
}

function metadataMatches(session, metadata) {
  const expected = session.expected || {};
  return session.boardId === metadata.boardId
    && session.profileId === metadata.profileId
    && session.sectionKey === metadata.sectionKey
    && expected.fileName === metadata.fileName
    && expected.mimeType === metadata.mimeType
    && Number(expected.sizeBytes) === metadata.sizeBytes;
}

function safeUploadedResponse(session, uploadedAt) {
  return {
    status: 'uploaded',
    mimeType: session.expected.mimeType,
    originalName: session.expected.fileName,
    sizeBytes: session.expected.sizeBytes,
    width: null,
    height: null,
    versionCandidate: session.versionCandidate,
    uploadedAt: timestampToIso(uploadedAt),
  };
}

function createBodPhotoUploadService(options = {}) {
  const {
    db,
    admin,
    HttpsError,
    bodManagement,
    logger = console,
  } = options;
  if (!db || !admin || !HttpsError || !bodManagement?.assertBodManagementAuthority) {
    throw new TypeError('BOD photo upload service dependencies are required.');
  }
  const nowMillis = options.nowMillis || (() => Date.now());
  const timestamp = createTimestampFactory(admin, nowMillis);
  const parseMultipartUpload = options.parseMultipartUpload || defaultParseMultipartUpload;
  const drive = options.drive || createBodPhotoDriveService(options);
  const allowedOrigins = options.allowedOrigins || ALLOWED_ORIGINS;
  const uploadEndpoint = options.uploadEndpoint || options.env?.BOD_PHOTO_UPLOAD_ENDPOINT || 'https://us-central1-rcph-admin.cloudfunctions.net/uploadBodProfilePhoto';
  const randomBytes = options.randomBytes || ((size) => crypto.randomBytes(size));

  const settingRef = () => db.collection(SETTINGS_COLLECTION).doc(PUBLIC_SETTINGS_DOC);
  const boardRef = (boardId) => db.collection(BOARDS_COLLECTION).doc(boardId);
  const profileRef = (boardId, profileId) => boardRef(boardId).collection('profiles').doc(profileId);
  const sessionRef = (sessionId) => db.collection(SESSION_COLLECTION).doc(sessionId);
  const rateLimitRef = (uid) => db.collection(RATE_LIMIT_COLLECTION).doc(sha256Hex(String(uid || '')));

  function generateProof() {
    return randomBytes(32).toString('base64url');
  }

  async function requireActiveBoard(tx, boardId) {
    if (boardId !== DEFAULT_BOARD_ID) {
      throw makeError(HttpsError, 'failed-precondition', 'BOD Management can only manage the active RIY board.');
    }
    const [settingSnap, boardSnap] = await Promise.all([
      tx.get(settingRef()),
      tx.get(boardRef(boardId)),
    ]);
    if (!settingSnap.exists || !boardSnap.exists) {
      throw makeError(HttpsError, 'failed-precondition', 'Initialize BOD Management before uploading photos.');
    }
    const setting = normalizeSettingData(settingSnap.data() || {}, HttpsError);
    if (setting.activeBoardId !== boardId) {
      throw makeError(HttpsError, 'failed-precondition', 'Refresh BOD Management before uploading photos.');
    }
    const board = normalizeBoardData(boardSnap.data() || {}, { expectedBoardId: boardId, HttpsError });
    return { activeBoardRef: boardRef(boardId), board };
  }

  function assertSectionRevision(board, sectionKey, expectedDraftRevision) {
    const section = board.sections[sectionKey];
    if (!section || section.draftRevision !== expectedDraftRevision) {
      throw makeError(HttpsError, 'aborted', 'BOD Management changed. Refresh before saving.');
    }
    return section;
  }

  async function loadStoredProfile(tx, boardId, profileId) {
    const ref = profileRef(boardId, profileId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw makeError(HttpsError, 'not-found', 'BOD profile was not found.');
    const raw = snap.data() || {};
    const adminProfile = normalizeStoredProfile(profileId, raw, HttpsError);
    return {
      ref,
      raw,
      adminProfile,
      storedPhoto: normalizeStoredPhoto(raw.photo, HttpsError),
    };
  }

  function publishedPhotoNotFound() {
  return makeError(
    HttpsError,
    'not-found',
    'Published BOD photo was not found.'
  );
}

function normalizePublishedPhotoVersion(value) {
  if (
    Array.isArray(value)
    || typeof value === 'object'
    || value === null
    || value === undefined
  ) {
    throw makeError(
      HttpsError,
      'invalid-argument',
      'A valid published photo version is required.'
    );
  }

  const raw = String(value).trim();

  if (!/^[1-9]\d{0,9}$/.test(raw)) {
    throw makeError(
      HttpsError,
      'invalid-argument',
      'A valid published photo version is required.'
    );
  }

  const version = Number(raw);

  if (!Number.isSafeInteger(version) || version < 1) {
    throw makeError(
      HttpsError,
      'invalid-argument',
      'A valid published photo version is required.'
    );
  }

  return version;
}


function assertPublishedDriveFile({
  file,
  boardId,
  sectionKey,
  profileId,
  photoVersion,
  photoMimeType,
}) {
  const properties = file?.appProperties || {};
  const sha256 = String(properties.sha256 || '');

  const valid = (
    file
    && file.trashed !== true
    && file.mimeType === photoMimeType
    && file.sizeBytes > 0
    && file.sizeBytes <= PHOTO_MAX_BYTES
    && properties.documentType === 'bod-profile-photo'
    && properties.boardId === boardId
    && properties.sectionKey === sectionKey
    && properties.profileId === profileId
    && properties.photoVersionCandidate === String(photoVersion)
    && /^[a-f0-9]{64}$/.test(sha256)
  );

  if (!valid) {
    throw makeError(
      HttpsError,
      'failed-precondition',
      'Published BOD photo metadata is invalid.'
    );
  }

  return sha256;
}

  async function assertRateLimit(tx, uid, createdAt) {
    const ref = rateLimitRef(uid);
    const snap = await tx.get(ref);
    const current = snap.exists ? snap.data() || {} : {};
    const windowStart = timestampToMillis(current.windowStartedAt);
    const inWindow = windowStart && nowMillis() - windowStart < RATE_LIMIT_WINDOW_MS;
    const count = inWindow ? Number(current.count) || 0 : 0;
    if (count >= RATE_LIMIT_COUNT) {
      throw makeError(HttpsError, 'resource-exhausted', 'Too many BOD photo upload sessions requested. Try again later.');
    }
    tx.set(ref, {
      uid,
      count: count + 1,
      windowStartedAt: inWindow ? current.windowStartedAt : createdAt,
      updatedAt: createdAt,
    }, { merge: true });
  }

  async function createUploadSession(data = {}, actorUid) {
    assertAllowedFields(data, new Set(['boardId', 'profileId', 'sectionKey', 'fileName', 'mimeType', 'sizeBytes']), HttpsError);
    const authority = await bodManagement.assertBodManagementAuthority(actorUid);
    const boardId = validateBoardId(data.boardId, HttpsError);
    const profileId = validateProfileId(data.profileId, HttpsError);
    const sectionKey = validateSectionKey(data.sectionKey, HttpsError);
    const expected = {
      fileName: normalizeSafeFileName(data.fileName, HttpsError),
      mimeType: normalizeMimeType(data.mimeType, HttpsError),
      sizeBytes: normalizeSizeBytes(data.sizeBytes, HttpsError),
    };
    const proof = generateProof();
    const createdAt = timestamp();
    const expiresAt = timestamp(SESSION_TTL_MS);
    const ref = db.collection(SESSION_COLLECTION).doc();
    let versionCandidate = 1;
    await db.runTransaction(async (tx) => {
      const { activeBoardRef, board } = await requireActiveBoard(tx, boardId);
      const { adminProfile, storedPhoto } = await loadStoredProfile(tx, boardId, profileId);
      if (adminProfile.sectionKey !== sectionKey) {
        throw makeError(HttpsError, 'failed-precondition', 'Profile belongs to another BOD section.');
      }
      if (adminProfile.status !== 'active') {
        throw makeError(HttpsError, 'failed-precondition', 'Archived profiles cannot receive photos.');
      }
      versionCandidate = nextPhotoVersion(storedPhoto);
      await assertRateLimit(tx, actorUid, createdAt);
      tx.set(ref, {
        uid: actorUid,
        actorRole: authority.role,
        boardId,
        profileId,
        sectionKey,
        status: 'pending',
        expected,
        proofHash: hashProof(proof),
        driveFileId: '',
        driveFolderId: '',
        sha256: '',
        versionCandidate,
        createdAt,
        updatedAt: createdAt,
        expiresAt,
        uploadedAt: null,
        finalizedAt: null,
        errorCode: '',
      });
      tx.set(activeBoardRef.collection('audit').doc(), auditPayload({
        eventType: 'photoUploadCreated',
        boardId,
        sectionKey,
        profileId,
        actorUid,
        actorRole: authority.role,
        after: {
          status: 'pending',
          mimeType: expected.mimeType,
          sizeBytes: expected.sizeBytes,
          version: versionCandidate,
        },
        now: createdAt,
      }));
    });
    return {
      ok: true,
      sessionId: ref.id,
      proof,
      uploadEndpoint,
      maxSizeBytes: PHOTO_MAX_BYTES,
      expiresAt: timestampToIso(expiresAt),
    };
  }

  async function markUploadFailed(sessionId, code) {
    if (!sessionId) return;
    const snap = await sessionRef(sessionId).get().catch(() => null);
    const session = snap?.exists ? snap.data() || {} : {};
    const now = timestamp();
    await sessionRef(sessionId).set({
      status: 'failed',
      errorCode: text(code || 'photo-upload-failed', 80),
      updatedAt: now,
    }, { merge: true }).catch(() => {});
    if (session.boardId && session.profileId && session.sectionKey) {
      await boardRef(session.boardId).collection('audit').doc().set(auditPayload({
        eventType: 'photoUploadFailed',
        boardId: session.boardId,
        sectionKey: session.sectionKey,
        profileId: session.profileId,
        actorUid: session.uid || 'system',
        actorRole: session.actorRole || 'system',
        after: { status: 'failed', errorCode: text(code || 'photo-upload-failed', 80) },
        now,
      })).catch(() => {});
    }
  }

  async function reserveSessionForUpload(metadata) {
    const ref = sessionRef(metadata.sessionId);
    let sessionData = null;
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw makeError(HttpsError, 'not-found', 'Photo upload session was not found.');
      const session = snap.data() || {};
      if (session.status !== 'pending') {
        throw makeError(HttpsError, 'already-exists', 'Photo upload session was already used.');
      }
      if (timestampToMillis(session.expiresAt) <= nowMillis()) {
        throw makeError(HttpsError, 'failed-precondition', 'Photo upload session expired.');
      }
      if (!proofMatches(metadata.proof, session.proofHash)) {
        throw makeError(HttpsError, 'permission-denied', 'Photo upload session is invalid.');
      }
      if (!metadataMatches(session, metadata)) {
        throw makeError(HttpsError, 'failed-precondition', 'Selected photo does not match the upload session.');
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
    if (!file?.id || file.trashed) {
      throw makeError(HttpsError, 'not-found', 'Uploaded photo file is unavailable.');
    }
    const expected = session.expected || {};
    const props = file.appProperties || {};
    if (
      file.id !== session.driveFileId
      || file.mimeType !== expected.mimeType
      || Number(file.sizeBytes) !== Number(expected.sizeBytes)
      || props.documentType !== 'bod-profile-photo'
      || props.boardId !== session.boardId
      || props.sectionKey !== session.sectionKey
      || props.profileId !== session.profileId
      || props.photoVersionCandidate !== String(session.versionCandidate)
      || props.uploadSessionId !== session.sessionId
      || props.uploaderUid !== session.uid
      || props.sha256 !== session.sha256
    ) {
      throw makeError(HttpsError, 'failed-precondition', 'Uploaded photo metadata does not match the approved session.');
    }
  }

  async function uploadHttp(req, res) {
    const corsAllowed = setCors(req, res, allowedOrigins);
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
let session = null;
let reservedSessionId = '';
let driveFile = null;
    try {
      const parsed = await parseMultipartUpload(req, { maxBytes: PHOTO_MAX_BYTES });
      metadata = normalizeUploadRequestFields(parsed.fields, HttpsError);
      const file = parsed.file || {};
      if (file.sizeBytes !== metadata.sizeBytes || file.buffer?.length !== metadata.sizeBytes) {
        throw makeError(HttpsError, 'invalid-argument', 'Uploaded photo size does not match the approved session.');
      }
      if (file.mimeType && text(file.mimeType, 120).toLowerCase() !== metadata.mimeType) {
        throw makeError(HttpsError, 'invalid-argument', 'Uploaded photo type does not match the approved session.');
      }
      assertImageBytes(file.buffer, metadata.mimeType, HttpsError);
session = await reserveSessionForUpload(metadata);
reservedSessionId = metadata.sessionId;

const contentHash = sha256Hex(file.buffer);
      const folder = await drive.ensureProfileFolder({
        boardId: metadata.boardId,
        sectionKey: metadata.sectionKey,
        profileId: metadata.profileId,
      });
      const appProperties = {
        documentType: 'bod-profile-photo',
        boardId: metadata.boardId,
        sectionKey: metadata.sectionKey,
        profileId: metadata.profileId,
        photoVersionCandidate: String(session.versionCandidate),
        uploadSessionId: metadata.sessionId,
        uploaderUid: session.uid,
        sha256: contentHash,
      };
      driveFile = await drive.uploadPhotoFile({
        folderId: folder.profileFolderId,
        fileName: versionedFileName(metadata.profileId, session.versionCandidate, metadata.fileName),
        mimeType: metadata.mimeType,
        buffer: file.buffer,
        appProperties,
      });
      const uploadedAt = timestamp();
      await sessionRef(metadata.sessionId).update({
        status: 'uploaded',
        driveFileId: driveFile.id,
        driveFolderId: folder.profileFolderId,
        sha256: contentHash,
        uploadedAt,
        updatedAt: uploadedAt,
      });
      await boardRef(metadata.boardId).collection('audit').doc().set(auditPayload({
        eventType: 'photoUploaded',
        boardId: metadata.boardId,
        sectionKey: metadata.sectionKey,
        profileId: metadata.profileId,
        actorUid: session.uid,
        actorRole: session.actorRole,
        after: {
          status: 'uploaded',
          mimeType: metadata.mimeType,
          sizeBytes: metadata.sizeBytes,
          version: session.versionCandidate,
        },
        now: uploadedAt,
      })).catch(() => {});
      return sendJson(res, 200, {
        ok: true,
        sessionId: metadata.sessionId,
        uploaded: safeUploadedResponse({ ...session, expected: metadata, versionCandidate: session.versionCandidate }, uploadedAt),
      });
    } catch (error) {
if (reservedSessionId) {
  await markUploadFailed(
    reservedSessionId,
    error?.code || 'photo-upload-failed'
  );
}
      logger.warn('BOD photo upload rejected.', {
        code: error?.code || error?.httpsCode || 'photo-upload-failed',
        sessionId: metadata?.sessionId || null,
      });
      return sendJson(res, httpStatus(error), {
        ok: false,
        code: error?.code || error?.httpsCode || 'photo-upload-failed',
        message: error?.message || 'Photo upload failed.',
      });
    }
  }

  async function downloadPublishedPhotoHttp(req, res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  res.set('Referrer-Policy', 'no-referrer');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  if (!['GET', 'HEAD'].includes(req.method)) {
    res.set('Allow', 'GET, HEAD, OPTIONS');

    return res
      .status(405)
      .set('Cache-Control', 'no-store')
      .json({
        ok: false,
        code: 'method-not-allowed',
        message: 'Use GET to load a published BOD photo.',
      });
  }

  try {
    const query = req.query || {};

    const boardId = validateBoardId(
      query.boardId,
      HttpsError
    );

    const sectionKey = validateSectionKey(
      query.sectionKey,
      HttpsError
    );

    const profileId = validateProfileId(
      query.profileId,
      HttpsError
    );

    const photoVersion = normalizePublishedPhotoVersion(
      query.version
    );

    /*
     * This is the authorization boundary. It reads only the
     * validated public snapshot and never the working draft list.
     */
    const publicBoard =
      await bodManagement.getPublicBodBoardPayload();

    if (
      publicBoard.boardId !== boardId
      || publicBoard.sections?.[sectionKey]?.state !== 'public'
    ) {
      throw publishedPhotoNotFound();
    }

    const publishedProfile =
      publicBoard.sections[sectionKey].profiles.find(
        (profile) => (
          profile.profileId === profileId
          && profile.photoVersion === photoVersion
        )
      );

    if (!publishedProfile) {
      throw publishedPhotoNotFound();
    }

    const driveFile = await drive.findPublishedPhotoFile({
  boardId,
  sectionKey,
  profileId,
  photoVersion,
});

if (!driveFile) {
  throw publishedPhotoNotFound();
}

const expectedSha256 = assertPublishedDriveFile({
  file: driveFile,
  boardId,
  sectionKey,
  profileId,
  photoVersion,
  photoMimeType: publishedProfile.photoMimeType,
});

const buffer = await drive.downloadFile(
  driveFile.id
);

    if (
      !Buffer.isBuffer(buffer)
      || buffer.length !== driveFile.sizeBytes
      || buffer.length > PHOTO_MAX_BYTES
      || sniffMimeType(buffer) !== publishedProfile.photoMimeType
      || sha256Hex(buffer) !== expectedSha256
    ) {
      throw makeError(
        HttpsError,
        'failed-precondition',
        'Published BOD photo content is invalid.'
      );
    }

    res.set(
  'Content-Type',
  publishedProfile.photoMimeType
);
    res.set('Content-Length', String(buffer.length));
    res.set(
      'Cache-Control',
      'public, max-age=300, s-maxage=300, must-revalidate'
    );

    if (req.method === 'HEAD') {
      return res.status(200).send('');
    }

    return res.status(200).send(buffer);
  } catch (error) {
    const code = error?.code || error?.httpsCode || 'internal';

    logger.warn('Published BOD photo request rejected.', {
      code,
    });

    const status = code === 'invalid-argument'
      ? 400
      : code === 'not-found'
        ? 404
        : 500;

    return res
      .status(status)
      .set('Cache-Control', 'no-store')
      .json({
        ok: false,
        code: status === 404
          ? 'not-found'
          : status === 400
            ? 'invalid-argument'
            : 'internal',
        message: status === 404
          ? 'Published BOD photo was not found.'
          : status === 400
            ? 'The published BOD photo request is invalid.'
            : 'The published BOD photo could not be loaded.',
      });
  }
}

  async function verifyUploadedSession(session) {
    const file = await drive.getFileMetadata(session.driveFileId);
    assertDriveMetadata(file, session);
    return file;
  }

  async function finalizeUpload(data = {}, actorUid) {
    assertAllowedFields(data, new Set(['boardId', 'profileId', 'sessionId', 'expectedDraftRevision']), HttpsError);
    const authority = await bodManagement.assertBodManagementAuthority(actorUid);
    const boardId = validateBoardId(data.boardId, HttpsError);
    const profileId = validateProfileId(data.profileId, HttpsError);
    const sessionId = normalizeSessionId(data.sessionId, HttpsError);
    const expectedDraftRevision = validateRevision(data.expectedDraftRevision, 'expectedDraftRevision', HttpsError);
    const initialSessionSnap = await sessionRef(sessionId).get();
    if (!initialSessionSnap.exists) throw makeError(HttpsError, 'not-found', 'Photo upload session was not found.');
    const initialSession = { ...initialSessionSnap.data(), sessionId };
    if (initialSession.status === 'uploaded') {
      if (timestampToMillis(initialSession.expiresAt) <= nowMillis()) {
        throw makeError(HttpsError, 'failed-precondition', 'Photo upload session expired.');
      }
      await verifyUploadedSession(initialSession);
    }
    let response;
    await db.runTransaction(async (tx) => {
      const { activeBoardRef, board } = await requireActiveBoard(tx, boardId);
      const sessionSnap = await tx.get(sessionRef(sessionId));
      if (!sessionSnap.exists) throw makeError(HttpsError, 'not-found', 'Photo upload session was not found.');
const session = { ...sessionSnap.data(), sessionId };
const { ref, raw, adminProfile, storedPhoto } = await loadStoredProfile(
  tx,
  boardId,
  profileId
);

const currentSection = board.sections[adminProfile.sectionKey];

if (
  session.status === 'finalized'
  && session.boardId === boardId
  && session.profileId === profileId
  && session.sectionKey === adminProfile.sectionKey
  && raw.photo?.uploadSessionId === sessionId
) {
  response = {
    ok: true,
    unchanged: true,
    boardId,
    profileId,
    sectionKey: adminProfile.sectionKey,
    draftRevision: currentSection.draftRevision,
    profile: adminProfile,
  };
  return;
}

const section = assertSectionRevision(
  board,
  adminProfile.sectionKey,
  expectedDraftRevision
);

if (adminProfile.status !== 'active') {
  throw makeError(
    HttpsError,
    'failed-precondition',
    'Archived profiles cannot receive photos.'
  );
}

if (session.status !== 'uploaded') {
  throw makeError(
    HttpsError,
    'failed-precondition',
    'Photo upload is not ready to finalize.'
  );
}
      if (
        session.boardId !== boardId
        || session.profileId !== profileId
        || session.sectionKey !== adminProfile.sectionKey
      ) {
        throw makeError(HttpsError, 'failed-precondition', 'Photo upload session does not match this profile.');
      }
      if (timestampToMillis(session.expiresAt) <= nowMillis()) {
        throw makeError(HttpsError, 'failed-precondition', 'Photo upload session expired.');
      }
      if (session.versionCandidate !== nextPhotoVersion(storedPhoto)) {
        throw makeError(HttpsError, 'failed-precondition', 'Photo version changed. Create a fresh upload session.');
      }
      const now = timestamp();
      const readyPhoto = {
        status: 'ready',
        storageProvider: 'googleDrive',
        driveFileId: session.driveFileId,
        driveFolderId: session.driveFolderId || null,
        mimeType: session.expected.mimeType,
        originalName: session.expected.fileName,
        sizeBytes: session.expected.sizeBytes,
        width: null,
        height: null,
        sha256: session.sha256,
        version: session.versionCandidate,
        uploadedAt: now,
        uploadedBy: session.uid,
        uploadSessionId: sessionId,
        previousPhoto: profileHasReadyPhoto(storedPhoto) ? previousPhotoSummary(storedPhoto, 'replaced') : null,
      };
      const nextRevision = section.draftRevision + 1;
      tx.update(ref, {
        photo: readyPhoto,
        updatedAt: now,
        updatedBy: actorUid,
      });
      tx.update(activeBoardRef, {
        [`sections.${adminProfile.sectionKey}.draftRevision`]: nextRevision,
        updatedAt: now,
        updatedBy: actorUid,
      });
      tx.update(sessionRef(sessionId), {
        status: 'finalized',
        finalizedAt: now,
        updatedAt: now,
      });
      tx.set(activeBoardRef.collection('audit').doc(), auditPayload({
        eventType: profileHasReadyPhoto(storedPhoto) ? 'photoReplaced' : 'photoUploaded',
        boardId,
        sectionKey: adminProfile.sectionKey,
        profileId,
        actorUid,
        actorRole: authority.role,
        before: adminSafePhoto(storedPhoto),
        after: adminSafePhoto(readyPhoto),
        draftRevisionBefore: section.draftRevision,
        draftRevisionAfter: nextRevision,
        now,
      }));
      response = {
        ok: true,
        unchanged: false,
        boardId,
        profileId,
        sectionKey: adminProfile.sectionKey,
        draftRevision: nextRevision,
        profile: normalizeStoredProfile(profileId, {
          ...raw,
          photo: readyPhoto,
          updatedAt: now,
          updatedBy: actorUid,
        }, HttpsError),
      };
    });
    return response;
  }

  async function removePhoto(data = {}, actorUid) {
    assertAllowedFields(data, new Set(['boardId', 'profileId', 'expectedDraftRevision']), HttpsError);
    const authority = await bodManagement.assertBodManagementAuthority(actorUid);
    const boardId = validateBoardId(data.boardId, HttpsError);
    const profileId = validateProfileId(data.profileId, HttpsError);
    const expectedDraftRevision = validateRevision(data.expectedDraftRevision, 'expectedDraftRevision', HttpsError);
    let response;
    await db.runTransaction(async (tx) => {
      const { activeBoardRef, board } = await requireActiveBoard(tx, boardId);
      const { ref, raw, adminProfile, storedPhoto } = await loadStoredProfile(tx, boardId, profileId);
      const section = assertSectionRevision(board, adminProfile.sectionKey, expectedDraftRevision);
      if (!profileHasReadyPhoto(storedPhoto)) {
        response = {
          ok: true,
          unchanged: true,
          boardId,
          profileId,
          sectionKey: adminProfile.sectionKey,
          draftRevision: section.draftRevision,
          profile: adminProfile,
        };
        return;
      }
      const now = timestamp();
      const removedPhoto = {
        ...previousPhotoSummary(storedPhoto, 'removed'),
        status: 'removed',
        previousPhoto: null,
      };
      const nextRevision = section.draftRevision + 1;
      tx.update(ref, {
        photo: removedPhoto,
        updatedAt: now,
        updatedBy: actorUid,
      });
      tx.update(activeBoardRef, {
        [`sections.${adminProfile.sectionKey}.draftRevision`]: nextRevision,
        updatedAt: now,
        updatedBy: actorUid,
      });
      tx.set(activeBoardRef.collection('audit').doc(), auditPayload({
        eventType: 'photoRemoved',
        boardId,
        sectionKey: adminProfile.sectionKey,
        profileId,
        actorUid,
        actorRole: authority.role,
        before: adminSafePhoto(storedPhoto),
        after: adminSafePhoto(removedPhoto),
        draftRevisionBefore: section.draftRevision,
        draftRevisionAfter: nextRevision,
        now,
      }));
      response = {
        ok: true,
        unchanged: false,
        boardId,
        profileId,
        sectionKey: adminProfile.sectionKey,
        draftRevision: nextRevision,
        profile: normalizeStoredProfile(profileId, {
          ...raw,
          photo: removedPhoto,
          updatedAt: now,
          updatedBy: actorUid,
        }, HttpsError),
      };
    });
    return response;
  }

  async function isDriveFileReferenced(fileId) {
    const id = text(fileId, 300);
    if (!id) return true;
    try {
      const boardsSnap = await db.collection(BOARDS_COLLECTION).get();
      for (const boardDoc of boardsSnap.docs || []) {
        const profilesSnap = await boardRef(boardDoc.id).collection('profiles').get();
        for (const profileDoc of profilesSnap.docs || []) {
          const photo = normalizeStoredPhoto(profileDoc.data()?.photo ?? null, HttpsError);
          if (!photo) continue;
          if (photo.driveFileId === id || photo.previousPhoto?.driveFileId === id) return true;
        }
      }
      return false;
    } catch (error) {
      logger.warn('BOD photo reference scan failed; preserving Drive file.', { code: error?.code || 'reference-scan-failed' });
      return true;
    }
  }

  async function cleanupExpiredSessions(data = {}, actorUid) {
    assertAllowedFields(data, new Set(['limit']), HttpsError);
    const authority = await bodManagement.assertBodManagementAuthority(actorUid);
    const limit = Math.max(1, Math.min(Number(data.limit) || CLEANUP_LIMIT, 100));
    const snap = await db.collection(SESSION_COLLECTION).get();
    const candidates = (snap.docs || []).slice(0, 500);
    let cleaned = 0;
    let failures = 0;
    for (const doc of candidates) {
      if (cleaned >= limit) break;
      const session = doc.data() || {};
      const expired = timestampToMillis(session.expiresAt) <= nowMillis();
      const graceExpired = timestampToMillis(session.expiresAt) + ORPHAN_GRACE_MS <= nowMillis();
      if (!expired || ['finalized', 'cancelled', 'expired'].includes(session.status)) continue;
      try {
        const now = timestamp();
        if (['pending', 'uploading', 'failed'].includes(session.status)) {
          await db.collection(SESSION_COLLECTION).doc(doc.id).set({
            status: 'expired',
            errorCode: 'expired',
            updatedAt: now,
          }, { merge: true });
          await boardRef(session.boardId).collection('audit').doc().set(auditPayload({
            eventType: 'photoUploadExpired',
            boardId: session.boardId,
            sectionKey: session.sectionKey,
            profileId: session.profileId,
            actorUid,
            actorRole: authority.role,
            after: { status: 'expired' },
            now,
          })).catch(() => {});
          cleaned += 1;
        } else if (session.status === 'uploaded' && graceExpired) {
          const referenced = await isDriveFileReferenced(session.driveFileId);
          if (!referenced) {
            await drive.deleteFile(session.driveFileId);
          }
          await db.collection(SESSION_COLLECTION).doc(doc.id).set({
            status: 'expired',
            errorCode: referenced ? 'expired-referenced' : 'expired-orphan-cleaned',
            updatedAt: now,
          }, { merge: true });
          await boardRef(session.boardId).collection('audit').doc().set(auditPayload({
            eventType: referenced ? 'photoUploadExpired' : 'photoUploadCleaned',
            boardId: session.boardId,
            sectionKey: session.sectionKey,
            profileId: session.profileId,
            actorUid,
            actorRole: authority.role,
            after: { status: 'expired', cleaned: !referenced },
            now,
          })).catch(() => {});
          cleaned += 1;
        }
      } catch (error) {
        failures += 1;
        logger.warn('BOD photo cleanup item failed.', { sessionId: doc.id, code: error?.code || 'cleanup-failed' });
      }
    }
    return { ok: true, cleaned, failures };
  }

return {
  createUploadSession,
  uploadHttp,
  downloadPublishedPhotoHttp,
  finalizeUpload,
  removePhoto,
  cleanupExpiredSessions,
};
}

module.exports = {
  SESSION_COLLECTION,
  RATE_LIMIT_COLLECTION,
  SESSION_TTL_MS,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_COUNT,
  ORPHAN_GRACE_MS,
  PHOTO_MAX_BYTES,
  PHOTO_MIME_TYPES,
  getBodPhotoDriveConfig,
  createBodPhotoDriveService,
  createBodPhotoUploadService,
  sniffMimeType,
  proofMatches,
  hashProof,
  normalizeSafeFileName,
};
