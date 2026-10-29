'use strict';

const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const {
  makeVisitSubmissionError, createFirestoreVisitSubmissionAdapter, visitFolderAllowsUpload,
  validateVisitFileType, validateVisitFileSize, buildAuditPayload, visitPositionDocId,
} = require('./visit-submissions');
const {
  createGoogleDriveClient, getVisitDriveConfig, getRootFolderIdForVisit,
  parseMultipartUpload, setCorsHeaders, sendJson, httpStatusFromServiceError,
  VISIT_UPLOAD_ALLOWED_ORIGINS,
} = require('./visit-drive');

const OPERATIONS = 'visitSubmissionFileOperations';
const LEASE_MS = 240000;
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const FILE_FIELDS = 'id,name,mimeType,parents,trashed,md5Checksum,sha256Checksum,size,headRevisionId,capabilities(canEdit,canTrash)';
const digest = (bytes, algorithm = 'sha256') => crypto.createHash(algorithm).update(bytes).digest('hex');
const fail = (reason, message, code = 'failed-precondition') => { throw makeVisitSubmissionError(code, message, { reason }); };
function id(value, label) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,160}$/.test(value)) fail('file-changed', `Valid ${label} required.`, 'invalid-argument');
  return value;
}
function sourceVersion(source) {
  return digest(JSON.stringify([source.driveFileId, source.driveFolderId, source.documentCategory || '', source.originalFileName || source.fileName, source.mimeType, source.sizeBytes, source.contentSha256 || '', source.updatedAt || null]));
}
function requireFolderAccess(access, source, folder, config) {
  if (!access?.canAccessVisitSystem) fail('file-permission', 'Club Visit access required.', 'permission-denied');
  if (!access.canManageVisitSystem && !(access.folderPositionKeys || access.positionKeys || []).includes(source.positionKey)) fail('file-permission', 'This file is outside your assigned position folders.', 'permission-denied');
  if (!access.canManageVisitSystem && !visitFolderAllowsUpload(config, folder)) fail('file-locked', 'This Club Visit folder is closed or locked.');
}

function createVisitFileActionService(options) {
  const adapter = options.adapter || createFirestoreVisitSubmissionAdapter(options.db, options.admin);
  const visitService = options.visitService;
  const now = options.now || Date.now;
  const locks = options.folderLockManager;
  const configProvider = options.getDriveConfig || (() => getVisitDriveConfig(options.env || process.env));
  let driveClient = options.driveClient;
  const getDrive = config => driveClient || (driveClient = createGoogleDriveClient({ ...options, config }));

  async function readContext(reader, submissionId, access) {
    const snap = await reader.getDoc('visitSubmissions', submissionId);
    if (!snap.exists) fail('file-changed', 'This document no longer exists.', 'not-found');
    const source = snap.data;
    const folderId = visitPositionDocId(source.visitType, source.positionKey);
    const [folderSnap, configSnap] = await Promise.all([
      reader.getDoc('visitSubmissionPositions', folderId), reader.getDoc('visitSubmissionConfig', source.visitType),
    ]);
    if (!folderSnap.exists || !configSnap.exists) fail('file-location', 'The recorded Club Visit folder is unavailable.');
    requireFolderAccess(access, source, folderSnap.data, configSnap.data);
    return { source, folder: folderSnap.data, folderId };
  }

  async function inspectScope(drive, config, plan) {
    const positionId = plan.positionFolderId;
    if (!positionId || !plan.driveFolderId || !plan.driveFileId) fail('file-location', 'The document has no verified Drive location.');
    const rootId = getRootFolderIdForVisit(config, plan.visitType);
    const position = (await drive.files.get({ fileId: positionId, supportsAllDrives: true, fields: 'id,mimeType,parents,trashed' })).data;
    if (position.id !== positionId || position.trashed || position.mimeType !== FOLDER_MIME || !position.parents?.includes(rootId)) fail('file-location', 'The position folder was moved in Drive. Restore its location before changing this file.');
    let folderId = plan.driveFolderId;
    const seen = new Set();
    for (let depth = 0; folderId !== positionId; depth++) {
      if (depth >= 16 || seen.has(folderId)) fail('file-location', 'The document folder is outside its recorded position folder.');
      seen.add(folderId);
      const folder = (await drive.files.get({ fileId: folderId, supportsAllDrives: true, fields: 'id,mimeType,parents,trashed' })).data;
      if (folder.id !== folderId || folder.trashed || folder.mimeType !== FOLDER_MIME || folder.parents?.length !== 1) fail('file-location', 'The document folder was moved or is unavailable.');
      folderId = folder.parents[0];
    }
    const file = (await drive.files.get({ fileId: plan.driveFileId, supportsAllDrives: true, fields: FILE_FIELDS })).data;
    if (file.id !== plan.driveFileId || !file.parents?.includes(plan.driveFolderId) || !file.md5Checksum || file.mimeType.startsWith('application/vnd.google-apps.')) fail('file-location', 'The file was moved in Drive or is no longer an uploaded document. Restore its recorded location.');
    return file;
  }

  async function execute(uid, input, action, file = null) {
    const submissionId = id(input?.submissionId, 'submission ID');
    const requestId = action === 'replace' ? id(input?.operationId, 'operation ID') : 'delete';
    const access = await visitService.resolveAccessContext(uid);
    const first = await readContext(adapter, submissionId, access);
    if (input?.mode === 'remove' && !access.canManageVisitSystem) fail('file-permission', 'Visit manager access required for this removal action.', 'permission-denied');
    let replacement = null;
    if (action === 'replace') {
      if (!file?.buffer || !Buffer.isBuffer(file.buffer)) fail('replacement-type', 'Select a replacement file.', 'invalid-argument');
      const type = validateVisitFileType(input.fileName, input.mimeType);
      validateVisitFileSize(file.buffer.length, Number(first.folder.maxFileSizeBytes || 25 * 1024 * 1024));
      if (Number(input.sizeBytes) !== file.buffer.length || (file.mimeType && file.mimeType !== type.mimeType)) fail('replacement-type', 'The replacement file metadata does not match its contents.', 'invalid-argument');
      if (type.mimeType !== first.source.mimeType) fail('replacement-type', 'Choose the same file type as the existing document. Its filename and link will be preserved.', 'invalid-argument');
      replacement = { mimeType: type.mimeType, sizeBytes: file.buffer.length, sha256: digest(file.buffer), md5: digest(file.buffer, 'md5') };
    }
    const requestKey = digest(JSON.stringify([uid, submissionId, action, requestId]));
    const config = configProvider();
    let folderLock;
    try {
      folderLock = await locks.acquireLock({ rootFolderId: getRootFolderIdForVisit(config, first.source.visitType), visitType: first.source.visitType, positionKey: first.source.positionKey });
    } catch { fail('file-busy', 'Another file action is running in this folder. Try again shortly.'); }
    let operationId = requestKey;
    const owner = crypto.randomBytes(16).toString('hex');
    let claimed = false;
    try {
      let operation;
      await adapter.runTransaction(async tx => {
        const context = await readContext(tx, submissionId, access);
        const { source, folder, folderId } = context;
        const requested = await tx.getDoc(OPERATIONS, requestKey);
        if (requested.exists && requested.data.state === 'complete') {
          if (requested.data.replacement?.sha256 !== replacement?.sha256) fail('file-changed', 'This request ID was already used for another file.');
          operation = requested.data; return;
        }
        if (source.status !== 'active') fail('file-changed', 'This document is no longer active. Refresh the folder.');
        if (source.visitType !== first.source.visitType || source.positionKey !== first.source.positionKey) fail('file-changed', 'This document changed folders. Refresh and try again.');
        let previous = requested.exists ? requested.data : null;
        if (source.fileMutationId && source.fileMutationId !== requestKey) {
          const pending = await tx.getDoc(OPERATIONS, source.fileMutationId);
          if (!pending.exists || pending.data.action !== action || pending.data.replacement?.sha256 !== replacement?.sha256) fail('file-pending', 'A previous change needs finishing. Retry that action with the same replacement file.');
          operationId = source.fileMutationId;
          previous = pending.data;
        }
        if (previous?.leaseUntilMillis > now()) fail('file-busy', 'This file is still being changed. Retry shortly.');
        if (previous?.state === 'pending' && previous.sourceVersion !== sourceVersion(source)) fail('file-changed', 'This document changed during the pending action. A Visit manager must review it.');
        const refs = await tx.readDriveReferences(source.driveFileId);
        if (refs.some(ref => ref.id !== submissionId && ref.data.status === 'active')) fail('file-references', 'Another active website entry uses this Drive file. A Visit manager must review it first.');
        let rate = null;
        if (!previous || previous.state !== 'pending') {
          const rateSnap = await tx.getDoc('visitFileActionRateLimits', uid);
          const recent = (rateSnap.data?.createdAtMillis || []).filter(value => Number.isSafeInteger(value) && value > now() - 3600000);
          if (recent.length >= (access.canManageVisitSystem ? 5000 : 500)) fail('file-busy', 'Too many file actions. Try again later.', 'resource-exhausted');
          rate = [...recent, now()];
        }
        const category = source.documentCategory || '';
        const storedFolder = category ? folder.categoryFolderIds?.[category] : folder.driveFolderId;
        if (!storedFolder || storedFolder !== source.driveFolderId) fail('file-location', 'The stored Drive folder does not match this document category.');
        operation = previous?.state === 'pending' ? previous : {
          operationId, submissionId, actorUid: uid, actorRole: access.role, action,
          visitType: source.visitType, positionKey: source.positionKey, folderId,
          driveFileId: source.driveFileId, driveFolderId: source.driveFolderId,
          positionFolderId: folder.driveFolderId, documentCategory: category,
          sourceVersion: sourceVersion(source), fileName: source.originalFileName || source.fileName,
          mimeType: source.mimeType, replacement, state: 'pending', stage: 'prepared',
          reason: String(input?.reason || '').trim().slice(0, 500), createdAt: adapter.serverTimestamp(),
        };
        operation = { ...operation, owner, leaseUntilMillis: now() + LEASE_MS, lastActorUid: uid };
        if (rate) tx.setDoc('visitFileActionRateLimits', uid, { createdAtMillis: rate });
        tx.setDoc(OPERATIONS, operationId, operation);
        tx.updateDoc('visitSubmissions', submissionId, { fileMutationId: operationId, fileMutationAction: action });
      });
      if (operation.state === 'complete') return { ok: true, submissionId, status: operation.resultStatus, replay: true };
      claimed = true;
      const drive = getDrive(config);
      let current = await inspectScope(drive, config, operation);
      async function checkpoint(patch) {
        await adapter.runTransaction(async tx => {
          const op = await tx.getDoc(OPERATIONS, operationId);
          if (!op.exists || op.data.owner !== owner || op.data.state !== 'pending') fail('file-busy', 'This file operation changed. Retry shortly.');
          tx.updateDoc(OPERATIONS, operationId, { ...patch, updatedAt: adapter.serverTimestamp() });
        });
        operation = { ...operation, ...patch };
      }
      async function recheckAccess() {
        const latestAccess = await visitService.resolveAccessContext(uid);
        const latest = await readContext(adapter, submissionId, latestAccess);
        if (latest.source.fileMutationId !== operationId || sourceVersion(latest.source) !== operation.sourceVersion) fail('file-changed', 'The website record changed during this action.');
      }
      await recheckAccess();
      async function contentDigest(metadata, revisionId = '') {
        if (!revisionId && /^[a-f0-9]{64}$/i.test(metadata.sha256Checksum || '')) return metadata.sha256Checksum.toLowerCase();
        const params = { fileId: operation.driveFileId, alt: 'media' };
        const response = revisionId
          ? await drive.revisions.get({ ...params, revisionId }, { responseType: 'stream' })
          : await drive.files.get({ ...params, supportsAllDrives: true }, { responseType: 'stream' });
        const hash = crypto.createHash('sha256');
        let size = 0;
        for await (const chunk of response.data) {
          size += chunk.length;
          if (size > 25 * 1024 * 1024) fail('file-changed', 'The Drive contents exceed the permitted file size.');
          hash.update(chunk);
        }
        return hash.digest('hex');
      }
      if (action === 'replace') {
        if (current.trashed) fail('file-location', 'Restore this file from Drive Trash before replacing it.');
        if (current.mimeType !== operation.mimeType) fail('replacement-type', 'The Drive file type changed. A Visit manager must review it.');
        if (!current.capabilities?.canEdit) fail('drive-permission', 'The connected Drive account cannot edit this file.', 'permission-denied');
        if (!operation.oldMd5) {
          if (current.mimeType !== operation.mimeType || !current.headRevisionId) fail('replacement-type', 'This file cannot be backed up for replacement.');
          await checkpoint({ oldMd5: current.md5Checksum, backupRevisionId: current.headRevisionId });
        }
        if (current.md5Checksum !== operation.oldMd5 && current.md5Checksum !== replacement.md5) fail('file-changed', 'The Drive contents changed since this replacement started. A Visit manager must review it.');
        // Pin the original binary revision before changing any contents.
        await drive.revisions.update({ fileId: operation.driveFileId, revisionId: operation.backupRevisionId, requestBody: { keepForever: true }, fields: 'id,keepForever,md5Checksum' });
        const backup = (await drive.revisions.get({ fileId: operation.driveFileId, revisionId: operation.backupRevisionId, fields: 'id,keepForever,md5Checksum' })).data;
        if (!backup.keepForever || backup.md5Checksum !== operation.oldMd5) fail('drive-unavailable', 'The previous version could not be backed up. Retry the replacement.', 'unavailable');
        if (!operation.oldSha256) await checkpoint({ oldSha256: await contentDigest({}, operation.backupRevisionId) });
        current = await inspectScope(drive, config, operation);
        const currentDigest = await contentDigest(current);
        if (![operation.oldSha256, replacement.sha256].includes(currentDigest)) fail('file-changed', 'The Drive contents changed during replacement.');
        await recheckAccess();
        await checkpoint({ stage: 'write-started' });
        if (currentDigest !== replacement.sha256) await drive.files.update({ fileId: operation.driveFileId, supportsAllDrives: true, requestBody: {}, media: { mimeType: replacement.mimeType, body: Readable.from(file.buffer) }, fields: FILE_FIELDS });
        const verified = await inspectScope(drive, config, operation);
        if (verified.trashed || verified.md5Checksum !== replacement.md5 || Number(verified.size) !== replacement.sizeBytes || await contentDigest(verified) !== replacement.sha256) fail('drive-unavailable', 'Drive could not confirm the replacement. Retry with the same file.', 'unavailable');
      } else {
        if (!current.trashed && !current.capabilities?.canTrash) fail('drive-permission', 'The connected Drive account cannot move this file to Trash.', 'permission-denied');
        await checkpoint({ stage: 'write-started' });
        if (!current.trashed) await drive.files.update({ fileId: operation.driveFileId, supportsAllDrives: true, requestBody: { trashed: true }, fields: 'id,trashed' });
        const verified = await inspectScope(drive, config, operation);
        if (!verified.trashed) fail('drive-unavailable', 'Drive could not confirm deletion. Retry this action.', 'unavailable');
      }
      await checkpoint({ stage: 'drive-complete' });
      // Recheck current account permissions before publishing the Drive result.
      const currentAccess = await visitService.resolveAccessContext(uid);
      await adapter.runTransaction(async tx => {
        const { source, folder, folderId } = await readContext(tx, submissionId, currentAccess);
        const op = await tx.getDoc(OPERATIONS, operationId);
        const refs = await tx.readDriveReferences(operation.driveFileId);
        if (!op.exists || op.data.owner !== owner || source.fileMutationId !== operationId || source.status !== 'active' || sourceVersion(source) !== operation.sourceVersion) fail('file-changed', 'The website record changed. A Visit manager must finish the pending action.');
        if (refs.some(ref => ref.id !== submissionId && ref.data.status === 'active')) fail('file-references', 'Another entry now references this Drive file.');
        const timestamp = adapter.serverTimestamp();
        const resultStatus = action === 'replace' ? 'active' : input?.mode === 'remove' ? 'admin-removed' : 'archived';
        const updates = action === 'replace' ? {
          sizeBytes: replacement.sizeBytes, contentSha256: replacement.sha256,
          lastReplacedAt: timestamp, lastReplacedByUid: uid, backupRevisionId: operation.backupRevisionId,
        } : { status: resultStatus, deletedAt: timestamp, deletedByUid: uid, deleteReason: operation.reason || 'deleted-from-club-visits', driveTrashedAt: timestamp };
        tx.updateDoc('visitSubmissions', submissionId, { ...updates, fileMutationId: null, fileMutationAction: null, updatedAt: timestamp });
        if (action !== 'replace') tx.updateDoc('visitSubmissionPositions', folderId, {
          activeFileCount: Math.max(0, Number(folder.activeFileCount || 0) - 1), updatedAt: timestamp, updatedBy: uid,
          ...(folder.primaryPresentationSubmissionId === submissionId ? { primaryPresentationSubmissionId: '' } : {}),
        });
        tx.updateDoc(OPERATIONS, operationId, { state: 'complete', stage: 'complete', resultStatus, leaseUntilMillis: 0, completedAt: timestamp });
        tx.createDoc('visitSubmissionAudit', operationId, buildAuditPayload(action === 'replace' ? 'visitDriveFileReplaced' : 'visitDriveFileTrashed', currentAccess, { visitType: operation.visitType, positionKey: operation.positionKey, submissionId, details: { operationId, originalActorUid: operation.actorUid, ...(action === 'replace' ? { backupRevisionId: operation.backupRevisionId, contentSha256: replacement.sha256 } : { reason: operation.reason }) } }, timestamp));
      });
      return { ok: true, submissionId, status: action === 'replace' ? 'active' : input?.mode === 'remove' ? 'admin-removed' : 'archived' };
    } catch (error) {
      if (claimed) {
        try {
          await adapter.runTransaction(async tx => {
            const op = await tx.getDoc(OPERATIONS, operationId);
            const sub = await tx.getDoc('visitSubmissions', submissionId);
            if (!op.exists || op.data.owner !== owner || op.data.state === 'complete') return;
            const untouched = op.data.stage === 'prepared';
            tx.updateDoc(OPERATIONS, operationId, { leaseUntilMillis: 0, ...(untouched ? { state: 'failed' } : {}) });
            if (untouched && sub.data?.fileMutationId === operationId) tx.updateDoc('visitSubmissions', submissionId, { fileMutationId: null, fileMutationAction: null });
          });
        } catch { /* Retain the durable operation; its lease allows safe recovery. */ }
      }
      if (error?.details?.reason) throw error;
      const status = Number(error?.response?.status || error?.status || error?.code);
      if (status === 403) fail('drive-permission', 'The connected Drive account cannot change this file.', 'permission-denied');
      if (status === 404) fail('file-location', 'The recorded Drive file or folder is missing or inaccessible.');
      fail('drive-unavailable', 'The file change could not be confirmed. Retry the same action; for replacement, select the same file.', 'unavailable');
    } finally {
      await folderLock.release().catch(() => {});
    }
  }
  return {
    remove: (uid, input) => execute(uid, input, 'delete'),
    replace: (uid, input, file) => execute(uid, input, 'replace', file),
  };
}

function createVisitFileReplacementHandler(options) {
  const service = options.service;
  const parser = options.parseMultipartUpload || parseMultipartUpload;
  const allowedOrigins = options.allowedOrigins || VISIT_UPLOAD_ALLOWED_ORIGINS;
  return async (req, res) => {
    const allowed = setCorsHeaders(req, res, allowedOrigins);
    if (!allowed) return sendJson(res, 403, { ok: false, reason: 'file-permission', message: 'Origin is not allowed.' });
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, message: 'POST required.' });
    try {
      const token = /^Bearer ([^\s]+)$/.exec(req.get?.('authorization') || req.headers?.authorization || '');
      if (!token) throw makeVisitSubmissionError('unauthenticated', 'Sign in again.');
      let decoded;
      try { decoded = await options.verifyIdToken(token[1]); } catch { throw makeVisitSubmissionError('unauthenticated', 'Sign in again.'); }
      const parsed = await parser(req, { maxBytes: 25 * 1024 * 1024 });
      const allowed = ['submissionId', 'operationId', 'fileName', 'mimeType', 'sizeBytes'];
      if (Object.keys(parsed.fields).some(key => !allowed.includes(key))) fail('file-permission', 'Only the server may select the Drive destination.', 'invalid-argument');
      const result = await service.replace(decoded.uid, parsed.fields, parsed.file);
      return sendJson(res, 200, result);
    } catch (error) {
      return sendJson(res, httpStatusFromServiceError(error), { ok: false, reason: error?.details?.reason || 'drive-unavailable', message: 'The file change could not be completed.', code: error?.code || 'unavailable' });
    }
  };
}
module.exports = { createVisitFileActionService, createVisitFileReplacementHandler, sourceVersion, OPERATIONS };
