import { safeUrl, text } from "../shared/adminModel.js";

export const VISIT_TYPES = ["clubAssembly", "dzrVisit", "drrVisit"];
export const VISIT_STATUSES = ["active", "replaced", "admin-removed", "archived"];

function asDate(value) {
  try {
    const date = value?.toDate?.() || (value instanceof Date ? value : value ? new Date(value) : null);
    return date && !Number.isNaN(date.getTime()) ? date : null;
  } catch { return null; }
}
export function toDateTimeLocal(value) {
  const date = asDate(value);
  if (!date) return "";
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export function toCallableDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function normalizeVisit(value) {
  if (!value || !VISIT_TYPES.includes(value.visitType)) return null;
  return {
    visitType: value.visitType,
    displayTitle: text(value.displayTitle, 120) || value.visitType,
    description: text(value.description, 1000),
    enabled: value.enabled !== false,
    submissionOpen: value.submissionOpen !== false,
    visitDate: toDateTimeLocal(value.visitDate),
    submissionDeadline: toDateTimeLocal(value.submissionDeadline),
    accessiblePositionCount: Math.max(0, Number(value.accessiblePositionCount) || 0),
    activeSubmissionCount: Math.max(0, Number(value.activeSubmissionCount) || 0),
    lockedPositionCount: Math.max(0, Number(value.lockedPositionCount) || 0),
    instructions: text(value.instructions, 3000),
  };
}
export function normalizeFolder(value) {
  if (!value || !VISIT_TYPES.includes(value.visitType) || !text(value.positionKey, 80)) return null;
  return {
    visitType: value.visitType,
    positionKey: text(value.positionKey, 80),
    positionTitle: text(value.positionTitle, 180) || text(value.positionKey, 80),
    avenueCode: text(value.avenueCode, 40),
    enabled: value.enabled !== false,
    submissionOpen: value.submissionOpen !== false,
    locked: value.locked === true,
    lockReason: text(value.lockReason, 500),
    maxActiveFiles: Math.max(1, Number(value.maxActiveFiles) || 40),
    maxFilesPerSelection: Math.max(1, Number(value.maxFilesPerSelection) || 10),
    maxFileSizeBytes: Math.max(1, Number(value.maxFileSizeBytes) || 25 * 1024 * 1024),
    activeFileCount: Math.max(0, Number(value.activeFileCount) || 0),
    reservedFileCount: Math.max(0, Number(value.reservedFileCount) || 0),
    canOpen: value.canOpen === true,
    canUpload: value.canUpload === true,
    canManage: value.canManage === true,
  };
}
export function normalizeSubmission(value) {
  if (!value || !text(value.submissionId || value.id, 128)) return null;
  return {
    submissionId: text(value.submissionId || value.id, 128),
    visitType: text(value.visitType, 40),
    positionKey: text(value.positionKey, 80),
    fileName: text(value.fileName, 255) || "Unnamed file",
    mimeType: text(value.mimeType, 120),
    sizeBytes: Math.max(0, Number(value.sizeBytes) || 0),
    status: text(value.status, 40) || "active",
    fileUrl: safeUrl(value.fileUrl || value.webViewLink),
    uploadedByName: text(value.uploadedByName, 160),
    canReplace: value.canReplace === true,
    canWithdraw: value.canWithdraw === true,
    canRemove: value.canRemove === true,
  };
}
export function validateVisitFile(file, folder) {
  if (!file) return "Choose a file.";
  if (file.size <= 0 || file.size > folder.maxFileSizeBytes) return "File size is outside the permitted limit.";
  const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.openxmlformats-officedocument.presentationml.presentation"];
  return allowed.includes(file.type) ? "" : "This file type is not supported.";
}
