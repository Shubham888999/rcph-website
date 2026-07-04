import { AVENUES } from "../calendar/avenues.js";

export const BOD_AVENUE_REPORT_LIMIT = 100;
export const REPORTABLE_BOD_AVENUES = AVENUES;

const avenueByCode = new Map(REPORTABLE_BOD_AVENUES.map((avenue) => [avenue.code, avenue]));
const ROLE_LABELS = Object.freeze({
  host: "Host",
  cohost: "Co-host",
  collaborator: "Collaborator",
  participant: "Participant",
});

function cleanText(value, max = 2500) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

export function isValidReportMonth(value) {
  if (!/^\d{4}-\d{2}$/.test(value || "")) return false;
  const month = Number(value.slice(5));
  return month >= 1 && month <= 12;
}

export function getBodAvenueLabel(code) {
  return avenueByCode.get(cleanText(code, 20).toUpperCase())?.label || "";
}

export function formatBodReportMonth(value) {
  if (!isValidReportMonth(value)) return "";
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, 1)));
}

export function formatBodReportDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return "Not available";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

export function filterBodAvenueReportEvents(events, { month, avenueCode } = {}) {
  const avenue = cleanText(avenueCode, 20).toUpperCase();
  if (!isValidReportMonth(month) || !avenueByCode.has(avenue)) return [];
  const byId = new Map();
  for (const event of Array.isArray(events) ? events : []) {
    if (!event?.id || byId.has(event.id)) continue;
    if (event.recordKind !== "clubEvent" || event.isActive !== true || event.archived === true) continue;
    if (!event.startDate?.startsWith(`${month}-`) || !event.avenues?.includes(avenue)) continue;
    byId.set(event.id, event);
  }
  return [...byId.values()].sort((left, right) => (
    left.startDate.localeCompare(right.startDate) || left.name.localeCompare(right.name)
  ));
}

export function normalizeBodAvenueDirectors(payload, avenueCode) {
  const expectedAvenue = cleanText(avenueCode, 20).toUpperCase();
  if (!payload || payload.ok !== true || cleanText(payload.avenueCode, 20).toUpperCase() !== expectedAvenue) return [];
  const seen = new Set();
  const directors = [];
  for (const item of Array.isArray(payload.directors) ? payload.directors : []) {
    const name = cleanText(item?.name, 160);
    const positionTitle = cleanText(item?.positionTitle, 160);
    const key = `${name.toLowerCase()}|${positionTitle.toLowerCase()}`;
    if (!name || !positionTitle || seen.has(key)) continue;
    seen.add(key);
    directors.push({ name, positionTitle });
  }
  return directors.sort((left, right) => left.name.localeCompare(right.name));
}

export function createBodAvenueSelection(events) {
  return new Set((Array.isArray(events) ? events : []).map((event) => event?.id).filter(Boolean));
}

export function toggleBodAvenueEvent(selectedIds, eventId, checked) {
  const next = new Set(selectedIds || []);
  if (checked) next.add(eventId);
  else next.delete(eventId);
  return next;
}

function safeCollaborators(event) {
  const names = (Array.isArray(event?.collaborators) ? event.collaborators : [])
    .map((item) => cleanText(typeof item === "string" ? item : item?.name, 180))
    .filter(Boolean);
  if (names.length) return [...new Set(names)].join(", ");
  return event?.collaboratorsKnown === false ? "Not available" : "None";
}

export function buildBodAvenueReportModel({ month, avenueCode, events, selectedEventIds, directors, generatedAt } = {}) {
  const avenue = cleanText(avenueCode, 20).toUpperCase();
  const avenueLabel = getBodAvenueLabel(avenue);
  if (!isValidReportMonth(month)) throw new TypeError("Select a valid report month.");
  if (!avenueLabel) throw new TypeError("Select a valid report avenue.");
  const selected = new Set(Array.isArray(selectedEventIds) ? selectedEventIds : [...(selectedEventIds || [])]);
  const matching = filterBodAvenueReportEvents(events, { month, avenueCode: avenue });
  const chosen = matching.filter((event) => selected.has(event.id));
  if (!chosen.length) throw new TypeError("Select at least one reportable event.");
  if (chosen.length > BOD_AVENUE_REPORT_LIMIT) throw new RangeError(`Reports are limited to ${BOD_AVENUE_REPORT_LIMIT} events.`);
  const safeDirectors = (Array.isArray(directors) ? directors : [])
    .map((item) => ({ name: cleanText(item?.name, 160), positionTitle: cleanText(item?.positionTitle, 160) }))
    .filter((item) => item.name && item.positionTitle);
  const uniqueDirectors = [...new Map(safeDirectors.map((item) => [`${item.name.toLowerCase()}|${item.positionTitle.toLowerCase()}`, item])).values()];
  const timestamp = new Date(generatedAt || Date.now());
  if (Number.isNaN(timestamp.getTime())) throw new TypeError("Generated timestamp is invalid.");

  return {
    month,
    monthLabel: formatBodReportMonth(month),
    avenueCode: avenue,
    avenueLabel,
    directors: uniqueDirectors,
    directorText: uniqueDirectors.length
      ? uniqueDirectors.map((item) => `${item.name} (${item.positionTitle})`).join(", ")
      : "Not available",
    directorAssignmentBasis: "Current active BOD position assignment",
    eventCount: chosen.length,
    generatedAt: timestamp.toISOString(),
    events: chosen.map((event) => ({
      date: event.startDate,
      dateLabel: formatBodReportDate(event.startDate),
      name: cleanText(event.name, 180) || "Unnamed event",
      role: ROLE_LABELS[event.rcphRole] || "Not available",
      hostClub: cleanText(event.hostClub, 180) || "Not available",
      collaborators: safeCollaborators(event),
      description: cleanText(event.description, 2500) || "Not available",
    })),
  };
}

export function getBodAvenueReportFilename(report) {
  const avenue = cleanText(report?.avenueLabel || report?.avenueCode, 80) || "Avenue";
  const month = cleanText(report?.monthLabel, 40) || "Monthly";
  const stem = `RCPH-${avenue}-${month}-Report`
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 110);
  return `${stem || "RCPH-Avenue-Report"}.pdf`;
}
