'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { formatRotaractorName } = require('./member-name');
const { normalizeGeneratedPageOrder, normalizeResolutionPageConfig } = require('./resolution-sections');

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

function wrapMultilineText(value, font, size, width) {
  return String(value ?? '').replace(/\r\n/g, '\n').split('\n').flatMap(line => wrapText(line, font, size, width));
}

async function embedResolutionFonts(document) {
  return {
    Helvetica: await document.embedFont(StandardFonts.Helvetica),
    HelveticaBold: await document.embedFont(StandardFonts.HelveticaBold),
    HelveticaOblique: await document.embedFont(StandardFonts.HelveticaOblique),
    HelveticaBoldOblique: await document.embedFont(StandardFonts.HelveticaBoldOblique),
    TimesRoman: await document.embedFont(StandardFonts.TimesRoman),
    TimesRomanBold: await document.embedFont(StandardFonts.TimesRomanBold),
    TimesRomanItalic: await document.embedFont(StandardFonts.TimesRomanItalic),
    TimesRomanBoldItalic: await document.embedFont(StandardFonts.TimesRomanBoldItalic),
    Courier: await document.embedFont(StandardFonts.Courier),
    CourierBold: await document.embedFont(StandardFonts.CourierBold),
    CourierOblique: await document.embedFont(StandardFonts.CourierOblique),
    CourierBoldOblique: await document.embedFont(StandardFonts.CourierBoldOblique),
  };
}

function pickResolutionFont(fonts, style = {}) {
  const family = style.fontFamily || 'Helvetica';
  const bold = style.bold === true || style.headerBold === true || style.boldHeader === true;
  const italic = style.italic === true;
  if (family === 'Times Roman') return bold && italic ? fonts.TimesRomanBoldItalic : bold ? fonts.TimesRomanBold : italic ? fonts.TimesRomanItalic : fonts.TimesRoman;
  if (family === 'Courier') return bold && italic ? fonts.CourierBoldOblique : bold ? fonts.CourierBold : italic ? fonts.CourierOblique : fonts.Courier;
  return bold && italic ? fonts.HelveticaBoldOblique : bold ? fonts.HelveticaBold : italic ? fonts.HelveticaOblique : fonts.Helvetica;
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
  return pages.length;
}

async function buildResolutionPageAppendix(document, details, letterheadBytes) {
  const config = normalizeResolutionPageConfig(details.resolutionPageConfig, details);
  if (!config.enabled) return 0;
  const fonts = await embedResolutionFonts(document);
  const background = await document.embedPng(letterheadBytes);
  const pages = [];
  let page;
  let y;

  function addPage() {
    page = document.addPage([PAGE.width, PAGE.height]);
    page.drawImage(background, { x: 0, y: 0, width: PAGE.width, height: PAGE.height });
    pages.push(page);
    y = BOUNDS.top;
  }

  function ensure(height) {
    if (!page) addPage();
    if (y - height < BOUNDS.bottom && y < BOUNDS.top) addPage();
  }

  function alignedX(line, font, size, style, width = BOUNDS.right - BOUNDS.left, left = BOUNDS.left) {
    const measured = Math.min(width, font.widthOfTextAtSize(safePdfText(line), size));
    if (style.alignment === 'center') return left + ((width - measured) / 2);
    if (style.alignment === 'right') return left + width - measured;
    return left;
  }

  function drawTextBlock(value, style) {
    const font = pickResolutionFont(fonts, style);
    const size = Number(style.fontSize) || 10;
    const lineSpacing = Number(style.lineSpacing) || 1.25;
    const lineHeight = size * lineSpacing;
    const lines = wrapMultilineText(value, font, size, BOUNDS.right - BOUNDS.left);
    if (style.spaceBefore) {
      ensure(style.spaceBefore);
      y -= style.spaceBefore;
    }
    for (const line of lines) {
      ensure(lineHeight);
      const x = alignedX(line, font, size, style);
      page.drawText(safePdfText(line), { x, y, size, font, color: rgb(0, 0, 0) });
      if (style.underline) {
        const width = font.widthOfTextAtSize(safePdfText(line), size);
        page.drawLine({ start: { x, y: y - 2 }, end: { x: x + width, y: y - 2 }, thickness: 0.5, color: rgb(0, 0, 0) });
      }
      y -= lineHeight;
    }
    if (style.spaceAfter) {
      ensure(style.spaceAfter);
      y -= style.spaceAfter;
    }
  }

  function drawTable(block) {
    if (block.title) drawTextBlock(block.title, { fontFamily: block.style.headerFontFamily || block.style.fontFamily, fontSize: Math.max(10, block.style.headerFontSize || block.style.fontSize), bold: true, alignment: 'left', lineSpacing: 1.2, spaceBefore: block.style.spaceBefore, spaceAfter: 5 });
    else if (block.style.spaceBefore) y -= block.style.spaceBefore;
    const widths = block.columns.map(column => ((BOUNDS.right - BOUNDS.left) * (Number(column.widthPercent) || 1)) / 100);
    const total = widths.reduce((sum, width) => sum + width, 0) || 1;
    const normalizedWidths = widths.map(width => ((BOUNDS.right - BOUNDS.left) * width) / total);
    const bodyFont = pickResolutionFont(fonts, block.style);
    const headerFont = pickResolutionFont(fonts, { fontFamily: block.style.headerFontFamily || block.style.fontFamily, bold: block.style.boldHeader !== false });

    function rowModel(row, rowIndex) {
      const header = rowIndex === 0 && block.options.hasHeaderRow !== false;
      const font = header ? headerFont : bodyFont;
      const size = header ? Number(block.style.headerFontSize || block.style.fontSize) : Number(block.style.fontSize || 9);
      const spacing = block.options.compactRows ? 1.05 : 1.2;
      const cells = block.columns.map((column, columnIndex) => {
        const textValue = row?.cells?.[column.id] || column.label || '';
        return { alignment: column.alignment || block.style.alignment || 'left', width: normalizedWidths[columnIndex], lines: wrapMultilineText(textValue, font, size, normalizedWidths[columnIndex] - (block.style.cellPadding * 2)) };
      });
      const lineCount = Math.max(1, ...cells.map(cell => cell.lines.length));
      return { cells, font, size, spacing, height: Math.max(18, lineCount * size * spacing + block.style.cellPadding * 2), header };
    }

    function drawRow(model) {
      ensure(model.height);
      const top = y;
      const bottom = top - model.height;
      let x = BOUNDS.left;
      if (block.options.showBorders !== false) page.drawRectangle({ x, y: bottom, width: BOUNDS.right - BOUNDS.left, height: model.height, borderColor: rgb(0.3, 0.3, 0.3), borderWidth: 0.5 });
      model.cells.forEach((cell, index) => {
        if (index > 0 && block.options.showBorders !== false) page.drawLine({ start: { x, y: top }, end: { x, y: bottom }, thickness: 0.5, color: rgb(0.3, 0.3, 0.3) });
        cell.lines.forEach((line, lineIndex) => {
          const textWidth = model.font.widthOfTextAtSize(safePdfText(line), model.size);
          const textX = cell.alignment === 'right' ? x + cell.width - block.style.cellPadding - textWidth : cell.alignment === 'center' ? x + (cell.width - textWidth) / 2 : x + block.style.cellPadding;
          page.drawText(safePdfText(line), { x: textX, y: top - block.style.cellPadding - model.size - (lineIndex * model.size * model.spacing), size: model.size, font: model.font, color: rgb(0, 0, 0) });
        });
        x += cell.width;
      });
      y = bottom;
    }

    const models = block.rows.map(rowModel);
    const header = block.options.hasHeaderRow !== false ? models[0] : null;
    models.forEach((model, index) => {
      if (page && y - model.height < BOUNDS.bottom) {
        addPage();
        if (header && block.options.repeatHeader && index !== 0) drawRow(header);
      }
      drawRow(model);
    });
    if (block.style.spaceAfter) y -= block.style.spaceAfter;
  }

  addPage();
  drawTextBlock(config.heading.text, config.heading);
  drawTextBlock([
    `Subject: ${config.details.subject || ''}`,
    `Date: ${config.details.date || ''}`,
    `Place: ${config.details.place || ''}`,
    `No. of Board Members: ${config.details.boardMembersPresent || ''}`,
    `Total No. of Board Members: ${config.details.totalBoardMembers || ''}`,
  ].join('\n'), config.detailsStyle);
  drawTextBlock(config.mainStatement.text, config.mainStatement);
  config.blocks.forEach(block => {
    if (block.type === 'paragraph') drawTextBlock(block.text, block.style);
    else if (block.type === 'table') drawTable(block);
  });
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
  let appendixPageCount = 0;
  let resolutionPageCount = 0;
  let voteTablePageCount = 0;
  const pageOrder = normalizeGeneratedPageOrder(details.generatedPageOrder);
  for (const type of pageOrder) {
    if (type === 'resolution_page') {
      const count = await buildResolutionPageAppendix(output, details, letterheadBytes);
      resolutionPageCount += count;
      appendixPageCount += count;
    }
    if (type === 'vote_table' && details.appendVoteTable !== false) {
      const count = await buildVoteAppendix(output, details, letterheadBytes);
      voteTablePageCount += count;
      appendixPageCount += count;
    }
  }
  const bytes = Buffer.from(await output.save({ useObjectStreams: false, addDefaultPage: false, updateFieldAppearances: false }));
  return {
    bytes,
    sha256: sha256(bytes),
    sourcePageCount: inspected.pageCount,
    appendixPageCount,
    resolutionPageCount,
    voteTablePageCount,
    pageCount: inspected.pageCount + appendixPageCount,
  };
}

function loadLetterheadBytes(assetPath = path.join(__dirname, '..', 'assets', 'RCPH_BOD_Avenue_Report_Letterhead_A4.png')) {
  return fs.readFileSync(assetPath);
}

module.exports = {
  BOUNDS,
  COLUMN_KEYS,
  MAX_SOURCE_BYTES,
  MAX_SOURCE_PAGES,
  PAGE,
  buildResolutionPageAppendix,
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
