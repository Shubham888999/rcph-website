'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const {
  VISIT_HTTP_UPLOAD_MAX_BYTES,
  createHttpUploadError,
  createGoogleDriveClient,
  createVisitHttpUploadHandler,
  getVisitDriveConfig,
  getRootFolderIdForVisit,
} = require('../lib/visit-drive');

const root = path.resolve(__dirname, '..', '..');

function serviceError(code, message) {
  const err = new Error(message);
  err.code = code;
  err.httpsCode = code;
  return err;
}

function multipartRequest({ fields = {}, file = null, files = [], origin = 'http://localhost:5500', method = 'POST', contentType = null }) {
  const boundary = `----rcph-test-${Math.random().toString(16).slice(2)}`;
  const chunks = [];
  Object.entries(fields).forEach(([name, value]) => {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`, 'utf8'));
  });
  const allFiles = file ? [file].concat(files || []) : (files || []);
  allFiles.forEach((item, index) => {
    const fieldName = item.fieldName || 'file';
    const fileName = item.fileName || `upload-${index}.bin`;
    const mimeType = item.mimeType || 'application/octet-stream';
    const buffer = Buffer.isBuffer(item.buffer) ? item.buffer : Buffer.from(item.buffer || '');
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`, 'utf8'));
    chunks.push(buffer);
    chunks.push(Buffer.from('\r\n', 'utf8'));
  });
  chunks.push(Buffer.from(`--${boundary}--\r\n`, 'utf8'));
  const rawBody = Buffer.concat(chunks);
  const headers = {
    origin,
    'content-type': contentType || `multipart/form-data; boundary=${boundary}`,
    'content-length': String(rawBody.length),
  };
  return {
    method,
    headers,
    rawBody,
    get(name) {
      return headers[String(name).toLowerCase()] || '';
    },
  };
}

function makeResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    status(code) {
      this.statusCode = code;
      return this;
    },
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
    json() {
      return this.body ? JSON.parse(this.body) : null;
    },
  };
}

function baseFields(overrides = {}) {
  const has = (key) => Object.prototype.hasOwnProperty.call(overrides, key);
  return {
    ticket: has('ticket') ? overrides.ticket : 'a'.repeat(64),
    sessionId: has('sessionId') ? overrides.sessionId : 'session-one',
    clientFileId: has('clientFileId') ? overrides.clientFileId : 'file-one',
    fileName: has('fileName') ? overrides.fileName : 'clubAssembly_secretary_file-one_report.pdf',
    mimeType: has('mimeType') ? overrides.mimeType : 'application/pdf',
    sizeBytes: String(has('sizeBytes') ? overrides.sizeBytes : 11),
    ...overrides.extraFields,
  };
}

function pdfBuffer() {
  return Buffer.from('%PDF-1.4\nok', 'utf8');
}

function makeFile(overrides = {}) {
  const buffer = overrides.buffer || pdfBuffer();
  return {
    fieldName: overrides.fieldName || 'file',
    fileName: overrides.fileName || 'report.pdf',
    mimeType: overrides.mimeType || 'application/pdf',
    buffer,
  };
}

class FakeVisitService {
  constructor(options = {}) {
    this.options = options;
    this.order = options.order || [];
    this.consumed = new Set();
    this.completions = [];
  }

  async validateVisitUploadTicketWithProof(input) {
    this.order.push('validate');
    if (this.options.validateFailure) throw this.options.validateFailure;
    if (/\.exe$/i.test(input.fileName)) throw serviceError('invalid-argument', 'Unsupported file extension.');
    if (this.consumed.has(input.ticket)) throw serviceError('already-exists', 'Upload ticket already used.');
    this.consumed.add(input.ticket);
    return {
      ok: true,
      uploadType: 'visitSubmission',
      safeFileName: input.fileName,
      originalFileName: 'report.pdf',
visitType: this.options.visitType || 'clubAssembly',
visitDisplayTitle:
  this.options.visitDisplayTitle ||
  (this.options.visitType === 'dzrVisit'
    ? 'DZR Visit'
    : this.options.visitType === 'drrVisit'
      ? 'DRR Visit'
      : 'Club Assembly'),
      positionKey: 'secretary',
      positionTitle: this.options.positionTitle || 'Secretary',
      avenueCode: 'SEC',
      sessionId: input.sessionId,
      clientFileId: input.clientFileId,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      uploaderUid: 'uid-one',
      uploadProof: 'trusted-upload-proof',
    };
  }

  async completeDriveUpload(input) {
    this.order.push('complete');
    if (this.options.completeFailure) throw this.options.completeFailure;
    this.completions.push(input);
    return {
      ok: true,
      completionProof: `completion-${input.clientFileId}`,
    };
  }
}

class FakeDriveService {
  constructor(options = {}) {
    this.options = options;
    this.order = options.order || [];
    this.uploads = [];
    this.paths = new Map();
    this.rootFolderIds = options.rootFolderIds || {
  clubAssembly: 'club-assembly-root',
  dzrVisit: 'dzr-root',
  drrVisit: 'drr-root',
};
  }

  async ensureVisitFolderHierarchy(validation) {
    this.order.push('folder');
    if (this.options.folderFailure) throw this.options.folderFailure;
    if (this.options.duplicateFolder) {
      throw createHttpUploadError(500, 'Duplicate Drive folders found for the canonical upload path.');
    }
const rootFolderId = this.rootFolderIds[validation.visitType];

if (!rootFolderId) {
  throw createHttpUploadError(
    500,
    'Visit upload storage is not configured.'
  );
}

const pathKey = [
  rootFolderId,
  validation.visitDisplayTitle,
  validation.positionTitle,
].join('/');    if (!this.paths.has(pathKey)) this.paths.set(pathKey, `folder-${this.paths.size + 1}`);
return {
  rootFolderId,
  visitType: validation.visitType,
  positionFolderId: this.paths.get(pathKey),
  positionFolderName: validation.positionTitle,
};
  }

  async uploadFile(payload) {
    this.order.push('upload');
    if (this.options.uploadFailure) throw this.options.uploadFailure;
    this.uploads.push(payload);
    return {
      driveFileId: `drive-file-${this.uploads.length}`,
      driveFileUrl: `https://drive.google.com/file/d/drive-file-${this.uploads.length}/view`,
      fileName: payload.fileName,
    };
  }
}

class FakeFolderLockManager {
  constructor(options = {}) {
    this.options = options;
    this.order = options.order || [];
    this.active = false;
    this.acquired = 0;
    this.released = 0;
    this.releaseFailures = 0;
  }

  async acquireLock() {
    this.order.push('lock');
    if (this.options.acquireFailure) throw this.options.acquireFailure;
    if (this.active && !this.options.allowTakeover) {
      throw createHttpUploadError(409, 'Visit upload folder is being prepared. Please try again.');
    }
    this.active = true;
    this.acquired += 1;
    const ownerToken = `owner-${this.acquired}`;
    return {
      lockId: 'fixture-lock',
      ownerToken,
      release: async () => {
        this.order.push('release');
        if (this.options.releaseFailure) {
          this.releaseFailures += 1;
          throw this.options.releaseFailure;
        }
        if (ownerToken === `owner-${this.acquired}`) {
          this.active = false;
          this.released += 1;
        }
      },
    };
  }
}

function fixtureDriveConfig(overrides = {}) {
  return {
    authMode: 'shared-drive',
    rootFolderIds: {
      clubAssembly: 'club-assembly-root',
      dzrVisit: 'dzr-root',
      drrVisit: 'drr-root',
    },
    ...overrides,
  };
}

async function runHandler({
  fields = baseFields(),
  file = makeFile(),
  files,
  origin,
  method,
  contentType,
  visitService,
  driveService,
  folderLockManager,
  getDriveConfig,
  logger,
} = {}) {
  const order = [];
  const service = visitService || new FakeVisitService({ order });
  const drive = driveService || new FakeDriveService({ order });
  const handler = createVisitHttpUploadHandler({
    visitService: service,
    driveService: drive,
    folderLockManager: folderLockManager || { acquireLock: async () => ({ release: async () => {} }) },
    getDriveConfig: getDriveConfig || (() => fixtureDriveConfig()),
    allowedOrigins: ['http://localhost:5500'],
    logger: logger || { warn() {} },
  });
  const req = multipartRequest({ fields, file, files, origin: origin || 'http://localhost:5500', method: method || 'POST', contentType });
  const res = makeResponse();
  await handler(req, res);
  return { res, json: res.json(), service, drive, order };
}

async function main() {
  let result = await runHandler();
  assert.strictEqual(result.res.statusCode, 200, 'POST multipart succeeds');
  assert.strictEqual(result.json.ok, true);
  assert.ok(result.json.completionProof, 'completionProof returned');
  assert.ok(result.json.fileUrl, 'file URL returned');
  assert.strictEqual(result.json.driveFileId, undefined, 'Drive file ID hidden from browser response');
  assert.strictEqual(result.json.driveFolderId, undefined, 'Drive folder ID hidden from browser response');

  const optionsReq = multipartRequest({ fields: {}, file: null, method: 'OPTIONS' });
  const optionsRes = makeResponse();
  await createVisitHttpUploadHandler({
    visitService: new FakeVisitService(),
    driveService: new FakeDriveService(),
    allowedOrigins: ['http://localhost:5500'],
    logger: { warn() {} },
  })(optionsReq, optionsRes);
  assert.strictEqual(optionsRes.statusCode, 204, 'OPTIONS preflight succeeds for allowed origin');
  assert.strictEqual(optionsRes.headers['Access-Control-Allow-Origin'], 'http://localhost:5500');

  result = await runHandler({ origin: 'https://evil.example' });
  assert.strictEqual(result.res.statusCode, 403, 'disallowed origin rejected');
  result = await runHandler({ method: 'GET' });
  assert.strictEqual(result.res.statusCode, 405, 'non-POST rejected');
  result = await runHandler({ contentType: 'application/json' });
  assert.strictEqual(result.res.statusCode, 400, 'non-multipart rejected');
  result = await runHandler({ file: null });
  assert.strictEqual(result.res.statusCode, 400, 'missing file rejected');
  result = await runHandler({ files: [makeFile({ fileName: 'extra.pdf', buffer: Buffer.from('x') })] });
  assert.strictEqual(result.res.statusCode, 400, 'multiple files rejected');
  result = await runHandler({ fields: baseFields({ ticket: '' }) });
  assert.strictEqual(result.res.statusCode, 400, 'missing ticket rejected');
  result = await runHandler({ fields: baseFields({ ticket: 'bad-ticket' }) });
  assert.strictEqual(result.res.statusCode, 400, 'malformed ticket rejected');
  result = await runHandler({ fields: { ticket: 'a'.repeat(64) } });
  assert.strictEqual(result.res.statusCode, 400, 'missing metadata rejected');
  result = await runHandler({
    fields: baseFields({ sizeBytes: VISIT_HTTP_UPLOAD_MAX_BYTES + 1 }),
    file: makeFile({ buffer: Buffer.alloc(1) }),
  });
  assert.strictEqual(result.res.statusCode, 413, 'file over 25 MB rejected before upload');
  result = await runHandler({ fields: baseFields({ sizeBytes: 99 }) });
  assert.strictEqual(result.res.statusCode, 400, 'exact byte size enforced');
  result = await runHandler({ file: makeFile({ mimeType: 'image/png' }) });
  assert.strictEqual(result.res.statusCode, 400, 'MIME mismatch rejected');
  result = await runHandler({ fields: baseFields({ fileName: 'evil.exe' }) });
  assert.strictEqual(result.res.statusCode, 400, 'dangerous extension rejected by ticket layer');
  result = await runHandler({ fields: baseFields({ extraFields: { driveFolderId: 'browser-folder' } }) });
  assert.strictEqual(result.res.statusCode, 400, 'browser folder ID rejected');
  result = await runHandler({ fields: baseFields({ extraFields: { visitType: 'clubAssembly' } }) });
  assert.strictEqual(result.res.statusCode, 400, 'browser visitType rejected');

  const serviceBeforeConfig = new FakeVisitService();
  result = await runHandler({
    visitService: serviceBeforeConfig,
    getDriveConfig: () => getVisitDriveConfig({
      VISIT_DRIVE_AUTH_MODE: 'shared-drive',
      CURRENT_RIY_LABEL: 'RIY 2026-27',
    }),
  });
  assert.strictEqual(result.res.statusCode, 500, 'missing root folder fails safely');
  assert.strictEqual(serviceBeforeConfig.consumed.size, 0, 'missing root folder fails before ticket consumption');
  const mappedConfig = getVisitDriveConfig({
  VISIT_DRIVE_AUTH_MODE: 'shared-drive',
  VISIT_CLUB_ASSEMBLY_FOLDER_ID: 'shared-club-dzr-root',
  VISIT_DZR_FOLDER_ID: 'shared-club-dzr-root',
  VISIT_DRR_FOLDER_ID: 'drr-root',
});

assert.strictEqual(
  getRootFolderIdForVisit(mappedConfig, 'clubAssembly'),
  'shared-club-dzr-root'
);

assert.strictEqual(
  getRootFolderIdForVisit(mappedConfig, 'dzrVisit'),
  'shared-club-dzr-root'
);

assert.strictEqual(
  getRootFolderIdForVisit(mappedConfig, 'drrVisit'),
  'drr-root'
);
const sharedRootDrive = new FakeDriveService({
  rootFolderIds: {
    clubAssembly: 'shared-root',
    dzrVisit: 'shared-root',
    drrVisit: 'drr-root',
  },
});

await runHandler({
  driveService: sharedRootDrive,
  fields: baseFields({
    ticket: 'b'.repeat(64),
    clientFileId: 'club-file',
  }),
});

await runHandler({
  driveService: sharedRootDrive,
visitService: new FakeVisitService({
  visitType: 'dzrVisit',
  visitDisplayTitle: 'DZR Visit',
}),
  fields: baseFields({
    ticket: 'c'.repeat(64),
    clientFileId: 'dzr-file',
  }),
});

const createdPaths = Array.from(sharedRootDrive.paths.keys());

assert.ok(
  createdPaths.some(path =>
    path.includes('shared-root/Club Assembly/Secretary')
  ),
  'Club Assembly uses its own visit subfolder'
);

assert.ok(
  createdPaths.some(path =>
    path.includes('shared-root/DZR Visit/Secretary')
  ),
  'DZR Visit uses its own visit subfolder'
);
const serviceBeforeDrrConfig = new FakeVisitService();

result = await runHandler({
  visitService: serviceBeforeDrrConfig,
  getDriveConfig: () => getVisitDriveConfig({
    VISIT_DRIVE_AUTH_MODE: 'shared-drive',
    VISIT_CLUB_ASSEMBLY_FOLDER_ID: 'club-root',
    VISIT_DZR_FOLDER_ID: 'dzr-root',
  }),
});

assert.strictEqual(
  result.res.statusCode,
  500,
  'missing DRR root fails safely'
);

assert.strictEqual(
  serviceBeforeDrrConfig.consumed.size,
  0,
  'missing DRR root fails before ticket consumption'
);
assert.throws(
  () => getVisitDriveConfig({
    VISIT_DRIVE_AUTH_MODE: 'unknown',
    VISIT_CLUB_ASSEMBLY_FOLDER_ID: 'club-root',
    VISIT_DZR_FOLDER_ID: 'dzr-root',
    VISIT_DRR_FOLDER_ID: 'drr-root',
  }),
  /Visit upload storage is not configured/,
  'unknown auth mode fails safely'
);
  const googleCalls = [];
  const fakeGoogleApi = {
    auth: {
      GoogleAuth: class {
        constructor(input) {
          googleCalls.push(['GoogleAuth', input]);
        }
      },
      OAuth2: class {
        constructor(clientId, clientSecret) {
          googleCalls.push(['OAuth2', clientId, clientSecret]);
        }
        setCredentials(credentials) {
          googleCalls.push(['setCredentials', credentials]);
        }
      },
    },
    drive(input) {
      googleCalls.push(['drive', input.version, !!input.auth]);
      return { files: {} };
    },
  };
  createGoogleDriveClient({
    googleApi: fakeGoogleApi,
    config: fixtureDriveConfig({ authMode: 'shared-drive' }),
  });
  assert.strictEqual(googleCalls[0][0], 'GoogleAuth', 'shared-drive mode creates ADC GoogleAuth client');
  googleCalls.length = 0;
  createGoogleDriveClient({
    googleApi: fakeGoogleApi,
    config: fixtureDriveConfig({ authMode: 'oauth' }),
    env: {
      VISIT_DRIVE_CLIENT_ID: 'client-id',
      VISIT_DRIVE_CLIENT_SECRET: 'client-secret',
      VISIT_DRIVE_REFRESH_TOKEN: 'refresh-token',
    },
  });
  assert.deepStrictEqual(googleCalls[0], ['OAuth2', 'client-id', 'client-secret'], 'oauth mode creates OAuth2 client');
  assert.deepStrictEqual(googleCalls[1], ['setCredentials', { refresh_token: 'refresh-token' }], 'oauth mode sets refresh token');

  result = await runHandler();
  assert.deepStrictEqual(result.order, ['validate', 'folder', 'upload', 'complete'], 'validation occurs before folder creation/upload and upload before completion');
  result = await runHandler({ visitService: result.service, fields: baseFields() });
  assert.strictEqual(result.res.statusCode, 409, 'consumed ticket cannot be reused');

  result = await runHandler({
    visitService: new FakeVisitService({ order: [], visitDisplayTitle: 'DZR Visit', positionTitle: 'Treasurer' }),
  });
  assert.ok([...result.drive.paths.keys()][0].includes('DZR Visit/Treasurer'), 'canonical folder names come from backend validation');
const configuredRoots = getVisitDriveConfig({
  VISIT_DRIVE_AUTH_MODE: 'shared-drive',
  VISIT_CLUB_ASSEMBLY_FOLDER_ID: 'shared-root',
  VISIT_DZR_FOLDER_ID: 'shared-root',
  VISIT_DRR_FOLDER_ID: 'drr-root',
});

assert.deepStrictEqual(
  configuredRoots.rootFolderIds,
  {
    clubAssembly: 'shared-root',
    dzrVisit: 'shared-root',
    drrVisit: 'drr-root',
  },
  'visit-specific root folders come from backend configuration'
);
  const reusableDrive = new FakeDriveService();
  await runHandler({ driveService: reusableDrive, fields: baseFields({ ticket: 'b'.repeat(64), clientFileId: 'file-two', sizeBytes: 11 }) });
  await runHandler({ driveService: reusableDrive, fields: baseFields({ ticket: 'c'.repeat(64), clientFileId: 'file-three', sizeBytes: 11 }) });
  assert.strictEqual(reusableDrive.paths.size, 1, 'folder lookup is idempotent');
  const lockManager = new FakeFolderLockManager();
  result = await runHandler({ folderLockManager: lockManager });
  assert.strictEqual(result.res.statusCode, 200, 'first request acquires folder lock');
  assert.strictEqual(lockManager.acquired, 1, 'lock acquire recorded');
  assert.strictEqual(lockManager.released, 1, 'lock releases after successful upload');
  lockManager.active = true;
  result = await runHandler({ folderLockManager: lockManager, fields: baseFields({ ticket: '2'.repeat(64), clientFileId: 'locked-file' }) });
  assert.strictEqual(result.res.statusCode, 409, 'second concurrent request cannot independently create folders');
  assert.strictEqual(lockManager.released, 1, 'blocked request did not release another request lock');
  const takeoverLock = new FakeFolderLockManager({ allowTakeover: true });
  takeoverLock.active = true;
  result = await runHandler({ folderLockManager: takeoverLock, fields: baseFields({ ticket: '3'.repeat(64), clientFileId: 'takeover-file' }) });
  assert.strictEqual(result.res.statusCode, 200, 'expired lock can be taken over');
  assert.strictEqual(takeoverLock.released, 1, 'taken-over lock releases after upload');
  const driveFailureLock = new FakeFolderLockManager();
  result = await runHandler({
    folderLockManager: driveFailureLock,
    driveService: new FakeDriveService({ uploadFailure: createHttpUploadError(500, 'Drive upload failed.') }),
    fields: baseFields({ ticket: '4'.repeat(64), clientFileId: 'drive-fails' }),
  });
  assert.strictEqual(result.res.statusCode, 500, 'Drive failure returns safe error');
  assert.strictEqual(driveFailureLock.released, 1, 'lock releases after Drive failure');
  const completionFailureLock = new FakeFolderLockManager();
  await runHandler({
    folderLockManager: completionFailureLock,
    visitService: new FakeVisitService({ completeFailure: serviceError('internal', 'completion failed') }),
    fields: baseFields({ ticket: '5'.repeat(64), clientFileId: 'completion-fails' }),
  });
  assert.strictEqual(completionFailureLock.released, 1, 'lock releases after completion failure');
  result = await runHandler({ driveService: new FakeDriveService({ duplicateFolder: true }) });
  assert.strictEqual(result.res.statusCode, 500, 'duplicate folders fail safely');

  const rawBytes = Buffer.from([0, 1, 2, 3, 254, 255]);
  result = await runHandler({
    fields: baseFields({ ticket: 'd'.repeat(64), clientFileId: 'raw-bytes', fileName: 'bytes.pdf', sizeBytes: rawBytes.length }),
    file: makeFile({ buffer: rawBytes }),
  });
  assert.deepStrictEqual(result.drive.uploads[0].buffer, rawBytes, 'raw bytes survive unchanged');
  const pdf = Buffer.from('%PDF-1.7\r\nbinary\x00\xff', 'binary');
  result = await runHandler({
    fields: baseFields({ ticket: 'e'.repeat(64), clientFileId: 'pdf-bytes', fileName: 'pdf.pdf', sizeBytes: pdf.length }),
    file: makeFile({ buffer: pdf }),
  });
  assert.deepStrictEqual(result.drive.uploads[0].buffer, pdf, 'PDF bytes survive unchanged');
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  result = await runHandler({
    fields: baseFields({ ticket: 'f'.repeat(64), clientFileId: 'png-bytes', fileName: 'image.png', mimeType: 'image/png', sizeBytes: png.length }),
    file: makeFile({ buffer: png, mimeType: 'image/png' }),
  });
  assert.deepStrictEqual(result.drive.uploads[0].buffer, png, 'image bytes survive unchanged');
  const office = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x01, 0x02]);
  const officeMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  result = await runHandler({
    fields: baseFields({ ticket: '1'.repeat(64), clientFileId: 'docx-bytes', fileName: 'doc.docx', mimeType: officeMime, sizeBytes: office.length }),
    file: makeFile({ buffer: office, mimeType: officeMime }),
  });
  assert.deepStrictEqual(result.drive.uploads[0].buffer, office, 'Office-file-like binary bytes survive unchanged');

  const failingCompletionDrive = new FakeDriveService();
  const capturedWarnings = [];
  result = await runHandler({
    driveService: failingCompletionDrive,
    visitService: new FakeVisitService({ completeFailure: serviceError('internal', 'raw drive stack trace client-secret refresh-token should not leak') }),
    logger: { warn(message, data) { capturedWarnings.push({ message, data }); } },
  });
  assert.strictEqual(result.res.statusCode, 500, 'completion failure returns failure');
  assert.strictEqual(failingCompletionDrive.uploads.length, 1, 'completion failure preserves Drive file for manual recovery');
  assert.ok(!/client-secret|refresh-token|raw drive stack trace/.test(result.body || JSON.stringify(result.json)), 'internal errors sanitized');
  assert.ok(!/client-secret|refresh-token|raw drive stack trace/.test(JSON.stringify(capturedWarnings)), 'secrets never enter logs');

  const source = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8')
    + fs.readFileSync(path.join(root, 'functions', 'lib', 'visit-drive.js'), 'utf8');
  assert.ok(/exports\.uploadVisitSubmissionFile\s*=\s*onRequest/.test(source), 'Firebase HTTPS endpoint added');
  assert.ok(/@fastify\/busboy/.test(source), 'Busboy parser used');
  assert.ok(/googleapis/.test(source), 'official Google Drive API client used');
  assert.ok(/VISIT_DRIVE_AUTH_MODE/.test(source), 'Drive auth mode is explicit');
  assert.ok(/createFirestoreFolderLockManager/.test(source), 'Firestore folder lock manager is wired');
  assert.ok(/visitSubmissionFolderLocks/.test(source), 'Visit folder lock collection is used');
  const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
  assert.ok(/match\s+\/visitSubmissionFolderLocks\/\{folderLockId\}\s*\{[\s\S]*?allow read, write: if false;[\s\S]*?\}/.test(rules), 'client direct lock access remains denied');
  assert.ok(!/base64/i.test(fs.readFileSync(path.join(root, 'js', 'visit-submission-upload.js'), 'utf8')), 'frontend no base64 upload');
  assert.ok(!/firebase deploy|functions:deploy|clasp deploy/i.test(source), 'no deploy command introduced');
  assert.ok(
  !/apps-script[\\/]+rcph-drive-uploader\.gs/.test(source),
  'Visit Firebase uploader does not depend on the superseded Apps Script source'
);
  console.log('Visit Firebase HTTP upload verification passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
