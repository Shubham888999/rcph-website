import { MOM_TARGET_TYPES, normalizeMomEmailHistory, normalizeMomMetadata } from "../mom/momModel.js";

const EVENT_KINDS = new Set(["clubEvent", "bodMeeting", "districtEvent"]);
const RCPH_ROLES = new Set(["host", "cohost", "collaborator", "participant"]);
const REPORT_FINANCE_TYPES = new Set(["income", "expense"]);
export const BOD_MEETING_AVENUE = "BOD";
export const BOD_SERVICE_AVENUES = ["ISD", "CMD", "CSD", "PDD", "RRRO", "PRO", "DEI", "CWD", "SPORTS", "FINANCE", "GBM"];
export const BOD_AVENUES = [...BOD_SERVICE_AVENUES, BOD_MEETING_AVENUE];
const BOD_AVENUE_LABELS = Object.freeze({
  SPORTS: "Sports",
  FINANCE: "Finance",
  [BOD_MEETING_AVENUE]: "Board of Directors",
});
export const BOD_AVENUE_OPTIONS = [
  ...BOD_SERVICE_AVENUES.map((code) => ({ code, label: BOD_AVENUE_LABELS[code] || code })),
  { code: BOD_MEETING_AVENUE, label: BOD_AVENUE_LABELS[BOD_MEETING_AVENUE] },
];
export const BOD_EVENT_SOURCE = "bodEventManager";
export const BOD_EVENT_DESCRIPTION_LIMIT = 2500;
export const BOD_REPORT_FINANCE_DESCRIPTION_LIMIT = 240;
export const BOD_REPORT_FINANCE_MAX_AMOUNT = 1000000;
export const BOD_REPORT_FINANCE_MAX_ROWS = 20;
export const AVENUE_REPORTING_LOCK_TYPE = "avenue_reporting";
export const AVENUE_REPORTING_LOCK_REASON = "reporting_window_expired";
export const AVENUE_REPORTING_LOCK_HELP_TEXT = "Locked due to missed reporting window. Ask President/Admin to unlock.";
const BOD_AVENUE_SET = new Set(BOD_AVENUES);
const RESERVED_DESCRIPTION_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function cleanString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function cleanStrings(value, { upper = false } = {}) {
  const source = Array.isArray(value) ? value : (typeof value === "string" ? [value] : []);
  return [...new Set(source.map((item) => cleanString(item)).filter(Boolean)
    .map((item) => upper ? item.toUpperCase() : item))];
}

function cleanLower(value, max = 120) {
  return cleanString(value).toLowerCase().slice(0, max);
}

function safeReportingWindowId(value) {
  const id = cleanString(value).slice(0, 128);
  return id && !id.includes("/") ? id : "";
}

function safeLockIdSegment(value) {
  return cleanString(value, "window")
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120) || "window";
}

export function normalizeAvenueReportingLock(id, raw) {
  if (!raw || typeof raw !== "object" || raw.locked !== true) return null;
  if (cleanString(raw.type) !== AVENUE_REPORTING_LOCK_TYPE) return null;
  if (cleanLower(raw.status, 40) !== "active") return null;
  const reason = cleanString(raw.reason, AVENUE_REPORTING_LOCK_REASON);
  if (reason && reason !== AVENUE_REPORTING_LOCK_REASON) return null;
  const [avenue] = normalizeBodAvenues([raw.avenue]);
  if (!avenue) return null;
  const lockId = cleanString(id || raw.lockId || raw.id);
  const reportingWindowId = safeReportingWindowId(raw.reportingWindowId || raw.reminderId);
  return {
    id: lockId || `avenueReporting_${safeLockIdSegment(reportingWindowId || avenue)}`,
    lockId,
    avenue,
    avenueLabel: cleanString(raw.avenueLabel, avenue),
    reportingWindowId,
    reminderId: cleanString(raw.reminderId || raw.reportingWindowId),
    reason,
    targetName: cleanString(raw.targetName || raw.eventName || raw.name, ""),
    conductedDate: cleanString(raw.conductedDate || raw.eventConductedDate || raw.targetDate, ""),
    lockedAt: timestampToIso(raw.lockedAt || raw.createdAt || raw.updatedAt),
    updatedAt: timestampToIso(raw.updatedAt),
  };
}

export function getLockedBodAvenues(avenues, locks = []) {
  const selected = normalizeBodAvenues(avenues);
  const locked = new Set((Array.isArray(locks) ? locks : [])
    .map((lock) => cleanString(lock?.avenue).toUpperCase())
    .filter((code) => BOD_AVENUE_SET.has(code)));
  return selected.filter((code) => locked.has(code));
}

function formatAvenueList(codes) {
  const values = [...new Set((Array.isArray(codes) ? codes : []).map((code) => cleanString(code)).filter(Boolean))];
  if (values.length <= 1) return values[0] || "Selected avenue";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

export function lockedAvenueMessage(codes) {
  const values = [...new Set((Array.isArray(codes) ? codes : []).map((code) => cleanString(code)).filter(Boolean))];
  const subject = formatAvenueList(values);
  return `${subject} ${values.length === 1 ? "is" : "are"} locked due to missed reporting window. Ask President or Admin to unlock.`;
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function normalizeBodAvenues(value) {
  const selected = new Set(cleanStrings(value, { upper: true }).filter((code) => BOD_AVENUE_SET.has(code)));
  return BOD_AVENUES.filter((code) => selected.has(code));
}

export function isBodMeetingAvenueSelection(value) {
  const selected = normalizeBodAvenues(value);
  return selected.length === 1 && selected[0] === BOD_MEETING_AVENUE;
}

export function normalizeAvenueDescriptions(value, avenues = []) {
  const selected = normalizeBodAvenues(avenues).filter((code) => code !== BOD_MEETING_AVENUE);
  if (!isPlainObject(value)) return {};
  return Object.fromEntries(selected.map((code) => [
    code,
    cleanString(value[code]).slice(0, BOD_EVENT_DESCRIPTION_LIMIT),
  ]).filter(([, description]) => description));
}

export function buildAvenueDescriptionDraft(event = {}, avenues = event?.avenues ?? event?.avenue, options = {}) {
  const selected = normalizeBodAvenues(avenues).filter((code) => code !== BOD_MEETING_AVENUE);
  const existing = normalizeAvenueDescriptions(event?.avenueDescriptions, selected);
  const fallback = cleanString(event?.description || event?.desc).slice(0, BOD_EVENT_DESCRIPTION_LIMIT);
  const allowedMissing = new Set(allowedMissingAvenuesForReportingContext(options, event));
  return Object.fromEntries(selected.map((code) => [
    code,
    existing[code] || (allowedMissing.has(code) ? "" : fallback),
  ]));
}

export function getEventDescriptionForAvenue(event, avenueCode) {
  const [code] = normalizeBodAvenues([avenueCode]);
  const description = code ? normalizeAvenueDescriptions(event?.avenueDescriptions, [code])[code] : "";
  return description || cleanString(event?.description || event?.desc).slice(0, BOD_EVENT_DESCRIPTION_LIMIT) || "Not available";
}

function allowedMissingAvenuesForReportingContext(context = {}, draft = context) {
  const reportingWindowId = safeReportingWindowId(context.reportingWindowId || draft?.reportingWindowId);
  if (!reportingWindowId) return [];
  const source = context.allowedMissingAvenues
    ?? context.requiredReportingAvenues
    ?? draft?.allowedMissingAvenues
    ?? draft?.requiredReportingAvenues
    ?? [];
  return normalizeBodAvenues(source).filter((code) => code !== BOD_MEETING_AVENUE && code !== "GBM");
}

function reportingValidationContext(options = {}, draft = {}) {
  const reportingWindowId = safeReportingWindowId(options.reportingWindowId || draft?.reportingWindowId);
  return {
    reportingWindowId,
    allowedMissingAvenues: reportingWindowId ? allowedMissingAvenuesForReportingContext(options, draft) : [],
  };
}

export function validateAvenueDescriptionCoverage(avenues, avenueDescriptions, options = {}) {
  const selected = normalizeBodAvenues(avenues);
  const errors = [];
  const invalidKeys = [];
  const extraKeys = [];
  const missing = [];
  if (isBodMeetingAvenueSelection(selected)) {
    return { ok: true, errors, selected, invalidKeys, extraKeys, missing, descriptions: {} };
  }
  const reportableSelected = selected.filter((code) => code !== BOD_MEETING_AVENUE);
  if (!selected.length) errors.push("Select at least one avenue.");
  if (selected.includes(BOD_MEETING_AVENUE)) errors.push("Board of Directors meetings cannot be combined with service avenues.");
  if (!isPlainObject(avenueDescriptions)) {
    errors.push("Avenue descriptions must be a plain object.");
    return { ok: false, errors, selected, invalidKeys, extraKeys, missing, descriptions: {} };
  }
  const selectedSet = new Set(reportableSelected);
  const allowedMissing = new Set(allowedMissingAvenuesForReportingContext(options));
  Object.keys(avenueDescriptions).forEach((key) => {
    const code = cleanString(key).toUpperCase();
    if (RESERVED_DESCRIPTION_KEYS.has(key) || !BOD_AVENUE_SET.has(code)) invalidKeys.push(key);
    else if (!selectedSet.has(code)) extraKeys.push(key);
  });
  const descriptions = normalizeAvenueDescriptions(avenueDescriptions, reportableSelected);
  reportableSelected.forEach((code) => {
    if (!descriptions[code] && !allowedMissing.has(code)) missing.push(code);
  });
  if (invalidKeys.length) errors.push("Avenue descriptions include invalid keys.");
  if (extraKeys.length) errors.push("Remove descriptions for unselected avenues.");
  if (missing.length) errors.push("Add a report description for every selected avenue.");
  return { ok: errors.length === 0, errors, selected, invalidKeys, extraKeys, missing, descriptions };
}

export function isValidDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const [year, month, day] = value.split("-").map(Number);
  const candidate = new Date(year, month - 1, day);
  return candidate.getFullYear() === year && candidate.getMonth() === month - 1 && candidate.getDate() === day;
}

export function isValidEventTime(value) {
  return value === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function safeExternalUrl(value) {
  const candidate = cleanString(value);
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
}

export function getDriveFileId(value) {
  const candidate = safeExternalUrl(value);
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    if (url.hostname !== "drive.google.com") return "";
    const pathMatch = url.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    const queryId = url.searchParams.get("id");
    const fileId = pathMatch?.[1] || (/^[a-zA-Z0-9_-]+$/.test(queryId || "") ? queryId : "");
    return fileId;
  } catch {
    return "";
  }
}

export function getDriveThumbnailUrl(value) {
  const fileId = getDriveFileId(value);
  return fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000` : "";
}

export function getBodEventAttachments(event) {
  const imageUrls = new Set([
    safeExternalUrl(event?.previewLink),
    ...(Array.isArray(event?.imageLinks) ? event.imageLinks.map(safeExternalUrl) : []),
  ].filter(Boolean));
  const merged = [
    event?.previewLink,
    ...(Array.isArray(event?.imageLinks) ? event.imageLinks : []),
    ...(Array.isArray(event?.driveLinks) ? event.driveLinks : []),
  ].map(safeExternalUrl).filter(Boolean);

  return [...new Set(merged)].map((url, index) => {
    const image = imageUrls.has(url);
    const driveThumbnail = image ? getDriveThumbnailUrl(url) : "";
    return {
      url,
      image,
      thumbnailUrl: image ? (driveThumbnail || url) : "",
      label: image ? `Event image ${index + 1}` : `Event file ${index + 1}`,
    };
  });
}

function timestampToIso(value) {
  try {
    const date = typeof value?.toDate === "function" ? value.toDate() : value instanceof Date ? value : null;
    return date && !Number.isNaN(date.getTime()) ? date.toISOString() : "";
  } catch {
    return "";
  }
}

function normalizeCollaborators(value) {
  if (!Array.isArray(value)) return [];
  const names = value.map((entry) => cleanString(typeof entry === "string" ? entry : entry?.name)).filter(Boolean);
  return [...new Set(names)].map((name) => ({ name }));
}

function normalizeReportFinanceAmount(value) {
  const amount = typeof value === "number" ? value : Number(cleanString(value));
  if (!Number.isFinite(amount) || amount <= 0 || amount > BOD_REPORT_FINANCE_MAX_AMOUNT) return null;
  return Math.round(amount * 100) / 100;
}

function normalizeReportFinanceEntry(entry) {
  if (!isPlainObject(entry)) return null;
  const type = cleanString(entry.type).toLowerCase();
  const amount = normalizeReportFinanceAmount(entry.amount);
  const description = cleanString(entry.description).replace(/\s+/g, " ").slice(0, BOD_REPORT_FINANCE_DESCRIPTION_LIMIT);
  if (!REPORT_FINANCE_TYPES.has(type) || amount === null || !description) return null;
  return { type, amount, description };
}

export function normalizeBodReportFinance(value) {
  if (!isPlainObject(value) || value.hasFinance !== true) return { hasFinance: false, entries: [] };
  const entries = (Array.isArray(value.entries) ? value.entries : [])
    .map(normalizeReportFinanceEntry)
    .filter(Boolean)
    .slice(0, BOD_REPORT_FINANCE_MAX_ROWS);
  return { hasFinance: entries.length > 0, entries };
}

export function validateBodReportFinanceDraft(value) {
  if (!isPlainObject(value) || value.hasFinance !== true) return "";
  if (!Array.isArray(value.entries)) return "Report finance entries must be rows.";
  if (value.entries.length < 1) return "Add at least one report finance row or uncheck the finance option.";
  if (value.entries.length > BOD_REPORT_FINANCE_MAX_ROWS) return `Use no more than ${BOD_REPORT_FINANCE_MAX_ROWS} report finance rows.`;

  for (let index = 0; index < value.entries.length; index += 1) {
    const entry = value.entries[index];
    if (!isPlainObject(entry)) return `Report finance row ${index + 1} is invalid.`;
    const type = cleanString(entry.type).toLowerCase();
    if (!REPORT_FINANCE_TYPES.has(type)) return `Choose income or expense for report finance row ${index + 1}.`;
    if (entry.amount === undefined || entry.amount === null || (typeof entry.amount === "string" && entry.amount.trim() === "")) {
      return `Enter an amount for report finance row ${index + 1}.`;
    }
    const amount = normalizeReportFinanceAmount(entry.amount);
    if (amount === null) return `Enter a positive amount up to ${BOD_REPORT_FINANCE_MAX_AMOUNT} for report finance row ${index + 1}.`;
    if (!cleanString(entry.description)) return `Enter a description for report finance row ${index + 1}.`;
    if (cleanString(entry.description).length > BOD_REPORT_FINANCE_DESCRIPTION_LIMIT) return `Report finance descriptions must be ${BOD_REPORT_FINANCE_DESCRIPTION_LIMIT} characters or fewer.`;
  }
  return "";
}

export function normalizeBodEvent(id, raw) {
  if (!raw || typeof raw !== "object") return null;
  const eventId = cleanString(id);
  const name = cleanString(raw.name);
  const startDate = cleanString(raw.eventStart || raw.date);
  if (!eventId || !name || !isValidDateOnly(startDate)) return null;

  const candidateEnd = cleanString(raw.eventEnd || raw.endDate);
  const endDate = candidateEnd && isValidDateOnly(candidateEnd) && candidateEnd >= startDate ? candidateEnd : "";
  const rawType = cleanString(raw.type);
  const recordKind = EVENT_KINDS.has(rawType) ? rawType : "unknown";
  const archived = raw.archived === true;
  const status = cleanString(raw.status).toLowerCase();
  const isActive = !archived && status !== "deleted";
  const syncedEventId = cleanString(raw.syncedEventId);
  const syncedMeetingId = cleanString(raw.syncedMeetingId);
  const bodMeetingId = cleanString(raw.bodMeetingId || raw.syncedMeetingId);
  const syncedDistrictEventId = cleanString(raw.syncedDistrictEventId);
  const reportingWindowId = cleanString(raw.reportingWindowId || raw.reminderId);
  const rcphRole = cleanString(raw.rcphRole).toLowerCase();
  const timeCandidate = cleanString(raw.eventTime || raw.time);

  const avenues = normalizeBodAvenues(raw.avenues ?? raw.avenue);

  return {
    id: eventId,
    name,
    description: cleanString(raw.description || raw.desc).slice(0, BOD_EVENT_DESCRIPTION_LIMIT),
    avenueDescriptions: normalizeAvenueDescriptions(raw.avenueDescriptions, avenues),
    conductedBy: cleanString(
  raw.conductedBy,
),
    createdBy: cleanString(raw.createdBy),
    createdByName: cleanString(raw.createdByName, "Unavailable"),
    createdAt: timestampToIso(raw.createdAt),
    startDate,
    endDate,
    time: isValidEventTime(timeCandidate) ? timeCandidate : "",
    type: rawType,
    source: cleanString(raw.source),
    visibility: cleanString(raw.visibility, "public").toLowerCase(),
    archived,
    status,
    avenues,
    rcphRole: RCPH_ROLES.has(rcphRole) ? rcphRole : "host",
    hostClub: cleanString(raw.hostClub, "Rotaract Club of Pune Heritage"),
    collaborators: normalizeCollaborators(raw.collaborators),
    collaboratorsKnown: Array.isArray(raw.collaborators),
    collaborationNotes: cleanString(raw.collaborationNotes),
    reportFinance: normalizeBodReportFinance(raw.reportFinance),
    driveFolder: safeExternalUrl(raw.driveFolder),
    driveFolderId: cleanString(raw.driveFolderId),
    previewLink: safeExternalUrl(raw.previewLink),
    imageLinks: cleanStrings(raw.imageLinks).map(safeExternalUrl).filter(Boolean),
    driveLinks: cleanStrings(raw.driveLinks).map(safeExternalUrl).filter(Boolean),
    uploadedFileUrls: cleanStrings(raw.uploadedFileUrls).map(safeExternalUrl).filter(Boolean),
    mom: normalizeMomMetadata(raw, {
      momTargetType: MOM_TARGET_TYPES.BOD_EVENT,
      momTargetId: eventId,
    }),
    momEmail: normalizeMomEmailHistory(raw.momEmail || raw),
    syncedEventId,
    syncedMeetingId,
    bodMeetingId,
    syncedDistrictEventId,
    reportingWindowId,
    isSynced: Boolean(syncedEventId || syncedMeetingId || syncedDistrictEventId || status === "synced"),
    recordKind,
    isActive,
    canEdit: isActive && (recordKind === "clubEvent" || recordKind === "bodMeeting"),
    canArchive: isActive && (recordKind === "clubEvent" || recordKind === "bodMeeting"),
  };
}

export function getBodEventPermissions(event, access, lockState = "unlocked") {
  const canMutate = access?.canAccessBodTools === true
    && (lockState === "unlocked" || (lockState === "locked" && access?.canAccessPresidentControls === true));
  return {
    canEdit: Boolean(event?.canEdit && canMutate),
    canArchive: Boolean(event?.canArchive && canMutate),
    canSync: Boolean(event?.isActive && event.recordKind === "clubEvent" && !event.isSynced
      && access?.canAccessAdminTools === true && canMutate),
  };
}

export function validateBodEventDraft(draft, options = {}) {
  const errors = {};
  const avenues = normalizeBodAvenues(draft?.avenues);
  const reportingContext = reportingValidationContext(options, draft);
  const isBodMeeting = isBodMeetingAvenueSelection(avenues);
  if (!cleanString(draft?.name)) errors.name = isBodMeeting ? "Meeting name is required." : "Event name is required.";
  const startDate = cleanString(draft?.startDate);
  const endDate = cleanString(draft?.endDate);
  if (!isValidDateOnly(startDate)) errors.startDate = isBodMeeting ? "Enter a valid meeting date." : "Enter a valid start date.";
  if (!isBodMeeting && endDate && !isValidDateOnly(endDate)) errors.endDate = "Enter a valid end date.";
  else if (!isBodMeeting && startDate && endDate && endDate < startDate) errors.endDate = "End date cannot be before start date.";
  if (!isValidEventTime(cleanString(draft?.time))) errors.time = "Enter a valid time in HH:MM format.";
  if (!avenues.length) errors.avenues = "Select at least one avenue.";
  else if (avenues.includes(BOD_MEETING_AVENUE) && !isBodMeeting) {
    errors.avenues = "Board of Directors meetings cannot be combined with service avenues.";
  }
  if (!isBodMeeting) {
    const lockedAvenues = getLockedBodAvenues(avenues, options.lockedAvenueReportingLocks);
    if (avenues.length && lockedAvenues.length) errors.avenues = lockedAvenueMessage(lockedAvenues);
    const coverage = validateAvenueDescriptionCoverage(
      avenues,
      draft?.avenueDescriptions == null
        ? buildAvenueDescriptionDraft(draft, avenues, reportingContext)
        : draft.avenueDescriptions,
      reportingContext,
    );
    if (avenues.length && !coverage.ok) errors.avenueDescriptions = coverage.errors.at(-1);
    const reportFinanceError = validateBodReportFinanceDraft(draft?.reportFinance);
    if (reportFinanceError) errors.reportFinance = reportFinanceError;
  }
  return errors;
}

export function buildBodEventPayload(draft, eventId = "", options = {}) {
  const errors = validateBodEventDraft(draft, options);
  if (Object.keys(errors).length) return { payload: null, errors };
  const avenues = normalizeBodAvenues(draft.avenues).slice(0, 12);
  const description = cleanString(draft.description).slice(0, BOD_EVENT_DESCRIPTION_LIMIT);
  const reportingContext = reportingValidationContext(options, draft);
  if (isBodMeetingAvenueSelection(avenues)) {
    const meetingDate = cleanString(draft.startDate);
    const payload = {
      name: cleanString(draft.name).slice(0, 180),
      date: meetingDate,
      endDate: meetingDate,
      time: cleanString(draft.time).slice(0, 20),
      desc: description,
      description,
      avenue: [BOD_MEETING_AVENUE],
      avenues: [BOD_MEETING_AVENUE],
      source: BOD_EVENT_SOURCE,
      type: "bodMeeting",
      visibility: "internal",
    };
    if (eventId) payload.eventId = cleanString(eventId);
    if (reportingContext.reportingWindowId) payload.reportingWindowId = reportingContext.reportingWindowId;
    return { payload, errors: {} };
  }
  const avenueDescriptionDraft = draft.avenueDescriptions == null
    ? buildAvenueDescriptionDraft(draft, avenues, reportingContext)
    : draft.avenueDescriptions;
  const coverage = validateAvenueDescriptionCoverage(avenues, avenueDescriptionDraft, reportingContext);
  if (!coverage.ok) return { payload: null, errors: { ...errors, avenueDescriptions: coverage.errors.at(-1) } };
  const payload = {
    name: cleanString(draft.name).slice(0, 180),
    conductedBy: cleanString(draft.conductedBy).slice(0, 140),
    date: cleanString(draft.startDate),
    endDate: cleanString(draft.endDate) || cleanString(draft.startDate),
    time: cleanString(draft.time).slice(0, 20),
    desc: description,
    description,
    avenue: avenues,
    avenues,
    avenueDescriptions: coverage.descriptions,
    source: BOD_EVENT_SOURCE,
    type: "clubEvent",
    visibility: "public",
    rcphRole: RCPH_ROLES.has(cleanString(draft.rcphRole).toLowerCase()) ? cleanString(draft.rcphRole).toLowerCase() : "host",
    hostClub: cleanString(draft.hostClub, "Rotaract Club of Pune Heritage").replace(/\s+/g, " ").slice(0, 180),
    collaborators: normalizeCollaborators(draft.collaborators).slice(0, 30),
    collaborationNotes: cleanString(draft.collaborationNotes).slice(0, 1000),
    reportFinance: normalizeBodReportFinance(draft.reportFinance),
    driveFolder: safeExternalUrl(draft.driveFolder),
  };
  if (eventId) payload.eventId = cleanString(eventId);
  if (reportingContext.reportingWindowId) payload.reportingWindowId = reportingContext.reportingWindowId;
  return { payload, errors: {} };
}

export function filterBodEvents(events, filters, currentUid = "") {
  const query = cleanString(filters?.search).toLowerCase();
  return events.filter((event) => {
    if (filters?.status === "active" && !event.isActive) return false;
    if (filters?.status === "archived" && event.isActive) return false;
    if (filters?.type && event.recordKind !== filters.type) return false;
    if (filters?.avenue && !event.avenues.includes(filters.avenue)) return false;
    if (filters?.month && !event.startDate.startsWith(filters.month)) return false;
    if (filters?.mine && event.createdBy !== currentUid) return false;
    if (query) {
      const haystack = [event.name, event.description, event.conductedBy, event.hostClub,
        ...event.collaborators.map((item) => item.name)].join(" ").toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}
