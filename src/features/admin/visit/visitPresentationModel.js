import { POSITION_CATALOG } from "../shared/positionCatalog.js";

const POSITION_BY_KEY = new Map(POSITION_CATALOG.map((position) => [position.key, position]));

const OFFICER_KEYS = new Set([
  "editor",
  "sports-representative",
  "wrwc",
  "wr",
  "saa",
]);

const GROUP_DETAILS = Object.freeze({
  core: Object.freeze({
    key: "core",
    label: "Core Board",
    description: "Executive office and club administration folders.",
    rank: 10,
  }),
  avenues: Object.freeze({
    key: "avenues",
    label: "Avenue Directors",
    description: "Director folders for avenue reporting and visit evidence.",
    rank: 20,
  }),
  officers: Object.freeze({
    key: "officers",
    label: "Representatives / Officers",
    description: "Representative and officer folders in the visit file room.",
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
  if (catalog.group === "co-admin" || catalog.group === "co-bod") return GROUP_DETAILS.co;
  if (catalog.group === "admin") return GROUP_DETAILS.core;
  if (OFFICER_KEYS.has(catalog.key)) return GROUP_DETAILS.officers;
  if (catalog.group === "bod") return GROUP_DETAILS.avenues;
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
    sortOrder: Number.isFinite(Number(catalog?.sortOrder)) ? Number(catalog.sortOrder) : 1000,
    title: clean(folder.positionTitle, 180) || catalog?.displayTitle || titleFromKey(positionKey) || "Visit folder",
  };
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
      folders: group.folders.sort((left, right) => (
        left.presentation.sortOrder - right.presentation.sortOrder
        || left.presentation.title.localeCompare(right.presentation.title)
      )),
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
