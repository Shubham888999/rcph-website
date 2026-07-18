import { normalizeProspectProgress } from "../prospect/prospectModel.js";
import { normalizeDashboardResolutions } from "../resolutions/resolutionModel.js";

const ROLES = new Set(["prospect", "gbm", "bod", "admin", "president"]);
const PRIORITIES = new Set(["normal", "important", "urgent"]);
const ATTACHMENT_KINDS = new Set(["image", "pdf"]);
const ATTACHMENT_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

function text(value, max = 300) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function count(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function percentage(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100
    ? value
    : null;
}

export function normalizeDateOnly(value) {
  if (typeof value !== "string") return "";
  const parts = value.split("-");
  if (parts.length !== 3 || parts[0].length !== 4 || parts[1].length !== 2 || parts[2].length !== 2) return "";
  if (parts.some((part) => Array.from(part).some((character) => character < "0" || character > "9"))) return "";
  const [year, month, day] = parts.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? value
    : "";
}

function normalizeAvenues(value) {
  const source = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(source.map((item) => text(item, 40)).filter(Boolean))];
}

export function normalizeDashboardEvent(raw, attendance = false) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const id = text(raw.id, 160);
  const name = text(raw.name, 180);
  const date = normalizeDateOnly(raw.date);
  if (!id || !name || !date) return null;
  const endDate = normalizeDateOnly(raw.endDate);
  const event = {
    id,
    name,
    date,
    endDate: endDate && endDate >= date ? endDate : "",
    avenues: normalizeAvenues(raw.avenue),
    description: text(raw.desc, 1200),
  };
  if (!attendance) return event;
  return {
    ...event,
    value: raw.value === true ? true : raw.value === false ? false : "NA",
    label: ["Present", "Absent", "NA"].includes(raw.label) ? raw.label : "NA",
  };
}

function normalizeBreakdown(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const avenue = text(row?.avenue, 60);
    const present = count(row?.present);
    const totalCounted = count(row?.totalCounted);
    const pct = percentage(row?.percentage);
    return avenue && present !== null && totalCounted !== null && pct !== null
      ? { avenue, present, totalCounted, percentage: pct }
      : null;
  }).filter(Boolean);
}

function normalizeAttendance(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    totalCounted: count(source.totalCounted),
    present: count(source.present),
    absent: count(source.absent),
    na: count(source.na),
    percentage: percentage(source.percentage),
    avenueBreakdown: normalizeBreakdown(source.avenueBreakdown),
    recent: Array.isArray(source.recent)
      ? source.recent.map((event) => normalizeDashboardEvent(event, true)).filter(Boolean)
      : [],
  };
}

function normalizeIsoDate(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  const millis = Date.parse(value);
  return Number.isFinite(millis) ? new Date(millis).toISOString() : "";
}

function normalizeAnnouncementAttachment(raw) {
  if (!raw || typeof raw !== "object" || raw.status !== "ready") return null;
  const filename = text(raw.filename, 180);
  const mimeType = text(raw.mimeType, 120).toLowerCase();
  const kind = text(raw.kind, 20).toLowerCase();
  const sizeBytes = Number(raw.sizeBytes);
  if (!filename || !ATTACHMENT_KINDS.has(kind) || !ATTACHMENT_MIME_TYPES.has(mimeType) || !Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) return null;
  return { status: "ready", filename, mimeType, kind, sizeBytes };
}

export function normalizeDashboardAnnouncements(raw, now = Date.now()) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  return raw.map((item) => {
    const id = text(item?.id, 160);
    const title = text(item?.title, 160);
    const body = text(item?.body, 5000);
    if (!id || id.includes("/") || seen.has(id) || !title || !body || title.includes("<") || body.includes("<")) return null;
    const expiresAt = normalizeIsoDate(item.expiresAt);
    if (expiresAt && Date.parse(expiresAt) <= now) return null;
    const publishedAt = normalizeIsoDate(item.publishedAt);
    let actionText = text(item.actionText, 80);
    let actionUrl = text(item.actionUrl, 1000);
    try {
      const parsed = new URL(actionUrl);
      if (parsed.protocol !== "https:") throw new Error("unsafe");
      actionUrl = parsed.href;
    } catch {
      actionText = "";
      actionUrl = "";
    }
    seen.add(id);
    return {
      id,
      title,
      body,
      priority: PRIORITIES.has(text(item.priority, 24).toLowerCase())
        ? text(item.priority, 24).toLowerCase()
        : "normal",
      actionText: actionUrl ? actionText : "",
      actionUrl,
      publishedAt,
      expiresAt,
      read: item.read === true,
      attachment: normalizeAnnouncementAttachment(item.attachment),
    };
  }).filter(Boolean)
    .sort((a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0) || b.id.localeCompare(a.id))
    .slice(0, 5);
}

export function normalizeDashboardProfile(raw) {
  if (!raw || typeof raw !== "object") return null;
  const role = text(raw.role, 40).toLowerCase();
  if (!ROLES.has(role)) return null;
  const authority = raw.authority && typeof raw.authority === "object" ? raw.authority : {};
  const profile = {
    name: text(raw.name, 160),
    email: text(raw.email, 320),
    role,
    phone: text(raw.phone, 40),
    rotaryId: text(raw.rotaryId || raw.rid, 40),
    dateOfBirth: normalizeDateOnly(raw.dateOfBirth),
    gender: text(raw.gender, 40).toLowerCase(),
    genderSelfDescribe: text(raw.genderSelfDescribe, 160),
    hobbies: text(raw.hobbies, 600),
    clubPosition: text(raw.clubPosition, 120),
    memberName: text(raw.memberName, 160),
    memberPosition: text(raw.memberPosition, 120),
    positionKeys: Array.isArray(raw.positionKeys)
      ? [...new Set(raw.positionKeys.map((key) => text(key, 80).toLowerCase()).filter(Boolean))]
      : [],
    hasPresidentAuthority: authority.hasPresidentAuthority === true,
    hasWebsiteDirectorPosition: authority.hasWebsiteDirectorPosition === true,
  };
  if (role !== "prospect") return profile;
  return {
    ...profile,
    previousRotaract: raw.previousRotaract === true,
    previousRotaractDetails: text(raw.previousRotaractDetails === "N/A" ? "" : raw.previousRotaractDetails, 1200),
    joinReason: text(raw.joinReason, 1200),
    referred: raw.referred === true,
    referredBy: text(raw.referredBy === "N/A" ? "" : raw.referredBy, 160),
  };
}

function normalizeRanking(raw) {
  if (!raw || raw.enabled !== true) return { enabled: false, value: "", subtitle: "" };
  const value = text(raw.value, 80);
  return value ? { enabled: true, value, subtitle: text(raw.subtitle, 120) } : { enabled: false, value: "", subtitle: "" };
}

export function normalizeDashboardResponse(raw, now = Date.now()) {
  if (!raw || typeof raw !== "object" || raw.ok !== true) throw new TypeError("Dashboard response is invalid.");
  const mode = raw.mode === "prospect" ? "prospect" : "member";
  const profile = normalizeDashboardProfile(raw.profile);
  if (!profile || (mode === "prospect" && profile.role !== "prospect")) {
    throw new TypeError("Dashboard profile is invalid.");
  }
  const upcomingEvents = Array.isArray(raw.upcomingEvents)
    ? raw.upcomingEvents.map((event) => normalizeDashboardEvent(event)).filter(Boolean)
    : [];
  const base = {
    mode,
    profile,
    clubRanking: normalizeRanking(raw.clubRanking),
    announcements: normalizeDashboardAnnouncements(raw.announcements, now),
    openResolutions: normalizeDashboardResolutions(raw.openResolutions),
    upcomingEvents,
  };
  if (mode === "prospect") {
    const prospectProgress = normalizeProspectProgress(raw.prospectProgress);
    if (!prospectProgress) throw new TypeError("Prospect progress is invalid.");
    return { ...base, prospectProgress };
  }
  const stats = raw.clubStats && typeof raw.clubStats === "object" ? raw.clubStats : {};
  return {
    ...base,
    myAttendance: normalizeAttendance(raw.myAttendance),
    districtAttendance: normalizeAttendance(raw.districtAttendance),
    clubStats: {
      totalEvents: count(stats.totalEvents),
      totalPublicEvents: count(stats.totalPublicEvents),
      mostActiveAvenue: text(stats.mostActiveAvenue, 60),
      clubAverageAttendance: percentage(stats.clubAverageAttendance),
      myRank: count(stats.myRank),
      rankedMemberCount: count(stats.rankedMemberCount),
      eventsByAvenue: Array.isArray(stats.eventsByAvenue)
        ? stats.eventsByAvenue.map((row) => {
          const avenue = text(row?.avenue, 60);
          const value = count(row?.count);
          return avenue && value !== null ? { avenue, count: value } : null;
        }).filter(Boolean)
        : [],
    },
  };
}

export function mergeDashboardProfile(data, incomingProfile) {
  if (!data || typeof data !== "object" || !data.profile) return data;
  const normalized = normalizeDashboardProfile({
    ...data.profile,
    ...(incomingProfile || {}),
    role: data.profile.role,
  });
  return normalized ? { ...data, profile: normalized } : data;
}

export function formatDashboardDate(value) {
  const date = normalizeDateOnly(value);
  if (!date) return "";
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export function getDashboardErrorMessage() {
  return "Your dashboard could not be loaded. Please retry the protected request.";
}
