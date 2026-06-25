'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const positionHelpers = require('../lib/positions');
const visit = require('../lib/visit-submissions');
const cleanSlate = require('../lib/riy-clean-slate-executor');

const fixturePath = path.join(__dirname, 'fixtures', 'visit-submission-upload-lifecycle-sample.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const repoRoot = path.resolve(__dirname, '..', '..');

function makeTokenGenerator() {
  let counter = 0;
  return {
    randomHex(bytes) {
      counter += 1;
      return counter.toString(16).padStart(bytes * 2, '0').slice(-(bytes * 2));
    },
  };
}

function makeClock(start = 1000000) {
  return {
    value: start,
    now() {
      return this.value;
    },
    advance(ms) {
      this.value += ms;
    },
  };
}

function createEnv() {
  const clock = makeClock();
  const adapter = visit.createMemoryVisitSubmissionAdapter(fixture);
  const service = visit.createVisitSubmissionService({
    adapter,
    positionHelpers,
    clock,
    tokenGenerator: makeTokenGenerator(),
  });
  return { adapter, service, clock };
}

async function initializedEnv() {
  const env = createEnv();
  await env.service.initializeStructure('president-uid');
  return env;
}

function file(overrides = {}) {
  return {
    clientFileId: overrides.clientFileId || 'local-1',
    fileName: overrides.fileName || 'Secretary Report.pdf',
    mimeType: overrides.mimeType || 'application/pdf',
    sizeBytes: overrides.sizeBytes || 123456,
  };
}

function drive(overrides = {}) {
  return {
    driveFileId: overrides.driveFileId || 'driveFileABC12345',
    driveFolderId: overrides.driveFolderId || 'driveFolderABC12345',
    driveFileUrl: overrides.driveFileUrl || 'https://drive.google.com/file/d/driveFileABC12345/view',
  };
}

async function rejectsWithCode(promiseFactory, code, label) {
  let rejected = false;
  try {
    await promiseFactory();
  } catch (err) {
    rejected = true;
    assert.strictEqual(err?.httpsCode || err?.code, code, label || err.message);
  }
  assert.ok(rejected, label || `Expected rejection with ${code}`);
}

async function createSession(env, uid = 'bod-secretary', overrides = {}) {
  return env.service.createUploadSession(uid, {
    visitType: overrides.visitType || 'clubAssembly',
    positionKey: overrides.positionKey || 'secretary',
    files: overrides.files || [file(overrides.file || {})],
  });
}

async function consumeTicket(env, session, index = 0, overrides = {}) {
  const item = session.files[index];
  return env.service.validateVisitUploadTicketWithProof({
    uploadType: 'visitSubmission',
    ticket: overrides.ticket || item.ticket,
    sessionId: overrides.sessionId || session.sessionId,
    clientFileId: overrides.clientFileId || item.clientFileId,
    fileName: overrides.fileName || item.fileName,
    mimeType: overrides.mimeType || item.mimeType,
    sizeBytes: overrides.sizeBytes || item.sizeBytes,
  });
}

async function completeDrive(env, session, proof, index = 0, overrides = {}) {
  const item = session.files[index];
  return env.service.completeDriveUpload({
    sessionId: overrides.sessionId || session.sessionId,
    clientFileId: overrides.clientFileId || item.clientFileId,
    ticket: overrides.ticket || item.ticket,
    uploadProof: overrides.uploadProof || proof.uploadProof,
    fileName: overrides.fileName || item.fileName,
    mimeType: overrides.mimeType || item.mimeType,
    sizeBytes: overrides.sizeBytes || item.sizeBytes,
    finalFileName: overrides.finalFileName || item.fileName,
    ...drive(overrides.drive || {})
  });
}

async function finalize(env, uid, session, completion, index = 0, overrides = {}) {
  const item = session.files[index];
  return env.service.finalizeUpload(uid, {
    sessionId: overrides.sessionId || session.sessionId,
    clientFileId: overrides.clientFileId || item.clientFileId,
    ticket: overrides.ticket || item.ticket,
    completionProof: overrides.completionProof || completion.completionProof,
  });
}

function folderDoc(env, visitType = 'clubAssembly', positionKey = 'secretary') {
  return env.adapter.store.visitSubmissionPositions[`${visitType}_${positionKey}`];
}

function assertNoInternalFields(submission) {
  ['driveFileId', 'driveFolderId', 'uploadSessionId', 'deletedByUid', 'deleteReason', 'ticketId'].forEach((field) => {
    assert.ok(!Object.prototype.hasOwnProperty.call(submission, field), `${field} hidden`);
  });
}

function assertNoSecretFields(value, pathLabel = 'root') {
  if (!value || typeof value !== 'object') return;
  Object.keys(value).forEach((key) => {
    assert.ok(!/secret|private|credential|token/i.test(key), `secret-like audit key ${pathLabel}.${key}`);
    assertNoSecretFields(value[key], `${pathLabel}.${key}`);
  });
}

(async () => {
  let env = createEnv();
  await rejectsWithCode(() => env.service.createUploadSession('', {
    visitType: 'clubAssembly',
    positionKey: 'secretary',
    files: [file()],
  }), 'unauthenticated', 'unauthenticated upload denied');

  env = await initializedEnv();
  await rejectsWithCode(() => createSession(env, 'gbm-uid'), 'permission-denied', 'GBM denied');
  await rejectsWithCode(() => createSession(env, 'prospect-uid'), 'permission-denied', 'prospect denied');
  await rejectsWithCode(() => createSession(env, 'bod-secretary', { positionKey: 'treasurer' }), 'permission-denied');

  let session = await createSession(env, 'bod-secretary');
  assert.strictEqual(folderDoc(env).reservedFileCount, 1, 'reservation counter increments');
  assert.strictEqual(session.files.length, 1);
  assert.match(session.files[0].fileName, /^clubAssembly_secretary_local-1_[a-f0-9]+_Secretary Report\.pdf$/);

  const presidentSession = await createSession(env, 'president-uid', { positionKey: 'treasurer' });
  assert.strictEqual(presidentSession.positionKey, 'treasurer', 'President can upload to any position');
  const adminSession = await createSession(env, 'admin-uid', { positionKey: 'editor', file: { clientFileId: 'admin-1' } });
  assert.strictEqual(adminSession.positionKey, 'editor', 'Admin can upload to any position');

  const uninitialized = createEnv();
  await rejectsWithCode(() => createSession(uninitialized, 'bod-secretary'), 'failed-precondition');

  env = await initializedEnv();
  env.adapter.store.visitSubmissionConfig.clubAssembly.enabled = false;
  await rejectsWithCode(() => createSession(env, 'bod-secretary'), 'failed-precondition', 'disabled visit rejected');
  env = await initializedEnv();
  env.adapter.store.visitSubmissionConfig.clubAssembly.submissionOpen = false;
  await rejectsWithCode(() => createSession(env, 'bod-secretary'), 'failed-precondition', 'closed visit rejected');
  env = await initializedEnv();
  folderDoc(env).enabled = false;
  await rejectsWithCode(() => createSession(env, 'bod-secretary'), 'failed-precondition', 'disabled folder rejected');
  env = await initializedEnv();
  folderDoc(env).submissionOpen = false;
  await rejectsWithCode(() => createSession(env, 'bod-secretary'), 'failed-precondition', 'closed folder rejected');
  env = await initializedEnv();
  folderDoc(env).locked = true;
  await rejectsWithCode(() => createSession(env, 'bod-secretary'), 'failed-precondition', 'locked folder rejected');

  env = await initializedEnv();
  await rejectsWithCode(
    () => createSession(env, 'bod-secretary', { files: Array.from({ length: 11 }, (_, i) => file({ clientFileId: `f-${i}` })) }),
    'resource-exhausted',
    'max 10 selected files enforced'
  );
  folderDoc(env).maxFilesPerSelection = 2;
  await rejectsWithCode(
    () => createSession(env, 'bod-secretary', { files: [file({ clientFileId: 'a' }), file({ clientFileId: 'b' }), file({ clientFileId: 'c' })] }),
    'resource-exhausted',
    'folder selection limit enforced'
  );
  await rejectsWithCode(() => createSession(env, 'bod-secretary', { file: { sizeBytes: 26 * 1024 * 1024 } }), 'invalid-argument');
  folderDoc(env).maxFileSizeBytes = 2 * 1024 * 1024;
  await rejectsWithCode(() => createSession(env, 'bod-secretary', { file: { sizeBytes: 3 * 1024 * 1024 } }), 'invalid-argument');
  await rejectsWithCode(() => createSession(env, 'bod-secretary', { file: { fileName: 'bad.exe', mimeType: 'application/octet-stream' } }), 'invalid-argument');
  await rejectsWithCode(() => createSession(env, 'bod-secretary', { file: { fileName: 'bad.svg', mimeType: 'image/svg+xml' } }), 'invalid-argument');
  await rejectsWithCode(
    () => createSession(env, 'bod-secretary', { files: [file({ clientFileId: 'dup' }), file({ clientFileId: 'dup' })] }),
    'invalid-argument',
    'duplicate clientFileId rejected'
  );

  env = await initializedEnv();
  folderDoc(env).maxActiveFiles = 1;
  folderDoc(env).activeFileCount = 1;
  await rejectsWithCode(() => createSession(env, 'bod-secretary'), 'resource-exhausted', 'capacity limit enforced');
  folderDoc(env).activeFileCount = 0;
  await createSession(env, 'bod-secretary');
  await rejectsWithCode(() => createSession(env, 'bod-secretary', { file: { clientFileId: 'another' } }), 'resource-exhausted', 'concurrent reservation blocked');

  env = await initializedEnv();
  session = await createSession(env, 'bod-secretary');
  await rejectsWithCode(() => consumeTicket(env, session, 0, { sessionId: 'wrong-session' }), 'failed-precondition', 'ticket bound to session');
  await rejectsWithCode(() => consumeTicket(env, session, 0, { clientFileId: 'wrong-file' }), 'failed-precondition', 'ticket bound to file');
  await rejectsWithCode(() => consumeTicket(env, session, 0, { fileName: 'wrong.pdf' }), 'failed-precondition', 'mismatched filename rejected');
  await rejectsWithCode(() => consumeTicket(env, session, 0, { mimeType: 'image/png' }), 'failed-precondition', 'mismatched MIME rejected');
  await rejectsWithCode(() => consumeTicket(env, session, 0, { sizeBytes: 999 }), 'failed-precondition', 'mismatched size rejected');

  const proof = await consumeTicket(env, session);
  assert.strictEqual(proof.visitDisplayTitle, 'Club Assembly', 'validator returns canonical visit display title');
  assert.strictEqual(proof.positionTitle, 'Secretary', 'validator returns canonical position title');
  assert.strictEqual(proof.avenueCode, 'SEC', 'validator returns canonical avenue code');
  await rejectsWithCode(() => consumeTicket(env, session), 'already-exists', 'ticket single-use');
  await rejectsWithCode(() => finalize(env, 'bod-secretary', session, { completionProof: 'not-completed' }), 'failed-precondition');
  const wrongSessionForBinding = await createSession(env, 'admin-uid', { positionKey: 'editor', file: { clientFileId: 'wrong-session-file' } });
  await rejectsWithCode(() => completeDrive(env, session, proof, 0, { ticket: presidentSession.files[0].ticket }), 'not-found', 'trusted completion bound to ticket');
  await rejectsWithCode(() => completeDrive(env, session, proof, 0, { sessionId: wrongSessionForBinding.sessionId }), 'failed-precondition', 'trusted completion bound to session');
  await rejectsWithCode(() => completeDrive(env, session, proof, 0, { clientFileId: 'wrong-client' }), 'failed-precondition', 'trusted completion bound to client file');
  await rejectsWithCode(() => completeDrive(env, session, proof, 0, { fileName: 'wrong.pdf' }), 'failed-precondition', 'trusted completion bound to filename');
  await rejectsWithCode(() => completeDrive(env, session, proof, 0, { mimeType: 'image/png' }), 'failed-precondition', 'trusted completion bound to MIME');
  await rejectsWithCode(() => completeDrive(env, session, proof, 0, { sizeBytes: 1 }), 'failed-precondition', 'trusted completion bound to size');
  await rejectsWithCode(() => completeDrive(env, session, proof, 0, { uploadProof: 'wrong-proof' }), 'permission-denied');
  const completion = await completeDrive(env, session, proof);
  await rejectsWithCode(() => completeDrive(env, session, proof), 'already-exists', 'completion proof is one-use at completion');
  await rejectsWithCode(() => finalize(env, 'bod-secretary', session, completion, 0, { completionProof: 'wrong-proof' }), 'permission-denied');
  const finalized = await finalize(env, 'bod-secretary', session, completion, 0, {
    drive: {
      driveFileId: 'browserSuppliedIgnored',
      driveFolderId: 'browserFolderIgnored',
      driveFileUrl: 'https://drive.google.com/file/d/browserSuppliedIgnored/view',
    },
  });
  assert.ok(finalized.submissionId, 'active submission created only after valid upload');
  assert.strictEqual(env.adapter.store.visitSubmissions[finalized.submissionId].driveFileId, 'driveFileABC12345', 'browser Drive file ID ignored');
  assert.strictEqual(env.adapter.store.visitSubmissions[finalized.submissionId].driveFolderId, 'driveFolderABC12345', 'browser Drive folder ID ignored');
  assert.strictEqual(env.adapter.store.visitSubmissions[finalized.submissionId].driveFileUrl, 'https://drive.google.com/file/d/driveFileABC12345/view', 'browser Drive URL ignored');
  assert.strictEqual(folderDoc(env).reservedFileCount, 0, 'finalization decrements reserved');
  assert.strictEqual(folderDoc(env).activeFileCount, 1, 'finalization increments active');
  assert.strictEqual(folderDoc(env).driveFolderId, 'driveFolderABC12345', 'Drive folder reference stored once');
  await rejectsWithCode(() => finalize(env, 'bod-secretary', session, completion), 'already-exists', 'completion proof cannot be reused');

  const folderIdEnv = await initializedEnv();
  const folderIdSessionOne = await createSession(folderIdEnv, 'bod-secretary');
  const folderIdProofOne = await consumeTicket(folderIdEnv, folderIdSessionOne);
  const folderIdCompletionOne = await completeDrive(folderIdEnv, folderIdSessionOne, folderIdProofOne);
  await finalize(folderIdEnv, 'bod-secretary', folderIdSessionOne, folderIdCompletionOne);
  const folderIdSessionTwo = await createSession(folderIdEnv, 'bod-secretary', { file: { clientFileId: 'folder-two' } });
  const folderIdProofTwo = await consumeTicket(folderIdEnv, folderIdSessionTwo);
  const folderIdCompletionTwo = await completeDrive(folderIdEnv, folderIdSessionTwo, folderIdProofTwo, 0, {
    drive: {
      driveFileId: 'driveFileMATCHING',
      driveFolderId: 'driveFolderABC12345',
      driveFileUrl: 'https://drive.google.com/file/d/driveFileMATCHING/view',
    },
  });
  await finalize(folderIdEnv, 'bod-secretary', folderIdSessionTwo, folderIdCompletionTwo);
  const folderIdSessionThree = await createSession(folderIdEnv, 'bod-secretary', { file: { clientFileId: 'folder-three' } });
  const folderIdProofThree = await consumeTicket(folderIdEnv, folderIdSessionThree);
  const mismatchedCompletion = await completeDrive(folderIdEnv, folderIdSessionThree, folderIdProofThree, 0, {
    drive: {
      driveFileId: 'driveFileDIFFERENT',
      driveFolderId: 'driveFolderDIFFERENT',
      driveFileUrl: 'https://drive.google.com/file/d/driveFileDIFFERENT/view',
    },
  });
  await rejectsWithCode(() => finalize(folderIdEnv, 'bod-secretary', folderIdSessionThree, mismatchedCompletion), 'failed-precondition', 'mismatched folder rejected');
  assert.strictEqual(folderDoc(folderIdEnv).driveFolderId, 'driveFolderABC12345', 'repeated folder lookup is idempotent');

  const normalFolder = await env.service.getFolder('bod-secretary', 'clubAssembly', 'secretary');
  assertNoInternalFields(normalFolder.submissions[0]);

  await rejectsWithCode(() => env.service.withdrawSubmission('bod-editor', { submissionId: finalized.submissionId }), 'permission-denied');
  const withdrawn = await env.service.withdrawSubmission('bod-secretary', { submissionId: finalized.submissionId });
  assert.strictEqual(withdrawn.status, 'archived', 'BOD withdraw archives');
  assert.strictEqual(folderDoc(env).activeFileCount, 0, 'withdraw decrements active');
  await rejectsWithCode(() => env.service.withdrawSubmission('bod-secretary', { submissionId: finalized.submissionId }), 'failed-precondition');

  env = await initializedEnv();
  session = await createSession(env, 'bod-secretary');
  const proof2 = await consumeTicket(env, session);
  const completion2 = await completeDrive(env, session, proof2);
  const removeTarget = await finalize(env, 'bod-secretary', session, completion2);
  const removed = await env.service.removeSubmission('admin-uid', { submissionId: removeTarget.submissionId, reason: 'Duplicate' });
  assert.strictEqual(removed.status, 'admin-removed');
  assert.strictEqual(folderDoc(env).activeFileCount, 0, 'manager remove decrements once');
  await rejectsWithCode(() => env.service.removeSubmission('admin-uid', { submissionId: removeTarget.submissionId, reason: 'Again' }), 'failed-precondition');

  env = await initializedEnv();
  session = await createSession(env, 'bod-secretary');
  const proof3 = await consumeTicket(env, session);
  const completion3 = await completeDrive(env, session, proof3);
  const oldSubmission = await finalize(env, 'bod-secretary', session, completion3);
  const activeBeforeReplace = folderDoc(env).activeFileCount;
  await rejectsWithCode(() => env.service.replaceSubmission('bod-editor', {
    replacesSubmissionId: oldSubmission.submissionId,
    files: [file({ clientFileId: 'other-user-replace' })],
  }), 'permission-denied', 'BOD replacing someone else denied');
  await rejectsWithCode(() => env.service.replaceSubmission('bod-secretary', {
    replacesSubmissionId: oldSubmission.submissionId,
    files: [],
  }), 'invalid-argument', 'zero-file replacement rejected');
  await rejectsWithCode(() => env.service.replaceSubmission('bod-secretary', {
    replacesSubmissionId: oldSubmission.submissionId,
    files: [file({ clientFileId: 'two-a' }), file({ clientFileId: 'two-b' })],
  }), 'invalid-argument', 'two-file replacement rejected');
  const managerReplacement = await env.service.replaceSubmission('admin-uid', {
    replacesSubmissionId: oldSubmission.submissionId,
    files: [file({ clientFileId: 'manager-replacement' })],
  });
  assert.strictEqual(managerReplacement.positionKey, 'secretary', 'manager can replace any active submission');
  await env.service.cancelUploadSession('admin-uid', { sessionId: managerReplacement.sessionId });
  const replacementSession = await env.service.replaceSubmission('bod-secretary', {
    replacesSubmissionId: oldSubmission.submissionId,
    files: [file({ clientFileId: 'replacement-1', fileName: 'Replacement.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })],
  });
  assert.strictEqual(env.adapter.store.visitSubmissions[oldSubmission.submissionId].status, 'active', 'old remains active before replacement finalizes');
  env.adapter.store.visitSubmissions[oldSubmission.submissionId].status = 'archived';
  const replacementProof = await consumeTicket(env, replacementSession);
  const replacementCompletion = await completeDrive(env, replacementSession, replacementProof, 0, {
    drive: {
      driveFileId: 'driveFileREPLACEMENT',
      driveFolderId: 'driveFolderABC12345',
      driveFileUrl: 'https://drive.google.com/file/d/driveFileREPLACEMENT/view',
    },
  });
  await rejectsWithCode(() => finalize(env, 'bod-secretary', replacementSession, replacementCompletion), 'failed-precondition', 'old status change blocks replacement');
  assert.strictEqual(env.adapter.store.visitSubmissions[oldSubmission.submissionId].status, 'archived', 'failed replacement leaves old status unchanged');
  env.adapter.store.visitSubmissions[oldSubmission.submissionId].status = 'active';
  const replacement = await finalize(env, 'bod-secretary', replacementSession, replacementCompletion);
  assert.strictEqual(env.adapter.store.visitSubmissions[oldSubmission.submissionId].status, 'replaced');
  assert.strictEqual(env.adapter.store.visitSubmissions[oldSubmission.submissionId].replacedBySubmissionId, replacement.submissionId);
  assert.strictEqual(folderDoc(env).activeFileCount, activeBeforeReplace, 'replacement keeps active count unchanged');

  await createSession(env, 'bod-secretary', { file: { clientFileId: 'reserved-live' } });
  const consumedLive = await createSession(env, 'bod-secretary', { file: { clientFileId: 'consumed-live' } });
  await consumeTicket(env, consumedLive);
  const completedLive = await createSession(env, 'bod-secretary', { file: { clientFileId: 'completed-live' } });
  const completedLiveProof = await consumeTicket(env, completedLive);
  await completeDrive(env, completedLive, completedLiveProof, 0, {
    drive: {
      driveFileId: 'driveFileCOMPLETEDLIVE',
      driveFolderId: 'driveFolderABC12345',
      driveFileUrl: 'https://drive.google.com/file/d/driveFileCOMPLETEDLIVE/view',
    },
  });
  const cancelledLive = await createSession(env, 'bod-secretary', { file: { clientFileId: 'cancelled-live' } });
  await env.service.cancelUploadSession('bod-secretary', { sessionId: cancelledLive.sessionId });
  const expiredLive = await createSession(env, 'bod-secretary', { file: { clientFileId: 'expired-live' } });
  env.adapter.store.visitSubmissionUploadSessions[expiredLive.sessionId].status = 'expired';
  folderDoc(env).activeFileCount = 99;
  folderDoc(env).reservedFileCount = 99;
  const reconciled = await env.service.reconcileFolderCount('president-uid', { visitType: 'clubAssembly', positionKey: 'secretary' });
  assert.strictEqual(reconciled.reservedFileCount, 3, 'reconcile preserves outstanding reservations');
  assert.strictEqual(folderDoc(env).activeFileCount, reconciled.activeFileCount, 'reconcile repairs active count');
  assert.ok(folderDoc(env).activeFileCount >= 0 && folderDoc(env).reservedFileCount >= 0, 'reconcile never creates negative counters');

  const moderation = await env.service.getModerationData('president-uid', { visitType: 'clubAssembly', status: 'active', limit: 2 });
  assert.ok(moderation.pageSize <= 2, 'manager moderation is paginated');
  assert.ok(Object.prototype.hasOwnProperty.call(moderation.submissions[0] || {}, 'driveFileId'), 'manager moderation includes Drive IDs');
  if (moderation.hasMore) {
    const secondPage = await env.service.getModerationData('president-uid', {
      visitType: 'clubAssembly',
      status: 'active',
      limit: 2,
      cursor: moderation.nextCursor,
    });
    const firstIds = new Set(moderation.submissions.map(item => item.submissionId));
    secondPage.submissions.forEach(item => assert.ok(!firstIds.has(item.submissionId), 'pagination has no duplicates'));
  }
  await rejectsWithCode(() => env.service.getModerationData('bod-secretary', { visitType: 'clubAssembly' }), 'permission-denied');

  env = await initializedEnv();
  session = await createSession(env, 'bod-secretary');
  assert.strictEqual(folderDoc(env).reservedFileCount, 1);
  const cancelled = await env.service.cancelUploadSession('bod-secretary', { sessionId: session.sessionId });
  assert.strictEqual(cancelled.releasedReservations, 1, 'cancelled session releases reservation');
  assert.strictEqual(folderDoc(env).reservedFileCount, 0);

  env = await initializedEnv();
  session = await createSession(env, 'bod-secretary');
  env.clock.advance(31 * 60 * 1000);
  const cleanup = await env.service.cleanupExpiredUploadSessions('president-uid', { limit: 10 });
  assert.strictEqual(cleanup.expiredSessionCount, 1, 'expired cleanup finds session');
  assert.strictEqual(folderDoc(env).reservedFileCount, 0, 'expired session releases reservation');
  await rejectsWithCode(() => consumeTicket(env, session), 'failed-precondition', 'expired ticket/session rejected');

  env = await initializedEnv();
  session = await createSession(env, 'bod-secretary', { file: { fileName: '..\\folder\\Clean   Name.csv', mimeType: 'text/csv' } });
  assert.ok(session.files[0].fileName.includes('Clean Name.csv'), 'filename sanitized');

  const auditDocs = Object.values(env.adapter.store.visitSubmissionAudit || {});
  auditDocs.forEach(assertNoSecretFields);

  const rules = fs.readFileSync(path.join(repoRoot, 'firestore.rules'), 'utf8');
  assert.ok(/match \/visitSubmissionUploadSessions\/\{[^}]+\}\s*\{\s*allow read, write: if false;\s*\}/m.test(rules), 'session rules deny direct access');
  ['driveUploadTickets', 'driveUploadRateLimits', 'driveUploadGroups'].forEach((collection) => {
    assert.ok(new RegExp(`match\\s+/${collection}/\\{[^}]+\\}\\s*\\{\\s*allow\\s+read,\\s*write:\\s*if\\s+false;\\s*\\}`, 'm').test(rules));
  });

  const source = fs.readFileSync(path.join(repoRoot, 'functions', 'lib', 'visit-submissions.js'), 'utf8');
  const indexSource = fs.readFileSync(path.join(repoRoot, 'functions', 'index.js'), 'utf8');
  assert.ok(!/base64(File|Bytes|Data)|readAsBase64|fileBase64/i.test(source), 'no base64 callable upload implementation');
  assert.ok(!/firebase deploy/i.test(source), 'no deploy command introduced');
  assert.ok(!/listDocs\('visitSubmissions'\)/.test(source), 'no unbounded submission list query');
  assert.ok(indexSource.includes('exports.completeVisitSubmissionDriveUpload'), 'trusted completion endpoint exists');
  assert.ok(/completeVisitSubmissionDriveUpload[\s\S]*timingSafeSharedSecretMatches[\s\S]*completeDriveUpload/.test(indexSource), 'completion endpoint checks shared secret before completion');
  assert.ok(/uploadType !== VISIT_UPLOAD_TYPE/.test(indexSource), 'other upload purposes cannot use Visit completion');
  assert.ok(cleanSlate.RESET_COLLECTIONS.includes('visitSubmissionUploadSessions'), 'clean slate resets visit upload sessions');

  console.log('Visit Submission upload lifecycle verification passed.');
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
