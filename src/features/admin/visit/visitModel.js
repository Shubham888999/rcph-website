import { safeUrl, text } from "../shared/adminModel.js";
import { validateVisitUploadFile } from "./visitUploadModel.js";
import { normalizeVisitHolders } from "../../visits/visitHolderModel.js";

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
    primaryPresentationSubmissionId: text(value.primaryPresentationSubmissionId, 128),
    canOpen: value.canOpen === true,
    canUpload: value.canUpload === true,
    canManage: value.canManage === true,
    canSetPrimaryPresentation: value.canSetPrimaryPresentation === true,
    supportsDocumentCategories: value.supportsDocumentCategories === true,
    supportsCustomFolders: value.supportsCustomFolders === true,
    canManageCustomFolders: value.canManageCustomFolders === true,
    customFolders: normalizeCustomFolders(value.customFolders),
    holders: normalizeVisitHolders(value.holders),
  };
}

// Managers always; folder holders when the backend says their folder is writable for them.
export function canEditVisitPrimaryPresentation(access, folder) {
  return access?.canManage === true || folder?.canSetPrimaryPresentation === true;
}

export function normalizeFolders(values, visitType = "") {
  const expectedVisitType = VISIT_TYPES.includes(visitType) ? visitType : "";
  const folders = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const folder = normalizeFolder(value);
    if (!folder || (expectedVisitType && folder.visitType !== expectedVisitType)) continue;
    const key = `${folder.visitType}:${folder.positionKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    folders.push(folder);
  }
  return folders;
}
const VISIT_DOCUMENT_CATEGORY_KEYS = Object.freeze(["inward", "outward", "inward-register", "outward-register"]);
const CUSTOM_FOLDER_KEY = /^custom-[a-f0-9]{8}$/;
export const VISIT_MAX_CUSTOM_FOLDERS = 10;
export const VISIT_CUSTOM_FOLDER_NAME_MAX = 40;

export const VISIT_MAX_SUBFOLDERS = 10;
export const VISIT_MAX_TOTAL_FOLDERS = 40;

function normalizeCustomFolders(values) {
  return (Array.isArray(values) ? values : [])
    .filter((item) => item && CUSTOM_FOLDER_KEY.test(item.key) && text(item.name, 80))
    .map((item) => ({
      key: item.key,
      name: text(item.name, 80),
      parentKey: VISIT_DOCUMENT_CATEGORY_KEYS.includes(item.parentKey) || CUSTOM_FOLDER_KEY.test(item.parentKey || "") ? item.parentKey : "",
    }));
}

// Library groups in display order; "" is the uncategorised Supporting files group.
// Secretary folders: the letters themselves ("file") and their Excel registers.
export const VISIT_DOCUMENT_CATEGORIES = Object.freeze([
  Object.freeze({ key: "inward", label: "Inward file", moveLabel: "Move to Inward file", emptyNote: "No inward documents yet." }),
  Object.freeze({ key: "inward-register", label: "Inward register", moveLabel: "Move to Inward register", emptyNote: "No inward register yet." }),
  Object.freeze({ key: "outward", label: "Outward file", moveLabel: "Move to Outward file", emptyNote: "No outward documents yet." }),
  Object.freeze({ key: "outward-register", label: "Outward register", moveLabel: "Move to Outward register", emptyNote: "No outward register yet." }),
  Object.freeze({ key: "", label: "Supporting files", moveLabel: "Move to Supporting files", emptyNote: "No supporting files yet." }),
]);

export const VISIT_UPLOAD_CATEGORY_CHOICES = Object.freeze([
  Object.freeze({ key: "", label: "None" }),
  Object.freeze({ key: "inward", label: "Inward file" }),
  Object.freeze({ key: "inward-register", label: "Inward register" }),
  Object.freeze({ key: "outward", label: "Outward file" }),
  Object.freeze({ key: "outward-register", label: "Outward register" }),
]);

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
    folderUrl: safeUrl(value.folderUrl),
    uploadedByName: text(value.uploadedByName, 160),
    canReplace: value.canReplace === true,
    canWithdraw: value.canWithdraw === true,
    canRemove: value.canRemove === true,
    isPrimaryPresentation: value.isPrimaryPresentation === true,
    canSetPrimaryPresentation: value.canSetPrimaryPresentation === true,
    documentCategory: VISIT_DOCUMENT_CATEGORY_KEYS.includes(value.documentCategory) || CUSTOM_FOLDER_KEY.test(value.documentCategory || "") ? value.documentCategory : "",
    canMove: value.canMove === true,
  };
}

// The folders of one position: the four Secretary folders (Secretary positions only), then the
// extra folders added by the holder or a manager, each followed by its subfolders, then Supporting
// files. A subfolder's fullLabel reads "Parent > Child".
export function visitFolderCategories(folder) {
  const extras = folder?.customFolders || [];
  const subfoldersOf = (parentKey) => extras.filter((item) => item.parentKey === parentKey);
  const withSubfolders = (parent) => [
    { ...parent, fullLabel: parent.label, depth: 0, canHaveSubfolders: true, subfolderCount: subfoldersOf(parent.key).length },
    ...subfoldersOf(parent.key).map((item) => ({
      key: item.key,
      label: item.name,
      fullLabel: `${parent.label} \u203A ${item.name}`,
      moveLabel: `Move to ${parent.label} \u203A ${item.name}`,
      emptyNote: `No documents in ${item.name} yet.`,
      custom: true,
      depth: 1,
      parentKey: parent.key,
      canHaveSubfolders: false,
      subfolderCount: 0,
    })),
  ];
  const builtIn = folder?.supportsDocumentCategories === true
    ? VISIT_DOCUMENT_CATEGORIES.filter((category) => category.key).flatMap(withSubfolders)
    : [];
  const topLevel = extras.filter((item) => !item.parentKey).flatMap((item) => withSubfolders({
    key: item.key,
    label: item.name,
    moveLabel: `Move to ${item.name}`,
    emptyNote: `No documents in ${item.name} yet.`,
    custom: true,
  }));
  return [...builtIn, ...topLevel, VISIT_DOCUMENT_CATEGORIES.find((category) => category.key === "")];
}

export function visitTopLevelFolderCount(folder) {
  return (folder?.customFolders || []).filter((item) => !item.parentKey).length;
}

export function visitUploadChoices(folder) {
  return [
    { key: "", label: "None" },
    ...visitFolderCategories(folder).filter((category) => category.key).map(({ key, label, fullLabel }) => ({ key, label: fullLabel || label })),
  ];
}

// Folders are shown when the position has the Secretary folders or any extra folder.
export function visitFolderUsesCategories(folder) {
  return folder?.supportsDocumentCategories === true || (folder?.customFolders || []).length > 0;
}

export function groupVisitSubmissionsByCategory(submissions = [], folder = null) {
  const list = Array.isArray(submissions) ? submissions : [];
  return (folder ? visitFolderCategories(folder) : VISIT_DOCUMENT_CATEGORIES).map((category) => ({
    ...category,
    items: list.filter((item) => (item.documentCategory || "") === category.key),
  }));
}
export function validateVisitFile(file, folder) {
  return validateVisitUploadFile(file, folder?.maxFileSizeBytes);
}
