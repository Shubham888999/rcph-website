'use strict';

const MODES = Object.freeze(['standard', 'custom']);
const TYPES = Object.freeze(['heading', 'paragraph', 'table', 'votesTable', 'spacer']);
const FONTS = Object.freeze(['Helvetica', 'Times Roman', 'Courier']);
const ALIGNMENTS = Object.freeze(['left', 'center', 'right']);
const VOTE_COLUMNS = Object.freeze(['name', 'position', 'vote', 'timestamp', 'signature']);
const LIMITS = Object.freeze({ sections: 100, characters: 50000, rows: 200, columns: 20 });

function text(value, max = 50000) {
  return typeof value === 'string' ? value.trim().replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, max) : '';
}

function number(value, fallback, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function choice(value, values, fallback) {
  return values.includes(value) ? value : fallback;
}

function id(value, fallback) {
  return text(value, 100).replace(/[^a-zA-Z0-9_-]/g, '') || fallback;
}

function style(raw = {}, heading = false) {
  return {
    fontFamily: choice(raw.fontFamily, FONTS, 'Helvetica'),
    fontSize: number(raw.fontSize, heading ? 14 : 10, 8, 20),
    bold: typeof raw.bold === 'boolean' ? raw.bold : heading,
    italic: raw.italic === true,
    underline: raw.underline === true,
    alignment: choice(raw.alignment, ALIGNMENTS, heading ? 'center' : 'left'),
    lineSpacing: number(raw.lineSpacing, heading ? 1.2 : 1.25, 1, 2),
    spaceBefore: number(raw.spaceBefore, 0, 0, 72),
    spaceAfter: number(raw.spaceAfter, heading ? 10 : 8, 0, 72),
  };
}

function widths(values, count) {
  const source = Array.from({ length: count }, (_, index) => number(values?.[index], 100 / count, 1, 100));
  const total = source.reduce((sum, value) => sum + value, 0) || 1;
  return source.map(value => Number(((value / total) * 100).toFixed(4)));
}

function legacyRowValues(row) {
  if (Array.isArray(row)) return row;
  if (Array.isArray(row?.cells)) return row.cells.map(cell => typeof cell === 'object' ? cell?.value ?? cell?.text : cell);
  return null;
}

function cellValue(row, column, index) {
  const legacy = legacyRowValues(row);
  if (legacy) return legacy[index];
  if (row?.cells && typeof row.cells === 'object') return row.cells[column.id];
  return '';
}

function normalizeSection(raw, fallbackId) {
  if (!raw || typeof raw !== 'object' || !TYPES.includes(raw.type)) return null;
  const sectionId = id(raw.id, fallbackId);
  if (raw.type === 'heading') return { id: sectionId, type: raw.type, text: text(raw.text), style: style(raw.style, true) };
  if (raw.type === 'paragraph') return { id: sectionId, type: raw.type, text: text(raw.text), listStyle: choice(raw.listStyle, ['none', 'bullet', 'numbered'], 'none'), style: style(raw.style) };
  if (raw.type === 'spacer') return { id: sectionId, type: raw.type, mode: choice(raw.mode, ['small', 'medium', 'large', 'pageBreak'], 'medium') };
  if (raw.type === 'votesTable') {
    const columns = Object.fromEntries(VOTE_COLUMNS.map(key => [key, typeof raw.columns?.[key] === 'boolean' ? raw.columns[key] : key !== 'signature']));
    if (!VOTE_COLUMNS.some(key => columns[key])) columns.name = true;
    return {
      id: sectionId,
      type: raw.type,
      title: text(raw.title, 200) || 'Voting Record',
      columns,
      options: {
        showTitle: raw.options?.showTitle !== false,
        repeatHeader: raw.options?.repeatHeader !== false,
        voterScope: choice(raw.options?.voterScope, ['submitted', 'all'], 'submitted'),
        showResultSummary: raw.options?.showResultSummary === true,
      },
      style: {
        fontFamily: choice(raw.style?.fontFamily, FONTS, 'Helvetica'),
        fontSize: number(raw.style?.fontSize, 9, 8, 20),
        headerFontSize: number(raw.style?.headerFontSize, 9, 8, 20),
        headerBold: raw.style?.headerBold !== false,
        cellPadding: number(raw.style?.cellPadding, 4, 1, 12),
        spaceBefore: number(raw.style?.spaceBefore, 10, 0, 72),
        spaceAfter: number(raw.style?.spaceAfter, 10, 0, 72),
      },
    };
  }
  const rawRows = Array.isArray(raw.rows) ? raw.rows.slice(0, LIMITS.rows) : [];
  const count = Math.max(1, Math.min(LIMITS.columns, Array.isArray(raw.columns) ? raw.columns.length : Math.max(0, ...rawRows.map(row => legacyRowValues(row)?.length || 0))));
  const normalizedWidths = widths((raw.columns || []).map(column => column?.widthPercent ?? column?.width), count);
  const columns = Array.from({ length: count }, (_, index) => ({
    id: id(raw.columns?.[index]?.id, `column_${index + 1}`),
    label: text(raw.columns?.[index]?.label, 200),
    widthPercent: normalizedWidths[index],
    alignment: choice(raw.columns?.[index]?.alignment, ALIGNMENTS, 'left'),
  }));
  const sourceRows = rawRows.length ? rawRows : [{ id: 'row_1', cells: {} }];
  return {
    id: sectionId,
    type: raw.type,
    columns,
    rows: sourceRows.map((row, rowIndex) => ({
      id: id(row?.id, `row_${rowIndex + 1}`),
      cells: Object.fromEntries(columns.map((column, columnIndex) => [column.id, text(cellValue(row, column, columnIndex), 5000)])),
    })),
    options: { hasHeaderRow: raw.options?.hasHeaderRow !== false, repeatHeader: raw.options?.repeatHeader !== false, showBorders: raw.options?.showBorders !== false },
    style: {
      fontFamily: choice(raw.style?.fontFamily, FONTS, 'Helvetica'),
      fontSize: number(raw.style?.fontSize, 9, 8, 20),
      boldHeader: raw.style?.boldHeader !== false,
      cellPadding: number(raw.style?.cellPadding, 4, 1, 12),
      spaceBefore: number(raw.style?.spaceBefore, 8, 0, 72),
      spaceAfter: number(raw.style?.spaceAfter, 8, 0, 72),
    },
  };
}

function normalizeSections(raw) {
  const seen = new Set();
  return (Array.isArray(raw) ? raw : []).slice(0, LIMITS.sections).map((section, index) => normalizeSection(section, `section_${index + 1}`)).filter(Boolean).map(section => {
    let sectionId = section.id;
    let suffix = 2;
    while (seen.has(sectionId)) sectionId = `${section.id}_${suffix++}`;
    seen.add(sectionId);
    return { ...section, id: sectionId };
  });
}

function textCharacterCount(sections) {
  return sections.reduce((total, section) => {
    let count = typeof section?.text === 'string' ? section.text.length : 0;
    if (typeof section?.title === 'string') count += section.title.length;
    if (Array.isArray(section?.rows)) count += section.rows.reduce((rowTotal, row) => {
      const values = legacyRowValues(row) || (row?.cells && typeof row.cells === 'object' ? Object.values(row.cells) : []);
      return rowTotal + values.reduce((sum, cell) => sum + (typeof cell === 'string' ? cell.length : 0), 0);
    }, 0);
    return total + count;
  }, 0);
}

function validateLayout(raw = {}) {
  const requestedMode = raw.pdfLayoutMode == null || raw.pdfLayoutMode === '' ? 'standard' : text(raw.pdfLayoutMode, 20).toLowerCase();
  const source = Array.isArray(raw.pdfSections) ? raw.pdfSections : [];
  const errors = [];
  if (!MODES.includes(requestedMode)) errors.push('A valid PDF layout mode is required.');
  if (source.length > LIMITS.sections) errors.push(`A custom layout may contain at most ${LIMITS.sections} sections.`);
  if (textCharacterCount(source) > LIMITS.characters) errors.push(`Custom layout text may contain at most ${LIMITS.characters} characters.`);
  const seen = new Set();
  source.forEach((section, index) => {
    if (!TYPES.includes(section?.type)) errors.push(`Section ${index + 1} has an unsupported type.`);
    const sectionId = id(section?.id, '');
    if (!sectionId || seen.has(sectionId)) errors.push(`Section ${index + 1} must have a unique ID.`);
    seen.add(sectionId);
    if (['heading', 'paragraph'].includes(section?.type)) {
      if (!FONTS.includes(section?.style?.fontFamily)) errors.push(`Section ${index + 1} has an invalid font.`);
      if (!Number.isFinite(Number(section?.style?.fontSize)) || Number(section.style.fontSize) < 8 || Number(section.style.fontSize) > 20) errors.push(`Section ${index + 1} has an invalid font size.`);
      if (!ALIGNMENTS.includes(section?.style?.alignment)) errors.push(`Section ${index + 1} has an invalid alignment.`);
    }
    if (section?.type === 'table') {
      if (!Array.isArray(section.columns) || section.columns.length < 1 || section.columns.length > LIMITS.columns) errors.push(`Section ${index + 1} has invalid table columns.`);
      if (!Array.isArray(section.rows) || section.rows.length < 1 || section.rows.length > LIMITS.rows) errors.push(`Section ${index + 1} has invalid table rows.`);
    }
    if (section?.type === 'votesTable' && !VOTE_COLUMNS.some(key => section.columns?.[key] === true)) errors.push(`Section ${index + 1} must include a Votes Table column.`);
  });
  const pdfSections = normalizeSections(source);
  try { assertNoNestedArrays(pdfSections, 'pdfSections'); }
  catch (error) { errors.push(error.message); }
  return { ok: errors.length === 0, errors, payload: { pdfLayoutMode: MODES.includes(requestedMode) ? requestedMode : 'standard', pdfSections } };
}

function assertNoNestedArrays(value, path = 'value') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      if (Array.isArray(item)) throw new TypeError(`${path}[${index}] contains an array directly nested inside an array.`);
      assertNoNestedArrays(item, `${path}[${index}]`);
    });
    return true;
  }
  if (value && typeof value === 'object') Object.entries(value).forEach(([key, item]) => assertNoNestedArrays(item, `${path}.${key}`));
  return true;
}

module.exports = { LIMITS, MODES, TYPES, VOTE_COLUMNS, assertNoNestedArrays, normalizeSections, validateLayout };
