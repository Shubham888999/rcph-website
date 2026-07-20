'use strict';

const admin = require('firebase-admin');
const crypto = require('crypto');
const { Readable } = require('stream');
const Busboy = require('@fastify/busboy');
const nodemailer = require('nodemailer');
const { logger } = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');
const { HttpsError, onCall, onRequest } = require('firebase-functions/v2/https');
const { createGoogleDriveClient } = require('./visit-drive');
const {
  MOM_DRIVE_FOLDER_NAME,
  MOM_PDF_MAX_BYTES,
  MOM_SESSION_COLLECTION,
  MOM_EMAIL_HISTORY_COLLECTION,
  MOM_EMAIL_MAX_RECIPIENTS,
  MOM_TARGET_TYPES,
  buildMomMetadata,
  dedupeMomRecipients,
  canUploadMomAccess,
  canViewMomAccess,
  cleanLower,
  cleanText,
  isCanonicalBodMomTargetData,
  isPdfBuffer,
  momDriveSubfolderName,
  momRecipientMatchesGroups,
  momRecipientRequestLabel,
  normalizeMomAccess,
  normalizePositionKeys,
  normalizeMomEmailAddress,
  safeDocumentId,
  safeMomFileName,
  serializeMomMetadata,
  validateMomEmailRequest,
  validateMomFileDescriptor,
  validateMomTarget,
} = require('./momCore');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const auth = admin.auth();
const EMAIL_USER = process.env.EMAIL_USER || process.env.SMTP_USER || '';
const EMAIL_PASS = process.env.EMAIL_PASS || process.env.SMTP_PASS || '';
const momEmailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});
const VISIT_DRIVE_CLIENT_ID = defineSecret('VISIT_DRIVE_CLIENT_ID');
const VISIT_DRIVE_CLIENT_SECRET = defineSecret('VISIT_DRIVE_CLIENT_SECRET');
const VISIT_DRIVE_REFRESH_TOKEN = defineSecret('VISIT_DRIVE_REFRESH_TOKEN');
const MOM_DRIVE_SECRETS = [
  VISIT_DRIVE_CLIENT_ID,
  VISIT_DRIVE_CLIENT_SECRET,
  VISIT_DRIVE_REFRESH_TOKEN,
];
const MOM_ALLOWED_ORIGINS = Object.freeze([
  'https://rcph3131.org',
  'https://www.rcph3131.org',
  'https://rcph-admin.web.app',
  'https://rcph-admin.firebaseapp.com',
  'http://localhost:5000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
]);
const MOM_BASE_OPTIONS = {
  region: 'us-central1',
  cors: MOM_ALLOWED_ORIGINS,
};
const MOM_DRIVE_OPTIONS = {
  ...MOM_BASE_OPTIONS,
  secrets: MOM_DRIVE_SECRETS,
  timeoutSeconds: 120,
  memory: '512MiB',
};
const ROLE_COLLECTIONS = ['roles', 'userRoles', 'access'];
const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';

function projectId() {
  if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;
  if (process.env.GCP_PROJECT) return process.env.GCP_PROJECT;
  try {
    return JSON.parse(process.env.FIREBASE_CONFIG || '{}').projectId || '';
  } catch {
    return '';
  }
}

function publicEndpoint(name) {
  const explicit = cleanText(process.env[`MOM_${name.toUpperCase()}_ENDPOINT`], 1000);
  if (explicit) return explicit.replace(/\/$/, '');
  const configuredUpload = name === 'uploadMomPdf'
    ? cleanText(process.env.MOM_PDF_UPLOAD_ENDPOINT, 1000)
    : '';
  if (configuredUpload) return configuredUpload.replace(/\/$/, '');
  const project = projectId();
  return project ? `https://us-central1-${project}.cloudfunctions.net/${name}` : '';
}

function hashSecret(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function secureHashMatches(secret, expectedHash) {
  const expected = Buffer.from(cleanText(expectedHash, 128), 'hex');
  const actual = Buffer.from(hashSecret(secret), 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
}

function sessionTtlMs() {
  const minutes = Number(process.env.MOM_UPLOAD_SESSION_TTL_MINUTES || 30);
  return Number.isFinite(minutes) && minutes >= 5 && minutes <= 240
    ? Math.round(minutes * 60 * 1000)
    : 30 * 60 * 1000;
}

function toHttpsError(result) {
  return new HttpsError(result.code || 'invalid-argument', result.message || 'Invalid MOM request.');
}

function httpCodeForError(code) {
  if (code === 401) return 401;
  if (code === 403) return 403;
  if (code === 404) return 404;
  if (code === 413) return 413;
  if (code === 'unauthenticated') return 401;
  if (code === 'permission-denied') return 403;
  if (code === 'not-found') return 404;
  if (code === 'resource-exhausted') return 413;
  if (code === 'failed-precondition' || code === 'already-exists') return 409;
  return 400;
}

function sendJson(res, status, payload) {
  return res
    .status(status)
    .set('Cache-Control', 'no-store')
    .json(payload);
}

function publicErrorCode(error) {
  if (error instanceof HttpsError) return error.code;
  if (error?.code === 401 || error?.response?.status === 401) return 'unauthenticated';
  if (error?.code === 403 || error?.response?.status === 403) return 'permission-denied';
  if (error?.code === 404 || error?.response?.status === 404) return 'not-found';
  if (typeof error?.code === 'string') return error.code;
  return '';
}

function originAllowed(origin) {
  if (!origin) return false;
  return MOM_ALLOWED_ORIGINS.some((allowed) => {
    if (typeof allowed === 'string') return allowed === origin;
    return allowed.test(origin);
  });
}

function applyCors(req, res, methods = 'GET, POST, OPTIONS') {
  const origin = cleanText(req.get?.('origin') || req.headers?.origin, 1000);
  if (originAllowed(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  }
  res.set('Vary', 'Origin');
  res.set('Access-Control-Allow-Methods', methods);
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.set('Access-Control-Max-Age', '3600');
}

function handlePreflight(req, res, methods) {
  applyCors(req, res, methods);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return true;
  }
  return false;
}

async function activePositionKeysForUid(uid) {
  const snap = await db.collection('bodPositionAssignments').where('uid', '==', uid).get().catch(() => null);
  if (!snap) return [];
  return snap.docs
    .map(doc => doc.data() || {})
    .filter(assignment => assignment.active === true)
    .map(assignment => cleanText(assignment.positionKey, 80))
    .filter(Boolean);
}

async function resolveMomAccess(uid, token = {}) {
  const userRef = db.collection('users').doc(uid);
  const roleRefs = ROLE_COLLECTIONS.map(collectionName => db.collection(collectionName).doc(uid));
  const [userSnap, assignmentKeys, ...roleSnaps] = await Promise.all([
    userRef.get(),
    activePositionKeysForUid(uid),
    ...roleRefs.map(ref => ref.get().catch(() => null)),
  ]);
  const user = userSnap.exists ? userSnap.data() || {} : {};
  const roleSnap = roleSnaps.find(snapshot => snapshot?.exists);
  const role = roleSnap?.exists ? roleSnap.data() || {} : user;
  const mergedUser = { ...user, positionKeys: [...(Array.isArray(user.positionKeys) ? user.positionKeys : []), ...assignmentKeys] };
  const mergedRole = { ...role, positionKeys: [...(Array.isArray(role.positionKeys) ? role.positionKeys : []), ...assignmentKeys] };
  return normalizeMomAccess({ uid, user: mergedUser, role: mergedRole, token });
}

async function requireCallableAccess(request, mode) {
  const uid = request.auth?.uid || '';
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in before using MOM.');
  const access = await resolveMomAccess(uid, request.auth?.token || {});
  const allowed = mode === 'view' ? canViewMomAccess(access) : canUploadMomAccess(access);
  if (!allowed) {
    throw new HttpsError('permission-denied', 'Your account is not authorized for this MOM action.');
  }
  return access;
}

async function requireHttpAccess(req, mode) {
  const header = cleanText(req.get?.('authorization') || req.headers?.authorization, 2000);
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    const error = new Error('Sign in before opening MOM.');
    error.code = 'unauthenticated';
    throw error;
  }
  const token = await auth.verifyIdToken(match[1]).catch(() => null);
  if (!token?.uid) {
    const error = new Error('Sign in before opening MOM.');
    error.code = 'unauthenticated';
    throw error;
  }
  const access = await resolveMomAccess(token.uid, token);
  const allowed = mode === 'view' ? canViewMomAccess(access) : canUploadMomAccess(access);
  if (!allowed) {
    const error = new Error('Your account is not authorized for this MOM action.');
    error.code = 'permission-denied';
    throw error;
  }
  return access;
}

async function getTargetOrThrow(target) {
  const valid = validateMomTarget(target);
  if (!valid.ok) throw toHttpsError(valid);
  const ref = db.collection(valid.collectionName).doc(valid.targetId);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new HttpsError('not-found', 'The event or meeting was not found.');
  }
  const data = snapshot.data() || {};
  if (valid.targetType === MOM_TARGET_TYPES.BOD_EVENT && !isCanonicalBodMomTargetData(data)) {
    throw new HttpsError('failed-precondition', 'MOM is only available on canonical BOD event records.');
  }
  return { ...valid, ref, snapshot, data };
}

function sessionExpired(session) {
  return typeof session?.expiresAt?.toMillis === 'function'
    ? session.expiresAt.toMillis() <= Date.now()
    : true;
}

function escapeDriveQuery(value) {
  return cleanText(value, 500).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function cleanDriveId(value) {
  return cleanText(value, 300).replace(/[^A-Za-z0-9_-]/g, '');
}

function momDriveAuthMode() {
  const mode = cleanLower(process.env.MOM_DRIVE_AUTH_MODE || process.env.RESOLUTION_DRIVE_AUTH_MODE || process.env.VISIT_DRIVE_AUTH_MODE || 'oauth', 40);
  return mode === 'shared-drive' ? 'shared-drive' : 'oauth';
}

function driveClient() {
  return createGoogleDriveClient({
    config: { authMode: momDriveAuthMode() },
    secrets: {
      VISIT_DRIVE_CLIENT_ID,
      VISIT_DRIVE_CLIENT_SECRET,
      VISIT_DRIVE_REFRESH_TOKEN,
    },
    env: process.env,
  });
}

async function findDriveFolder(drive, name, parentId = '') {
  const parentQuery = parentId ? ` and '${escapeDriveQuery(parentId)}' in parents` : '';
  const response = await drive.files.list({
    q: `mimeType='${DRIVE_FOLDER_MIME}' and trashed=false and name='${escapeDriveQuery(name)}'${parentQuery}`,
    fields: 'files(id,name)',
    pageSize: 1,
    spaces: 'drive',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return response.data.files?.[0]?.id || '';
}

async function ensureDriveFolder(drive, name, parentId = '') {
  const existing = await findDriveFolder(drive, name, parentId);
  if (existing) return existing;
  const response = await drive.files.create({
    requestBody: {
      name: cleanText(name, 160),
      mimeType: DRIVE_FOLDER_MIME,
      ...(parentId ? { parents: [parentId] } : {}),
    },
    fields: 'id,name',
    supportsAllDrives: true,
  });
  return response.data.id;
}

async function ensureMomDriveFolder(drive, targetType) {
  const configuredRoot = cleanDriveId(process.env.MOM_DRIVE_ROOT_FOLDER_ID);
  const parentId = cleanDriveId(process.env.MOM_DRIVE_PARENT_FOLDER_ID);
  const rootName = cleanText(process.env.MOM_DRIVE_ROOT_FOLDER_NAME, 160) || MOM_DRIVE_FOLDER_NAME;
  const rootId = configuredRoot || await ensureDriveFolder(drive, rootName, parentId);
  return ensureDriveFolder(drive, momDriveSubfolderName(targetType), rootId);
}

async function uploadDrivePdf({ targetType, fileName, buffer }) {
  const drive = driveClient();
  const folderId = await ensureMomDriveFolder(drive, targetType);
  const response = await drive.files.create({
    requestBody: {
      name: safeMomFileName(fileName),
      mimeType: 'application/pdf',
      parents: [folderId],
    },
    media: {
      mimeType: 'application/pdf',
      body: Readable.from(buffer),
    },
    fields: 'id,name,mimeType,size,createdTime,modifiedTime',
    supportsAllDrives: true,
  });
  return {
    driveFileId: cleanText(response.data.id, 180),
    fileName: cleanText(response.data.name, 180) || safeMomFileName(fileName),
    mimeType: cleanText(response.data.mimeType, 120) || 'application/pdf',
    sizeBytes: Number(response.data.size) || buffer.length,
    folderId,
  };
}

function parseMultipartUpload(req) {
  const contentType = cleanText(req.get?.('content-type') || req.headers?.['content-type'], 500);
  if (!/^multipart\/form-data\b/i.test(contentType)) {
    return Promise.reject(Object.assign(new Error('Upload request must be multipart/form-data.'), { code: 'invalid-argument', status: 415 }));
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    let fileCount = 0;
    const fields = {};
    const chunks = [];
    const fileInfo = { fileName: '', mimeType: '', sizeBytes: 0, buffer: null };

    function fail(error) {
      if (settled) return;
      settled = true;
      reject(error);
    }

    const busboy = new Busboy({
      headers: req.headers || {},
      limits: {
        files: 1,
        fileSize: MOM_PDF_MAX_BYTES,
        fields: 20,
        parts: 30,
      },
    });

    busboy.on('field', (name, value) => {
      if (Object.prototype.hasOwnProperty.call(fields, name)) {
        fail(Object.assign(new Error('Duplicate upload metadata fields are not allowed.'), { code: 'invalid-argument' }));
        return;
      }
      fields[cleanText(name, 80)] = cleanText(value, 2000);
    });

    busboy.on('file', (fieldName, stream, infoOrName, encoding, legacyMime) => {
      fileCount += 1;
      if (fieldName !== 'file' || fileCount > 1) {
        stream.resume();
        fail(Object.assign(new Error('Only one MOM PDF may be uploaded.'), { code: 'invalid-argument' }));
        return;
      }
      const info = typeof infoOrName === 'object'
        ? infoOrName
        : { filename: infoOrName, mimeType: legacyMime, encoding };
      fileInfo.fileName = cleanText(info.filename, 180);
      fileInfo.mimeType = cleanText(info.mimeType, 120).toLowerCase() || 'application/pdf';
      stream.on('data', chunk => {
        fileInfo.sizeBytes += chunk.length;
        chunks.push(chunk);
      });
      stream.on('limit', () => fail(Object.assign(new Error('The selected MOM PDF is larger than 10 MB.'), { code: 'resource-exhausted', status: 413 })));
      stream.on('error', () => fail(Object.assign(new Error('The selected MOM PDF could not be read.'), { code: 'invalid-argument' })));
    });

    busboy.on('filesLimit', () => fail(Object.assign(new Error('Only one MOM PDF may be uploaded.'), { code: 'invalid-argument' })));
    busboy.on('fieldsLimit', () => fail(Object.assign(new Error('Too many upload metadata fields.'), { code: 'invalid-argument' })));
    busboy.on('partsLimit', () => fail(Object.assign(new Error('Too many multipart request parts.'), { code: 'invalid-argument' })));
    busboy.on('error', () => fail(Object.assign(new Error('Malformed multipart upload request.'), { code: 'invalid-argument' })));
    busboy.on('finish', () => {
      if (settled) return;
      if (fileCount !== 1 || !chunks.length) {
        fail(Object.assign(new Error('Choose a MOM PDF file.'), { code: 'invalid-argument' }));
        return;
      }
      settled = true;
      fileInfo.buffer = Buffer.concat(chunks);
      fileInfo.sizeBytes = fileInfo.buffer.length;
      resolve({ fields, file: fileInfo });
    });

    if (Buffer.isBuffer(req.rawBody)) busboy.end(req.rawBody);
    else req.pipe(busboy);
  });
}

function momEmailTimestampIso(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value.toDate === 'function') {
    const date = value.toDate();
    return date && !Number.isNaN(date.getTime()) ? date.toISOString() : '';
  }
  return '';
}

function momTargetName(data = {}) {
  return cleanText(data.name || data.title || 'RCPH event/meeting', 180);
}

function momTargetDate(data = {}) {
  return cleanText(data.date || data.eventStart || data.startDate || data.eventDate, 40);
}

function escapeEmailHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMomEmailDate(value) {
  const text = cleanText(value, 40);
  if (!text) return 'Unavailable';
  const date = new Date(`${text}T00:00:00+05:30`);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

function isApprovedActiveMomUserRecord(data = {}) {
  const status = cleanLower(data.status || data.roleStatus, 40);
  return data.active !== false && (!status || status === 'approved');
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function getFirestoreDocsById(collectionName, ids) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  const result = new Map();
  for (const chunk of chunkArray(uniqueIds, 450)) {
    const refs = chunk.map(id => db.collection(collectionName).doc(id));
    const snaps = await db.getAll(...refs);
    snaps.forEach(snap => result.set(snap.id, snap));
  }
  return result;
}

async function getAuthUsersById(ids) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  const result = new Map();
  for (const chunk of chunkArray(uniqueIds, 100)) {
    const response = await auth.getUsers(chunk.map(uid => ({ uid })));
    response.users.forEach(user => result.set(user.uid, user));
  }
  return result;
}

function momRecipientRoleAllowed(role) {
  return ['prospect', 'gbm', 'bod', 'admin', 'president'].includes(role);
}

function momRecipientGroupsNeedPositionScan(groups = []) {
  return groups.some(group => ['all', 'bod', 'president', 'secretary', 'saa'].includes(group));
}

function activeAssignmentMatchesMomGroups(positionKey, groups = []) {
  if (!groups.length) return false;
  return momRecipientMatchesGroups({ role: 'gbm', positionKeys: [positionKey] }, groups);
}

async function activeMomPositionKeysByUidForGroups(groups = []) {
  const result = new Map();
  if (!momRecipientGroupsNeedPositionScan(groups)) return result;
  const snap = await db.collection('bodPositionAssignments').where('active', '==', true).get().catch(() => null);
  if (!snap) return result;
  snap.forEach(doc => {
    const assignment = doc.data() || {};
    const uid = safeDocumentId(assignment.uid);
    const positionKey = cleanText(assignment.positionKey, 80).toLowerCase();
    if (!uid || !positionKey || assignment.active !== true) return;
    if (!activeAssignmentMatchesMomGroups(positionKey, groups)) return;
    const existing = result.get(uid) || [];
    if (!existing.includes(positionKey)) result.set(uid, [...existing, positionKey]);
  });
  return result;
}

function buildEligibleMomRecipient(uid, { authRecord, userSnap, roleSnap, positionKeys = [] }) {
  if (!authRecord || authRecord.disabled === true || !userSnap?.exists || !roleSnap?.exists) return null;
  const userData = userSnap.data() || {};
  const roleData = roleSnap.data() || {};
  const role = cleanLower(roleData.role || userData.role, 40);
  const roleStatus = cleanLower(roleData.status || roleData.roleStatus || userData.roleStatus || 'approved', 40);
  if (!momRecipientRoleAllowed(role) || roleStatus !== 'approved') return null;
  if (!isApprovedActiveMomUserRecord(userData)) return null;
  const mergedPositionKeys = normalizePositionKeys(
    roleData.positionKeys,
    userData.positionKeys,
    userData.clubPosition,
    userData.position,
    positionKeys,
  );
  const access = normalizeMomAccess({
    uid,
    user: { ...userData, positionKeys: mergedPositionKeys },
    role: { ...roleData, positionKeys: mergedPositionKeys },
    token: authRecord,
  });
  return {
    uid,
    name: cleanText(userData.name || authRecord.displayName || authRecord.email || uid, 180),
    email: cleanLower(userData.email || authRecord.email || '', 320),
    role,
    positionKeys: access.positionKeys,
    hasPresidentAuthority: access.hasPresidentAuthority === true,
  };
}

async function getEligibleMomRecipientsForUids(candidateIds, positionKeysByUid = new Map()) {
  const uniqueIds = Array.from(new Set(candidateIds.filter(Boolean)));
  if (!uniqueIds.length) return [];
  const [userSnapsByUid, roleSnapsByUid, authUsersByUid] = await Promise.all([
    getFirestoreDocsById('users', uniqueIds),
    getFirestoreDocsById('roles', uniqueIds),
    getAuthUsersById(uniqueIds),
  ]);
  return uniqueIds
    .map(uid => buildEligibleMomRecipient(uid, {
      authRecord: authUsersByUid.get(uid),
      userSnap: userSnapsByUid.get(uid),
      roleSnap: roleSnapsByUid.get(uid),
      positionKeys: positionKeysByUid.get(uid) || [],
    }))
    .filter(Boolean);
}

async function resolveMomEmailRecipients(emailRequest) {
  const recipientGroups = Array.isArray(emailRequest?.recipientGroups) ? emailRequest.recipientGroups : [];
  const targetUserIds = Array.isArray(emailRequest?.targetUserIds) ? emailRequest.targetUserIds : [];
  const explicitUidSet = new Set(targetUserIds);
  const candidateUids = new Set(targetUserIds);
  const needsPositionScan = momRecipientGroupsNeedPositionScan(recipientGroups);

  if (recipientGroups.length || needsPositionScan) {
    const rolesSnap = await db.collection('roles').get();
    rolesSnap.forEach(doc => {
      const data = doc.data() || {};
      const role = cleanLower(data.role, 40);
      const status = cleanLower(data.status || 'approved', 40);
      if (!momRecipientRoleAllowed(role) || status !== 'approved') return;
      if (recipientGroups.includes('all') || recipientGroups.includes(role) || needsPositionScan) {
        candidateUids.add(doc.id);
      }
    });
  }

  const positionKeysByUid = await activeMomPositionKeysByUidForGroups(recipientGroups);
  positionKeysByUid.forEach((_, uid) => candidateUids.add(uid));

  const recipients = await getEligibleMomRecipientsForUids(Array.from(candidateUids), positionKeysByUid);
  return dedupeMomRecipients(recipients)
    .filter(recipient => explicitUidSet.has(recipient.uid) || momRecipientMatchesGroups(recipient, recipientGroups));
}

async function getMomEmailRecipientDirectory() {
  const recipients = await resolveMomEmailRecipients({ recipientGroups: ['all'], targetUserIds: [] });
  return recipients
    .filter(recipient => normalizeMomEmailAddress(recipient.email).ok)
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')) || a.uid.localeCompare(b.uid));
}

function streamToBuffer(stream, maxBytes = MOM_PDF_MAX_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    stream.on('data', chunk => {
      total += chunk.length;
      if (total > maxBytes) {
        stream.destroy(Object.assign(new Error('MOM PDF is too large to attach.'), { code: 'resource-exhausted' }));
        return;
      }
      chunks.push(chunk);
    });
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

async function downloadDrivePdfBuffer(driveFileId) {
  const drive = driveClient();
  const response = await drive.files.get({ fileId: driveFileId, alt: 'media', supportsAllDrives: true }, { responseType: 'stream' });
  const buffer = await streamToBuffer(response.data);
  if (!isPdfBuffer(buffer)) {
    throw Object.assign(new Error('The MOM file in Drive is not a valid PDF.'), { code: 'failed-precondition' });
  }
  return buffer;
}

function buildMomEmailText({ targetName, targetDate, body, senderName }) {
  return [
    'Rotaract Club of Pune Heritage',
    '',
    `Event/meeting: ${targetName}`,
    `Conducted date: ${formatMomEmailDate(targetDate)}`,
    senderName ? `Sent by: ${senderName}` : '',
    '',
    body,
    '',
    'The Minutes of Meeting PDF is attached to this email.',
  ].filter(line => line !== '').join('\n');
}

function buildMomEmailHtml({ targetName, targetDate, body, senderName }) {
  const safeBody = escapeEmailHtml(body).replace(/\r?\n/g, '<br>');
  const sender = senderName
    ? `<p style="margin:0 0 8px;color:#596364;font-size:14px;"><strong>Sent by:</strong> ${escapeEmailHtml(senderName)}</p>`
    : '';
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#172124;background:#f6fbfb;padding:24px;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dce8e8;border-radius:12px;padding:24px;">
        <p style="margin:0 0 10px;color:#0f766e;font-weight:800;letter-spacing:.04em;text-transform:uppercase;">Rotaract Club of Pune Heritage</p>
        <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#111827;">Minutes of Meeting</h1>
        <p style="margin:0 0 8px;color:#243133;"><strong>Event/meeting:</strong> ${escapeEmailHtml(targetName)}</p>
        <p style="margin:0 0 8px;color:#243133;"><strong>Conducted date:</strong> ${escapeEmailHtml(formatMomEmailDate(targetDate))}</p>
        ${sender}
        <div style="margin:18px 0;font-size:16px;color:#243133;">${safeBody}</div>
        <p style="margin:22px 0 0;color:#596364;font-size:14px;">The Minutes of Meeting PDF is attached to this email.</p>
      </div>
    </div>
  `;
}

async function sendMomEmailMessages({ recipients, subject, body, targetName, targetDate, senderName, fileName, pdfBuffer }) {
  const summary = { attempted: recipients.length, sent: 0, failed: 0, skippedInvalidEmail: 0 };
  if (!recipients.length) return { summary, failureReason: 'no_recipients' };
  if (recipients.length > MOM_EMAIL_MAX_RECIPIENTS) {
    summary.failed = recipients.length;
    return { summary, failureReason: 'email_recipient_limit' };
  }
  if (!EMAIL_USER || !EMAIL_PASS) {
    summary.failed = recipients.length;
    return { summary, failureReason: 'email_not_configured' };
  }

  const text = buildMomEmailText({ targetName, targetDate, body, senderName });
  const html = buildMomEmailHtml({ targetName, targetDate, body, senderName });
  for (const recipient of recipients) {
    const email = normalizeMomEmailAddress(recipient.email);
    if (!email.ok) {
      summary.failed += 1;
      summary.skippedInvalidEmail += 1;
      continue;
    }
    try {
      await momEmailTransporter.sendMail({
        from: `"RCPH Platform" <${EMAIL_USER}>`,
        to: email.email,
        subject,
        text,
        html,
        attachments: [{ filename: fileName, content: pdfBuffer, contentType: 'application/pdf' }],
      });
      summary.sent += 1;
    } catch (error) {
      summary.failed += 1;
      logger.warn('MOM email recipient send failed.', { uid: recipient.uid, code: error?.code || '', message: error?.message || '' });
    }
  }
  const accounted = summary.sent + summary.failed;
  if (accounted < summary.attempted) summary.failed += summary.attempted - accounted;
  return { summary, failureReason: summary.sent ? '' : 'smtp_failed' };
}

function momEmailStatus(summary) {
  if (summary.sent > 0 && summary.failed === 0) return 'sent';
  if (summary.sent > 0) return 'partial';
  return 'failed';
}

function serializeMomEmailHistory(id, history = {}) {
  const summary = history.emailSummary || {};
  return {
    id,
    targetType: cleanLower(history.targetType, 80),
    targetId: cleanText(history.targetId, 180),
    targetName: cleanText(history.targetName, 180),
    targetDate: cleanText(history.targetDate, 40),
    momDriveFileId: cleanText(history.momDriveFileId, 180),
    momFileName: cleanText(history.momFileName, 180),
    recipientGroups: Array.isArray(history.recipientGroups) ? history.recipientGroups.map(group => cleanLower(group, 40)).filter(Boolean) : [],
    recipientRoles: Array.isArray(history.recipientRoles) ? history.recipientRoles.map(group => cleanLower(group, 40)).filter(Boolean) : [],
    targetUserIds: Array.isArray(history.targetUserIds) ? history.targetUserIds.map(uid => safeDocumentId(uid)).filter(Boolean) : [],
    explicitRecipientCount: Number.isInteger(history.explicitRecipientCount) ? history.explicitRecipientCount : 0,
    recipientCount: Number.isInteger(history.recipientCount) ? history.recipientCount : 0,
    sentBy: cleanText(history.sentBy, 160),
    sentByName: cleanText(history.sentByName, 180),
    sentAt: momEmailTimestampIso(history.sentAt),
    emailSummary: {
      attempted: Number.isInteger(summary.attempted) ? summary.attempted : 0,
      sent: Number.isInteger(summary.sent) ? summary.sent : 0,
      failed: Number.isInteger(summary.failed) ? summary.failed : 0,
      skippedInvalidEmail: Number.isInteger(summary.skippedInvalidEmail) ? summary.skippedInvalidEmail : 0,
    },
    status: cleanLower(history.status, 40),
    failureReason: cleanText(history.failureReason, 160),
  };
}

async function writeMomEmailHistory({ target, access, request, recipients, summary, status, failureReason, updateLatest = true }) {
  const now = admin.firestore.Timestamp.now();
  const targetName = momTargetName(target.data);
  const targetDate = momTargetDate(target.data);
  const historyRef = db.collection(MOM_EMAIL_HISTORY_COLLECTION).doc();
  const history = {
    targetType: target.targetType,
    targetId: target.targetId,
    targetName,
    targetDate,
    momDriveFileId: cleanDriveId(target.data.momDriveFileId),
    momFileName: safeMomFileName(target.data.momFileName || 'mom.pdf'),
    recipientGroups: request.recipientGroups,
    recipientRoles: request.recipientGroups,
    targetUserIds: request.targetUserIds || [],
    explicitRecipientCount: Array.isArray(request.targetUserIds) ? request.targetUserIds.length : 0,
    recipientCount: recipients.length,
    sentBy: access.uid,
    sentByName: access.displayName || 'Unknown user',
    sentAt: now,
    emailSummary: summary,
    status,
    failureReason: failureReason || '',
  };
  await historyRef.set(history);
  const latest = { ...history, historyId: historyRef.id };
  if (updateLatest) await target.ref.set({ momEmail: latest }, { merge: true });
  return serializeMomEmailHistory(historyRef.id, latest);
}
const getMomEmailRecipientOptions = onCall(MOM_BASE_OPTIONS, async (request) => {
  await requireCallableAccess(request, 'upload');
  const recipients = await getMomEmailRecipientDirectory();
  return {
    ok: true,
    recipients: recipients.map(recipient => ({
      uid: recipient.uid,
      name: recipient.name,
      email: recipient.email,
      role: recipient.role,
      positionKeys: Array.isArray(recipient.positionKeys) ? recipient.positionKeys.slice(0, 8) : [],
    })),
  };
});

const createMomUploadSession = onCall(MOM_BASE_OPTIONS, async (request) => {
  const access = await requireCallableAccess(request, 'upload');
  const target = await getTargetOrThrow(request.data || {});
  const descriptor = validateMomFileDescriptor(request.data || {});
  if (!descriptor.ok) throw toHttpsError(descriptor);

  const sessionRef = db.collection(MOM_SESSION_COLLECTION).doc();
  const proof = crypto.randomBytes(32).toString('base64url');
  const now = admin.firestore.Timestamp.now();
  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + sessionTtlMs());
  await sessionRef.set({
    uid: access.uid,
    targetType: target.targetType,
    targetId: target.targetId,
    fileName: descriptor.fileName,
    mimeType: 'application/pdf',
    sizeBytes: descriptor.sizeBytes,
    proofHash: hashSecret(proof),
    status: 'authorized',
    driveFolderName: MOM_DRIVE_FOLDER_NAME,
    driveSubfolderName: momDriveSubfolderName(target.targetType),
    createdAt: now,
    updatedAt: now,
    expiresAt,
  });

  return {
    ok: true,
    sessionId: sessionRef.id,
    proof,
    uploadEndpoint: publicEndpoint('uploadMomPdf'),
    maxSizeBytes: MOM_PDF_MAX_BYTES,
  };
});

const uploadMomPdf = onRequest(MOM_DRIVE_OPTIONS, async (req, res) => {
  if (handlePreflight(req, res, 'POST, OPTIONS')) return;
  applyCors(req, res, 'POST, OPTIONS');
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, code: 'method-not-allowed', message: 'Use POST to upload MOM PDFs.' });
  }

  try {
    const { fields, file } = await parseMultipartUpload(req);
    const sessionId = safeDocumentId(fields.sessionId);
    const proof = cleanText(fields.proof, 200);
    if (!sessionId || !proof) {
      return sendJson(res, 400, { ok: false, code: 'invalid-argument', message: 'Upload authorization was incomplete.' });
    }
    const sessionRef = db.collection(MOM_SESSION_COLLECTION).doc(sessionId);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) {
      return sendJson(res, 404, { ok: false, code: 'not-found', message: 'The MOM upload session was not found.' });
    }
    const session = sessionSnap.data() || {};
    if (session.status !== 'authorized') {
      return sendJson(res, 409, { ok: false, code: 'failed-precondition', message: 'This MOM upload session has already been used.' });
    }
    if (sessionExpired(session)) {
      return sendJson(res, 409, { ok: false, code: 'failed-precondition', message: 'This MOM upload session has expired.' });
    }
    if (!secureHashMatches(proof, session.proofHash)) {
      return sendJson(res, 403, { ok: false, code: 'permission-denied', message: 'The MOM upload proof was rejected.' });
    }
    if (cleanLower(fields.targetType, 80) !== session.targetType || safeDocumentId(fields.targetId) !== session.targetId) {
      return sendJson(res, 400, { ok: false, code: 'invalid-argument', message: 'The MOM upload target changed after authorization.' });
    }
    const descriptor = validateMomFileDescriptor({ fileName: file.fileName, mimeType: file.mimeType, sizeBytes: file.sizeBytes });
    if (!descriptor.ok) {
      return sendJson(res, httpCodeForError(descriptor.code), { ok: false, code: descriptor.code, message: descriptor.message });
    }
    if (descriptor.fileName !== session.fileName || descriptor.sizeBytes !== session.sizeBytes || descriptor.mimeType !== session.mimeType) {
      return sendJson(res, 400, { ok: false, code: 'invalid-argument', message: 'The MOM PDF does not match the authorized upload.' });
    }
    if (!isPdfBuffer(file.buffer)) {
      return sendJson(res, 400, { ok: false, code: 'invalid-argument', message: 'Only valid PDF files are accepted for MOM.' });
    }
    await getTargetOrThrow({ targetType: session.targetType, targetId: session.targetId });
    const uploaded = await uploadDrivePdf({ targetType: session.targetType, fileName: session.fileName, buffer: file.buffer });
    await sessionRef.update({ status: 'uploaded', uploaded, updatedAt: admin.firestore.Timestamp.now() });
    return sendJson(res, 200, { ok: true, sessionId });
  } catch (error) {
    logger.error('MOM upload failed.', { code: error?.code, message: error?.message });
    return sendJson(res, error?.status || httpCodeForError(error?.code), {
      ok: false,
      code: error?.code || 'upload-failed',
      message: error?.message || 'The MOM PDF upload failed.',
    });
  }
});

const finalizeMomUpload = onCall(MOM_BASE_OPTIONS, async (request) => {
  const access = await requireCallableAccess(request, 'upload');
  const target = await getTargetOrThrow(request.data || {});
  const sessionId = safeDocumentId(request.data?.sessionId);
  if (!sessionId) throw new HttpsError('invalid-argument', 'MOM upload session is required.');

  const sessionRef = db.collection(MOM_SESSION_COLLECTION).doc(sessionId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) throw new HttpsError('not-found', 'The MOM upload session was not found.');
  const session = sessionSnap.data() || {};
  if (session.uid !== access.uid || session.targetType !== target.targetType || session.targetId !== target.targetId) {
    throw new HttpsError('permission-denied', 'The MOM upload session does not belong to this request.');
  }
  if (session.status !== 'uploaded' || !session.uploaded?.driveFileId) {
    throw new HttpsError('failed-precondition', 'Upload the MOM PDF before finalizing.');
  }
  if (sessionExpired(session)) throw new HttpsError('failed-precondition', 'This MOM upload session has expired.');

  const now = admin.firestore.Timestamp.now();
  const metadata = buildMomMetadata({ target, previous: target.data, upload: session.uploaded, access, now });
  await target.ref.set(metadata, { merge: true });
  await sessionRef.update({ status: 'finalized', finalizedAt: now, updatedAt: now, metadata: serializeMomMetadata(metadata) });
  return { ok: true, mom: serializeMomMetadata(metadata) };
});

const downloadMomPdf = onRequest(MOM_DRIVE_OPTIONS, async (req, res) => {
  if (handlePreflight(req, res, 'GET, OPTIONS')) return;
  applyCors(req, res, 'GET, OPTIONS');
  if (req.method !== 'GET') {
    return sendJson(res, 405, { ok: false, code: 'method-not-allowed', message: 'Use GET to open MOM PDFs.' });
  }

  try {
    await requireHttpAccess(req, 'view');
    const target = await getTargetOrThrow({ targetType: req.query.targetType, targetId: req.query.targetId });
    const driveFileId = cleanDriveId(target.data.momDriveFileId);
    const fileName = safeMomFileName(target.data.momFileName || 'mom.pdf');
    if (!driveFileId) {
      return sendJson(res, 404, { ok: false, code: 'not-found', message: 'No MOM PDF has been uploaded for this record.' });
    }

    const drive = driveClient();
    const response = await drive.files.get({ fileId: driveFileId, alt: 'media', supportsAllDrives: true }, { responseType: 'stream' });
    res.status(200);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `inline; filename="${fileName.replace(/"/g, '')}"`);
    res.set('Cache-Control', 'private, no-store, max-age=0');
    res.set('X-Content-Type-Options', 'nosniff');
    response.data.on('error', (error) => {
      logger.error('MOM Drive stream failed.', { message: error?.message });
      if (!res.headersSent) {
        sendJson(res, 404, { ok: false, code: 'not-found', message: 'The MOM file could not be opened.' });
      } else {
        res.end();
      }
    });
    return response.data.pipe(res);
  } catch (error) {
    const code = publicErrorCode(error);
    const message = code === 'not-found'
      ? 'The MOM file could not be found. It may have been moved or deleted in Drive.'
      : error?.message || 'The MOM PDF could not be opened.';
    logger.warn('MOM download failed.', { code, message });
    return sendJson(res, httpCodeForError(code), { ok: false, code: code || 'download-failed', message });
  }
});

const sendMomEmail = onCall(MOM_DRIVE_OPTIONS, async (request) => {
  const access = await requireCallableAccess(request, 'upload');
  const target = await getTargetOrThrow(request.data || {});
  const emailRequest = validateMomEmailRequest(request.data || {});
  if (!emailRequest.ok) throw toHttpsError(emailRequest);

  const driveFileId = cleanDriveId(target.data.momDriveFileId);
  const fileName = safeMomFileName(target.data.momFileName || 'mom.pdf');
  if (!driveFileId || !target.data.momFileName) {
    const summary = { attempted: 0, sent: 0, failed: 0, skippedInvalidEmail: 0 };
    await writeMomEmailHistory({
      target,
      access,
      request: emailRequest,
      recipients: [],
      summary,
      status: 'failed',
      failureReason: 'missing_mom_metadata',
    });
    throw new HttpsError('failed-precondition', 'Upload MOM before sending email.');
  }

  const recipients = await resolveMomEmailRecipients(emailRequest);
  if (!recipients.length) {
    const summary = { attempted: 0, sent: 0, failed: 0, skippedInvalidEmail: 0 };
    await writeMomEmailHistory({
      target,
      access,
      request: emailRequest,
      recipients: [],
      summary,
      status: 'no_recipients',
      failureReason: 'no_eligible_recipients',
      updateLatest: false,
    });
    throw new HttpsError('failed-precondition', `No eligible recipients found for ${momRecipientRequestLabel(emailRequest)}.`);
  }
  let pdfBuffer;
  try {
    pdfBuffer = await downloadDrivePdfBuffer(driveFileId);
  } catch (error) {
    const summary = { attempted: recipients.length, sent: 0, failed: recipients.length, skippedInvalidEmail: 0 };
    await writeMomEmailHistory({
      target,
      access,
      request: emailRequest,
      recipients,
      summary,
      status: 'failed',
      failureReason: 'drive_file_missing',
    });
    logger.warn('MOM email attachment download failed.', { code: error?.code || '', message: error?.message || '' });
    throw new HttpsError('not-found', 'The MOM PDF could not be attached. It may have been moved or deleted in Drive.');
  }

  const targetName = momTargetName(target.data);
  const targetDate = momTargetDate(target.data);
  const { summary, failureReason } = await sendMomEmailMessages({
    recipients,
    subject: emailRequest.subject,
    body: emailRequest.body,
    targetName,
    targetDate,
    senderName: access.displayName,
    fileName,
    pdfBuffer,
  });
  const status = momEmailStatus(summary);
  const history = await writeMomEmailHistory({
    target,
    access,
    request: emailRequest,
    recipients,
    summary,
    status,
    failureReason: status === 'failed' ? failureReason : failureReason || '',
  });
  logger.info('MOM email summary.', {
    targetType: target.targetType,
    targetId: target.targetId,
    recipientCount: recipients.length,
    sent: summary.sent,
    failed: summary.failed,
    status,
  });
  return {
    ok: status !== 'failed',
    historyId: history.id,
    history,
    momEmail: history,
    emailSummary: history.emailSummary,
    status,
  };
});
module.exports = {
  getMomEmailRecipientOptions,
  createMomUploadSession,
  uploadMomPdf,
  finalizeMomUpload,
  downloadMomPdf,
  sendMomEmail,
};
