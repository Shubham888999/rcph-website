import {
  A4_PDF_SIZE,
  normalizePdfText,
  pdfFillRectCommand,
  pdfLineCommand,
} from "../../pdf/simplePdf.js";
import {
  BOD_AVENUE_REPORT_LETTERHEAD_URL,
  getBodAvenueReportLetterheadPng,
} from "../../bod-tools/bodAvenueReportPdf.js";
import { treasuryExportFileName } from "./treasuryExportModel.js";

export const TREASURY_PDF_LETTERHEAD_URL = BOD_AVENUE_REPORT_LETTERHEAD_URL;

export const TREASURY_PDF_LAYOUT = Object.freeze({
  page: A4_PDF_SIZE,
  safeArea: Object.freeze({ left: 36, right: 559, top: 670, bottom: 205 }),
  topMeta: Object.freeze({ y: 735, fontSize: 10, gray: 0.2 }),
  footer: Object.freeze({ x: 20, y: 85, fontSize: 8.2, gray: 0.3 }),
  summary: Object.freeze({
    titleSize: 14,
    labelSize: 7.5,
    valueSize: 8.3,
    lineHeight: 10.8,
    fieldGap: 6,
    dividerGray: 0.62,
  }),
  table: Object.freeze({
    headerHeight: 22,
    fontSize: 7.7,
    headerFontSize: 7.4,
    lineHeight: 9.7,
    padding: 4,
    headerGray: 0.9,
    alternateRowGray: 0.975,
    borderGray: 0.7,
    headerBorderGray: 0.55,
  }),
});

export const TREASURY_PDF_CONTENT_WIDTH =
  TREASURY_PDF_LAYOUT.safeArea.right - TREASURY_PDF_LAYOUT.safeArea.left;

export const TREASURY_PDF_COLUMNS = Object.freeze([
  Object.freeze({ key: "date", label: "Date", width: 62 }),
  Object.freeze({ key: "type", label: "Type", width: 74 }),
  Object.freeze({ key: "category", label: "Category", width: 82 }),
  Object.freeze({ key: "description", label: "Description", width: 223 }),
  Object.freeze({ key: "amount", label: "Amount", width: 82, align: "right" }),
]);

const encoder = new TextEncoder();

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
  return normalizePdfText(value).replace(/[\\()]/g, (character) => `\\${character}`);
}

function textWidth(value, size, bold = false) {
  return normalizePdfText(value).length * size * 0.52 * (bold ? 1.04 : 1);
}

function textCommand({ x, y, text, size = 9, bold = false, gray = 0 }) {
  const shade = Math.max(0, Math.min(1, Number(gray) || 0));
  return `BT ${shade} g /${bold ? "F2" : "F1"} ${size} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td (${escapePdfText(text)}) Tj ET`;
}

function rightAlignedTextCommand({ right, y, text, size, bold = false, gray = 0 }) {
  return textCommand({ x: right - textWidth(text, size, bold), y, text, size, bold, gray });
}

function wrapText(value, maxWidth, fontSize = 8) {
  const averageCharacterWidth = fontSize * 0.52;
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
  })));
  return y - Math.max(1, lines.length) * lineHeight;
}

function formatPdfDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function formatPdfTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "time not recorded";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function formatPdfInr(value) {
  const amount = Number(value || 0);
  return `INR ${new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0)}`;
}

function drawSummary(commands, report) {
  const { safeArea, summary } = TREASURY_PDF_LAYOUT;
  let y = safeArea.top;
  commands.push(textCommand({ x: safeArea.left, y, text: report.title, size: summary.titleSize, bold: true, gray: 0.08 }));
  commands.push(rightAlignedTextCommand({ right: safeArea.right, y, text: `${report.transactionCount} transactions`, size: 8.6, bold: true, gray: 0.18 }));
  y -= 22;

  const fields = [
    ["Period", report.reportPeriod],
    ["Treasurer", report.treasurerName],
    ["Income", formatPdfInr(report.summary.income)],
    ["Expenses", formatPdfInr(report.summary.expenses)],
    ["Net Balance", formatPdfInr(report.summary.net)],
    ["Filters", report.filterSummary.join("; ")],
  ];
  const columnWidth = (TREASURY_PDF_CONTENT_WIDTH - 12) / 2;
  for (let index = 0; index < fields.length; index += 2) {
    let rowHeight = summary.lineHeight * 2;
    const leftLines = wrapText(fields[index][1], columnWidth - 4, summary.valueSize);
    const rightLines = fields[index + 1] ? wrapText(fields[index + 1][1], columnWidth - 4, summary.valueSize) : [""];
    rowHeight = Math.max(rowHeight, summary.lineHeight * (1 + Math.max(leftLines.length, rightLines.length)));
    const leftX = safeArea.left;
    const rightX = safeArea.left + columnWidth + 12;
    commands.push(textCommand({ x: leftX, y, text: fields[index][0], size: summary.labelSize, bold: true, gray: 0.16 }));
    addTextLines(commands, leftLines, leftX, y - summary.lineHeight, {
      size: summary.valueSize,
      lineHeight: summary.lineHeight,
      gray: 0.08,
    });
    if (fields[index + 1]) {
      commands.push(textCommand({ x: rightX, y, text: fields[index + 1][0], size: summary.labelSize, bold: true, gray: 0.16 }));
      addTextLines(commands, rightLines, rightX, y - summary.lineHeight, {
        size: summary.valueSize,
        lineHeight: summary.lineHeight,
        gray: 0.08,
      });
    }
    y -= rowHeight + summary.fieldGap;
  }

  const dividerY = y - 2;
  commands.push(pdfLineCommand({ x1: safeArea.left, y1: dividerY, x2: safeArea.right, y2: dividerY, width: 0.6, gray: summary.dividerGray }));
  return dividerY - 8;
}

function drawTableHeader(commands, top) {
  const { safeArea, table } = TREASURY_PDF_LAYOUT;
  commands.push(pdfFillRectCommand({ x: safeArea.left, y: top - table.headerHeight, width: TREASURY_PDF_CONTENT_WIDTH, height: table.headerHeight, gray: table.headerGray }));
  let x = safeArea.left;
  for (const column of TREASURY_PDF_COLUMNS) {
    const textX = column.align === "right" ? x + column.width - table.padding : x + table.padding;
    const command = column.align === "right"
      ? rightAlignedTextCommand({ right: textX, y: top - 14.5, text: column.label, size: table.headerFontSize, bold: true })
      : textCommand({ x: textX, y: top - 14.5, text: column.label, size: table.headerFontSize, bold: true });
    commands.push(command);
    commands.push(pdfLineCommand({ x1: x, y1: top, x2: x, y2: top - table.headerHeight, gray: table.headerBorderGray }));
    x += column.width;
  }
  commands.push(pdfLineCommand({ x1: x, y1: top, x2: x, y2: top - table.headerHeight, gray: table.headerBorderGray }));
  commands.push(pdfLineCommand({ x1: safeArea.left, y1: top, x2: safeArea.right, y2: top, gray: table.headerBorderGray }));
  commands.push(pdfLineCommand({ x1: safeArea.left, y1: top - table.headerHeight, x2: safeArea.right, y2: top - table.headerHeight, gray: table.headerBorderGray }));
  return top - table.headerHeight;
}

function rowDescription(transaction) {
  const detail = [`${transaction.description}`];
  detail.push(`From: ${transaction.source}`);
  detail.push(`To: ${transaction.destination}`);
  if (transaction.linkedRecord && transaction.linkedRecord !== "Not linked") detail.push(transaction.linkedRecord);
  return detail.join("\n");
}

function transactionLines(transaction) {
  const { table } = TREASURY_PDF_LAYOUT;
  return {
    date: wrapText(transaction.dateLabel, TREASURY_PDF_COLUMNS[0].width - table.padding * 2, table.fontSize),
    type: wrapText(transaction.type, TREASURY_PDF_COLUMNS[1].width - table.padding * 2, table.fontSize),
    category: wrapText(transaction.category, TREASURY_PDF_COLUMNS[2].width - table.padding * 2, table.fontSize),
    description: wrapText(rowDescription(transaction), TREASURY_PDF_COLUMNS[3].width - table.padding * 2, table.fontSize),
    amount: [formatPdfInr(transaction.amount)],
  };
}

function rowHeightForLines(lines) {
  const { table } = TREASURY_PDF_LAYOUT;
  return Math.max(1, ...Object.values(lines).map((cellLines) => cellLines.length)) * table.lineHeight + table.padding * 2;
}

function drawRow(commands, lines, top, shade) {
  const { safeArea, table } = TREASURY_PDF_LAYOUT;
  const rowHeight = rowHeightForLines(lines);
  if (shade) commands.push(pdfFillRectCommand({ x: safeArea.left, y: top - rowHeight, width: TREASURY_PDF_CONTENT_WIDTH, height: rowHeight, gray: table.alternateRowGray }));
  let x = safeArea.left;
  TREASURY_PDF_COLUMNS.forEach((column) => {
    lines[column.key].forEach((line, index) => {
      const y = top - table.padding - table.fontSize - index * table.lineHeight;
      if (column.align === "right") {
        commands.push(rightAlignedTextCommand({
          right: x + column.width - table.padding,
          y,
          text: line,
          size: table.fontSize,
        }));
      } else {
        commands.push(textCommand({
          x: x + table.padding,
          y,
          text: line,
          size: table.fontSize,
        }));
      }
    });
    commands.push(pdfLineCommand({ x1: x, y1: top, x2: x, y2: top - rowHeight, gray: table.borderGray }));
    x += column.width;
  });
  commands.push(pdfLineCommand({ x1: x, y1: top, x2: x, y2: top - rowHeight, gray: table.borderGray }));
  commands.push(pdfLineCommand({ x1: safeArea.left, y1: top - rowHeight, x2: safeArea.right, y2: top - rowHeight, gray: table.borderGray }));
  return top - rowHeight;
}

function splitOversizedRow(lines) {
  const { safeArea, table } = TREASURY_PDF_LAYOUT;
  const availableLines = Math.max(1, Math.floor((safeArea.top - table.headerHeight - safeArea.bottom - table.padding * 2) / table.lineHeight));
  const remaining = Object.fromEntries(Object.entries(lines).map(([key, value]) => [key, [...value]]));
  const chunks = [];
  let first = true;
  while (Object.values(remaining).some((cellLines) => cellLines.length)) {
    const chunk = {};
    for (const key of Object.keys(remaining)) chunk[key] = remaining[key].splice(0, availableLines);
    if (!first) {
      if (!chunk.date.length) chunk.date = [""];
      if (!chunk.type.length) chunk.type = [""];
      if (!chunk.category.length) chunk.category = [""];
      if (!chunk.description.length) chunk.description = ["(continued)"];
      if (!chunk.amount.length) chunk.amount = [""];
    }
    chunks.push(chunk);
    first = false;
  }
  return chunks;
}

function createTablePage(pages) {
  const commands = [];
  pages.push(commands);
  return { commands, y: drawTableHeader(commands, TREASURY_PDF_LAYOUT.safeArea.top) };
}

function drawTransactionRows(pages, transactions, startY) {
  const { safeArea, table } = TREASURY_PDF_LAYOUT;
  let commands = pages.at(-1);
  let y = startY;
  const freshPageRowCapacity = safeArea.top - table.headerHeight - safeArea.bottom;
  if (!transactions.length) {
    y = drawRow(commands, {
      date: [""],
      type: [""],
      category: [""],
      description: ["No matching Treasury transactions for the active filters."],
      amount: [formatPdfInr(0)],
    }, y, false);
    return y;
  }
  transactions.forEach((transaction, index) => {
    const lines = transactionLines(transaction);
    const rowHeight = rowHeightForLines(lines);
    if (rowHeight > freshPageRowCapacity) {
      for (const chunk of splitOversizedRow(lines)) {
        const chunkHeight = rowHeightForLines(chunk);
        if (y - chunkHeight < safeArea.bottom) ({ commands, y } = createTablePage(pages));
        y = drawRow(commands, chunk, y, index % 2 === 1);
      }
      return;
    }
    if (y - rowHeight < safeArea.bottom) ({ commands, y } = createTablePage(pages));
    y = drawRow(commands, lines, y, index % 2 === 1);
  });
  return y;
}

function addPageChrome(pages, report) {
  const { safeArea, topMeta, footer } = TREASURY_PDF_LAYOUT;
  const generatedDate = formatPdfDate(report.generatedAt);
  const metadataLine = `Generated by RCPH Website - ${formatPdfDate(report.generatedAt)} at ${formatPdfTime(report.generatedAt)} IST`;
  pages.forEach((page, index) => {
    const pageNumber = `Page ${index + 1} of ${pages.length}`;
    page.unshift(
      textCommand({ x: safeArea.left, y: topMeta.y, text: generatedDate, size: topMeta.fontSize, gray: topMeta.gray }),
      rightAlignedTextCommand({ right: safeArea.right, y: topMeta.y, text: pageNumber, size: topMeta.fontSize, gray: topMeta.gray }),
    );
    page.push(textCommand({ x: footer.x, y: footer.y, text: metadataLine, size: footer.fontSize, gray: footer.gray }));
  });
}

export function buildTreasuryPdfPages(report) {
  if (!report?.summary || !Array.isArray(report.transactions)) throw new TypeError("A Treasury export report is required.");
  const pages = [[]];
  const firstPage = pages[0];
  const tableTop = drawSummary(firstPage, report);
  const startY = drawTableHeader(firstPage, tableTop);
  drawTransactionRows(pages, report.transactions, startY);
  addPageChrome(pages, report);
  return pages;
}

function validateLetterhead(letterhead) {
  if (!(letterhead?.bytes instanceof Uint8Array) || !letterhead.bytes.length || !Number.isInteger(letterhead.width) || !Number.isInteger(letterhead.height)) {
    throw new TypeError("A valid Treasury letterhead PNG is required.");
  }
  if (letterhead.colorSpace !== "DeviceRGB" || letterhead.bitsPerComponent !== 8 || letterhead.colors !== 3) {
    throw new TypeError("A valid 8-bit RGB Treasury letterhead PNG is required.");
  }
}

function imagePlacement(letterhead) {
  const page = TREASURY_PDF_LAYOUT.page;
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

export function buildTreasuryPdfDocument(report, letterhead) {
  validateLetterhead(letterhead);
  const pages = buildTreasuryPdfPages(report);
  const objects = [];
  const imageId = 5;
  const pageIds = pages.map((_, index) => 6 + index * 2);
  const placement = imagePlacement(letterhead);
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

export function treasuryPdfFileName(report) {
  return treasuryExportFileName(report, "pdf");
}

export async function downloadTreasuryPdf(report, options = {}) {
  const loadLetterhead = options.loadLetterhead || getBodAvenueReportLetterheadPng;
  const letterhead = await loadLetterhead();
  const pdf = buildTreasuryPdfDocument(report, letterhead);
  const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = treasuryPdfFileName(report);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
