export const MOM_TARGET_TYPES = Object.freeze({
  CLUB_EVENT: "club_event",
  BOD_MEETING: "bod_meeting",
  DISTRICT_EVENT: "district_event",
  BOD_EVENT: "bod_event",
});

export const MOM_PDF_ACCEPT = ".pdf,application/pdf";
export const MOM_PDF_MAX_BYTES = 10 * 1024 * 1024;
export const MOM_DRIVE_FOLDER_NAME = "RCPH MOM Uploads";
export const MOM_RECIPIENT_GROUP_OPTIONS = Object.freeze([
  { value: "all", label: "All" },
  { value: "bod", label: "BOD" },
  { value: "gbm", label: "GBM" },
  { value: "prospect", label: "Prospects" },
  { value: "president", label: "President" },
  { value: "secretary", label: "Secretary" },
  { value: "saa", label: "Sergeant-at-Arms" },
  { value: "admin", label: "Admin" },
]);

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

export function canSendMomEmail(access) {
  return canUploadMom(access);
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

export function normalizeMomEmailHistory(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  const summary = source.emailSummary && typeof source.emailSummary === "object" ? source.emailSummary : {};
  const sentAt = timestampIso(source.sentAt || source.lastSentAt);
  if (!sentAt) return null;
  const groups = Array.isArray(source.recipientGroups || source.recipientRoles)
    ? (source.recipientGroups || source.recipientRoles).map((item) => lower(item, 40)).filter(Boolean)
    : [];
  return {
    sentAt,
    recipientGroups: [...new Set(groups)],
    targetUserIds: Array.isArray(source.targetUserIds)
      ? [...new Set(source.targetUserIds.map((item) => text(item, 160)).filter(Boolean))]
      : [],
    explicitRecipientCount: Number.isSafeInteger(source.explicitRecipientCount) && source.explicitRecipientCount >= 0
      ? source.explicitRecipientCount
      : 0,
    recipientCount: Number.isSafeInteger(source.recipientCount) && source.recipientCount >= 0 ? source.recipientCount : 0,
    sentByName: text(source.sentByName, 180) || "Unavailable",
    status: lower(source.status, 40) || "sent",
    emailSummary: {
      attempted: Number.isSafeInteger(summary.attempted) ? summary.attempted : 0,
      sent: Number.isSafeInteger(summary.sent) ? summary.sent : 0,
      failed: Number.isSafeInteger(summary.failed) ? summary.failed : 0,
      skippedInvalidEmail: Number.isSafeInteger(summary.skippedInvalidEmail) ? summary.skippedInvalidEmail : 0,
    },
  };
}

export function normalizeMomRecipientOption(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  const uid = text(source.uid || source.id, 160);
  const email = lower(source.email, 320);
  if (!uid || uid.includes("@") || !email) return null;
  return {
    uid,
    name: text(source.name || source.displayName || email, 180) || email,
    email,
    role: lower(source.role || source.storedRole, 40),
    positionKeys: Array.isArray(source.positionKeys)
      ? source.positionKeys.map((key) => lower(key, 80)).filter(Boolean)
      : [],
  };
}

export function normalizeMomRecipientOptions(items = []) {
  const seen = new Set();
  return (Array.isArray(items) ? items : [])
    .map(normalizeMomRecipientOption)
    .filter(Boolean)
    .filter((item) => {
      if (seen.has(item.uid)) return false;
      seen.add(item.uid);
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name) || a.uid.localeCompare(b.uid));
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
    momEmail: normalizeMomEmailHistory(record?.momEmail || record?.momEmailLast || record),
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

export function buildMomEmailDefaults(target = {}) {
  const title = text(target.title || target.name, 180) || "this event/meeting";
  const date = text(target.date || target.startDate, 40) || "the conducted date";
  return {
    recipientGroups: ["bod"],
    targetUserIds: [],
    subject: `MOM for ${title}`,
    body: [
      "Dear Rtr./Member,",
      "",
      `Please find attached the Minutes of Meeting for "${title}", conducted on ${date}.`,
      "",
      "Regards,",
      "Rotaract Club of Pune Heritage",
    ].join("\n"),
  };
}

export function validateMomEmailDraft(draft = {}) {
  const groups = Array.isArray(draft.recipientGroups) ? draft.recipientGroups : [];
  const targetUserIds = Array.isArray(draft.targetUserIds) ? draft.targetUserIds.map((uid) => text(uid, 160)).filter(Boolean) : [];
  const allowed = new Set(MOM_RECIPIENT_GROUP_OPTIONS.map((item) => item.value));
  if (groups.some((group) => !allowed.has(lower(group, 40)))) {
    return "Choose a valid recipient group.";
  }
  if (targetUserIds.some((uid) => uid.includes("@"))) {
    return "Choose specific members from the member list.";
  }
  if (!groups.length && !targetUserIds.length) {
    return "Choose at least one recipient group or specific member.";
  }
  if (!text(draft.subject, 180)) return "Enter an email subject.";
  if (!text(draft.body, 6000)) return "Enter an email message.";
  return "";
}

export function momUploadError(error) {
  const code = lower(error?.code, 80);
  const safeMessages = new Set([
    "Authenticated user required.",
    "MOM upload authorization was incomplete.",
    "MOM metadata is missing for this record.",
    "The MOM PDF upload failed.",
    "The selected file could not be read.",
    "The MOM PDF could not be attached. It may have been moved or deleted in Drive.",
    "Email sending is not configured for MOM.",
  ]);
  if (safeMessages.has(error?.message)) return error.message;
  if (typeof error?.message === "string" && error.message.startsWith("No eligible recipients found for ")) {
    return error.message;
  }

  if (code === "functions/unauthenticated") return "Sign in again before uploading MOM.";
  if (code === "functions/permission-denied") return "You do not have permission to manage MOM for this record.";
  if (code === "functions/not-found") return "The event or MOM file could not be found.";
  if (code === "functions/invalid-argument") return "The MOM upload details were rejected.";
  if (code === "functions/failed-precondition") return "MOM is not available for this record.";
  if (code === "upload-failed" || code === "download-failed") return error?.message || "The MOM PDF could not be opened.";

  return "The MOM request could not be completed. Please retry.";
}
