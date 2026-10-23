'use strict';

// Payment proof (a screenshot or PDF) for a Fine. It is uploaded to Drive with the
// Treasury uploader, then saved on the Fine and on its linked Treasury entry
// together, so Fines, Treasury and the visit dashboard always show the same file.

const FINE_PROOF_MIME_TYPES = Object.freeze(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const FINE_PROOF_MAX_BYTES = 10 * 1024 * 1024;
const FINE_PROOF_FIELDS = Object.freeze([
  'billUrl',
  'billDriveFileId',
  'billFileName',
  'billMimeType',
  'billSizeBytes',
  'billFolderId',
  'billFolderUrl',
  'billFolderName',
  'billUploadedAt',
  'billUploadedByUid',
  'billUploadedByName',
]);
const DRIVE_ID_PATTERN = /^[A-Za-z0-9_-]{10,180}$/;
const CONTROL_CHAR_PATTERN = /[\u0000-\u001f\u007f]/g;

function text(value, max) {
  return typeof value === 'string' ? value.replace(CONTROL_CHAR_PATTERN, '').trim().slice(0, max) : '';
}

function driveUrl(value) {
  const raw = text(value, 1000);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && url.hostname === 'drive.google.com' ? url.toString() : null;
  } catch {
    return null;
  }
}

function driveIdFromUrl(value) {
  try {
    const url = new URL(value);
    const fromPath = url.pathname.match(/\/(?:file\/)?d\/([A-Za-z0-9_-]+)/);
    return fromPath ? fromPath[1] : (url.searchParams.get('id') || '');
  } catch {
    return '';
  }
}

// Returns the Drive fields to store, or throws `invalid-argument` through makeError.
function normalizeFineProof(input, makeError) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const billUrl = driveUrl(source.billUrl);
  if (!billUrl) throw makeError('invalid-argument', 'Payment proof must be a Google Drive file link.');

  const billDriveFileId = text(source.billDriveFileId, 180) || driveIdFromUrl(billUrl);
  if (!DRIVE_ID_PATTERN.test(billDriveFileId)) throw makeError('invalid-argument', 'Payment proof is missing its Drive file.');

  const billMimeType = text(source.billMimeType, 100).toLowerCase();
  if (!FINE_PROOF_MIME_TYPES.includes(billMimeType)) throw makeError('invalid-argument', 'Payment proof must be a PDF, JPG, PNG or WebP file.');

  const billSizeBytes = Number(source.billSizeBytes);
  if (!Number.isSafeInteger(billSizeBytes) || billSizeBytes <= 0 || billSizeBytes > FINE_PROOF_MAX_BYTES) {
    throw makeError('invalid-argument', 'Payment proof must be 10 MB or smaller.');
  }

  const billFolderUrl = driveUrl(source.billFolderUrl);
  if (billFolderUrl === null) throw makeError('invalid-argument', 'Payment proof folder must be a Google Drive link.');
  const billFolderId = text(source.billFolderId, 180);
  if (billFolderId && !DRIVE_ID_PATTERN.test(billFolderId)) throw makeError('invalid-argument', 'Payment proof folder is not valid.');

  return {
    billUrl,
    billDriveFileId,
    billFileName: text(source.billFileName, 180) || 'Payment proof',
    billMimeType,
    billSizeBytes,
    billFolderId,
    billFolderUrl,
    billFolderName: text(source.billFolderName, 180),
  };
}

// The same update goes to the Fine and to its Treasury entry. `proof` null removes it.
function buildFineProofUpdate({ proof, actorUid, actorName, now, deleteField }) {
  if (!proof) {
    return Object.fromEntries(FINE_PROOF_FIELDS.map((field) => [field, deleteField]));
  }
  return {
    ...proof,
    billUploadedAt: now,
    billUploadedByUid: actorUid,
    billUploadedByName: text(actorName, 160),
  };
}

module.exports = {
  FINE_PROOF_FIELDS,
  FINE_PROOF_MAX_BYTES,
  FINE_PROOF_MIME_TYPES,
  buildFineProofUpdate,
  normalizeFineProof,
};
