import { getBodAvenueReportFilename, normalizeBodReportAppearance } from "./bodAvenueReportModel.js";
import { groupBodFocusAreasForReport } from "./bodFocusAreas.js";
import {
  A4_PDF_SIZE,
  normalizePdfText,
  pdfFillRectCommand,
  pdfLineCommand,
} from "../pdf/simplePdf.js";
import {
  buildJpegImageXObject,
  fitJpegImageInBox,
  jpegImageDrawCommand,
  validatePreparedJpegImage,
} from "../pdf/pdfJpegImage.js";
import { RESOLUTION_OFFICIAL_LETTERHEAD_URL } from "../resolutions/resolutionLetterhead.js";
import {
  LETTERHEAD_EXCHANGE_EMPTY_MESSAGE,
  LETTERHEAD_EXCHANGE_SECTION_TITLE,
  buildLetterheadExchangeCellLines,
} from "./letterhead-exchanges/letterheadExchangeReportPdf.js";

export const BOD_AVENUE_REPORT_LETTERHEAD_URL = RESOLUTION_OFFICIAL_LETTERHEAD_URL;

export const BOD_AVENUE_REPORT_LAYOUT = Object.freeze({
  page: A4_PDF_SIZE,
  // Safe boundaries are based on the official A4 letterhead: top branding/title above,
  // skyline and contact footer below. Report body content must stay inside this box.
  safeArea: Object.freeze({ left: 36, right: 559, top: 670, bottom: 205 }),
  topMeta: Object.freeze({ y: 735, fontSize: 10, gray: 0.2 }),
  generatedMeta: Object.freeze({ x: 20, y: 85, fontSize: 8.2, gray: 0.3 }),
  title: Object.freeze({
    top: 670,
    minHeight: 38,
    padding: 8,
    fontSize: 16,
    lineHeight: 18,
    fillGray: 0.82,
    borderGray: 0,
  }),
  summary: Object.freeze({
    gapAfterTitle: 8,
    labelSize: 7.4,
    valueSize: 8.2,
    lineHeight: 10.8,
    padding: 6,
    gapAfter: 12,
    fillGray: 0.96,
    borderGray: 0.35,
    columns: Object.freeze([
      Object.freeze({ key: "date", label: "Date", width: 100 }),
      Object.freeze({ key: "director", label: "Director name", width: 323 }),
      Object.freeze({ key: "events", label: "Total events", width: 100 }),
    ]),
  }),
  group: Object.freeze({
    groupGapAfterTable: 9,
    headingSize: 9.4,
    headingLineHeight: 12.2,
    directorSize: 7.6,
    directorLineHeight: 9.5,
    headingToTableGap: 5,
    monthHeadingSize: 8.8,
    monthHeadingLineHeight: 11.4,
  }),
  total: Object.freeze({
    height: 21,
    labelSize: 8.3,
    amountSize: 8.3,
    padding: 6,
    fillGray: 0.93,
    borderGray: 0.55,
    gapAfter: 10,
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
  Object.freeze({ key: "event", label: "Event", width: 116 }),
  Object.freeze({ key: "description", label: "Description", width: 273 }),
  Object.freeze({ key: "expense", label: "Expense", width: 76 }),
]);

export const BOD_LETTERHEAD_EXCHANGE_TABLE_COLUMNS = Object.freeze([
  Object.freeze({ key: "date", label: "Date", width: 58 }),
  Object.freeze({ key: "club", label: "Club", width: 112 }),
  Object.freeze({ key: "rotaractor", label: "Rotaractor", width: 104 }),
  Object.freeze({ key: "positionRid", label: "Position / RID", width: 96 }),
  Object.freeze({ key: "representatives", label: "RCPH Member(s)", width: 153 }),
]);

const BOD_REPORT_PHOTO_BLOCK = Object.freeze({
  horizontalPadding: 8,
  verticalPadding: 8,
  maxHeight: 230,
});

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

function normalizedLine(value, max = 220) {
  return normalizePdfText(String(value ?? "")).trim().replace(/\s+/g, " ").slice(0, max);
}

function normalizedLines(value, max = 220) {
  const source = Array.isArray(value) ? value : String(value ?? "").split(/\n|,\s+/);
  return source.map((item) => normalizedLine(item, max)).filter(Boolean);
}

function uniqueLines(lines) {
  const seen = new Set();
  const output = [];
  for (const line of lines) {
    const key = line.toLowerCase();
    if (!line || seen.has(key)) continue;
    seen.add(key);
    output.push(line);
  }
  return output;
}

function letterheadRcphMemberText(value) {
  const source = Array.isArray(value) ? value : String(value ?? "").split(/\n|,\s*/);
  const names = source
    .map((item) => normalizedLine(item, 160).replace(/^Rtr\.\s*/i, ""))
    .filter((name) => name && name.toLowerCase() !== "not available")
    .map((name) => `Rtr. ${name}`);
  return uniqueLines(names).join(", ");
}

const BOD_LETTERHEAD_EXCHANGE_CELL_SPECS = Object.freeze({
  representatives: Object.freeze({ max: 360, format: letterheadRcphMemberText }),
});

function strokeRect(commands, x, y, width, height, gray = 0.45, lineWidth = 0.7) {
  commands.push(
    pdfLineCommand({ x1: x, y1: y, x2: x + width, y2: y, gray, width: lineWidth }),
    pdfLineCommand({ x1: x + width, y1: y, x2: x + width, y2: y - height, gray, width: lineWidth }),
    pdfLineCommand({ x1: x + width, y1: y - height, x2: x, y2: y - height, gray, width: lineWidth }),
    pdfLineCommand({ x1: x, y1: y - height, x2: x, y2: y, gray, width: lineWidth }),
  );
}

function centeredTextCommand({ center, y, text, size, bold = false, gray = 0, fontFamily }) {
  return textCommand({
    x: center - approximateTextWidth(text, size, bold, fontFamily) / 2,
    y,
    text,
    size,
    bold,
    gray,
    fontFamily,
  });
}

function selectedAvenueCodes(report) {
  if (Array.isArray(report?.selectedAvenueCodes)) return report.selectedAvenueCodes;
  return report?.avenueCode ? [report.avenueCode] : [];
}

function deriveReportTitle(report) {
  const explicit = normalizedLine(report?.title, 140);
  if (explicit) return explicit;
  const codes = selectedAvenueCodes(report);
  if (codes.length === 1) {
    const avenue = normalizedLine(report?.avenueLabel || report?.avenuesLabel || codes[0], 100);
    return `${avenue.replace(/\s+Report$/i, "")} Report`;
  }
  return "BOD Avenue Report";
}

function directorLinesForReport(report) {
  const direct = normalizedLines(report?.directorLines);
  if (direct.length) return direct;
  const multiAvenue = selectedAvenueCodes(report).length > 1;
  if (!multiAvenue && Array.isArray(report?.directors)) {
    const fromDirectors = report.directors
      .map((item) => {
        const name = normalizedLine(item?.name, 160);
        const title = normalizedLine(item?.positionTitle, 160);
        return name && title ? `${name} (${title})` : "";
      })
      .filter(Boolean);
    if (fromDirectors.length) return fromDirectors;
  }
  const fromGroups = uniqueLines((Array.isArray(report?.avenueGroups) ? report.avenueGroups : [])
    .flatMap((group) => normalizedLines(group?.directorLines || group?.directorText)));
  if (fromGroups.length) return fromGroups;
  return normalizedLines(report?.directorText || "Not available");
}

function summaryFields(report) {
  return {
    date: { label: "Date", valueLines: [normalizedLine(report?.periodLabel || report?.monthLabel || report?.month || "Not available")] },
    director: { label: "Director name", valueLines: directorLinesForReport(report) },
    events: { label: "Total events", valueLines: [String(Number(report?.eventCount) || 0)] },
  };
}

function drawTitleBox(commands, report, style) {
  const layout = BOD_AVENUE_REPORT_LAYOUT.title;
  const safe = BOD_AVENUE_REPORT_LAYOUT.safeArea;
  const titleLines = wrapText(deriveReportTitle(report), BOD_AVENUE_REPORT_CONTENT_WIDTH - layout.padding * 2, layout.fontSize, style.fontFamily, true);
  const height = Math.max(layout.minHeight, layout.padding * 2 + titleLines.length * layout.lineHeight);
  commands.push(pdfFillRectCommand({ x: safe.left, y: layout.top - height, width: BOD_AVENUE_REPORT_CONTENT_WIDTH, height, gray: layout.fillGray }));
  strokeRect(commands, safe.left, layout.top, BOD_AVENUE_REPORT_CONTENT_WIDTH, height, layout.borderGray, 0.8);
  const firstBaseline = layout.top - layout.padding - layout.fontSize;
  titleLines.forEach((line, index) => commands.push(centeredTextCommand({
    center: safe.left + BOD_AVENUE_REPORT_CONTENT_WIDTH / 2,
    y: firstBaseline - index * layout.lineHeight,
    text: line,
    size: layout.fontSize,
    bold: true,
    fontFamily: style.fontFamily,
  })));
  return layout.top - height - BOD_AVENUE_REPORT_LAYOUT.summary.gapAfterTitle;
}

function summaryValueLines(field, width, style) {
  const layout = BOD_AVENUE_REPORT_LAYOUT.summary;
  const lines = [];
  field.valueLines.forEach((line) => lines.push(...wrapText(line, width, layout.valueSize, style.fontFamily)));
  return lines.length ? lines : ["Not available"];
}

function drawSummaryRow(commands, top, report, style) {
  const layout = BOD_AVENUE_REPORT_LAYOUT.summary;
  const safe = BOD_AVENUE_REPORT_LAYOUT.safeArea;
  const fields = summaryFields(report);
  const columns = layout.columns.map((column) => ({
    ...column,
    field: fields[column.key],
    valueLines: summaryValueLines(fields[column.key], column.width - layout.padding * 2, style),
  }));
  const maxValueLines = Math.max(1, ...columns.map((column) => column.valueLines.length));
  const height = layout.padding * 2 + layout.labelSize + 2 + maxValueLines * layout.lineHeight;
  commands.push(pdfFillRectCommand({ x: safe.left, y: top - height, width: BOD_AVENUE_REPORT_CONTENT_WIDTH, height, gray: layout.fillGray }));
  strokeRect(commands, safe.left, top, BOD_AVENUE_REPORT_CONTENT_WIDTH, height, layout.borderGray, 0.65);

  let x = safe.left;
  columns.forEach((column, index) => {
    if (index) commands.push(pdfLineCommand({ x1: x, y1: top, x2: x, y2: top - height, gray: layout.borderGray, width: 0.55 }));
    const labelY = top - layout.padding - layout.labelSize;
    commands.push(textCommand({ x: x + layout.padding, y: labelY, text: column.field.label, size: layout.labelSize, bold: true, gray: 0.08, fontFamily: style.fontFamily }));
    addTextLines(commands, column.valueLines, x + layout.padding, labelY - layout.lineHeight, {
      size: layout.valueSize,
      lineHeight: layout.lineHeight,
      gray: 0.04,
      fontFamily: style.fontFamily,
    });
    x += column.width;
  });
  return top - height - layout.gapAfter;
}

function drawReportHeader(commands, report, style) {
  return drawSummaryRow(commands, drawTitleBox(commands, report, style), report, style);
}

function drawTableHeader(commands, top, style, columns = BOD_AVENUE_REPORT_TABLE_COLUMNS) {
  const safe = BOD_AVENUE_REPORT_LAYOUT.safeArea;
  const table = style.table;
  commands.push(pdfFillRectCommand({ x: safe.left, y: top - table.headerHeight, width: BOD_AVENUE_REPORT_CONTENT_WIDTH, height: table.headerHeight, gray: table.headerGray }));
  let x = safe.left;
  for (const column of columns) {
    commands.push(textCommand({ x: x + table.padding, y: top - 15, text: column.label, size: table.headerFontSize, bold: true, fontFamily: style.fontFamily }));
    commands.push(pdfLineCommand({ x1: x, y1: top, x2: x, y2: top - table.headerHeight, gray: table.headerBorderGray }));
    x += column.width;
  }
  commands.push(pdfLineCommand({ x1: x, y1: top, x2: x, y2: top - table.headerHeight, gray: table.headerBorderGray }));
  commands.push(pdfLineCommand({ x1: safe.left, y1: top, x2: safe.right, y2: top, gray: table.headerBorderGray }));
  commands.push(pdfLineCommand({ x1: safe.left, y1: top - table.headerHeight, x2: safe.right, y2: top - table.headerHeight, gray: table.headerBorderGray }));
  return top - table.headerHeight;
}

function formatExpenseAmount(value) {
  const amount = Math.max(0, Math.round((Number(value) || 0) * 100) / 100);
  const hasPaise = !Number.isInteger(amount);
  return `Rs. ${new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount)}`;
}

function richLine(segments) {
  return { segments: segments.filter((segment) => segment.text) };
}

function isRichLine(line) {
  return Boolean(line && typeof line === "object" && Array.isArray(line.segments));
}

function wrapLabeledValue(label, value, maxWidth, size, fontFamily, max = 2500) {
  const labelText = normalizedLine(label, 40);
  const valueText = normalizedLine(value || "Not available", max) || "Not available";
  const gap = " ";
  const labelWidth = approximateTextWidth(labelText + gap, size, true, fontFamily);
  const firstLineWidth = maxWidth - labelWidth;
  if (firstLineWidth <= size * 5) {
    return [
      richLine([{ text: labelText, bold: true }]),
      ...wrapText(valueText, maxWidth, size, fontFamily).map((line) => richLine([{ text: line, bold: false }])),
    ];
  }
  const valueLines = wrapText(valueText, firstLineWidth, size, fontFamily);
  return [
    richLine([
      { text: labelText, bold: true },
      { text: gap, bold: false },
      { text: valueLines[0] || "", bold: false },
    ]),
    ...valueLines.slice(1).map((line) => richLine([{ text: line, bold: false }])),
  ];
}

function eventDescriptionBlockLines(event, maxWidth, size, fontFamily) {
  const description =
    normalizedLine(event?.description || "Not available", 2500)
    || "Not available";

  return [
    ...wrapText(description, maxWidth, size, fontFamily),
    ...wrapLabeledValue(
      "Host:",
      normalizedLine(event?.hostClub, 180) || "Not available",
      maxWidth,
      size,
      fontFamily,
      180,
    ),
    ...wrapLabeledValue(
      "Collaborators:",
      normalizedLine(event?.collaborators, 240) || "None",
      maxWidth,
      size,
      fontFamily,
      240,
    ),
  ];
}

function eventNameBlockLines(event, maxWidth, size, fontFamily) {
  const lines = wrapText(
    event?.name || "Untitled event",
    maxWidth,
    size,
    fontFamily,
  );

  const grouped = groupBodFocusAreasForReport(event?.focusAreas);

  if (!grouped.focusAreasText && !grouped.chaptersText) {
    return lines;
  }

  // Two blank lines between the event name and reporting classification.
  lines.push("", "");

  if (grouped.focusAreasText) {
    lines.push(
      ...wrapLabeledValue(
        "Focus Area:",
        grouped.focusAreasText,
        maxWidth,
        size,
        fontFamily,
        1000,
      ),
    );
  }

  if (grouped.chaptersText) {
    lines.push(
      ...wrapLabeledValue(
        "Chapter:",
        grouped.chaptersText,
        maxWidth,
        size,
        fontFamily,
        1000,
      ),
    );
  }

  return lines;
}

function eventCellLines(event, style) {
  const table = style.table;
  return {
    date: wrapText(event.dateLabel, BOD_AVENUE_REPORT_TABLE_COLUMNS[0].width - table.padding * 2, table.fontSize, style.fontFamily),
event: eventNameBlockLines(
  event,
  BOD_AVENUE_REPORT_TABLE_COLUMNS[1].width - table.padding * 2,
  table.fontSize,
  style.fontFamily,
),
    description: eventDescriptionBlockLines(event, BOD_AVENUE_REPORT_TABLE_COLUMNS[2].width - table.padding * 2, table.fontSize, style.fontFamily),
    expense: wrapText(formatExpenseAmount(event?.expenseTotal), BOD_AVENUE_REPORT_TABLE_COLUMNS[3].width - table.padding * 2, table.fontSize, style.fontFamily),
  };
}

function letterheadCellLines(row, style) {
  const table = style.table;
  return buildLetterheadExchangeCellLines(row, {
    columns: BOD_LETTERHEAD_EXCHANGE_TABLE_COLUMNS,
    cellSpecs: BOD_LETTERHEAD_EXCHANGE_CELL_SPECS,
    padding: table.padding,
    wrapText: (value, width) => wrapText(value, width, table.fontSize, style.fontFamily),
  });
}

function rowHeightForLines(lines, style) {
  const table = style.table;
  return Math.max(1, ...Object.values(lines).map((cellLines) => cellLines.length)) * table.lineHeight + table.padding * 2;
}

function normalizedReportImages(imagesByEventId) {
  const source = imagesByEventId instanceof Map
    ? imagesByEventId.entries()
    : Object.entries(imagesByEventId || {});
  const output = new Map();
  let index = 1;
  for (const [key, image] of source) {
    try {
      const validated = validatePreparedJpegImage(image);
      if (validated.eventId !== key || output.has(validated.eventId)) continue;
      output.set(validated.eventId, {
        eventId: validated.eventId,
        resourceName: `Im${index}`,
        image,
      });
      index += 1;
    } catch {
      // Invalid prepared images are ignored so PDFs can still render without them.
    }
  }
  return output;
}

function photoResourceForEvent(context, event) {
  return context?.imageResources?.get?.(event?.eventId);
}

function photoDisplayBox(image, contentWidth) {
  const photo = BOD_REPORT_PHOTO_BLOCK;
  return fitJpegImageInBox(image, {
    x: 0,
    y: 0,
    width: contentWidth - photo.horizontalPadding * 2,
    height: photo.maxHeight,
  });
}

function photoBlockHeight(image, contentWidth) {
  const display = photoDisplayBox(image, contentWidth);
  return display.height + BOD_REPORT_PHOTO_BLOCK.verticalPadding * 2;
}

function recordPageImageUse(context, pages, eventId) {
  if (!context || !eventId) return;
  const index = pages.length - 1;
  if (!context.pageImageEventIds[index]) context.pageImageEventIds[index] = new Set();
  context.pageImageEventIds[index].add(eventId);
}

function drawPhotoBlock(commands, top, style, resource, pages, context) {
  const safe = BOD_AVENUE_REPORT_LAYOUT.safeArea;
  const table = style.table;
  const photo = BOD_REPORT_PHOTO_BLOCK;
  const display = photoDisplayBox(resource.image, BOD_AVENUE_REPORT_CONTENT_WIDTH);
  const blockHeight = display.height + photo.verticalPadding * 2;
  const blockBottom = top - blockHeight;
  const imageBox = {
    x: safe.left + photo.horizontalPadding,
    y: blockBottom + photo.verticalPadding,
    width: BOD_AVENUE_REPORT_CONTENT_WIDTH - photo.horizontalPadding * 2,
    height: display.height,
  };
  const placement = fitJpegImageInBox(resource.image, imageBox);
  commands.push(pdfFillRectCommand({ x: safe.left, y: blockBottom, width: BOD_AVENUE_REPORT_CONTENT_WIDTH, height: blockHeight, gray: 1 }));
  commands.push(jpegImageDrawCommand(resource.resourceName, placement));
  commands.push(pdfLineCommand({ x1: safe.left, y1: top, x2: safe.left, y2: blockBottom, gray: table.borderGray }));
  commands.push(pdfLineCommand({ x1: safe.right, y1: top, x2: safe.right, y2: blockBottom, gray: table.borderGray }));
  commands.push(pdfLineCommand({ x1: safe.left, y1: blockBottom, x2: safe.right, y2: blockBottom, gray: table.borderGray }));
  recordPageImageUse(context, pages, resource.eventId);
  return blockBottom;
}

function drawRow(commands, lines, top, shade, style, columns = BOD_AVENUE_REPORT_TABLE_COLUMNS) {
  const safe = BOD_AVENUE_REPORT_LAYOUT.safeArea;
  const table = style.table;
  const rowHeight = rowHeightForLines(lines, style);
  if (shade) commands.push(pdfFillRectCommand({ x: safe.left, y: top - rowHeight, width: BOD_AVENUE_REPORT_CONTENT_WIDTH, height: rowHeight, gray: table.alternateRowGray }));
  let x = safe.left;
  columns.forEach((column) => {
    lines[column.key].forEach((line, index) => {
      const y = top - table.padding - table.fontSize - index * table.lineHeight;
      if (!isRichLine(line)) {
        commands.push(textCommand({
          x: x + table.padding,
          y,
          text: line,
          size: table.fontSize,
          fontFamily: style.fontFamily,
        }));
        return;
      }
      let segmentX = x + table.padding;
      line.segments.forEach((segment) => {
        commands.push(textCommand({
          x: segmentX,
          y,
          text: segment.text,
          size: table.fontSize,
          bold: segment.bold,
          fontFamily: style.fontFamily,
        }));
        segmentX += approximateTextWidth(segment.text, table.fontSize, segment.bold, style.fontFamily);
      });
    });
    commands.push(pdfLineCommand({ x1: x, y1: top, x2: x, y2: top - rowHeight, gray: table.borderGray }));
    x += column.width;
  });
  commands.push(pdfLineCommand({ x1: x, y1: top, x2: x, y2: top - rowHeight, gray: table.borderGray }));
  commands.push(pdfLineCommand({ x1: safe.left, y1: top - rowHeight, x2: safe.right, y2: top - rowHeight, gray: table.borderGray }));
  return top - rowHeight;
}

function splitOversizedRow(lines, style, columns = BOD_AVENUE_REPORT_TABLE_COLUMNS) {
  const safe = BOD_AVENUE_REPORT_LAYOUT.safeArea;
  const table = style.table;
  const keys = columns.map(column => column.key);
  const continuationKey = keys.includes("event") ? "event" : (keys.includes("rotaractor") ? "rotaractor" : keys[0]);
  const availableLines = Math.max(1, Math.floor((safe.top - table.headerHeight - safe.bottom - table.padding * 2) / table.lineHeight));
  const remaining = Object.fromEntries(Object.entries(lines).map(([key, value]) => [key, [...value]]));
  const chunks = [];
  let first = true;
  while (Object.values(remaining).some((cellLines) => cellLines.length)) {
    const chunk = {};
    for (const key of keys) {
      chunk[key] = (remaining[key] || []).splice(0, availableLines);
      if (!chunk[key].length) chunk[key] = !first && key === continuationKey ? ["(continued)"] : [""];
    }
    chunks.push(chunk);
    first = false;
  }
  return chunks;
}

function createTablePage(pages, style, columns = BOD_AVENUE_REPORT_TABLE_COLUMNS) {
  const commands = [];
  pages.push(commands);
  return { commands, y: drawTableHeader(commands, BOD_AVENUE_REPORT_LAYOUT.safeArea.top, style, columns) };
}

function createBlankPage(pages) {
  const commands = [];
  pages.push(commands);
  return { commands, y: BOD_AVENUE_REPORT_LAYOUT.safeArea.top };
}

function drawEventRows(pages, events, startY, style, context) {
  const safe = BOD_AVENUE_REPORT_LAYOUT.safeArea;
  const table = style.table;
  let commands = pages.at(-1);
  let y = startY;
  const freshPageRowCapacity = safe.top - table.headerHeight - safe.bottom;
  events.forEach((event, eventIndex) => {
    const lines = eventCellLines(event, style);
    const rowHeight = rowHeightForLines(lines, style);
    const photoResource = photoResourceForEvent(context, event);
    const imageHeight = photoResource ? photoBlockHeight(photoResource.image, BOD_AVENUE_REPORT_CONTENT_WIDTH) : 0;
    const combinedHeight = rowHeight + imageHeight;
    if (photoResource && combinedHeight <= freshPageRowCapacity) {
      if (y - combinedHeight < safe.bottom) ({ commands, y } = createTablePage(pages, style));
      y = drawRow(commands, lines, y, eventIndex % 2 === 1, style);
      y = drawPhotoBlock(commands, y, style, photoResource, pages, context);
      return;
    }
    if (rowHeight > freshPageRowCapacity) {
      // Exceptional fallback: a single event row can exceed one safe page after wrapping.
      // Only then do we split it into continuation chunks to avoid an infinite loop.
      for (const chunk of splitOversizedRow(lines, style)) {
        const chunkHeight = rowHeightForLines(chunk, style);
        if (y - chunkHeight < safe.bottom) ({ commands, y } = createTablePage(pages, style));
        y = drawRow(commands, chunk, y, eventIndex % 2 === 1, style);
      }
      if (photoResource) {
        if (y - imageHeight < safe.bottom) ({ commands, y } = createTablePage(pages, style));
        y = drawPhotoBlock(commands, y, style, photoResource, pages, context);
      }
      return;
    }
    // Atomic row pagination: measure the complete event row before drawing it.
    if (y - rowHeight < safe.bottom) ({ commands, y } = createTablePage(pages, style));
    y = drawRow(commands, lines, y, eventIndex % 2 === 1, style);
    if (photoResource) {
      if (y - imageHeight < safe.bottom) ({ commands, y } = createTablePage(pages, style));
      y = drawPhotoBlock(commands, y, style, photoResource, pages, context);
    }
  });
  return y;
}

function drawLetterheadRows(pages, rows, startY, style) {
  const safe = BOD_AVENUE_REPORT_LAYOUT.safeArea;
  const table = style.table;
  let commands = pages.at(-1);
  let y = startY;
  const freshPageRowCapacity = safe.top - table.headerHeight - safe.bottom;
  rows.forEach((row, rowIndex) => {
    const lines = letterheadCellLines(row, style);
    const rowHeight = rowHeightForLines(lines, style);
    if (rowHeight > freshPageRowCapacity) {
      for (const chunk of splitOversizedRow(lines, style, BOD_LETTERHEAD_EXCHANGE_TABLE_COLUMNS)) {
        const chunkHeight = rowHeightForLines(chunk, style);
        if (y - chunkHeight < safe.bottom) ({ commands, y } = createTablePage(pages, style, BOD_LETTERHEAD_EXCHANGE_TABLE_COLUMNS));
        y = drawRow(commands, chunk, y, rowIndex % 2 === 1, style, BOD_LETTERHEAD_EXCHANGE_TABLE_COLUMNS);
      }
      return;
    }
    if (y - rowHeight < safe.bottom) ({ commands, y } = createTablePage(pages, style, BOD_LETTERHEAD_EXCHANGE_TABLE_COLUMNS));
    y = drawRow(commands, lines, y, rowIndex % 2 === 1, style, BOD_LETTERHEAD_EXCHANGE_TABLE_COLUMNS);
  });
  return y;
}

function moneyNumber(value) {
  return Math.max(0, Math.round((Number(value) || 0) * 100) / 100);
}

function sumExpense(events) {
  return moneyNumber((Array.isArray(events) ? events : []).reduce((total, event) => total + moneyNumber(event?.expenseTotal), 0));
}

function normalizedMonth(month) {
  const events = Array.isArray(month?.events) ? month.events : [];
  return {
    month: normalizedLine(month?.month, 20),
    monthLabel: normalizedLine(month?.monthLabel || month?.month || "Selected month", 80),
    monthExpenseTotal: Number.isFinite(Number(month?.monthExpenseTotal)) ? moneyNumber(month.monthExpenseTotal) : sumExpense(events),
    events,
  };
}

function reportSections(report) {
  const nested = (Array.isArray(report?.avenueGroups) ? report.avenueGroups : [])
    .map((group) => ({
      avenueCode: normalizedLine(group?.avenueCode, 20),
      avenueLabel: normalizedLine(group?.avenueLabel || group?.avenueCode || "Selected avenue", 120),
      sectionType: normalizedLine(group?.sectionType, 40),
      directorLines: normalizedLines(group?.directorLines || group?.directorText || "Not available"),
      months: (Array.isArray(group?.months) ? group.months : []).map(normalizedMonth).filter((month) => month.events.length),
    }))
    .filter((group) => group.months.length);
  if (nested.length) return nested;

  const flatGroups = Array.isArray(report?.groups) ? report.groups : [];
  if (flatGroups.length) {
    const map = new Map();
    flatGroups.forEach((group) => {
      const key = normalizedLine(group?.avenueCode || group?.avenueLabel || "Selected avenue", 120);
      if (!map.has(key)) {
        map.set(key, {
          avenueCode: normalizedLine(group?.avenueCode, 20),
          avenueLabel: normalizedLine(group?.avenueLabel || group?.avenueCode || "Selected avenue", 120),
          sectionType: normalizedLine(group?.sectionType, 40),
          directorLines: normalizedLines(group?.directorLines || group?.directorText || "Not available"),
          months: [],
        });
      }
      const month = normalizedMonth(group);
      if (month.events.length) map.get(key).months.push(month);
    });
    return [...map.values()].filter((group) => group.months.length);
  }

  const events = Array.isArray(report?.events) ? report.events : [];
  const monthMap = new Map();
  events.forEach((event) => {
    const key = normalizedLine(event?.month || String(event?.date || "").slice(0, 7) || report?.month || "Selected month", 20);
    if (!monthMap.has(key)) {
      monthMap.set(key, {
        month: key,
        monthLabel: normalizedLine(event?.monthLabel || report?.monthLabel || key, 80),
        events: [],
      });
    }
    monthMap.get(key).events.push(event);
  });
  return [{
    avenueCode: normalizedLine(report?.avenueCode, 20),
    avenueLabel: normalizedLine(report?.avenueLabel || report?.avenuesLabel || "Selected avenue", 120),
    sectionType: "",
    directorLines: directorLinesForReport(report),
    months: [...monthMap.values()].map(normalizedMonth).filter((month) => month.events.length),
  }].filter((group) => group.months.length);
}

function sectionHeadingModel(group, style) {
  const layout = BOD_AVENUE_REPORT_LAYOUT.group;
  const headingLines = wrapText(group.avenueLabel, BOD_AVENUE_REPORT_CONTENT_WIDTH, layout.headingSize, style.fontFamily, true);
  const rawDirectorLines = group.directorLines.length ? group.directorLines : ["Not available"];
  const directorLines = rawDirectorLines.flatMap((line, index) => wrapText(index ? line : `Director name: ${line}`, BOD_AVENUE_REPORT_CONTENT_WIDTH, layout.directorSize, style.fontFamily));
  return {
    headingLines,
    directorLines,
    height: headingLines.length * layout.headingLineHeight + directorLines.length * layout.directorLineHeight + layout.headingToTableGap,
  };
}

function drawSectionHeading(commands, y, group, style) {
  const safe = BOD_AVENUE_REPORT_LAYOUT.safeArea;
  const layout = BOD_AVENUE_REPORT_LAYOUT.group;
  const intro = sectionHeadingModel(group, style);
  addTextLines(commands, intro.headingLines, safe.left, y, {
    size: layout.headingSize,
    lineHeight: layout.headingLineHeight,
    bold: true,
    gray: 0.06,
    fontFamily: style.fontFamily,
  });
  y -= intro.headingLines.length * layout.headingLineHeight;
  addTextLines(commands, intro.directorLines, safe.left, y, {
    size: layout.directorSize,
    lineHeight: layout.directorLineHeight,
    gray: 0.24,
    fontFamily: style.fontFamily,
  });
  return y - intro.directorLines.length * layout.directorLineHeight - layout.headingToTableGap;
}

function monthHeadingHeight(show) {
  return show ? BOD_AVENUE_REPORT_LAYOUT.group.monthHeadingLineHeight : 0;
}

function drawMonthHeading(commands, y, month, style, section = {}) {
  const safe = BOD_AVENUE_REPORT_LAYOUT.safeArea;
  const layout = BOD_AVENUE_REPORT_LAYOUT.group;
  const text = section.sectionType === "bodMeetings" ? `${section.avenueLabel || "BOD Meetings"} - ${month.monthLabel}` : month.monthLabel;
  commands.push(textCommand({ x: safe.left, y, text, size: layout.monthHeadingSize, bold: true, gray: 0.08, fontFamily: style.fontFamily }));
  return y - layout.monthHeadingLineHeight;
}

function ensureSpace(pages, commands, y, required) {
  const safe = BOD_AVENUE_REPORT_LAYOUT.safeArea;
  if (y - required >= safe.bottom) return { commands, y };
  return createBlankPage(pages);
}

function drawTotalBlock(commands, y, label, amount, style) {
  const safe = BOD_AVENUE_REPORT_LAYOUT.safeArea;
  const layout = BOD_AVENUE_REPORT_LAYOUT.total;
  commands.push(pdfFillRectCommand({ x: safe.left, y: y - layout.height, width: BOD_AVENUE_REPORT_CONTENT_WIDTH, height: layout.height, gray: layout.fillGray }));
  strokeRect(commands, safe.left, y, BOD_AVENUE_REPORT_CONTENT_WIDTH, layout.height, layout.borderGray, 0.55);
  const textY = y - layout.padding - layout.labelSize;
  commands.push(textCommand({ x: safe.left + layout.padding, y: textY, text: label, size: layout.labelSize, bold: true, gray: 0.08, fontFamily: style.fontFamily }));
  commands.push(rightAlignedTextCommand({ right: safe.right - layout.padding, y: textY, text: formatExpenseAmount(amount), size: layout.amountSize, bold: true, gray: 0.04, fontFamily: style.fontFamily }));
  return y - layout.height - layout.gapAfter;
}

function drawMonthTotal(pages, commands, y, month, style) {
  const layout = BOD_AVENUE_REPORT_LAYOUT.total;
  ({ commands, y } = ensureSpace(pages, commands, y, layout.height));
  return {
    commands,
    y: drawTotalBlock(commands, y, `Total expense for ${month.monthLabel}`, month.monthExpenseTotal, style),
  };
}

function drawGrandTotal(pages, commands, y, report, style) {
  const layout = BOD_AVENUE_REPORT_LAYOUT.total;
  ({ commands, y } = ensureSpace(pages, commands, y, layout.height));
  return {
    commands,
    y: drawTotalBlock(commands, y, "Grand total expense", moneyNumber(report?.grandExpenseTotal), style),
  };
}

function letterheadRowsForReport(report) {
  return report?.includeLetterheadExchanges === true && Array.isArray(report?.letterheadExchangeRows)
    ? report.letterheadExchangeRows
    : [];
}

function letterheadHeadingModel(style) {
  const layout = BOD_AVENUE_REPORT_LAYOUT.group;
  const headingLines = wrapText(LETTERHEAD_EXCHANGE_SECTION_TITLE, BOD_AVENUE_REPORT_CONTENT_WIDTH, layout.headingSize, style.fontFamily, true);
  return {
    headingLines,
    height: headingLines.length * layout.headingLineHeight + layout.headingToTableGap,
  };
}

function drawLetterheadHeading(commands, y, style) {
  const safe = BOD_AVENUE_REPORT_LAYOUT.safeArea;
  const layout = BOD_AVENUE_REPORT_LAYOUT.group;
  const heading = letterheadHeadingModel(style);
  addTextLines(commands, heading.headingLines, safe.left, y, {
    size: layout.headingSize,
    lineHeight: layout.headingLineHeight,
    bold: true,
    gray: 0.06,
    fontFamily: style.fontFamily,
  });
  return y - heading.headingLines.length * layout.headingLineHeight - layout.headingToTableGap;
}

function drawNoLetterheadMessage(commands, y, style) {
  const safe = BOD_AVENUE_REPORT_LAYOUT.safeArea;
  const table = style.table;
  const lines = wrapText(LETTERHEAD_EXCHANGE_EMPTY_MESSAGE, BOD_AVENUE_REPORT_CONTENT_WIDTH - table.padding * 2, table.fontSize, style.fontFamily);
  const height = lines.length * table.lineHeight + table.padding * 2;
  commands.push(pdfFillRectCommand({ x: safe.left, y: y - height, width: BOD_AVENUE_REPORT_CONTENT_WIDTH, height, gray: table.alternateRowGray }));
  strokeRect(commands, safe.left, y, BOD_AVENUE_REPORT_CONTENT_WIDTH, height, table.borderGray, 0.55);
  addTextLines(commands, lines, safe.left + table.padding, y - table.padding - table.fontSize, {
    size: table.fontSize,
    lineHeight: table.lineHeight,
    gray: 0.18,
    fontFamily: style.fontFamily,
  });
  return y - height - BOD_AVENUE_REPORT_LAYOUT.group.groupGapAfterTable;
}

function drawLetterheadExchangeSection(pages, commands, y, report, style) {
  if (report?.includeLetterheadExchanges !== true) return { commands, y };
  const rows = letterheadRowsForReport(report);
  const safe = BOD_AVENUE_REPORT_LAYOUT.safeArea;
  const table = style.table;
  const heading = letterheadHeadingModel(style);
  const gap = BOD_AVENUE_REPORT_LAYOUT.group.groupGapAfterTable;
  const firstRowHeight = rows[0] ? rowHeightForLines(letterheadCellLines(rows[0], style), style) : table.lineHeight + table.padding * 2;
  const required = heading.height + (rows.length ? table.headerHeight + firstRowHeight : firstRowHeight);
  ({ commands, y } = ensureSpace(pages, commands, y - gap, required));
  y = drawLetterheadHeading(commands, y, style);
  if (!rows.length) {
    if (y - firstRowHeight < safe.bottom) ({ commands, y } = createBlankPage(pages));
    return { commands, y: drawNoLetterheadMessage(commands, y, style) };
  }
  y = drawTableHeader(commands, y, style, BOD_LETTERHEAD_EXCHANGE_TABLE_COLUMNS);
  y = drawLetterheadRows(pages, rows, y, style);
  return { commands: pages.at(-1), y };
}

function drawReportContent(pages, report, startY, style, context) {
  let commands = pages.at(-1);
  let y = startY;
  let completedMonth = false;
  const sections = reportSections(report);
  const showAvenueHeading = sections.some((section) => section.sectionType !== "bodMeetings")
    && (sections.length > 1 || selectedAvenueCodes(report).length > 1);
  const showGrandTotal = (report?.selectedMonths || []).length > 1;

  for (const section of sections) {
    const isMeetingSection = section.sectionType === "bodMeetings";
    if (showAvenueHeading && !isMeetingSection) {
      const firstMonth = section.months[0];
      const firstRow = firstMonth?.events?.[0] ? eventCellLines(firstMonth.events[0], style) : null;
      const firstPhoto = firstMonth?.events?.[0] ? photoResourceForEvent(context, firstMonth.events[0]) : null;
      const firstRowHeight = firstRow
        ? rowHeightForLines(firstRow, style) + (firstPhoto ? photoBlockHeight(firstPhoto.image, BOD_AVENUE_REPORT_CONTENT_WIDTH) : 0)
        : style.table.lineHeight + style.table.padding * 2;
      const intro = sectionHeadingModel(section, style);
      const samePageGap = completedMonth ? BOD_AVENUE_REPORT_LAYOUT.group.groupGapAfterTable : 0;
      ({ commands, y } = ensureSpace(pages, commands, y - samePageGap, intro.height + monthHeadingHeight(true) + style.table.headerHeight + firstRowHeight));
      y = drawSectionHeading(commands, y, section, style);
    }

    for (const month of section.months) {
      const showMonthHeading = isMeetingSection || showAvenueHeading || section.months.length > 1 || (report?.selectedMonths || []).length > 1;
      const firstRow = month.events[0] ? eventCellLines(month.events[0], style) : null;
      const firstPhoto = month.events[0] ? photoResourceForEvent(context, month.events[0]) : null;
      const firstRowHeight = firstRow
        ? rowHeightForLines(firstRow, style) + (firstPhoto ? photoBlockHeight(firstPhoto.image, BOD_AVENUE_REPORT_CONTENT_WIDTH) : 0)
        : style.table.lineHeight + style.table.padding * 2;
      const samePageGap = completedMonth && (!showAvenueHeading || isMeetingSection) ? BOD_AVENUE_REPORT_LAYOUT.group.groupGapAfterTable : 0;
      ({ commands, y } = ensureSpace(pages, commands, y - samePageGap, monthHeadingHeight(showMonthHeading) + style.table.headerHeight + firstRowHeight));
      if (showMonthHeading) y = drawMonthHeading(commands, y, month, style, section);
      y = drawTableHeader(commands, y, style);
      y = drawEventRows(pages, month.events, y, style, context);
      commands = pages.at(-1);
      ({ commands, y } = drawMonthTotal(pages, commands, y, month, style));
      completedMonth = true;
    }
  }

  if (showGrandTotal) ({ commands, y } = drawGrandTotal(pages, commands, y, report, style));
  drawLetterheadExchangeSection(pages, commands, y, report, style);
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

function buildBodAvenueReportPdfLayout(report, options = {}) {
  if (!report?.events?.length || report.eventCount !== report.events.length) throw new TypeError("A finalized non-empty report model is required.");
  const style = resolveReportStyle(report);
  const context = {
    imageResources: normalizedReportImages(options.imagesByEventId),
    pageImageEventIds: [],
  };
  const pages = [[]];
  const firstPage = pages[0];
  drawReportContent(pages, report, drawReportHeader(firstPage, report, style), style, context);
  addPageChrome(pages, report);
  return { pages, pageImageEventIds: context.pageImageEventIds, imageResources: context.imageResources };
}

export function buildBodAvenueReportPdfPages(report, options = {}) {
  return buildBodAvenueReportPdfLayout(report, options).pages;
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

function usedImageResources(layout) {
  const used = new Set((layout.pageImageEventIds || []).flatMap((set) => [...(set || [])]));
  return [...layout.imageResources.values()].filter((resource) => used.has(resource.eventId));
}

function xObjectResources(baseResources, pageImageEventIds, resourceByEventId) {
  const entries = [...baseResources];
  for (const eventId of pageImageEventIds || []) {
    const resource = resourceByEventId.get(eventId);
    if (resource?.objectId) entries.push(`/${resource.resourceName} ${resource.objectId} 0 R`);
  }
  return entries.join(" ");
}

export function buildBodAvenueReportPdfDocument(report, letterhead, options = {}) {
  validateLetterhead(letterhead);
  const layout = buildBodAvenueReportPdfLayout(report, options);
  const pages = layout.pages;
  const reportImages = usedImageResources(layout);
  const objects = [];
  let nextObjectId = 7;
  const imageId = nextObjectId;
  nextObjectId += 1;
  reportImages.forEach((resource) => {
    resource.objectId = nextObjectId;
    nextObjectId += 1;
  });
  const pageIds = pages.map(() => {
    const id = nextObjectId;
    nextObjectId += 2;
    return id;
  });
  const placement = imagePlacement(letterhead);
  objects[1] = ascii("<< /Type /Catalog /Pages 2 0 R >>");
  objects[2] = ascii(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  objects[3] = ascii("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objects[4] = ascii("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  objects[5] = ascii("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>");
  objects[6] = ascii("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>");
  objects[imageId] = imageObject(letterhead);
  reportImages.forEach((resource) => {
    objects[resource.objectId] = buildJpegImageXObject(resource.image);
  });
  const resourceByEventId = new Map(reportImages.map((resource) => [resource.eventId, resource]));
  pages.forEach((page, index) => {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    const commands = [
      `q\n${placement.width.toFixed(2)} 0 0 ${placement.height.toFixed(2)} ${placement.x.toFixed(2)} ${placement.y.toFixed(2)} cm\n/BG Do\nQ`,
      ...page,
    ];
    const content = ascii(commands.join("\n"));
    const xObjects = xObjectResources([`/BG ${imageId} 0 R`], layout.pageImageEventIds[index], resourceByEventId);
    objects[pageId] = ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_PDF_SIZE.width} ${A4_PDF_SIZE.height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R /F4 6 0 R >> /XObject << ${xObjects} >> >> /Contents ${contentId} 0 R >>`);
    objects[contentId] = streamObject(content);
  });
  return assemblePdf(objects);
}

export async function downloadBodAvenueReportPdf(report, options = {}) {
  const loadLetterhead = options.loadLetterhead || getBodAvenueReportLetterheadPng;
  const letterhead = await loadLetterhead();
  const pdf = buildBodAvenueReportPdfDocument(report, letterhead, { imagesByEventId: options.imagesByEventId });
  const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = getBodAvenueReportFilename(report);
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
