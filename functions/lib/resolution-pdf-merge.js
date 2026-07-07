'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { formatRotaractorName } = require('./member-name');

const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const MAX_SOURCE_PAGES = 25;
const PAGE = Object.freeze({ width: 595, height: 842 });
const BOUNDS = Object.freeze({ left: 54, right: 541, bottom: 260, top: 665 });
const COLUMN_KEYS = Object.freeze(['name', 'position', 'vote', 'timestamp', 'signature']);
const COLUMN_LABELS = Object.freeze({ name: 'Name', position: 'Position', vote: 'Vote', timestamp: 'Timestamp', signature: 'Signature' });

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function frozenMetadataDate(value) {
  const date = typeof value?.toDate === 'function' ? value.toDate() : value;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new TypeError('A frozen finalization timestamp is required for deterministic PDF metadata.');
  return date;
}

function safePdfText(value) {
  return String(value ?? '')
    .replace(/\u20b9/g, 'Rs. ')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^\x20-\x7e\u00a0-\u00ff]/g, '?')
    .trim();
}

function normalizeVotesTableConfig(raw = {}) {
  const columns = Object.fromEntries(COLUMN_KEYS.map(key => [key, raw.columns?.[key] === true]));
  if (!COLUMN_KEYS.some(key => columns[key])) columns.name = true;
  return {
    columns,
    voterScope: raw.voterScope === 'all' ? 'all' : 'submitted',
    showTitle: raw.showTitle !== false,
    repeatHeader: raw.repeatHeader !== false,
    showResultSummary: raw.showResultSummary !== false,
  };
}

function validateSourceFileMetadata(file = {}) {
  const name = String(file.originalFileName || file.fileName || '').trim();
  const mimeType = String(file.mimeType || '').trim().toLowerCase();
  const sizeBytes = Number(file.sizeBytes);
  if (!name || !/\.pdf$/i.test(name)) throw Object.assign(new Error('A PDF filename is required.'), { code: 'invalid-file-type' });
  if (mimeType !== 'application/pdf') throw Object.assign(new Error('Only PDF files are accepted.'), { code: 'invalid-file-type' });
  if (!Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_SOURCE_BYTES) throw Object.assign(new Error('The PDF exceeds the 10 MB limit.'), { code: 'file-too-large' });
  return { originalFileName: name.slice(0, 180), mimeType, sizeBytes };
}

async function inspectSourcePdf(bytes) {
  const buffer = Buffer.from(bytes || []);
  if (!buffer.length || buffer.length > MAX_SOURCE_BYTES) throw Object.assign(new Error('The PDF exceeds the 10 MB limit.'), { code: 'file-too-large' });
  if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-') throw Object.assign(new Error('The file is not a valid PDF.'), { code: 'invalid-pdf-signature' });
  if (buffer.includes(Buffer.from('/Encrypt'))) throw Object.assign(new Error('Encrypted PDFs are not supported.'), { code: 'encrypted-pdf' });
  let document;
  try {
    document = await PDFDocument.load(buffer, { ignoreEncryption: false, updateMetadata: false });
  } catch (error) {
    const encrypted = /encrypt/i.test(String(error?.name || error?.message || ''));
    throw Object.assign(new Error(encrypted ? 'Encrypted PDFs are not supported.' : 'The PDF is malformed or unsupported.'), { code: encrypted ? 'encrypted-pdf' : 'malformed-pdf' });
  }
  let pageCount;
  try { pageCount = document.getPageCount(); }
  catch {
    const malformed = buffer.length < 100;
    throw Object.assign(new Error(malformed ? 'The PDF is malformed or unsupported.' : 'The PDF contains no readable pages.'), { code: malformed ? 'malformed-pdf' : 'zero-page-pdf' });
  }
  if (pageCount < 1) throw Object.assign(new Error('The PDF contains no pages.'), { code: 'zero-page-pdf' });
  if (pageCount > MAX_SOURCE_PAGES) throw Object.assign(new Error('The PDF exceeds the 25-page limit.'), { code: 'too-many-pages' });
  return { pageCount, sha256: sha256(buffer), document };
}

function wrapText(value, font, size, width) {
  const words = safePdfText(value).split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width || !line) line = candidate;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

function formatTimestamp(value) {
  if (!value) return '';
  const date = typeof value?.toDate === 'function' ? value.toDate() : value;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(date);
}

function displayVote(value) {
  if (value === 'approve') return 'Approve';
  if (value === 'reject') return 'Reject';
  if (value === 'abstain') return 'Abstain';
  return 'Did not vote';
}

function selectedColumns(config) {
  const columns = COLUMN_KEYS.filter(key => config.columns[key] && key !== 'signature');
  if (config.columns.signature) columns.push('signature');
  return columns;
}

function columnWidths(columns) {
  const weights = { name: 1.4, position: 1.25, vote: 0.72, timestamp: 1.15, signature: 1.35 };
  const total = columns.reduce((sum, key) => sum + weights[key], 0);
  return columns.map(key => ((BOUNDS.right - BOUNDS.left) * weights[key]) / total);
}

async function buildVoteAppendix(document, details, letterheadBytes) {
  const config = normalizeVotesTableConfig(details.config);
  const rows = Array.isArray(details.rows) ? details.rows : [];
  const font = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const background = await document.embedPng(letterheadBytes);
  const columns = selectedColumns(config);
  const widths = columnWidths(columns);
  const pages = [];
  let page;
  let y;

  function addPage() {
    page = document.addPage([PAGE.width, PAGE.height]);
    page.drawImage(background, { x: 0, y: 0, width: PAGE.width, height: PAGE.height });
    pages.push(page);
    y = BOUNDS.top;
    if (config.showTitle) {
      page.drawText('RESOLUTION VOTING RECORD', { x: BOUNDS.left, y, size: 14, font: bold, color: rgb(0, 0, 0) });
      y -= 22;
    }
    page.drawText(`Resolution: ${safePdfText(details.resolutionNumber)}`, { x: BOUNDS.left, y, size: 9, font: bold });
    y -= 14;
    for (const line of wrapText(details.title, font, 9, BOUNDS.right - BOUNDS.left - 35)) {
      page.drawText(line, { x: BOUNDS.left, y, size: 9, font });
      y -= 12;
    }
    if (config.showResultSummary) {
      const summary = `Result: ${safePdfText(details.resultLabel)} | Approve: ${Number(details.approveCount) || 0} | Reject: ${Number(details.rejectCount) || 0} | Abstain: ${Number(details.abstainCount) || 0}`;
      page.drawText(summary, { x: BOUNDS.left, y, size: 8.5, font: bold });
      y -= 16;
    }
  }

  function drawHeader() {
    const height = 22;
    let x = BOUNDS.left;
    page.drawRectangle({ x, y: y - height, width: BOUNDS.right - BOUNDS.left, height, color: rgb(0.9, 0.92, 0.95), borderColor: rgb(0.2, 0.2, 0.2), borderWidth: 0.6 });
    columns.forEach((key, index) => {
      page.drawText(COLUMN_LABELS[key], { x: x + 4, y: y - 14, size: 8, font: bold });
      x += widths[index];
      if (index < columns.length - 1) page.drawLine({ start: { x, y }, end: { x, y: y - height }, thickness: 0.5, color: rgb(0.25, 0.25, 0.25) });
    });
    y -= height;
  }

  function rowValues(row) {
    return { name: formatRotaractorName(row.name, true), position: row.position || 'Not available', vote: displayVote(row.vote), timestamp: formatTimestamp(row.submittedAt), signature: '' };
  }

  addPage();
  drawHeader();
  for (const row of rows) {
    const values = rowValues(row);
    const wrapped = columns.map((key, index) => wrapText(values[key], font, 8, widths[index] - 8));
    const rowHeight = Math.max(config.columns.signature ? 30 : 0, 20, ...wrapped.map(lines => lines.length * 10 + 8));
    if (y - rowHeight < BOUNDS.bottom) {
      addPage();
      if (config.repeatHeader) drawHeader();
    }
    let x = BOUNDS.left;
    page.drawRectangle({ x, y: y - rowHeight, width: BOUNDS.right - BOUNDS.left, height: rowHeight, borderColor: rgb(0.3, 0.3, 0.3), borderWidth: 0.5 });
    wrapped.forEach((lines, index) => {
      lines.forEach((line, lineIndex) => page.drawText(line, { x: x + 4, y: y - 12 - (lineIndex * 10), size: 8, font }));
      x += widths[index];
      if (index < columns.length - 1) page.drawLine({ start: { x, y }, end: { x, y: y - rowHeight }, thickness: 0.5, color: rgb(0.3, 0.3, 0.3) });
    });
    y -= rowHeight;
  }
  if (!rows.length) {
    page.drawText('No voting records were submitted.', { x: BOUNDS.left + 4, y: y - 16, size: 8, font });
    y -= 24;
  }
  pages.forEach((appendixPage, index) => appendixPage.drawText(`Appendix page ${index + 1} of ${pages.length}`, { x: 448, y: 686, size: 8, font }));
  return pages.length;
}

async function mergeResolutionPdf({ sourceBytes, letterheadBytes, details }) {
  const inspected = await inspectSourcePdf(sourceBytes);
  const output = await PDFDocument.create();
  const metadataDate = frozenMetadataDate(details.metadataTimestamp);
  const resolutionNumber = safePdfText(details.resolutionNumber) || 'RCPH Resolution';
  const title = safePdfText(details.title) || 'Resolution';
  output.setCreationDate(metadataDate);
  output.setModificationDate(metadataDate);
  output.setProducer('RCPH Resolution System');
  output.setCreator('RCPH Resolution System');
  output.setTitle(`${resolutionNumber} - Final`);
  output.setSubject(`Finalized RCPH Resolution voting record: ${title}`);
  const copiedPages = await output.copyPages(inspected.document, inspected.document.getPageIndices());
  copiedPages.forEach(page => output.addPage(page));
  const appendixPageCount = await buildVoteAppendix(output, details, letterheadBytes);
  const bytes = Buffer.from(await output.save({ useObjectStreams: false, addDefaultPage: false, updateFieldAppearances: false }));
  return {
    bytes,
    sha256: sha256(bytes),
    sourcePageCount: inspected.pageCount,
    appendixPageCount,
    pageCount: inspected.pageCount + appendixPageCount,
  };
}

function loadLetterheadBytes(assetPath = path.join(__dirname, '..', 'assets', 'resolution_letterhead.png')) {
  return fs.readFileSync(assetPath);
}

module.exports = {
  BOUNDS,
  COLUMN_KEYS,
  MAX_SOURCE_BYTES,
  MAX_SOURCE_PAGES,
  PAGE,
  buildVoteAppendix,
  frozenMetadataDate,
  inspectSourcePdf,
  loadLetterheadBytes,
  mergeResolutionPdf,
  normalizeVotesTableConfig,
  safePdfText,
  sha256,
  validateSourceFileMetadata,
};
