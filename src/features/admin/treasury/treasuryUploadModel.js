export const TREASURY_UPLOAD_ALLOWED_MIME_TYPES = Object.freeze([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
export const TREASURY_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

export function createTreasuryUploadState() {
  return { file: null, status: "idle", error: "", uploadedMetadata: null };
}

const EXTENSIONS_BY_MIME = Object.freeze({
  "application/pdf": ["pdf"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
});

function cleanText(value, max = 700) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function isDriveUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "drive.google.com";
  } catch {
    return false;
  }
}

export function validateTreasuryUploadEndpoint(value) {
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

export function validateTreasuryUploadFile(file) {
  const name = cleanText(file?.name, 181);
  const mimeType = cleanText(file?.type, 100).toLowerCase();
  const sizeBytes = Number(file?.size);
  if (!name || name.length > 180) return "Use a filename between 1 and 180 characters.";
  if (!TREASURY_UPLOAD_ALLOWED_MIME_TYPES.includes(mimeType)) return `${name} is not a supported PDF, JPG, PNG, or WebP file.`;
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) return `${name} is empty or could not be read.`;
  if (sizeBytes > TREASURY_UPLOAD_MAX_BYTES) return `${name} is larger than the 10 MB limit.`;
  const extension = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
  if (!EXTENSIONS_BY_MIME[mimeType].includes(extension)) return `${name} does not match its reported file type.`;
  return "";
}

export function selectTreasuryUploadFile(current, selected) {
  if (!selected) return { value: current || createTreasuryUploadState(), error: "" };
  const active = current?.file;
  if (active && active.name === selected.name && active.size === selected.size && active.lastModified === selected.lastModified) {
    const error = `${selected.name} is already selected.`;
    return { value: { ...current, error }, error };
  }
  const error = validateTreasuryUploadFile(selected);
  return {
    value: error ? { file: null, status: "idle", error, uploadedMetadata: null } : { file: selected, status: "ready", error: "", uploadedMetadata: null },
    error,
  };
}

export function formatTreasuryUploadSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function buildTreasuryUploadTicketPayload(file, transaction, transactionId) {
  return {
    fileName: file.name,
    mimeType: file.type.toLowerCase(),
    sizeBytes: file.size,
    transactionId,
    transactionDate: transaction.date,
    transactionPurpose: transaction.purpose,
    transactionType: transaction.type,
    transactionAmount: transaction.amount,
  };
}

export function buildTreasuryAppsScriptPayload(file, approved, base64) {
  return {
    action: "uploadTreasuryBill",
    ticket: approved.ticket,
    transactionId: approved.transactionId,
    fileName: approved.fileName,
    mimeType: approved.mimeType,
    sizeBytes: approved.sizeBytes,
    base64,
  };
}

export function normalizeTreasuryUploadResponse(raw, approved, fallbackFileName = "") {
  if (!raw || (raw.ok !== true && raw.status !== "success")) throw new Error("The upload service did not accept the file.");
  const fileUrl = cleanText(raw.fileUrl || raw.url);
  const transactionId = cleanText(raw.transactionId, 180);
  if (!isDriveUrl(fileUrl) || (transactionId && transactionId !== approved.transactionId)) {
    throw new Error("The upload service returned mismatched or incomplete Drive metadata.");
  }
  const folderUrl = cleanText(raw.folderUrl);
  if (folderUrl && !isDriveUrl(folderUrl)) throw new Error("The upload service returned mismatched or incomplete Drive metadata.");
  return {
    billUrl: fileUrl,
    billDriveFileId: cleanText(raw.fileId, 180),
    billFileName: cleanText(raw.fileName || approved.fileName || fallbackFileName, 180),
    billMimeType: cleanText(approved.mimeType, 100),
    billSizeBytes: Number.isSafeInteger(approved.sizeBytes) ? approved.sizeBytes : 0,
    billFolderId: cleanText(raw.folderId, 180),
    billFolderUrl: folderUrl,
    billFolderName: cleanText(raw.folderName, 180),
  };
}

export function getSafeTreasuryUploadError(error) {
  const code = cleanText(error?.code, 100).toLowerCase();
  const messages = {
    "functions/unauthenticated": "Your session expired. Sign in again before retrying the upload.",
    "functions/permission-denied": "You do not have permission to upload Treasury files.",
    "functions/invalid-argument": "The file or transaction details were rejected. Check them and retry.",
    "functions/failed-precondition": "Treasury is locked or this record no longer accepts uploads.",
    "functions/not-found": "This Treasury record no longer exists.",
    "functions/resource-exhausted": "Too many upload requests were made. Wait a while before retrying.",
    "functions/unavailable": "The upload authorization service is temporarily unavailable.",
  };
  if (messages[code]) return messages[code];
  const local = [
    "Treasury upload is not configured.",
    "The selected file could not be read.",
    "Upload authorization was incomplete.",
    "The upload service did not accept the file.",
    "The upload service returned mismatched or incomplete Drive metadata.",
  ];
  return local.includes(error?.message) ? error.message : "The supporting file could not be uploaded. Please retry.";
}

export function getDriveFileId(value) {
  const url = cleanText(value, 1000);
  const patterns = [/\/file\/d\/([a-zA-Z0-9_-]+)/, /[?&]id=([a-zA-Z0-9_-]+)/, /\/d\/([a-zA-Z0-9_-]+)/];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return "";
}

export function getDriveThumbnailUrl(value) {
  const fileId = getDriveFileId(value);
  return fileId ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1000` : "";
}

export function isTreasuryImageAttachment(attachment) {
  const mimeType = cleanText(attachment?.mimeType, 100).toLowerCase();
  if (mimeType) return mimeType.startsWith("image/");
  const name = cleanText(attachment?.fileName, 180).toLowerCase();
  return /\.(jpe?g|png|webp)$/.test(name);
}

export function treasuryAttachmentFromRecord(record) {
  const fileUrl = cleanText(record?.billUrl, 1000);
  if (!fileUrl) return null;
  return {
    fileId: cleanText(record?.billDriveFileId || record?.billFileId, 180),
    fileName: cleanText(record?.billFileName, 180) || "Supporting file",
    fileUrl,
    mimeType: cleanText(record?.billMimeType, 100),
    sizeBytes: Number.isFinite(record?.billSizeBytes) ? record.billSizeBytes : 0,
    folderId: cleanText(record?.billFolderId, 180),
    folderUrl: cleanText(record?.billFolderUrl, 1000),
    folderName: cleanText(record?.billFolderName, 180),
  };
}
