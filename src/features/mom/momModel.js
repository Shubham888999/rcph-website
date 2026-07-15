export const MOM_TARGET_TYPES = Object.freeze({
  CLUB_EVENT: "club_event",
  BOD_MEETING: "bod_meeting",
  DISTRICT_EVENT: "district_event",
  BOD_EVENT: "bod_event",
});

export const MOM_PDF_ACCEPT = ".pdf,application/pdf";
export const MOM_PDF_MAX_BYTES = 10 * 1024 * 1024;
export const MOM_DRIVE_FOLDER_NAME = "RCPH MOM Uploads";

const MOM_SUBFOLDER_BY_TARGET_TYPE = Object.freeze({
  [MOM_TARGET_TYPES.CLUB_EVENT]: "Club Events",
  [MOM_TARGET_TYPES.BOD_MEETING]: "BOD Meetings",
  [MOM_TARGET_TYPES.DISTRICT_EVENT]: "District Events",
  [MOM_TARGET_TYPES.BOD_EVENT]: "BOD Events",
});

const SECRETARY_POSITION_KEYS = new Set(["secretary", "joint-secretary", "co-secretary"]);

function text(value, max = 300) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function lower(value, max = 80) {
  return text(value, max).toLowerCase();
}

function timestampIso(value) {
  if (!value) return "";
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  try {
    const date = typeof value.toDate === "function" ? value.toDate() : null;
    return date && !Number.isNaN(date.getTime()) ? date.toISOString() : "";
  } catch {
    return "";
  }
}

function cleanPositionKeys(value) {
  return Array.isArray(value) ? value.map((key) => lower(key)).filter(Boolean) : [];
}

export function hasSecretaryPosition(access) {
  return cleanPositionKeys(access?.positionKeys).some((key) => SECRETARY_POSITION_KEYS.has(key));
}

export function canUploadMom(access) {
  if (access?.isApproved !== true) return false;
  return access.storedRole === "admin"
    || access.storedRole === "president"
    || access.canAccessPresidentControls === true
    || hasSecretaryPosition(access);
}

export function canViewMom(access) {
  if (access?.isApproved !== true) return false;
  return canUploadMom(access)
    || access.storedRole === "bod"
    || access.canAccessBodTools === true;
}

export function normalizeMomMetadata(raw = {}, fallback = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  const momDriveFileId = text(source.momDriveFileId, 180);
  const momFileName = text(source.momFileName, 180);
  if (!momDriveFileId || !momFileName) return null;

  return {
    momDriveFileId,
    momFileName,
    momMimeType: lower(source.momMimeType, 120) || "application/pdf",
    momUploadedBy: text(source.momUploadedBy, 160),
    momUploadedByName: text(source.momUploadedByName, 180) || "Unavailable",
    momUploadedAt: timestampIso(source.momUploadedAt),
    momUpdatedAt: timestampIso(source.momUpdatedAt),
    momReplacedBy: text(source.momReplacedBy, 160),
    momReplacedByName: text(source.momReplacedByName, 180),
    momTargetType: lower(source.momTargetType, 80) || lower(fallback.momTargetType, 80),
    momTargetId: text(source.momTargetId, 160) || text(fallback.momTargetId, 160),
  };
}

export function momDriveSubfolderName(targetType) {
  return MOM_SUBFOLDER_BY_TARGET_TYPE[lower(targetType)] || "Other MOM";
}

function momTargetFromRecord(record, targetType, targetId) {
  const cleanTargetId = text(targetId, 160);
  if (!cleanTargetId) return null;

  return {
    targetType,
    targetId: cleanTargetId,
    title: text(record?.name || record?.title, 180),
    date: text(record?.startDate || record?.date || record?.eventStart, 40),
    mom: normalizeMomMetadata(record?.mom || record, {
      momTargetType: targetType,
      momTargetId: cleanTargetId,
    }),
  };
}

export function getBodMomTarget(event) {
  if (!event || typeof event !== "object") return null;

  const existingType = lower(event.mom?.momTargetType || event.momTargetType, 80);
  const existingId = text(event.mom?.momTargetId || event.momTargetId, 160);
  if (Object.values(MOM_TARGET_TYPES).includes(existingType) && existingId) {
    return momTargetFromRecord(event, existingType, existingId);
  }

  if (event.syncedEventId) {
    return momTargetFromRecord(event, MOM_TARGET_TYPES.CLUB_EVENT, event.syncedEventId);
  }
  if (event.syncedMeetingId) {
    return momTargetFromRecord(event, MOM_TARGET_TYPES.BOD_MEETING, event.syncedMeetingId);
  }
  if (event.syncedDistrictEventId) {
    return momTargetFromRecord(event, MOM_TARGET_TYPES.DISTRICT_EVENT, event.syncedDistrictEventId);
  }

  if (event.recordKind === "bodMeeting") {
    return momTargetFromRecord(event, MOM_TARGET_TYPES.BOD_MEETING, event.id);
  }
  if (event.recordKind === "districtEvent") {
    return momTargetFromRecord(event, MOM_TARGET_TYPES.DISTRICT_EVENT, event.id);
  }
  if (event.recordKind === "clubEvent") {
    return momTargetFromRecord(
      event,
      event.isSynced ? MOM_TARGET_TYPES.CLUB_EVENT : MOM_TARGET_TYPES.BOD_EVENT,
      event.id,
    );
  }

  return null;
}

export function validateMomPdfFile(file) {
  if (!file) return "Choose a MOM PDF file.";
  const name = text(file.name, 220);
  if (!name) return "Use a filename between 1 and 180 characters.";
  if (!/\.pdf$/i.test(name)) return "Choose a PDF file for MOM upload.";
  if (file.type && lower(file.type, 120) !== "application/pdf") return "Only PDF files are accepted for MOM.";
  if (!Number.isSafeInteger(file.size) || file.size <= 0) return "The selected MOM PDF is empty.";
  if (file.size > MOM_PDF_MAX_BYTES) return "The selected MOM PDF is larger than 10 MB.";
  return "";
}

export function formatMomTimestamp(value) {
  const iso = timestampIso(value);
  if (!iso) return "Unavailable";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function momUploadError(error) {
  const code = lower(error?.code, 80);
  if (code === "functions/unauthenticated") return "Sign in again before uploading MOM.";
  if (code === "functions/permission-denied") return "You do not have permission to manage MOM for this record.";
  if (code === "functions/not-found") return "The event or MOM file could not be found.";
  if (code === "functions/invalid-argument") return "The MOM upload details were rejected.";
  if (code === "functions/failed-precondition") return "MOM upload is not available for this record.";
  if (code === "upload-failed" || code === "download-failed") return error?.message || "The MOM PDF could not be opened.";

  const safeMessages = new Set([
    "Authenticated user required.",
    "MOM upload authorization was incomplete.",
    "The MOM PDF upload failed.",
    "The selected file could not be read.",
  ]);
  return safeMessages.has(error?.message)
    ? error.message
    : "The MOM request could not be completed. Please retry.";
}
