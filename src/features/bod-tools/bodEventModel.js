const EVENT_KINDS = new Set(["clubEvent", "bodMeeting", "districtEvent"]);
const RCPH_ROLES = new Set(["host", "cohost", "collaborator", "participant"]);
export const BOD_AVENUES = ["ISD", "CMD", "CSD", "PDD", "RRRO", "PRO", "DEI", "GBM"];
export const BOD_EVENT_SOURCE = "bodEventManager";

function cleanString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function cleanStrings(value, { upper = false } = {}) {
  const source = Array.isArray(value) ? value : (typeof value === "string" ? [value] : []);
  return [...new Set(source.map((item) => cleanString(item)).filter(Boolean)
    .map((item) => upper ? item.toUpperCase() : item))];
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

  return {
    id: eventId,
    name,
    description: cleanString(raw.description || raw.desc),
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
    avenues: cleanStrings(raw.avenue, { upper: true }),
    rcphRole: RCPH_ROLES.has(rcphRole) ? rcphRole : "host",
    hostClub: cleanString(raw.hostClub, "Rotaract Club of Pune Heritage"),
    collaborators: normalizeCollaborators(raw.collaborators),
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
  if (!cleanStrings(draft?.avenues, { upper: true }).length) errors.avenues = "Select at least one avenue.";
  return errors;
}

export function buildBodEventPayload(draft, eventId = "") {
  const errors = validateBodEventDraft(draft);
  if (Object.keys(errors).length) return { payload: null, errors };
  const payload = {
    name: cleanString(draft.name).slice(0, 180),
    conductedBy: cleanString(draft.conductedBy).slice(0, 140),
    date: cleanString(draft.startDate),
    endDate: cleanString(draft.endDate) || cleanString(draft.startDate),
    time: cleanString(draft.time).slice(0, 20),
    desc: cleanString(draft.description).slice(0, 2500),
    avenue: cleanStrings(draft.avenues, { upper: true }).slice(0, 12),
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
