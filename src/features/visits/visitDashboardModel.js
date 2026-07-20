import {
  VISIT_DASHBOARD_PATHS,
  VISIT_DASHBOARD_TYPES,
} from "../auth/accessModel.js";

const VISIT_DASHBOARD_NAMES = Object.freeze({
  clubAssembly: "Club Assembly",
  dzrVisit: "DZR Visit",
  drrVisit: "DRR Visit",
});

const VISIT_DASHBOARD_TYPE_SET = new Set(VISIT_DASHBOARD_TYPES);

export const VISIT_SLUG_BY_TYPE = Object.freeze(
  VISIT_DASHBOARD_TYPES.reduce((slugs, visitType) => {
    slugs[visitType] = VISIT_DASHBOARD_PATHS[visitType].split("/").pop();
    return slugs;
  }, {}),
);

export const VISIT_TYPE_BY_SLUG = Object.freeze(
  Object.entries(VISIT_SLUG_BY_TYPE).reduce((types, [visitType, slug]) => {
    types[slug] = visitType;
    return types;
  }, {}),
);

const AVENUE_LABELS = Object.freeze({
  ISD: "International Service",
  CMD: "Community Service",
  CSD: "Club Service",
  PDD: "Professional Development",
  RRRO: "Rotary-Rotaract Relations",
  PRO: "Public Relations",
  DEI: "Diversity, Equity & Inclusion",
  GBM: "General Body Meeting",
  CLUB: "Club",
  OTHER: "Other",
});

const AVENUE_ORDER = Object.freeze(Object.keys(AVENUE_LABELS));
export const VISIT_ATTENDANCE_TABS = Object.freeze([
  { key: "club", label: "Club Attendance" },
  { key: "bod", label: "BOD Attendance" },
  { key: "district", label: "District Events Attendance" },
]);
const VISIT_ATTENDANCE_TAB_KEYS = new Set(VISIT_ATTENDANCE_TABS.map((tab) => tab.key));
const ATTENDANCE_STATUSES = new Set(["present", "absent", "late", "excused", "unknown"]);
const TREASURY_TYPES = new Set(["income", "expense", "unknown"]);

function text(value, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function safeId(value, max = 160) {
  const id = text(value, max);
  return id && !/[\\/]/.test(id) ? id : "";
}

function count(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : 0;
}

function percentage(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 100 ? Math.round(number) : 0;
}

function money(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0;
}

function rowAmount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number * 100) / 100 : null;
}

function dateOnly(value) {
  const raw = text(value, 20);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
  const [year, month, day] = raw.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    ? raw
    : "";
}

function normalizeGeneratedAt(value) {
  const raw = text(value, 80);
  if (!raw) return "";
  const millis = Date.parse(raw);
  return Number.isFinite(millis) ? new Date(millis).toISOString() : "";
}

function normalizeVisitType(value, fallbackVisitType = "") {
  const incoming = text(value, 40);
  if (VISIT_DASHBOARD_TYPE_SET.has(incoming)) return incoming;
  return VISIT_DASHBOARD_TYPE_SET.has(fallbackVisitType) ? fallbackVisitType : "";
}

function normalizeOfficialDisplayNames(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.flatMap((name) => {
    const clean = text(name, 120);
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) return [];
    seen.add(key);
    return [clean];
  }).slice(0, 12);
}

function normalizeAvenueCode(value) {
  const code = text(value, 24).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return AVENUE_LABELS[code] ? code : "";
}

function normalizeAvenueEventCounts(value) {
  const byCode = new Map(AVENUE_ORDER.map((code) => [code, 0]));

  if (Array.isArray(value)) {
    value.forEach((row) => {
      if (!row || typeof row !== "object") return;
      const code = normalizeAvenueCode(row.avenueCode || row.code || row.avenue);
      if (!code) return;
      byCode.set(code, count(row.count));
    });
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([code, rawCount]) => {
      const cleanCode = normalizeAvenueCode(code);
      if (cleanCode) byCode.set(cleanCode, count(rawCount));
    });
  }

  return AVENUE_ORDER.map((avenueCode) => ({
    avenueCode,
    avenueName: AVENUE_LABELS[avenueCode],
    count: byCode.get(avenueCode) || 0,
  }));
}

function normalizeRatio(value) {
  const ratio = text(value, 20);
  return ratio && /^[0-9]+:[0-9]+$|^N\/A$/i.test(ratio) ? ratio.toUpperCase() : "N/A";
}

function normalizeStats(value) {
  const raw = value && typeof value === "object" ? value : {};
  return {
    totalMembers: count(raw.totalMembers),
    maleMembers: count(raw.maleMembers),
    femaleMembers: count(raw.femaleMembers),
    otherGenderMembers: count(raw.otherGenderMembers),
    unknownGenderMembers: count(raw.unknownGenderMembers),
    maleFemaleRatio: normalizeRatio(raw.maleFemaleRatio),
    totalEvents: count(raw.totalEvents),
    avenueEventCounts: normalizeAvenueEventCounts(raw.avenueEventCounts),
    treasuryIncome: money(raw.treasuryIncome),
    treasuryExpense: money(raw.treasuryExpense),
    treasuryNet: money(raw.treasuryNet),
  };
}

function normalizeFileSize(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : 0;
}

function normalizeDocumentFile(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const submissionId = safeId(raw.submissionId);
  const title = text(raw.title || raw.fileName, 180);
  if (!submissionId || !title) return null;
  return {
    submissionId,
    title,
    fileName: text(raw.fileName, 180),
    mimeType: text(raw.mimeType, 120).toLowerCase(),
    fileSize: normalizeFileSize(raw.fileSize || raw.sizeBytes),
    uploadedAt: normalizeGeneratedAt(raw.uploadedAt),
    uploadedByName: text(raw.uploadedByName, 120),
    status: text(raw.status, 40).toLowerCase() || "active",
    canOpen: raw.canOpen === true,
  };
}

function normalizeDocumentPanels(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.flatMap((panel) => {
    if (!panel || typeof panel !== "object" || Array.isArray(panel)) return [];
    const positionKey = safeId(panel.positionKey, 80);
    if (!positionKey || seen.has(positionKey)) return [];
    seen.add(positionKey);
    const positionTitle = text(panel.positionTitle, 180) || positionKey;
    const files = Array.isArray(panel.files)
      ? panel.files.map(normalizeDocumentFile).filter(Boolean)
      : [];
    return [{
      positionKey,
      positionTitle,
      avenueCode: text(panel.avenueCode, 40).toUpperCase(),
      avenueName: text(panel.avenueName, 80),
      folderLabel: text(panel.folderLabel, 180) || positionTitle,
      fileCount: files.length,
      files,
    }];
  });
}

function normalizeAttendanceStatus(value) {
  const raw = text(value, 40).toLowerCase();
  return ATTENDANCE_STATUSES.has(raw) ? raw : "unknown";
}

function normalizeAttendanceColumn(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const eventId = safeId(raw.eventId, 160);
  const title = text(raw.title, 180);
  if (!eventId || !title) return null;
  return {
    eventId,
    title,
    date: text(raw.date, 20),
    avenueCode: text(raw.avenueCode, 40).toUpperCase(),
    avenueName: text(raw.avenueName, 80),
  };
}

function normalizeAttendanceRow(raw, columns) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const personId = safeId(raw.personId, 160);
  const name = text(raw.name, 160);
  if (!personId || !name) return null;
  const incomingCells = raw.cells && typeof raw.cells === "object" && !Array.isArray(raw.cells)
    ? raw.cells
    : {};
  return {
    personId,
    name,
    roleOrPosition: text(raw.roleOrPosition, 120),
    cells: columns.reduce((cells, column) => {
      cells[column.eventId] = normalizeAttendanceStatus(incomingCells[column.eventId]);
      return cells;
    }, {}),
  };
}

function normalizeAttendanceView(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const columns = Array.isArray(source.columns)
    ? source.columns.map(normalizeAttendanceColumn).filter(Boolean)
    : [];
  const rows = Array.isArray(source.rows)
    ? source.rows.map((row) => normalizeAttendanceRow(row, columns)).filter(Boolean)
    : [];
  const summary = source.summary && typeof source.summary === "object" ? source.summary : {};
  return {
    summary: {
      totalEvents: count(summary.totalEvents) || columns.length,
      totalPeople: count(summary.totalPeople) || rows.length,
      averageAttendanceRate: percentage(summary.averageAttendanceRate),
    },
    columns,
    rows,
  };
}

function normalizeAttendance(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return VISIT_ATTENDANCE_TABS.reduce((attendance, tab) => {
    attendance[tab.key] = normalizeAttendanceView(source[tab.key]);
    return attendance;
  }, {});
}

function normalizeTreasuryType(value) {
  const type = text(value, 20).toLowerCase();
  return TREASURY_TYPES.has(type) ? type : "unknown";
}

function normalizeTreasuryRow(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const transactionId = safeId(raw.transactionId, 180);
  const title = text(raw.title, 180);
  const date = dateOnly(raw.date);
  const amount = rowAmount(raw.amount);
  if (!transactionId || !title || !date || amount === null) return null;
  return {
    transactionId,
    date,
    title,
    description: text(raw.description, 500),
    type: normalizeTreasuryType(raw.type),
    amount,
    category: text(raw.category, 120),
    avenueCode: text(raw.avenueCode, 40).toUpperCase(),
    avenueName: text(raw.avenueName, 80),
    notes: text(raw.notes, 500),
  };
}

function summarizeTreasuryRows(rows) {
  const summary = rows.reduce((total, row) => {
    if (row.type === "income") total.income += row.amount;
    if (row.type === "expense") total.expense += row.amount;
    return total;
  }, { income: 0, expense: 0 });
  summary.income = money(summary.income);
  summary.expense = money(summary.expense);
  return {
    income: summary.income,
    expense: summary.expense,
    net: money(summary.income - summary.expense),
    transactionCount: rows.length,
  };
}

function normalizeTreasury(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const rows = Array.isArray(source.rows)
    ? source.rows.map(normalizeTreasuryRow).filter(Boolean)
    : [];
  const derived = summarizeTreasuryRows(rows);
  const summary = source.summary && typeof source.summary === "object" ? source.summary : {};
  return {
    summary: {
      income: money(summary.income ?? derived.income),
      expense: money(summary.expense ?? derived.expense),
      net: money(summary.net ?? derived.net),
      transactionCount: count(summary.transactionCount ?? derived.transactionCount),
    },
    rows,
  };
}

export function visitTypeFromSlug(slug) {
  return VISIT_TYPE_BY_SLUG[text(slug, 80)] || "";
}

export function visitSlugFromType(visitType) {
  return VISIT_SLUG_BY_TYPE[visitType] || "";
}

export function visitDashboardName(visitType) {
  return VISIT_DASHBOARD_NAMES[visitType] || "Visit";
}

export function normalizeVisitDashboardData(raw, fallbackVisitType = "") {
  const source = raw && typeof raw === "object" ? raw : {};
  const visitSource = source.visit && typeof source.visit === "object" ? source.visit : {};
  const visitType = normalizeVisitType(visitSource.visitType, fallbackVisitType);
  const visitName = text(visitSource.visitName, 120) || visitDashboardName(visitType);
  const title = text(visitSource.title, 160) || `${visitName} Dashboard`;

  return {
    visit: {
      visitType,
      visitName,
      title,
      officialDisplayNames: normalizeOfficialDisplayNames(visitSource.officialDisplayNames),
      dashboardVisible: visitSource.dashboardVisible === true,
    },
    stats: normalizeStats(source.stats),
    documentPanels: normalizeDocumentPanels(source.documentPanels),
    attendance: normalizeAttendance(source.attendance),
    treasury: normalizeTreasury(source.treasury),
    generatedAt: normalizeGeneratedAt(source.generatedAt),
  };
}

const INR_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatVisitDashboardMoney(value) {
  return INR_FORMATTER.format(money(value));
}

export function formatVisitDashboardFileSize(value) {
  const bytes = normalizeFileSize(value);
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;
  return `${Math.round(bytes / 104857.6) / 10} MB`;
}

export function formatVisitDashboardDateTime(value) {
  const iso = normalizeGeneratedAt(value);
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

export function formatVisitDashboardDate(value) {
  const date = dateOnly(value);
  if (!date) return "";
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

export function attendanceStatusLabel(value) {
  const labels = {
    present: "Present",
    absent: "Absent",
    late: "Late",
    excused: "Excused",
    unknown: "Unknown",
  };
  return labels[normalizeAttendanceStatus(value)] || labels.unknown;
}

export function validVisitAttendanceTab(value) {
  return VISIT_ATTENDANCE_TAB_KEYS.has(value) ? value : VISIT_ATTENDANCE_TABS[0].key;
}

export function getVisitDashboardErrorMessage() {
  return "This visit dashboard could not be loaded. Please retry the protected request.";
}
