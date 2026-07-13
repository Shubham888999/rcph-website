import { formatInr, text, timestampIso, validDate } from "../shared/adminModel.js";
import { POSITION_CATALOG } from "../shared/positionCatalog.js";
import {
  DEFAULT_TREASURY_FILTERS,
  filterAndSortTreasury,
  formatTreasuryDate,
  formatTreasuryMonth,
  isReimbursementRecord,
  normalizeReimbursementStatus,
  normalizeTreasuryAvenue,
} from "./treasuryModel.js";
import { formatRotaractorName } from "../../../utils/memberName.js";

export const TREASURY_EXPORT_TITLE = "Financial Records";
export const TREASURY_EXPORT_CLUB_NAME = "Rotaract Club of Pune Heritage";

export const TREASURY_EXPORT_COLUMNS = Object.freeze([
  "Date",
  "Type",
  "Category",
  "Description",
  "Amount",
  "Payment Method",
  "From / Source",
  "To / Destination",
  "Fine Reference / Linked Record",
  "Created By",
  "Created At",
  "Transaction ID",
]);

const SORT_LABELS = Object.freeze({
  newest: "Newest first",
  oldest: "Oldest first",
  "amount-desc": "Amount high to low",
  "amount-asc": "Amount low to high",
});

const FILTER_TYPE_LABELS = Object.freeze({
  all: "All types",
  income: "Income",
  expense: "Expense",
  reimbursement: "Reimbursement",
});

const TREASURER_KEYS = Object.freeze(["treasurer", "co-treasurer"]);
const TREASURER_POSITION_LABELS = new Set(
  POSITION_CATALOG
    .filter((item) => TREASURER_KEYS.includes(item.key))
    .flatMap((item) => item.aliases)
    .map(normalizePositionLabel),
);

function normalizePositionLabel(value) {
  return text(value, 180)
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function splitPositionLabels(value) {
  return text(value, 400)
    .split(/[,/;|]+/)
    .map(normalizePositionLabel)
    .filter(Boolean);
}

function personPositionRank(person = {}) {
  const keys = Array.isArray(person.positionKeys)
    ? person.positionKeys.map((item) => text(item, 80).toLowerCase())
    : [];
  if (keys.includes("treasurer")) return 0;
  if (keys.includes("co-treasurer")) return 1;
  const labels = [
    ...splitPositionLabels(person.position),
    ...splitPositionLabels(person.clubPosition),
    ...splitPositionLabels(person.positionTitle),
  ];
  if (labels.some((label) => label === "treasurer" || label === "club treasurer")) return 0;
  if (labels.some((label) => label === "co-treasurer" || label === "co treasurer" || label === "co club treasurer")) return 1;
  return 2;
}

function hasTreasurerPosition(person = {}) {
  if (person.active === false) return false;
  const keys = Array.isArray(person.positionKeys)
    ? person.positionKeys.map((item) => text(item, 80).toLowerCase())
    : [];
  if (keys.some((key) => TREASURER_KEYS.includes(key))) return true;
  const labels = [
    ...splitPositionLabels(person.position),
    ...splitPositionLabels(person.clubPosition),
    ...splitPositionLabels(person.positionTitle),
  ];
  return labels.some((label) => TREASURER_POSITION_LABELS.has(label));
}

export function resolveTreasurerName(people = []) {
  const names = people
    .filter(hasTreasurerPosition)
    .sort((a, b) => personPositionRank(a) - personPositionRank(b) || text(a.name, 160).localeCompare(text(b.name, 160)))
    .map((person) => formatRotaractorName(person.name || person.memberName || person.email, true))
    .filter(Boolean);
  return names.length ? [...new Set(names)].join(", ") : "Treasurer not recorded";
}

export function treasuryExportTypeLabel(record = {}) {
  if (record.type === "income") return "Income";
  return isReimbursementRecord(record) ? "Reimbursement" : "Expense";
}

export function parseTreasuryExportDate(value) {
  const candidate = text(value, 20);
  if (!validDate(candidate)) return null;
  const [year, month, day] = candidate.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

export function parseTreasuryExportTimestamp(value) {
  const iso = timestampIso(value) || text(value, 80);
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatTreasuryExportTimestamp(value) {
  const date = parseTreasuryExportTimestamp(value);
  if (!date) return "Not recorded";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function formatGeneratedTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function descriptionFor(record = {}) {
  const title = text(record.title || record.name, 180);
  const purpose = text(record.purpose || record.linkedEventName, 500);
  if (title && purpose && title.toLowerCase() !== purpose.toLowerCase()) return `${title} - ${purpose}`;
  return title || purpose || "Untitled transaction";
}

function sourceFor(record = {}, typeLabel) {
  if (typeLabel === "Income") return text(record.paidBy || record.memberName, 180) || "Source not recorded";
  if (typeLabel === "Reimbursement") return text(record.paidBy || record.memberName, 180) || "Original payer not recorded";
  return text(record.paidBy, 180) || "Club Treasury";
}

function destinationFor(record = {}, typeLabel) {
  if (typeLabel === "Income") return text(record.paidTo, 180) || TREASURY_EXPORT_CLUB_NAME;
  if (typeLabel === "Reimbursement") return text(record.reimbursedTo || record.paidTo, 180) || "Destination not recorded";
  return text(record.paidTo, 180) || "Destination not recorded";
}

function linkedRecordFor(record = {}) {
  const parts = [];
  const fineId = text(record.fineId, 128);
  if (fineId) {
    let label = `Fine ${fineId}`;
    const member = text(record.memberName, 180);
    const event = text(record.eventName, 180);
    if (member) label += ` - ${member}`;
    if (event) label += ` (${event})`;
    parts.push(label);
  } else if (text(record.source, 80)) {
    parts.push(`Source: ${text(record.source, 80)}`);
  }
  const reference = text(record.referenceNumber || record.cheque, 180);
  if (reference) parts.push(`Reference: ${reference}`);
  const reimbursementStatus = normalizeReimbursementStatus(record.reimbursementStatus || record.reimburse);
  if (reimbursementStatus !== "Not Applicable") parts.push(`Reimbursement: ${reimbursementStatus}`);
  return parts.join("; ") || "Not linked";
}

function exportRow(record = {}, index = 0) {
  const typeLabel = treasuryExportTypeLabel(record);
  const dateValue = text(record.date, 20);
  const date = parseTreasuryExportDate(dateValue);
  const createdAt = parseTreasuryExportTimestamp(record.createdAt);
  const amount = Number(record.amount || 0);
  return {
    sequence: index + 1,
    id: text(record.id, 128) || `transaction-${index + 1}`,
    date,
    dateKey: validDate(dateValue) ? dateValue : "",
    dateLabel: validDate(dateValue) ? formatTreasuryDate(dateValue) : "No date",
    type: typeLabel,
    category: normalizeTreasuryAvenue(record.avenue) || "Uncategorized",
    description: descriptionFor(record),
    amount: Number.isFinite(amount) && amount > 0 ? amount : 0,
    paymentMethod: text(record.paymentMode, 80) || "Not recorded",
    source: sourceFor(record, typeLabel),
    destination: destinationFor(record, typeLabel),
    linkedRecord: linkedRecordFor(record),
    createdBy: text(record.createdByName || record.updatedByName, 180) || "Not recorded",
    createdAt,
    createdAtLabel: createdAt ? formatTreasuryExportTimestamp(createdAt) : "Not recorded",
    originalRecord: record,
  };
}

function summarizeRows(rows = []) {
  const income = rows.filter((row) => row.type === "Income").reduce((sum, row) => sum + row.amount, 0);
  const expenses = rows.filter((row) => row.type !== "Income").reduce((sum, row) => sum + row.amount, 0);
  const reimbursements = rows.filter((row) => row.type === "Reimbursement").reduce((sum, row) => sum + row.amount, 0);
  return {
    transactionCount: rows.length,
    income,
    expenses,
    reimbursements,
    net: income - expenses,
    incomeLabel: formatInr(income),
    expensesLabel: formatInr(expenses),
    reimbursementsLabel: formatInr(reimbursements),
    netLabel: formatInr(income - expenses),
  };
}

function monthKeyFor(row) {
  return row.dateKey ? row.dateKey.slice(0, 7) : "undated";
}

function buildMonthlySummary(rows = []) {
  const months = new Map();
  rows.forEach((row) => {
    const key = monthKeyFor(row);
    const current = months.get(key) || {
      key,
      label: key === "undated" ? "Undated" : formatTreasuryMonth(key),
      income: 0,
      expenses: 0,
      net: 0,
      count: 0,
    };
    if (row.type === "Income") current.income += row.amount;
    else current.expenses += row.amount;
    current.net = current.income - current.expenses;
    current.count += 1;
    months.set(key, current);
  });
  return [...months.values()].sort((a, b) => {
    if (a.key === "undated") return 1;
    if (b.key === "undated") return -1;
    return a.key.localeCompare(b.key);
  });
}

function buildCategorySummary(rows = [], typePredicate) {
  const total = rows.filter(typePredicate).reduce((sum, row) => sum + row.amount, 0);
  const categories = new Map();
  rows.filter(typePredicate).forEach((row) => {
    const current = categories.get(row.category) || { category: row.category, amount: 0, count: 0, share: 0 };
    current.amount += row.amount;
    current.count += 1;
    categories.set(row.category, current);
  });
  return [...categories.values()]
    .map((item) => ({ ...item, share: total ? item.amount / total : 0 }))
    .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category));
}

function hasExportFilter(filters = {}) {
  return ["search", "month", "avenue", "paymentMode", "reimbursementStatus", "hasFile"].some((key) => Boolean(filters[key]))
    || (filters.type && filters.type !== "all");
}

function dateRange(rows = []) {
  const dates = rows.map((row) => row.dateKey).filter(Boolean).sort();
  if (!dates.length) return { from: "", to: "" };
  return { from: dates[0], to: dates.at(-1) };
}

function reportPeriodFor(filters = {}, rows = []) {
  if (filters.month) return formatTreasuryMonth(filters.month);
  if (!hasExportFilter(filters)) return "All Records";
  const range = dateRange(rows);
  if (range.from && range.to) {
    return range.from === range.to
      ? formatTreasuryDate(range.from)
      : `${formatTreasuryDate(range.from)} to ${formatTreasuryDate(range.to)}`;
  }
  return "Filtered Records";
}

function periodSlugFor(filters = {}, rows = []) {
  if (filters.month) return filters.month;
  if (!hasExportFilter(filters)) return "All-Records";
  const range = dateRange(rows);
  if (range.from && range.to) return range.from === range.to ? range.from : `${range.from}_to_${range.to}`;
  return "Filtered-Records";
}

function filterSummary(filters = {}) {
  const result = [];
  if (text(filters.search, 120)) result.push(`Search: ${text(filters.search, 120)}`);
  if (filters.type && filters.type !== "all") result.push(`Type: ${FILTER_TYPE_LABELS[filters.type] || filters.type}`);
  if (filters.month) result.push(`Month: ${formatTreasuryMonth(filters.month)}`);
  if (filters.avenue) result.push(`Avenue: ${normalizeTreasuryAvenue(filters.avenue)}`);
  if (filters.paymentMode) result.push(`Payment mode: ${filters.paymentMode}`);
  if (filters.reimbursementStatus) result.push(`Reimbursement: ${filters.reimbursementStatus}`);
  if (filters.hasFile === "yes") result.push("File: Has supporting file");
  if (filters.hasFile === "no") result.push("File: No supporting file");
  return result.length ? result : ["All loaded records"];
}

export function treasuryExportFileName(report, extension) {
  const slug = text(report?.periodSlug, 80) || "All-Records";
  const safeSlug = slug.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "All-Records";
  return `RCPH_Treasury_Financial_Records_${safeSlug}.${extension}`;
}

export function buildTreasuryExportReport({
  transactions = [],
  members = [],
  filters = DEFAULT_TREASURY_FILTERS,
  generatedAt = new Date(),
} = {}) {
  const normalizedFilters = { ...DEFAULT_TREASURY_FILTERS, ...(filters || {}) };
  const filteredTransactions = filterAndSortTreasury(transactions, normalizedFilters);
  const rows = filteredTransactions.map(exportRow);
  const summary = summarizeRows(rows);
  const monthlySummary = buildMonthlySummary(rows);
  const incomeCategories = buildCategorySummary(rows, (row) => row.type === "Income");
  const expenseCategories = buildCategorySummary(rows, (row) => row.type !== "Income");
  const generatedDate = generatedAt instanceof Date ? generatedAt : new Date(generatedAt);
  const periodSlug = periodSlugFor(normalizedFilters, rows);
  return {
    title: TREASURY_EXPORT_TITLE,
    clubName: TREASURY_EXPORT_CLUB_NAME,
    generatedAt: Number.isNaN(generatedDate.getTime()) ? new Date() : generatedDate,
    generatedAtLabel: formatGeneratedTimestamp(generatedDate),
    treasurerName: resolveTreasurerName(members),
    reportPeriod: reportPeriodFor(normalizedFilters, rows),
    periodSlug,
    filters: normalizedFilters,
    filterSummary: filterSummary(normalizedFilters),
    sortLabel: SORT_LABELS[normalizedFilters.sort] || SORT_LABELS.newest,
    transactions: rows,
    transactionCount: rows.length,
    summary,
    monthlySummary,
    incomeCategories,
    expenseCategories,
    chartTables: {
      monthlySummary,
      incomeCategories,
      expenseCategories,
      incomeVsExpenses: [
        { label: "Income", amount: summary.income },
        { label: "Expenses", amount: summary.expenses },
        { label: "Net Balance", amount: summary.net },
      ],
    },
  };
}
