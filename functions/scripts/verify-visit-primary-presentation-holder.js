'use strict';

// v2.17.0: BOD folder holders may set/clear the main presentation of their own folders.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const positionHelpers = require('../lib/positions');
const visit = require('../lib/visit-submissions');

const fixturePath = path.join(__dirname, 'fixtures', 'visit-submission-foundation-sample.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const indexSource = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8').replace(/\r\n/g, '\n');

function callableSource(name) {
  const start = indexSource.indexOf(`exports.${name} = onCall`);
  assert.notStrictEqual(start, -1, `${name} callable exists`);
  const next = indexSource.indexOf('\nexports.', start + 1);
  return indexSource.slice(start, next === -1 ? indexSource.length : next);
}

async function rejectsWithCode(promiseFactory, code, label, message) {
  let rejected = false;
  try {
    await promiseFactory();
  } catch (err) {
    rejected = true;
    assert.strictEqual(err?.httpsCode || err?.code, code, `${label}: error code`);
    if (message) assert.strictEqual(err.message, message, `${label}: error message`);
  }
  assert.ok(rejected, label || `Expected rejection with ${code}`);
}

async function initializedEnv() {
  const adapter = visit.createMemoryVisitSubmissionAdapter(JSON.parse(JSON.stringify(fixture)));
  const service = visit.createVisitSubmissionService({ adapter, positionHelpers });
  await service.initializeStructure('president-uid');
  const submissions = adapter.store.visitSubmissions;
  submissions['secretary-pptx'] = {
    ...submissions['secretary-file'],
    submissionId: 'secretary-pptx',
    fileName: 'club-assembly.pptx',
    originalFileName: 'club-assembly.pptx',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    driveFileId: 'driveFileSecretaryPPTX',
    driveFileUrl: 'https://drive.google.com/file/d/driveFileSecretaryPPTX/view',
  };
  submissions['editor-pdf'] = {
    ...submissions['editor-file'],
    submissionId: 'editor-pdf',
    driveFileId: 'driveFileEditorPDF',
    driveFileUrl: 'https://drive.google.com/file/d/driveFileEditorPDF/view',
  };
  submissions['drr-secretary-pdf'] = {
    ...submissions['secretary-file'],
    submissionId: 'drr-secretary-pdf',
    visitType: 'drrVisit',
  };
  return { adapter, service };
}

const folderDoc = (env, id = 'clubAssembly_secretary') => env.adapter.store.visitSubmissionPositions[id];
const setMain = (env, uid, submissionId, overrides = {}) => env.service.setPrimaryPresentation(uid, {
  visitType: 'clubAssembly',
  positionKey: 'secretary',
  submissionId,
  ...overrides,
});

(async () => {
  // Callable: v2 signature, exported, only forwards the three allowed fields.
  const callable = callableSource('setVisitSubmissionPrimaryPresentation');
  assert.match(callable, /= onCall\(CALLABLE_OPTIONS, async \(request\) => \{\n  const data = request\?\.data \|\| \{\};/, 'v2 request signature');
  assert.doesNotMatch(callable, /async \(data\b/, 'not v1 (data, context)');
  assert.doesNotMatch(callable, /context\.auth/, 'does not read context.auth');
  assert.match(callable, /requireAuth\(request\)/);
  assert.match(callable, /visitSubmissions\.setPrimaryPresentation\(uid, \{\n\s+visitType: data\.visitType,\n\s+positionKey: data\.positionKey,\n\s+submissionId: data\.submissionId,\n\s+\}\)/, 'forwards only visitType/positionKey/submissionId');
  const folderCallable = callableSource('updateVisitSubmissionFolder');
  assert.match(folderCallable, /visitSubmissions\.updateFolder\(uid, request\.data \|\| \{\}\)/, 'updateVisitSubmissionFolder unchanged');

  // Holder of own folder: set, change, clear.
  let env = await initializedEnv();
  const before = { ...folderDoc(env) };
  const set = await setMain(env, 'bod-secretary', 'secretary-file');
  assert.strictEqual(set.ok, true);
  assert.strictEqual(set.changed, true);
  assert.strictEqual(folderDoc(env).primaryPresentationSubmissionId, 'secretary-file', 'holder can set own main presentation');
  assert.strictEqual(folderDoc(env).updatedBy, 'bod-secretary');
  const after = folderDoc(env);
  const changedKeys = Object.keys({ ...before, ...after })
    .filter(key => JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null))
    .sort();
  // updatedAt is a constant sentinel in the memory adapter, so it may not show up as changed.
  assert.ok(changedKeys.includes('primaryPresentationSubmissionId'));
  assert.ok(
    changedKeys.every(key => ['primaryPresentationSubmissionId', 'updatedAt', 'updatedBy'].includes(key)),
    `only main presentation fields change (changed: ${changedKeys.join(', ')})`
  );

  const audit = Object.values(env.adapter.store.visitSubmissionAudit || {})
    .filter(entry => entry.action === 'visitPrimaryPresentationUpdated');
  assert.strictEqual(audit.length, 1, 'audit entry written');
  assert.strictEqual(audit[0].actorUid, 'bod-secretary');
  assert.strictEqual(audit[0].positionKey, 'secretary');
  assert.deepStrictEqual(audit[0].details.changes.primaryPresentationSubmissionId, { oldValue: '', newValue: 'secretary-file' });

  await setMain(env, 'bod-secretary', 'secretary-pptx');
  assert.strictEqual(folderDoc(env).primaryPresentationSubmissionId, 'secretary-pptx', 'holder can change main presentation');
  const cleared = await setMain(env, 'bod-secretary', '');
  assert.strictEqual(cleared.primaryPresentationSubmissionId, '');
  assert.strictEqual(folderDoc(env).primaryPresentationSubmissionId, '', 'holder can clear main presentation');
  const noop = await setMain(env, 'bod-secretary', '');
  assert.strictEqual(noop.changed, false, 'clearing an empty selection is a no-op');

  // Extra fields in the input are ignored.
  await setMain(env, 'bod-secretary', 'secretary-file', { locked: true, maxActiveFiles: 1, enabled: false });
  assert.strictEqual(folderDoc(env).locked, false, 'locked is not writable here');
  assert.strictEqual(folderDoc(env).enabled, true, 'enabled is not writable here');
  assert.strictEqual(folderDoc(env).maxActiveFiles, before.maxActiveFiles, 'limits are not writable here');

  // Missing submissionId is rejected rather than treated as a clear.
  await rejectsWithCode(
    () => env.service.setPrimaryPresentation('bod-secretary', { visitType: 'clubAssembly', positionKey: 'secretary' }),
    'invalid-argument',
    'submissionId is required'
  );

  // Holder of another folder, non-BOD users.
  env = await initializedEnv();
  await rejectsWithCode(
    () => env.service.setPrimaryPresentation('bod-secretary', { visitType: 'clubAssembly', positionKey: 'editor', submissionId: 'editor-pdf' }),
    'permission-denied',
    'holder of another folder denied'
  );
  for (const uid of ['gbm-uid', 'prospect-uid']) {
    await rejectsWithCode(() => setMain(env, uid, 'secretary-file'), 'permission-denied', `${uid} denied`);
  }
  assert.strictEqual(folderDoc(env).primaryPresentationSubmissionId, '', 'denied calls change nothing');

  // Submission validation: other folder, other visit, ineligible, missing.
  await rejectsWithCode(() => setMain(env, 'bod-secretary', 'editor-pdf'), 'invalid-argument', 'file from another folder rejected', 'Main presentation must belong to this folder.');
  await rejectsWithCode(() => setMain(env, 'bod-secretary', 'drr-secretary-pdf'), 'invalid-argument', 'file from another visit rejected', 'Main presentation must belong to this visit.');
  await rejectsWithCode(() => setMain(env, 'bod-secretary', 'missing-file'), 'invalid-argument', 'unknown file rejected');
  env.adapter.store.visitSubmissions['secretary-image'] = {
    ...env.adapter.store.visitSubmissions['secretary-file'],
    submissionId: 'secretary-image',
    fileName: 'photo.png',
    originalFileName: 'photo.png',
    mimeType: 'image/png',
  };
  await rejectsWithCode(() => setMain(env, 'bod-secretary', 'secretary-image'), 'invalid-argument', 'ineligible file rejected');
  env.adapter.store.visitSubmissions['secretary-archived'] = {
    ...env.adapter.store.visitSubmissions['secretary-file'],
    submissionId: 'secretary-archived',
    status: 'archived',
  };
  await rejectsWithCode(() => setMain(env, 'bod-secretary', 'secretary-archived'), 'invalid-argument', 'inactive file rejected');
  assert.strictEqual(folderDoc(env).primaryPresentationSubmissionId, '');

  // Manager allowed.
  await setMain(env, 'admin-uid', 'secretary-file');
  assert.strictEqual(folderDoc(env).primaryPresentationSubmissionId, 'secretary-file', 'manager allowed');
  await setMain(env, 'president-uid', '');
  assert.strictEqual(folderDoc(env).primaryPresentationSubmissionId, '', 'president can clear');

  // Same lock rule as uploads: holder denied, manager allowed.
  const lockCases = [
    ['folder locked', e => { folderDoc(e).locked = true; }, 'This position folder is locked.'],
    ['folder closed', e => { folderDoc(e).submissionOpen = false; }, 'This position folder is closed.'],
    ['folder disabled', e => { folderDoc(e).enabled = false; }, 'This position folder is disabled.'],
    ['visit closed', e => { e.adapter.store.visitSubmissionConfig.clubAssembly.submissionOpen = false; }, 'Visit submissions are closed.'],
    ['visit disabled', e => { e.adapter.store.visitSubmissionConfig.clubAssembly.enabled = false; }, 'Visit submissions are disabled.'],
  ];
  for (const [label, apply, message] of lockCases) {
    const lockedEnv = await initializedEnv();
    apply(lockedEnv);
    await rejectsWithCode(() => setMain(lockedEnv, 'bod-secretary', 'secretary-file'), 'failed-precondition', `${label}: holder denied`, message);
    await rejectsWithCode(
      () => lockedEnv.service.createUploadSession('bod-secretary', {
        visitType: 'clubAssembly',
        positionKey: 'secretary',
        files: [{ clientFileId: 'lock-probe', fileName: 'probe.pdf', mimeType: 'application/pdf', sizeBytes: 2048 }],
      }),
      'failed-precondition',
      `${label}: uploads use the same rule`,
      message
    );
    assert.strictEqual(folderDoc(lockedEnv).primaryPresentationSubmissionId, '');
    const holderView = await lockedEnv.service.getFolder('bod-secretary', 'clubAssembly', 'secretary');
    assert.strictEqual(holderView.folder.canSetPrimaryPresentation, false, `${label}: holder folder flag off`);
    assert.ok(holderView.submissions.every(item => item.canSetPrimaryPresentation === false), `${label}: holder file flags off`);
    await setMain(lockedEnv, 'admin-uid', 'secretary-file');
    assert.strictEqual(folderDoc(lockedEnv).primaryPresentationSubmissionId, 'secretary-file', `${label}: manager allowed`);
    const managerView = await lockedEnv.service.getFolder('admin-uid', 'clubAssembly', 'secretary');
    assert.strictEqual(managerView.folder.canSetPrimaryPresentation, true, `${label}: manager folder flag on`);
  }

  // Folder detail flags for an open folder.
  env = await initializedEnv();
  const holderFolder = await env.service.getFolder('bod-secretary', 'clubAssembly', 'secretary');
  assert.strictEqual(holderFolder.access.canManage, false);
  assert.strictEqual(holderFolder.folder.canManage, false);
  assert.strictEqual(holderFolder.folder.canSetPrimaryPresentation, true, 'holder folder flag on');
  const byId = id => holderFolder.submissions.find(item => item.submissionId === id);
  assert.strictEqual(byId('secretary-file').canSetPrimaryPresentation, true, 'eligible PDF selectable by holder');
  assert.strictEqual(byId('secretary-pptx').canSetPrimaryPresentation, true, 'eligible PPTX selectable by holder');
  const holderFolders = await env.service.getFolders('bod-secretary', 'clubAssembly');
  assert.deepStrictEqual(
    holderFolders.folders.map(folder => [folder.positionKey, folder.canSetPrimaryPresentation]),
    [['secretary', true]],
    'folder list exposes the flag'
  );
  const managerFolder = await env.service.getFolder('admin-uid', 'clubAssembly', 'editor');
  assert.strictEqual(managerFolder.folder.canSetPrimaryPresentation, true);
  assert.strictEqual(
    managerFolder.submissions.find(item => item.submissionId === 'editor-pdf').canSetPrimaryPresentation,
    true,
    'manager flags unchanged'
  );

  // Pure helpers.
  assert.strictEqual(visit.visitFolderAllowsUpload({}, {}), true);
  assert.strictEqual(visit.visitFolderAllowsUpload({}, { locked: true }), false);
  assert.strictEqual(visit.canSetFolderPrimaryPresentation({ canManageVisitSystem: true }, 'secretary', false), true);
  assert.strictEqual(visit.canSetFolderPrimaryPresentation({ role: 'bod', folderPositionKeys: ['secretary'] }, 'secretary', true), true);
  assert.strictEqual(visit.canSetFolderPrimaryPresentation({ role: 'bod', folderPositionKeys: ['secretary'] }, 'secretary', false), false);
  assert.strictEqual(visit.canSetFolderPrimaryPresentation({ role: 'bod', folderPositionKeys: ['editor'] }, 'secretary', true), false);
  assert.strictEqual(visit.canSetFolderPrimaryPresentation({ role: 'gbm', folderPositionKeys: ['secretary'] }, 'secretary', true), false);
  const shapedForStranger = visit.shapeSubmission(
    env.adapter.store.visitSubmissions['secretary-file'],
    { uid: 'x', role: 'bod', folderPositionKeys: ['editor'] },
    { folderWritable: true }
  );
  assert.strictEqual(shapedForStranger.canSetPrimaryPresentation, false, 'non-holder never gets the file flag');

  // updateVisitSubmissionFolder stays manager-only, including for the main presentation.
  await rejectsWithCode(
    () => env.service.updateFolder('bod-secretary', { visitType: 'clubAssembly', positionKey: 'secretary', primaryPresentationSubmissionId: 'secretary-file' }),
    'permission-denied',
    'holder cannot use updateFolder'
  );
  await rejectsWithCode(
    () => env.service.updateFolder('bod-secretary', { visitType: 'clubAssembly', positionKey: 'secretary', locked: true }),
    'permission-denied',
    'holder cannot lock via updateFolder'
  );
  const managerUpdate = await env.service.updateFolder('admin-uid', { visitType: 'clubAssembly', positionKey: 'secretary', primaryPresentationSubmissionId: 'secretary-file' });
  assert.ok(managerUpdate.changedFields.includes('primaryPresentationSubmissionId'), 'manager updateFolder unchanged');

  console.log('verify-visit-primary-presentation-holder: all checks passed.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
