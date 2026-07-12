'use strict';

const MODES = Object.freeze(['standard', 'custom']);
const SOURCE_MODES = Object.freeze(['standard', 'custom', 'uploadedPdf']);
const TYPES = Object.freeze(['heading', 'paragraph', 'table', 'votesTable', 'spacer']);
const FONTS = Object.freeze(['Helvetica', 'Times Roman', 'Courier']);
const ALIGNMENTS = Object.freeze(['left', 'center', 'right']);
const VOTE_COLUMNS = Object.freeze(['name', 'position', 'vote', 'timestamp', 'signature']);
const LIMITS = Object.freeze({ sections: 100, characters: 50000, rows: 200, columns: 20 });
const RESOLUTION_PAGE_LIMITS = Object.freeze({ blocks: 20, paragraphCharacters: 10000, rows: 100, columns: 10, cellCharacters: 2000 });
const GENERATED_PAGE_TYPES = Object.freeze(['resolution_page', 'vote_table']);
const DEFAULT_GENERATED_PAGE_ORDER = Object.freeze(['resolution_page', 'vote_table']);
const DEFAULT_RESOLUTION_STATEMENT = 'This is to resolve that we, the Board Members of Rotaract Club of Pune Heritage, for the scheduled Board Meeting, have considered and passed the resolution stated below in accordance with the applicable voting requirements and the records maintained by the Club.';

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

function pageStyle(raw = {}, defaults = {}) {
  return {
    fontFamily: choice(raw.fontFamily, FONTS, defaults.fontFamily || 'Helvetica'),
    fontSize: number(raw.fontSize, defaults.fontSize || 10, 8, 20),
    bold: typeof raw.bold === 'boolean' ? raw.bold : defaults.bold === true,
    italic: typeof raw.italic === 'boolean' ? raw.italic : defaults.italic === true,
    underline: typeof raw.underline === 'boolean' ? raw.underline : defaults.underline === true,
    alignment: choice(raw.alignment, ALIGNMENTS, defaults.alignment || 'left'),
    lineSpacing: number(raw.lineSpacing, defaults.lineSpacing || 1.25, 1, 2),
    spaceBefore: number(raw.spaceBefore, defaults.spaceBefore || 0, 0, 72),
    spaceAfter: number(raw.spaceAfter, defaults.spaceAfter ?? 8, 0, 72),
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

function normalizeResolutionPageTable(raw, sectionId) {
  const rawRows = Array.isArray(raw.rows) ? raw.rows.slice(0, RESOLUTION_PAGE_LIMITS.rows) : [];
  const count = Math.max(1, Math.min(RESOLUTION_PAGE_LIMITS.columns, Array.isArray(raw.columns) ? raw.columns.length : Math.max(0, ...rawRows.map(row => legacyRowValues(row)?.length || 0))));
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
    type: 'table',
    title: text(raw.title, 200),
    columns,
    rows: sourceRows.map((row, rowIndex) => ({
      id: id(row?.id, `row_${rowIndex + 1}`),
      cells: Object.fromEntries(columns.map((column, columnIndex) => [column.id, text(cellValue(row, column, columnIndex), RESOLUTION_PAGE_LIMITS.cellCharacters)])),
    })),
    options: {
      hasHeaderRow: raw.options?.hasHeaderRow !== false,
      repeatHeader: raw.options?.repeatHeader !== false,
      showBorders: raw.options?.showBorders !== false,
      compactRows: raw.options?.compactRows === true,
    },
    style: {
      fontFamily: choice(raw.style?.fontFamily, FONTS, 'Helvetica'),
      fontSize: number(raw.style?.fontSize, 9, 8, 20),
      headerFontFamily: choice(raw.style?.headerFontFamily, FONTS, raw.style?.fontFamily || 'Helvetica'),
      headerFontSize: number(raw.style?.headerFontSize, 9, 8, 20),
      boldHeader: raw.style?.boldHeader !== false,
      alignment: choice(raw.style?.alignment, ALIGNMENTS, 'left'),
      cellPadding: number(raw.style?.cellPadding, 4, 1, 12),
      spaceBefore: number(raw.style?.spaceBefore, 8, 0, 72),
      spaceAfter: number(raw.style?.spaceAfter, 8, 0, 72),
    },
  };
}

function normalizeResolutionPageBlock(raw, fallbackId) {
  if (!raw || typeof raw !== 'object') return null;
  const blockId = id(raw.id, fallbackId);
  if (raw.type === 'paragraph') {
    return {
      id: blockId,
      type: 'paragraph',
      text: text(raw.text, RESOLUTION_PAGE_LIMITS.paragraphCharacters),
      style: pageStyle(raw.style, { fontFamily: 'Helvetica', fontSize: 10, alignment: 'left', lineSpacing: 1.25, spaceBefore: 6, spaceAfter: 8 }),
    };
  }
  if (raw.type === 'table') return normalizeResolutionPageTable(raw, blockId);
  return null;
}

function normalizeResolutionPageBlocks(raw) {
  const seen = new Set();
  return (Array.isArray(raw) ? raw : []).slice(0, RESOLUTION_PAGE_LIMITS.blocks).map((block, index) => normalizeResolutionPageBlock(block, `block_${index + 1}`)).filter(Boolean).map(block => {
    let blockId = block.id;
    let suffix = 2;
    while (seen.has(blockId)) blockId = `${block.id}_${suffix++}`;
    seen.add(blockId);
    return { ...block, id: blockId };
  });
}

function normalizeResolutionPageConfig(raw = {}, defaults = {}) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    enabled: source.enabled === true,
    version: 1,
    heading: {
      ...pageStyle(source.heading, { fontFamily: 'Helvetica', fontSize: 16, bold: true, underline: true, alignment: 'center', lineSpacing: 1.2, spaceBefore: 0, spaceAfter: 12 }),
      text: text(source.heading?.text ?? source.headingText, 120) || 'RESOLUTION',
    },
    details: {
      subject: text(source.details?.subject, 300) || text(defaults.subject || defaults.title, 300),
      date: text(source.details?.date, 80) || text(defaults.date || defaults.meetingDate, 80),
      place: text(source.details?.place || defaults.place || defaults.meetingLocation, 160),
      boardMembersPresent: text(source.details?.boardMembersPresent, 80),
      totalBoardMembers: text(source.details?.totalBoardMembers, 80),
    },
    detailsStyle: pageStyle(source.detailsStyle, { fontFamily: 'Helvetica', fontSize: 10, bold: true, alignment: 'left', lineSpacing: 1.25, spaceBefore: 0, spaceAfter: 10 }),
    mainStatement: {
      ...pageStyle(source.mainStatement, { fontFamily: 'Helvetica', fontSize: 12, bold: true, alignment: 'left', lineSpacing: 1.25, spaceBefore: 4, spaceAfter: 10 }),
      text: text(source.mainStatement?.text, RESOLUTION_PAGE_LIMITS.paragraphCharacters) || DEFAULT_RESOLUTION_STATEMENT,
    },
    blocks: normalizeResolutionPageBlocks(source.blocks),
  };
}

function normalizeGeneratedPageOrder(raw) {
  const source = Array.isArray(raw) ? raw : DEFAULT_GENERATED_PAGE_ORDER;
  const seen = new Set();
  const order = source.filter(item => GENERATED_PAGE_TYPES.includes(item) && !seen.has(item) && seen.add(item));
  DEFAULT_GENERATED_PAGE_ORDER.forEach(item => { if (!seen.has(item)) order.push(item); });
  return order;
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

function normalizeSourceMode(value, pdfLayoutMode = 'standard') {
  if (SOURCE_MODES.includes(value)) return value;
  return pdfLayoutMode === 'custom' ? 'custom' : 'standard';
}

function normalizeUploadedVotesTableConfig(raw = {}) {
  const columns = Object.fromEntries(VOTE_COLUMNS.map(key => [key, typeof raw.columns?.[key] === 'boolean' ? raw.columns[key] : key !== 'signature']));
  if (!VOTE_COLUMNS.some(key => columns[key])) columns.name = true;
  return {
    columns,
    voterScope: choice(raw.voterScope, ['submitted', 'all'], 'submitted'),
    showTitle: raw.showTitle !== false,
    repeatHeader: raw.repeatHeader !== false,
    showResultSummary: raw.showResultSummary !== false,
  };
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

function resolutionPageCharacterCount(config = {}) {
  return (Array.isArray(config.blocks) ? config.blocks : []).reduce((total, block) => {
    if (block?.type === 'paragraph') return total + (typeof block.text === 'string' ? block.text.length : 0);
    if (block?.type === 'table') {
      return total + (typeof block.title === 'string' ? block.title.length : 0) + (Array.isArray(block.rows) ? block.rows.reduce((rowTotal, row) => {
        const values = legacyRowValues(row) || (row?.cells && typeof row.cells === 'object' ? Object.values(row.cells) : []);
        return rowTotal + values.reduce((sum, cell) => sum + (typeof cell === 'string' ? cell.length : 0), 0);
      }, 0) : 0);
    }
    return total;
  }, 0);
}

function validatePageStyle(raw, label, errors) {
  if (!FONTS.includes(raw?.fontFamily)) errors.push(`${label} has an invalid font.`);
  if (!Number.isFinite(Number(raw?.fontSize)) || Number(raw.fontSize) < 8 || Number(raw.fontSize) > 20) errors.push(`${label} has an invalid font size.`);
  if (!ALIGNMENTS.includes(raw?.alignment)) errors.push(`${label} has an invalid alignment.`);
}

function validateResolutionPageConfig(raw = {}, errors) {
  const config = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  if (config.enabled !== true) return;
  validatePageStyle(config.heading, 'Resolution Page heading', errors);
  validatePageStyle(config.detailsStyle, 'Resolution Page details', errors);
  validatePageStyle(config.mainStatement, 'Resolution Page main statement', errors);
  if (typeof config.heading?.text === 'string' && config.heading.text.length > 120) errors.push('Resolution Page heading is too long.');
  if (typeof config.mainStatement?.text === 'string' && config.mainStatement.text.length > RESOLUTION_PAGE_LIMITS.paragraphCharacters) errors.push('Resolution Page main statement is too long.');
  if (Array.isArray(config.blocks) && config.blocks.length > RESOLUTION_PAGE_LIMITS.blocks) errors.push(`Resolution Page may contain at most ${RESOLUTION_PAGE_LIMITS.blocks} custom blocks.`);
  if (resolutionPageCharacterCount(config) > RESOLUTION_PAGE_LIMITS.blocks * RESOLUTION_PAGE_LIMITS.paragraphCharacters) errors.push('Resolution Page content is too large.');
  (Array.isArray(config.blocks) ? config.blocks : []).forEach((block, index) => {
    const label = `Resolution Page block ${index + 1}`;
    if (!['paragraph', 'table'].includes(block?.type)) errors.push(`${label} has an unsupported type.`);
    if (block?.type === 'paragraph') {
      if (typeof block.text === 'string' && block.text.length > RESOLUTION_PAGE_LIMITS.paragraphCharacters) errors.push(`${label} is too long.`);
      validatePageStyle(block.style, label, errors);
    }
    if (block?.type === 'table') {
      if (!Array.isArray(block.columns) || block.columns.length < 1 || block.columns.length > RESOLUTION_PAGE_LIMITS.columns) errors.push(`${label} has invalid table columns.`);
      if (!Array.isArray(block.rows) || block.rows.length < 1 || block.rows.length > RESOLUTION_PAGE_LIMITS.rows) errors.push(`${label} has invalid table rows.`);
      validatePageStyle(block.style, label, errors);
      if (block.style?.headerFontFamily && !FONTS.includes(block.style.headerFontFamily)) errors.push(`${label} has an invalid header font.`);
      if (block.style?.headerFontSize && (!Number.isFinite(Number(block.style.headerFontSize)) || Number(block.style.headerFontSize) < 8 || Number(block.style.headerFontSize) > 20)) errors.push(`${label} has an invalid header font size.`);
    }
  });
}

function validateGeneratedPageOrder(raw, errors) {
  if (raw == null) return;
  if (!Array.isArray(raw)) {
    errors.push('Generated page order must be a list.');
    return;
  }
  const seen = new Set();
  raw.forEach(item => {
    if (!GENERATED_PAGE_TYPES.includes(item)) errors.push('Generated page order has an unsupported value.');
    if (seen.has(item)) errors.push('Generated page order cannot contain duplicates.');
    seen.add(item);
  });
}

function validateLayout(raw = {}) {
  const requestedMode = raw.pdfLayoutMode == null || raw.pdfLayoutMode === '' ? 'standard' : text(raw.pdfLayoutMode, 20).toLowerCase();
  const requestedSourceMode = raw.documentSourceMode == null || raw.documentSourceMode === '' ? null : text(raw.documentSourceMode, 30);
  const source = Array.isArray(raw.pdfSections) ? raw.pdfSections : [];
  const errors = [];
  if (!MODES.includes(requestedMode)) errors.push('A valid PDF layout mode is required.');
  if (requestedSourceMode && !SOURCE_MODES.includes(requestedSourceMode)) errors.push('A valid Resolution document source is required.');
  validateResolutionPageConfig(raw.resolutionPageConfig, errors);
  validateGeneratedPageOrder(raw.generatedPageOrder, errors);
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
  const pdfLayoutMode = MODES.includes(requestedMode) ? requestedMode : 'standard';
  const documentSourceMode = normalizeSourceMode(requestedSourceMode, pdfLayoutMode);
  const uploadedVotesTableConfig = normalizeUploadedVotesTableConfig(raw.uploadedVotesTableConfig);
  const resolutionPageConfig = normalizeResolutionPageConfig(raw.resolutionPageConfig, raw);
  const generatedPageOrder = normalizeGeneratedPageOrder(raw.generatedPageOrder);
  try { assertNoNestedArrays(resolutionPageConfig, 'resolutionPageConfig'); }
  catch (error) { errors.push(error.message); }
  return { ok: errors.length === 0, errors, payload: { pdfLayoutMode, pdfSections, documentSourceMode, uploadedVotesTableConfig, resolutionPageConfig, generatedPageOrder } };
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

module.exports = { DEFAULT_GENERATED_PAGE_ORDER, GENERATED_PAGE_TYPES, LIMITS, MODES, RESOLUTION_PAGE_LIMITS, SOURCE_MODES, TYPES, VOTE_COLUMNS, assertNoNestedArrays, normalizeGeneratedPageOrder, normalizeResolutionPageConfig, normalizeSections, normalizeSourceMode, normalizeUploadedVotesTableConfig, validateLayout };
