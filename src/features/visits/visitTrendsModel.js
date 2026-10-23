import { getVisitAttendanceEventsForAvenue } from "./visitDashboardModel.js";

const MONTH_LABELS = Object.freeze(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
// Heat levels for the avenue strip: 0 is an empty month, 4 the busiest.
export const AVENUE_STRIP_LEVELS = 4;

function pad(value) {
  return String(value).padStart(2, "0");
}

function localIsoDate(today) {
  const date = today instanceof Date && Number.isFinite(today.getTime()) ? today : new Date();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dayNumber(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86400000;
}

// The Rotaract year runs July to June, so the strip and the trend start in
// July and end with the current month.
export function buildRotaractMonths(today = new Date()) {
  const [year, month] = localIsoDate(today).split("-").map(Number);
  const startYear = month >= 7 ? year : year - 1;
  const months = [];
  for (let index = 0; ; index += 1) {
    const monthIndex = (6 + index) % 12;
    const monthYear = startYear + Math.floor((6 + index) / 12);
    months.push({ key: `${monthYear}-${pad(monthIndex + 1)}`, label: MONTH_LABELS[monthIndex], year: monthYear });
    if (monthYear === year && monthIndex === month - 1) break;
  }
  return months;
}

function monthEnd(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return `${monthKey}-${pad(new Date(Date.UTC(year, month, 0)).getUTCDate())}`;
}

function formatShortDate(isoDate) {
  const [, month, day] = isoDate.split("-").map(Number);
  return `${day} ${MONTH_LABELS[month - 1]}`;
}

// One point per event with a recorded attendance %, placed by date between
// 1 July and the end of the current month (x runs 0 to 1).
export function buildAttendanceTrend(attendance, today = new Date()) {
  const months = buildRotaractMonths(today);
  const start = `${months[0].key}-01`;
  const end = monthEnd(months.at(-1).key);
  const firstDay = dayNumber(start);
  const span = dayNumber(end) - firstDay + 1;
  const position = (isoDate) => (dayNumber(isoDate) - firstDay + 0.5) / span;

  const seriesFor = (key, label, view) => ({
    key,
    label,
    points: (Array.isArray(view?.columns) ? view.columns : [])
      .filter((column) => ISO_DATE.test(column.date) && column.date >= start && column.date <= end)
      .filter((column) => Number.isFinite(column.attendanceRate))
      .map((column) => ({
        eventId: column.eventId,
        title: column.title,
        date: column.date,
        dateLabel: formatShortDate(column.date),
        rate: column.attendanceRate,
        x: position(column.date),
      }))
      .sort((left, right) => left.date.localeCompare(right.date) || left.title.localeCompare(right.title)),
  });

  const series = [seriesFor("club", "Club", attendance?.club), seriesFor("bod", "BOD", attendance?.bod)];
  return {
    months: months.map((month) => {
      const x = (dayNumber(`${month.key}-01`) - firstDay) / span;
      const width = (dayNumber(monthEnd(month.key)) - dayNumber(`${month.key}-01`) + 1) / span;
      return { ...month, x, mid: x + width / 2 };
    }),
    series,
    hasPoints: series.some((line) => line.points.length > 0),
  };
}

export function avenueStripLevel(count, max) {
  if (!count || !max) return 0;
  return Math.min(AVENUE_STRIP_LEVELS, Math.max(1, Math.ceil((count / max) * AVENUE_STRIP_LEVELS)));
}

// Avenue rows by month, July to the current month. Uses the same avenue
// matching as the old avenue list, so each row still lists its events.
export function buildAvenueMonthStrip(stats, attendance, today = new Date()) {
  const months = buildRotaractMonths(today);
  const monthIndex = new Map(months.map((month, index) => [month.key, index]));

  const rows = (Array.isArray(stats?.avenueEventCounts) ? stats.avenueEventCounts : [])
    .filter((row) => row.avenueCode !== "GBM" && Number(row.count) > 0)
    .map((row) => {
      const events = getVisitAttendanceEventsForAvenue(attendance, row);
      const counts = months.map(() => 0);
      events.forEach((event) => {
        const index = monthIndex.get(String(event.isoDate || "").slice(0, 7));
        if (index !== undefined) counts[index] += 1;
      });
      return { avenueCode: row.avenueCode, avenueName: row.avenueName || row.avenueCode, events, counts, total: events.length };
    })
    .filter((row) => row.events.length > 0);

  const totals = months.map((_, index) => rows.reduce((sum, row) => sum + row.counts[index], 0));
  const max = Math.max(0, ...rows.flatMap((row) => row.counts));
  return {
    months,
    rows: rows.map((row) => ({ ...row, levels: row.counts.map((value) => avenueStripLevel(value, max)) })),
    totals,
    total: rows.reduce((sum, row) => sum + row.total, 0),
  };
}
