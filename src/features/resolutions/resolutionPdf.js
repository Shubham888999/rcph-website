import { FINAL_RESOLUTION_STATUSES, getResolutionPdfFilename } from "./resolutionModel.js";
import { buildCustomResolutionPdfPages, getResolutionRenderLayout } from "./resolutionCustomPdf.js";
import { getResolutionLetterheadJpeg } from "./resolutionLetterhead.js";

export const RESOLUTION_PDF_PAGE = Object.freeze({ width: 595, height: 842 });
export const RESOLUTION_CONTENT_BOUNDS = Object.freeze({ left: 54, right: 541, bottom: 260, top: 665 });
export const RESOLUTION_PAGE_NUMBER_POSITION = Object.freeze({ x: 505, y: 686 });

const CONTENT_WIDTH = RESOLUTION_CONTENT_BOUNDS.right - RESOLUTION_CONTENT_BOUNDS.left;
const CONTENT_START_Y = RESOLUTION_CONTENT_BOUNDS.top - 10;
const encoder = new TextEncoder();

function formatDateTime(value) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value));
}

function label(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function plainPdfText(value) {
  return String(value || "")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .normalize("NFKD")
    .replace(/[^\x20-\x7E\n]/g, "");
}

function pdfText(value) {
  return plainPdfText(value).replace(/[\\()]/g, (character) => `\\${character}`);
}

function wrapText(value, width, size = 10, mono = false) {
  const characterWidth = size * (mono ? 0.6 : 0.52);
  const limit = Math.max(1, Math.floor(width / characterWidth));
  const lines = [];
  plainPdfText(value).split(/\n/).forEach((paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(""); return; }
    let current = "";
    words.forEach((word) => {
      if (word.length > limit) {
        if (current) { lines.push(current); current = ""; }
        for (let index = 0; index < word.length; index += limit) lines.push(word.slice(index, index + limit));
      } else if (!current) current = word;
      else if (`${current} ${word}`.length <= limit) current += ` ${word}`;
      else { lines.push(current); current = word; }
    });
    if (current) lines.push(current);
  });
  return lines;
}

function wrappedLines(value, options = {}) {
  const size = options.size || 10;
  const lines = wrapText(value, options.width || CONTENT_WIDTH, size, options.mono === true);
  return lines.map((text, index) => ({
    text,
    size,
    bold: options.bold === true,
    mono: options.mono === true,
    gap: index === lines.length - 1 ? options.gap || 0 : 0,
  }));
}

function block(lines, keepLines = 1) {
  return { lines, keepLines: Math.max(1, keepLines) };
}

export function buildResolutionVoteRows(details) {
  const votes = new Map((details?.votes || []).map((vote) => [vote.voterUid, vote]));
  return (details?.resolution?.eligibleVoters || []).map((voter) => {
    const vote = votes.get(voter.uid);
    return {
      name: voter.name,
      position: voter.position,
      vote: vote ? label(vote.choice) : "Not submitted",
      submittedAt: vote ? formatDateTime(vote.submittedAt) : "-",
    };
  });
}

function buildDocumentBlocks(details) {
  const resolution = details.resolution;
  const blocks = [];
  const detailsLines = [];
  const detail = (name, value) => detailsLines.push(...wrappedLines(`${name}: ${value || "-"}`, { size: 8.5, gap: 1 }));

  blocks.push(block([
    ...wrappedLines("ROTARACT CLUB OF PUNE HERITAGE", { size: 13, bold: true, gap: 2 }),
    ...wrappedLines("BOD RESOLUTION", { size: 11.5, bold: true, gap: 7 }),
  ], 2));
  detail("Resolution number", resolution.resolutionNumber);
  detail("Resolution title", resolution.title);
  detail("BOD meeting", resolution.meetingTitle);
  detail("Meeting date", resolution.meetingDate);
  detail("Proposed by", `${resolution.proposedByName} - ${resolution.proposedByPosition}`);
  detail("Seconded by", `${resolution.secondedByName} - ${resolution.secondedByPosition}`);
  detail("Voting opened", formatDateTime(resolution.openedAt));
  detail("Voting closed", formatDateTime(resolution.closedAt));
  detail("Final result", label(resolution.result || resolution.status));
  blocks.push(block(detailsLines, 2));
  blocks.push(block([
    ...wrappedLines("Resolution", { size: 10.5, bold: true, gap: 2 }),
    ...wrappedLines(resolution.body, { size: 9, gap: 5 }),
  ], 2));
  if (resolution.notes) {
    blocks.push(block([
      ...wrappedLines("Background / notes", { size: 10.5, bold: true, gap: 2 }),
      ...wrappedLines(resolution.notes, { size: 9, gap: 5 }),
    ], 2));
  }
  blocks.push(block([
    ...wrappedLines("Vote summary", { size: 10.5, bold: true, gap: 2 }),
    ...wrappedLines(`Eligible voters: ${resolution.eligibleVoterCount}`, { size: 8.5, gap: 1 }),
    ...wrappedLines(`Votes received: ${resolution.votesReceivedCount}`, { size: 8.5, gap: 1 }),
    ...wrappedLines(`Approvals: ${resolution.approveCount}`, { size: 8.5, gap: 1 }),
    ...wrappedLines(`Rejections: ${resolution.rejectCount}`, { size: 8.5, gap: 1 }),
    ...wrappedLines(`Abstentions: ${resolution.abstainCount}`, { size: 8.5, gap: 4 }),
  ], 2));
  blocks.push(block([
    ...wrappedLines("Final vote table", { size: 10.5, bold: true, gap: 2 }),
    ...wrappedLines("Name                     | Position                       | Vote         | Submitted at", { size: 7.5, bold: true, mono: true }),
    ...wrappedLines("-------------------------+--------------------------------+--------------+--------------------------", { size: 7.5, mono: true }),
  ], 3));
  buildResolutionVoteRows(details).forEach((row) => {
    const cells = [wrapText(row.name, 24 * 4.5, 7.5, true), wrapText(row.position, 30 * 4.5, 7.5, true), wrapText(row.vote, 12 * 4.5, 7.5, true), wrapText(row.submittedAt, 24 * 4.5, 7.5, true)];
    const height = Math.max(...cells.map((cell) => cell.length));
    const lines = [];
    for (let index = 0; index < height; index += 1) {
      lines.push({
        text: `${(cells[0][index] || "").padEnd(24)} | ${(cells[1][index] || "").padEnd(30)} | ${(cells[2][index] || "").padEnd(12)} | ${(cells[3][index] || "").padEnd(24)}`,
        size: 7.5,
        mono: true,
        bold: false,
        gap: index === height - 1 ? 2 : 0,
      });
    }
    blocks.push(block(lines, lines.length));
  });
  blocks.push(block([
    ...wrappedLines("System-generated resolution record", { size: 7.5, gap: 1 }),
    ...wrappedLines(`Generated at: ${formatDateTime(new Date().toISOString())}`, { size: 7.5 }),
  ], 2));
  return blocks;
}

function lineHeight(line) {
  return line.size * 1.35 + (line.gap || 0);
}

function paginateBlocks(blocks) {
  const pages = [[]];
  let y = CONTENT_START_Y;
  const newPage = () => { pages.push([]); y = CONTENT_START_Y; };
  for (const item of blocks) {
    const keepCount = Math.min(item.keepLines, item.lines.length);
    const keepHeight = item.lines.slice(0, keepCount).reduce((total, line) => total + lineHeight(line), 0);
    if (pages.at(-1).length && y - keepHeight < RESOLUTION_CONTENT_BOUNDS.bottom) newPage();
    for (const line of item.lines) {
      const height = lineHeight(line);
      if (pages.at(-1).length && y - height < RESOLUTION_CONTENT_BOUNDS.bottom) newPage();
      pages.at(-1).push({ ...line, x: RESOLUTION_CONTENT_BOUNDS.left, y });
      y -= height;
    }
  }
  return pages;
}

function assertFinalized(details) {
  const resolution = details?.resolution;
  if (!resolution || !FINAL_RESOLUTION_STATUSES.includes(resolution.status)) throw new Error("Only finalized resolutions can be downloaded as PDF.");
  return resolution;
}

function assertRenderable(details, preview) {
  if (preview) {
    if (!details?.resolution) throw new Error("Resolution details are required for PDF preview.");
    return details.resolution;
  }
  return assertFinalized(details);
}

export function buildResolutionPdfPages(details, options = {}) {
  assertRenderable(details, options.preview === true);
  const layout = getResolutionRenderLayout(details, options.preview === true);
  if (layout.mode === "custom") return buildCustomResolutionPdfPages(details, layout.sections);
  return paginateBlocks(buildDocumentBlocks(details));
}

function fontResource(line) {
  if (line.mono) return "F3";
  const family = line.fontFamily || "Helvetica";
  if (family === "Times Roman") return line.bold && line.italic ? "F9" : line.bold ? "F7" : line.italic ? "F8" : "F6";
  if (family === "Courier") return line.bold && line.italic ? "F12" : line.bold ? "F10" : line.italic ? "F11" : "F3";
  return line.bold && line.italic ? "F5" : line.bold ? "F2" : line.italic ? "F4" : "F1";
}

function textCommand(line) {
  if (line.kind === "line") return `${line.x1.toFixed(1)} ${line.y1.toFixed(1)} m ${line.x2.toFixed(1)} ${line.y2.toFixed(1)} l S`;
  const font = fontResource(line);
  const text = `BT /${font} ${line.size} Tf ${line.x.toFixed(1)} ${line.y.toFixed(1)} Td (${pdfText(line.text)}) Tj ET`;
  if (!line.underline || !line.width) return text;
  return `${text}\n${line.x.toFixed(1)} ${(line.y - 1.5).toFixed(1)} m ${(line.x + line.width).toFixed(1)} ${(line.y - 1.5).toFixed(1)} l S`;
}

function ascii(value) {
  return encoder.encode(value);
}

function joinBytes(parts) {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  parts.forEach((part) => { output.set(part, offset); offset += part.length; });
  return output;
}

function imageObject(letterhead) {
  return joinBytes([
    ascii(`<< /Type /XObject /Subtype /Image /Width ${letterhead.width} /Height ${letterhead.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${letterhead.bytes.length} >>\nstream\n`),
    letterhead.bytes,
    ascii("\nendstream"),
  ]);
}

function streamObject(bytes) {
  return joinBytes([ascii(`<< /Length ${bytes.length} >>\nstream\n`), bytes, ascii("\nendstream")]);
}

function assemblePdf(objects) {
  const chunks = [ascii("%PDF-1.4\n%RCPH-BINARY\n")];
  const offsets = [0];
  let length = chunks[0].length;
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = length;
    const objectBytes = joinBytes([ascii(`${id} 0 obj\n`), objects[id], ascii("\nendobj\n")]);
    chunks.push(objectBytes);
    length += objectBytes.length;
  }
  const xrefOffset = length;
  let xref = `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  xref += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  chunks.push(ascii(xref));
  return joinBytes(chunks);
}

export function buildResolutionPdfDocument(details, letterhead, options = {}) {
  assertRenderable(details, options.preview === true);
  if (!(letterhead?.bytes instanceof Uint8Array) || !letterhead.bytes.length || !Number.isInteger(letterhead.width) || !Number.isInteger(letterhead.height)) {
    throw new TypeError("A valid Resolution letterhead JPEG is required.");
  }
  const pages = buildResolutionPdfPages(details, options);
  const customMode = getResolutionRenderLayout(details, options.preview === true).mode === "custom";
  const objects = [];
  const imageId = 6;
  const pageIds = pages.map((_, index) => 7 + index * 2);
  const extraFontStart = 7 + pages.length * 2;
  const extraFonts = customMode ? [
    ["F4", "Helvetica-Oblique"], ["F5", "Helvetica-BoldOblique"],
    ["F6", "Times-Roman"], ["F7", "Times-Bold"], ["F8", "Times-Italic"], ["F9", "Times-BoldItalic"],
    ["F10", "Courier-Bold"], ["F11", "Courier-Oblique"], ["F12", "Courier-BoldOblique"],
  ] : [];
  const extraFontResources = extraFonts.map(([name], index) => `/${name} ${extraFontStart + index} 0 R`).join(" ");
  const fontResources = `/F1 3 0 R /F2 4 0 R /F3 5 0 R${extraFontResources ? ` ${extraFontResources}` : ""}`;
  objects[1] = ascii("<< /Type /Catalog /Pages 2 0 R >>");
  objects[2] = ascii(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  objects[3] = ascii("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects[4] = ascii("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  objects[5] = ascii("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>");
  objects[imageId] = imageObject(letterhead);
  extraFonts.forEach(([, baseFont], index) => { objects[extraFontStart + index] = ascii(`<< /Type /Font /Subtype /Type1 /BaseFont /${baseFont} >>`); });
  pages.forEach((page, index) => {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    const commands = [
      `q\n${RESOLUTION_PDF_PAGE.width} 0 0 ${RESOLUTION_PDF_PAGE.height} 0 0 cm\n/BG Do\nQ`,
      ...(options.preview === true ? [`BT /F2 8 Tf ${RESOLUTION_CONTENT_BOUNDS.left} ${RESOLUTION_PAGE_NUMBER_POSITION.y} Td (DRAFT PREVIEW) Tj ET`] : []),
      `BT /F1 8 Tf ${RESOLUTION_PAGE_NUMBER_POSITION.x} ${RESOLUTION_PAGE_NUMBER_POSITION.y} Td (Page ${index + 1} of ${pages.length}) Tj ET`,
      ...page.map(textCommand),
    ];
    const content = ascii(commands.join("\n"));
    objects[pageId] = ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${RESOLUTION_PDF_PAGE.width} ${RESOLUTION_PDF_PAGE.height}] /Resources << /Font << ${fontResources} >> /XObject << /BG ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects[contentId] = streamObject(content);
  });
  return assemblePdf(objects);
}

export async function generateResolutionPdf(details, options = {}) {
  const resolution = assertFinalized(details);
  const loadLetterhead = options.loadLetterhead || getResolutionLetterheadJpeg;
  const letterhead = await loadLetterhead();
  const pdf = buildResolutionPdfDocument(details, letterhead);
  const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = getResolutionPdfFilename(resolution.resolutionNumber);
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function generateResolutionPreviewPdf(details, options = {}) {
  const resolution = assertRenderable(details, true);
  const loadLetterhead = options.loadLetterhead || getResolutionLetterheadJpeg;
  const letterhead = await loadLetterhead();
  const pdf = buildResolutionPdfDocument(details, letterhead, { preview: true });
  const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = getResolutionPdfFilename(resolution.resolutionNumber).replace(/\.pdf$/i, "-DRAFT-PREVIEW.pdf");
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
