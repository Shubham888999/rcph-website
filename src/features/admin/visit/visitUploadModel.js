const PROD_UPLOAD_ENDPOINT = "https://us-central1-rcph-admin.cloudfunctions.net/uploadVisitSubmissionFile";

export const VISIT_FILE_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.webp";

export const VISIT_MIME_BY_EXTENSION = Object.freeze({
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
});

function clean(value, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function getVisitFileExtension(fileName) {
  const match = clean(fileName, 255).toLowerCase().match(/\.([a-z0-9]{1,12})$/);
  return match?.[1] || "";
}

export function validateVisitUploadFile(file, maxFileSizeBytes) {
  if (!file) return "Choose a file.";
  if (!Number.isSafeInteger(file.size) || file.size <= 0) return "The selected file is empty.";
  if (!Number.isSafeInteger(maxFileSizeBytes) || maxFileSizeBytes <= 0 || file.size > maxFileSizeBytes) {
    return "The selected file exceeds this folder’s size limit.";
  }
  const extension = getVisitFileExtension(file.name);
  const expectedMime = VISIT_MIME_BY_EXTENSION[extension];
  if (!expectedMime) return "This file type is not supported.";
  return clean(file.type, 160).toLowerCase() === expectedMime
    ? ""
    : "The file extension does not match its reported type.";
}

export function visitFileKey(file) {
  return `${clean(file?.name, 255).toLowerCase()}|${Number(file?.size) || 0}|${clean(file?.type, 160).toLowerCase()}`;
}

export function addVisitFiles(queue, incoming, folder, makeId = () => crypto.randomUUID()) {
  const current = Array.isArray(queue) ? queue : [];
  const files = Array.from(incoming || []);
  const existingKeys = new Set(current.map((item) => visitFileKey(item.file)));
  const available = Math.max(0, Number(folder?.maxFilesPerSelection || 0) - current.length);
  const added = [];
  let duplicateCount = 0;
  let overflowCount = 0;

  for (const file of files) {
    const key = visitFileKey(file);
    if (existingKeys.has(key)) {
      duplicateCount += 1;
      continue;
    }
    if (added.length >= available) {
      overflowCount += 1;
      continue;
    }
    existingKeys.add(key);
    const validationError = validateVisitUploadFile(file, folder?.maxFileSizeBytes);
    added.push({
      clientFileId: makeId(),
      file,
      status: validationError ? "Failed" : "Ready",
      message: validationError || "Ready to upload.",
      validationError,
      sessionId: "",
      ticket: "",
      completionProof: "",
      submissionId: "",
    });
  }
  return { queue: [...current, ...added], duplicateCount, overflowCount };
}

export function validateVisitUploadEndpoint(value) {
  const candidate = clean(value, 1000);
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    if (url.href === PROD_UPLOAD_ENDPOINT) return candidate;
    const localHost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    return url.protocol === "http:" && localHost && /uploadVisitSubmissionFile\/?$/.test(url.pathname)
      ? candidate
      : "";
  } catch {
    return "";
  }
}

export function normalizeVisitUploadResponse(raw) {
  if (!raw || raw.ok === false || !clean(raw.completionProof, 100)) {
    throw new Error("The trusted uploader did not confirm the Drive upload.");
  }
  return {
    completionProof: clean(raw.completionProof, 100),
    fileUrl: clean(raw.fileUrl, 1000),
  };
}

export function formatVisitFileSize(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 bytes";
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function isVisitImageFile(file) {
  const mimeType = clean(file?.mimeType, 160).toLowerCase();
  return ["image/jpeg", "image/png", "image/webp"].includes(mimeType);
}

export function getVisitDriveFileId(value) {
  const candidate = clean(value, 1000);
  try {
    const url = new URL(candidate);
    if (!url.hostname.endsWith("drive.google.com")) return "";
    const pathMatch = url.pathname.match(/\/file\/d\/([^/]+)/);
    return clean(pathMatch?.[1] || url.searchParams.get("id"), 180).replace(/[^A-Za-z0-9_-]/g, "");
  } catch {
    return "";
  }
}

export function getVisitThumbnailUrl(file) {
  if (!isVisitImageFile(file)) return "";
  const fileId = getVisitDriveFileId(file?.fileUrl);
  return fileId ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1000` : "";
}

export function safeVisitUploadError(error) {
  const code = clean(error?.code, 100).toLowerCase();
  if (code.includes("permission-denied") || code.includes("unauthenticated")) {
    return "Your account is not authorized to upload to this Club Visit folder.";
  }
  if (code.includes("resource-exhausted")) return "This Club Visit folder has reached its upload limit.";
  if (code.includes("failed-precondition")) return "This Club Visit folder is closed, locked, or no longer accepts this upload.";
  return "The supporting file could not be uploaded. You can retry without creating a duplicate submission.";
}
