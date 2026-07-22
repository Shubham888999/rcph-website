import {
  A4_PDF_SIZE,
  buildSimpleA4Pdf,
  normalizePdfText,
  pdfFillRectCommand,
  pdfLineCommand,
  pdfTextCommand,
  wrapPdfText,
} from "../pdf/simplePdf.js";

export const BOD_SECRETARIAL_REPORT_PDF_LAYOUT = Object.freeze({
  page: A4_PDF_SIZE,
  margin: 42,
  top: 784,
  bottom: 52,
  titleSize: 18,
  headingSize: 15,
  sectionSize: 12,
  bodySize: 9,
  headerSize: 8.4,
  lineHeight: 11.2,
  padding: 5,
  tableHeaderHeight: 22,
});

const CONTENT_WIDTH = A4_PDF_SIZE.width - BOD_SECRETARIAL_REPORT_PDF_LAYOUT.margin * 2;
const SUMMARY_ROWS = Object.freeze([
  Object.freeze(["Club Strength", "clubStrength"]),
  Object.freeze(["Club Score", "clubScore"]),
  Object.freeze(["Club Rank (As of Now)", "clubRank"]),
  Object.freeze(["Overall Projects", "overallProjects"]),
  Object.freeze(["No. of meetings (BOD)", "bodMeetingCount"]),
  Object.freeze(["No. of meetings (GBM)", "gbmMeetingCount"]),
]);

const MEETING_COLUMNS = Object.freeze([
  Object.freeze({ key: "serial", label: "Sr. No.", width: 46, maxLines: 1 }),
  Object.freeze({ key: "type", label: "Type", width: 78, maxLines: 2 }),
  Object.freeze({ key: "dateLabel", label: "Date", width: 78, maxLines: 1 }),
  Object.freeze({ key: "description", label: "Description", width: 309, maxLines: 10 }),
]);

const EVENT_COLUMNS = Object.freeze([
  Object.freeze({ key: "serial", label: "Sr. No.", width: 46, maxLines: 1 }),
  Object.freeze({ key: "avenueLabel", label: "Avenue", width: 78, maxLines: 2 }),
  Object.freeze({ key: "dateLabel", label: "Date", width: 62, maxLines: 1 }),
  Object.freeze({ key: "name", label: "Name", width: 120, maxLines: 4 }),
  Object.freeze({ key: "description", label: "Description", width: 205, maxLines: 10 }),
]);

function cleanText(value, max = 1200) {
  return normalizePdfText(value).trim().replace(/\s+/g, " ").slice(0, max);
}

function displayText(value, fallback = "Not available") {
  return cleanText(value) || fallback;
}

function stringValue(value) {
  if (value === undefined || value === null || value === "") return "Not available";
  return displayText(value);
}

function text(commands, x, y, value, options = {}) {
  commands.push(pdfTextCommand({
    x,
    y,
    text: value,
    size: options.size || BOD_SECRETARIAL_REPORT_PDF_LAYOUT.bodySize,
    bold: options.bold,
    gray: options.gray || 0,
  }));
}

function strokeRect(commands, x, top, width, height, gray = 0.45) {
  commands.push(
    pdfLineCommand({ x1: x, y1: top, x2: x + width, y2: top, gray }),
    pdfLineCommand({ x1: x + width, y1: top, x2: x + width, y2: top - height, gray }),
    pdfLineCommand({ x1: x + width, y1: top - height, x2: x, y2: top - height, gray }),
    pdfLineCommand({ x1: x, y1: top - height, x2: x, y2: top, gray }),
  );
}

function truncateLines(lines, maxLines) {
  if (lines.length <= maxLines) return lines;
  const output = lines.slice(0, maxLines);
  output[output.length - 1] = `${output[output.length - 1].replace(/\.*$/, "")}...`;
  return output;
}

function cellLines(value, width, maxLines) {
  const layout = BOD_SECRETARIAL_REPORT_PDF_LAYOUT;
  const lines = wrapPdfText(displayText(value), width - layout.padding * 2, layout.bodySize)
    .map((line) => line || " ");
  return truncateLines(lines.length ? lines : [" "], maxLines);
}

function rowCellLines(columns, row) {
  return Object.fromEntries(columns.map((column) => [
    column.key,
    cellLines(row?.[column.key], column.width, column.maxLines || 8),
  ]));
}

function rowHeight(lines) {
  const layout = BOD_SECRETARIAL_REPORT_PDF_LAYOUT;
  return Math.max(1, ...Object.values(lines).map((value) => value.length)) * layout.lineHeight + layout.padding * 2;
}

function drawTableHeader(commands, y, columns) {
  const layout = BOD_SECRETARIAL_REPORT_PDF_LAYOUT;
  const x = layout.margin;
  commands.push(pdfFillRectCommand({
    x,
    y: y - layout.tableHeaderHeight,
    width: CONTENT_WIDTH,
    height: layout.tableHeaderHeight,
    gray: 0.88,
  }));
  let currentX = x;
  columns.forEach((column) => {
    text(commands, currentX + layout.padding, y - 14, column.label, { size: layout.headerSize, bold: true });
    commands.push(pdfLineCommand({ x1: currentX, y1: y, x2: currentX, y2: y - layout.tableHeaderHeight, gray: 0.55 }));
    currentX += column.width;
  });
  commands.push(
    pdfLineCommand({ x1: currentX, y1: y, x2: currentX, y2: y - layout.tableHeaderHeight, gray: 0.55 }),
    pdfLineCommand({ x1: x, y1: y, x2: x + CONTENT_WIDTH, y2: y, gray: 0.55 }),
    pdfLineCommand({ x1: x, y1: y - layout.tableHeaderHeight, x2: x + CONTENT_WIDTH, y2: y - layout.tableHeaderHeight, gray: 0.55 }),
  );
  return y - layout.tableHeaderHeight;
}

function drawRow(commands, y, columns, lines, shaded) {
  const layout = BOD_SECRETARIAL_REPORT_PDF_LAYOUT;
  const height = rowHeight(lines);
  if (shaded) {
    commands.push(pdfFillRectCommand({
      x: layout.margin,
      y: y - height,
      width: CONTENT_WIDTH,
      height,
      gray: 0.965,
    }));
  }
  let currentX = layout.margin;
  columns.forEach((column) => {
    lines[column.key].forEach((line, index) => {
      text(commands, currentX + layout.padding, y - layout.padding - layout.bodySize - index * layout.lineHeight, line);
    });
    commands.push(pdfLineCommand({ x1: currentX, y1: y, x2: currentX, y2: y - height, gray: 0.72 }));
    currentX += column.width;
  });
  commands.push(
    pdfLineCommand({ x1: currentX, y1: y, x2: currentX, y2: y - height, gray: 0.72 }),
    pdfLineCommand({ x1: layout.margin, y1: y - height, x2: layout.margin + CONTENT_WIDTH, y2: y - height, gray: 0.72 }),
  );
  return y - height;
}

function monthPage(pages, month, continued = false) {
  const layout = BOD_SECRETARIAL_REPORT_PDF_LAYOUT;
  const commands = [];
  pages.push(commands);
  const heading = `${displayText(month?.heading || `Monthly Report: ${month?.monthLabel || ""}`)}${continued ? " (continued)" : ""}`;
  text(commands, layout.margin, layout.top, heading, { size: layout.headingSize, bold: true });
  commands.push(pdfLineCommand({
    x1: layout.margin,
    y1: layout.top - 12,
    x2: layout.margin + CONTENT_WIDTH,
    y2: layout.top - 12,
    gray: 0.55,
    width: 0.7,
  }));
  return { commands, y: layout.top - 36 };
}

function continuationPage(state, month, sectionTitle, columns) {
  const layout = BOD_SECRETARIAL_REPORT_PDF_LAYOUT;
  const next = monthPage(state.pages, month, true);
  next.pages = state.pages;
  text(next.commands, layout.margin, next.y, sectionTitle, { size: layout.sectionSize, bold: true });
  next.y -= 16;
  next.y = drawTableHeader(next.commands, next.y, columns);
  return next;
}

function ensureSectionSpace(state, month, requiredHeight) {
  const layout = BOD_SECRETARIAL_REPORT_PDF_LAYOUT;
  if (state.y - requiredHeight >= layout.bottom) return state;
  const next = monthPage(state.pages, month, true);
  next.pages = state.pages;
  return next;
}

function ensureRowSpace(state, month, sectionTitle, columns, requiredHeight) {
  const layout = BOD_SECRETARIAL_REPORT_PDF_LAYOUT;
  if (state.y - requiredHeight >= layout.bottom) return state;
  return continuationPage(state, month, sectionTitle, columns);
}

function drawEmptyRow(state, month, sectionTitle, columns, emptyText) {
  const layout = BOD_SECRETARIAL_REPORT_PDF_LAYOUT;
  const height = 26;
  state = ensureRowSpace(state, month, sectionTitle, columns, height);
  text(state.commands, layout.margin + layout.padding, state.y - 17, emptyText, { gray: 0.35 });
  commandsTableBorder(state.commands, state.y, height);
  state.y -= height;
  return state;
}

function commandsTableBorder(commands, y, height) {
  const layout = BOD_SECRETARIAL_REPORT_PDF_LAYOUT;
  strokeRect(commands, layout.margin, y, CONTENT_WIDTH, height, 0.72);
}

function drawTable(state, month, sectionTitle, columns, rows, emptyText) {
  const layout = BOD_SECRETARIAL_REPORT_PDF_LAYOUT;
  state = ensureSectionSpace(state, month, 58);
  text(state.commands, layout.margin, state.y, sectionTitle, { size: layout.sectionSize, bold: true });
  state.y -= 16;
  state.y = drawTableHeader(state.commands, state.y, columns);
  if (!rows.length) {
    state = drawEmptyRow(state, month, sectionTitle, columns, emptyText);
    return { ...state, y: state.y - 18 };
  }
  rows.forEach((row, index) => {
    const lines = rowCellLines(columns, row);
    const height = rowHeight(lines);
    state = ensureRowSpace(state, month, sectionTitle, columns, height);
    state.y = drawRow(state.commands, state.y, columns, lines, index % 2 === 1);
  });
  return { ...state, y: state.y - 18 };
}

function summaryPage(report) {
  const layout = BOD_SECRETARIAL_REPORT_PDF_LAYOUT;
  const commands = [];
  const title = displayText(report?.title || "Monthly Report RCPH RIY 26 - 27");
  const titleLines = wrapPdfText(title, CONTENT_WIDTH, layout.titleSize);
  titleLines.forEach((line, index) => text(commands, layout.margin, layout.top - index * 22, line, {
    size: layout.titleSize,
    bold: true,
  }));

  const boxTop = layout.top - 82;
  const rowHeightValue = 30;
  const boxHeight = SUMMARY_ROWS.length * rowHeightValue;
  commands.push(pdfFillRectCommand({
    x: layout.margin,
    y: boxTop - boxHeight,
    width: CONTENT_WIDTH,
    height: boxHeight,
    gray: 0.955,
  }));
  strokeRect(commands, layout.margin, boxTop, CONTENT_WIDTH, boxHeight, 0.4);

  SUMMARY_ROWS.forEach(([label, key], index) => {
    const rowTop = boxTop - index * rowHeightValue;
    if (index) commands.push(pdfLineCommand({ x1: layout.margin, y1: rowTop, x2: layout.margin + CONTENT_WIDTH, y2: rowTop, gray: 0.7 }));
    text(commands, layout.margin + 12, rowTop - 19, `${label}:`, { bold: true });
    text(commands, layout.margin + 210, rowTop - 19, stringValue(report?.[key]));
  });
  text(commands, layout.margin, boxTop - boxHeight - 34, `Period: ${displayText(report?.periodLabel)}`, { gray: 0.22 });
  return commands;
}

function addPageNumbers(pages) {
  const layout = BOD_SECRETARIAL_REPORT_PDF_LAYOUT;
  pages.forEach((page, index) => {
    text(page, A4_PDF_SIZE.width - layout.margin - 70, 28, `Page ${index + 1} of ${pages.length}`, { size: 8, gray: 0.35 });
  });
}

function validateReport(report) {
  if (!report || typeof report !== "object") throw new TypeError("A finalized Secretarial Report model is required.");
  if (!Array.isArray(report.months) || !report.months.length) throw new TypeError("At least one report month is required.");
}

export function buildBodSecretarialReportPdfPages(report) {
  validateReport(report);
  const pages = [summaryPage(report)];
  report.months.forEach((month) => {
    let state = monthPage(pages, month);
    state.pages = pages;
    state = drawTable(state, month, "1. Meetings", MEETING_COLUMNS, Array.isArray(month?.meetings) ? month.meetings : [], "No meetings recorded.");
    state = drawTable(state, month, "2. Events", EVENT_COLUMNS, Array.isArray(month?.events) ? month.events : [], "No events recorded.");
  });
  addPageNumbers(pages);
  return pages;
}

export function buildBodSecretarialReportPdfDocument(report) {
  return buildSimpleA4Pdf(buildBodSecretarialReportPdfPages(report));
}

function filePart(value) {
  return cleanText(value, 120).replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "Monthly";
}

export function getBodSecretarialReportFilename(report) {
  return `RCPH-Secretarial-Report-${filePart(report?.periodLabel)}.pdf`;
}

export async function downloadBodSecretarialReportPdf(report, options = {}) {
  const pdf = buildBodSecretarialReportPdfDocument(report);
  const documentRef = options.document || document;
  const urlApi = options.URL || URL;
  const setTimeoutRef = options.setTimeout || window.setTimeout;
  const url = urlApi.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
  const link = documentRef.createElement("a");
  link.href = url;
  link.download = getBodSecretarialReportFilename(report);
  link.click();
  setTimeoutRef(() => urlApi.revokeObjectURL(url), 1000);
}
