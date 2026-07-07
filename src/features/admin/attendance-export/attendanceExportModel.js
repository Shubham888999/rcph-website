import { normalizeAttendance, validDate } from "../shared/adminModel.js";
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

function cleanText(value, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function attendanceExportStatus(value) {
  const normalized = normalizeAttendance(value);
  return normalized === true ? "Present" : normalized === false ? "Absent" : "Not applicable";
}

export function parseAttendanceDate(value) {
  if (!validDate(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function createAttendanceExportReport(panelKey, { members, events, attendance, selectedEventIds }) {
  const panel = ATTENDANCE_EXPORT_PANELS[panelKey];
  if (!panel) throw new TypeError("Unknown attendance export panel.");
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
      name: formatRotaractorName(cleanText(member.name, 160), member.role ? member : true) || "Unnamed member",
      roleOrPosition: cleanText(member.position || member.role, 180),
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
        status: attendanceExportStatus(safeAttendance[member.id]?.[event.id]),
      });
    }
  }

  return {
    panel: { key: panel.key, title: panel.title, eventLabel: panel.eventLabel, categoryLabel: panel.categoryLabel },
    events: safeEvents,
    members: safeMembers,
    rows,
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
