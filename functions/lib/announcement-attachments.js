'use strict';

const crypto = require('crypto');
const { Readable } = require('stream');
const Busboy = require('@fastify/busboy');
const { createGoogleDriveClient } = require('./visit-drive');

const ANNOUNCEMENT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
const ANNOUNCEMENT_ATTACHMENT_EMAIL_MAX_BYTES = 10 * 1024 * 1024;
const ANNOUNCEMENT_ATTACHMENT_SESSION_COLLECTION = 'announcementAttachmentUploadSessions';
const ANNOUNCEMENT_ATTACHMENT_SESSION_TTL_MS = 30 * 60 * 1000;
const ANNOUNCEMENT_ATTACHMENT_RATE_COLLECTION = 'announcementAttachmentUploadRateLimits';
const ANNOUNCEMENT_ATTACHMENT_RATE_WINDOW_MS = 60 * 60 * 1000;
const ANNOUNCEMENT_ATTACHMENT_RATE_LIMIT = 12;
const ANNOUNCEMENT_ATTACHMENT_MIME_TYPES = Object.freeze([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const ANNOUNCEMENT_ATTACHMENT_ALLOWED_ORIGINS = Object.freeze([
  'https://rcph3131.org',
  'https://www.rcph3131.org',
  'https://rcph-admin.web.app',
  'https://rcph-admin.firebaseapp.com',
  'http://localhost:5000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

function serviceError(code, message, status = 400, details = {}) {
  return Object.assign(new Error(message), { code, httpsCode: code, status, details });
}

function text(value, max = 500) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function safeFileName(value, fallback = 'announcement-attachment') {
  const name = String(value == null ? '' : value)
    .split(/[\\/]/)
    .pop()
    .replace(/[\r\n"]/g, ' ')
    .replace(/[\\/:*?"<>|\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180)
    .trim();
  return name || fallback;
}

function safeHeaderFileName(value, fallback = 'announcement-attachment') {
  return safeFileName(value, fallback).replace(/[^\w .()[\]-]/g, '_').replace(/\s+/g, ' ').trim() || fallback;
}

function normalizeId(value, label = 'ID') {
  const id = text(value, 160);
  if (!id || id.includes('/') || /[\x00-\x1F\x7F]/.test(id)) throw serviceError('invalid-argument', `${label} is invalid.`);
  return id;
}

function proofHash(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function proofMatches(value, expectedHash) {
  const actual = Buffer.from(proofHash(value), 'hex');
  const expected = Buffer.from(String(expectedHash || ''), 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function normalizeMimeType(value) {
  const mimeType = text(value, 120).toLowerCase();
  if (!ANNOUNCEMENT_ATTACHMENT_MIME_TYPES.includes(mimeType)) {
    throw serviceError('invalid-argument', 'Unsupported attachment file type.');
  }
  return mimeType;
}

function attachmentKind(mimeType) {
  return mimeType === 'application/pdf' ? 'pdf' : 'image';
}

function normalizeSizeBytes(value) {
  const sizeBytes = Number(value);
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
    throw serviceError('invalid-argument', 'Valid attachment file size is required.');
  }
  if (sizeBytes > ANNOUNCEMENT_ATTACHMENT_MAX_BYTES) {
    throw serviceError('invalid-argument', 'Attachment file is too large.');
  }
  return sizeBytes;
}

function normalizeFileMetadata(input = {}) {
  const mimeType = normalizeMimeType(input.mimeType);
  return {
    filename: safeFileName(input.fileName || input.filename, 'announcement-attachment'),
    mimeType,
    sizeBytes: normalizeSizeBytes(input.sizeBytes),
    kind: attachmentKind(mimeType),
  };
}

function metadataMatches(left = {}, right = {}) {
  return safeFileName(left.filename) === safeFileName(right.filename)
    && normalizeMimeType(left.mimeType) === normalizeMimeType(right.mimeType)
    && normalizeSizeBytes(left.sizeBytes) === normalizeSizeBytes(right.sizeBytes)
    && attachmentKind(left.mimeType) === attachmentKind(right.mimeType);
}

function sniffMimeType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return '';
  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return '';
}

function assertFileBytesMatch(buffer, mimeType) {
  const detected = sniffMimeType(buffer);
  if (detected !== mimeType) {
    throw serviceError('invalid-argument', 'Uploaded attachment content does not match the selected file type.');
  }
}

function getSecretValue(options, name) {
  const boundSecret = options.secrets?.[name];
  if (boundSecret && typeof boundSecret.value === 'function') return boundSecret.value();
  if (typeof options.getSecret === 'function') return options.getSecret(name);
  return (options.env || process.env)[name];
}

function getAnnouncementDriveConfig(env = process.env) {
  const authMode = text(env.ANNOUNCEMENT_DRIVE_AUTH_MODE || env.RESOLUTION_DRIVE_AUTH_MODE || env.VISIT_DRIVE_AUTH_MODE || 'oauth', 40).toLowerCase();
  const folderId = text(env.ANNOUNCEMENT_ATTACHMENT_FOLDER_ID || env.RESOLUTION_SOURCE_FOLDER_ID, 300);
  if (!['oauth', 'shared-drive'].includes(authMode) || !folderId) {
    throw serviceError('failed-precondition', 'Announcement attachment storage is not configured.', 500);
  }
  return { authMode, folderId };
}

function createDriveClientFactory(options = {}) {
  let driveClient = options.driveClient || null;
  return function getDriveClient() {
    if (!driveClient) {
      const config = options.config || getAnnouncementDriveConfig(options.env || process.env);
      driveClient = createGoogleDriveClient({
        ...options,
        config: { authMode: config.authMode },
        getSecret: name => getSecretValue(options, name),
      });
    }
    return driveClient;
  };
}

function normalizeDriveFile(raw = {}) {
  return {
    id: text(raw.id, 300),
    name: text(raw.name, 300),
    mimeType: text(raw.mimeType, 120),
    sizeBytes: Math.max(0, Number(raw.size) || 0),
    parents: Array.isArray(raw.parents) ? raw.parents.map(item => text(item, 300)).filter(Boolean) : [],
    appProperties: raw.appProperties && typeof raw.appProperties === 'object' ? { ...raw.appProperties } : {},
    trashed: raw.trashed === true,
  };
}

function parseMultipart(req, maxBytes = ANNOUNCEMENT_ATTACHMENT_MAX_BYTES) {
  const contentType = String(req.headers?.['content-type'] || req.get?.('content-type') || '');
  if (!/^multipart\/form-data\b/i.test(contentType)) {
    return Promise.reject(serviceError('invalid-argument', 'Attachment upload must be multipart form data.', 415));
  }
  return new Promise((resolve, reject) => {
    const fields = {};
    const chunks = [];
    let fileInfo = null;
    let failed = null;
    const busboy = new Busboy({ headers: req.headers || {}, limits: { files: 1, fileSize: maxBytes, fields: 8, parts: 12 } });
    busboy.on('field', (name, value) => {
      if (Object.prototype.hasOwnProperty.call(fields, name)) {
        failed = serviceError('invalid-argument', 'Duplicate upload metadata fields are not allowed.');
        return;
      }
      fields[name] = String(value || '').slice(0, 500);
    });
    busboy.on('file', (fieldName, stream, infoOrName, encoding, legacyMime) => {
      if (fieldName !== 'file' || fileInfo) {
        failed = serviceError('invalid-argument', 'Only one attachment file may be uploaded.');
        stream.resume();
        return;
      }
      const info = typeof infoOrName === 'object' ? infoOrName : { filename: infoOrName, mimeType: legacyMime, encoding };
      fileInfo = { filename: safeFileName(info.filename), mimeType: text(info.mimeType, 120).toLowerCase(), sizeBytes: 0 };
      stream.on('data', chunk => {
        fileInfo.sizeBytes += chunk.length;
        chunks.push(chunk);
      });
      stream.on('limit', () => { failed = serviceError('invalid-argument', 'Attachment file is too large.', 413); });
      stream.on('error', () => { failed = serviceError('invalid-argument', 'Attachment upload could not be read.'); });
    });
    busboy.on('error', () => reject(serviceError('invalid-argument', 'Attachment upload could not be read.')));
    busboy.on('finish', () => {
      if (failed) return reject(failed);
      if (!fileInfo || !chunks.length) return reject(serviceError('invalid-argument', 'Attachment file is required.'));
      const buffer = Buffer.concat(chunks);
      resolve({ fields, file: { ...fileInfo, buffer, sizeBytes: buffer.length } });
    });
    if (Buffer.isBuffer(req.rawBody)) busboy.end(req.rawBody);
    else req.pipe(busboy);
  });
}

function setCors(req, res, methods = 'GET, POST, OPTIONS') {
  const origin = String(req.get?.('origin') || req.headers?.origin || '');
  const local = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
  if (ANNOUNCEMENT_ATTACHMENT_ALLOWED_ORIGINS.includes(origin) || local) res.set('Access-Control-Allow-Origin', origin);
  res.set('Vary', 'Origin');
  res.set('Access-Control-Allow-Methods', methods);
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.set('Access-Control-Max-Age', '3600');
}

function sendJson(res, status, payload) {
  return res.status(status).set('Cache-Control', 'no-store').json(payload);
}

function createAnnouncementAttachmentService(options = {}) {
  const { db, admin, logger = console } = options;
  const now = () => admin.firestore.Timestamp.now();
  const getDriveClient = createDriveClientFactory(options);

  function getConfig() {
    return options.config || getAnnouncementDriveConfig(options.env || process.env);
  }

  async function createDriveFile({ sessionId, uploaderUid, metadata, bytes }) {
    const config = getConfig();
    const hash = sha256(bytes);
    const response = await getDriveClient().files.create({
      requestBody: {
        name: metadata.filename,
        mimeType: metadata.mimeType,
        parents: [config.folderId],
        appProperties: {
          documentType: 'announcement-attachment',
          attachmentSessionId: sessionId,
          uploaderUid,
          sha256: hash,
          kind: metadata.kind,
        },
      },
      media: { mimeType: metadata.mimeType, body: Readable.from(bytes) },
      fields: 'id,name,mimeType,size,parents,appProperties,trashed',
      supportsAllDrives: true,
    });
    const file = normalizeDriveFile(response.data);
    if (!file.id) throw serviceError('internal', 'Google Drive did not return an attachment file ID.', 500);
    return { file, sha256: hash };
  }

  async function getDriveFile(fileId) {
    const response = await getDriveClient().files.get({
      fileId: text(fileId, 300),
      fields: 'id,name,mimeType,size,parents,appProperties,trashed',
      supportsAllDrives: true,
    });
    return normalizeDriveFile(response.data);
  }

  async function deleteDriveFile(fileId) {
    if (!text(fileId, 300)) return;
    await getDriveClient().files.delete({ fileId: text(fileId, 300), supportsAllDrives: true });
  }

  async function downloadDriveFile(fileId) {
    const response = await getDriveClient().files.get({
      fileId: text(fileId, 300),
      alt: 'media',
      supportsAllDrives: true,
    }, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  }

  function assertTrustedDriveFile(file, attachment) {
    const config = getConfig();
    if (!file?.id || file.trashed || file.mimeType !== attachment.mimeType || !file.parents.includes(config.folderId)) {
      throw serviceError('not-found', 'Announcement attachment is unavailable.', 404);
    }
    const props = file.appProperties || {};
    if (props.documentType !== 'announcement-attachment'
      || props.attachmentSessionId !== attachment.uploadSessionId
      || props.sha256 !== attachment.sha256
      || props.kind !== attachment.kind) {
      throw serviceError('permission-denied', 'Announcement attachment metadata does not match.', 403);
    }
    return file;
  }

  async function createUploadSession(uid, input = {}) {
    const actor = await options.getManagerContext(uid);
    const expected = normalizeFileMetadata(input);
    const createdAt = now();
    const expiresAt = admin.firestore.Timestamp.fromMillis(createdAt.toMillis() + ANNOUNCEMENT_ATTACHMENT_SESSION_TTL_MS);
    const proof = crypto.randomBytes(32).toString('base64url');
    const sessionRef = db.collection(ANNOUNCEMENT_ATTACHMENT_SESSION_COLLECTION).doc();
    const rateRef = db.collection(ANNOUNCEMENT_ATTACHMENT_RATE_COLLECTION).doc(crypto.createHash('sha256').update(uid).digest('hex'));
    await db.runTransaction(async tx => {
      const rateSnap = await tx.get(rateRef);
      const rate = rateSnap.exists ? rateSnap.data() || {} : {};
      const windowStart = rate.windowStartedAt?.toMillis?.() || 0;
      const inWindow = createdAt.toMillis() - windowStart < ANNOUNCEMENT_ATTACHMENT_RATE_WINDOW_MS;
      const count = inWindow ? Number(rate.count) || 0 : 0;
      if (count >= ANNOUNCEMENT_ATTACHMENT_RATE_LIMIT) {
        throw serviceError('resource-exhausted', 'Attachment upload rate limit reached. Try again later.', 429);
      }
      tx.set(rateRef, { uid, count: count + 1, windowStartedAt: inWindow ? rate.windowStartedAt : createdAt, updatedAt: createdAt }, { merge: true });
      tx.create(sessionRef, {
        uid,
        actorName: text(actor.name || actor.role || uid, 160),
        status: 'pending',
        expected,
        proofHash: proofHash(proof),
        createdAt,
        updatedAt: createdAt,
        expiresAt,
        driveFileId: '',
        sha256: '',
        announcementId: '',
      });
    });
    return {
      ok: true,
      sessionId: sessionRef.id,
      proof,
      uploadEndpoint: options.uploadEndpoint || 'https://us-central1-rcph-admin.cloudfunctions.net/uploadAnnouncementAttachment',
      maxSizeBytes: ANNOUNCEMENT_ATTACHMENT_MAX_BYTES,
      expiresAt: expiresAt.toDate().toISOString(),
      attachment: { ...expected, status: 'pending' },
    };
  }

  async function uploadHttp(req, res) {
    setCors(req, res, 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, code: 'method-not-allowed', message: 'POST required.' });
    let sessionRef = null;
    let createdDriveFileId = '';
    try {
      const { fields, file } = await parseMultipart(req);
      const sessionId = normalizeId(fields.sessionId, 'Upload session ID');
      const suppliedProof = text(fields.proof, 200);
      const supplied = normalizeFileMetadata({
        fileName: fields.fileName || file.filename,
        mimeType: fields.mimeType || file.mimeType,
        sizeBytes: fields.sizeBytes || file.sizeBytes,
      });
      if (file.sizeBytes !== supplied.sizeBytes) throw serviceError('invalid-argument', 'Uploaded attachment size does not match the approved session.');
      assertFileBytesMatch(file.buffer, supplied.mimeType);
      sessionRef = db.collection(ANNOUNCEMENT_ATTACHMENT_SESSION_COLLECTION).doc(sessionId);
      const sessionSnap = await sessionRef.get();
      if (!sessionSnap.exists) throw serviceError('not-found', 'Attachment upload session not found.', 404);
      const session = sessionSnap.data() || {};
      if (!proofMatches(suppliedProof, session.proofHash)) throw serviceError('permission-denied', 'Attachment upload session is invalid.', 403);
      if (session.status !== 'pending') throw serviceError('already-exists', 'Attachment upload session was already used.', 409);
      if (!session.expiresAt?.toMillis || session.expiresAt.toMillis() <= Date.now()) throw serviceError('failed-precondition', 'Attachment upload session expired.', 410);
      if (!metadataMatches(supplied, session.expected || {})) {
        throw serviceError('failed-precondition', 'Selected attachment does not match the upload session.', 412);
      }
      await sessionRef.update({ status: 'uploading', updatedAt: now() });
      const { file: driveFile, sha256: contentHash } = await createDriveFile({ sessionId, uploaderUid: session.uid, metadata: supplied, bytes: file.buffer });
      createdDriveFileId = driveFile.id;
      const uploadedAt = now();
      await sessionRef.update({
        status: 'uploaded',
        driveFileId: driveFile.id,
        sha256: contentHash,
        uploadedAt,
        updatedAt: uploadedAt,
      });
      createdDriveFileId = '';
      return sendJson(res, 200, {
        ok: true,
        sessionId,
        attachment: {
          ...supplied,
          status: 'ready',
          uploadedAt: uploadedAt.toDate().toISOString(),
        },
      });
    } catch (error) {
      if (createdDriveFileId) await deleteDriveFile(createdDriveFileId).catch(deleteError => logger.warn('Announcement attachment orphan cleanup failed.', { code: deleteError.code || 'drive-delete-failed' }));
      if (sessionRef) await sessionRef.set({ status: 'failed', errorCode: String(error.code || 'upload-failed').slice(0, 80), updatedAt: now() }, { merge: true }).catch(() => {});
      const status = Number(error.status) || (error.code === 'deadline-exceeded' ? 410 : 400);
      logger.warn('Announcement attachment upload rejected.', { code: error.code || 'upload-failed' });
      return sendJson(res, status, { ok: false, code: error.code || 'upload-failed', message: error.message || 'Attachment upload failed.' });
    }
  }

  function reportSafeAttachment(attachment = {}) {
    try {
      if (!attachment || attachment.status !== 'ready') return null;
      const mimeType = normalizeMimeType(attachment.mimeType);
      return {
        status: 'ready',
        filename: safeFileName(attachment.filename),
        mimeType,
        sizeBytes: normalizeSizeBytes(attachment.sizeBytes),
        kind: attachmentKind(mimeType),
        uploadedAt: attachment.uploadedAt?.toDate?.()?.toISOString?.() || '',
      };
    } catch {
      return null;
    }
  }

  async function reserveForPublish(uid, sessionId, announcementId) {
    const safeSessionId = normalizeId(sessionId, 'Attachment session ID');
    const safeAnnouncementId = normalizeId(announcementId, 'Announcement ID');
    const sessionRef = db.collection(ANNOUNCEMENT_ATTACHMENT_SESSION_COLLECTION).doc(safeSessionId);
    let attachment = null;
    await db.runTransaction(async tx => {
      const snap = await tx.get(sessionRef);
      if (!snap.exists) throw serviceError('not-found', 'Attachment upload session not found.', 404);
      const session = snap.data() || {};
      if (session.uid !== uid) throw serviceError('permission-denied', 'Attachment upload session belongs to another account.', 403);
      if (session.status !== 'uploaded') throw serviceError('failed-precondition', 'Attachment upload is not ready.', 412);
      if (!session.expiresAt?.toMillis || session.expiresAt.toMillis() <= Date.now()) throw serviceError('failed-precondition', 'Attachment upload session expired.', 410);
      const expected = session.expected || {};
      if (!session.driveFileId || !session.sha256) throw serviceError('failed-precondition', 'Attachment upload is incomplete.', 412);
      attachment = {
        status: 'ready',
        storageProvider: 'google_drive',
        driveFileId: text(session.driveFileId, 300),
        uploadSessionId: safeSessionId,
        filename: safeFileName(expected.filename),
        mimeType: normalizeMimeType(expected.mimeType),
        sizeBytes: normalizeSizeBytes(expected.sizeBytes),
        kind: attachmentKind(expected.mimeType),
        sha256: text(session.sha256, 128),
        uploadedAt: session.uploadedAt || session.updatedAt || now(),
        uploadedByUid: uid,
      };
      tx.update(sessionRef, { status: 'publishing', announcementId: safeAnnouncementId, updatedAt: now() });
    });
    const driveFile = await getDriveFile(attachment.driveFileId);
    assertTrustedDriveFile(driveFile, attachment);
    return attachment;
  }

  async function markPublished(uid, sessionId, announcementId) {
    const sessionRef = db.collection(ANNOUNCEMENT_ATTACHMENT_SESSION_COLLECTION).doc(normalizeId(sessionId, 'Attachment session ID'));
    await db.runTransaction(async tx => {
      const snap = await tx.get(sessionRef);
      if (!snap.exists) return;
      const session = snap.data() || {};
      if (session.uid !== uid || session.announcementId !== announcementId || session.status !== 'publishing') return;
      tx.update(sessionRef, { status: 'attached', attachedAt: now(), updatedAt: now() });
    });
  }

  async function releaseReservation(uid, sessionId, announcementId) {
    if (!sessionId) return;
    const sessionRef = db.collection(ANNOUNCEMENT_ATTACHMENT_SESSION_COLLECTION).doc(normalizeId(sessionId, 'Attachment session ID'));
    await db.runTransaction(async tx => {
      const snap = await tx.get(sessionRef);
      if (!snap.exists) return;
      const session = snap.data() || {};
      if (session.uid !== uid || session.announcementId !== announcementId || session.status !== 'publishing') return;
      tx.update(sessionRef, { status: 'uploaded', announcementId: '', updatedAt: now() });
    }).catch(error => logger.warn('Announcement attachment reservation release failed.', { code: error.code || 'release-failed' }));
  }

  async function removeUpload(uid, input = {}) {
    await options.getManagerContext(uid);
    const sessionId = normalizeId(input.sessionId, 'Attachment session ID');
    const sessionRef = db.collection(ANNOUNCEMENT_ATTACHMENT_SESSION_COLLECTION).doc(sessionId);
    let driveFileId = '';
    await db.runTransaction(async tx => {
      const snap = await tx.get(sessionRef);
      if (!snap.exists) return;
      const session = snap.data() || {};
      if (session.uid !== uid) throw serviceError('permission-denied', 'Attachment upload session belongs to another account.', 403);
      if (session.status === 'attached' || session.status === 'publishing') throw serviceError('failed-precondition', 'This attachment is already bound to an announcement.', 412);
      driveFileId = text(session.driveFileId, 300);
      tx.set(sessionRef, { status: 'cancelled', cancelledAt: now(), updatedAt: now() }, { merge: true });
    });
    if (driveFileId) await deleteDriveFile(driveFileId).catch(error => logger.warn('Announcement attachment remove cleanup failed.', { code: error.code || 'drive-delete-failed' }));
    return { ok: true, removed: Boolean(driveFileId) };
  }

  async function downloadAttachmentBytes(attachment) {
    if (!attachment?.driveFileId || attachment.status !== 'ready') throw serviceError('not-found', 'Announcement attachment is unavailable.', 404);
    const file = assertTrustedDriveFile(await getDriveFile(attachment.driveFileId), attachment);
    const bytes = await downloadDriveFile(file.id);
    if (sha256(bytes) !== attachment.sha256) throw serviceError('failed-precondition', 'Announcement attachment checksum does not match.', 412);
    return { bytes, file };
  }

  function emailAttachmentFromBytes(attachment, bytes) {
    if (!attachment || !bytes) return null;
    if (attachment.sizeBytes > ANNOUNCEMENT_ATTACHMENT_EMAIL_MAX_BYTES || bytes.length > ANNOUNCEMENT_ATTACHMENT_EMAIL_MAX_BYTES) {
      throw serviceError('failed-precondition', 'Attachment is too large for announcement email delivery.', 412);
    }
    return {
      filename: safeHeaderFileName(attachment.filename),
      contentType: attachment.mimeType,
      content: bytes,
    };
  }

  async function streamDownload(req, res, canAccessAnnouncement) {
    setCors(req, res, 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'GET') return sendJson(res, 405, { ok: false, code: 'method-not-allowed', message: 'GET required.' });
    try {
      const match = String(req.get?.('authorization') || req.headers?.authorization || '').match(/^Bearer\s+(.+)$/i);
      if (!match) throw serviceError('unauthenticated', 'Authentication required.', 401);
      const token = await admin.auth().verifyIdToken(match[1]).catch(() => null);
      if (!token?.uid) throw serviceError('unauthenticated', 'Authentication required.', 401);
      const announcementId = normalizeId(req.query?.announcementId, 'Announcement ID');
      const announcement = await canAccessAnnouncement(token.uid, announcementId);
      const attachment = announcement?.attachment;
      if (!attachment || attachment.status !== 'ready') throw serviceError('not-found', 'Announcement attachment is unavailable.', 404);
      const { bytes } = await downloadAttachmentBytes(attachment);
      const dispositionType = req.query?.download === '1' || req.query?.disposition === 'attachment' ? 'attachment' : 'inline';
      const fileName = safeHeaderFileName(attachment.filename);
      res.status(200).set({
        'Content-Type': attachment.mimeType,
        'Content-Length': String(bytes.length),
        'Content-Disposition': `${dispositionType}; filename="${fileName}"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      });
      return res.send(bytes);
    } catch (error) {
      const status = Number(error.status) || 403;
      return sendJson(res, status, { ok: false, code: error.code || 'permission-denied', message: error.message || 'Attachment could not be downloaded.' });
    }
  }

  async function cleanupExpiredSessions(limit = 50) {
    const snap = await db
      .collection(ANNOUNCEMENT_ATTACHMENT_SESSION_COLLECTION)
      .where('expiresAt', '<=', now())
      .limit(Math.max(1, Math.min(Number(limit) || 50, 100)))
      .get();
    let cleaned = 0;
    for (const doc of snap.docs) {
      const session = doc.data() || {};
      if (['attached', 'cancelled', 'expired'].includes(session.status)) continue;
      const driveFileId = text(session.driveFileId, 300);
      if (driveFileId) await deleteDriveFile(driveFileId).catch(error => logger.warn('Expired announcement attachment cleanup failed.', { code: error.code || 'drive-delete-failed' }));
      await doc.ref.set({ status: 'expired', updatedAt: now() }, { merge: true });
      cleaned += 1;
    }
    return { ok: true, cleaned };
  }

  return {
    cleanupExpiredSessions,
    createUploadSession,
    downloadAttachmentBytes,
    emailAttachmentFromBytes,
    markPublished,
    releaseReservation,
    removeUpload,
    reportSafeAttachment,
    reserveForPublish,
    streamDownload,
    uploadHttp,
  };
}

module.exports = {
  ANNOUNCEMENT_ATTACHMENT_EMAIL_MAX_BYTES,
  ANNOUNCEMENT_ATTACHMENT_MAX_BYTES,
  ANNOUNCEMENT_ATTACHMENT_MIME_TYPES,
  ANNOUNCEMENT_ATTACHMENT_SESSION_COLLECTION,
  createAnnouncementAttachmentService,
  getAnnouncementDriveConfig,
  normalizeFileMetadata,
  sniffMimeType,
};
