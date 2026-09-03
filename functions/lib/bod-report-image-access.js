const crypto = require('crypto');
const {
  BOD_EVENT_ATTACHMENT_SOURCE,
  BOD_EVENT_ATTACHMENT_STORAGE_PROVIDER,
  BOD_EVENT_ATTACHMENTS_COLLECTION,
  DRIVE_FOLDER_MIME,
  buildBodEventUploadFolderName,
  createBodEventDriveMetadataService,
  normalizeDocumentId,
  normalizeAuthoritativeBodUploadEvent,
} = require('./bod-event-attachments');
const { BOD_REPORT_IMAGE_MIME_TYPES } = require('./bod-report-image-selection');

const BOD_REPORT_IMAGE_MIME_TYPE_SET = new Set(BOD_REPORT_IMAGE_MIME_TYPES);

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

function normalizeSelectedReportImageFileId(value, HttpsError) {
  try {
    return normalizeDocumentId(value, 'Report image file ID', HttpsError, 300);
  } catch {
    throw makeError(HttpsError, 'failed-precondition', 'No report image is selected for this event.');
  }
}

function normalizeSafeFileName(value, HttpsError) {
  const raw = text(value, 180);
  if (!raw || /[\\/]/.test(raw) || hasControlCharacter(raw)) {
    throw makeError(HttpsError, 'failed-precondition', 'Verified event attachment file name is not valid.');
  }
  return raw;
}

function normalizeStoredDocumentId(value, label, HttpsError, max = 300) {
  try {
    return normalizeDocumentId(value, label, HttpsError, max);
  } catch {
    throw makeError(HttpsError, 'failed-precondition', `Verified event attachment ${label.toLowerCase()} is not valid.`);
  }
}

function normalizeAttachment(fileId, snap, HttpsError, maxBytes) {
  if (!snap.exists) {
    throw makeError(HttpsError, 'not-found', 'Verified event attachment not found.');
  }
  if (snap.id !== fileId) {
    throw makeError(HttpsError, 'failed-precondition', 'Verified event attachment is not valid.');
  }
  const attachment = snap.data() || {};
  if (attachment.storageProvider !== BOD_EVENT_ATTACHMENT_STORAGE_PROVIDER) {
    throw makeError(HttpsError, 'failed-precondition', 'Verified event attachment storage is not valid.');
  }
  if (attachment.source !== BOD_EVENT_ATTACHMENT_SOURCE) {
    throw makeError(HttpsError, 'failed-precondition', 'Verified event attachment source is not valid.');
  }
  const mimeType = cleanLower(attachment.mimeType, 120);
  if (!BOD_REPORT_IMAGE_MIME_TYPE_SET.has(mimeType)) {
    throw makeError(HttpsError, 'failed-precondition', 'Verified event attachment is not eligible as a report image.');
  }
  const sizeBytes = Number(attachment.sizeBytes);
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > maxBytes) {
    throw makeError(HttpsError, 'failed-precondition', 'Verified event attachment size is not valid.');
  }
  const sha256 = String(attachment.sha256 || '').trim();
  if (!/^[a-f0-9]{64}$/.test(sha256)) {
    throw makeError(HttpsError, 'failed-precondition', 'Verified event attachment checksum is not valid.');
  }

  return {
    fileName: normalizeSafeFileName(attachment.fileName, HttpsError),
    mimeType,
    sizeBytes,
    driveFolderId: normalizeStoredDocumentId(attachment.driveFolderId, 'Drive folder ID', HttpsError, 300),
    uploadGroupId: normalizeStoredDocumentId(attachment.uploadGroupId, 'Upload group ID', HttpsError, 100),
    storageProvider: attachment.storageProvider,
    source: attachment.source,
    sha256,
  };
}

function normalizeDriveMetadata(raw = {}) {
  return {
    id: text(raw.id, 300),
    name: text(raw.name, 300),
    mimeType: cleanLower(raw.mimeType, 120),
    sizeBytes: Number(raw.sizeBytes ?? raw.size) || 0,
    parents: Array.isArray(raw.parents) ? raw.parents.map(item => text(item, 300)).filter(Boolean) : [],
    trashed: raw.trashed === true,
  };
}

function assertDriveFolder(folder, event, attachment, rootFolderId, HttpsError) {
  const expectedFolderName = buildBodEventUploadFolderName({
    eventDate: event.eventDate,
    eventName: event.eventName,
    uploadGroupId: attachment.uploadGroupId,
  });
  if (!folder || folder.id !== attachment.driveFolderId || folder.trashed === true) {
    throw makeError(HttpsError, 'failed-precondition', 'BOD report image folder is not valid.');
  }
  if (folder.mimeType !== DRIVE_FOLDER_MIME) {
    throw makeError(HttpsError, 'failed-precondition', 'BOD report image folder is not valid.');
  }
  if (!folder.parents.includes(rootFolderId)) {
    throw makeError(HttpsError, 'failed-precondition', 'BOD report image folder is outside the approved root.');
  }
  if (folder.name !== expectedFolderName) {
    throw makeError(HttpsError, 'failed-precondition', 'BOD report image folder name does not match the approved event.');
  }
}

function assertDriveFile(file, fileId, attachment, HttpsError) {
  if (!file || file.id !== fileId || file.trashed === true) {
    throw makeError(HttpsError, 'failed-precondition', 'BOD report image file is not valid.');
  }
  if (!file.parents.includes(attachment.driveFolderId)) {
    throw makeError(HttpsError, 'failed-precondition', 'BOD report image file is outside the verified event folder.');
  }
  if (file.name !== attachment.fileName) {
    throw makeError(HttpsError, 'failed-precondition', 'BOD report image file name does not match the verified attachment.');
  }
  if (file.mimeType !== attachment.mimeType) {
    throw makeError(HttpsError, 'failed-precondition', 'BOD report image file type does not match the verified attachment.');
  }
  if (Number(file.sizeBytes) !== attachment.sizeBytes) {
    throw makeError(HttpsError, 'failed-precondition', 'BOD report image file size does not match the verified attachment.');
  }
}

function sniffImageMime(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8
    && buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4e
    && buffer[3] === 0x47
    && buffer[4] === 0x0d
    && buffer[5] === 0x0a
    && buffer[6] === 0x1a
    && buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 12
    && buffer.toString('ascii', 0, 4) === 'RIFF'
    && buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return '';
}

function assertDownloadedBytes(buffer, attachment, HttpsError, maxBytes) {
  if (!Buffer.isBuffer(buffer) || buffer.length <= 0) {
    throw makeError(HttpsError, 'failed-precondition', 'BOD report image bytes are not valid.');
  }
  if (buffer.length !== attachment.sizeBytes || buffer.length > maxBytes) {
    throw makeError(HttpsError, 'failed-precondition', 'BOD report image size does not match the verified attachment.');
  }
  if (sniffImageMime(buffer) !== attachment.mimeType) {
    throw makeError(HttpsError, 'failed-precondition', 'BOD report image content type does not match the verified attachment.');
  }
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  if (sha256 !== attachment.sha256) {
    throw makeError(HttpsError, 'failed-precondition', 'BOD report image checksum does not match the verified attachment.');
  }
}

function createBodReportImageAccessService(options = {}) {
  const { db, HttpsError } = options;
  if (!db || !HttpsError) throw new Error('BOD report image access service requires db and HttpsError.');
  const maxBytes = Number.isSafeInteger(options.maxBytes) ? options.maxBytes : 15 * 1024 * 1024;
  let driveService = options.drive || null;

  function getDriveService() {
    if (!driveService) driveService = createBodEventDriveMetadataService(options);
    return driveService;
  }

  function eventRef(eventId) {
    return db.collection('bodEvents').doc(eventId);
  }

  function attachmentRef(eventId, fileId) {
    return eventRef(eventId).collection(BOD_EVENT_ATTACHMENTS_COLLECTION).doc(fileId);
  }

  async function getReportImage(uid, eventIdInput) {
    normalizeDocumentId(uid, 'Actor UID', HttpsError, 128);
    const eventId = normalizeDocumentId(eventIdInput, 'Event ID', HttpsError, 128);
    const eventSnap = await eventRef(eventId).get();
    if (!eventSnap.exists) throw makeError(HttpsError, 'not-found', 'BOD event not found.');
    const eventData = eventSnap.data() || {};
    const event = normalizeAuthoritativeBodUploadEvent(eventId, eventData, HttpsError);
    const fileId = normalizeSelectedReportImageFileId(eventData.reportImageFileId, HttpsError);
    const attachmentSnap = await attachmentRef(event.eventId, fileId).get();
    const attachment = normalizeAttachment(fileId, attachmentSnap, HttpsError, maxBytes);
    const drive = getDriveService();

    let folder;
    let file;
    let bytes;
    try {
      folder = normalizeDriveMetadata(await drive.getFolderMetadata(attachment.driveFolderId));
    } catch {
      throw makeError(HttpsError, 'failed-precondition', 'BOD report image folder is not valid.');
    }
    assertDriveFolder(folder, event, attachment, drive.rootFolderId, HttpsError);

    try {
      file = normalizeDriveMetadata(await drive.getFileMetadata(fileId));
    } catch {
      throw makeError(HttpsError, 'failed-precondition', 'BOD report image file is not valid.');
    }
    assertDriveFile(file, fileId, attachment, HttpsError);

    try {
      bytes = await drive.downloadFile(fileId);
    } catch {
      throw makeError(HttpsError, 'failed-precondition', 'BOD report image bytes are not available.');
    }
    assertDownloadedBytes(bytes, attachment, HttpsError, maxBytes);

    return {
      eventId: event.eventId,
      fileId,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      bytes,
    };
  }

  return {
    getReportImage,
  };
}

function getHeader(req, name) {
  if (!req) return '';
  if (typeof req.get === 'function') return req.get(name) || req.get(name.toLowerCase()) || '';
  return req.headers?.[name.toLowerCase()] || req.headers?.[name] || '';
}

function isAllowedOrigin(origin, allowedOrigins = []) {
  if (!origin) return true;
  return allowedOrigins.some((allowed) => {
    if (typeof allowed === 'string') return allowed === origin;
    return allowed instanceof RegExp && allowed.test(origin);
  });
}

function setCorsHeaders(req, res, allowedOrigins = []) {
  const origin = getHeader(req, 'origin');
  res.set('Vary', 'Origin');
  if (!isAllowedOrigin(origin, allowedOrigins)) return false;
  if (origin) res.set('Access-Control-Allow-Origin', origin);
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.set('Access-Control-Max-Age', '3600');
  return true;
}

function sendJson(res, status, payload) {
  return res.status(status)
    .set('Content-Type', 'application/json; charset=utf-8')
    .set('Cache-Control', 'private, no-store, max-age=0')
    .set('X-Content-Type-Options', 'nosniff')
    .send(JSON.stringify(payload));
}

function httpStatusFromError(err) {
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
  return byCode[err?.code] || 500;
}

function safeHttpMessage(err, status) {
  if (status >= 500) return 'BOD report image could not be downloaded.';
  return text(err?.message, 240) || 'BOD report image request was rejected.';
}

function safeHeaderFileName(fileName) {
  return text(fileName, 180).replace(/["\\\r\n]/g, ' ').trim() || 'report-image';
}

function bearerToken(req, HttpsError) {
  const header = String(getHeader(req, 'authorization') || '');
  if (!/^Bearer [^\s]+$/.test(header)) {
    throw makeError(HttpsError, 'unauthenticated', 'A valid sign-in token is required.');
  }
  return header.slice('Bearer '.length);
}

function createBodReportImageHttpHandler(options = {}) {
  const {
    admin,
    imageAccess,
    assertBodAdminOrPresident,
    assertApprovedActiveCallableAccount,
  } = options;
  if (!admin || !imageAccess || !assertBodAdminOrPresident || !assertApprovedActiveCallableAccount) {
    throw new Error('BOD report image HTTP handler requires auth, access service, and access checks.');
  }
  const allowedOrigins = options.allowedOrigins || [];
  const logger = options.logger || console;
  const HttpsError = options.HttpsError || class HttpHandlerError extends Error {
    constructor(code, message, details) {
      super(message);
      this.code = code;
      this.details = details;
    }
  };

  return async function downloadBodReportImage(req, res) {
    const corsAllowed = setCorsHeaders(req, res, allowedOrigins);
    if (!corsAllowed) {
      return sendJson(res, 403, { ok: false, code: 'permission-denied', message: 'Origin is not allowed.' });
    }
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'GET') {
      res.set('Allow', 'GET, OPTIONS');
      return sendJson(res, 405, { ok: false, code: 'method-not-allowed', message: 'GET required.' });
    }

    try {
      const token = bearerToken(req, HttpsError);
      let decoded;
      try {
        decoded = await admin.auth().verifyIdToken(token);
      } catch {
        throw makeError(HttpsError, 'unauthenticated', 'A valid sign-in token is required.');
      }
      const uid = normalizeDocumentId(decoded?.uid, 'Actor UID', HttpsError, 128);
      await Promise.all([
        assertBodAdminOrPresident(uid),
        assertApprovedActiveCallableAccount(uid),
      ]);
      if (req.query?.fileId !== undefined) {
        throw makeError(HttpsError, 'invalid-argument', 'Client file selection is not allowed.');
      }
      const image = await imageAccess.getReportImage(uid, req.query?.eventId);
      return res.status(200)
        .set('Content-Type', image.mimeType)
        .set('Content-Length', String(image.bytes.length))
        .set('Content-Disposition', `inline; filename="${safeHeaderFileName(image.fileName)}"`)
        .set('Cache-Control', 'private, no-store, max-age=0')
        .set('X-Content-Type-Options', 'nosniff')
        .set('Referrer-Policy', 'no-referrer')
        .send(image.bytes);
    } catch (err) {
      const status = httpStatusFromError(err);
      logger.warn('BOD report image download rejected.', {
        status,
        code: err?.code || 'internal',
        eventId: text(req.query?.eventId, 128),
      });
      return sendJson(res, status, {
        ok: false,
        code: status >= 500 ? 'internal' : (err?.code || 'internal'),
        message: safeHttpMessage(err, status),
      });
    }
  };
}

module.exports = {
  createBodReportImageAccessService,
  createBodReportImageHttpHandler,
  sniffImageMime,
};