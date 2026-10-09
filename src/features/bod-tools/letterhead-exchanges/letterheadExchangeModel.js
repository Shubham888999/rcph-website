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

export function addLetterheadImageFiles(current = [], selected = [], maxFiles = LETTERHEAD_IMAGE_MAX_FILES) {
  const items = Array.isArray(current) ? [...current] : [];
  const errors = [];
  const keys = new Set(items.map((item) => item.fileKey));
  const limit = Math.max(0, Math.min(LETTERHEAD_IMAGE_MAX_FILES, Number.isSafeInteger(maxFiles) ? maxFiles : LETTERHEAD_IMAGE_MAX_FILES));
  for (const file of Array.from(selected || [])) {
    if (items.length >= limit) {
      errors.push(limit === LETTERHEAD_IMAGE_MAX_FILES
        ? `You can upload up to ${LETTERHEAD_IMAGE_MAX_FILES} images per exchange.`
        : `This exchange has room for ${limit} more image${limit === 1 ? "" : "s"} (${LETTERHEAD_IMAGE_MAX_FILES} maximum).`);
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
  const images = activeLetterheadImages(raw);
  const reportImageId = text(raw.reportImageId, 160);
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
    imageCount: Array.isArray(raw.images)
      ? images.length
      : (Number.isSafeInteger(raw.imageCount) && raw.imageCount >= 0 ? raw.imageCount : 0),
    reportImageId: images.some((image) => image.imageId === reportImageId) ? reportImageId : "",
    driveFolderName: text(raw.driveFolderName, 220),
    status: text(raw.status, 40) || "active",
    createdAt: text(raw.createdAt, 40),
    createdByName: text(raw.createdByName, 160),
    createdByRole: text(raw.createdByRole, 80),
    updatedAt: text(raw.updatedAt, 40),
    updatedByName: text(raw.updatedByName, 160),
    lastEditedAt: text(raw.lastEditedAt, 40),
    lastEditedByName: text(raw.lastEditedByName, 160),
  };
}

// Soft-removed images (removedAt set) never reach the UI or reports.
export function activeLetterheadImages(exchange = {}) {
  return Array.isArray(exchange?.images)
    ? exchange.images
      .filter((image) => image && typeof image === "object" && !image.removedAt)
      .map(normalizeLetterheadImage)
      .filter((image) => image.imageId && image.fileName)
    : [];
}

export function isLetterheadReportPhotoEligible(image = {}) {
  return Boolean(text(image?.imageId, 160)) && LETTERHEAD_ALLOWED_IMAGE_MIME_TYPES.includes(lowerText(image?.mimeType, 120));
}

export function remainingLetterheadImageSlots(exchange = {}) {
  return Math.max(0, LETTERHEAD_IMAGE_MAX_FILES - activeLetterheadImages(exchange).length);
}

export function letterheadPhotoBadge(exchange = {}) {
  const count = activeLetterheadImages(exchange).length;
  const reportImageId = text(exchange?.reportImageId, 160);
  const hasReportPhoto = Boolean(reportImageId) && activeLetterheadImages(exchange).some((image) => image.imageId === reportImageId);
  if (!count) return { text: "No photos", tone: "muted", count, hasReportPhoto: false };
  const photos = `${count} photo${count === 1 ? "" : "s"}`;
  return hasReportPhoto
    ? { text: `${photos} · Report photo ✓`, tone: "ready", count, hasReportPhoto }
    : { text: `${photos} · No report photo`, tone: "warning", count, hasReportPhoto };
}

function withRtrPrefix(name) {
  const clean = text(name, 160).replace(/^Rtr\.?\s*/i, "");
  return clean ? `Rtr. ${clean}` : "";
}

export function formatLetterheadDayDate(value = "") {
  const millis = Date.parse(value);
  if (!text(value) || !Number.isFinite(millis)) return "";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })
    .format(new Date(millis));
}

export function formatLastEditedLabel(exchange = {}) {
  const name = withRtrPrefix(exchange?.lastEditedByName);
  const date = formatLetterheadDayDate(exchange?.lastEditedAt);
  if (!name && !date) return "";
  return `Last edited${name ? ` by ${name}` : ""}${date ? ` on ${date}` : ""}`;
}

export function buildEditDraftFromExchange(exchange = {}) {
  const participants = Array.isArray(exchange?.externalParticipants) ? exchange.externalParticipants : [];
  const associatedEvent = exchange?.associatedEvent;
  return {
    externalParticipants: participants.length
      ? participants.map((row, index) => normalizeExternalParticipant({ ...row, rowId: `edit-participant-${index + 1}` }))
      : [createParticipantRow("edit-participant-1")],
    rcphMemberIds: uniqueStrings(exchange?.rcphMemberIds?.length
      ? exchange.rcphMemberIds
      : (exchange?.rcphRepresentatives || []).map((row) => row?.memberId)),
    exchangeDate: text(exchange?.exchangeDate, 20),
    associatedEventKey: associatedEvent?.source && associatedEvent?.id ? eventKey(associatedEvent) : "",
    other: String(exchange?.other ?? ""),
    uploadImages: false,
  };
}

// Representatives and the associated event already on an exchange stay selectable while
// editing even when they are no longer offered for new exchanges (the server keeps them).
export function mergeEditMemberOptions(members = [], exchange = {}) {
  const options = normalizeMemberOptions(members);
  const known = new Set(options.map((member) => member.id));
  const stored = (Array.isArray(exchange?.rcphRepresentatives) ? exchange.rcphRepresentatives : [])
    .map((row) => ({ id: text(row?.memberId, 160), name: text(row?.name, 160), role: text(row?.role, 80), position: text(row?.position, 140) }))
    .filter((row) => row.id && row.name && !known.has(row.id));
  return normalizeMemberOptions([...options, ...stored]);
}

export function mergeEditEventOptions(events = [], exchange = {}) {
  const options = normalizeEventOptions(events);
  const stored = normalizeEventOptions(exchange?.associatedEvent ? [exchange.associatedEvent] : []);
  if (!stored.length || options.some((event) => eventKey(event) === eventKey(stored[0]))) return options;
  return [stored[0], ...options];
}

export function buildUpdateLetterheadExchangePayload(exchangeId = "", draft = {}, events = []) {
  const id = text(exchangeId, 160);
  const result = buildCreateLetterheadExchangePayload(draft, events);
  if (!result.payload) return result;
  if (!id) return { payload: null, errors: { exchangeId: "The Letterhead Exchange could not be identified." } };
  return { payload: { exchangeId: id, ...result.payload }, errors: {} };
}

export function normalizeUpdateExchangeResponse(raw = {}) {
  const exchange = normalizeLetterheadExchange(raw?.exchange);
  if (raw?.ok !== true || !exchange) throw new Error("Letterhead Exchange response was incomplete.");
  return { ok: true, unchanged: raw.unchanged === true, exchange };
}

export const normalizeReportImageChangeResponse = normalizeUpdateExchangeResponse;
export const normalizeRemoveImageResponse = normalizeUpdateExchangeResponse;

export function formatLetterheadBlockDate(value = "") {
  if (!dateLooksValid(value)) return value || "Date unavailable";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

export function buildLetterheadExchangeHeading(exchange = {}, separator = " · ") {
  const clubs = uniqueExternalClubNames(exchange);
  const eventName = text(exchange?.associatedEvent?.name || exchange?.associatedEvent?.label, 180);
  return [
    formatLetterheadBlockDate(text(exchange?.exchangeDate, 20)),
    clubs.length ? clubs.join(", ") : "No club recorded",
    eventName ? `Event: ${eventName}` : "",
  ].filter(Boolean).join(separator);
}

export const LETTERHEAD_REPORT_IMAGE_KEY_PREFIX = "letterhead:";

export function letterheadReportImageKey(exchangeId = "") {
  const id = text(exchangeId, 160);
  return id && !/[\\/]/.test(id) ? `${LETTERHEAD_REPORT_IMAGE_KEY_PREFIX}${id}` : "";
}

export function letterheadExchangesMissingReportPhoto(exchanges = []) {
  return (Array.isArray(exchanges) ? exchanges : [])
    .filter((exchange) => exchange?.id && Number(exchange.imageCount) > 0 && !exchange.reportImage)
    .slice()
    .sort((left, right) => String(left.exchangeDate).localeCompare(String(right.exchangeDate)) || String(left.id).localeCompare(String(right.id)))
    .map((exchange) => ({ exchangeId: exchange.id, label: buildLetterheadExchangeHeading({ ...exchange, associatedEvent: null }) }));
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
    imageCount: Number.isSafeInteger(raw.imageCount) && raw.imageCount >= 0 ? raw.imageCount : 0,
    reportImage: normalizeReportImageRef(raw.reportImage),
  };
}

function normalizeReportImageRef(raw) {
  if (!raw || typeof raw !== "object") return null;
  const image = {
    imageId: text(raw.imageId, 160),
    fileName: text(raw.fileName, 180),
    mimeType: lowerText(raw.mimeType, 120),
  };
  return image.imageId && isLetterheadReportPhotoEligible(image) ? image : null;
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
