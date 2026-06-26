'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const frontendFiles = [
  'visit-submissions.html',
  'css/visit-submissions.css',
  'js/runtime-config.js',
  'js/visit-submission-api.js',
  'js/visit-submission-state.js',
  'js/visit-submission-render.js',
  'js/visit-submission-upload.js',
  'js/visit-submissions.js',
  'js/access.js',
  'admin.html',
];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const sources = Object.fromEntries(frontendFiles.map(file => [file, read(file)]));
const combinedVisitJs = [
  sources['js/visit-submission-api.js'],
  sources['js/visit-submission-state.js'],
  sources['js/visit-submission-render.js'],
  sources['js/visit-submission-upload.js'],
  sources['js/visit-submissions.js'],
].join('\n');

const requiredModules = [
  'js/visit-submission-api.js',
  'js/visit-submission-state.js',
  'js/runtime-config.js',
  'js/visit-submission-upload.js',
  'js/visit-submission-render.js',
  'js/visit-submissions.js',
];

requiredModules.forEach(modulePath => {
  assert(sources['visit-submissions.html'].includes(modulePath), `Page imports ${modulePath}`);
});

assert(!/collection\s*\(\s*['"`]visitSubmission/i.test(combinedVisitJs), 'No direct Visit Firestore collection reads.');
assert(!/firebase\.firestore\s*\(/.test(combinedVisitJs), 'Visit UI does not initialize Firestore.');

[
  'initializeVisitSubmissionStructure',
  'getVisitSubmissionDashboard',
  'getVisitSubmissionFolders',
  'getVisitSubmissionFolder',
  'updateVisitSubmissionConfig',
  'updateVisitSubmissionFolder',
  'createVisitSubmissionUploadSession',
  'finalizeVisitSubmissionUpload',
  'cancelVisitSubmissionUploadSession',
  'withdrawVisitSubmission',
  'removeVisitSubmission',
  'replaceVisitSubmission',
  'getVisitSubmissionModerationData',
  'reconcileVisitSubmissionFolderCount',
  'cleanupExpiredVisitUploadSessions',
].forEach(name => {
  assert(sources['js/visit-submission-api.js'].includes(name), `API wrapper references ${name}`);
});

assert((sources['js/visit-submission-state.js'].match(/visitType:/g) || []).length >= 3, 'Exactly three Visit card definitions are supported.');
assert(sources['js/visit-submission-state.js'].includes('clubAssembly'), 'Club Assembly supported.');
assert(sources['js/visit-submission-state.js'].includes('dzrVisit'), 'DZR Visit supported.');
assert(sources['js/visit-submission-state.js'].includes('drrVisit'), 'DRR Visit supported.');
assert(/access\.canManage|folder\.canManage/.test(combinedVisitJs), 'Manager controls use server canManage.');
assert(/folders\.map\(folder => renderFolderCard/.test(sources['js/visit-submission-render.js']), 'Folder list renders server response folders.');
assert(/maxFilesPerSelection/.test(combinedVisitJs) && /maxFileSizeBytes/.test(combinedVisitJs), 'Upload control uses server limits.');
assert(!/readAsDataURL|base64/i.test(combinedVisitJs), 'Upload descriptors and transport avoid base64.');
assert(/for \(const item of validQueue\)/.test(sources['js/visit-submission-upload.js']), 'Upload queue processes files sequentially.');
assert(/completionProof/.test(combinedVisitJs), 'Finalization uses trusted completion proof.');
assert(!/finalizeUpload\(\{[\s\S]{0,400}driveFileId/.test(combinedVisitJs), 'Browser does not submit Drive file IDs to finalization.');
assert(!/finalizeUpload\(\{[\s\S]{0,400}driveFolderId/.test(combinedVisitJs), 'Browser does not submit Drive folder IDs to finalization.');
assert(/Unsupported file/.test(combinedVisitJs), 'Unsupported file feedback exists.');
assert(/Replacement requires exactly one file/.test(combinedVisitJs), 'Replacement enforces one file in UI.');
assert(/cancelUploadSession/.test(combinedVisitJs), 'Cancellation callable is wired.');
assert(/needsReservationRelease/.test(sources['js/visit-submission-upload.js']), 'Partial failure cancellation wiring exists.');
assert(/cancelAttempted/.test(sources['js/visit-submission-upload.js']), 'Cancellation is guarded against repeated calls.');
assert(/activeSession\s*=\s*null/.test(sources['js/visit-submission-upload.js']), 'Active session is cleared after complete finalization or cancellation.');
assert(/withdrawSubmission/.test(combinedVisitJs), 'BOD withdrawal is wired.');
assert(/Enter a removal reason/.test(combinedVisitJs), 'Manager removal requires reason.');
assert(/nextCursor|Load more/.test(combinedVisitJs), 'Moderation uses cursor pagination.');
assert(/Initialize Visit Submission System/.test(combinedVisitJs), 'Initialization state is handled.');
assert(/Access denied|Folder access denied/.test(combinedVisitJs), 'Access-denied state exists.');
assert(/@media \(max-width: 680px\)/.test(sources['css/visit-submissions.css']), 'Mobile responsive styles exist.');
assert(/role="dialog"|Escape/.test(sources['visit-submissions.html'] + combinedVisitJs), 'Dialogs are keyboard-accessible.');
assert(/dialogReturnFocusEl/.test(sources['js/visit-submissions.js']), 'Dialog remembers and restores focus.');
assert(/trapDialogTab/.test(sources['js/visit-submissions.js']), 'Dialog traps Tab and Shift+Tab.');
assert(/aria-modal="true"/.test(sources['visit-submissions.html']), 'Dialog is labelled as modal.');
assert(/visitDialogTitle/.test(sources['visit-submissions.html']), 'Dialog title is labelled.');
assert(!/\bconfirm\s*\(/.test(combinedVisitJs), 'Visit UI does not use native confirm.');
assert(/data-dialog-cancel/.test(combinedVisitJs), 'Custom dialog includes cancel buttons.');
assert(/data-confirm-maintenance/.test(combinedVisitJs), 'Custom dialog includes confirm buttons for maintenance.');
assert(/aria-live/.test(sources['visit-submissions.html'] + sources['js/visit-submission-render.js']), 'Upload/status areas use aria-live.');
assert(/RCPH_VISIT_UPLOAD_ENDPOINT/.test(sources['js/runtime-config.js'] + combinedVisitJs), 'Safe Firebase upload endpoint runtime configuration exists.');
assert(/uploadVisitSubmissionFile/.test(sources['js/visit-submission-upload.js']), 'Expected Firebase HTTPS upload endpoint is wired.');
assert(!/RCPH_VISIT_UPLOAD_WEB_APP_URL/.test(sources['js/runtime-config.js'] + combinedVisitJs), 'Visit UI no longer depends on Apps Script URL config.');
assert(!/formData\.append\('action', 'uploadVisitSubmissionFile'\)/.test(sources['js/visit-submission-upload.js']), 'Visit UI no longer sends Apps Script upload action.');
assert(!/DRIVE_UPLOAD_SHARED_SECRET|private_key|service-account|OAuth token|client_secret/i.test(combinedVisitJs + sources['visit-submissions.html'] + sources['js/runtime-config.js']), 'No shared secret appears in frontend source.');
assert(!/firebase deploy|functions:deploy|deploy --/.test(combinedVisitJs), 'No deploy command introduced.');
assert(!/localStorage/.test(combinedVisitJs), 'No direct role authorization from localStorage.');
assert(sources['js/access.js'].includes('visit-submissions.html'), 'Access Hub links to Visit Submissions.');
assert(/roles:\s*\['bod', 'admin', 'president'\]/.test(sources['js/access.js']), 'Access Hub Visit card is limited to BOD/Admin/President.');
assert(!/visit-submissions[^\n]+roles:\s*\[[^\]]*(gbm|prospect)/i.test(sources['js/access.js']), 'Access Hub Visit card excludes GBM/prospect.');
assert(sources['admin.html'].includes('href="visit-submissions.html"'), 'Admin quick nav points to Visit Submissions.');
assert((sources['js/access.js'].match(/visit-submissions\.html/g) || []).length === 1, 'Access Hub has no duplicate Visit Submission card URL.');
assert((sources['admin.html'].match(/visit-submissions\.html/g) || []).length === 1, 'Admin nav has no duplicate Visit Submission URL.');
assert(!/href="visit-submissions\.html#[^"]+"/.test(sources['visit-submissions.html']), 'No unfinished hash links in Visit page.');
assert(/item\.canWithdraw === true/.test(sources['js/visit-submission-render.js']), 'Withdraw uses server canWithdraw flag.');
assert(/item\.canReplace === true/.test(sources['js/visit-submission-render.js']), 'Replace uses server canReplace flag.');
assert(/item\.canRemove === true/.test(sources['js/visit-submission-render.js']), 'Remove uses server canRemove flag.');
assert(!/item\.status === 'active' && !isManager/.test(sources['js/visit-submission-render.js']), 'No blanket non-manager Withdraw button.');
assert(!/<button[^>]+data-replace-submission/.test(sources['js/visit-submission-render.js'].replace(/\$\{item\.canReplace === true \? `[^`]+` : ''\}/g, '')), 'No unconditional Replace button.');

console.log('Visit Submission UI verification passed.');
