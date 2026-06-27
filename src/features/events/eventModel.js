const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const PUBLIC_EVENT_TYPES = new Set(["clubEvent", "districtEvent"]);

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year, month) {
  const monthLengths = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return monthLengths[month - 1] || 0;
}

export function isValidIsoDate(value) {
  if (typeof value !== "string") return false;
  const match = ISO_DATE_PATTERN.exec(value.trim());
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

function normalizeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeAvenues(value) {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  return [...new Set(values.map((item) => normalizeString(item)).filter(Boolean))];
}

export function normalizeEvent(id, data = {}) {
  const date = normalizeString(data.date);
  if (!isValidIsoDate(date)) return null;

  const candidateEndDate = normalizeString(data.endDate);
  const endDate = isValidIsoDate(candidateEndDate) && candidateEndDate >= date
    ? candidateEndDate
    : null;

  const rawDescription = data.desc || data.description || "";
  const rawAvenues = data.avenue ?? data.avenues;

  return {
    id,
    name: normalizeString(data.name, "Untitled event"),
    date,
    endDate,
    description: normalizeString(rawDescription),
    avenues: normalizeAvenues(rawAvenues),
    archived: data.archived === true,
    visibility: normalizeString(data.visibility, "public").toLowerCase(),
    type: normalizeString(data.type) || null,
    source: normalizeString(data.source) || null,
  };
}

export function isPublicDisplayEvent(event) {
  return !event.archived
    && event.visibility !== "internal"
    && (event.type === null || PUBLIC_EVENT_TYPES.has(event.type));
}

export function getTodayInKolkata(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function compareNames(left, right) {
  return left.name.localeCompare(right.name, "en-IN", { sensitivity: "base" });
}

export function classifyEvents(events, today = getTodayInKolkata()) {
  const upcomingEvents = events
    .filter((event) => (event.endDate || event.date) >= today)
    .sort((left, right) => left.date.localeCompare(right.date) || compareNames(left, right))
    .slice(0, 6);

  const recentEvents = events
    .filter((event) => (event.endDate || event.date) < today)
    .sort((left, right) => right.date.localeCompare(left.date) || compareNames(left, right))
    .slice(0, 6);

  return { upcomingEvents, recentEvents };
}

function dateAtLocalNoon(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatEventDate(event) {
  const startLabel = dateFormatter.format(dateAtLocalNoon(event.date));
  if (!event.endDate || event.endDate === event.date) return startLabel;
  return `${startLabel} – ${dateFormatter.format(dateAtLocalNoon(event.endDate))}`;
}
