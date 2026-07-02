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
    "The upload service did not accept the file.",
    "The upload service returned incomplete Drive metadata.",
  ];
  return safeLocalMessages.includes(error?.message)
    ? error.message
    : "The file could not be uploaded. Please retry.";
}

export function buildBodUploadTicketPayload(item, event) {
  return {
    eventId: event.eventId,
    eventName: event.name,
    eventDate: event.eventDate,
    fileName: item.fileName,
    mimeType: item.mimeType,
    sizeBytes: item.sizeBytes,
    ...(event.uploadGroupId
      ? { uploadGroupId: event.uploadGroupId }
      : {}),
  };
}
export function normalizeBodUploadResponse(raw, fallbackGroupId = "") {
  if (!raw || raw.ok !== true) throw new Error("The upload service did not accept the file.");
  const text = (value, max = 700) => typeof value === "string" ? value.trim().slice(0, max) : "";
  const fileId = text(raw.fileId, 180);
  const fileName = text(raw.fileName, 180);
  const fileUrl = text(raw.fileUrl);
  const folderId = text(raw.folderId, 180);
  const folderName = text(raw.folderName, 180);
  const folderUrl = text(raw.folderUrl);
  const uploadGroupId = text(raw.uploadGroupId || fallbackGroupId, 100);
  const isDriveUrl = (value) => {
    try { const url = new URL(value); return url.protocol === "https:" && url.hostname === "drive.google.com"; } catch { return false; }
  };
  if (!fileId || !fileName || !uploadGroupId || !isDriveUrl(fileUrl) || !isDriveUrl(folderUrl)) {
    throw new Error("The upload service returned incomplete Drive metadata.");
  }
  return { fileId, fileName, fileUrl, folderId, folderName, folderUrl, uploadGroupId };
}
