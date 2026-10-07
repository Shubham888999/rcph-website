import { POSITION_CATALOG } from "../shared/positionCatalog.js";
import { joinVisitHolderNames } from "../../visits/visitHolderModel.js";

const POSITION_BY_KEY = new Map(POSITION_CATALOG.map((position) => [position.key, position]));

const AVENUE_DIRECTOR_ORDER = Object.freeze([
  "csd", "co-csd",
  "cmd", "co-cmd",
  "isd", "co-isd",
  "pdd", "co-pdd",
]);
const AVENUE_DIRECTOR_KEYS = new Set(AVENUE_DIRECTOR_ORDER);

const GROUP_DETAILS = Object.freeze({
  core: Object.freeze({
    key: "core",
    label: "Core Board",
    description: "Core Committee and Administration folders.",
    rank: 10,
  }),
  avenues: Object.freeze({
    key: "avenues",
    label: "Avenue Directors",
    description: "Avenue Directors folders.",
    rank: 20,
  }),
  officers: Object.freeze({
    key: "officers",
    label: "Directors and Officers",
    description: "Directors and Officers folders.",
    rank: 30,
  }),
  co: Object.freeze({
    key: "co",
    label: "Co-Positions",
    description: "Co-director and co-office folders authorized for this visit.",
    rank: 40,
  }),
  other: Object.freeze({
    key: "other",
    label: "Other Authorized Folders",
    description: "Additional backend-authorized folders for this visit.",
    rank: 90,
  }),
});

function clean(value, max = 255) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function titleFromKey(value) {
  const key = clean(value, 80);
  if (!key) return "";
  return key
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getVisitFolderCode(folder = {}) {
  const catalog = POSITION_BY_KEY.get(clean(folder.positionKey, 80));
  return clean(folder.avenueCode, 40) || catalog?.avenueCode || clean(folder.positionKey, 80).toUpperCase();
}

export function getVisitFolderGroup(folder = {}) {
  const positionKey = clean(folder.positionKey, 80);
  const catalog = POSITION_BY_KEY.get(positionKey);
  if (!catalog) return GROUP_DETAILS.other;
  if (AVENUE_DIRECTOR_KEYS.has(catalog.key)) return GROUP_DETAILS.avenues;
  if (catalog.group === "co-admin" || catalog.group === "co-bod") return GROUP_DETAILS.co;
  if (catalog.group === "admin") return GROUP_DETAILS.core;
  if (catalog.group === "bod") return GROUP_DETAILS.officers;
  return GROUP_DETAILS.other;
}

export function getVisitFolderPresentation(folder = {}) {
  const positionKey = clean(folder.positionKey, 80);
  const catalog = POSITION_BY_KEY.get(positionKey);
  const group = getVisitFolderGroup(folder);
  return {
    code: getVisitFolderCode(folder),
    groupKey: group.key,
    groupLabel: group.label,
    groupDescription: group.description,
    groupRank: group.rank,
    positionKey,
    sortOrder: AVENUE_DIRECTOR_KEYS.has(positionKey)
      ? AVENUE_DIRECTOR_ORDER.indexOf(positionKey)
      : Number.isFinite(Number(catalog?.sortOrder)) ? Number(catalog.sortOrder) : 1000,
    title: clean(folder.positionTitle, 180) || catalog?.displayTitle || titleFromKey(positionKey) || "Visit folder",
  };
}

export function getVisitFolderGroupRank(groupKey) {
  return Object.values(GROUP_DETAILS).find((group) => group.key === groupKey)?.rank ?? GROUP_DETAILS.other.rank;
}

// The one folder order shared by the admin folders page and the district
// dashboard: group rank (Core Board, Avenue Directors, Directors and Officers,
// Co-Positions), then AVENUE_DIRECTOR_ORDER / catalog sortOrder, then title.
export function compareVisitFolderOrder(left = {}, right = {}) {
  const a = left.presentation || getVisitFolderPresentation(left);
  const b = right.presentation || getVisitFolderPresentation(right);
  return a.groupRank - b.groupRank
    || a.groupLabel.localeCompare(b.groupLabel)
    || a.sortOrder - b.sortOrder
    || a.title.localeCompare(b.title)
    || a.positionKey.localeCompare(b.positionKey);
}

export function groupVisitFolders(folders = []) {
  const groups = new Map();
  for (const folder of Array.isArray(folders) ? folders : []) {
    const presentation = getVisitFolderPresentation(folder);
    const current = groups.get(presentation.groupKey) || {
      key: presentation.groupKey,
      label: presentation.groupLabel,
      description: presentation.groupDescription,
      rank: presentation.groupRank,
      folders: [],
    };
    current.folders.push({ ...folder, presentation });
    groups.set(presentation.groupKey, current);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      folders: group.folders.sort(compareVisitFolderOrder),
    }))
    .sort((left, right) => left.rank - right.rank || left.label.localeCompare(right.label));
}

export function getVisitAvailability(folder = {}, visit = {}) {
  if (visit.enabled === false || folder.enabled === false) {
    return { key: "disabled", label: "Disabled", detail: "Not accepting submissions" };
  }
  if (folder.locked === true) {
    return { key: "locked", label: "Locked", detail: clean(folder.lockReason, 160) || "Folder locked" };
  }
  if (visit.submissionOpen === false || folder.submissionOpen === false) {
    return { key: "closed", label: "Closed", detail: "Submissions closed" };
  }
  return { key: "open", label: "Open", detail: "Ready for documents" };
}

export function summarizeVisitFolderGroup(folders = [], visit = {}) {
  const list = Array.isArray(folders) ? folders : [];
  return {
    total: list.length,
    open: list.filter((folder) => getVisitAvailability(folder, visit).key === "open").length,
    files: list.reduce((sum, folder) => sum + Math.max(0, Number(folder.activeFileCount) || 0), 0),
  };
}

export function filterVisitFolders(folders = [], filter = "all", visit = {}) {
  const list = Array.isArray(folders) ? folders : [];
  if (filter === "open") return list.filter((folder) => getVisitAvailability(folder, visit).key === "open");
  if (filter === "files") return list.filter((folder) => (Number(folder.activeFileCount) || 0) > 0);
  return list;
}

export function getVisitStatus(visit = {}) {
  if (visit.enabled === false) return { key: "disabled", label: "Disabled" };
  if (visit.submissionOpen === false) return { key: "closed", label: "Submissions closed" };
  return { key: "open", label: "Open" };
}

export function getVisitFolderChips(folder = {}, visit = {}) {
  const availability = getVisitAvailability(folder, visit);
  const activeCount = Math.max(0, Number(folder.activeFileCount) || 0);
  const chips = [availability];
  chips.push(activeCount ? { key: "documents", label: "Documents uploaded" } : { key: "empty", label: "Empty" });
  if (clean(folder.primaryPresentationSubmissionId, 128)) {
    chips.push({ key: "primary", label: "Main presentation set" });
  }
  return chips;
}

export function getVisitSummaryItems(visit = {}) {
  const status = getVisitStatus(visit);
  return [
    { label: "Status", value: status.label, statusKey: status.key },
    { label: "Visit date", value: clean(visit.visitDate, 80) || "Not scheduled" },
    { label: "Deadline", value: clean(visit.submissionDeadline, 80) || "Not set" },
    { label: "Folders", value: String(Math.max(0, Number(visit.accessiblePositionCount) || 0)) },
    { label: "Active files", value: String(Math.max(0, Number(visit.activeSubmissionCount) || 0)) },
  ];
}

export function getFolderSummaryItems(folder = {}, visit = {}) {
  const availability = getVisitAvailability(folder, visit);
  return [
    { label: "Status", value: availability.label, statusKey: availability.key },
    { label: "Documents", value: `${Math.max(0, Number(folder.activeFileCount) || 0)} / ${Math.max(1, Number(folder.maxActiveFiles) || 1)}` },
    { label: "Per selection", value: String(Math.max(1, Number(folder.maxFilesPerSelection) || 1)) },
    { label: "Size limit", value: `${Math.round(Math.max(1, Number(folder.maxFileSizeBytes) || 1) / 1048576)} MB` },
  ];
}

export function getVisitFileKind(value = {}) {
  const mimeType = clean(value.mimeType || value.type, 160).toLowerCase();
  const fileName = clean(value.fileName || value.name, 255).toLowerCase();
  if (mimeType.includes("pdf") || fileName.endsWith(".pdf")) return { key: "pdf", label: "PDF", code: "PDF" };
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint") || /\.(ppt|pptx)$/.test(fileName)) {
    return { key: "presentation", label: "PowerPoint", code: "PPT" };
  }
  if (mimeType.includes("word") || /\.(doc|docx)$/.test(fileName)) return { key: "word", label: "Word", code: "DOC" };
  if (mimeType.includes("sheet") || mimeType.includes("excel") || /\.(xls|xlsx|csv)$/.test(fileName)) {
    return { key: "spreadsheet", label: "Spreadsheet", code: "XLS" };
  }
  if (mimeType.startsWith("image/") || /\.(jpg|jpeg|png|webp)$/.test(fileName)) return { key: "image", label: "Image", code: "IMG" };
  if (mimeType.startsWith("text/") || fileName.endsWith(".txt")) return { key: "text", label: "Text", code: "TXT" };
  return { key: "other", label: "Drive file", code: "DOC" };
}

export const VISIT_SHOW_UNASSIGNED_STORAGE_KEY = "rcph.visitFolders.showUnassigned";

function folderHolders(folder = {}) {
  return Array.isArray(folder.holders) ? folder.holders.filter((holder) => clean(holder?.displayName, 120)) : [];
}

function folderFileCount(folder = {}) {
  return Math.max(0, Number(folder.activeFileCount) || 0);
}

export function isVisitFolderAssigned(folder = {}) {
  return folderHolders(folder).length > 0;
}

export function getVisitFolderHolderLabel(folder = {}) {
  const holders = folderHolders(folder);
  return {
    vacant: holders.length === 0,
    label: holders.length ? joinVisitHolderNames(holders) : "Vacant",
    showNoFilesTag: holders.length > 0 && folderFileCount(folder) === 0,
  };
}

export function filterVisitFoldersByAssignment(folders = [], showUnassigned = false) {
  const list = Array.isArray(folders) ? folders : [];
  return showUnassigned ? list : list.filter(isVisitFolderAssigned);
}

export function summarizeUnassignedVisitFolders(folders = []) {
  const vacant = (Array.isArray(folders) ? folders : []).filter((folder) => !isVisitFolderAssigned(folder));
  return {
    total: vacant.length,
    withFiles: vacant.filter((folder) => folderFileCount(folder) > 0).length,
  };
}

export function getShowUnassignedLabel(folders = []) {
  const summary = summarizeUnassignedVisitFolders(folders);
  return `Show unassigned folders (${summary.total})${summary.withFiles ? ` · ${summary.withFiles} with files` : ""}`;
}

export function getVisitReadiness(folders = []) {
  const assigned = (Array.isArray(folders) ? folders : []).filter(isVisitFolderAssigned);
  const withDocuments = assigned.filter((folder) => folderFileCount(folder) > 0).length;
  return {
    assigned: assigned.length,
    withDocuments,
    label: `${withDocuments} of ${assigned.length} active role${assigned.length === 1 ? "" : "s"} ${assigned.length === 1 ? "has" : "have"} documents`,
  };
}

export function readShowUnassignedPreference(storage) {
  try {
    return storage?.getItem(VISIT_SHOW_UNASSIGNED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeShowUnassignedPreference(storage, value) {
  try {
    storage?.setItem(VISIT_SHOW_UNASSIGNED_STORAGE_KEY, value ? "1" : "0");
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the toggle still works for this view.
  }
}
