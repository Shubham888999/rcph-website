import { getBodAvenueReportFilename, normalizeBodReportAppearance } from "./bodAvenueReportModel.js";
import {
  A4_PDF_SIZE,
  normalizePdfText,
  pdfFillRectCommand,
  pdfLineCommand,
} from "../pdf/simplePdf.js";
import { RESOLUTION_OFFICIAL_LETTERHEAD_URL } from "../resolutions/resolutionLetterhead.js";

export const BOD_AVENUE_REPORT_LETTERHEAD_URL = RESOLUTION_OFFICIAL_LETTERHEAD_URL;

export const BOD_AVENUE_REPORT_LAYOUT = Object.freeze({
  page: A4_PDF_SIZE,
  // Safe boundaries are based on the official A4 letterhead: top branding/title above,
  // skyline and contact footer below. Report body content must stay inside this box.
  safeArea: Object.freeze({ left: 36, right: 559, top: 670, bottom: 205 }),
  topMeta: Object.freeze({ y: 735, fontSize: 10, gray: 0.2 }),
  generatedMeta: Object.freeze({ x: 20, y: 85, fontSize: 8.2, gray: 0.3 }),
  summary: Object.freeze({
    top: 670,
    labelSize: 7.4,
    valueSize: 8.1,
    lineHeight: 10.8,
    rowGap: 5,
    dividerGap: 8,
    dividerGray: 0.62,
    columns: Object.freeze([
      Object.freeze({ key: "period", label: "Month", width: 85 }),
      Object.freeze({ key: "director", label: "Director Name", width: 224 }),
      Object.freeze({ key: "avenues", label: "Avenue", width: 148 }),
      Object.freeze({ key: "events", label: "Total Events", width: 66 }),
    ]),
  }),
  group: Object.freeze({
    groupGapAfterTable: 9,
    headingSize: 9.2,
    headingLineHeight: 12,
    directorSize: 7.6,
    directorLineHeight: 9.5,
    headingToTableGap: 5,
  }),
  table: Object.freeze({
    headerHeight: 23,
    fontSize: 8,
    headerFontSize: 7.7,
    lineHeight: 10.1,
    padding: 4,
    headerGray: 0.9,
    alternateRowGray: 0.975,
    borderGray: 0.7,
    headerBorderGray: 0.55,
  }),
});

export const BOD_AVENUE_REPORT_CONTENT_WIDTH =
  BOD_AVENUE_REPORT_LAYOUT.safeArea.right - BOD_AVENUE_REPORT_LAYOUT.safeArea.left;

export const BOD_AVENUE_REPORT_TABLE_COLUMNS = Object.freeze([
  Object.freeze({ key: "date", label: "Date", width: 58 }),
  Object.freeze({ key: "event", label: "Event", width: 132 }),
  Object.freeze({ key: "role", label: "Role", width: 66 }),
  Object.freeze({ key: "details", label: "Host / Collaborators / Description", width: BOD_AVENUE_REPORT_CONTENT_WIDTH - 256 }),
]);

const BODY_SIZE_STYLES = Object.freeze({
  compact: Object.freeze({ fontSize: 7.5, headerFontSize: 7.3 }),
  default: Object.freeze({ fontSize: 8, headerFontSize: 7.7 }),
  comfortable: Object.freeze({ fontSize: 8.8, headerFontSize: 8.1 }),
  large: Object.freeze({ fontSize: 10, headerFontSize: 8.6 }),
});

const DENSITY_STYLES = Object.freeze({
  compact: Object.freeze({ padding: 3, lineHeightFactor: 1.16, headerHeight: 21 }),
  standard: Object.freeze({ padding: 4, lineHeight: 10.1, headerHeight: 23 }),
  comfortable: Object.freeze({ padding: 5, lineHeightFactor: 1.32, headerHeight: 26 }),
});

const USER_MESSAGE = "The BOD Avenue Report letterhead could not be loaded. Please try again.";
const PNG_SIGNATURE = Object.freeze([137, 80, 78, 71, 13, 10, 26, 10]);
const encoder = new TextEncoder();

function asBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return new Uint8Array();
}

function concatBytes(parts) {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  parts.forEach((part) => { output.set(part, offset); offset += part.length; });
  return output;
}

function ascii(value) {
  return encoder.encode(value);
}

function escapePdfText(value) {
  const bulletToken = "RCPH_PDF_BULLET_TOKEN";
  return normalizePdfText(String(value ?? "").replace(/\u2022|â€¢/g, bulletToken))
    .replace(/[\\()]/g, (character) => `\\${character}`)
    .replaceAll(bulletToken, "\\225");
}

function assertValidPngSignature(bytes) {
  if (bytes.length < 33 || PNG_SIGNATURE.some((byte, index) => bytes[index] !== byte)) {
    throw new Error("The BOD Avenue Report letterhead is not a valid PNG image.");
  }
}

export function parseBodAvenueReportLetterheadPng(value) {
  const bytes = asBytes(value);
  assertValidPngSignature(bytes);
  const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
  const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
  const bitDepth = bytes[24];
  const colorType = bytes[25];
  const compression = bytes[26];
  const filter = bytes[27];
  const interlace = bytes[28];
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) throw new Error("The BOD Avenue Report letterhead dimensions are invalid.");
  if (bitDepth !== 8 || colorType !== 2 || compression !== 0 || filter !== 0 || interlace !== 0) {
    throw new Error("The BOD Avenue Report letterhead PNG must be an 8-bit RGB, non-interlaced image.");
  }
  const idat = [];
  for (let offset = 8; offset < bytes.length;) {
    if (offset + 12 > bytes.length) throw new Error("The BOD Avenue Report letterhead PNG is incomplete.");
    const length = (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (length < 0 || dataEnd + 4 > bytes.length) throw new Error("The BOD Avenue Report letterhead PNG has an invalid chunk.");
    if (type === "IDAT") idat.push(bytes.subarray(dataStart, dataEnd));
    if (type === "IEND") break;
    offset = dataEnd + 4;
  }
  const imageBytes = concatBytes(idat);
  if (!imageBytes.length) throw new Error("The BOD Avenue Report letterhead PNG has no image data.");
  return { bytes: imageBytes, width, height, bitsPerComponent: 8, colorSpace: "DeviceRGB", colors: 3 };
}

export async function loadBodAvenueReportLetterheadPng(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const parser = options.parsePng || parseBodAvenueReportLetterheadPng;
  const logger = options.logger || console;
  const cache = options.cache || "no-store";
  try {
    if (typeof fetchImpl !== "function") throw new Error("Asset loading is unavailable.");
    const response = await fetchImpl(BOD_AVENUE_REPORT_LETTERHEAD_URL, { cache });
    if (!response?.ok) throw new Error(`Asset request failed with status ${response?.status || "unknown"}.`);
    return parser(await response.arrayBuffer());
  } catch (error) {
    logger?.error?.("BOD Avenue Report letterhead preparation failed.", {
      assetUrl: BOD_AVENUE_REPORT_LETTERHEAD_URL,
      errorName: typeof error?.name === "string" ? error.name : "Error",
    });
    throw new Error(USER_MESSAGE, { cause: error });
  }
}

export function getBodAvenueReportLetterheadPng(options = {}) {
  return loadBodAvenueReportLetterheadPng(options);
}

function fontFamilyName(value) {
  return value === "times" ? "times" : "helvetica";
}

function fontResource(fontFamily, bold = false) {
  if (fontFamily === "times") return bold ? "F4" : "F3";
  return bold ? "F2" : "F1";
}

function textFactor(fontFamily) {
  return fontFamily === "times" ? 0.48 : 0.52;
}

function approximateTextWidth(text, size, bold = false, fontFamily = "helvetica") {
  return normalizePdfText(text).length * size * textFactor(fontFamily) * (bold ? 1.04 : 1);
}

function textCommand({ x, y, text, size = 9, bold = false, gray = 0, fontFamily = "helvetica" }) {
  const shade = Math.max(0, Math.min(1, Number(gray) || 0));
  return `BT ${shade} g /${fontResource(fontFamily, bold)} ${size} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td (${escapePdfText(text)}) Tj ET`;
}

function rightAlignedTextCommand({ right, y, text, size, bold = false, gray = 0, fontFamily = "helvetica" }) {
  return textCommand({ x: right - approximateTextWidth(text, size, bold, fontFamily), y, text, size, bold, gray, fontFamily });
}

function wrapText(value, maxWidth, size, fontFamily = "helvetica", bold = false) {
  const averageCharacterWidth = size * textFactor(fontFamily) * (bold ? 1.04 : 1);
  const maxCharacters = Math.max(1, Math.floor(maxWidth / averageCharacterWidth));
  const lines = [];
  for (const paragraph of normalizePdfText(value).split("\n")) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(""); continue; }
    let current = "";
    for (const word of words) {
      if (word.length > maxCharacters) {
        if (current) { lines.push(current); current = ""; }
        for (let index = 0; index < word.length; index += maxCharacters) lines.push(word.slice(index, index + maxCharacters));
      } else if (!current) current = word;
      else if (`${current} ${word}`.length <= maxCharacters) current += ` ${word}`;
      else { lines.push(current); current = word; }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function resolveReportStyle(report) {
  const appearance = normalizeBodReportAppearance(report?.appearance);
  const body = BODY_SIZE_STYLES[appearance.bodySize];
  const density = DENSITY_STYLES[appearance.density];
  const fontFamily = fontFamilyName(appearance.fontFamily);
  const lineHeight = density.lineHeight || body.fontSize * density.lineHeightFactor;
  return {
    appearance,
    fontFamily,
    table: {
      ...BOD_AVENUE_REPORT_LAYOUT.table,
      fontSize: body.fontSize,
      headerFontSize: body.headerFontSize,
      padding: density.padding,
      lineHeight,
      headerHeight: density.headerHeight,
    },
  };
}

function formatReportDate(value) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

function formatReportTime(value) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

function formatGeneratedMetadata(value) {
  return `${formatReportDate(value)} at ${formatReportTime(value)} IST`;
}

function addTextLines(commands, lines, x, y, options = {}) {
  const size = options.size || 9;
  const lineHeight = options.lineHeight || size * 1.3;
  lines.forEach((line, index) => commands.push(textCommand({
    x,
    y: y - index * lineHeight,
    text: line,
    size,
    bold: options.bold,
    gray: options.gray,
    fontFamily: options.fontFamily,
  })));
  return y - Math.max(1, lines.length) * lineHeight;
}

function summaryFields(report) {
  const multiMonth = (report.selectedMonths || []).length > 1;
  const multiAvenue = (report.selectedAvenueCodes || []).length > 1;
  return {
    period: { label: multiMonth ? "Period" : "Month", value: report.periodLabel || report.monthLabel },
    director: { label: "Director Name", value: report.directorText },
    avenues: { label: multiAvenue ? "Avenues" : "Avenue", value: report.avenuesLabel || report.avenueLabel },
    events: { label: "Total Events", value: String(report.eventCount) },
  };
}

function summaryNeedsTwoRows(fields, style) {
  const layout = BOD_AVENUE_REPORT_LAYOUT.summary;
  return layout.columns.some((column) => {
    const valueWidth = column.width - 6;
    return approximateTextWidth(fields[column.key].value, layout.valueSize, false, style.fontFamily) > valueWidth;
  });
}

function drawSummaryField(commands, field, x, y, width, style) {
  const layout = BOD_AVENUE_REPORT_LAYOUT.summary;
  commands.push(textCommand({ x, y, text: field.label, size: layout.labelSize, bold: true, gray: 0.12, fontFamily: style.fontFamily }));
  const lines = wrapText(field.value, width, layout.valueSize, style.fontFamily);
  addTextLines(commands, lines, x, y - layout.lineHeight, {
    size: layout.valueSize,
    lineHeight: layout.lineHeight,
    gray: 0.08,
    fontFamily: style.fontFamily,
  });
  return lines.length;
}

function drawSummary(commands, report, style) {
  const layout = BOD_AVENUE_REPORT_LAYOUT.summary;
  const safe = BOD_AVENUE_REPORT_LAYOUT.safeArea;
  const fields = summaryFields(report);
  let y = layout.top;
  if (!summaryNeedsTwoRows(fields, style)) {
    let x = safe.left;
    let maxLines = 1;
    layout.columns.forEach((column) => {
      maxLines = Math.max(maxLines, drawSummaryField(commands, fields[column.key], x, y, column.width - 6, style));
      x += column.width;
    });
    y -= layout.lineHeight * (maxLines + 1);
  } else {
    const firstRow = layout.columns.filter((column) => column.key !== "director");
    const rowWidth = BOD_AVENUE_REPORT_CONTENT_WIDTH / firstRow.length;
    firstRow.forEach((column, index) => drawSummaryField(commands, fields[column.key], safe.left + rowWidth * index, y, rowWidth - 8, style));
    y -= layout.lineHeight * 2 + layout.rowGap;
    drawSummaryField(commands, fields.director, safe.left, y, BOD_AVENUE_REPORT_CONTENT_WIDTH - 6, style);
    const directorLines = wrapText(fields.director.value, BOD_AVENUE_REPORT_CONTENT_WIDTH - 6, layout.valueSize, style.fontFamily).length;
    y -= layout.lineHeight * (directorLines + 1);
  }
  const dividerY = y - layout.dividerGap;
  commands.push(pdfLineCommand({ x1: safe.left, y1: dividerY, x2: safe.right, y2: dividerY, width: 0.6, gray: layout.dividerGray }));
  return dividerY - layout.dividerGap;
}

function drawTableHeader(commands, top, style) {
  const safe = BOD_AVENUE_REPORT_LAYOUT.safeArea;
  const table = style.table;
  commands.push(pdfFillRectCommand({ x: safe.left, y: top - table.headerHeight, width: BOD_AVENUE_REPORT_CONTENT_WIDTH, height: table.headerHeight, gray: table.headerGray }));
  let x = safe.left;
  for (const column of BOD_AVENUE_REPORT_TABLE_COLUMNS) {
    commands.push(textCommand({ x: x + table.padding, y: top - 15, text: column.label, size: table.headerFontSize, bold: true, fontFamily: style.fontFamily }));
    commands.push(pdfLineCommand({ x1: x, y1: top, x2: x, y2: top - table.headerHeight, gray: table.headerBorderGray }));
    x += column.width;
  }
  commands.push(pdfLineCommand({ x1: x, y1: top, x2: x, y2: top - table.headerHeight, gray: table.headerBorderGray }));
  commands.push(pdfLineCommand({ x1: safe.left, y1: top, x2: safe.right, y2: top, gray: table.headerBorderGray }));
  commands.push(pdfLineCommand({ x1: safe.left, y1: top - table.headerHeight, x2: safe.right, y2: top - table.headerHeight, gray: table.headerBorderGray }));
  return top - table.headerHeight;
}

function eventCellLines(event, style) {
  const table = style.table;
  const details = `Host: ${event.hostClub}\nCollaborators: ${event.collaborators}\nDescription: ${event.description}`;
  return {
    date: wrapText(event.dateLabel, BOD_AVENUE_REPORT_TABLE_COLUMNS[0].width - table.padding * 2, table.fontSize, style.fontFamily),
    event: wrapText(event.name, BOD_AVENUE_REPORT_TABLE_COLUMNS[1].width - table.padding * 2, table.fontSize, style.fontFamily),
    role: wrapText(event.role, BOD_AVENUE_REPORT_TABLE_COLUMNS[2].width - table.padding * 2, table.fontSize, style.fontFamily),
    details: wrapText(details, BOD_AVENUE_REPORT_TABLE_COLUMNS[3].width - table.padding * 2, table.fontSize, style.fontFamily),
  };
}

function rowHeightForLines(lines, style) {
  const table = style.table;
  return Math.max(1, ...Object.values(lines).map((cellLines) => cellLines.length)) * table.lineHeight + table.padding * 2;
}

function drawRow(commands, lines, top, shade, style) {
  const safe = BOD_AVENUE_REPORT_LAYOUT.safeArea;
  const table = style.table;
  const rowHeight = rowHeightForLines(lines, style);
  if (shade) commands.push(pdfFillRectCommand({ x: safe.left, y: top - rowHeight, width: BOD_AVENUE_REPORT_CONTENT_WIDTH, height: rowHeight, gray: table.alternateRowGray }));
  let x = safe.left;
  BOD_AVENUE_REPORT_TABLE_COLUMNS.forEach((column) => {
    lines[column.key].forEach((line, index) => commands.push(textCommand({
      x: x + table.padding,
      y: top - table.padding - table.fontSize - index * table.lineHeight,
      text: line,
      size: table.fontSize,
      fontFamily: style.fontFamily,
    })));
    commands.push(pdfLineCommand({ x1: x, y1: top, x2: x, y2: top - rowHeight, gray: table.borderGray }));
    x += column.width;
  });
  commands.push(pdfLineCommand({ x1: x, y1: top, x2: x, y2: top - rowHeight, gray: table.borderGray }));
  commands.push(pdfLineCommand({ x1: safe.left, y1: top - rowHeight, x2: safe.right, y2: top - rowHeight, gray: table.borderGray }));
  return top - rowHeight;
}

function splitOversizedRow(lines, style) {
  const safe = BOD_AVENUE_REPORT_LAYOUT.safeArea;
  const table = style.table;
  const availableLines = Math.max(1, Math.floor((safe.top - table.headerHeight - safe.bottom - table.padding * 2) / table.lineHeight));
  const remaining = Object.fromEntries(Object.entries(lines).map(([key, value]) => [key, [...value]]));
  const chunks = [];
  let first = true;
  while (Object.values(remaining).some((cellLines) => cellLines.length)) {
    const chunk = {};
    for (const key of Object.keys(remaining)) chunk[key] = remaining[key].splice(0, availableLines);
    if (!first && !chunk.event.length) chunk.event = ["(continued)"];
    if (!first && !chunk.date.length) chunk.date = [""];
    if (!first && !chunk.role.length) chunk.role = [""];
    chunks.push(chunk);
    first = false;
  }
  return chunks;
}

function createTablePage(pages, style) {
  const commands = [];
  pages.push(commands);
  return { commands, y: drawTableHeader(commands, BOD_AVENUE_REPORT_LAYOUT.safeArea.top, style) };
}

function createBlankPage(pages) {
  const commands = [];
  pages.push(commands);
  return { commands, y: BOD_AVENUE_REPORT_LAYOUT.safeArea.top };
}

function drawEventRows(pages, events, startY, style) {
  const safe = BOD_AVENUE_REPORT_LAYOUT.safeArea;
  const table = style.table;
  let commands = pages.at(-1);
  let y = startY;
  const freshPageRowCapacity = safe.top - table.headerHeight - safe.bottom;
  events.forEach((event, eventIndex) => {
    const lines = eventCellLines(event, style);
    const rowHeight = rowHeightForLines(lines, style);
    if (rowHeight > freshPageRowCapacity) {
      // Exceptional fallback: a single event row can exceed one safe page after wrapping.
      // Only then do we split it into continuation chunks to avoid an infinite loop.
      for (const chunk of splitOversizedRow(lines, style)) {
        const chunkHeight = rowHeightForLines(chunk, style);
        if (y - chunkHeight < safe.bottom) ({ commands, y } = createTablePage(pages, style));
        y = drawRow(commands, chunk, y, eventIndex % 2 === 1, style);
      }
      return;
    }
    // Atomic row pagination: measure the complete event row before drawing it.
    if (y - rowHeight < safe.bottom) ({ commands, y } = createTablePage(pages, style));
    y = drawRow(commands, lines, y, eventIndex % 2 === 1, style);
  });
  return y;
}

function groupIntroModel(group, style) {
  const layout = BOD_AVENUE_REPORT_LAYOUT.group;
  const directorLines = wrapText(`Director: ${group.directorText}`, BOD_AVENUE_REPORT_CONTENT_WIDTH, layout.directorSize, style.fontFamily);
  return {
    heading: `${group.avenueLabel} - ${group.monthLabel}`,
    directorLines,
    height: layout.headingLineHeight + directorLines.length * layout.directorLineHeight + layout.headingToTableGap,
  };
}

function drawGroupIntro(commands, y, group, style) {
  const safe = BOD_AVENUE_REPORT_LAYOUT.safeArea;
  const layout = BOD_AVENUE_REPORT_LAYOUT.group;
  const intro = groupIntroModel(group, style);
  commands.push(textCommand({ x: safe.left, y, text: intro.heading, size: layout.headingSize, bold: true, gray: 0.08, fontFamily: style.fontFamily }));
  y -= layout.headingLineHeight;
  addTextLines(commands, intro.directorLines, safe.left, y, {
    size: layout.directorSize,
    lineHeight: layout.directorLineHeight,
    gray: 0.24,
    fontFamily: style.fontFamily,
  });
  return y - intro.directorLines.length * layout.directorLineHeight - layout.headingToTableGap;
}

function drawGroupedContent(pages, report, startY, style) {
  const safe = BOD_AVENUE_REPORT_LAYOUT.safeArea;
  let commands = pages.at(-1);
  let y = startY;
  let completedGroup = false;
  for (const group of report.groups || []) {
    const firstRow = group.events[0] ? eventCellLines(group.events[0], style) : null;
    const firstRowHeight = firstRow ? rowHeightForLines(firstRow, style) : style.table.lineHeight + style.table.padding * 2;
    const intro = groupIntroModel(group, style);
    const samePageGap = completedGroup ? BOD_AVENUE_REPORT_LAYOUT.group.groupGapAfterTable : 0;
    const required = samePageGap + intro.height + style.table.headerHeight + firstRowHeight;
    if (y - required < safe.bottom) {
      ({ commands, y } = createBlankPage(pages));
    } else {
      y -= samePageGap;
    }
    y = drawGroupIntro(commands, y, group, style);
    y = drawTableHeader(commands, y, style);
    y = drawEventRows(pages, group.events, y, style);
    commands = pages.at(-1);
    completedGroup = true;
  }
}

function addPageChrome(pages, report) {
  const safe = BOD_AVENUE_REPORT_LAYOUT.safeArea;
  const top = BOD_AVENUE_REPORT_LAYOUT.topMeta;
  const meta = BOD_AVENUE_REPORT_LAYOUT.generatedMeta;
  const generatedDate = formatReportDate(report.generatedAt);
  const metadataLine = `Generated by RCPH Website \u2022 ${formatGeneratedMetadata(report.generatedAt)}`;
  // Two-pass page numbering: body pagination completes first, then every page gets X of Y.
  pages.forEach((page, index) => {
    const pageNumber = `Page ${index + 1} of ${pages.length}`;
    page.unshift(
      textCommand({ x: safe.left, y: top.y, text: generatedDate, size: top.fontSize, gray: top.gray }),
      rightAlignedTextCommand({ right: safe.right, y: top.y, text: pageNumber, size: top.fontSize, gray: top.gray }),
    );
    page.push(textCommand({ x: meta.x, y: meta.y, text: metadataLine, size: meta.fontSize, gray: meta.gray }));
  });
}

export function buildBodAvenueReportPdfPages(report) {
  if (!report?.events?.length || report.eventCount !== report.events.length) throw new TypeError("A finalized non-empty report model is required.");
  const style = resolveReportStyle(report);
  const pages = [[]];
  const firstPage = pages[0];
  const tableTop = drawSummary(firstPage, report, style);
  if (report.isCombined) drawGroupedContent(pages, report, tableTop, style);
  else {
    const startY = drawTableHeader(firstPage, tableTop, style);
    drawEventRows(pages, report.events, startY, style);
  }
  addPageChrome(pages, report);
  return pages;
}

function validateLetterhead(letterhead) {
  if (!(letterhead?.bytes instanceof Uint8Array) || !letterhead.bytes.length || !Number.isInteger(letterhead.width) || !Number.isInteger(letterhead.height)) {
    throw new TypeError("A valid BOD Avenue Report letterhead PNG is required.");
  }
  if (letterhead.colorSpace !== "DeviceRGB" || letterhead.bitsPerComponent !== 8 || letterhead.colors !== 3) {
    throw new TypeError("A valid 8-bit RGB BOD Avenue Report letterhead PNG is required.");
  }
}

function imagePlacement(letterhead) {
  const page = BOD_AVENUE_REPORT_LAYOUT.page;
  const scale = Math.min(page.width / letterhead.width, page.height / letterhead.height);
  const width = letterhead.width * scale;
  const height = letterhead.height * scale;
  return { x: (page.width - width) / 2, y: (page.height - height) / 2, width, height };
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

export function buildBodAvenueReportPdfDocument(report, letterhead) {
  validateLetterhead(letterhead);
  const pages = buildBodAvenueReportPdfPages(report);
  const objects = [];
  const imageId = 7;
  const pageIds = pages.map((_, index) => 8 + index * 2);
  const placement = imagePlacement(letterhead);
  objects[1] = ascii("<< /Type /Catalog /Pages 2 0 R >>");
  objects[2] = ascii(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  objects[3] = ascii("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objects[4] = ascii("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  objects[5] = ascii("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>");
  objects[6] = ascii("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>");
  objects[imageId] = imageObject(letterhead);
  pages.forEach((page, index) => {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    const commands = [
      `q\n${placement.width.toFixed(2)} 0 0 ${placement.height.toFixed(2)} ${placement.x.toFixed(2)} ${placement.y.toFixed(2)} cm\n/BG Do\nQ`,
      ...page,
    ];
    const content = ascii(commands.join("\n"));
    objects[pageId] = ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_PDF_SIZE.width} ${A4_PDF_SIZE.height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R /F4 6 0 R >> /XObject << /BG ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects[contentId] = streamObject(content);
  });
  return assemblePdf(objects);
}

export async function downloadBodAvenueReportPdf(report, options = {}) {
  const loadLetterhead = options.loadLetterhead || getBodAvenueReportLetterheadPng;
  const letterhead = await loadLetterhead();
  const pdf = buildBodAvenueReportPdfDocument(report, letterhead);
  const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = getBodAvenueReportFilename(report);
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
