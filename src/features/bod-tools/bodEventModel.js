const EVENT_KINDS = new Set(["clubEvent", "bodMeeting", "districtEvent"]);
const RCPH_ROLES = new Set(["host", "cohost", "collaborator", "participant"]);
export const BOD_AVENUES = ["ISD", "CMD", "CSD", "PDD", "RRRO", "PRO", "DEI", "GBM"];
export const BOD_EVENT_SOURCE = "bodEventManager";
export const BOD_EVENT_DESCRIPTION_LIMIT = 2500;
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

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function normalizeBodAvenues(value) {
  const selected = new Set(cleanStrings(value, { upper: true }).filter((code) => BOD_AVENUE_SET.has(code)));
  return BOD_AVENUES.filter((code) => selected.has(code));
}

export function normalizeAvenueDescriptions(value, avenues = []) {
  const selected = normalizeBodAvenues(avenues);
  if (!isPlainObject(value)) return {};
  return Object.fromEntries(selected.map((code) => [
    code,
    cleanString(value[code]).slice(0, BOD_EVENT_DESCRIPTION_LIMIT),
  ]).filter(([, description]) => description));
}

export function buildAvenueDescriptionDraft(event = {}, avenues = event?.avenues ?? event?.avenue) {
  const selected = normalizeBodAvenues(avenues);
  const existing = normalizeAvenueDescriptions(event?.avenueDescriptions, selected);
  const fallback = cleanString(event?.description || event?.desc).slice(0, BOD_EVENT_DESCRIPTION_LIMIT);
  return Object.fromEntries(selected.map((code) => [code, existing[code] || fallback]));
}

export function getEventDescriptionForAvenue(event, avenueCode) {
  const [code] = normalizeBodAvenues([avenueCode]);
  const description = code ? normalizeAvenueDescriptions(event?.avenueDescriptions, [code])[code] : "";
  return description || cleanString(event?.description || event?.desc).slice(0, BOD_EVENT_DESCRIPTION_LIMIT) || "Not available";
}

export function validateAvenueDescriptionCoverage(avenues, avenueDescriptions) {
  const selected = normalizeBodAvenues(avenues);
  const errors = [];
  const invalidKeys = [];
  const extraKeys = [];
  const missing = [];
  if (!selected.length) errors.push("Select at least one avenue.");
  if (!isPlainObject(avenueDescriptions)) {
    errors.push("Avenue descriptions must be a plain object.");
    return { ok: false, errors, selected, invalidKeys, extraKeys, missing, descriptions: {} };
  }
  const selectedSet = new Set(selected);
  Object.keys(avenueDescriptions).forEach((key) => {
    const code = cleanString(key).toUpperCase();
    if (RESERVED_DESCRIPTION_KEYS.has(key) || !BOD_AVENUE_SET.has(code)) invalidKeys.push(key);
    else if (!selectedSet.has(code)) extraKeys.push(key);
  });
  const descriptions = normalizeAvenueDescriptions(avenueDescriptions, selected);
  selected.forEach((code) => {
    if (!descriptions[code]) missing.push(code);
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
  const syncedDistrictEventId = cleanString(raw.syncedDistrictEventId);
  const rcphRole = cleanString(raw.rcphRole).toLowerCase();
  const timeCandidate = cleanString(raw.eventTime || raw.time);

  const avenues = normalizeBodAvenues(raw.avenues ?? raw.avenue);

  return {
    id: eventId,
    name,
    description: cleanString(raw.description || raw.desc).slice(0, BOD_EVENT_DESCRIPTION_LIMIT),
    avenueDescriptions: normalizeAvenueDescriptions(raw.avenueDescriptions, avenues),
    conductedBy: cleanString(raw.conductedBy, "Unavailable"),
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
    driveFolder: safeExternalUrl(raw.driveFolder),
    driveFolderId: cleanString(raw.driveFolderId),
    previewLink: safeExternalUrl(raw.previewLink),
    imageLinks: cleanStrings(raw.imageLinks).map(safeExternalUrl).filter(Boolean),
    driveLinks: cleanStrings(raw.driveLinks).map(safeExternalUrl).filter(Boolean),
    uploadedFileUrls: cleanStrings(raw.uploadedFileUrls).map(safeExternalUrl).filter(Boolean),
    syncedEventId,
    syncedMeetingId,
    syncedDistrictEventId,
    isSynced: Boolean(syncedEventId || syncedMeetingId || syncedDistrictEventId || status === "synced"),
    recordKind,
    isActive,
    canEdit: isActive && recordKind === "clubEvent",
    canArchive: isActive && recordKind === "clubEvent",
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

export function validateBodEventDraft(draft) {
  const errors = {};
  if (!cleanString(draft?.name)) errors.name = "Event name is required.";
  if (!cleanString(draft?.conductedBy)) errors.conductedBy = "Conducted by is required.";
  const startDate = cleanString(draft?.startDate);
  const endDate = cleanString(draft?.endDate);
  if (!isValidDateOnly(startDate)) errors.startDate = "Enter a valid start date.";
  if (endDate && !isValidDateOnly(endDate)) errors.endDate = "Enter a valid end date.";
  else if (startDate && endDate && endDate < startDate) errors.endDate = "End date cannot be before start date.";
  if (!isValidEventTime(cleanString(draft?.time))) errors.time = "Enter a valid time in HH:MM format.";
  const avenues = normalizeBodAvenues(draft?.avenues);
  if (!avenues.length) errors.avenues = "Select at least one avenue.";
  const coverage = validateAvenueDescriptionCoverage(
    avenues,
    draft?.avenueDescriptions == null
      ? buildAvenueDescriptionDraft(draft, avenues)
      : draft.avenueDescriptions,
  );
  if (avenues.length && !coverage.ok) errors.avenueDescriptions = coverage.errors.at(-1);
  return errors;
}

export function buildBodEventPayload(draft, eventId = "") {
  const errors = validateBodEventDraft(draft);
  if (Object.keys(errors).length) return { payload: null, errors };
  const avenues = normalizeBodAvenues(draft.avenues).slice(0, 12);
  const avenueDescriptionDraft = draft.avenueDescriptions == null
    ? buildAvenueDescriptionDraft(draft, avenues)
    : draft.avenueDescriptions;
  const coverage = validateAvenueDescriptionCoverage(avenues, avenueDescriptionDraft);
  if (!coverage.ok) return { payload: null, errors: { ...errors, avenueDescriptions: coverage.errors.at(-1) } };
  const description = cleanString(draft.description).slice(0, BOD_EVENT_DESCRIPTION_LIMIT);
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
    driveFolder: safeExternalUrl(draft.driveFolder),
  };
  if (eventId) payload.eventId = cleanString(eventId);
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
