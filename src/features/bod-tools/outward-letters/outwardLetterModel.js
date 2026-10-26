import { parseGoogleFormCsv } from "../../admin/treasury/treasuryModel.js";

export const OUTWARD_MAX_ROWS = 300;
export const OUTWARD_CLUB_NAME_MAX = 120;
export const OUTWARD_RID_MAX = 20;

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const HEADER_ALIASES = Object.freeze({
  date: ["date", "letter date", "date of letter"],
  rid: ["rid", "r.i.d", "r.i.d.", "club rid", "rotaract id", "rotaract district id"],
  clubName: ["club name", "club", "name of club", "rotaract club", "rotaract club of", "name"],
});

function text(value, max = 500) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
}

function headerKey(value) {
  return text(value, 80).toLowerCase().replace(/[:*]/g, "").trim();
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function isoFromParts(year, month, day) {
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return "";
  return `${year}-${pad(month)}-${pad(day)}`;
}

// Accepts an Excel date, 26/10/2026, 26-10-26, 2026-10-26 and 26 Oct 2026. Day first, as written in India.
export function parseOutwardDate(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return isoFromParts(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }
  const raw = text(value, 40);
  if (!raw) return "";
  let match = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (match) return isoFromParts(Number(match[1]), Number(match[2]), Number(match[3]));
  match = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  if (match) {
    const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
    return isoFromParts(year, Number(match[2]), Number(match[1]));
  }
  match = raw.match(/^(\d{1,2})[ -]([A-Za-z]{3,9}),?[ -](\d{2}|\d{4})$/);
  if (match) {
    const month = MONTHS.indexOf(match[2].slice(0, 3).toLowerCase()) + 1;
    const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
    return month ? isoFromParts(year, month, Number(match[1])) : "";
  }
  return "";
}

// The date as printed on the letter: 26/10/2026.
export function formatOutwardDate(iso) {
  const match = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

function cleanRid(value) {
  return text(value, 40).replace(/^rid[\s:.-]*/i, "").replace(/\.0+$/, "");
}

function cleanClubName(value) {
  return text(value, 200).replace(/^rotaract club of\s+/i, "");
}

function findColumns(headerRow) {
  const keys = headerRow.map(headerKey);
  const columns = {};
  Object.entries(HEADER_ALIASES).forEach(([field, aliases]) => {
    columns[field] = keys.findIndex((key) => aliases.includes(key));
  });
  return columns;
}

// Rows from a CSV or the first Excel sheet, header first. Nothing is saved or sent anywhere.
export function parseOutwardRows(rawRows = []) {
  const rows = [];
  const skippedRows = [];
  const errors = [];
  const table = (Array.isArray(rawRows) ? rawRows : []).filter((row) => Array.isArray(row) && row.some((cell) => text(cell)));
  if (!table.length) return { rows, skippedRows, errors: ["The file is empty."], totalRows: 0 };
  const columns = findColumns(table[0]);
  const missing = Object.entries({ date: "Date", rid: "RID", clubName: "Club Name" }).filter(([field]) => columns[field] < 0).map(([, label]) => label);
  if (missing.length) return { rows, skippedRows, errors: [`The first row needs these column headings: ${missing.join(", ")}.`], totalRows: table.length - 1 };
  const seen = new Set();
  table.slice(1).forEach((cells, index) => {
    const line = index + 2;
    const clubName = cleanClubName(cells[columns.clubName]);
    const rid = cleanRid(cells[columns.rid]);
    const dateValue = cells[columns.date];
    const date = parseOutwardDate(dateValue);
    const problems = [];
    if (!clubName) problems.push("Club Name is missing");
    else if (clubName.length > OUTWARD_CLUB_NAME_MAX) problems.push(`Club Name is longer than ${OUTWARD_CLUB_NAME_MAX} characters`);
    if (!rid) problems.push("RID is missing");
    else if (rid.length > OUTWARD_RID_MAX) problems.push(`RID is longer than ${OUTWARD_RID_MAX} characters`);
    if (!text(dateValue instanceof Date ? "x" : dateValue)) problems.push("Date is missing");
    else if (!date) problems.push("Date is not a valid date (use DD/MM/YYYY)");
    const key = `${clubName.toLowerCase()}|${rid.toLowerCase()}`;
    const warnings = clubName && rid && seen.has(key) ? ["Same club and RID appear earlier in the file"] : [];
    if (clubName && rid) seen.add(key);
    rows.push({ line, clubName, rid, date, valid: !problems.length, problems, warnings });
  });
  if (rows.length > OUTWARD_MAX_ROWS) errors.push(`Upload at most ${OUTWARD_MAX_ROWS} clubs at a time.`);
  if (!rows.length) errors.push("The file has headings but no clubs.");
  return { rows, skippedRows, errors, totalRows: rows.length };
}

export function parseOutwardCsv(csvText = "") {
  return parseOutwardRows(parseGoogleFormCsv(csvText));
}

function excelCellValue(value) {
  if (value === undefined || value === null) return "";
  if (value instanceof Date) return value;
  if (typeof value === "object") {
    if (typeof value.text === "string") return value.text;
    if (value.result instanceof Date) return value.result;
    if (typeof value.result === "string" || typeof value.result === "number") return String(value.result);
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text || "").join("");
  }
  return String(value);
}

export async function parseOutwardFile(file) {
  const name = String(file?.name || "").toLowerCase();
  if (name.endsWith(".csv") || file?.type === "text/csv") return parseOutwardCsv(await file.text());
  if (name.endsWith(".xlsx") || file?.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    const imported = await import("exceljs");
    const ExcelJS = imported.default || imported;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const worksheet = workbook.worksheets[0];
    if (!worksheet) return { rows: [], skippedRows: [], errors: ["The Excel workbook has no sheets."], totalRows: 0 };
    const rows = [];
    worksheet.eachRow((row) => {
      rows.push(Array.from({ length: row.cellCount }, (_, index) => excelCellValue(row.getCell(index + 1).value)));
    });
    return parseOutwardRows(rows);
  }
  return { rows: [], skippedRows: [], errors: ["Upload a .csv or .xlsx file."], totalRows: 0 };
}

// One safe, unique file name per club for the separate PDFs.
export function outwardPdfFilenames(rows = []) {
  const used = new Set();
  return rows.map((row) => {
    const base = `RCPH-Letterhead-${row.clubName}`.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "RCPH-Letterhead";
    let name = base;
    for (let n = 2; used.has(name.toLowerCase()); n += 1) name = `${base}-${n}`;
    used.add(name.toLowerCase());
    return `${name}.pdf`;
  });
}
