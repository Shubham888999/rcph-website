export const LETTERHEAD_PARTICIPANT_LIMIT = 20;
export const LETTERHEAD_RCPH_REPRESENTATIVE_LIMIT = 20;
export const LETTERHEAD_OTHER_LIMIT = 2000;
export const LETTERHEAD_IMAGE_MAX_FILES = 10;
export const LETTERHEAD_IMAGE_MAX_BYTES = 15 * 1024 * 1024;
export const LETTERHEAD_ALLOWED_IMAGE_MIME_TYPES = Object.freeze([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const PARTICIPANT_LIMITS = Object.freeze({
  clubName: 150,
  rotaractorName: 120,
  position: 120,
  rotaractDistrictId: 20,
});

const EXTENSIONS_BY_MIME = Object.freeze({
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
});

let localRowCounter = 0;

function text(value, max = 500) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
}

function lowerText(value, max = 120) {
  return text(value, max).toLowerCase();
}

function uniqueStrings(values, max = 160) {
  const seen = new Set();
  const result = [];
  for (const value of Array.isArray(values) ? values : []) {
    const item = text(value, max);
    if (!item || seen.has(item)) continue;
    seen.add(item);
    result.push(item);
  }
  return result;
}

function dateLooksValid(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

export function createParticipantRow(id = "") {
  localRowCounter += 1;
  return {
    rowId: id || `participant-${Date.now().toString(36)}-${localRowCounter}`,
    clubName: "",
    rotaractorName: "",
    position: "",
    rotaractDistrictId: "",
  };
}

export function createLetterheadExchangeDraft() {
  return {
    externalParticipants: [createParticipantRow("participant-1")],
    rcphMemberIds: [],
    exchangeDate: "",
    associatedEventKey: "",
    other: "",
    uploadImages: false,
  };
}

export function normalizeExternalParticipant(row = {}) {
  return {
    rowId: text(row.rowId, 120) || createParticipantRow().rowId,
    clubName: text(row.clubName, PARTICIPANT_LIMITS.clubName),
    rotaractorName: text(row.rotaractorName, PARTICIPANT_LIMITS.rotaractorName),
    position: text(row.position, PARTICIPANT_LIMITS.position),
    rotaractDistrictId: text(row.rotaractDistrictId, PARTICIPANT_LIMITS.rotaractDistrictId),
  };
}

export function addParticipantRow(rows = []) {
  const normalized = (Array.isArray(rows) && rows.length ? rows : [createParticipantRow()])
    .map(normalizeExternalParticipant)
    .slice(0, LETTERHEAD_PARTICIPANT_LIMIT);
  if (normalized.length >= LETTERHEAD_PARTICIPANT_LIMIT) return normalized;
  return [...normalized, createParticipantRow()];
}

export function removeParticipantRow(rows = [], rowId = "") {
  const normalized = (Array.isArray(rows) && rows.length ? rows : [createParticipantRow()])
    .map(normalizeExternalParticipant);
  if (normalized.length <= 1) return normalized;
  const next = normalized.filter((row) => row.rowId !== rowId);
  return next.length ? next : normalized.slice(0, 1);
}

export function toggleMemberSelection(memberIds = [], memberId = "", checked = true) {
  const selected = new Set(uniqueStrings(memberIds));
  const id = text(memberId, 160);
  if (!id) return [...selected];
  if (checked) selected.add(id);
  else selected.delete(id);
  return [...selected].slice(0, LETTERHEAD_RCPH_REPRESENTATIVE_LIMIT);
}

export function normalizeMemberOptions(value) {
  return Array.isArray(value)
    ? value
      .map((item) => ({
        id: text(item?.id, 160),
        name: text(item?.name, 160),
        role: text(item?.role, 80),
        position: text(item?.position, 140),
      }))
      .filter((item) => item.id && item.name)
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
    : [];
}

export function normalizeEventOptions(value) {
  return Array.isArray(value)
    ? value
      .map((item) => ({
        source: text(item?.source, 40),
        id: text(item?.id, 160),
        type: text(item?.type, 80),
        name: text(item?.name, 180),
        date: text(item?.date, 20),
        endDate: text(item?.endDate, 20),
        avenues: uniqueStrings(item?.avenues, 40),
        label: text(item?.label || item?.name, 260),
      }))
      .filter((item) => item.source && item.id && item.label)
    : [];
}

export function eventKey(event = {}) {
  return event?.source && event?.id ? `${event.source}::${event.id}` : "";
}

export function eventFromKey(events = [], key = "") {
  return normalizeEventOptions(events).find((event) => eventKey(event) === key) || null;
}

export function normalizeFormOptionsResponse(raw = {}) {
  return {
    ok: raw?.ok === true,
    members: normalizeMemberOptions(raw?.members),
    events: normalizeEventOptions(raw?.events),
  };
}

function participantErrors(row, index) {
  const errors = {};
  if (!text(row.clubName)) errors.clubName = `Club name is required for participant ${index + 1}.`;
  if (!text(row.rotaractorName)) errors.rotaractorName = `Rotaractor name is required for participant ${index + 1}.`;
  for (const [field, limit] of Object.entries(PARTICIPANT_LIMITS)) {
    if (String(row[field] ?? "").trim().length > limit) {
      errors[field] = `${field} must be ${limit} characters or fewer.`;
    }
  }
  return errors;
}

export function validateLetterheadExchangeDraft(draft = {}, events = []) {
  const externalParticipants = Array.isArray(draft.externalParticipants) && draft.externalParticipants.length
    ? draft.externalParticipants
    : [createParticipantRow()];
  const errors = {};
  const participantErrorRows = externalParticipants.map(participantErrors);
  if (externalParticipants.length > LETTERHEAD_PARTICIPANT_LIMIT) {
    errors.externalParticipants = `External participants are limited to ${LETTERHEAD_PARTICIPANT_LIMIT} rows.`;
  }
  if (participantErrorRows.some((row) => Object.keys(row).length)) {
    errors.participants = participantErrorRows;
  }
  if (!uniqueStrings(draft.rcphMemberIds).length) {
    errors.rcphMemberIds = "Select at least one RCPH representative.";
  }
  if (!dateLooksValid(text(draft.exchangeDate, 20))) {
    errors.exchangeDate = "Enter a valid exchange date.";
  }
  if (String(draft.other ?? "").trim().length > LETTERHEAD_OTHER_LIMIT) {
    errors.other = `Other must be ${LETTERHEAD_OTHER_LIMIT} characters or fewer.`;
  }
  if (draft.associatedEventKey && !eventFromKey(events, draft.associatedEventKey)) {
    errors.associatedEventKey = "Choose a valid associated event.";
  }
  return errors;
}

export function buildCreateLetterheadExchangePayload(draft = {}, events = []) {
  const errors = validateLetterheadExchangeDraft(draft, events);
  if (Object.keys(errors).length) return { payload: null, errors };
  const associatedEvent = eventFromKey(events, draft.associatedEventKey);
  return {
    payload: {
      exchangeDate: text(draft.exchangeDate, 20),
      externalParticipants: draft.externalParticipants
        .map(normalizeExternalParticipant)
        .slice(0, LETTERHEAD_PARTICIPANT_LIMIT)
        .map(({ clubName, rotaractorName, position, rotaractDistrictId }) => ({
          clubName,
          rotaractorName,
          position,
          rotaractDistrictId,
        })),
      rcphMemberIds: uniqueStrings(draft.rcphMemberIds).slice(0, LETTERHEAD_RCPH_REPRESENTATIVE_LIMIT),
      associatedEvent: associatedEvent ? { source: associatedEvent.source, id: associatedEvent.id } : null,
      other: text(draft.other, LETTERHEAD_OTHER_LIMIT),
    },
    errors: {},
  };
}

export function letterheadImageFileKey(file) {
  return `${file?.name || ""}:${file?.size || 0}:${file?.lastModified || 0}`;
}

export function validateLetterheadImageFile(file) {
  const name = text(file?.name, 220);
  const mimeType = lowerText(file?.type, 120);
  const sizeBytes = Number(file?.size);
  if (!name || name.length > 180) return "Use an image filename between 1 and 180 characters.";
  if (!LETTERHEAD_ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)) return `${name} is not a supported JPG, PNG, or WebP image.`;
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) return `${name} is empty or could not be read.`;
  if (sizeBytes > LETTERHEAD_IMAGE_MAX_BYTES) return `${name} is larger than the 15 MB limit.`;
  const extension = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
  if (!EXTENSIONS_BY_MIME[mimeType].includes(extension)) return `${name} does not match its reported image type.`;
  return "";
}

export function addLetterheadImageFiles(current = [], selected = []) {
  const items = Array.isArray(current) ? [...current] : [];
  const errors = [];
  const keys = new Set(items.map((item) => item.fileKey));
  for (const file of Array.from(selected || [])) {
    if (items.length >= LETTERHEAD_IMAGE_MAX_FILES) {
      errors.push(`You can upload up to ${LETTERHEAD_IMAGE_MAX_FILES} images per exchange.`);
      break;
    }
    const error = validateLetterheadImageFile(file);
    const fileKey = letterheadImageFileKey(file);
    if (error) errors.push(error);
    else if (keys.has(fileKey)) errors.push(`${file.name} is already selected.`);
    else {
      keys.add(fileKey);
      items.push({
        localId: `letterhead-${Date.now().toString(36)}-${items.length}-${Math.random().toString(36).slice(2)}`,
        fileKey,
        file,
        fileName: file.name,
        mimeType: file.type.toLowerCase(),
        sizeBytes: file.size,
        status: "waiting",
        error: "",
        sessionId: "",
        uploaded: null,
        image: null,
      });
    }
  }
  return { items, errors };
}

export function formatLetterheadFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function normalizeLetterheadImage(raw = {}) {
  return {
    imageId: text(raw.imageId || raw.uploadSessionId, 160),
    fileName: text(raw.fileName, 180),
    mimeType: lowerText(raw.mimeType, 120),
    sizeBytes: Number(raw.sizeBytes) || 0,
    uploadedAt: text(raw.uploadedAt, 40),
    uploadedByUid: text(raw.uploadedByUid, 160),
    uploadedByName: text(raw.uploadedByName, 160),
    uploadSessionId: text(raw.uploadSessionId, 160),
    storageProvider: text(raw.storageProvider, 40) || "googleDrive",
  };
}

export function normalizeLetterheadExchange(raw = {}) {
  const id = text(raw.id, 160);
  if (!id) return null;
  const externalParticipants = Array.isArray(raw.externalParticipants)
    ? raw.externalParticipants.map(normalizeExternalParticipant).filter((row) => row.clubName && row.rotaractorName)
    : [];
  const rcphRepresentatives = Array.isArray(raw.rcphRepresentatives)
    ? raw.rcphRepresentatives
      .map((row) => ({
        memberId: text(row?.memberId, 160),
        userId: text(row?.userId, 160),
        name: text(row?.name, 160),
        role: text(row?.role, 80),
        position: text(row?.position, 140),
      }))
      .filter((row) => row.memberId && row.name)
    : [];
  const images = Array.isArray(raw.images)
    ? raw.images.map(normalizeLetterheadImage).filter((image) => image.imageId && image.fileName)
    : [];
  const associatedEvent = raw.associatedEvent && typeof raw.associatedEvent === "object"
    ? {
      source: text(raw.associatedEvent.source, 40),
      id: text(raw.associatedEvent.id, 160),
      type: text(raw.associatedEvent.type, 80),
      name: text(raw.associatedEvent.name, 180),
      date: text(raw.associatedEvent.date, 20),
      endDate: text(raw.associatedEvent.endDate, 20),
      avenues: uniqueStrings(raw.associatedEvent.avenues, 40),
      label: text(raw.associatedEvent.label || raw.associatedEvent.name, 260),
    }
    : null;
  return {
    id,
    exchangeDate: text(raw.exchangeDate, 20),
    exchangeMonth: text(raw.exchangeMonth, 7),
    externalParticipants,
    rcphRepresentatives,
    rcphMemberIds: uniqueStrings(raw.rcphMemberIds),
    associatedEvent,
    other: text(raw.other, LETTERHEAD_OTHER_LIMIT),
    images,
    imageCount: Number.isSafeInteger(raw.imageCount) && raw.imageCount >= 0 ? raw.imageCount : images.length,
    driveFolderName: text(raw.driveFolderName, 220),
    status: text(raw.status, 40) || "active",
    createdAt: text(raw.createdAt, 40),
    createdByName: text(raw.createdByName, 160),
    createdByRole: text(raw.createdByRole, 80),
    updatedAt: text(raw.updatedAt, 40),
    updatedByName: text(raw.updatedByName, 160),
  };
}

export function normalizeCreateExchangeResponse(raw = {}) {
  const exchange = normalizeLetterheadExchange(raw?.exchange);
  if (raw?.ok !== true || !exchange) throw new Error("Letterhead Exchange response was incomplete.");
  return { ok: true, exchange };
}

export function normalizeListExchangeResponse(raw = {}) {
  return {
    ok: raw?.ok === true,
    limit: Number.isSafeInteger(raw?.limit) ? raw.limit : 0,
    exchanges: Array.isArray(raw?.exchanges)
      ? raw.exchanges.map(normalizeLetterheadExchange).filter(Boolean)
      : [],
  };
}

export function normalizeReportLetterheadExchange(raw = {}) {
  const id = text(raw.id, 160);
  if (!id) return null;
  const externalParticipants = Array.isArray(raw.externalParticipants)
    ? raw.externalParticipants.map(normalizeExternalParticipant).filter((row) => row.clubName && row.rotaractorName)
    : [];
  const rcphRepresentatives = Array.isArray(raw.rcphRepresentatives)
    ? raw.rcphRepresentatives
      .map((row) => ({ name: text(row?.name || row, 160) }))
      .filter((row) => row.name)
    : [];
  const associatedEvent = raw.associatedEvent && typeof raw.associatedEvent === "object"
    ? {
      name: text(raw.associatedEvent.name, 180),
      label: text(raw.associatedEvent.label || raw.associatedEvent.name, 260),
      date: text(raw.associatedEvent.date, 20),
    }
    : null;
  return {
    id,
    exchangeDate: text(raw.exchangeDate, 20),
    exchangeMonth: text(raw.exchangeMonth, 7),
    externalParticipants,
    rcphRepresentatives,
    associatedEvent,
    other: text(raw.other, LETTERHEAD_OTHER_LIMIT),
  };
}

export function normalizeReportLetterheadExchangeResponse(raw = {}) {
  if (raw?.ok !== true) throw new Error("Letterhead Exchange report response was incomplete.");
  return {
    ok: true,
    months: uniqueStrings(raw.months, 7),
    exchanges: Array.isArray(raw.exchanges)
      ? raw.exchanges.map(normalizeReportLetterheadExchange).filter(Boolean)
      : [],
  };
}

export function normalizeImageSessionResponse(raw = {}, expectedCount = 0) {
  const sessions = Array.isArray(raw?.sessions)
    ? raw.sessions.map((session) => ({
      sessionId: text(session?.sessionId, 160),
      proof: text(session?.proof, 240),
      fileName: text(session?.fileName, 180),
      mimeType: lowerText(session?.mimeType, 120),
      sizeBytes: Number(session?.sizeBytes) || 0,
      expiresAt: text(session?.expiresAt, 40),
    })).filter((session) => session.sessionId && session.proof)
    : [];
  const uploadEndpoint = text(raw?.uploadEndpoint, 1000);
  if (raw?.ok !== true || !uploadEndpoint || sessions.length !== expectedCount) {
    throw new Error("Image upload authorization was incomplete.");
  }
  return {
    ok: true,
    exchangeId: text(raw.exchangeId, 160),
    uploadEndpoint,
    maxSizeBytes: Number(raw.maxSizeBytes) || LETTERHEAD_IMAGE_MAX_BYTES,
    maxImages: Number(raw.maxImages) || LETTERHEAD_IMAGE_MAX_FILES,
    expiresAt: text(raw.expiresAt, 40),
    sessions,
  };
}

export function normalizeUploadHttpResponse(raw = {}, fallbackSessionId = "") {
  const sessionId = text(raw?.sessionId || fallbackSessionId, 160);
  if (raw?.ok !== true || !sessionId || !raw?.uploaded) {
    throw new Error("The private image upload was rejected.");
  }
  return {
    ok: true,
    sessionId,
    uploaded: {
      fileName: text(raw.uploaded.fileName, 180),
      mimeType: lowerText(raw.uploaded.mimeType, 120),
      sizeBytes: Number(raw.uploaded.sizeBytes) || 0,
      uploadedAt: text(raw.uploaded.uploadedAt, 40),
    },
  };
}

export function normalizeFinalizeImageResponse(raw = {}) {
  const exchange = normalizeLetterheadExchange(raw?.exchange);
  const image = normalizeLetterheadImage(raw?.image);
  if (raw?.ok !== true || !exchange || !image.imageId) {
    throw new Error("Image finalization response was incomplete.");
  }
  return {
    ok: true,
    unchanged: raw.unchanged === true,
    exchange,
    image,
  };
}

export function normalizeImageAccessResponse(raw = {}) {
  const accessId = text(raw?.accessId, 160);
  const proof = text(raw?.proof, 240);
  const downloadEndpoint = text(raw?.downloadEndpoint, 1000);
  const image = normalizeLetterheadImage(raw?.image);
  if (raw?.ok !== true || !accessId || !proof || !downloadEndpoint || !image.imageId) {
    throw new Error("Image access response was incomplete.");
  }
  return {
    ok: true,
    exchangeId: text(raw.exchangeId, 160),
    image,
    accessId,
    proof,
    downloadEndpoint,
    expiresAt: text(raw.expiresAt, 40),
  };
}

export function buildProtectedImageUrl(access = {}) {
  if (!access.downloadEndpoint || !access.accessId || !access.proof) return "";
  const url = new URL(access.downloadEndpoint);
  url.searchParams.set("accessId", access.accessId);
  url.searchParams.set("proof", access.proof);
  return url.href;
}

export function uniqueExternalClubNames(exchange = {}) {
  const seen = new Set();
  const names = [];
  for (const participant of Array.isArray(exchange.externalParticipants) ? exchange.externalParticipants : []) {
    const clubName = text(participant?.clubName, 150);
    const key = clubName.toLowerCase();
    if (!clubName || seen.has(key)) continue;
    seen.add(key);
    names.push(clubName);
  }
  return names;
}

export function buildClubSummary(exchange = {}) {
  const clubs = uniqueExternalClubNames(exchange);
  if (!clubs.length) return "No club recorded";
  if (clubs.length === 1) return clubs[0];
  return `${clubs[0]} + ${clubs.length - 1} more`;
}

export function buildRepresentativeSummary(exchange = {}) {
  const names = Array.isArray(exchange.rcphRepresentatives)
    ? exchange.rcphRepresentatives.map((row) => text(row?.name, 160)).filter(Boolean)
    : [];
  if (!names.length) return "No RCPH representatives";
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} + ${names.length - 2} more`;
}

export function formatExchangeDate(value = "") {
  if (!dateLooksValid(value)) return value || "Date unavailable";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    .format(new Date(year, month - 1, day, 12));
}

export function imageCountLabel(count = 0) {
  const normalized = Math.max(0, Number(count) || 0);
  return `${normalized} image${normalized === 1 ? "" : "s"}`;
}
