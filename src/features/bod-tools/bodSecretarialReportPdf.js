import {
  A4_PDF_SIZE,
  normalizePdfText,
  pdfFillRectCommand,
  pdfLineCommand,
  pdfTextCommand,
  wrapPdfText,
} from "../pdf/simplePdf.js";
import {
  BOD_AVENUE_REPORT_LAYOUT,
  BOD_AVENUE_REPORT_LETTERHEAD_URL,
  getBodAvenueReportLetterheadPng,
} from "./bodAvenueReportPdf.js";

export const BOD_SECRETARIAL_REPORT_LETTERHEAD_URL = BOD_AVENUE_REPORT_LETTERHEAD_URL;

const encoder = new TextEncoder();
const SAFE_AREA = BOD_AVENUE_REPORT_LAYOUT.safeArea;

export const BOD_SECRETARIAL_REPORT_PDF_LAYOUT = Object.freeze({
  page: A4_PDF_SIZE,
  safeArea: SAFE_AREA,
  margin: SAFE_AREA.left,
  top: SAFE_AREA.top,
  bottom: SAFE_AREA.bottom,
  titleSize: 16,
  headingSize: 13,
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
  Object.freeze({ key: "description", label: "Description", width: 321, maxLines: 10 }),
]);

const EVENT_COLUMNS = Object.freeze([
  Object.freeze({ key: "serial", label: "Sr. No.", width: 46, maxLines: 1 }),
  Object.freeze({ key: "avenueLabel", label: "Avenue", width: 82, maxLines: 2 }),
  Object.freeze({ key: "dateLabel", label: "Date", width: 62, maxLines: 1 }),
  Object.freeze({ key: "name", label: "Name", width: 124, maxLines: 4 }),
  Object.freeze({ key: "description", label: "Description", width: 209, maxLines: 10 }),
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

function approximateTextWidth(value, size, bold = false) {
  return normalizePdfText(value).length * size * 0.52 * (bold ? 1.04 : 1);
}

function rightText(commands, right, y, value, options = {}) {
  const size = options.size || BOD_SECRETARIAL_REPORT_PDF_LAYOUT.bodySize;
  text(commands, right - approximateTextWidth(value, size, options.bold), y, value, options);
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
  const safe = BOD_SECRETARIAL_REPORT_PDF_LAYOUT.safeArea;
  const topMeta = BOD_AVENUE_REPORT_LAYOUT.topMeta;
  pages.forEach((page, index) => {
    rightText(page, safe.right, topMeta.y, `Page ${index + 1} of ${pages.length}`, { size: topMeta.fontSize, gray: topMeta.gray });
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

function ascii(value) {
  return encoder.encode(value);
}

function concatBytes(parts) {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  parts.forEach((part) => { output.set(part, offset); offset += part.length; });
  return output;
}

function imagePlacement(letterhead) {
  const page = BOD_SECRETARIAL_REPORT_PDF_LAYOUT.page;
  const scale = Math.min(page.width / letterhead.width, page.height / letterhead.height);
  const width = letterhead.width * scale;
  const height = letterhead.height * scale;
  return { x: (page.width - width) / 2, y: (page.height - height) / 2, width, height };
}

function validateLetterhead(letterhead) {
  if (!(letterhead?.bytes instanceof Uint8Array) || !letterhead.bytes.length || !Number.isInteger(letterhead.width) || !Number.isInteger(letterhead.height)) {
    throw new TypeError("A valid Secretarial Report letterhead PNG is required.");
  }
  if (letterhead.colorSpace !== "DeviceRGB" || letterhead.bitsPerComponent !== 8 || letterhead.colors !== 3) {
    throw new TypeError("A valid 8-bit RGB Secretarial Report letterhead PNG is required.");
  }
}

function imageObject(letterhead) {
  return concatBytes([
    ascii(`<< /Type /XObject /Subtype /Image /Width ${letterhead.width} /Height ${letterhead.height} /ColorSpace /${letterhead.colorSpace} /BitsPerComponent ${letterhead.bitsPerComponent} /Filter /FlateDecode /DecodeParms << /Predictor 15 /Colors ${letterhead.colors} /BitsPerComponent ${letterhead.bitsPerComponent} /Columns ${letterhead.width} >> /Length ${letterhead.bytes.length} >>\nstream\n`),
    letterhead.bytes,
    ascii("\nendstream"),
  ]);
}

function streamObject(bytes) {
  return concatBytes([ascii(`<< /Length ${bytes.length} >>\nstream\n`), bytes, ascii("\nendstream")]);
}

function assemblePdf(objects) {
  const chunks = [ascii("%PDF-1.4\n%RCPH-BINARY\n")];
  const offsets = [0];
  let length = chunks[0].length;
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = length;
    const objectBytes = concatBytes([ascii(`${id} 0 obj\n`), objects[id], ascii("\nendobj\n")]);
    chunks.push(objectBytes);
    length += objectBytes.length;
  }
  const xrefOffset = length;
  let xref = `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  xref += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  chunks.push(ascii(xref));
  return concatBytes(chunks);
}

export function buildBodSecretarialReportPdfDocument(report, letterhead) {
  validateLetterhead(letterhead);
  const pages = buildBodSecretarialReportPdfPages(report);
  const imageId = 5;
  const pageIds = pages.map((_, index) => 6 + index * 2);
  const placement = imagePlacement(letterhead);
  const objects = [];
  objects[1] = ascii("<< /Type /Catalog /Pages 2 0 R >>");
  objects[2] = ascii(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  objects[3] = ascii("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objects[4] = ascii("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  objects[imageId] = imageObject(letterhead);
  pages.forEach((page, index) => {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    const commands = [
      `q\n${placement.width.toFixed(2)} 0 0 ${placement.height.toFixed(2)} ${placement.x.toFixed(2)} ${placement.y.toFixed(2)} cm\n/BG Do\nQ`,
      ...page,
    ];
    const content = ascii(commands.join("\n"));
    objects[pageId] = ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_PDF_SIZE.width} ${A4_PDF_SIZE.height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /BG ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects[contentId] = streamObject(content);
  });
  return assemblePdf(objects);
}

function filePart(value) {
  return cleanText(value, 120).replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "Monthly";
}

export function getBodSecretarialReportFilename(report) {
  return `RCPH-Secretarial-Report-${filePart(report?.periodLabel)}.pdf`;
}

export async function downloadBodSecretarialReportPdf(report, options = {}) {
  const loadLetterhead = options.loadLetterhead || getBodAvenueReportLetterheadPng;
  const pdf = buildBodSecretarialReportPdfDocument(report, await loadLetterhead());
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
