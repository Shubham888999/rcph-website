'use strict';

const crypto = require('crypto');
const { Readable } = require('stream');
const Busboy = require('@fastify/busboy');
const { google } = require('googleapis');

const VISIT_HTTP_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;
const VISIT_UPLOAD_ALLOWED_ORIGINS = Object.freeze([
  'https://rcph3131.org',
  'https://www.rcph3131.org',
  'https://rcph-admin.web.app',
  'https://rcph-admin.firebaseapp.com',
  'http://127.0.0.1:5500',
  'http://localhost:5500',
]);
const FORBIDDEN_BROWSER_AUTHORITY_FIELDS = Object.freeze([
  'driveFolderId',
  'rootFolderId',
  'visitType',
  'positionKey',
  'driveFileId',
  'driveFileUrl',
]);
const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';
const VISIT_DRIVE_AUTH_MODES = Object.freeze(['shared-drive', 'oauth']);
const VISIT_FOLDER_LOCK_TTL_MS = 90 * 1000;
const VISIT_FOLDER_LOCK_RETRY_MS = 100;
const VISIT_FOLDER_LOCK_RETRY_COUNT = 3;

function createHttpUploadError(status, message, details) {
  const err = new Error(message);
  err.status = status;
  err.httpStatus = status;
  err.safeMessage = message;
  err.details = details || {};
  return err;
}

function safeText(value, max = 1000) {
  return String(value == null ? '' : value).trim().replace(/\s+/g, ' ').slice(0, max);
}

function escapeDriveQueryString(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function normalizeFolderName(value, fallback = 'Folder') {
  const text = safeText(value || fallback, 160)
    .replace(/[\\/:*?"<>|\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text || fallback;
}

function hashValue(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function randomToken() {
  return crypto.randomBytes(24).toString('hex');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getHeader(req, name) {
  if (!req) return '';
  if (typeof req.get === 'function') return req.get(name) || req.get(name.toLowerCase()) || '';
  return req.headers?.[name.toLowerCase()] || req.headers?.[name] || '';
}

function isAllowedOrigin(origin, allowedOrigins = VISIT_UPLOAD_ALLOWED_ORIGINS) {
  return !!origin && allowedOrigins.includes(origin);
}

function setCorsHeaders(req, res, allowedOrigins = VISIT_UPLOAD_ALLOWED_ORIGINS) {
  const origin = getHeader(req, 'origin');
  res.set('Vary', 'Origin');
  if (!isAllowedOrigin(origin, allowedOrigins)) return false;
  res.set('Access-Control-Allow-Origin', origin);
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Max-Age', '3600');
  return true;
}

function sendJson(res, status, payload) {
  res.status(status)
    .set('Content-Type', 'application/json; charset=utf-8')
    .set('Cache-Control', 'no-store')
    .send(JSON.stringify(payload));
}

function safeMessageForStatus(status, fallback) {
  if (status >= 500) return fallback || 'Visit upload failed. Please try again or contact an administrator.';
  return fallback || 'Visit upload request was rejected.';
}

function httpStatusFromServiceError(err) {
  if (Number.isInteger(err?.httpStatus)) return err.httpStatus;
  if (Number.isInteger(err?.status)) return err.status;
  const byCode = {
    'invalid-argument': 400,
    unauthenticated: 401,
    'permission-denied': 403,
    'not-found': 404,
    'already-exists': 409,
    'failed-precondition': 412,
    'resource-exhausted': 429,
    internal: 500,
  };
  return byCode[err?.httpsCode || err?.code] || 500;
}

function normalizeTicket(value) {
  const ticket = safeText(value, 100).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(ticket)) {
    throw createHttpUploadError(400, 'Valid upload ticket is required.');
  }
  return ticket;
}

function normalizeUploadId(value, label) {
  const text = safeText(value, 160);
  if (!text || /[\\/]/.test(text)) {
    throw createHttpUploadError(400, `${label} is required.`);
  }
  return text;
}

function normalizeFileName(value) {
  const text = String(value == null ? '' : value)
    .split(/[\\/]/)
    .pop()
    .replace(/[\x00-\x1F]/g, ' ')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180)
    .trim();
  if (!text || !/\.[A-Za-z0-9]{1,12}$/.test(text)) {
    throw createHttpUploadError(400, 'Valid file name is required.');
  }
  return text;
}

function normalizeMimeType(value) {
  const mimeType = safeText(value, 160).toLowerCase();
  if (!/^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/.test(mimeType)) {
    throw createHttpUploadError(400, 'Valid file type is required.');
  }
  return mimeType;
}

function normalizeSizeBytes(value, maxBytes = VISIT_HTTP_UPLOAD_MAX_BYTES) {
  const sizeBytes = Number(value);
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
    throw createHttpUploadError(400, 'Valid file size is required.');
  }
  if (sizeBytes > maxBytes) {
    throw createHttpUploadError(413, 'Upload file is too large.');
  }
  return sizeBytes;
}

function rejectForbiddenAuthorityFields(fields) {
  const present = FORBIDDEN_BROWSER_AUTHORITY_FIELDS.filter(field => safeText(fields?.[field], 1000));
  if (present.length) {
    throw createHttpUploadError(400, 'Upload destination and Drive result must be selected by the trusted server.', {
      fields: present,
    });
  }
}

function validateUploadFields(fields, maxBytes = VISIT_HTTP_UPLOAD_MAX_BYTES) {
  rejectForbiddenAuthorityFields(fields);
  return {
    ticket: normalizeTicket(fields?.ticket),
    sessionId: normalizeUploadId(fields?.sessionId, 'Upload session ID'),
    clientFileId: normalizeUploadId(fields?.clientFileId, 'Client file ID'),
    fileName: normalizeFileName(fields?.fileName),
    mimeType: normalizeMimeType(fields?.mimeType),
    sizeBytes: normalizeSizeBytes(fields?.sizeBytes, maxBytes),
  };
}

function parseMultipartUpload(req, options = {}) {
  const maxBytes = options.maxBytes || VISIT_HTTP_UPLOAD_MAX_BYTES;
  const BusboyImpl = options.Busboy || Busboy;
  const contentType = getHeader(req, 'content-type');
  if (!/^multipart\/form-data\b/i.test(contentType)) {
    return Promise.reject(createHttpUploadError(400, 'Upload request must be multipart/form-data.'));
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let fileCount = 0;
    const fields = {};
    const chunks = [];
    const fileInfo = {
      fieldName: '',
      fileName: '',
      mimeType: '',
      sizeBytes: 0,
      truncated: false,
    };

    function fail(err) {
      if (settled) return;
      settled = true;
      reject(err);
    }

    let busboy;
    try {
      busboy = new BusboyImpl({
        headers: req.headers || {},
        limits: {
          files: 1,
          fileSize: maxBytes,
          fields: 16,
          parts: 24,
        },
      });
    } catch (err) {
      fail(createHttpUploadError(400, 'Malformed multipart upload request.'));
      return;
    }

    busboy.on('field', (name, value) => {
      if (Object.prototype.hasOwnProperty.call(fields, name)) {
        fail(createHttpUploadError(400, 'Duplicate upload metadata fields are not allowed.'));
        return;
      }
      fields[name] = String(value || '');
    });

    busboy.on('file', (fieldName, file, fileName, encoding, mimeType) => {
      fileCount += 1;
      if (fieldName !== 'file') {
        file.resume();
        fail(createHttpUploadError(400, 'Unexpected file field.'));
        return;
      }
      if (fileCount > 1) {
        file.resume();
        fail(createHttpUploadError(400, 'Only one file may be uploaded at a time.'));
        return;
      }

      fileInfo.fieldName = fieldName;
      fileInfo.fileName = safeText(fileName, 240);
      fileInfo.mimeType = safeText(mimeType, 160).toLowerCase();

      file.on('data', (chunk) => {
        fileInfo.sizeBytes += chunk.length;
        if (fileInfo.sizeBytes > maxBytes) {
          file.resume();
          fail(createHttpUploadError(413, 'Upload file is too large.'));
          return;
        }
        chunks.push(chunk);
      });
      file.on('limit', () => {
        fileInfo.truncated = true;
        fail(createHttpUploadError(413, 'Upload file is too large.'));
      });
      file.on('error', () => {
        fail(createHttpUploadError(400, 'Could not read uploaded file.'));
      });
    });

    busboy.on('filesLimit', () => fail(createHttpUploadError(400, 'Only one file may be uploaded at a time.')));
    busboy.on('fieldsLimit', () => fail(createHttpUploadError(400, 'Too many upload metadata fields.')));
    busboy.on('partsLimit', () => fail(createHttpUploadError(400, 'Too many multipart request parts.')));
    busboy.on('error', () => fail(createHttpUploadError(400, 'Malformed multipart upload request.')));
    busboy.on('finish', () => {
      if (settled) return;
      if (fileCount !== 1 || !chunks.length) {
        fail(createHttpUploadError(400, 'Upload file is required.'));
        return;
      }
      if (fileInfo.truncated) {
        fail(createHttpUploadError(413, 'Upload file is too large.'));
        return;
      }
      settled = true;
      resolve({
        fields,
        file: {
          ...fileInfo,
          buffer: Buffer.concat(chunks),
        },
      });
    });

    if (Buffer.isBuffer(req.rawBody)) {
      busboy.end(req.rawBody);
    } else {
      req.pipe(busboy);
    }
  });
}

function validateParsedFile(parsedFile, metadata) {
  if (!parsedFile?.buffer || !Buffer.isBuffer(parsedFile.buffer)) {
    throw createHttpUploadError(400, 'Upload file is required.');
  }
  if (parsedFile.sizeBytes !== metadata.sizeBytes || parsedFile.buffer.length !== metadata.sizeBytes) {
    throw createHttpUploadError(400, 'Uploaded file size did not match the approved ticket.');
  }
  if (parsedFile.mimeType && parsedFile.mimeType !== metadata.mimeType) {
    throw createHttpUploadError(400, 'Uploaded file type did not match the approved ticket.');
  }
}

function getSecretValue(options, name) {
  const boundSecret = options.secrets?.[name];
  if (boundSecret && typeof boundSecret.value === 'function') return boundSecret.value();
  if (typeof options.getSecret === 'function') return options.getSecret(name);
  return (options.env || process.env)[name];
}

function getVisitDriveConfig(env = process.env) {
  const authMode = safeText(env.VISIT_DRIVE_AUTH_MODE, 40).toLowerCase();

  const rootFolderIds = {
    clubAssembly: safeText(env.VISIT_CLUB_ASSEMBLY_FOLDER_ID, 300),
    dzrVisit: safeText(env.VISIT_DZR_FOLDER_ID, 300),
    drrVisit: safeText(env.VISIT_DRR_FOLDER_ID, 300),
  };

  if (
    !VISIT_DRIVE_AUTH_MODES.includes(authMode)
    || !rootFolderIds.clubAssembly
    || !rootFolderIds.dzrVisit
    || !rootFolderIds.drrVisit
  ) {
    throw createHttpUploadError(
      500,
      'Visit upload storage is not configured.'
    );
  }

  return {
    authMode,
    rootFolderIds,
  };
}

function getRootFolderIdForVisit(config, visitType) {
  const trustedVisitType = safeText(visitType, 80);

  const rootFolderId = config?.rootFolderIds?.[trustedVisitType];

  if (!rootFolderId) {
    throw createHttpUploadError(
      500,
      'Visit upload storage is not configured.'
    );
  }

  return rootFolderId;
}

function createGoogleDriveClient(options = {}) {
  const googleApi = options.googleApi || google;
  const config = options.config || getVisitDriveConfig(options.env || process.env);
  let auth = options.auth;
  if (!auth && config.authMode === 'shared-drive') {
    auth = new googleApi.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
  } else if (!auth && config.authMode === 'oauth') {
    const clientId = safeText(getSecretValue(options, 'VISIT_DRIVE_CLIENT_ID'), 500);
    const clientSecret = safeText(getSecretValue(options, 'VISIT_DRIVE_CLIENT_SECRET'), 500);
    const refreshToken = safeText(getSecretValue(options, 'VISIT_DRIVE_REFRESH_TOKEN'), 1000);
    if (!clientId || !clientSecret || !refreshToken) {
      throw createHttpUploadError(500, 'Visit upload storage is not configured.');
    }
    auth = new googleApi.auth.OAuth2(clientId, clientSecret);
    auth.setCredentials({ refresh_token: refreshToken });
  }
  if (!auth) {
    throw createHttpUploadError(500, 'Visit upload storage is not configured.');
  }
  return googleApi.drive({ version: 'v3', auth });
}

function createVisitDriveService(options = {}) {
  let driveClient = options.driveClient || null;

  function getDriveClient(config) {
    if (!driveClient) {
      driveClient = createGoogleDriveClient({ ...options, config });
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
      throw createHttpUploadError(500, 'Duplicate Drive folders found for the canonical upload path.');
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

async function ensureVisitFolderHierarchy(validation, config = null) {
  const resolvedConfig =
    config || getVisitDriveConfig(options.env || process.env);

  getDriveClient(resolvedConfig);

  const rootFolderId = getRootFolderIdForVisit(
    resolvedConfig,
    validation.visitType
  );

  const positionFolder = await getOrCreateUniqueFolder(
    rootFolderId,
    validation.positionTitle
  );

  return {
    rootFolderId,
    visitType: validation.visitType,
    positionFolderId: positionFolder.id,
    positionFolderName: positionFolder.name,
  };
}

  async function uploadFile({ folderId, fileName, mimeType, buffer }) {
    const response = await getDriveClient().files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
      },
      media: {
        mimeType,
        body: Readable.from(buffer),
      },
      fields: 'id,name,webViewLink',
      supportsAllDrives: true,
    });
    const data = response.data || {};
    return {
      driveFileId: data.id,
      fileName: data.name || fileName,
      driveFileUrl: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
    };
  }

  return {
    ensureVisitFolderHierarchy,
    uploadFile,
  };
}

function assertTrustedValidation(validation) {
  const required = ['safeFileName', 'visitType', 'visitDisplayTitle', 'positionKey', 'positionTitle', 'avenueCode', 'uploadProof'];
  const missing = required.filter(field => !safeText(validation?.[field], 1000));
  if (missing.length) {
    throw createHttpUploadError(500, 'Trusted upload validation response was incomplete.');
  }
}

function buildVisitFolderLockId({
  rootFolderId,
  visitType,
  positionKey,
}) {
  return hashValue([
    safeText(rootFolderId, 300),
    safeText(visitType, 80),
    safeText(positionKey, 80),
  ].join('|'));
}

function createNoopFolderLockManager() {
  return {
    async acquireLock() {
      return {
        lockId: 'noop',
        async release() {},
      };
    },
  };
}

function createFirestoreFolderLockManager(options = {}) {
  const db = options.db;
  const admin = options.admin;
  if (!db || !admin) throw new Error('db and admin are required for folder locks.');
  const now = options.now || (() => Date.now());
  const ttlMs = options.ttlMs || VISIT_FOLDER_LOCK_TTL_MS;
  const retryCount = options.retryCount == null ? VISIT_FOLDER_LOCK_RETRY_COUNT : options.retryCount;
  const retryMs = options.retryMs || VISIT_FOLDER_LOCK_RETRY_MS;
  const collectionName = options.collectionName || 'visitSubmissionFolderLocks';

  async function acquireOnce(input) {
    const lockId = buildVisitFolderLockId(input);
    const ownerToken = randomToken();
    const ownerTokenHash = hashValue(ownerToken);
    const ref = db.collection(collectionName).doc(lockId);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const existing = snap.exists ? snap.data() || {} : {};
      const currentMillis = now();
      if (
        existing.status === 'held'
        && Number(existing.expiresAtMillis || 0) > currentMillis
        && existing.ownerTokenHash !== ownerTokenHash
      ) {
        throw createHttpUploadError(409, 'Visit upload folder is being prepared. Please try again.');
      }
      const timestamp = admin.firestore.FieldValue.serverTimestamp();
      tx.set(ref, {
        lockKey: lockId,
        ownerTokenHash,
        status: 'held',
        expiresAtMillis: currentMillis + ttlMs,
        createdAt: existing.createdAt || timestamp,
        updatedAt: timestamp,
      }, { merge: true });
    });
    return {
      lockId,
      ownerTokenHash,
      async release() {
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          const existing = snap.exists ? snap.data() || {} : {};
          if (existing.ownerTokenHash !== ownerTokenHash) return;
          tx.set(ref, {
            status: 'released',
            expiresAtMillis: now(),
            releasedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
        });
      },
    };
  }

  return {
    async acquireLock(input) {
      let lastError;
      for (let attempt = 0; attempt <= retryCount; attempt += 1) {
        try {
          return await acquireOnce(input);
        } catch (err) {
          lastError = err;
          if (httpStatusFromServiceError(err) !== 409 || attempt === retryCount) break;
          await sleep(retryMs);
        }
      }
      throw lastError;
    },
  };
}

function createVisitHttpUploadHandler(options = {}) {
  const visitService = options.visitService;
  if (!visitService) throw new Error('visitService is required.');
  const driveService = options.driveService || createVisitDriveService(options);
  const folderLockManager = options.folderLockManager || createNoopFolderLockManager();
  const configProvider = options.getDriveConfig || (() => getVisitDriveConfig(options.env || process.env));
  const allowedOrigins = options.allowedOrigins || VISIT_UPLOAD_ALLOWED_ORIGINS;
  const logger = options.logger || console;
  const parser = options.parseMultipartUpload || parseMultipartUpload;
  const maxBytes = options.maxBytes || VISIT_HTTP_UPLOAD_MAX_BYTES;

  return async function uploadVisitSubmissionFile(req, res) {
    const corsAllowed = setCorsHeaders(req, res, allowedOrigins);
    if (req.method === 'OPTIONS') {
      if (!corsAllowed) {
        return sendJson(res, 403, { ok: false, message: 'Origin is not allowed.' });
      }
      return res.status(204).send('');
    }
    if (!corsAllowed) {
      return sendJson(res, 403, { ok: false, message: 'Origin is not allowed.' });
    }
    if (req.method !== 'POST') {
      res.set('Allow', 'POST, OPTIONS');
      return sendJson(res, 405, { ok: false, message: 'POST required.' });
    }

    let metadata;
    let parsedFile;
    let validation;
    let driveFile = null;
    let folderLock = null;

    try {
      const parsed = await parser(req, { maxBytes });
      metadata = validateUploadFields(parsed.fields, maxBytes);
      parsedFile = parsed.file;
      validateParsedFile(parsedFile, metadata);

      const driveConfig = configProvider();

      validation = await visitService.validateVisitUploadTicketWithProof({
        ticket: metadata.ticket,
        sessionId: metadata.sessionId,
        clientFileId: metadata.clientFileId,
        fileName: metadata.fileName,
        mimeType: metadata.mimeType,
        sizeBytes: metadata.sizeBytes,
      });
      assertTrustedValidation(validation);

const rootFolderId = getRootFolderIdForVisit(
  driveConfig,
  validation.visitType
);

folderLock = await folderLockManager.acquireLock({
  rootFolderId,
  visitType: validation.visitType,
  positionKey: validation.positionKey,
});
      const folder = await driveService.ensureVisitFolderHierarchy(validation, driveConfig);
      driveFile = await driveService.uploadFile({
        folderId: folder.positionFolderId,
        fileName: validation.safeFileName,
        mimeType: metadata.mimeType,
        buffer: parsedFile.buffer,
      });

      const completion = await visitService.completeDriveUpload({
        ticket: metadata.ticket,
        sessionId: metadata.sessionId,
        clientFileId: metadata.clientFileId,
        uploadProof: validation.uploadProof,
        driveFileId: driveFile.driveFileId,
        driveFolderId: folder.positionFolderId,
        driveFileUrl: driveFile.driveFileUrl,
        fileName: metadata.fileName,
        finalFileName: validation.safeFileName,
        mimeType: metadata.mimeType,
        sizeBytes: metadata.sizeBytes,
      });

      return sendJson(res, 200, {
        ok: true,
        completionProof: completion.completionProof,
        fileUrl: driveFile.driveFileUrl,
      });
    } catch (err) {
      const status = httpStatusFromServiceError(err);
      if (driveFile && metadata) {
        logger.warn('Visit Drive upload completed but trusted completion failed', {
          sessionId: metadata.sessionId,
          clientFileId: metadata.clientFileId,
          driveFileId: driveFile.driveFileId,
          code: err?.code || err?.httpsCode || 'internal',
        });
      }
      if (status >= 500) {
        logger.warn('Visit HTTP upload failed', {
          status,
          sessionId: metadata?.sessionId || null,
          clientFileId: metadata?.clientFileId || null,
          code: err?.code || err?.httpsCode || 'internal',
        });
      }
      return sendJson(res, status, {
        ok: false,
        message: status >= 500
          ? safeMessageForStatus(status, err?.safeMessage)
          : safeMessageForStatus(status, err?.safeMessage || err?.message),
      });
    } finally {
      if (folderLock && typeof folderLock.release === 'function') {
        try {
          await folderLock.release();
        } catch (releaseErr) {
          logger.warn('Visit upload folder lock release failed', {
            lockId: folderLock.lockId || null,
            code: releaseErr?.code || releaseErr?.httpsCode || 'internal',
          });
        }
      }
    }
  };
}

module.exports = {
  VISIT_HTTP_UPLOAD_MAX_BYTES,
  VISIT_UPLOAD_ALLOWED_ORIGINS,
  FORBIDDEN_BROWSER_AUTHORITY_FIELDS,
  createHttpUploadError,
  isAllowedOrigin,
  setCorsHeaders,
  sendJson,
  httpStatusFromServiceError,
  validateUploadFields,
  parseMultipartUpload,
  validateParsedFile,
  getVisitDriveConfig,
  getRootFolderIdForVisit,
  createGoogleDriveClient,
  createVisitDriveService,
  buildVisitFolderLockId,
  createNoopFolderLockManager,
  createFirestoreFolderLockManager,
  createVisitHttpUploadHandler,
};
