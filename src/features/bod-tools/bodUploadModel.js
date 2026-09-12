export const BOD_UPLOAD_ALLOWED_MIME_TYPES = Object.freeze([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
export const BOD_UPLOAD_MAX_BYTES = 15 * 1024 * 1024;
export const BOD_UPLOAD_MAX_FILES = 10;

const EXTENSIONS_BY_MIME = Object.freeze({
  "application/pdf": ["pdf"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
});

const BOD_FINALIZATION_REASON_CODES = new Set([
  "attachment-conflict",
  "event-date-missing",
  "event-inactive",
  "event-name-missing",
  "event-not-club-event",
  "event-not-found",
  "file-folder-mismatch",
  "file-invalid",
  "file-mime-mismatch",
  "file-name-mismatch",
  "file-size-mismatch",
  "finalization-authorization-incomplete",
  "finalization-conflict",
  "finalization-expired",
  "finalization-failed-precondition",
  "finalization-internal-error",
  "finalization-metadata-mismatch",
  "finalization-not-configured",
  "finalization-not-found",
  "finalization-not-pending",
  "finalization-permission-denied",
  "finalization-rejected",
  "finalization-replay-mismatch",
  "finalization-response-invalid",
  "finalization-response-mismatch",
  "finalization-result-missing",
  "folder-invalid",
  "folder-name-mismatch",
  "folder-outside-approved-root",
  "invalid-finalization-request",
  "invalid-finalize-proof",
  "storage-not-configured",
  "upload-group-event-mismatch",
  "upload-group-folder-mismatch",
  "upload-group-invalid",
  "upload-group-user-mismatch",
  "verified",
]);

function text(value, max = 700) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function safeDocumentId(value, max = 300) {
  const id = text(value, max);
  const hasControlCharacter = [...id].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
  return id && !/[\\/]/.test(id) && !hasControlCharacter ? id : "";
}

function isDriveUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "drive.google.com";
  } catch {
    return false;
  }
}

function safeFinalizationReasonCode(value, fallback = "finalization-rejected") {
  const code = text(value, 80).toLowerCase();
  return BOD_FINALIZATION_REASON_CODES.has(code) ? code : fallback;
}

export function validateBodUploadEndpoint(value) {
  try {
    const url = new URL(typeof value === "string" ? value.trim() : "");
    return url.protocol === "https:"
      && url.hostname === "script.google.com"
      && /^\/macros\/s\/[^/]+\/exec$/.test(url.pathname)
      ? url.href
      : "";
  } catch {
    return "";
  }
}

export function validateBodUploadFile(file) {
  const name = typeof file?.name === "string" ? file.name.trim() : "";
  const mimeType = typeof file?.type === "string" ? file.type.toLowerCase() : "";
  const sizeBytes = Number(file?.size);
  if (!name || name.length > 180) return "Use a filename between 1 and 180 characters.";
  if (!BOD_UPLOAD_ALLOWED_MIME_TYPES.includes(mimeType)) return `${name} is not a supported PDF, JPG, PNG, or WebP file.`;
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) return `${name} is empty or could not be read.`;
  if (sizeBytes > BOD_UPLOAD_MAX_BYTES) return `${name} is larger than the 15 MB limit.`;
  const extension = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
  if (!EXTENSIONS_BY_MIME[mimeType].includes(extension)) return `${name} does not match its reported file type.`;
  return "";
}

export function bodUploadFileKey(file) {
  return `${file?.name || ""}:${file?.size || 0}:${file?.lastModified || 0}`;
}

export function addBodUploadFiles(current, selected) {
  const items = Array.isArray(current) ? [...current] : [];
  const errors = [];
  const keys = new Set(items.map((item) => item.fileKey));
  for (const file of Array.from(selected || [])) {
    if (items.length >= BOD_UPLOAD_MAX_FILES) {
      errors.push(`You can upload up to ${BOD_UPLOAD_MAX_FILES} files per event.`);
      break;
    }
    const error = validateBodUploadFile(file);
    const fileKey = bodUploadFileKey(file);
    if (error) errors.push(error);
    else if (keys.has(fileKey)) errors.push(`${file.name} is already selected.`);
    else {
      keys.add(fileKey);
      items.push({
        localId: `${Date.now().toString(36)}-${items.length}-${Math.random().toString(36).slice(2)}`,
        fileKey,
        file,
        fileName: file.name,
        mimeType: file.type.toLowerCase(),
        sizeBytes: file.size,
        status: "ready",
        error: "",
        uploaded: null,
      });
    }
  }
  return { items, errors };
}

export function formatBodUploadSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getSafeBodUploadError(error) {
  const code = typeof error?.code === "string" ? error.code.toLowerCase() : "";
  const messages = {
    "functions/unauthenticated": "Your session expired. Sign in again before retrying the upload.",
    "functions/permission-denied": "You do not have permission to upload files for this event.",
    "functions/invalid-argument": "The file details were rejected. Remove the file and select it again.",
    "functions/failed-precondition": "This event is locked or no longer accepts uploads.",
    "functions/resource-exhausted": "Too many uploads were requested. Wait a while before retrying.",
    "functions/unavailable": "The upload authorization service is temporarily unavailable.",
  };
  if (messages[code]) return messages[code];
  const safeLocalMessages = [
    "Upload service is not configured.",
    "The selected file could not be read.",
    "Upload authorization was incomplete.",
    "Save the event before uploading files.",
    "The upload service did not accept the file.",
    "The upload service returned incomplete Drive metadata.",
  ];
  return safeLocalMessages.includes(error?.message)
    ? error.message
    : "The file could not be uploaded. Please retry.";
}

export function buildBodUploadTicketPayload(item, event) {
  const eventId = safeDocumentId(event?.eventId, 128);
  if (!eventId) throw new Error("Save the event before uploading files.");
  return {
    eventId,
    fileName: item.fileName,
    mimeType: item.mimeType,
    sizeBytes: item.sizeBytes,
    ...(event.uploadGroupId
      ? { uploadGroupId: event.uploadGroupId }
      : {}),
  };
}

function normalizeFinalizedAttachment(raw, expected) {
  if (!raw || typeof raw !== "object") return null;
  const attachment = {
    fileId: safeDocumentId(raw.fileId, 300),
    fileName: text(raw.fileName, 180),
    fileUrl: text(raw.fileUrl),
    mimeType: text(raw.mimeType, 120).toLowerCase(),
    sizeBytes: Number(raw.sizeBytes),
    eventId: safeDocumentId(raw.eventId, 128),
    uploadGroupId: safeDocumentId(raw.uploadGroupId, 100),
    attachmentPath: text(raw.attachmentPath),
    storageProvider: text(raw.storageProvider, 80),
    source: text(raw.source, 80),
    verified: raw.verified === true,
  };
  const expectedPath = `bodEvents/${expected.eventId}/attachments/${expected.fileId}`;
  if (
    attachment.fileId !== expected.fileId
    || attachment.fileName !== expected.fileName
    || attachment.eventId !== expected.eventId
    || attachment.uploadGroupId !== expected.uploadGroupId
    || attachment.attachmentPath !== expectedPath
    || attachment.mimeType !== expected.mimeType
    || attachment.sizeBytes !== expected.sizeBytes
    || !isDriveUrl(attachment.fileUrl)
    || attachment.storageProvider !== "googleDrive"
    || attachment.source !== "appsScriptFinalize"
    || !attachment.verified
  ) return null;
  return attachment;
}

export function normalizeBodUploadResponse(raw, fallbackGroupId = "", expected = {}) {
  if (!raw || raw.ok !== true) throw new Error("The upload service did not accept the file.");
  const fileId = text(raw.fileId, 180);
  const fileName = text(raw.fileName, 180);
  const fileUrl = text(raw.fileUrl);
  const folderId = text(raw.folderId, 180);
  const folderName = text(raw.folderName, 180);
  const folderUrl = text(raw.folderUrl);
  const uploadGroupId = text(raw.uploadGroupId || fallbackGroupId, 100);
  if (!fileId || !fileName || !uploadGroupId || !isDriveUrl(fileUrl) || !isDriveUrl(folderUrl)) {
    throw new Error("The upload service returned incomplete Drive metadata.");
  }
  const eventId = safeDocumentId(expected.eventId, 128);
  const expectedFileName = text(expected.fileName, 180);
  const expectedMimeType = text(expected.mimeType, 120).toLowerCase();
  const expectedSizeBytes = Number(expected.sizeBytes);
  if (
    !eventId
    || (expectedFileName && fileName !== expectedFileName)
    || !BOD_UPLOAD_ALLOWED_MIME_TYPES.includes(expectedMimeType)
    || !Number.isSafeInteger(expectedSizeBytes)
    || expectedSizeBytes <= 0
  ) {
    throw new Error("The upload service returned incomplete Drive metadata.");
  }
  const finalizationRaw = raw.attachmentFinalization && typeof raw.attachmentFinalization === "object"
    ? raw.attachmentFinalization
    : {};
  const attachment = normalizeFinalizedAttachment(raw.attachment, {
    fileId,
    fileName,
    eventId,
    uploadGroupId,
    mimeType: expectedMimeType,
    sizeBytes: expectedSizeBytes,
  });
  const claimedFinalized = raw.attachmentFinalized === true;
  const attachmentFinalized = claimedFinalized && Boolean(attachment);
  const attachmentFinalizationCode = attachmentFinalized
    ? "verified"
    : claimedFinalized
      ? "finalization-response-invalid"
      : safeFinalizationReasonCode(
        raw.attachmentFinalizationCode,
        raw.attachmentFinalized === false ? "finalization-rejected" : "finalization-result-missing",
      );
  return {
    fileId,
    fileName,
    fileUrl,
    folderId,
    folderName,
    folderUrl,
    uploadGroupId,
    attachmentFinalized,
    attachmentFinalizationCode,
    attachmentFinalizationWarning: text(raw.attachmentFinalizationWarning, 300),
    attachment,
    attachmentFinalization: attachmentFinalized ? {
      unchanged: finalizationRaw.unchanged === true,
      eventId: safeDocumentId(finalizationRaw.eventId, 128),
      uploadGroupId: safeDocumentId(finalizationRaw.uploadGroupId, 100),
      driveFileId: safeDocumentId(finalizationRaw.driveFileId, 300),
      attachmentPath: text(finalizationRaw.attachmentPath),
    } : null,
  };
}

export function getBodUploadFinalizationFailureMessage(upload) {
  const reasonCode = safeFinalizationReasonCode(
    upload?.attachmentFinalizationCode,
    "finalization-rejected",
  );
  return `Drive upload succeeded, but report attachment verification failed (${reasonCode}). The file was not added as a report image; retry the upload after the verification service is corrected.`;
}
