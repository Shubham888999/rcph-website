import { TREASURY_AVENUE_OPTIONS, TREASURY_NO_EVENT_LABEL, formatTreasuryMonth } from "./treasuryModel.js";

// Income and expense broken down by month, avenue and event, plus the avenue and event
// matrix and the avenue by month grid. Built from the Treasury export rows, so it follows
// the same period and filters. Reimbursements count as expenses, as in the export totals.

const UNCATEGORIZED = "Uncategorized";

const isIncome = (row) => row.type === "Income";
const round = (value) => Math.round(value * 100) / 100;

function monthKey(row) {
  return /^\d{4}-\d{2}/.test(row.dateKey || "") ? row.dateKey.slice(0, 7) : "";
}

function avenueOf(row) {
  return row.category || UNCATEGORIZED;
}

function avenueRank(avenue) {
  if (avenue === UNCATEGORIZED) return TREASURY_AVENUE_OPTIONS.length + 2;
  const index = TREASURY_AVENUE_OPTIONS.indexOf(avenue);
  return index === -1 ? TREASURY_AVENUE_OPTIONS.length + 1 : index;
}

function compareAvenues(left, right) {
  return avenueRank(left) - avenueRank(right) || left.localeCompare(right);
}

// One key per linked event; every entry without an event shares the "not linked" key.
function eventOf(row) {
  const record = row.originalRecord || {};
  const name = String(record.eventName || "").trim();
  if (!name) return { key: "", name: TREASURY_NO_EVENT_LABEL, date: "" };
  const id = String(record.eventId || "").trim();
  const source = String(record.eventSource || "").trim();
  return { key: id ? `${source}:${id}` : `name:${name.toLowerCase()}`, name, date: String(record.eventDate || "") };
}

function compareEvents(left, right) {
  if (!left.key !== !right.key) return left.key ? -1 : 1;
  return String(left.date).localeCompare(String(right.date)) || left.name.localeCompare(right.name);
}

function groupTotals(rows, keyOf, build) {
  const groups = new Map();
  rows.forEach((row) => {
    const key = keyOf(row);
    if (!groups.has(key)) groups.set(key, { ...build(row, key), amount: 0, count: 0 });
    const group = groups.get(key);
    group.amount = round(group.amount + row.amount);
    group.count += 1;
  });
  return [...groups.values()];
}

function withShare(groups, total) {
  return groups.map((group) => ({ ...group, share: total ? group.amount / total : 0 }));
}

function breakdownFor(rows) {
  const total = round(rows.reduce((sum, row) => sum + row.amount, 0));
  const byMonth = groupTotals(rows, monthKey, (row, key) => ({ key, label: key ? formatTreasuryMonth(key) : "Undated" }))
    .sort((left, right) => (left.key || "9999").localeCompare(right.key || "9999"));
  const byAvenue = groupTotals(rows, avenueOf, (row, key) => ({ label: key }))
    .sort((left, right) => compareAvenues(left.label, right.label));
  const byEvent = groupTotals(rows, (row) => eventOf(row).key, (row) => {
    const event = eventOf(row);
    return { key: event.key, label: event.name, date: event.date };
  }).sort((left, right) => compareEvents({ key: left.key, date: left.date, name: left.label }, { key: right.key, date: right.date, name: right.label }));
  return {
    rows,
    total,
    count: rows.length,
    byMonth: withShare(byMonth, total),
    byAvenue: withShare(byAvenue, total),
    byEvent: withShare(byEvent, total),
  };
}

function money(rows) {
  const income = round(rows.filter(isIncome).reduce((sum, row) => sum + row.amount, 0));
  const expense = round(rows.filter((row) => !isIncome(row)).reduce((sum, row) => sum + row.amount, 0));
  return { income, expense, net: round(income - expense), count: rows.length };
}

// Each avenue with the events under it: income, expense and net for each, then the avenue total.
function avenueEventMatrix(rows) {
  const avenues = [...new Set(rows.map(avenueOf))].sort(compareAvenues);
  return avenues.map((avenue) => {
    const avenueRows = rows.filter((row) => avenueOf(row) === avenue);
    const events = new Map();
    avenueRows.forEach((row) => {
      const event = eventOf(row);
      if (!events.has(event.key)) events.set(event.key, { ...event, rows: [] });
      events.get(event.key).rows.push(row);
    });
    return {
      avenue,
      ...money(avenueRows),
      events: [...events.values()].sort(compareEvents).map((event) => ({ key: event.key, name: event.name, date: event.date, ...money(event.rows) })),
    };
  });
}

// Avenues down the side and months across, once for income and once for expenses.
function avenueMonthGrid(rows) {
  const months = [...new Set(rows.map(monthKey))].sort((left, right) => (left || "9999").localeCompare(right || "9999"))
    .map((key) => ({ key, label: key ? formatTreasuryMonth(key) : "Undated" }));
  const avenues = [...new Set(rows.map(avenueOf))].sort(compareAvenues);
  const grid = (filter) => {
    const selected = rows.filter(filter);
    const sum = (list) => round(list.reduce((total, row) => total + row.amount, 0));
    const lines = avenues.map((avenue) => {
      const avenueRows = selected.filter((row) => avenueOf(row) === avenue);
      return { avenue, cells: months.map((month) => sum(avenueRows.filter((row) => monthKey(row) === month.key))), total: sum(avenueRows) };
    }).filter((line) => line.total > 0);
    return {
      rows: lines,
      monthTotals: months.map((month) => sum(selected.filter((row) => monthKey(row) === month.key))),
      total: sum(selected),
    };
  };
  return { months, income: grid(isIncome), expense: grid((row) => !isIncome(row)) };
}

export function buildTreasuryBreakdown(rows = []) {
  const list = (Array.isArray(rows) ? rows : []).filter((row) => row && Number.isFinite(row.amount));
  return {
    income: breakdownFor(list.filter(isIncome)),
    expense: breakdownFor(list.filter((row) => !isIncome(row))),
    totals: money(list),
    avenueEvents: avenueEventMatrix(list),
    avenueMonths: avenueMonthGrid(list),
  };
}

export function treasuryRowEventLabel(row) {
  return eventOf(row).name;
}
