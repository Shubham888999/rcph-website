'use strict';

const crypto = require('crypto');
const Busboy = require('@fastify/busboy');
const {
  MAX_SOURCE_BYTES,
  inspectSourcePdf,
  loadLetterheadBytes,
  mergeResolutionPdf,
  normalizeVotesTableConfig,
  sha256,
  validateSourceFileMetadata,
} = require('./resolution-pdf-merge');

const SESSION_COLLECTION = 'resolutionPdfUploadSessions';
const RATE_COLLECTION = 'resolutionPdfUploadRateLimits';
const SESSION_TTL_MS = 10 * 60 * 1000;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT = 10;
const ALLOWED_ORIGINS = new Set([
  'https://rcph3131.org',
  'https://www.rcph3131.org',
  'https://rcph-admin.web.app',
  'https://rcph-admin.firebaseapp.com',
  'http://localhost:5000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
]);

function serviceError(code, message, status = 400) {
  return Object.assign(new Error(message), { code, status });
}

function cleanId(value, label = 'ID') {
  const result = String(value || '').trim();
  if (!result || result.length > 160 || result.includes('/')) throw serviceError('invalid-argument', `${label} is invalid.`);
  return result;
}

function safeFileName(value, fallback = 'resolution.pdf') {
  const name = String(value || '').replace(/[\r\n"\\/]/g, '_').replace(/[^a-zA-Z0-9._ ()-]/g, '_').trim();
  return (name || fallback).slice(0, 180);
}

function hashProof(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function proofMatches(value, expected) {
  const actual = Buffer.from(hashProof(value), 'hex');
  const wanted = Buffer.from(String(expected || ''), 'hex');
  return actual.length === wanted.length && crypto.timingSafeEqual(actual, wanted);
}

function timestampIso(value) {
  if (!value) return '';
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function sourceMode(data = {}) {
  if (['standard', 'custom', 'uploadedPdf'].includes(data.documentSourceMode)) return data.documentSourceMode;
  return data.pdfLayoutMode === 'custom' ? 'custom' : 'standard';
}

function reportSafeSource(source = {}) {
  if (!source || source.status !== 'ready') return null;
  return {
    uploadId: String(source.uploadId || ''),
    status: 'ready',
    originalFileName: String(source.originalFileName || ''),
    mimeType: 'application/pdf',
    sizeBytes: Number(source.sizeBytes) || 0,
    pageCount: Number(source.pageCount) || 0,
    sha256Abbreviation: String(source.sha256 || '').slice(0, 12),
    uploadedByName: String(source.uploadedByName || ''),
    uploadedAt: timestampIso(source.uploadedAt),
  };
}

function reportSafeMerge(merge = {}, finalPdf = {}) {
  return {
    status: String(merge?.status || ''),
    attemptCount: Number(merge?.attemptCount) || 0,
    lastErrorCode: String(merge?.lastErrorCode || ''),
    finalPageCount: Number(finalPdf?.pageCount) || 0,
    generatedAt: timestampIso(finalPdf?.generatedAt),
  };
}

function validateExistingFinalObject({ bytes, metadata = {}, expectedSha256, resolutionId, finalizationId }) {
  const actualSha256 = sha256(bytes);
  const custom = metadata.metadata || {};
  if (actualSha256 !== expectedSha256
    || custom.sha256 !== expectedSha256
    || custom.resolutionId !== resolutionId
    || custom.finalizationId !== finalizationId) {
    throw serviceError('final-object-conflict', 'A conflicting finalized PDF already exists.', 409);
  }
  return { sha256: actualSha256, generation: String(metadata.generation || ''), sizeBytes: Buffer.byteLength(bytes) };
}

function setCors(req, res) {
  const origin = String(req.get('origin') || '');
  const local = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
  if (ALLOWED_ORIGINS.has(origin) || local) res.set('Access-Control-Allow-Origin', origin);
  res.set('Vary', 'Origin');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.set('Access-Control-Max-Age', '3600');
}

function sendJson(res, status, payload) {
  res.status(status).set('Cache-Control', 'no-store').json(payload);
}

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const contentType = String(req.headers['content-type'] || '');
    if (!/^multipart\/form-data\b/i.test(contentType)) return reject(serviceError('invalid-content-type', 'Multipart form data is required.', 415));
    const fields = {};
    let file = null;
    let failed = false;
    const busboy = new Busboy({ headers: req.headers, limits: { files: 1, fileSize: MAX_SOURCE_BYTES, fields: 8, parts: 10 } });
    busboy.on('field', (name, value) => { fields[name] = String(value || '').slice(0, 500); });
    busboy.on('file', (name, stream, infoOrName, encoding, legacyMime) => {
      if (name !== 'file' || file) { stream.resume(); failed = true; return; }
      const info = typeof infoOrName === 'object' ? infoOrName : { filename: infoOrName, encoding, mimeType: legacyMime };
      const chunks = [];
      let size = 0;
      stream.on('data', chunk => { size += chunk.length; chunks.push(chunk); });
      stream.on('limit', () => { failed = true; });
      stream.on('end', () => { file = { originalFileName: info.filename, mimeType: info.mimeType, sizeBytes: size, bytes: Buffer.concat(chunks) }; });
    });
    busboy.on('error', () => reject(serviceError('invalid-upload', 'The upload could not be read.')));
    busboy.on('finish', () => {
      if (failed || !file) return reject(serviceError(failed ? 'file-too-large' : 'missing-file', failed ? 'The PDF exceeds the 10 MB limit.' : 'A PDF file is required.'));
      resolve({ fields, file });
    });
    req.pipe(busboy);
  });
}

function createResolutionUploadService({ db, admin, bucket, getManagerContext, logger = console, uploadEndpoint = '' }) {
  const now = () => admin.firestore.Timestamp.now();

  function audit(tx, resolutionRef, action, actor, details = {}) {
    tx.set(resolutionRef.collection('audit').doc(), {
      action,
      actorUid: actor.uid,
      actorName: actor.name,
      actorPosition: actor.position,
      timestamp: now(),
      previousValue: details.previousValue ?? null,
      newValue: details.newValue ?? null,
      metadata: details.metadata || {},
    });
  }

  async function createUploadSession(uid, input = {}) {
    const actor = await getManagerContext(uid);
    const resolutionId = cleanId(input.resolutionId, 'Resolution ID');
    const expected = validateSourceFileMetadata({ originalFileName: input.fileName, mimeType: input.mimeType, sizeBytes: Number(input.sizeBytes) });
    const resolutionRef = db.collection('resolutions').doc(resolutionId);
    const sessionRef = db.collection(SESSION_COLLECTION).doc();
    const rateRef = db.collection(RATE_COLLECTION).doc(crypto.createHash('sha256').update(uid).digest('hex'));
    const uploadId = crypto.randomUUID();
    const proof = crypto.randomBytes(32).toString('base64url');
    const createdAt = now();
    const expiresAt = admin.firestore.Timestamp.fromMillis(createdAt.toMillis() + SESSION_TTL_MS);
    await db.runTransaction(async tx => {
      const [resolutionSnap, rateSnap] = await Promise.all([tx.get(resolutionRef), tx.get(rateRef)]);
      if (!resolutionSnap.exists) throw serviceError('not-found', 'Resolution not found.');
      const resolution = resolutionSnap.data() || {};
      if (resolution.status !== 'draft') throw serviceError('failed-precondition', 'Only draft resolutions may receive a PDF.');
      if (sourceMode(resolution) !== 'uploadedPdf') throw serviceError('failed-precondition', 'The resolution is not using an uploaded PDF.');
      const rate = rateSnap.exists ? rateSnap.data() || {} : {};
      const windowStart = rate.windowStartedAt?.toMillis?.() || 0;
      const inWindow = createdAt.toMillis() - windowStart < RATE_WINDOW_MS;
      const count = inWindow ? Number(rate.count) || 0 : 0;
      if (count >= RATE_LIMIT) throw serviceError('resource-exhausted', 'Upload rate limit reached. Please try again later.');
      tx.set(rateRef, { uid, count: count + 1, windowStartedAt: inWindow ? rate.windowStartedAt : createdAt, updatedAt: createdAt }, { merge: true });
      tx.create(sessionRef, {
        resolutionId, uid, uploadId, proofHash: hashProof(proof), status: 'pending', expected,
        storagePath: `resolutions/${resolutionId}/source/${uploadId}.pdf`, createdAt, expiresAt, updatedAt: createdAt,
      });
    });
    return { ok: true, sessionId: sessionRef.id, proof, uploadId, uploadEndpoint, expiresAt: expiresAt.toDate().toISOString(), maxSizeBytes: MAX_SOURCE_BYTES };
  }

  async function uploadHttp(req, res) {
    setCors(req, res);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, code: 'method-not-allowed', message: 'POST required.' });
    let sessionRef;
    try {
      const { fields, file } = await parseMultipart(req);
      const sessionId = cleanId(fields.sessionId, 'Upload session ID');
      const resolutionId = cleanId(fields.resolutionId, 'Resolution ID');
      sessionRef = db.collection(SESSION_COLLECTION).doc(sessionId);
      const sessionSnap = await sessionRef.get();
      if (!sessionSnap.exists) throw serviceError('invalid-session', 'The upload session is invalid.', 403);
      const session = sessionSnap.data() || {};
      if (!proofMatches(fields.proof, session.proofHash)) throw serviceError('invalid-session', 'The upload session is invalid.', 403);
      if (session.resolutionId !== resolutionId || session.status !== 'pending') throw serviceError('replayed-session', 'The upload session is no longer available.', 409);
      if (!session.expiresAt?.toMillis || session.expiresAt.toMillis() <= Date.now()) throw serviceError('expired-session', 'The upload session has expired.', 410);
      const supplied = validateSourceFileMetadata(file);
      if (supplied.mimeType !== session.expected?.mimeType || supplied.sizeBytes !== session.expected?.sizeBytes || supplied.originalFileName !== session.expected?.originalFileName) {
        throw serviceError('upload-mismatch', 'The selected file does not match the upload session.');
      }
      const inspected = await inspectSourcePdf(file.bytes);
      const resolutionRef = db.collection('resolutions').doc(resolutionId);
      await db.runTransaction(async tx => {
        const [freshSession, resolutionSnap] = await Promise.all([tx.get(sessionRef), tx.get(resolutionRef)]);
        const data = freshSession.data() || {};
        const resolution = resolutionSnap.data() || {};
        if (data.status !== 'pending' || !proofMatches(fields.proof, data.proofHash)) throw serviceError('replayed-session', 'The upload session is no longer available.', 409);
        if (resolution.status !== 'draft' || sourceMode(resolution) !== 'uploadedPdf') throw serviceError('failed-precondition', 'The resolution can no longer receive this upload.', 409);
        tx.update(sessionRef, { status: 'uploading', updatedAt: now() });
      });
      const storageFile = bucket.file(session.storagePath);
      await storageFile.save(file.bytes, {
        resumable: false,
        contentType: 'application/pdf',
        validation: 'crc32c',
        preconditionOpts: { ifGenerationMatch: 0 },
        metadata: { cacheControl: 'private, no-store', metadata: { uploadId: session.uploadId, resolutionId, sha256: inspected.sha256, uploaderUid: session.uid } },
      });
      const [metadata] = await storageFile.getMetadata();
      const uploadedAt = now();
      await sessionRef.update({
        status: 'uploaded', objectGeneration: String(metadata.generation), sha256: inspected.sha256,
        originalFileName: supplied.originalFileName, mimeType: supplied.mimeType, sizeBytes: supplied.sizeBytes,
        pageCount: inspected.pageCount, uploadedAt, updatedAt: uploadedAt,
      });
      return sendJson(res, 200, { ok: true, uploadId: session.uploadId, originalFileName: supplied.originalFileName, sizeBytes: supplied.sizeBytes, pageCount: inspected.pageCount, sha256Abbreviation: inspected.sha256.slice(0, 12), uploadedAt: uploadedAt.toDate().toISOString() });
    } catch (error) {
      if (sessionRef) await sessionRef.set({ status: error.code === 'expired-session' ? 'expired' : 'failed', errorCode: String(error.code || 'upload-failed').slice(0, 80), updatedAt: now() }, { merge: true }).catch(() => {});
      logger.warn('Resolution PDF upload rejected.', { code: error.code || 'upload-failed' });
      return sendJson(res, Number(error.status) || 400, { ok: false, code: error.code || 'upload-failed', message: error.message || 'The PDF upload failed.' });
    }
  }

  async function finalizeUpload(uid, input = {}) {
    const actor = await getManagerContext(uid);
    const resolutionId = cleanId(input.resolutionId, 'Resolution ID');
    const sessionId = cleanId(input.sessionId, 'Upload session ID');
    const resolutionRef = db.collection('resolutions').doc(resolutionId);
    const sessionRef = db.collection(SESSION_COLLECTION).doc(sessionId);
    const preflightSessionSnap = await sessionRef.get();
    if (!preflightSessionSnap.exists) throw serviceError('not-found', 'Resolution upload not found.');
    const preflightSession = preflightSessionSnap.data() || {};
    if (preflightSession.status !== 'uploaded' || preflightSession.uid !== uid || preflightSession.resolutionId !== resolutionId) throw serviceError('failed-precondition', 'The upload is not ready to finalize.');
    const [objectMetadata] = await bucket.file(preflightSession.storagePath, { generation: preflightSession.objectGeneration }).getMetadata();
    if (String(objectMetadata.generation) !== String(preflightSession.objectGeneration)
      || objectMetadata.metadata?.sha256 !== preflightSession.sha256
      || objectMetadata.metadata?.resolutionId !== resolutionId
      || objectMetadata.metadata?.uploadId !== preflightSession.uploadId) {
      throw serviceError('upload-mismatch', 'The stored PDF does not match the upload session.');
    }
    let oldSource = null;
    let publicSource;
    await db.runTransaction(async tx => {
      const [resolutionSnap, sessionSnap] = await Promise.all([tx.get(resolutionRef), tx.get(sessionRef)]);
      if (!resolutionSnap.exists || !sessionSnap.exists) throw serviceError('not-found', 'Resolution upload not found.');
      const resolution = resolutionSnap.data() || {};
      const session = sessionSnap.data() || {};
      if (resolution.status !== 'draft' || sourceMode(resolution) !== 'uploadedPdf') throw serviceError('failed-precondition', 'Only an uploaded-PDF draft may be changed.');
      if (session.status !== 'uploaded' || session.uid !== uid || session.resolutionId !== resolutionId) throw serviceError('failed-precondition', 'The upload is not ready to finalize.');
      oldSource = resolution.uploadedSource?.status === 'ready' ? resolution.uploadedSource : null;
      const uploadedSource = {
        uploadId: session.uploadId, status: 'ready', storagePath: session.storagePath, objectGeneration: session.objectGeneration,
        sha256: session.sha256, originalFileName: session.originalFileName, mimeType: 'application/pdf', sizeBytes: session.sizeBytes,
        pageCount: session.pageCount, uploadedByUid: uid, uploadedByName: actor.name, uploadedAt: session.uploadedAt,
      };
      tx.update(resolutionRef, { uploadedSource, updatedAt: now() });
      tx.update(sessionRef, { status: 'finalized', finalizedAt: now(), updatedAt: now() });
      audit(tx, resolutionRef, oldSource ? 'resolution_source_replaced' : 'resolution_source_attached', actor, { metadata: { uploadId: session.uploadId, pageCount: session.pageCount, sizeBytes: session.sizeBytes } });
      publicSource = reportSafeSource(uploadedSource);
    });
    if (oldSource?.storagePath && oldSource.storagePath !== `resolutions/${resolutionId}/source/${publicSource.uploadId}.pdf`) {
      const oldSessions = await db.collection(SESSION_COLLECTION).where('uploadId', '==', oldSource.uploadId).limit(1).get();
      if (!oldSessions.empty) await oldSessions.docs[0].ref.set({ status: 'cancelled', updatedAt: now() }, { merge: true });
      await bucket.file(oldSource.storagePath, { generation: oldSource.objectGeneration }).delete({ ignoreNotFound: true }).catch(error => logger.warn('Old draft Resolution source cleanup failed.', { code: error.code || 'storage-delete-failed' }));
    }
    return { ok: true, uploadedSource: publicSource };
  }

  async function removeSource(uid, input = {}) {
    const actor = await getManagerContext(uid);
    const resolutionId = cleanId(input.resolutionId, 'Resolution ID');
    const resolutionRef = db.collection('resolutions').doc(resolutionId);
    let removed = null;
    await db.runTransaction(async tx => {
      const snap = await tx.get(resolutionRef);
      if (!snap.exists) throw serviceError('not-found', 'Resolution not found.');
      const resolution = snap.data() || {};
      if (resolution.status !== 'draft') throw serviceError('failed-precondition', 'The source PDF cannot be removed after voting opens.');
      removed = resolution.uploadedSource?.status === 'ready' ? resolution.uploadedSource : null;
      if (!removed) return;
      tx.update(resolutionRef, { uploadedSource: admin.firestore.FieldValue.delete(), updatedAt: now() });
      audit(tx, resolutionRef, 'resolution_source_removed', actor, { metadata: { uploadId: removed.uploadId } });
    });
    if (removed?.uploadId) {
      const sessions = await db.collection(SESSION_COLLECTION).where('uploadId', '==', removed.uploadId).limit(1).get();
      if (!sessions.empty) await sessions.docs[0].ref.set({ status: 'cancelled', updatedAt: now() }, { merge: true });
      await bucket.file(removed.storagePath, { generation: removed.objectGeneration }).delete({ ignoreNotFound: true }).catch(error => logger.warn('Removed draft Resolution source cleanup failed.', { code: error.code || 'storage-delete-failed' }));
    }
    return { ok: true, removed: Boolean(removed) };
  }

  async function verifyBearer(req) {
    const match = String(req.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
    if (!match) throw serviceError('unauthenticated', 'Authentication required.', 401);
    try { return await admin.auth().verifyIdToken(match[1]); }
    catch { throw serviceError('unauthenticated', 'Authentication required.', 401); }
  }

  async function streamPdf(req, res, finalized) {
    setCors(req, res);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'GET') return sendJson(res, 405, { ok: false, code: 'method-not-allowed', message: 'GET required.' });
    try {
      const token = await verifyBearer(req);
      await getManagerContext(token.uid);
      const resolutionId = cleanId(req.query.resolutionId, 'Resolution ID');
      const snap = await db.collection('resolutions').doc(resolutionId).get();
      if (!snap.exists) throw serviceError('not-found', 'Resolution not found.', 404);
      const resolution = snap.data() || {};
      const reference = finalized ? resolution.finalizedMergedPdf : resolution.uploadedSource;
      if (finalized && (!['passed', 'rejected', 'closed_without_decision'].includes(resolution.status) || resolution.merge?.status !== 'ready')) throw serviceError('not-ready', 'The finalized PDF is not ready.', 409);
      if (!reference?.storagePath || !reference.objectGeneration) throw serviceError('not-found', 'The PDF is unavailable.', 404);
      const file = bucket.file(reference.storagePath, { generation: reference.objectGeneration });
      const fileName = finalized ? `RCPH-${safeFileName(resolution.resolutionNumber, 'Resolution')}-Final.pdf` : safeFileName(reference.originalFileName);
      res.status(200).set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `${finalized ? 'attachment' : 'inline'}; filename="${fileName}"`, 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' });
      return file.createReadStream({ validation: true }).on('error', error => { logger.warn('Resolution PDF stream failed.', { code: error.code || 'storage-read-failed' }); if (!res.headersSent) sendJson(res, 404, { ok: false, code: 'not-found', message: 'The PDF is unavailable.' }); else res.destroy(); }).pipe(res);
    } catch (error) {
      return sendJson(res, Number(error.status) || 403, { ok: false, code: error.code || 'permission-denied', message: error.message || 'The PDF could not be downloaded.' });
    }
  }

  async function assertSourceObject(source) {
    if (!source?.storagePath || !source.objectGeneration || !source.sha256) throw serviceError('missing-source', 'A ready uploaded PDF is required.');
    const file = bucket.file(source.storagePath, { generation: source.objectGeneration });
    const [exists] = await file.exists();
    if (!exists) throw serviceError('missing-source', 'The uploaded PDF is unavailable.');
    const [metadata] = await file.getMetadata();
    if (String(metadata.generation) !== String(source.objectGeneration) || metadata.metadata?.sha256 !== source.sha256) throw serviceError('source-mismatch', 'The uploaded PDF metadata does not match the draft.');
    return true;
  }

  async function processMerge(resolutionId) {
    const resolutionRef = db.collection('resolutions').doc(cleanId(resolutionId, 'Resolution ID'));
    let frozen;
    const leaseId = crypto.randomUUID();
    await db.runTransaction(async tx => {
      const snap = await tx.get(resolutionRef);
      if (!snap.exists) throw serviceError('not-found', 'Resolution not found.');
      const resolution = snap.data() || {};
      if (sourceMode(resolution) !== 'uploadedPdf' || !['passed', 'rejected', 'closed_without_decision'].includes(resolution.status)) throw serviceError('failed-precondition', 'Only a closed uploaded-PDF resolution may be merged.');
      if (resolution.merge?.status === 'ready' && resolution.finalizedMergedPdf?.storagePath) return;
      const leaseActive = resolution.merge?.status === 'processing' && (resolution.merge?.leaseExpiresAt?.toMillis?.() || 0) > Date.now();
      if (leaseActive) throw serviceError('merge-in-progress', 'The PDF merge is already in progress.');
      frozen = resolution;
      const leaseStartedAt = now();
      tx.update(resolutionRef, { 'merge.status': 'processing', 'merge.attemptCount': (Number(resolution.merge?.attemptCount) || 0) + 1, 'merge.lastErrorCode': '', 'merge.leaseId': leaseId, 'merge.leaseExpiresAt': admin.firestore.Timestamp.fromMillis(leaseStartedAt.toMillis() + (10 * 60 * 1000)), 'merge.updatedAt': leaseStartedAt });
    });
    if (!frozen) return { ok: true, status: 'ready' };
    const finalizationId = cleanId(frozen.merge?.finalizationId, 'Finalization ID');
    const source = frozen.finalizedUploadedSourceSnapshot;
    const finalPath = `resolutions/${resolutionRef.id}/final/${finalizationId}.pdf`;
    try {
      const sourceFile = bucket.file(source.storagePath, { generation: source.objectGeneration });
      const [sourceBytes] = await sourceFile.download();
      if (sha256(sourceBytes) !== source.sha256) throw serviceError('source-checksum-mismatch', 'The uploaded source checksum does not match.');
      const merged = await mergeResolutionPdf({
        sourceBytes,
        letterheadBytes: loadLetterheadBytes(),
        details: {
          resolutionNumber: frozen.resolutionNumber,
          title: frozen.title,
          resultLabel: String(frozen.result || frozen.status || '').replaceAll('_', ' ').toUpperCase(),
          approveCount: frozen.approveCount,
          rejectCount: frozen.rejectCount,
          abstainCount: frozen.abstainCount,
          config: frozen.finalizedVotesTableConfigSnapshot,
          rows: frozen.finalizedVoteRowsSnapshot,
          metadataTimestamp: frozen.merge?.createdAt || frozen.closedAt,
          finalizationId,
        },
      });
      if (merged.sourcePageCount !== Number(source.pageCount)) throw serviceError('source-page-count-mismatch', 'The uploaded source page count does not match.');
      const finalFile = bucket.file(finalPath);
      try {
        await finalFile.save(merged.bytes, { resumable: false, contentType: 'application/pdf', validation: 'crc32c', preconditionOpts: { ifGenerationMatch: 0 }, metadata: { cacheControl: 'private, no-store', metadata: { resolutionId: resolutionRef.id, finalizationId, sha256: merged.sha256 } } });
      } catch (error) {
        if (![409, 412].includes(Number(error.code))) throw error;
        const [[existing], [existingMetadata]] = await Promise.all([finalFile.download(), finalFile.getMetadata()]);
        validateExistingFinalObject({ bytes: existing, metadata: existingMetadata, expectedSha256: merged.sha256, resolutionId: resolutionRef.id, finalizationId });
      }
      const [metadata] = await finalFile.getMetadata();
      const completedAt = now();
      const generatedAt = frozen.merge?.createdAt || frozen.closedAt;
      if (!generatedAt?.toMillis) throw serviceError('missing-finalization-timestamp', 'The frozen finalization timestamp is unavailable.');
      await db.runTransaction(async tx => {
        const snap = await tx.get(resolutionRef);
        const current = snap.data() || {};
        if (current.merge?.finalizationId !== finalizationId || current.merge?.leaseId !== leaseId) throw serviceError('finalization-mismatch', 'The finalization record changed during merge.');
        tx.update(resolutionRef, {
          merge: { ...current.merge, status: 'ready', lastErrorCode: '', leaseId: null, leaseExpiresAt: null, updatedAt: completedAt, generatedAt },
          finalizedMergedPdf: { storagePath: finalPath, objectGeneration: String(metadata.generation), sha256: merged.sha256, sizeBytes: merged.bytes.length, pageCount: merged.pageCount, sourcePageCount: merged.sourcePageCount, appendixPageCount: merged.appendixPageCount, generatedAt },
          updatedAt: completedAt,
        });
      });
      await resolutionRef.collection('audit').add({ action: 'resolution_pdf_merge_completed', actorUid: 'system', actorName: 'System', actorPosition: 'System', timestamp: completedAt, previousValue: null, newValue: { status: 'ready' }, metadata: { pageCount: merged.pageCount, appendixPageCount: merged.appendixPageCount } });
      return { ok: true, status: 'ready', pageCount: merged.pageCount };
    } catch (error) {
      const code = String(error.code || 'merge-failed').slice(0, 80);
      const failedStatus = code === 'final-object-conflict' ? 'conflict' : 'failed';
      await db.runTransaction(async tx => {
        const snap = await tx.get(resolutionRef);
        const current = snap.data() || {};
        if (current.merge?.leaseId !== leaseId) return;
        tx.update(resolutionRef, { 'merge.status': failedStatus, 'merge.lastErrorCode': code, 'merge.leaseId': null, 'merge.leaseExpiresAt': null, 'merge.updatedAt': now() });
      });
      await resolutionRef.collection('audit').add({ action: 'resolution_pdf_merge_failed', actorUid: 'system', actorName: 'System', actorPosition: 'System', timestamp: now(), previousValue: null, newValue: { status: failedStatus }, metadata: { errorCode: code } }).catch(() => {});
      logger.error('Resolution PDF merge failed.', { resolutionId: resolutionRef.id, code });
      throw serviceError(code, 'The finalized PDF could not be generated. It can be retried.', 500);
    }
  }

  async function retryMerge(uid, input = {}) {
    const actor = await getManagerContext(uid);
    const resolutionId = cleanId(input.resolutionId, 'Resolution ID');
    const resolutionRef = db.collection('resolutions').doc(resolutionId);
    const snap = await resolutionRef.get();
    if (!snap.exists) throw serviceError('not-found', 'Resolution not found.');
    const resolution = snap.data() || {};
    if (resolution.merge?.status === 'ready') throw serviceError('already-exists', 'The finalized PDF is already ready.');
    const expiredLease = resolution.merge?.status === 'processing' && (resolution.merge?.leaseExpiresAt?.toMillis?.() || 0) <= Date.now();
    if (!['failed', 'pending'].includes(resolution.merge?.status) && !expiredLease) throw serviceError('failed-precondition', 'The PDF merge cannot be retried right now.');
    const result = await processMerge(resolutionId);
    await resolutionRef.collection('audit').add({ action: 'resolution_pdf_merge_retried', actorUid: actor.uid, actorName: actor.name, actorPosition: actor.position, timestamp: now(), previousValue: null, newValue: { status: result.status }, metadata: {} });
    return result;
  }

  async function cleanupExpiredSessions() {
    const cutoff = now();
    const snap = await db.collection(SESSION_COLLECTION).where('expiresAt', '<=', cutoff).limit(100).get();
    let cleaned = 0;
    for (const doc of snap.docs) {
      const session = doc.data() || {};
      if (['finalized', 'cancelled', 'expired'].includes(session.status)) continue;
      if (session.storagePath) await bucket.file(session.storagePath, { generation: session.objectGeneration }).delete({ ignoreNotFound: true }).catch(() => {});
      await doc.ref.set({ status: 'expired', updatedAt: now() }, { merge: true });
      cleaned += 1;
    }
    return { ok: true, cleaned };
  }

  return {
    assertSourceObject,
    cleanupExpiredSessions,
    createUploadSession,
    finalizeUpload,
    processMerge,
    removeSource,
    reportSafeMerge,
    reportSafeSource,
    retryMerge,
    sourceMode,
    streamFinalPdf: (req, res) => streamPdf(req, res, true),
    streamSourcePdf: (req, res) => streamPdf(req, res, false),
    uploadHttp,
  };
}

module.exports = {
  RATE_COLLECTION,
  SESSION_COLLECTION,
  SESSION_TTL_MS,
  createResolutionUploadService,
  reportSafeMerge,
  reportSafeSource,
  sourceMode,
  validateExistingFinalObject,
};
