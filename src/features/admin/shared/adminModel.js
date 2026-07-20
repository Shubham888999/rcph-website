import { stripRotaractorPrefix } from "../../../utils/memberName.js";
import { MOM_TARGET_TYPES, normalizeMomEmailHistory, normalizeMomMetadata } from "../../mom/momModel.js";

export const DISTRICT_OFFICIAL_ROLE = "districtOfficial";
export const ADMIN_ROLES = ["gbm", "bod", "admin", DISTRICT_OFFICIAL_ROLE, "president"];
export const ADMIN_ROLE_LABELS = Object.freeze({
  gbm: "GBM",
  bod: "BOD",
  admin: "Admin",
  president: "President",
  [DISTRICT_OFFICIAL_ROLE]: "District Official",
});
export const ATTENDANCE_VALUES = [true, false, "NA"];
export const AVENUES = ["ISD", "CMD", "CSD", "PDD", "RRRO", "PRO", "DEI", "GBM"];
export const LOCK_KEYS = [
  "attendance",
  "bodAttendance",
  "bodEvents",
  "fines",
  "treasury",
];
export function text(value, max = 5000) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}
export function timestampIso(value) {
  try { const d = value?.toDate?.() || (value instanceof Date ? value : null); return d && !Number.isNaN(d.getTime()) ? d.toISOString() : ""; } catch { return ""; }
}
export function safeUrl(value) {
  try { const url = new URL(text(value, 1000)); return ["https:", "http:"].includes(url.protocol) ? url.href : ""; } catch { return ""; }
}
export function money(value) { const n = Number(value); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null; }
export function formatInr(value) { const amount = money(value); return amount === null ? "Unavailable" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount); }
export function cleanAvenues(value) { const values = Array.isArray(value) ? value : value ? [value] : []; return [...new Set(values.map((x) => text(x, 40).toUpperCase()).filter(Boolean))]; }
export function normalizeAttendance(value) { return value === true || value === false || value === "NA" ? value : "NA"; }
export function attendancePatch(eventId, value) { const id = text(eventId, 128); if (!id || id.includes("/")) throw new TypeError("Valid event ID required."); return { [id]: normalizeAttendance(value) }; }
export function normalizeAdminRole(value) {
  const raw = text(value, 60).toLowerCase();
  if (raw.replace(/[\s_-]+/g, "") === "districtofficial") return DISTRICT_OFFICIAL_ROLE;
  return raw;
}
export function formatAdminRole(value) {
  return ADMIN_ROLE_LABELS[normalizeAdminRole(value)] || text(value, 60) || "Unknown";
}
export function buildEventAttendanceSummary({
  participants = [],
  attendance = {},
  eventId = "",
} = {}) {
  const roster = Array.isArray(participants)
    ? participants
    : [];

  const safeAttendance =
    attendance && typeof attendance === "object"
      ? attendance
      : {};

  const safeEventId = text(eventId, 128);

  let presentCount = 0;
  let absentCount = 0;
  let naCount = 0;
  let unmarkedCount = 0;

  roster.forEach((participant) => {
    const participantId = text(
      participant?.id,
      128,
    );

    const row =
      participantId &&
      safeAttendance[participantId] &&
      typeof safeAttendance[participantId] === "object"
        ? safeAttendance[participantId]
        : null;

    const hasAttendanceValue =
      row &&
      safeEventId &&
      Object.prototype.hasOwnProperty.call(
        row,
        safeEventId,
      );

    if (!hasAttendanceValue) {
      unmarkedCount += 1;
      return;
    }

    const value = row[safeEventId];

    if (value === true) {
      presentCount += 1;
    } else if (value === false) {
      absentCount += 1;
    } else if (value === "NA") {
      naCount += 1;
    } else {
      unmarkedCount += 1;
    }
  });

  const eligibleCount =
    presentCount + absentCount;

  const percentage = eligibleCount
    ? Math.round(
        (presentCount / eligibleCount) *
          1000,
      ) / 10
    : null;

  return {
    presentCount,
    absentCount,
    naCount,
    unmarkedCount,
    eligibleCount,
    rosterCount: roster.length,
    percentage,
  };
}
export function normalizeAdminUser(id, raw) {
  if (!id || !raw || typeof raw !== "object") return null;
  const status = text(raw.status, 30).toLowerCase() || "pending";
  const districtOfficialPosition = text(raw.districtOfficialPosition || raw.districtPosition || raw.position, 180);
  return {
    id,
    name: stripRotaractorPrefix(text(raw.name, 160)) || "Unnamed account",
    email: text(raw.email, 320).toLowerCase(),
    phone: text(raw.phone, 40),
    rotaryId: text(raw.rotaryId || raw.rid, 40),
    dateOfBirth: validDate(text(raw.dateOfBirth, 20)) ? text(raw.dateOfBirth, 20) : "",
    gender: text(raw.gender, 40).toLowerCase(),
    genderSelfDescribe: text(raw.genderSelfDescribe, 160),
    hobbies: text(raw.hobbies, 600),
    previousRotaract: raw.previousRotaract === true,
    previousRotaractDetails: text(raw.previousRotaractDetails === "N/A" ? "" : raw.previousRotaractDetails, 1200),
    joinReason: text(raw.joinReason, 1200),
    referred: raw.referred === true,
    referredBy: text(raw.referredBy === "N/A" ? "" : raw.referredBy, 160),
    role: normalizeAdminRole(raw.role),
    requestedRole: normalizeAdminRole(raw.requestedRole),
    status,
    provider: text(raw.provider, 40),
    position: text(raw.position, 180),
    districtOfficialPosition,
    districtPosition: text(raw.districtPosition, 180) || districtOfficialPosition,
    positionKeys: Array.isArray(raw.positionKeys) ? [...new Set(raw.positionKeys.map((x) => text(x, 80)).filter(Boolean))] : [],
    hasExplicitPositionKeys: Array.isArray(raw.positionKeys),
    clubPosition: text(raw.clubPosition, 180),
    rejectReason: text(raw.rejectReason, 500),
    requestedRid: text(raw.requestedRid, 40),
    requestedRidStatus: text(raw.requestedRidStatus, 40),
    requestedRidMemberId: text(raw.requestedRidMemberId, 128),
    requestedRidConflict: raw.requestedRidConflict === true,
    createdAt: timestampIso(raw.createdAt),
    active: raw.active !== false,
  };
}
export function normalizeMember(id, raw) { if (!id || !raw || typeof raw !== "object") return null; return { id, userId: text(raw.userId || raw.uid, 128), name: stripRotaractorPrefix(text(raw.name, 160)) || "Unnamed member", email: text(raw.email, 320).toLowerCase(), rid: text(raw.rid, 40), role: text(raw.role, 30), position: text(raw.position || raw.clubPosition, 180), active: raw.active !== false }; }
export function normalizeEvent(id, raw, kind = "club") {
  if (!id || !raw || typeof raw !== "object") return null;
  const date = text(raw.date || raw.eventStart, 20); if (!text(raw.name, 180) || !validDate(date)) return null;
  const end = text(raw.endDate || raw.eventEnd, 20);
  const momTargetType = kind === "bodMeeting" ? MOM_TARGET_TYPES.BOD_MEETING : kind === "districtEvent" ? MOM_TARGET_TYPES.DISTRICT_EVENT : MOM_TARGET_TYPES.CLUB_EVENT;
  return { id, name: text(raw.name, 180), date, endDate: validDate(end) && end >= date ? end : "", desc: text(raw.desc || raw.description, 2500), avenue: cleanAvenues(raw.avenue), visibility: text(raw.visibility, 20) || "public", archived: raw.archived === true, kind, rcphRole: text(raw.rcphRole, 30), hostClub: text(raw.hostClub, 180), collaborators: Array.isArray(raw.collaborators) ? raw.collaborators.map((x) => text(typeof x === "string" ? x : x?.name, 180)).filter(Boolean) : [], createdByName: text(raw.createdByName, 160), mom: normalizeMomMetadata(raw, { momTargetType, momTargetId: id }), momEmail: normalizeMomEmailHistory(raw.momEmail || raw) };
}
export function normalizeFine(id, raw) {
  const amount = money(raw?.amount);

  if (
    !id ||
    !raw ||
    amount === null ||
    !validDate(text(raw.date, 20))
  ) {
    return null;
  }

  return {
    id,
    memberId: text(raw.memberId, 128),
    memberName: stripRotaractorPrefix(
      text(raw.memberName, 160),
    ),
    reason: text(raw.reason, 120),

    eventId: text(raw.eventId, 128),
    eventSource: text(raw.eventSource, 40),
    eventType: text(raw.eventType, 40),
    eventName: text(raw.eventName, 180),
    eventDate: text(raw.eventDate, 20),

    date: text(raw.date, 20),
    amount,

    treasuryEntryId: text(
      raw.treasuryEntryId,
      128,
    ),
  };
}
export function normalizeTreasury(id, raw) { const amount = money(raw?.amount); const type = text(raw?.type, 20).toLowerCase(); if (!id || !raw || amount === null || amount <= 0 || !["income", "expense"].includes(type) || !validDate(text(raw.date, 20))) return null; return { id, title: text(raw.title || raw.name, 180), type, amount, date: text(raw.date, 20), avenue: text(raw.avenue, 40), purpose: text(raw.purpose || raw.linkedEventName, 500), paidBy: text(raw.paidBy, 180), paidByType: text(raw.paidByType, 20), paidByMemberId: text(raw.paidByMemberId, 128), paidTo: text(raw.paidTo, 180), paidToType: text(raw.paidToType, 20), paidToMemberId: text(raw.paidToMemberId, 128), paymentMode: text(raw.paymentMode, 80), referenceNumber: text(raw.referenceNumber || raw.cheque, 180), reimbursementStatus: text(raw.reimbursementStatus || raw.reimburse, 80), reimbursedTo: text(raw.reimbursedTo, 180), reimbursementDate: validDate(text(raw.reimbursementDate, 20)) ? text(raw.reimbursementDate, 20) : "", billUrl: safeUrl(raw.billUrl), billDriveFileId: text(raw.billDriveFileId || raw.billFileId, 180), billFileName: text(raw.billFileName, 180), billMimeType: text(raw.billMimeType, 100).toLowerCase(), billSizeBytes: Number.isFinite(raw.billSizeBytes) && raw.billSizeBytes >= 0 ? raw.billSizeBytes : 0, billFolderId: text(raw.billFolderId, 180), billFolderUrl: safeUrl(raw.billFolderUrl), billFolderName: text(raw.billFolderName, 180),
  source: text(raw.source, 40),

fineId: text(raw.fineId, 128),

memberId: text(raw.memberId, 128),

memberName: stripRotaractorPrefix(
  text(raw.memberName, 160),
),

eventId: text(raw.eventId, 128),

eventSource: text(
  raw.eventSource,
  40,
),

eventType: text(raw.eventType, 40),

eventName: text(raw.eventName, 180),

eventDate: validDate(
  text(raw.eventDate, 20),
)
  ? text(raw.eventDate, 20)
  : "", createdAt: timestampIso(raw.createdAt), updatedAt: timestampIso(raw.updatedAt), createdByUid: text(raw.createdByUid || raw.createdBy, 128), createdByName: text(raw.createdByName, 160), updatedByUid: text(raw.updatedByUid || raw.updatedBy, 128), updatedByName: text(raw.updatedByName, 160) }; }
export function canUseAdmin(access) { return access?.isApproved === true && access?.canAccessAdminTools === true; }
export function canUsePresidentControls(access) { return canUseAdmin(access) && access?.canAccessPresidentControls === true; }
export function attendanceParticipantRole(value, fallback = "") {
  const role = text(value?.role || value?.storedRole || value?.requestedRole, 30).toLowerCase();
  const memberType = text(value?.memberType, 30).toLowerCase();
  if (role === "prospect" || memberType === "prospect") return "prospect";
  if (role === "gbm" || memberType === "member") return "gbm";
  if (["bod", "admin", "president"].includes(role)) return role;
  return fallback;
}
export function buildAttendanceParticipants({ members = [], users = [], attendance = {}, includeUsers = true } = {}) {
  const participants = [];
  const uidIndex = new Map();
  const emailIndex = new Map();

  function remember(participant) {
    const uid = text(participant.userId || participant.id, 128);
    const email = text(participant.email, 320).toLowerCase();
    if (uid) uidIndex.set(uid, participant);
    if (email) emailIndex.set(email, participant);
  }

  function add(participant) {
    const id = text(participant.id, 128);
    if (!id || id.includes("/")) return;
    const userId = text(participant.userId || id, 128);
    const email = text(participant.email, 320).toLowerCase();
    if ((userId && uidIndex.has(userId)) || (email && emailIndex.has(email))) return;
    const role = attendanceParticipantRole(participant, participant.roleFallback || "");
    const normalized = {
      id,
      userId,
      name: stripRotaractorPrefix(text(participant.name, 160)) || participant.nameFallback || "Manual attendance row",
      email,
      role,
      memberType: text(participant.memberType, 30).toLowerCase(),
      position: text(participant.position || participant.clubPosition, 180),
      active: participant.active !== false,
      manualAttendanceOnly: participant.manualAttendanceOnly === true,
    };
    participants.push(normalized);
    remember(normalized);
  }

  (Array.isArray(members) ? members : [])
    .filter(member => member?.active !== false)
    .forEach(member => {
      const userId = text(member.userId || member.id, 128);
      add({ ...member, id: userId || member.id, userId, roleFallback: "gbm" });
    });

  if (includeUsers) {
    (Array.isArray(users) ? users : [])
      .filter(user => {
        if (!user || user.active === false || user.status !== "approved") return false;
        return ["prospect", "gbm"].includes(attendanceParticipantRole(user));
      })
      .forEach(user => add({ ...user, id: user.id, userId: user.id }));
  }

  Object.keys(attendance && typeof attendance === "object" ? attendance : {})
    .forEach((id) => add({ id, userId: id, nameFallback: `Manual row ${id.slice(0, 8)}`, manualAttendanceOnly: true }));

  return participants.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
export function buildAccessPayload({ targetUid, role, positionKeys = [], confirmJointPositionKeys = [], mode = "maintenance" }) {
  const normalizedRole = normalizeAdminRole(role);
  return {
    targetUid: text(targetUid, 128),
    role: ADMIN_ROLES.includes(normalizedRole) ? normalizedRole : "",
    positionKeys: [...new Set(positionKeys.map((x) => text(x, 80)).filter(Boolean))],
    confirmJointPositionKeys: [...new Set(confirmJointPositionKeys.map((x) => text(x, 80)).filter(Boolean))],
    operationSource: mode === "approval" ? "accountApproval" : "roleMaintenance",
  };
}
export function buildEventPayload(draft, id = "") { const payload = { name: text(draft.name, 180), date: text(draft.date, 20), endDate: text(draft.endDate, 20) || text(draft.date, 20), desc: text(draft.desc, 2500), avenue: cleanAvenues(draft.avenue) }; if (id) payload.eventId = text(id, 128); return payload; }
export function buildFinePayload(draft) {
  return {
    memberId: text(draft.memberId, 128),

    memberName: stripRotaractorPrefix(
      text(draft.memberName, 160),
    ),

    reason: text(draft.reason, 120),

    eventId: text(draft.eventId, 128),
    eventSource: text(
      draft.eventSource,
      40,
    ),
    eventType: text(draft.eventType, 40),
    eventName: text(draft.eventName, 180),
    eventDate: text(draft.eventDate, 20),

    date: text(draft.date, 20),
    amount: money(draft.amount),
  };
}
function fineEventOption({
  event,
  source,
  type,
  group,
}) {
  return {
    value: `${source}:${event.id}`,
    id: event.id,
    source,
    type,
    group,
    name: event.name,
    date: event.date,
    endDate: event.endDate || "",
    archived: event.archived === true,
    label: `${event.name} — ${event.date}`,
  };
}

export function buildFineEventGroups({
  events = [],
  bodMeetings = [],
  districtEvents = [],
} = {}) {
  const active = (items) =>
    items.filter(
      (item) =>
        item &&
        item.id &&
        item.name &&
        item.date &&
        item.archived !== true,
    );

  const clubEvents = [];
  const gbms = [];

  active(events).forEach((event) => {
    // District events are mirrored into events.
    // Exclude those here to avoid duplicates.
    if (
      event.kind === "districtEvent" ||
      event.districtEventId
    ) {
      return;
    }

    const isGbm = Array.isArray(event.avenue)
      && event.avenue.some(
        (avenue) =>
          String(avenue).toUpperCase() === "GBM",
      );

    const option = fineEventOption({
      event,
      source: "events",
      type: isGbm ? "gbm" : "clubEvent",
      group: isGbm
        ? "GBMs"
        : "Club / Avenue Events",
    });

    if (isGbm) gbms.push(option);
    else clubEvents.push(option);
  });

  const bodOptions = active(bodMeetings).map(
    (event) =>
      fineEventOption({
        event,
        source: "bodMeetings",
        type: "bodMeeting",
        group: "BOD Meetings",
      }),
  );

  const districtOptions = active(
    districtEvents,
  ).map((event) =>
    fineEventOption({
      event,
      source: "districtEvents",
      type: "districtEvent",
      group: "District Events / Meetings",
    }),
  );

  const newestFirst = (a, b) =>
    String(b.date).localeCompare(
      String(a.date),
    ) ||
    String(a.name).localeCompare(
      String(b.name),
    );

  return [
    {
      key: "gbm",
      label: "GBMs",
      options: gbms.sort(newestFirst),
    },
    {
      key: "club",
      label: "Club / Avenue Events",
      options: clubEvents.sort(newestFirst),
    },
    {
      key: "bod",
      label: "BOD Meetings",
      options: bodOptions.sort(newestFirst),
    },
    {
      key: "district",
      label: "District Events / Meetings",
      options: districtOptions.sort(
        newestFirst,
      ),
    },
  ].filter(
    (group) => group.options.length,
  );
}

export function findFineEventOption(
  groups,
  value,
) {
  return (
    groups
      .flatMap((group) => group.options)
      .find((option) => option.value === value)
    || null
  );
}
export const ANNOUNCEMENT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const ANNOUNCEMENT_ATTACHMENT_TYPES = Object.freeze(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
export function formatAttachmentSize(sizeBytes) {
  const value = Number(sizeBytes);
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${Math.round(value)} B`;
}
export function validateAnnouncementAttachmentFile(file) {
  if (!file) return "Choose an image or PDF attachment.";
  if (!ANNOUNCEMENT_ATTACHMENT_TYPES.includes(file.type)) return "Choose a PDF, JPEG, PNG, or WebP file.";
  if (!Number.isSafeInteger(file.size) || file.size <= 0) return "The selected attachment is empty.";
  if (file.size > ANNOUNCEMENT_ATTACHMENT_MAX_BYTES) return `Attachment must be ${formatAttachmentSize(ANNOUNCEMENT_ATTACHMENT_MAX_BYTES)} or smaller.`;
  return "";
}
export function buildAnnouncementPayload(draft) { const attachmentSessionId = text(draft.attachmentSessionId, 160); return { title: text(draft.title, 160), body: text(draft.body, 5000), priority: ["normal", "important", "urgent"].includes(draft.priority) ? draft.priority : "normal", actionText: text(draft.actionText, 80), actionUrl: draft.actionUrl ? safeUrl(draft.actionUrl) : "", targetRoles: [...new Set((draft.targetRoles || []).filter((x) => ["all", "prospect", "gbm", "bod", "admin", "president"].includes(x)))], targetUserIds: [...new Set((draft.targetUserIds || []).map((x) => text(x, 128)).filter(Boolean))], expiresAt: draft.expiresAt || null, sendEmail: draft.sendEmail === true, ...(attachmentSessionId ? { attachmentSessionId } : {}) }; }
