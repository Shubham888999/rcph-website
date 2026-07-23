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
export const BOD_SECRETARIAL_REPORT_FRAME_URL = "/images/Report_Frame.png";

const encoder = new TextEncoder();
const SAFE_AREA = BOD_AVENUE_REPORT_LAYOUT.safeArea;
const DEFAULT_FRAME_ASPECT_RATIO = 1204 / 824;

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
  frameInset: 30,
  frameTitleSize: 17,
  frameStatSize: 14,
  frameStatLineGap: 29,
});

const CONTENT_WIDTH = A4_PDF_SIZE.width - BOD_SECRETARIAL_REPORT_PDF_LAYOUT.margin * 2;
const STAT_ROWS = Object.freeze([
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

function centerText(commands, center, y, value, options = {}) {
  const size = options.size || BOD_SECRETARIAL_REPORT_PDF_LAYOUT.bodySize;
  text(commands, center - approximateTextWidth(value, size, options.bold) / 2, y, value, options);
}

function centerInlineText(commands, center, y, parts, options = {}) {
  const size = options.size || BOD_SECRETARIAL_REPORT_PDF_LAYOUT.bodySize;
  const gap = options.gap ?? 5;
  const visibleParts = parts
    .map((part) => ({
      text: displayText(part.text, ""),
      bold: Boolean(part.bold),
    }))
    .filter((part) => part.text);

  const widths = visibleParts.map((part) => approximateTextWidth(part.text, size, part.bold));
  const totalWidth = widths.reduce((sum, width) => sum + width, 0)
    + Math.max(0, visibleParts.length - 1) * gap;

  let x = center - totalWidth / 2;
  visibleParts.forEach((part, index) => {
    text(commands, x, y, part.text, {
      size,
      bold: part.bold,
      gray: options.gray || 0,
    });
    x += widths[index] + gap;
  });
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

function frameBox(frame) {
  const layout = BOD_SECRETARIAL_REPORT_PDF_LAYOUT;
  const safe = layout.safeArea;
  const aspect = Number(frame?.width) > 0 && Number(frame?.height) > 0
    ? Number(frame.width) / Number(frame.height)
    : DEFAULT_FRAME_ASPECT_RATIO;
  const maxWidth = safe.right - safe.left - layout.frameInset * 2;
  const maxHeight = safe.top - safe.bottom - layout.frameInset * 2;
  let width = maxWidth;
  let height = width / aspect;
  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspect;
  }
  return {
    x: safe.left + (maxWidth - width) / 2 + layout.frameInset,
    y: safe.bottom + (maxHeight - height) / 2 + layout.frameInset,
    width,
    height,
  };
}

function frameImageCommand(frame) {
  const box = frameBox(frame);
  return `q\n${box.width.toFixed(2)} 0 0 ${box.height.toFixed(2)} ${box.x.toFixed(2)} ${box.y.toFixed(2)} cm\n/FRAME Do\nQ`;
}

function summaryPage(report, frame) {
  const layout = BOD_SECRETARIAL_REPORT_PDF_LAYOUT;
  const box = frameBox(frame);
  const commands = [];
  commands.push(frameImageCommand(frame));
  const title = displayText(report?.title || "Monthly Report RCPH RIY 26 - 27");
  const center = box.x + box.width / 2;
  const titleY = box.y + box.height - Math.max(56, box.height * 0.16);
  centerText(commands, center, titleY, title, {
    size: layout.frameTitleSize,
    bold: true,
  });

  const firstLineY = titleY - 48;
  STAT_ROWS.forEach(([label, key], index) => {
    centerInlineText(commands, center, firstLineY - index * layout.frameStatLineGap, [
      { text: `${label}:`, bold: true },
      { text: stringValue(report?.[key]), bold: false },
    ], {
      size: layout.frameStatSize,
      gap: 5,
    });
  });
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

export function buildBodSecretarialReportPdfPages(report, options = {}) {
  validateReport(report);
  const pages = [summaryPage(report, options.frame)];
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

function validateRgbImage(image, label) {
  if (!(image?.bytes instanceof Uint8Array) || !image.bytes.length || !Number.isInteger(image.width) || !Number.isInteger(image.height)) {
    throw new TypeError(`A valid Secretarial Report ${label} image is required.`);
  }
  if (image.colorSpace !== "DeviceRGB" || image.bitsPerComponent !== 8 || image.colors !== 3) {
    throw new TypeError(`A valid 8-bit RGB Secretarial Report ${label} image is required.`);
  }
}

function imageObject(image) {
  const compressed = image.raw !== true;
  const filter = compressed
    ? ` /Filter /FlateDecode /DecodeParms << /Predictor 15 /Colors ${image.colors} /BitsPerComponent ${image.bitsPerComponent} /Columns ${image.width} >>`
    : "";
  return concatBytes([
    ascii(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /${image.colorSpace} /BitsPerComponent ${image.bitsPerComponent}${filter} /Length ${image.bytes.length} >>\nstream\n`),
    image.bytes,
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

export function buildBodSecretarialReportPdfDocument(report, letterhead, frame) {
  validateRgbImage(letterhead, "letterhead");
  validateRgbImage(frame, "frame");
  const pages = buildBodSecretarialReportPdfPages(report, { frame });
  const imageId = 5;
  const frameImageId = 6;
  const pageIds = pages.map((_, index) => 7 + index * 2);
  const placement = imagePlacement(letterhead);
  const objects = [];
  objects[1] = ascii("<< /Type /Catalog /Pages 2 0 R >>");
  objects[2] = ascii(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  objects[3] = ascii("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objects[4] = ascii("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  objects[imageId] = imageObject(letterhead);
  objects[frameImageId] = imageObject(frame);
  pages.forEach((page, index) => {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    const commands = [
      `q\n${placement.width.toFixed(2)} 0 0 ${placement.height.toFixed(2)} ${placement.x.toFixed(2)} ${placement.y.toFixed(2)} cm\n/BG Do\nQ`,
      ...page,
    ];
    const content = ascii(commands.join("\n"));
    objects[pageId] = ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_PDF_SIZE.width} ${A4_PDF_SIZE.height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /BG ${imageId} 0 R /FRAME ${frameImageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects[contentId] = streamObject(content);
  });
  return assemblePdf(objects);
}

function loadHtmlImage(blob) {
  if (typeof globalThis.Image !== "function" || !globalThis.URL?.createObjectURL) {
    throw new Error("Browser image decoding is unavailable.");
  }
  return new Promise((resolve, reject) => {
    const url = globalThis.URL.createObjectURL(blob);
    const image = new globalThis.Image();
    image.onload = () => {
      globalThis.URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      globalThis.URL.revokeObjectURL(url);
      reject(new Error("The Secretarial Report frame image could not be decoded."));
    };
    image.src = url;
  });
}

async function decodeImage(blob) {
  if (typeof globalThis.createImageBitmap === "function") return globalThis.createImageBitmap(blob);
  return loadHtmlImage(blob);
}

function createCanvas(width, height) {
  if (!globalThis.document?.createElement) throw new Error("Browser canvas APIs are unavailable.");
  const canvas = globalThis.document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export async function convertSecretarialReportFrameBlobToImage(blob, options = {}) {
  const decoder = options.decodeImage || decodeImage;
  const canvasFactory = options.createCanvas || createCanvas;
  const image = await decoder(blob);
  const width = Number(image?.width || image?.naturalWidth);
  const height = Number(image?.height || image?.naturalHeight);
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) {
    image?.close?.();
    throw new Error("The Secretarial Report frame dimensions are invalid.");
  }
  const canvas = canvasFactory(width, height);
  const context = canvas?.getContext?.("2d");
  if (!context) {
    image?.close?.();
    throw new Error("A 2D canvas context is unavailable.");
  }
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  image?.close?.();
  const rgba = context.getImageData(0, 0, width, height).data;
  const bytes = new Uint8Array(width * height * 3);
  for (let source = 0, target = 0; source < rgba.length; source += 4, target += 3) {
    bytes[target] = rgba[source];
    bytes[target + 1] = rgba[source + 1];
    bytes[target + 2] = rgba[source + 2];
  }
  return { bytes, width, height, bitsPerComponent: 8, colorSpace: "DeviceRGB", colors: 3, raw: true };
}

export async function loadBodSecretarialReportFrameImage(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const converter = options.convertBlob || convertSecretarialReportFrameBlobToImage;
  const logger = options.logger || console;
  try {
    if (typeof fetchImpl !== "function") throw new Error("Asset loading is unavailable.");
    const response = await fetchImpl(BOD_SECRETARIAL_REPORT_FRAME_URL, { cache: options.cache || "no-store" });
    if (!response?.ok) throw new Error(`Asset request failed with status ${response?.status || "unknown"}.`);
    return await converter(await response.blob(), options);
  } catch (error) {
    logger?.error?.("Secretarial Report frame preparation failed.", {
      assetUrl: BOD_SECRETARIAL_REPORT_FRAME_URL,
      errorName: typeof error?.name === "string" ? error.name : "Error",
    });
    throw new Error("The Secretarial Report frame could not be loaded. Please try again.", { cause: error });
  }
}

function filePart(value) {
  return cleanText(value, 120).replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "Monthly";
}

export function getBodSecretarialReportFilename(report) {
  return `RCPH-Secretarial-Report-${filePart(report?.periodLabel)}.pdf`;
}

export async function downloadBodSecretarialReportPdf(report, options = {}) {
  const loadLetterhead = options.loadLetterhead || getBodAvenueReportLetterheadPng;
  const loadFrame = options.loadFrame || loadBodSecretarialReportFrameImage;
  const [letterhead, frame] = await Promise.all([loadLetterhead(), loadFrame()]);
  const pdf = buildBodSecretarialReportPdfDocument(report, letterhead, frame);
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
