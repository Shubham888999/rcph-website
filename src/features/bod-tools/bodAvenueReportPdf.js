import { getBodAvenueReportFilename } from "./bodAvenueReportModel.js";
import {
  A4_PDF_SIZE,
  buildSimpleA4Pdf,
  pdfFillRectCommand,
  pdfLineCommand,
  pdfTextCommand,
  wrapPdfText,
} from "../pdf/simplePdf.js";

const MARGIN = 36;
const CONTENT_WIDTH = A4_PDF_SIZE.width - MARGIN * 2;
const TABLE_BOTTOM = 48;
const TABLE_COLUMNS = Object.freeze([
  { key: "date", label: "Date", width: 58 },
  { key: "event", label: "Event", width: 132 },
  { key: "role", label: "Role", width: 66 },
  { key: "details", label: "Host / Collaborators / Description", width: CONTENT_WIDTH - 256 },
]);

function formatGeneratedAt(value) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

function addWrappedText(commands, text, x, y, width, options = {}) {
  const size = options.size || 9;
  const lineHeight = options.lineHeight || size * 1.3;
  const lines = wrapPdfText(text, width, size);
  lines.forEach((line, index) => commands.push(pdfTextCommand({ x, y: y - index * lineHeight, text: line, size, bold: options.bold, gray: options.gray })));
  return y - lines.length * lineHeight;
}

function drawTableHeader(commands, top) {
  const height = 23;
  commands.push(pdfFillRectCommand({ x: MARGIN, y: top - height, width: CONTENT_WIDTH, height, gray: 0.9 }));
  let x = MARGIN;
  for (const column of TABLE_COLUMNS) {
    commands.push(pdfTextCommand({ x: x + 4, y: top - 15, text: column.label, size: 7.5, bold: true }));
    commands.push(pdfLineCommand({ x1: x, y1: top, x2: x, y2: top - height, gray: 0.55 }));
    x += column.width;
  }
  commands.push(pdfLineCommand({ x1: x, y1: top, x2: x, y2: top - height, gray: 0.55 }));
  commands.push(pdfLineCommand({ x1: MARGIN, y1: top, x2: MARGIN + CONTENT_WIDTH, y2: top, gray: 0.55 }));
  commands.push(pdfLineCommand({ x1: MARGIN, y1: top - height, x2: MARGIN + CONTENT_WIDTH, y2: top - height, gray: 0.55 }));
  return top - height;
}

function addContinuationPage(pages, report) {
  const commands = [];
  commands.push(pdfTextCommand({ x: MARGIN, y: 806, text: "MONTHLY BOD AVENUE REPORT", size: 11, bold: true }));
  commands.push(pdfTextCommand({ x: MARGIN, y: 790, text: `${report.monthLabel} - ${report.avenueLabel}`, size: 8, gray: 0.25 }));
  pages.push(commands);
  return drawTableHeader(commands, 770);
}

function eventCellLines(event) {
  const details = `Host: ${event.hostClub}\nCollaborators: ${event.collaborators}\nDescription: ${event.description}`;
  return {
    date: wrapPdfText(event.dateLabel, TABLE_COLUMNS[0].width - 8, 7.5),
    event: wrapPdfText(event.name, TABLE_COLUMNS[1].width - 8, 7.5),
    role: wrapPdfText(event.role, TABLE_COLUMNS[2].width - 8, 7.5),
    details: wrapPdfText(details, TABLE_COLUMNS[3].width - 8, 7.5),
  };
}

function drawEventRows(pages, report, startY) {
  let commands = pages.at(-1);
  let y = startY;
  const lineHeight = 9.5;
  const padding = 4;
  report.events.forEach((event, eventIndex) => {
    const remaining = eventCellLines(event);
    let firstChunk = true;
    while (Object.values(remaining).some((lines) => lines.length)) {
      const availableLines = Math.floor((y - TABLE_BOTTOM - padding * 2) / lineHeight);
      if (availableLines < 2) {
        y = addContinuationPage(pages, report);
        commands = pages.at(-1);
        continue;
      }
      const chunkSize = Math.min(availableLines, Math.max(...Object.values(remaining).map((lines) => lines.length)));
      const chunks = {};
      for (const key of Object.keys(remaining)) chunks[key] = remaining[key].splice(0, chunkSize);
      if (!firstChunk && !chunks.event.length) chunks.event = ["(continued)"];
      const rowLineCount = Math.max(1, ...Object.values(chunks).map((lines) => lines.length));
      const rowHeight = rowLineCount * lineHeight + padding * 2;
      if (eventIndex % 2 === 1) commands.push(pdfFillRectCommand({ x: MARGIN, y: y - rowHeight, width: CONTENT_WIDTH, height: rowHeight, gray: 0.975 }));
      let x = MARGIN;
      TABLE_COLUMNS.forEach((column) => {
        chunks[column.key].forEach((line, index) => commands.push(pdfTextCommand({
          x: x + padding,
          y: y - padding - 7.5 - index * lineHeight,
          text: line,
          size: 7.5,
        })));
        commands.push(pdfLineCommand({ x1: x, y1: y, x2: x, y2: y - rowHeight, gray: 0.7 }));
        x += column.width;
      });
      commands.push(pdfLineCommand({ x1: x, y1: y, x2: x, y2: y - rowHeight, gray: 0.7 }));
      commands.push(pdfLineCommand({ x1: MARGIN, y1: y - rowHeight, x2: MARGIN + CONTENT_WIDTH, y2: y - rowHeight, gray: 0.7 }));
      y -= rowHeight;
      firstChunk = false;
    }
  });
}

export function buildBodAvenueReportPdfPages(report) {
  if (!report?.events?.length || report.eventCount !== report.events.length) throw new TypeError("A finalized non-empty report model is required.");
  const pages = [[]];
  const commands = pages[0];
  commands.push(pdfTextCommand({ x: MARGIN, y: 806, text: "ROTARACT CLUB OF PUNE HERITAGE", size: 15, bold: true }));
  commands.push(pdfTextCommand({ x: MARGIN, y: 784, text: "MONTHLY BOD AVENUE REPORT", size: 13, bold: true }));
  commands.push(pdfLineCommand({ x1: MARGIN, y1: 770, x2: MARGIN + CONTENT_WIDTH, y2: 770, width: 1.2, gray: 0.2 }));
  let y = 748;
  y = addWrappedText(commands, `Month: ${report.monthLabel}`, MARGIN, y, CONTENT_WIDTH, { size: 9, bold: true }) - 3;
  y = addWrappedText(commands, `Avenue: ${report.avenueLabel} (${report.avenueCode})`, MARGIN, y, CONTENT_WIDTH, { size: 9, bold: true }) - 3;
  y = addWrappedText(commands, `Director(s): ${report.directorText}`, MARGIN, y, CONTENT_WIDTH, { size: 9 }) - 3;
  y = addWrappedText(commands, `Director source: ${report.directorAssignmentBasis}`, MARGIN, y, CONTENT_WIDTH, { size: 7.5, gray: 0.25 }) - 3;
  y = addWrappedText(commands, `Total events: ${report.eventCount}`, MARGIN, y, CONTENT_WIDTH, { size: 9 }) - 3;
  y = addWrappedText(commands, `Generated on: ${formatGeneratedAt(report.generatedAt)}`, MARGIN, y, CONTENT_WIDTH, { size: 9 }) - 10;
  y = drawTableHeader(commands, y);
  drawEventRows(pages, report, y);
  pages.forEach((page, index) => {
    page.push(pdfLineCommand({ x1: MARGIN, y1: 38, x2: MARGIN + CONTENT_WIDTH, y2: 38, gray: 0.8 }));
    page.push(pdfTextCommand({ x: MARGIN, y: 23, text: "System-generated placeholder report", size: 7, gray: 0.35 }));
    page.push(pdfTextCommand({ x: 515, y: 23, text: `Page ${index + 1} of ${pages.length}`, size: 7, gray: 0.35 }));
  });
  return pages;
}

export function buildBodAvenueReportPdfDocument(report) {
  return buildSimpleA4Pdf(buildBodAvenueReportPdfPages(report));
}

export async function downloadBodAvenueReportPdf(report) {
  const pdf = buildBodAvenueReportPdfDocument(report);
  const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = getBodAvenueReportFilename(report);
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
