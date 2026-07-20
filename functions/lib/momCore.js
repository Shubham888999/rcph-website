const MOM_TARGET_TYPES = Object.freeze({
  CLUB_EVENT: "club_event",
  BOD_MEETING: "bod_meeting",
  DISTRICT_EVENT: "district_event",
  BOD_EVENT: "bod_event",
});

const MOM_TARGET_COLLECTIONS = Object.freeze({
  [MOM_TARGET_TYPES.CLUB_EVENT]: "events",
  [MOM_TARGET_TYPES.BOD_MEETING]: "bodMeetings",
  [MOM_TARGET_TYPES.DISTRICT_EVENT]: "districtEvents",
  [MOM_TARGET_TYPES.BOD_EVENT]: "bodEvents",
});

const MOM_DRIVE_FOLDER_NAME = "RCPH MOM Uploads";
const MOM_PDF_MAX_BYTES = 10 * 1024 * 1024;
const MOM_SESSION_COLLECTION = "momUploadSessions";
const MOM_EMAIL_HISTORY_COLLECTION = "momEmailHistory";
const MOM_EMAIL_RECIPIENT_GROUPS = Object.freeze([
  "all",
  "bod",
  "gbm",
  "prospect",
  "admin",
  "president",
  "secretary",
  "saa",
]);
const MOM_EMAIL_MAX_RECIPIENTS = 500;

const MOM_SUBFOLDER_BY_TARGET_TYPE = Object.freeze({
  [MOM_TARGET_TYPES.CLUB_EVENT]: "Club Events",
  [MOM_TARGET_TYPES.BOD_MEETING]: "BOD Meetings",
  [MOM_TARGET_TYPES.DISTRICT_EVENT]: "District Events",
  [MOM_TARGET_TYPES.BOD_EVENT]: "BOD Events",
});

const PRESIDENT_POSITION_KEYS = new Set([
  "president",
  "co-president",
]);

const SECRETARY_POSITION_KEYS = new Set([
  "secretary",
  "joint-secretary",
  "co-secretary",
]);

const SERGEANT_POSITION_KEYS = new Set([
  "saa",
  "co-saa",
  "sergeant",
  "sergeant-at-arms",
]);

const BOD_POSITION_KEYS = new Set([
  "president",
  "immediate-past-president",
  "vice-president",
  "secretary",
  "joint-secretary",
  "treasurer",
  "club-advisor",
  "csd",
  "cmd",
  "isd",
  "pdd",
  "rrro",
  "pro",
  "dei",
  "editor",
  "cwd",
  "sports-representative",
  "wrwc",
  "wr",
  "saa",
  "co-president",
  "co-vice-president",
  "co-secretary",
  "co-treasurer",
  "co-club-advisor",
  "co-csd",
  "co-cmd",
  "co-isd",
  "co-pdd",
  "co-rrro",
  "co-pro",
  "co-dei",
  "co-editor",
  "co-cwd",
  "co-sports-representative",
  "co-wrwc",
  "co-wr",
  "co-saa",
]);

function cleanText(value, max = 300) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanLower(value, max = 120) {
  return cleanText(value, max).toLowerCase();
}

function safeDocumentId(value) {
  const id = cleanText(value, 180);
  return /^[A-Za-z0-9_-]{1,180}$/.test(id) ? id : "";
}

function normalizePositionKeys(...sources) {
  const keys = [];
  sources.flatMap((source) => Array.isArray(source) ? source : [source])
    .forEach((value) => {
      cleanText(value, 180)
        .toLowerCase()
        .split(/[,;/|]+/)
        .map((item) => item.trim().replace(/\s+/g, "-"))
        .filter(Boolean)
        .forEach((item) => keys.push(item));
    });
  return [...new Set(keys)];
}

function normalizeMomAccess({ uid = "", user = {}, role = {}, token = {} } = {}) {
  const safeUid = cleanText(uid, 160);
  const roleDocument = role && typeof role === "object" ? role : {};
  const userDocument = user && typeof user === "object" ? user : {};
  const tokenDocument = token && typeof token === "object" ? token : {};
  const storedRole = cleanLower(
    roleDocument.role
      || roleDocument.storedRole
      || userDocument.role
      || userDocument.storedRole
      || userDocument.requestedRole,
    40,
  );
  const userStatus = cleanLower(userDocument.status, 40);
  const roleStatus = cleanLower(
    roleDocument.status
      || roleDocument.roleStatus
      || userDocument.roleStatus
      || userDocument.status,
    40,
  );
  const positionKeys = normalizePositionKeys(
    roleDocument.positionKeys,
    userDocument.positionKeys,
    userDocument.clubPosition,
    userDocument.position,
  );
  const authority = {
    ...(userDocument.authority && typeof userDocument.authority === "object" ? userDocument.authority : {}),
    ...(roleDocument.authority && typeof roleDocument.authority === "object" ? roleDocument.authority : {}),
  };
  const hasPresidentAuthority = authority.hasPresidentAuthority === true
    || authority.canAccessPresidentControls === true
    || roleDocument.hasPresidentAuthority === true
    || userDocument.hasPresidentAuthority === true
    || positionKeys.includes("president")
    || positionKeys.includes("co-president");
  const isApproved = Boolean(
    safeUid
      && storedRole
      && userDocument.active !== false
      && (!userStatus || userStatus === "approved")
      && roleStatus === "approved",
  );
  const displayName = cleanText(
    userDocument.name
      || userDocument.displayName
      || tokenDocument.name
      || tokenDocument.email
      || "Unknown user",
    180,
  );

  return {
    uid: safeUid,
    storedRole,
    positionKeys,
    isApproved,
    hasPresidentAuthority,
    displayName,
  };
}

function hasSecretaryPosition(access) {
  return normalizePositionKeys(access?.positionKeys)
    .some((key) => SECRETARY_POSITION_KEYS.has(key));
}

function hasBodPosition(access) {
  return normalizePositionKeys(access?.positionKeys)
    .some((key) => BOD_POSITION_KEYS.has(key));
}

function canUploadMomAccess(access) {
  if (access?.isApproved !== true) return false;
  return access.storedRole === "admin"
    || access.storedRole === "president"
    || access.hasPresidentAuthority === true
    || hasSecretaryPosition(access);
}

function canViewMomAccess(access) {
  if (access?.isApproved !== true) return false;
  return canUploadMomAccess(access)
    || access.storedRole === "bod"
    || hasBodPosition(access);
}

function targetCollectionForType(targetType) {
  return MOM_TARGET_COLLECTIONS[cleanLower(targetType, 80)] || "";
}

function momDriveSubfolderName(targetType) {
  return MOM_SUBFOLDER_BY_TARGET_TYPE[cleanLower(targetType, 80)] || "Other MOM";
}

function validateMomTarget(target = {}) {
  const targetType = cleanLower(target.targetType, 80);
  const targetId = safeDocumentId(target.targetId);
  if (!targetCollectionForType(targetType)) {
    return { ok: false, code: "invalid-argument", message: "Choose a supported MOM target." };
  }
  if (!targetId) {
    return { ok: false, code: "invalid-argument", message: "Choose a valid event or meeting." };
  }
  return { ok: true, targetType, targetId, collectionName: targetCollectionForType(targetType) };
}

function normalizeMomRecipientGroupValue(value) {
  const group = cleanLower(value, 40).replace(/\s+/g, "-");
  if (group === "sergeant" || group === "sergeant-at-arms") return "saa";
  return group;
}

function normalizeMomRecipientGroups(value) {
  const source = Array.isArray(value) ? value : [value];
  const groups = [];
  source.forEach((item) => {
    const group = normalizeMomRecipientGroupValue(item);
    if (group && MOM_EMAIL_RECIPIENT_GROUPS.includes(group) && !groups.includes(group)) {
      groups.push(group);
    }
  });
  return groups.includes("all") ? ["all"] : groups;
}

function normalizeMomTargetUserIds(value) {
  const source = Array.isArray(value) ? value : value ? [value] : [];
  const ids = [];
  for (const item of source) {
    const raw = cleanText(item, 180);
    if (!raw) continue;
    if (raw.includes("@")) {
      return { ok: false, code: "invalid-argument", message: "MOM recipient user IDs must be UIDs, not email addresses." };
    }
    const uid = safeDocumentId(raw);
    if (!uid) {
      return { ok: false, code: "invalid-argument", message: "MOM recipient user IDs must be valid UIDs." };
    }
    if (!ids.includes(uid)) ids.push(uid);
  }
  return { ok: true, targetUserIds: ids };
}

function validateMomEmailRequest(input = {}) {
  const recipientGroups = normalizeMomRecipientGroups(input.recipientGroups || input.recipientRoles || input.targetRoles);
  const explicitUsers = normalizeMomTargetUserIds(input.targetUserIds || input.explicitUserIds);
  const subject = cleanText(input.subject, 180);
  const body = cleanText(input.body, 6000);
  if (!explicitUsers.ok) return explicitUsers;
  if (!recipientGroups.length && !explicitUsers.targetUserIds.length) {
    return { ok: false, code: "invalid-argument", message: "Choose at least one MOM email recipient group or specific member." };
  }
  if (!subject) {
    return { ok: false, code: "invalid-argument", message: "MOM email subject is required." };
  }
  if (!body) {
    return { ok: false, code: "invalid-argument", message: "MOM email body is required." };
  }
  return { ok: true, recipientGroups, targetUserIds: explicitUsers.targetUserIds, subject, body };
}

function hasAnyPositionKey(positionKeys, allowedKeys) {
  return normalizePositionKeys(positionKeys).some((key) => allowedKeys.has(key));
}

function momRecipientMatchesGroups(recipient = {}, groups = []) {
  const normalizedGroups = normalizeMomRecipientGroups(groups);
  if (!normalizedGroups.length) return false;
  if (normalizedGroups.includes('all')) return true;
  const role = cleanLower(recipient.role || recipient.storedRole, 40);
  const positionKeys = normalizePositionKeys(recipient.positionKeys);
  const hasPresident = recipient.hasPresidentAuthority === true || hasAnyPositionKey(positionKeys, PRESIDENT_POSITION_KEYS);
  const hasSecretary = hasAnyPositionKey(positionKeys, SECRETARY_POSITION_KEYS);
  const hasSergeant = hasAnyPositionKey(positionKeys, SERGEANT_POSITION_KEYS);
  return normalizedGroups.some((group) => {
    if (['prospect', 'gbm', 'admin'].includes(group)) return role === group;
    if (group === 'bod') return role === 'bod' || hasAnyPositionKey(positionKeys, BOD_POSITION_KEYS);
    if (group === 'president') return role === 'president' || hasPresident;
    if (group === 'secretary') return hasSecretary;
    if (group === 'saa') return hasSergeant;
    return false;
  });
}

function dedupeMomRecipients(recipients = []) {
  const byUid = new Map();
  const seenEmails = new Set();
  for (const recipient of Array.isArray(recipients) ? recipients : []) {
    const uid = safeDocumentId(recipient?.uid);
    const email = normalizeMomEmailAddress(recipient?.email);
    if (!uid || !email.ok || byUid.has(uid) || seenEmails.has(email.email)) continue;
    byUid.set(uid, { ...recipient, uid, email: email.email });
    seenEmails.add(email.email);
  }
  return Array.from(byUid.values()).sort((a, b) => a.uid.localeCompare(b.uid));
}

function momRecipientRequestLabel(request = {}) {
  const groups = normalizeMomRecipientGroups(request.recipientGroups || request.recipientRoles || request.targetRoles);
  const labels = {
    all: 'All',
    bod: 'BOD',
    gbm: 'GBM',
    prospect: 'Prospects',
    admin: 'Admin',
    president: 'President',
    secretary: 'Secretary',
    saa: 'Sergeant-at-Arms',
  };
  if (groups.length === 1) return labels[groups[0]] || 'selected group';
  if (groups.length > 1) return groups.map((group) => labels[group] || group).join(', ');
  const explicit = normalizeMomTargetUserIds(request.targetUserIds || request.explicitUserIds);
  if (explicit.ok && explicit.targetUserIds.length) return 'selected specific members';
  return 'selected recipients';
}

function normalizeMomEmailAddress(value) {
  const email = cleanLower(value, 320);
  if (!email) return { ok: false, email: "", code: "missing_email" };
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) {
    return { ok: false, email: "", code: "invalid_email" };
  }
  return { ok: true, email, code: "" };
}

function validateMomFileDescriptor(file = {}) {
  const rawName = typeof file.fileName === "string" ? file.fileName.trim() : "";
  const fileName = cleanText(rawName, 180);
  const mimeType = cleanLower(file.mimeType, 120) || "application/pdf";
  const sizeBytes = Number(file.sizeBytes);
  if (!rawName || rawName.length > 180 || !fileName) {
    return { ok: false, code: "invalid-argument", message: "Use a MOM PDF filename between 1 and 180 characters." };
  }
  if (!/\.pdf$/i.test(fileName)) {
    return { ok: false, code: "invalid-argument", message: "Only PDF files are accepted for MOM." };
  }
  if (mimeType !== "application/pdf") {
    return { ok: false, code: "invalid-argument", message: "Only PDF files are accepted for MOM." };
  }
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
    return { ok: false, code: "invalid-argument", message: "The selected MOM PDF is empty." };
  }
  if (sizeBytes > MOM_PDF_MAX_BYTES) {
    return { ok: false, code: "resource-exhausted", message: "The selected MOM PDF is larger than 10 MB." };
  }
  return { ok: true, fileName, mimeType, sizeBytes };
}

function safeMomFileName(value) {
  const fileName = cleanText(value, 180)
    .replace(/[\\/:*?"<>|#%{}[\]^~`]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .trim();
  return /\.pdf$/i.test(fileName) ? fileName : `${fileName || "mom"}.pdf`;
}

function isPdfBuffer(buffer) {
  return buffer?.subarray?.(0, 5).toString("ascii") === "%PDF-";
}

function isCanonicalBodMomTargetData(data = {}) {
  return data?.recordKind === "clubEvent"
    && data?.isSynced !== true
    && data?.isActive !== false
    && data?.archived !== true;
}

function buildMomMetadata({ target, previous = {}, upload = {}, access = {}, now }) {
  const hasPrevious = Boolean(previous?.momDriveFileId && previous?.momFileName);
  return {
    momDriveFileId: cleanText(upload.driveFileId, 180),
    momFileName: cleanText(upload.fileName, 180),
    momMimeType: "application/pdf",
    momUploadedBy: hasPrevious
      ? cleanText(previous.momUploadedBy, 160) || cleanText(access.uid, 160)
      : cleanText(access.uid, 160),
    momUploadedByName: hasPrevious
      ? cleanText(previous.momUploadedByName, 180) || cleanText(access.displayName, 180) || "Unknown user"
      : cleanText(access.displayName, 180) || "Unknown user",
    momUploadedAt: hasPrevious ? previous.momUploadedAt || now : now,
    momUpdatedAt: now,
    momReplacedBy: hasPrevious ? cleanText(access.uid, 160) : "",
    momReplacedByName: hasPrevious ? cleanText(access.displayName, 180) || "Unknown user" : "",
    momTargetType: cleanLower(target.targetType, 80),
    momTargetId: cleanText(target.targetId, 180),
  };
}

function serializeMomMetadata(metadata = {}) {
  const timestamp = (value) => {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
    if (typeof value.toDate === "function") {
      const date = value.toDate();
      return date && !Number.isNaN(date.getTime()) ? date.toISOString() : "";
    }
    return "";
  };

  return {
    momDriveFileId: cleanText(metadata.momDriveFileId, 180),
    momFileName: cleanText(metadata.momFileName, 180),
    momMimeType: cleanLower(metadata.momMimeType, 120) || "application/pdf",
    momUploadedBy: cleanText(metadata.momUploadedBy, 160),
    momUploadedByName: cleanText(metadata.momUploadedByName, 180),
    momUploadedAt: timestamp(metadata.momUploadedAt),
    momUpdatedAt: timestamp(metadata.momUpdatedAt),
    momReplacedBy: cleanText(metadata.momReplacedBy, 160),
    momReplacedByName: cleanText(metadata.momReplacedByName, 180),
    momTargetType: cleanLower(metadata.momTargetType, 80),
    momTargetId: cleanText(metadata.momTargetId, 180),
  };
}

module.exports = {
  MOM_TARGET_TYPES,
  MOM_TARGET_COLLECTIONS,
  MOM_DRIVE_FOLDER_NAME,
  MOM_PDF_MAX_BYTES,
  MOM_SESSION_COLLECTION,
  MOM_EMAIL_HISTORY_COLLECTION,
  MOM_EMAIL_RECIPIENT_GROUPS,
  MOM_EMAIL_MAX_RECIPIENTS,
  PRESIDENT_POSITION_KEYS,
  SECRETARY_POSITION_KEYS,
  SERGEANT_POSITION_KEYS,
  cleanText,
  cleanLower,
  safeDocumentId,
  normalizePositionKeys,
  normalizeMomAccess,
  hasSecretaryPosition,
  hasBodPosition,
  canUploadMomAccess,
  canViewMomAccess,
  targetCollectionForType,
  momDriveSubfolderName,
  validateMomTarget,
  normalizeMomRecipientGroups,
  normalizeMomTargetUserIds,
  validateMomEmailRequest,
  momRecipientMatchesGroups,
  dedupeMomRecipients,
  momRecipientRequestLabel,
  normalizeMomEmailAddress,
  validateMomFileDescriptor,
  safeMomFileName,
  isPdfBuffer,
  isCanonicalBodMomTargetData,
  buildMomMetadata,
  serializeMomMetadata,
};
