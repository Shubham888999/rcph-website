export const VISIT_UPLOAD_FUNCTION_NAME = "uploadVisitSubmissionFile";
export const VISIT_UPLOAD_REGION = "us-central1";
const PROD_UPLOAD_ENDPOINT = `https://${VISIT_UPLOAD_REGION}-rcph-admin.cloudfunctions.net/${VISIT_UPLOAD_FUNCTION_NAME}`;
export const VISIT_BULK_UPLOAD_CONCURRENCY = 3;

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

function cleanFirebaseProjectId(value) {
  const candidate = clean(value, 80).toLowerCase();
  return /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(candidate) ? candidate : "";
}

export function buildVisitUploadEndpoint(projectId) {
  const safeProjectId = cleanFirebaseProjectId(projectId);
  return safeProjectId
    ? `https://${VISIT_UPLOAD_REGION}-${safeProjectId}.cloudfunctions.net/${VISIT_UPLOAD_FUNCTION_NAME}`
    : "";
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

export function addBulkVisitFiles(queue, incoming, maxFilesPerSelection = 10, maxFileSizeBytes = 25 * 1024 * 1024, makeId = () => crypto.randomUUID()) {
  const current = Array.isArray(queue) ? queue : [];
  const files = Array.from(incoming || []);
  const limit = Math.max(1, Math.min(10, Number(maxFilesPerSelection) || 10));
  const available = Math.max(0, limit - current.length);
  const added = [];
  let overflowCount = 0;

  for (const file of files) {
    if (added.length >= available) {
      overflowCount += 1;
      continue;
    }
    const validationError = validateVisitUploadFile(file, maxFileSizeBytes);
    added.push({
      clientFileId: makeId(),
      file,
      status: validationError ? "Failed" : "Ready",
      message: validationError || "Ready to upload.",
      validationError,
    });
  }
  return { queue: [...current, ...added], overflowCount };
}

export function bulkVisitFolderStatus(folder, visit = {}) {
  if (visit.enabled === false || folder?.enabled === false) return "disabled";
  if (folder?.locked === true) return "locked";
  if (visit.submissionOpen === false || folder?.submissionOpen === false) return "closed";
  return "open";
}

export function bulkVisitFolderAvailability(folder, files, visit = {}) {
  const fileItems = Array.isArray(files) ? files : [];
  const fileCount = fileItems.length;
  const status = bulkVisitFolderStatus(folder, visit);
  const activeFileCount = Math.max(0, Number(folder?.activeFileCount) || 0);
  const maxActiveFiles = Math.max(1, Number(folder?.maxActiveFiles) || 40);
  const remainingCapacity = Math.max(0, maxActiveFiles - activeFileCount);
  const maxFilesPerSelection = Math.max(1, Number(folder?.maxFilesPerSelection) || 10);
  const maxFileSizeBytes = Math.max(1, Number(folder?.maxFileSizeBytes) || 25 * 1024 * 1024);
  const oversized = fileItems.find((item) => Number(item?.file?.size || 0) > maxFileSizeBytes);
  let message = "";
  if (status === "locked") message = folder?.lockReason ? `Locked: ${clean(folder.lockReason, 160)}` : "This folder is locked.";
  else if (status === "closed") message = "This folder is closed.";
  else if (status === "disabled") message = "This folder is disabled.";
  else if (fileCount > maxFilesPerSelection) message = `Only ${maxFilesPerSelection} file${maxFilesPerSelection === 1 ? "" : "s"} can be selected for this folder.`;
  else if (fileCount > remainingCapacity) message = `Only ${remainingCapacity} more file${remainingCapacity === 1 ? "" : "s"} can be uploaded to this folder.`;
  else if (oversized) message = `${oversized.file.name} exceeds this folder's size limit.`;
  return {
    status,
    selectable: status === "open" && fileCount > 0 && !message,
    message,
    remainingCapacity,
    activeFileCount,
    maxActiveFiles,
    maxFilesPerSelection,
    maxFileSizeBytes,
  };
}

export function buildBulkUploadPairs(files, folders, existingPairs = []) {
  const existing = new Map((Array.isArray(existingPairs) ? existingPairs : []).map((pair) => [pair.pairId, pair]));
  const pairs = [];
  for (const folder of Array.isArray(folders) ? folders : []) {
    for (const item of Array.isArray(files) ? files : []) {
      const pairId = `${folder.positionKey}:${item.clientFileId}`;
      pairs.push({
        pairId,
        visitType: folder.visitType,
        positionKey: folder.positionKey,
        positionTitle: folder.positionTitle,
        avenueCode: folder.avenueCode,
        clientFileId: item.clientFileId,
        fileName: item.file?.name || "",
        file: item.file,
        status: existing.get(pairId)?.status || "Queued",
        message: existing.get(pairId)?.message || "Waiting to upload.",
        sessionId: existing.get(pairId)?.sessionId || "",
        ticket: existing.get(pairId)?.ticket || "",
        completionProof: existing.get(pairId)?.completionProof || "",
        submissionId: existing.get(pairId)?.submissionId || "",
      });
    }
  }
  return pairs;
}

export function validateVisitUploadEndpoint(value, projectId = "") {
  const candidate = clean(value, 1000);
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    const endpointPath = new RegExp(`/${VISIT_UPLOAD_FUNCTION_NAME}/?$`);
    const currentProjectEndpoint = buildVisitUploadEndpoint(projectId);
    if (url.href === PROD_UPLOAD_ENDPOINT || (currentProjectEndpoint && url.href === currentProjectEndpoint)) return candidate;
    const localHost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    return url.protocol === "http:" && localHost && endpointPath.test(url.pathname)
      ? candidate
      : "";
  } catch {
    return "";
  }
}

export function resolveVisitUploadEndpoint(env = {}) {
  const projectId = env?.VITE_FIREBASE_PROJECT_ID;
  return validateVisitUploadEndpoint(env?.VITE_VISIT_SUBMISSION_UPLOAD_ENDPOINT, projectId)
    || buildVisitUploadEndpoint(projectId);
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
