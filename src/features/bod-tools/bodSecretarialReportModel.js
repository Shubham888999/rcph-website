import { AVENUES } from "../calendar/avenues.js";

export const BOD_SECRETARIAL_REPORT_TITLE = "Monthly Report RCPH RIY 26 - 27";

const AVENUE_CODES = AVENUES.map((avenue) => avenue.code);
const AVENUE_CODE_SET = new Set(AVENUE_CODES);
const INACTIVE_STATUSES = new Set(["archived", "deleted", "inactive", "removed"]);

function cleanText(value, max = 2500) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

function cleanRequired(value) {
  return cleanText(value, 180);
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function flattenValues(value) {
  if (Array.isArray(value)) return value.flatMap(flattenValues);
  if (typeof value === "string") return value.split(/[,+/|]/).map((item) => item.trim());
  return value === undefined || value === null ? [] : [value];
}

function unique(values) {
  return [...new Set(values)];
}

function isValidReportMonth(value) {
  if (!/^\d{4}-\d{2}$/.test(value || "")) return false;
  const month = Number(value.slice(5));
  return month >= 1 && month <= 12;
}

function monthIndex(value) {
  const [year, month] = value.split("-").map(Number);
  return year * 12 + month - 1;
}

function normalizeReportMonths(value) {
  return unique(flattenValues(value).map((item) => cleanText(item, 7)).filter(isValidReportMonth))
    .sort((left, right) => monthIndex(left) - monthIndex(right));
}

function monthDate(value) {
  if (!isValidReportMonth(value)) return null;
  const [year, month] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
}

function formatMonthLabel(value) {
  const date = monthDate(value);
  return date
    ? new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(date)
    : "";
}

function isContiguousMonthRange(months) {
  return months.every((month, index) => !index || monthIndex(month) === monthIndex(months[index - 1]) + 1);
}

function formatPeriodLabel(months) {
  if (months.length === 1) return formatMonthLabel(months[0]);
  if (!isContiguousMonthRange(months)) return months.map(formatMonthLabel).join(", ");
  const first = monthDate(months[0]);
  const last = monthDate(months.at(-1));
  const firstMonth = new Intl.DateTimeFormat("en-IN", { month: "long", timeZone: "UTC" }).format(first);
  const lastMonth = new Intl.DateTimeFormat("en-IN", { month: "long", timeZone: "UTC" }).format(last);
  const firstYear = first.getUTCFullYear();
  const lastYear = last.getUTCFullYear();
  return firstYear === lastYear
    ? `${firstMonth}-${lastMonth} ${firstYear}`
    : `${firstMonth} ${firstYear}-${lastMonth} ${lastYear}`;
}

function validDateOnly(value) {
  const date = cleanText(value, 20);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) return "";
  return date;
}

function formatDateLabel(value) {
  const date = validDateOnly(value);
  if (!date) return "Not available";
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year.slice(2)}`;
}

function eventDate(event) {
  return validDateOnly(event?.startDate || event?.date || event?.eventStart);
}

function eventName(event) {
  return cleanText(event?.name || event?.title, 180);
}

function eventRecordKind(event) {
  return cleanText(event?.recordKind || event?.type, 40);
}

function isInactiveRecord(event) {
  const status = cleanText(event?.status, 40).toLowerCase();
  return Boolean(
    event?.isActive === false
    || event?.active === false
    || event?.archived === true
    || event?.deleted === true
    || event?.isDeleted === true
    || event?.removed === true
    || INACTIVE_STATUSES.has(status),
  );
}

function normalizeAvenueCodes(event) {
  const selected = new Set(
    flattenValues(event?.avenues ?? event?.avenue)
      .map((item) => cleanText(item, 20).toUpperCase())
      .filter((code) => AVENUE_CODE_SET.has(code)),
  );
  return AVENUE_CODES.filter((code) => selected.has(code));
}

function avenueLabel(codes) {
  return codes.length ? codes.join(" + ") : "Not available";
}

function avenueDescription(event, codes) {
  if (!isPlainObject(event?.avenueDescriptions)) return "";
  const descriptions = new Map();
  Object.entries(event.avenueDescriptions).forEach(([key, value]) => {
    const code = cleanText(key, 20).toUpperCase();
    if (AVENUE_CODE_SET.has(code)) descriptions.set(code, cleanText(value));
  });
  for (const code of codes) {
    const description = descriptions.get(code);
    if (description) return description;
  }
  return "";
}

function meetingDescription(event, avenueCodes) {
  return (
    cleanText(event?.description)
    || cleanText(event?.desc)
    || avenueDescription(event, avenueCodes)
    || eventName(event)
    || "Not available"
  );
}

function projectDescription(event, avenueCodes) {
  return (
    avenueDescription(event, avenueCodes)
    || cleanText(event?.description)
    || cleanText(event?.desc)
    || "Not available"
  );
}

function normalizeClubStrength(value) {
  if (value === undefined || value === null) return "Not available";
  if (typeof value === "string" && !value.trim()) return "Not available";
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : "Not available";
}

function normalizeGeneratedAt(value) {
  const timestamp = new Date(value === undefined ? Date.now() : value);
  if (Number.isNaN(timestamp.getTime())) throw new TypeError("Generated timestamp is invalid.");
  return timestamp.toISOString();
}

function compareMeetings(left, right) {
  return left.date.localeCompare(right.date) || left.description.localeCompare(right.description);
}

function compareProjects(left, right) {
  return left.date.localeCompare(right.date) || left.name.localeCompare(right.name);
}

function baseRecordAllowed(event) {
  return Boolean(event && typeof event === "object" && event.id && !isInactiveRecord(event) && eventDate(event));
}

function isBodMeeting(event) {
  return eventRecordKind(event) === "bodMeeting";
}

function isClubEvent(event) {
  return eventRecordKind(event) === "clubEvent";
}

function presentationMeeting(event, kind, avenueCodes) {
  const date = eventDate(event);
  return {
    kind,
    date,
    dateLabel: formatDateLabel(date),
    description: meetingDescription(event, avenueCodes),
  };
}

function presentationProject(event, avenueCodes) {
  const date = eventDate(event);
  return {
    date,
    avenueLabel: avenueLabel(avenueCodes),
    dateLabel: formatDateLabel(date),
    name: eventName(event) || "Untitled event",
    description: projectDescription(event, avenueCodes),
  };
}

function numberedMeetings(meetings) {
  const typeCounts = { BOD: 0, GBM: 0 };
  return meetings.sort(compareMeetings).map((meeting, index) => {
    typeCounts[meeting.kind] += 1;
    return {
      serial: index + 1,
      type: `${meeting.kind} - ${typeCounts[meeting.kind]}`,
      dateLabel: meeting.dateLabel,
      description: meeting.description,
    };
  });
}

function numberedProjects(events) {
  return events.sort(compareProjects).map((event, index) => ({
    serial: index + 1,
    avenueLabel: event.avenueLabel,
    dateLabel: event.dateLabel,
    name: event.name,
    description: event.description,
  }));
}

export function buildBodSecretarialReportModel(options = {}) {
  const selectedMonths = normalizeReportMonths(options.selectedMonths);
  if (!selectedMonths.length) throw new TypeError("Select at least one valid report month.");

  const clubScore = cleanRequired(options.clubScore);
  if (!clubScore) throw new TypeError("Club Score is required.");

  const clubRank = cleanRequired(options.clubRank);
  if (!clubRank) throw new TypeError("Club Rank is required.");

  const monthSet = new Set(selectedMonths);
  const monthBuckets = new Map(selectedMonths.map((month) => [month, { meetings: [], events: [] }]));
  const seenIds = new Set();

  for (const event of Array.isArray(options.events) ? options.events : []) {
    if (!baseRecordAllowed(event)) continue;
    const id = cleanText(event.id, 180);
    const date = eventDate(event);
    const month = date.slice(0, 7);
    if (!monthSet.has(month)) continue;
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    const avenueCodes = normalizeAvenueCodes(event);
    const bucket = monthBuckets.get(month);

    if (isBodMeeting(event)) {
      bucket.meetings.push(presentationMeeting(event, "BOD", avenueCodes));
      continue;
    }

    if (!isClubEvent(event)) continue;
    if (avenueCodes.includes("GBM")) {
      bucket.meetings.push(presentationMeeting(event, "GBM", avenueCodes));
      continue;
    }

    bucket.events.push(presentationProject(event, avenueCodes));
  }

  let overallProjects = 0;
  let bodMeetingCount = 0;
  let gbmMeetingCount = 0;

  const months = selectedMonths.map((month) => {
    const bucket = monthBuckets.get(month);
    const meetings = numberedMeetings(bucket.meetings);
    const events = numberedProjects(bucket.events);
    overallProjects += events.length;
    bodMeetingCount += bucket.meetings.filter((meeting) => meeting.kind === "BOD").length;
    gbmMeetingCount += bucket.meetings.filter((meeting) => meeting.kind === "GBM").length;

    const monthLabel = formatMonthLabel(month);
    return {
      month,
      monthLabel,
      heading: `Monthly Report: ${monthLabel}`,
      meetings,
      events,
    };
  });

  return {
    title: BOD_SECRETARIAL_REPORT_TITLE,
    clubStrength: normalizeClubStrength(options.metrics?.clubStrength),
    clubScore,
    clubRank,
    overallProjects,
    bodMeetingCount,
    gbmMeetingCount,
    selectedMonths,
    periodLabel: formatPeriodLabel(selectedMonths),
    generatedAt: normalizeGeneratedAt(options.generatedAt),
    months,
  };
}
