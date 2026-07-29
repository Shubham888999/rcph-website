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
const ATTENDANCE_ROLE_CODES = Object.freeze({
  admin: "Admin",
  avenuechair: "Chair",
  ceditor: "Co-Editor",
  ccmd: "Co-CMD",
  ccsd: "Co-CSD",
  ccwd: "Co-CWD",
  cdei: "Co-DEI",
  cisd: "Co-ISD",
  clubservice: "CSD",
  clubservicedirector: "CSD",
  clubwebdirector: "CWD",
  clubwebsitedirector: "CWD",
  cpres: "Co-President",
  cpdd: "Co-PDD",
  cpro: "Co-PRO",
  crrro: "Co-RRRO",
  csd: "CSD",
  csec: "Co-Secretary",
  csaa: "Co-SAA",
  ctreas: "Co-Treasurer",
  cvp: "Co-VP",
  coclubservice: "Co-CSD",
  coclubservicedirector: "Co-CSD",
  cocsd: "Co-CSD",
  cmd: "CMD",
  communityservice: "CMD",
  communityservicedirector: "CMD",
  cocmd: "Co-CMD",
  cocommunityservice: "Co-CMD",
  cocommunityservicedirector: "Co-CMD",
  codei: "Co-DEI",
  codeidirector: "Co-DEI",
  codiversityequityandinclusion: "Co-DEI",
  codiversityequityandinclusiondirector: "Co-DEI",
  coeditor: "Co-Editor",
  cointernationalservice: "Co-ISD",
  cointernationalservicedirector: "Co-ISD",
  coisd: "Co-ISD",
  copdd: "Co-PDD",
  coprofessionaldevelopment: "Co-PDD",
  coprofessionaldevelopmentdirector: "Co-PDD",
  copresident: "Co-President",
  copro: "Co-PRO",
  copublicrelations: "Co-PRO",
  copublicrelationsdirector: "Co-PRO",
  copublicrelationsofficer: "Co-PRO",
  corrro: "Co-RRRO",
  corotaryrotaractrelations: "Co-RRRO",
  corotaryrotaractrelationsdirector: "Co-RRRO",
  corotaryrotaractrelationsofficer: "Co-RRRO",
  cosaa: "Co-SAA",
  cosecretary: "Co-Secretary",
  cosergeantatarms: "Co-SAA",
  cotreasurer: "Co-Treasurer",
  cotreas: "Co-Treasurer",
  covicepresident: "Co-VP",
  cowebdirector: "Co-CWD",
  cowebsitedirector: "Co-CWD",
  coclubwebdirector: "Co-CWD",
  coclubwebsitedirector: "Co-CWD",
  cocwd: "Co-CWD",
  cwd: "CWD",
  dei: "DEI",
  deidirector: "DEI",
  diversityequityandinclusion: "DEI",
  diversityequityandinclusiondirector: "DEI",
  districtofficial: "District",
  editor: "Editor",
  generalbodymember: "Member",
  gbm: "Member",
  immedatepastpresident: "IPP",
  immediatepastpresident: "IPP",
  ipp: "IPP",
  isd: "ISD",
  internationalservice: "ISD",
  internationalservicedirector: "ISD",
  jsec: "Joint Secretary",
  jointsecretary: "Joint Secretary",
  member: "Member",
  president: "President",
  pres: "President",
  pdd: "PDD",
  professionaldevelopment: "PDD",
  professionaldevelopmentdirector: "PDD",
  prospect: "Prospect",
  pro: "PRO",
  publicrelations: "PRO",
  publicrelationsofficer: "PRO",
  publicrelationsdirector: "PRO",
  rrro: "RRRO",
  rotaryrotaractrelations: "RRRO",
  rotaryrotaractrelationsofficer: "RRRO",
  rotaryrotaractrelationsdirector: "RRRO",
  saa: "SAA",
  secretary: "Secretary",
  sec: "Secretary",
  sergeantatarms: "SAA",
  treas: "Treasurer",
  treasurer: "Treasurer",
  vicepresident: "VP",
  vp: "VP",
  webdirector: "CWD",
  websitedirector: "CWD",
});

const ATTENDANCE_ROLE_FAMILIES = Object.freeze([
  { patterns: ["internationalservice"], code: "ISD" },
  { patterns: ["communityservice"], code: "CMD" },
  { patterns: ["clubservice"], code: "CSD" },
  { patterns: ["professionaldevelopment"], code: "PDD" },
  { patterns: ["rotaryrotaractrelations"], code: "RRRO" },
  { patterns: ["publicrelations"], code: "PRO" },
  { patterns: ["diversityequityandinclusion"], code: "DEI" },
  { patterns: ["websitedirector", "webdirector"], code: "CWD" },
  { patterns: ["sergeantatarms"], code: "SAA" },
]);

function text(value, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function roleLookupKey(value) {
  return text(value, 120)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

function hasCoRolePrefix(value) {
  const raw = text(value, 120).trim();
  if (/^co[-_\s]+/i.test(raw)) return true;
  if (raw.slice(0, 2).toLowerCase() !== "co" || raw.length < 3) return false;
  return /[A-Z0-9]/.test(raw[2]) && raw[2] === raw[2].toUpperCase();
}

function compactRolePart(value) {
  const raw = text(value, 120).replace(/\s+/g, " ");
  const key = roleLookupKey(raw);
  if (!raw) return "";
  if (ATTENDANCE_ROLE_CODES[key]) return ATTENDANCE_ROLE_CODES[key];
  const coRole = hasCoRolePrefix(raw);
  const family = ATTENDANCE_ROLE_FAMILIES.find((item) => item.patterns.some((pattern) => key.includes(pattern)));
  if (family) return coRole ? `Co-${family.code}` : family.code;
  if (/^[A-Z0-9]{2,6}$/.test(raw)) return raw;
  if (raw.length <= 12) return raw;
  return raw
    .split(/\s+/)
    .filter((part) => !["and", "of", "the"].includes(part.toLowerCase()))
    .map((part) => part[0]?.toUpperCase() || "")
    .join("")
    .slice(0, 6) || raw;
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
  const fileName = text(raw.fileName, 180);
  const driveFileIds = [raw.driveFileId, raw.fileDriveId, raw.googleDriveFileId, raw.fileId];
  const driveFileUrls = [raw.openUrl, raw.driveFileUrl, raw.fileUrl, raw.webViewLink, raw.previewUrl];
  const safeFileSignal = raw.canOpen === true
    || raw.canPreview === true
    || Boolean(raw.openUrl || raw.previewUrl);
  const openUrl = safeFileSignal
    ? normalizeDriveFileOpenUrlFromCandidates([...driveFileIds, ...driveFileUrls])
    : "";
  const previewUrl = safeFileSignal && raw.canPreview !== false && isPreviewableDocument(raw, fileName)
    ? normalizeDriveFilePreviewUrlFromCandidates([raw.previewUrl, ...driveFileIds, ...driveFileUrls])
    : "";
  return {
    submissionId,
    title,
    fileName,
    mimeType: text(raw.mimeType, 120).toLowerCase(),
    fileSize: normalizeFileSize(raw.fileSize || raw.sizeBytes),
    uploadedAt: normalizeGeneratedAt(raw.uploadedAt),
    uploadedByName: text(raw.uploadedByName, 120),
    status: text(raw.status, 40).toLowerCase() || "active",
    canOpen: Boolean(openUrl) && raw.canOpen !== false,
    openUrl,
    canPreview: Boolean(previewUrl),
    previewUrl,
  };
}

function normalizeDriveFolderOpenUrl(value) {
  const raw = text(value, 1000);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.hostname !== "drive.google.com") return "";
    const segments = url.pathname.split("/").filter(Boolean);
    const folderSegmentIndex = segments.indexOf("folders");
    if (folderSegmentIndex < 0) return "";
    const folderId = segments[folderSegmentIndex + 1] || "";
    if (!/^[A-Za-z0-9_-]{5,220}$/.test(folderId)) return "";
    return `https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}`;
  } catch {
    return "";
  }
}

function normalizeDriveFileId(value) {
  const id = text(value, 220);
  return /^[A-Za-z0-9_-]{5,220}$/.test(id) ? id : "";
}

function driveFileIdFromUrl(value) {
  const raw = text(value, 1000);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return "";
    const segments = url.pathname.split("/").filter(Boolean);
    if (url.hostname === "drive.google.com") {
      const fileSegmentIndex = segments.indexOf("file");
      if (fileSegmentIndex >= 0 && segments[fileSegmentIndex + 1] === "d") {
        return normalizeDriveFileId(segments[fileSegmentIndex + 2]);
      }
      if (segments.length === 1 && segments[0] === "open") {
        return normalizeDriveFileId(url.searchParams.get("id"));
      }
    }
    if (
      url.hostname === "docs.google.com"
      && ["document", "spreadsheets", "presentation"].includes(segments[0])
      && segments[1] === "d"
    ) {
      return normalizeDriveFileId(segments[2]);
    }
  } catch {
    return "";
  }
  return "";
}

function driveFileIdFromCandidates(values) {
  for (const value of Array.isArray(values) ? values : []) {
    const driveFileId = normalizeDriveFileId(value) || driveFileIdFromUrl(value);
    if (driveFileId) return driveFileId;
  }
  return "";
}

function normalizeDriveFileOpenUrlFromCandidates(values) {
  const driveFileId = driveFileIdFromCandidates(values);
  return driveFileId ? `https://drive.google.com/file/d/${encodeURIComponent(driveFileId)}/view` : "";
}

function normalizeDriveFilePreviewUrlFromCandidates(values) {
  const driveFileId = driveFileIdFromCandidates(values);
  return driveFileId ? `https://drive.google.com/file/d/${encodeURIComponent(driveFileId)}/preview` : "";
}

const PREVIEWABLE_DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.presentation",
]);
const PREVIEWABLE_DOCUMENT_EXTENSIONS = new Set(["pdf", "ppt", "pptx"]);

function fileExtension(value) {
  const match = text(value, 220).toLowerCase().match(/\.([a-z0-9]{1,12})$/);
  return match ? match[1] : "";
}

function isPreviewableDocument(raw, fileName = "") {
  const mimeType = text(raw?.mimeType, 160).toLowerCase();
  if (PREVIEWABLE_DOCUMENT_MIME_TYPES.has(mimeType)) return true;
  return PREVIEWABLE_DOCUMENT_EXTENSIONS.has(fileExtension(fileName || raw?.fileName || raw?.originalFileName));
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
    const openUrl = normalizeDriveFolderOpenUrl(panel.openUrl);
    return [{
      positionKey,
      positionTitle,
      avenueCode: text(panel.avenueCode, 40).toUpperCase(),
      avenueName: text(panel.avenueName, 80),
      folderLabel: text(panel.folderLabel, 180) || positionTitle,
      fileCount: files.length,
      canOpen: panel.canOpen === true && Boolean(openUrl),
      openUrl,
      files,
    }];
  });
}

function normalizeAttendanceStatus(value) {
  const raw = text(value, 40).toLowerCase();
  return ATTENDANCE_STATUSES.has(raw) ? raw : "unknown";
}

function nullablePercentage(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 100 ? Math.round(number) : null;
}

function attendanceMetricsFromStatuses(statuses) {
  let attendedCount = 0;
  let eligibleCount = 0;
  (Array.isArray(statuses) ? statuses : []).forEach((value) => {
    const status = normalizeAttendanceStatus(value);
    if (status === "present" || status === "late") {
      attendedCount += 1;
      eligibleCount += 1;
    } else if (status === "absent") {
      eligibleCount += 1;
    }
  });
  const attendanceRate = eligibleCount ? Math.round((attendedCount / eligibleCount) * 100) : null;
  return { attendedCount, eligibleCount, attendanceRate };
}

function averageNullablePercentage(items) {
  const rates = (Array.isArray(items) ? items : [])
    .map((item) => nullablePercentage(item?.attendanceRate))
    .filter((rate) => rate !== null);
  if (!rates.length) return null;
  return Math.round(rates.reduce((sum, rate) => sum + rate, 0) / rates.length);
}

function attendanceRateLabel(value) {
  const rate = nullablePercentage(value);
  return rate === null ? "N/A" : `${rate}%`;
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
    attendedCount: count(raw.attendedCount),
    eligibleCount: count(raw.eligibleCount),
    attendanceRate: nullablePercentage(raw.attendanceRate),
    attendanceLabel: attendanceRateLabel(raw.attendanceRate),
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
  const cells = columns.reduce((result, column) => {
    result[column.eventId] = normalizeAttendanceStatus(incomingCells[column.eventId]);
    return result;
  }, {});
  const metrics = attendanceMetricsFromStatuses(Object.values(cells));
  return {
    personId,
    name,
    roleOrPosition: text(raw.roleOrPosition, 120),
    attendedCount: metrics.attendedCount,
    eligibleCount: metrics.eligibleCount,
    attendanceRate: metrics.attendanceRate,
    attendanceLabel: attendanceRateLabel(metrics.attendanceRate),
    cells,
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
  const columnsWithMetrics = columns.map((column) => {
    const metrics = attendanceMetricsFromStatuses(rows.map((row) => row.cells[column.eventId]));
    const attendanceRate = nullablePercentage(column.attendanceRate ?? metrics.attendanceRate);
    return {
      ...column,
      attendedCount: column.eligibleCount ? column.attendedCount : metrics.attendedCount,
      eligibleCount: column.eligibleCount || metrics.eligibleCount,
      attendanceRate,
      attendanceLabel: attendanceRateLabel(attendanceRate),
    };
  });
  const overallMetrics = attendanceMetricsFromStatuses(
    rows.flatMap((row) => columnsWithMetrics.map((column) => row.cells[column.eventId])),
  );
  const summary = source.summary && typeof source.summary === "object" ? source.summary : {};
  const averageAttendanceRate = nullablePercentage(summary.averageAttendanceRate ?? overallMetrics.attendanceRate) ?? 0;
  const averageEventAttendanceRate = nullablePercentage(summary.averageEventAttendanceRate)
    ?? averageNullablePercentage(columnsWithMetrics);
  const averageMemberAttendanceRate = nullablePercentage(summary.averageMemberAttendanceRate)
    ?? averageNullablePercentage(rows);
  return {
    summary: {
      totalEvents: count(summary.totalEvents) || columnsWithMetrics.length,
      totalPeople: count(summary.totalPeople) || rows.length,
      averageAttendanceRate,
      averageAttendanceLabel: attendanceRateLabel(averageAttendanceRate),
      averageEventAttendanceRate,
      averageEventAttendanceLabel: attendanceRateLabel(averageEventAttendanceRate),
      averageMemberAttendanceRate,
      averageMemberAttendanceLabel: attendanceRateLabel(averageMemberAttendanceRate),
    },
    columns: columnsWithMetrics,
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
  const billOpenUrl = normalizeDriveFileOpenUrlFromCandidates([
    raw.billDriveFileId,
    raw.billFileId,
    raw.billOpenUrl,
    raw.billUrl,
    raw.driveFileUrl,
    raw.fileUrl,
  ]);
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
    billCanOpen: Boolean(billOpenUrl) && raw.billCanOpen !== false,
    billOpenUrl,
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

export function formatVisitAttendanceName(value) {
  const name = text(value, 160).replace(/\s+/g, " ");
  if (!name) return "";
  if (/^Rtr(?:\.|\b)/i.test(name)) return name.replace(/^Rtr(?:\.|\b)\s*/i, "Rtr. ");
  return `Rtr. ${name}`;
}

export function formatVisitAttendanceRoleCode(value) {
  const raw = text(value, 120).replace(/\s+/g, " ");
  if (!raw) return "Member";
  const wholeKey = roleLookupKey(raw);
  if (ATTENDANCE_ROLE_CODES[wholeKey]) return ATTENDANCE_ROLE_CODES[wholeKey];
  const parts = raw
    .split(/\s*(?:,|;|\/)\s*/)
    .map(compactRolePart)
    .filter(Boolean);
  if (parts.length > 1) return [...new Set(parts)].join(", ");
  return compactRolePart(raw) || raw;
}

export function getVisitDocumentPanelActionLabel(panel) {
  return panel?.canOpen === true && panel.openUrl ? "Open folder" : "";
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
