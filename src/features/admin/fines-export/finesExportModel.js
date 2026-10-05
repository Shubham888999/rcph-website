import { validDate } from "../shared/adminModel.js";
import { formatRotaractorName } from "../../../utils/memberName.js";
import {
  CLUB_EXPORT_INFO,
  attendanceMonthKey,
  attendanceMonthLabel,
  attendanceMonthShort,
} from "../attendance-export/attendanceExportModel.js";

const REASON_LABELS = Object.freeze({
  missing_badge: "Missing badge",
  late: "Late to event/meeting",
});

function cleanText(value, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function fineReasonLabel(reason) {
  const text = cleanText(reason, 120);
  if (REASON_LABELS[text]) return REASON_LABELS[text];
  return text
    .replace(/_/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function fineMonthKey(fine) {
  return attendanceMonthKey(fine?.date);
}

function datedFines(fines) {
  return (Array.isArray(fines) ? fines : []).filter((fine) => fine && validDate(fine.date));
}

export function listFineMonths(fines) {
  const counts = new Map();
  for (const fine of datedFines(fines)) {
    const key = fineMonthKey(fine);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.keys()]
    .sort((a, b) => b.localeCompare(a))
    .map((key) => ({ key, label: attendanceMonthLabel(key), shortLabel: attendanceMonthShort(key), fineCount: counts.get(key) }));
}

export function finesInMonths(fines, monthKeys) {
  const months = new Set(monthKeys || []);
  return datedFines(fines).filter((fine) => months.has(fineMonthKey(fine)));
}

export function buildFineRows(fines) {
  return datedFines(fines)
    .map((fine) => ({
      id: cleanText(fine.id, 128),
      date: fine.date,
      name: formatRotaractorName(fine.memberName || fine.memberId, true),
      reason: fineReasonLabel(fine.reason),
      event: cleanText(fine.eventName, 180),
      amount: Number(fine.amount) || 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

export function fineRowsTotal(rows) {
  return (rows || []).reduce((sum, row) => sum + row.amount, 0);
}

export function finesByMember(rows) {
  const members = new Map();
  for (const row of rows || []) {
    const entry = members.get(row.name) || { name: row.name, count: 0, total: 0 };
    entry.count += 1;
    entry.total += row.amount;
    members.set(row.name, entry);
  }
  return [...members.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

export function buildFinesExport({ fines, monthKeys }) {
  const monthOrder = [...new Set(monthKeys || [])]
    .filter((key) => attendanceMonthLabel(key))
    .sort((a, b) => a.localeCompare(b));
  const months = monthOrder.map((key) => {
    const rows = buildFineRows(finesInMonths(fines, [key]));
    return { key, label: attendanceMonthLabel(key), shortLabel: attendanceMonthShort(key), rows, total: fineRowsTotal(rows) };
  });
  let allMonths = null;
  if (months.length >= 2) {
    const rows = buildFineRows(finesInMonths(fines, monthOrder));
    allMonths = { rows, total: fineRowsTotal(rows), byMember: finesByMember(rows) };
  }
  return { info: CLUB_EXPORT_INFO, months, allMonths };
}
