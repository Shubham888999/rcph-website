import {
  isProspectAttendanceParticipant,
  normalizeAttendance,
  validDate,
} from "../shared/adminModel.js";
import { compareByHierarchy, hierarchySortKey, POSITION_HIERARCHY } from "../shared/positionHierarchy.js";
import { formatRotaractorName } from "../../../utils/memberName.js";

export const ATTENDANCE_EXPORT_PANELS = Object.freeze({
  club: Object.freeze({
    key: "club",
    title: "Club Event Attendance",
    eventLabel: "Club event",
    categoryLabel: "Avenue",
    getCategory: (event) => event.avenue?.join(" · ") || "Club event",
  }),
  bod: Object.freeze({
    key: "bod",
    title: "BOD Meeting Attendance",
    eventLabel: "BOD meeting",
    categoryLabel: "Meeting type",
    getCategory: () => "BOD Meeting",
  }),
  district: Object.freeze({
    key: "district",
    title: "District Event Attendance",
    eventLabel: "District event",
    categoryLabel: "Visibility",
    getCategory: (event) => event.visibility === "public" ? "Public" : "Internal",
  }),
});

export const CLUB_EXPORT_INFO = Object.freeze({ clubId: "213166", zone: "4" });

const MONTH_NAMES = Object.freeze([
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]);

const POSITION_SHORT_LABELS = Object.freeze({
  president: "President",
  "co-president": "Co-President",
  secretary: "Secretary",
  "joint-secretary": "Joint Secretary",
  "co-secretary": "Co-Secretary",
  treasurer: "Treasurer",
  "co-treasurer": "Co-Treasurer",
  "vice-president": "VP",
  "co-vice-president": "Co-VP",
  "immediate-past-president": "IPP",
  "club-advisor": "Club Advisor",
  "co-club-advisor": "Co-Club Advisor",
  pdd: "PDD",
  csd: "CSD",
  isd: "ISD",
  cmd: "CMD",
  dei: "DEI",
  pro: "PRO",
  pid: "PID",
  mdo: "MDO",
  editor: "Editor",
  cwd: "CWD",
  saa: "SAA",
  rrro: "RRRO",
  "sports-representative": "Sports Rep",
  wrwc: "WRWC",
  wr: "WR",
});

function cleanText(value, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function attendanceExportStatus(value) {
  const normalized = normalizeAttendance(value);
  return normalized === true ? "Present" : normalized === false ? "Absent" : "Not applicable";
}

export function attendanceExportMark(value) {
  const normalized = normalizeAttendance(value);
  return normalized === true ? "P" : normalized === false ? "A" : "N/A";
}

export function parseAttendanceDate(value) {
  if (!validDate(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function attendanceValueForMember(attendance, member, eventId) {
  const rowIds = [
    member?.id,
    ...(Array.isArray(member?.attendanceIds) ? member.attendanceIds : []),
  ]
    .map((value) => cleanText(value, 128))
    .filter(Boolean);

  for (const rowId of [...new Set(rowIds)]) {
    const row = attendance?.[rowId];
    if (row && Object.prototype.hasOwnProperty.call(row, eventId)) {
      return row[eventId];
    }
  }

  return "NA";
}

export function createAttendanceExportReport(panelKey, { members, events, attendance, selectedEventIds, includeProspectsInClubAttendance = false }) {
  const panel = ATTENDANCE_EXPORT_PANELS[panelKey];
  if (!panel) throw new TypeError("Unknown attendance export panel.");
  const countProspects = panelKey !== "club" || includeProspectsInClubAttendance === true;
  const selectedIds = new Set(Array.isArray(selectedEventIds) ? selectedEventIds : []);
  const safeEvents = (Array.isArray(events) ? events : [])
    .filter((event) => event && selectedIds.has(event.id) && validDate(event.date) && event.archived !== true)
    .map((event) => ({
      id: cleanText(event.id, 128),
      name: cleanText(event.name, 180) || "Unnamed event",
      date: event.date,
      endDate: validDate(event.endDate) ? event.endDate : "",
      category: cleanText(panel.getCategory(event), 200) || panel.eventLabel,
    }));
  const safeMembers = (Array.isArray(members) ? members : [])
    .filter((member) => member?.id)
    .map((member) => ({
      id: cleanText(member.id, 128),
      attendanceIds: [
        member.id,
        ...(Array.isArray(member.attendanceIds) ? member.attendanceIds : []),
      ]
        .map((value) => cleanText(value, 128))
        .filter(Boolean),
      name: formatRotaractorName(cleanText(member.name, 160), member.role ? member : true) || "Unnamed member",
      roleOrPosition: cleanText(member.position || member.role, 180),
      countsTowardClubAttendance: countProspects || !isProspectAttendanceParticipant(member),
    }));
  const safeAttendance = attendance && typeof attendance === "object" ? attendance : {};

  const rows = [];
  for (const event of safeEvents) {
    for (const member of safeMembers) {
      rows.push({
        eventId: event.id,
        eventName: event.name,
        eventDate: event.date,
        eventEndDate: event.endDate,
        category: event.category,
        memberId: member.id,
        memberName: member.name,
        roleOrPosition: member.roleOrPosition,
        status: attendanceExportStatus(attendanceValueForMember(safeAttendance, member, event.id)),
        countsTowardClubAttendance: member.countsTowardClubAttendance,
      });
    }
  }
  const aggregateMembers = safeMembers.filter((member) => member.countsTowardClubAttendance);
  const aggregateRows = rows.filter((row) => row.countsTowardClubAttendance);

  return {
    panel: { key: panel.key, title: panel.title, eventLabel: panel.eventLabel, categoryLabel: panel.categoryLabel },
    events: safeEvents,
    members: safeMembers,
    rows,
    aggregateMembers,
    aggregateRows,
  };
}

export function filterAttendanceEvents(events, filters = {}) {
  const search = cleanText(filters.search, 180).toLowerCase();
  const dateFrom = validDate(filters.dateFrom) ? filters.dateFrom : "";
  const dateTo = validDate(filters.dateTo) ? filters.dateTo : "";
  return (Array.isArray(events) ? events : []).filter((event) => {
    if (!event || event.archived === true || !validDate(event.date)) return false;
    if (search && !cleanText(event.name, 180).toLowerCase().includes(search)) return false;
    if (dateFrom && event.date < dateFrom) return false;
    if (dateTo && event.date > dateTo) return false;
    return true;
  });
}

export function toggleAttendanceEventSelection(selectedIds, eventId, checked) {
  const next = new Set(selectedIds || []);
  if (checked) next.add(eventId);
  else next.delete(eventId);
  return next;
}

export function selectFilteredAttendanceEvents(selectedIds, filteredEvents) {
  const next = new Set(selectedIds || []);
  for (const event of filteredEvents || []) if (event?.id) next.add(event.id);
  return next;
}

function isExportableEvent(event) {
  return Boolean(event) && event.archived !== true && validDate(event.date);
}

function monthKeyParts(key) {
  const match = /^(\d{4})-(\d{2})$/.exec(key || "");
  if (!match) return null;
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? { year: match[1], monthIndex: month - 1 } : null;
}

export function attendanceMonthKey(date) {
  return validDate(date) ? date.slice(0, 7) : "";
}

export function attendanceMonthLabel(key) {
  const parts = monthKeyParts(key);
  return parts ? `${MONTH_NAMES[parts.monthIndex]} ${parts.year}` : "";
}

export function attendanceMonthShort(key) {
  const parts = monthKeyParts(key);
  return parts ? `${MONTH_NAMES[parts.monthIndex].slice(0, 3)} ${parts.year}` : "";
}

export function listAttendanceMonths(events) {
  const counts = new Map();
  for (const event of Array.isArray(events) ? events : []) {
    if (!isExportableEvent(event)) continue;
    const key = attendanceMonthKey(event.date);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.keys()]
    .sort((a, b) => b.localeCompare(a))
    .map((key) => ({ key, label: attendanceMonthLabel(key), shortLabel: attendanceMonthShort(key), eventCount: counts.get(key) }));
}

function compareEventsByDate(a, b) {
  return a.date.localeCompare(b.date)
    || cleanText(a.name, 180).localeCompare(cleanText(b.name, 180))
    || cleanText(a.id, 128).localeCompare(cleanText(b.id, 128));
}

export function eventsInMonths(events, monthKeys) {
  const months = new Set(monthKeys || []);
  return (Array.isArray(events) ? events : [])
    .filter((event) => isExportableEvent(event) && months.has(attendanceMonthKey(event.date)))
    .sort(compareEventsByDate);
}

export function eventColumnLabel(event) {
  const name = cleanText(event?.name, 180) || "Unnamed event";
  if (!validDate(event?.date)) return name;
  const [year, month, day] = event.date.split("-").map(Number);
  return `${day} ${MONTH_NAMES[month - 1].slice(0, 3)} ${year}\n${name}`;
}

function positionShortLabelForKey(key) {
  if (POSITION_SHORT_LABELS[key]) return POSITION_SHORT_LABELS[key];
  if (key.startsWith("co-") && POSITION_SHORT_LABELS[key.slice(3)]) return `Co-${POSITION_SHORT_LABELS[key.slice(3)]}`;
  return "";
}

export function positionShortLabel(positionKeys) {
  const keys = new Set(Array.isArray(positionKeys) ? positionKeys : []);
  return POSITION_HIERARCHY
    .filter((key) => keys.has(key))
    .map(positionShortLabelForKey)
    .filter(Boolean)
    .join(" | ");
}

function bodMemberLabel(member) {
  const name = formatRotaractorName(cleanText(member.name, 160), true) || "Unnamed member";
  const position = positionShortLabel(member.positionKeys) || cleanText(member.position, 180);
  return position ? `${position} – ${name}` : name;
}

function primaryMemberLabel(member) {
  return formatRotaractorName(cleanText(member.name, 160), member.role ? member : true) || "Unnamed member";
}

function withSortKey(member) {
  if (Number.isFinite(member?.hierarchySortKey)) return member;
  return {
    ...member,
    hierarchySortKey: hierarchySortKey({ positionKeys: member?.positionKeys, isProspect: isProspectAttendanceParticipant(member) }),
  };
}

function exportRoster(members, labelFor) {
  return (Array.isArray(members) ? members : [])
    .filter((member) => member?.id)
    .map(withSortKey)
    .sort(compareByHierarchy)
    .map((member) => ({ member, id: cleanText(member.id, 128), label: labelFor(member) }));
}

function buildSection({ title, headerLabel, events, roster, attendance }) {
  const safeAttendance = attendance && typeof attendance === "object" ? attendance : {};
  return {
    title,
    headerLabel,
    events: events.map((event) => ({ id: cleanText(event.id, 128), date: event.date, label: eventColumnLabel(event) })),
    rows: roster.map(({ member, id, label }) => ({
      id,
      label,
      marks: events.map((event) => attendanceExportMark(attendanceValueForMember(safeAttendance, member, event.id))),
    })),
  };
}

export function buildMonthlyAttendanceExport({
  panelKey,
  primary,
  bod = null,
  monthKeys,
  selectedEventIds,
  includeProspects = false,
  includeBod = false,
}) {
  if (!ATTENDANCE_EXPORT_PANELS[panelKey]) throw new TypeError("Unknown attendance export panel.");
  const selectedIds = new Set(selectedEventIds || []);
  const primaryEvents = Array.isArray(primary?.events) ? primary.events : [];
  const monthOrder = [...new Set(monthKeys || [])]
    .filter((key) => monthKeyParts(key))
    .sort((a, b) => a.localeCompare(b));

  const primaryMembers = (Array.isArray(primary?.members) ? primary.members : [])
    .filter((member) => includeProspects || !isProspectAttendanceParticipant(member));
  const primaryRoster = exportRoster(primaryMembers, panelKey === "bod" ? bodMemberLabel : primaryMemberLabel);
  const withBod = includeBod === true && Boolean(bod);
  const bodRoster = withBod ? exportRoster(bod.members, bodMemberLabel) : [];

  const months = [];
  for (const key of monthOrder) {
    const selectedEvents = eventsInMonths(primaryEvents, [key]).filter((event) => selectedIds.has(event.id));
    if (!selectedEvents.length) continue;
    const sections = [
      buildSection({
        title: "",
        headerLabel: panelKey === "bod" ? "Position | Name" : "Name",
        events: selectedEvents,
        roster: primaryRoster,
        attendance: primary?.attendance,
      }),
    ];
    if (withBod) {
      sections.push(buildSection({
        title: "BODs",
        headerLabel: "Position | Name",
        events: eventsInMonths(bod.events, [key]),
        roster: bodRoster,
        attendance: bod.attendance,
      }));
    }
    months.push({ key, label: attendanceMonthLabel(key), shortLabel: attendanceMonthShort(key), sections });
  }

  return { panelKey, info: CLUB_EXPORT_INFO, months };
}
