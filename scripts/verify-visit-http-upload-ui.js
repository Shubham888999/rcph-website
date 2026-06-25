'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const runtimeConfig = read('js/runtime-config.js');
const uploadJs = read('js/visit-submission-upload.js');
const visitHtml = read('visit-submissions.html');

assert.ok(/RCPH_VISIT_UPLOAD_ENDPOINT/.test(runtimeConfig + uploadJs), 'frontend uses Firebase HTTP endpoint runtime config');
assert.ok(!/RCPH_VISIT_UPLOAD_WEB_APP_URL/.test(runtimeConfig + uploadJs), 'frontend no longer references Visit Apps Script URL');
assert.ok(/uploadVisitSubmissionFile/.test(uploadJs), 'Firebase upload endpoint name is referenced');
assert.ok(!/formData\.append\('action'/.test(uploadJs), 'frontend does not send Apps Script action');
assert.ok(!/formData\.append\('uploadType'/.test(uploadJs), 'frontend does not send uploadType as browser authority');
assert.ok(/FormData/.test(uploadJs), 'frontend posts multipart FormData');
assert.ok(/formData\.append\('file', file/.test(uploadJs), 'frontend sends file bytes via multipart file field');
assert.ok(!/readAsDataURL|base64/i.test(uploadJs), 'frontend does not use base64 upload');
assert.ok(!/driveFileId|driveFolderId|driveFileUrl/.test(uploadJs), 'frontend does not submit browser Drive authority');
assert.ok(/for \(const item of validQueue\)/.test(uploadJs), 'sequential queue preserved');
assert.ok(/completionProof/.test(uploadJs), 'completionProof finalization flow preserved');
assert.ok(/cancelUploadSession/.test(uploadJs), 'cancellation flow preserved');
assert.ok(/Visit Submission upload endpoint is not configured yet/.test(uploadJs), 'user-facing configuration message updated');
assert.strictEqual((uploadJs.match(/await response\.json\(\)/g) || []).length, 1, 'response JSON is parsed only once');
assert.ok(/json\?\.message\s*\|\|\s*`Upload failed with status/.test(uploadJs), 'frontend displays safe JSON error messages');
assert.ok(/if \(!json \|\| json\.ok === false/.test(uploadJs), 'completionProof success handling remains intact after one JSON parse');
assert.ok(
  runtimeConfig.includes(
    'https://us-central1-rcph-admin.cloudfunctions.net/uploadVisitSubmissionFile'
  ),
  'production Visit upload endpoint is configured'
);
assert.ok(visitHtml.includes('js/runtime-config.js'), 'runtime config still loads before upload module');
assert.ok(visitHtml.indexOf('js/runtime-config.js') < visitHtml.indexOf('js/visit-submission-upload.js'), 'runtime config loads before upload module');
assert.ok(!/DRIVE_UPLOAD_SHARED_SECRET|private_key|client_secret|service-account|OAuth token/i.test(runtimeConfig + uploadJs + visitHtml), 'frontend has no secrets');
assert.ok(
  !/apps-script|script\.google\.com\/macros/i.test(
    runtimeConfig + uploadJs + visitHtml
  ),
  'Visit frontend has no Apps Script dependency'
);
assert.ok(!/firebase deploy|functions:deploy|clasp deploy/i.test(runtimeConfig + uploadJs + visitHtml), 'no deploy command introduced');

console.log('Visit HTTP upload UI verification passed.');
