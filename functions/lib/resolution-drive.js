'use strict';

const { Readable } = require('stream');
const { createGoogleDriveClient } = require('./visit-drive');

const PDF_MIME = 'application/pdf';
const SOURCE_DESTINATION = 'resolutionSource';
const FINAL_DESTINATION = 'resolutionFinal';

function driveError(code, message, status = 500) {
  return Object.assign(new Error(message), { code, status });
}

function text(value, max = 500) {
  return String(value || '').trim().slice(0, max);
}

function escapeDriveQuery(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function safeNamePart(value, fallback = 'resolution') {
  return text(value, 160).replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || fallback;
}

function getResolutionDriveConfig(env = process.env) {
  const authMode = text(env.RESOLUTION_DRIVE_AUTH_MODE || env.VISIT_DRIVE_AUTH_MODE || 'oauth', 40).toLowerCase();
  const sourceFolderId = text(env.RESOLUTION_SOURCE_FOLDER_ID, 300);
  const finalFolderId = text(env.RESOLUTION_FINAL_FOLDER_ID, 300);
  if (!['oauth', 'shared-drive'].includes(authMode) || !sourceFolderId || !finalFolderId) {
    throw driveError('drive-not-configured', 'Resolution PDF storage is not configured.');
  }
  return { authMode, sourceFolderId, finalFolderId };
}

function normalizeDriveFile(raw = {}) {
  return {
    id: text(raw.id, 300),
    name: text(raw.name, 300),
    mimeType: text(raw.mimeType, 100),
    sizeBytes: Math.max(0, Number(raw.size) || 0),
    md5Checksum: text(raw.md5Checksum, 100),
    appProperties: raw.appProperties && typeof raw.appProperties === 'object' ? { ...raw.appProperties } : {},
    parents: Array.isArray(raw.parents) ? raw.parents.map(value => text(value, 300)).filter(Boolean) : [],
    createdTime: text(raw.createdTime, 100),
    trashed: raw.trashed === true,
  };
}

function createResolutionDriveService(options = {}) {
  let driveClient = options.driveClient || null;

  function getConfig() {
    return options.config || getResolutionDriveConfig(options.env || process.env);
  }

  function getClient() {
    if (!driveClient) {
      const config = getConfig();
      driveClient = createGoogleDriveClient({
        ...options,
        config: { authMode: config.authMode },
      });
    }
    return driveClient;
  }

  async function createPdf({ folderId, name, bytes, appProperties }) {
    const response = await getClient().files.create({
      requestBody: {
        name: text(name, 240),
        mimeType: PDF_MIME,
        parents: [folderId],
        appProperties: Object.fromEntries(Object.entries(appProperties || {}).map(([key, value]) => [text(key, 100), text(value, 124)])),
      },
      media: { mimeType: PDF_MIME, body: Readable.from(Buffer.from(bytes)) },
      fields: 'id,name,mimeType,size,md5Checksum,appProperties,parents,createdTime,trashed',
      supportsAllDrives: true,
    });
    const file = normalizeDriveFile(response.data);
    if (!file.id) throw driveError('drive-upload-failed', 'Google Drive did not return a file ID.');
    return file;
  }

  async function getFile(fileId) {
    const response = await getClient().files.get({
      fileId: text(fileId, 300),
      fields: 'id,name,mimeType,size,md5Checksum,appProperties,parents,createdTime,trashed',
      supportsAllDrives: true,
    });
    return normalizeDriveFile(response.data);
  }

  async function downloadFile(fileId) {
    const response = await getClient().files.get({
      fileId: text(fileId, 300),
      alt: 'media',
      supportsAllDrives: true,
    }, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  }

  async function deleteFile(fileId) {
    if (!text(fileId, 300)) return;
    await getClient().files.delete({ fileId: text(fileId, 300), supportsAllDrives: true });
  }

  function assertTrustedFile(file, { folderId, resolutionId, documentType, identityKey, identityValue, sha256 }) {
    if (!file?.id || file.trashed || file.mimeType !== PDF_MIME || !file.parents.includes(folderId)) throw driveError('drive-file-mismatch', 'The trusted Drive PDF is unavailable.');
    const properties = file.appProperties || {};
    if (properties.resolutionId !== resolutionId
      || properties.documentType !== documentType
      || properties[identityKey] !== identityValue
      || (sha256 && properties.sha256 !== sha256)) {
      throw driveError('drive-file-mismatch', 'The trusted Drive PDF metadata does not match.');
    }
    return file;
  }

  async function createSourceFile({ resolutionId, uploadId, sha256, uploaderUid, bytes }) {
    const config = getConfig();
    return createPdf({
      folderId: config.sourceFolderId,
      name: `RCPH-resolution-source-${safeNamePart(resolutionId)}-${safeNamePart(uploadId)}.pdf`,
      bytes,
      appProperties: { resolutionId, uploadId, sha256, uploaderUid, documentType: 'resolution-source' },
    });
  }

  async function getSourceFile({ driveFileId, resolutionId, uploadId, sha256 }) {
    const config = getConfig();
    return assertTrustedFile(await getFile(driveFileId), { folderId: config.sourceFolderId, resolutionId, documentType: 'resolution-source', identityKey: 'uploadId', identityValue: uploadId, sha256 });
  }

  async function downloadSourceFile(input) {
    const file = await getSourceFile(input);
    return { file, bytes: await downloadFile(file.id) };
  }

  async function findSourceFiles({ resolutionId, uploadId }) {
    const config = getConfig();
    return findDriveFilesByAppProperties({ folderId: config.sourceFolderId, appProperties: { resolutionId, uploadId, documentType: 'resolution-source' } });
  }

  async function deleteSourceFile(input) {
    const file = await getSourceFile(input);
    await deleteFile(file.id);
  }

  async function createFinalFile({ resolutionId, resolutionNumber, finalizationId, sha256, bytes }) {
    const config = getConfig();
    return createPdf({
      folderId: config.finalFolderId,
      name: `RCPH-${safeNamePart(resolutionNumber)}-${safeNamePart(finalizationId)}.pdf`,
      bytes,
      appProperties: { resolutionId, finalizationId, sha256, documentType: 'resolution-final' },
    });
  }

  async function findDriveFilesByAppProperties({ folderId, appProperties }) {
    const propertyQueries = Object.entries(appProperties || {}).map(([key, value]) => `appProperties has { key='${escapeDriveQuery(key)}' and value='${escapeDriveQuery(value)}' }`);
    const query = [`'${escapeDriveQuery(folderId)}' in parents`, 'trashed = false', ...propertyQueries].join(' and ');
    const response = await getClient().files.list({
      q: query,
      fields: 'files(id,name,mimeType,size,md5Checksum,appProperties,parents,createdTime,trashed)',
      spaces: 'drive',
      pageSize: 10,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    return (response.data.files || []).map(normalizeDriveFile);
  }

  async function findFinalFiles({ resolutionId, finalizationId }) {
    const config = getConfig();
    return findDriveFilesByAppProperties({ folderId: config.finalFolderId, appProperties: { resolutionId, finalizationId, documentType: 'resolution-final' } });
  }

  async function getFinalFile({ driveFileId, resolutionId, finalizationId, sha256 }) {
    const config = getConfig();
    return assertTrustedFile(await getFile(driveFileId), { folderId: config.finalFolderId, resolutionId, documentType: 'resolution-final', identityKey: 'finalizationId', identityValue: finalizationId, sha256 });
  }

  async function downloadFinalFile(input) {
    const file = await getFinalFile(input);
    return { file, bytes: await downloadFile(file.id) };
  }

  return {
    createFinalFile,
    createPrivateDriveFile: createPdf,
    createSourceFile,
    deleteFile,
    deleteDriveFile: deleteFile,
    downloadFile,
    downloadDriveFileBytes: downloadFile,
    downloadFinalFile,
    downloadSourceFile,
    deleteSourceFile,
    findFinalFiles,
    findDriveFilesByAppProperties,
    findSourceFiles,
    getConfig,
    getFile,
    getDriveFileMetadata: getFile,
    getFinalFile,
    getSourceFile,
  };
}

module.exports = {
  FINAL_DESTINATION,
  SOURCE_DESTINATION,
  createResolutionDriveService,
  getResolutionDriveConfig,
  normalizeDriveFile,
};
