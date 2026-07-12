export const PDF_LAYOUT_MODES = Object.freeze(["standard", "custom"]);
export const DOCUMENT_SOURCE_MODES = Object.freeze(["standard", "custom", "uploadedPdf"]);
export const RESOLUTION_SECTION_TYPES = Object.freeze(["heading", "paragraph", "table", "votesTable", "spacer"]);
export const RESOLUTION_PDF_LIMITS = Object.freeze({ sections: 100, textCharacters: 50000, tableRows: 200, tableColumns: 20 });
export const RESOLUTION_PAGE_LIMITS = Object.freeze({ blocks: 20, paragraphCharacters: 10000, tableRows: 100, tableColumns: 10, cellCharacters: 2000 });
export const RESOLUTION_FONTS = Object.freeze(["Helvetica", "Times Roman", "Courier"]);
export const RESOLUTION_ALIGNMENTS = Object.freeze(["left", "center", "right"]);
export const VOTES_TABLE_COLUMNS = Object.freeze(["name", "position", "vote", "timestamp", "signature"]);
export const GENERATED_PAGE_TYPES = Object.freeze(["resolution_page", "vote_table"]);
export const DEFAULT_GENERATED_PAGE_ORDER = Object.freeze(["resolution_page", "vote_table"]);

const LEGACY_RESOLUTION_STATEMENT =
  "This is to resolve that we, the Board Members of Rotaract Club of Pune Heritage, for the scheduled Board Meeting, have considered and passed the resolution stated below in accordance with the applicable voting requirements and the records maintained by the Club.";

function resolutionSubjectMatter(resolution = {}) {
  const title = cleanText(resolution.title || resolution.subject, 300);

  return title
    .replace(/^passing\s+the\s+resolution\s+of\s+/i, "")
    .replace(/^resolution\s+of\s+/i, "")
    .trim() || "[RESOLUTION SUBJECT]";
}

function createDefaultResolutionStatement(resolution = {}) {
  const subject = resolutionSubjectMatter(resolution);

  return `This is to resolve that we, the Board Members of Rotaract Club of Pune Heritage, for the scheduled board meeting with a majority of _____, have passed the Resolution of ${subject} of Rotaract Club of Pune Heritage for Rotary International Year 2026-27 by signing the attached document.`;
}
function cleanText(value, max = 50000) {
  if (typeof value !== "string") return "";
  const safe = Array.from(value, (character) => ({ character, code: character.charCodeAt(0) }))
    .filter(({ code }) => !(code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127))
    .map(({ character }) => character)
    .join("");
  return safe.trim().replace(/\r\n/g, "\n").slice(0, max);
}

function number(value, fallback, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function bool(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function choice(value, choices, fallback) {
  return choices.includes(value) ? value : fallback;
}

function sectionId(value, fallback) {
  const id = cleanText(value, 100).replace(/[^a-zA-Z0-9_-]/g, "");
  return id || fallback;
}

export function createSectionId() {
  if (globalThis.crypto?.randomUUID) return `section_${globalThis.crypto.randomUUID().replace(/-/g, "")}`;
  return `section_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizePdfLayoutMode(value) {
  return value == null || value === "" ? "standard" : choice(cleanText(value, 20).toLowerCase(), PDF_LAYOUT_MODES, "standard");
}

export function normalizeDocumentSourceMode(value, pdfLayoutMode = "standard") {
  return choice(value, DOCUMENT_SOURCE_MODES, pdfLayoutMode === "custom" ? "custom" : "standard");
}

export function normalizeUploadedVotesTableConfig(raw = {}) {
  const columns = Object.fromEntries(VOTES_TABLE_COLUMNS.map((key) => [key, typeof raw.columns?.[key] === "boolean" ? raw.columns[key] : key !== "signature"]));
  if (!VOTES_TABLE_COLUMNS.some((key) => columns[key])) columns.name = true;
  return {
    columns,
    voterScope: choice(raw.voterScope, ["submitted", "all"], "submitted"),
    showTitle: raw.showTitle !== false,
    repeatHeader: raw.repeatHeader !== false,
    showResultSummary: raw.showResultSummary !== false,
  };
}

function normalizeTextStyle(raw = {}, heading = false) {
  return {
    fontFamily: choice(raw.fontFamily, RESOLUTION_FONTS, "Helvetica"),
    fontSize: number(raw.fontSize, heading ? 14 : 10, 8, 20),
    bold: bool(raw.bold, heading),
    italic: bool(raw.italic),
    underline: bool(raw.underline),
    alignment: choice(raw.alignment, RESOLUTION_ALIGNMENTS, heading ? "center" : "left"),
    lineSpacing: number(raw.lineSpacing, heading ? 1.2 : 1.25, 1, 2),
    spaceBefore: number(raw.spaceBefore, 0, 0, 72),
    spaceAfter: number(raw.spaceAfter, heading ? 10 : 8, 0, 72),
  };
}

function normalizeResolutionPageTextStyle(raw = {}, defaults = {}) {
  return {
    fontFamily: choice(raw.fontFamily, RESOLUTION_FONTS, defaults.fontFamily || "Helvetica"),
    fontSize: number(raw.fontSize, defaults.fontSize || 10, 8, 20),
    bold: bool(raw.bold, defaults.bold === true),
    italic: bool(raw.italic, defaults.italic === true),
    underline: bool(raw.underline, defaults.underline === true),
    alignment: choice(raw.alignment, RESOLUTION_ALIGNMENTS, defaults.alignment || "left"),
    lineSpacing: number(raw.lineSpacing, defaults.lineSpacing || 1.25, 1, 2),
    spaceBefore: number(raw.spaceBefore, defaults.spaceBefore || 0, 0, 72),
    spaceAfter: number(raw.spaceAfter, defaults.spaceAfter ?? 8, 0, 72),
  };
}

function normalizedWidths(rawWidths, count) {
  const source = Array.from({ length: count }, (_, index) => number(rawWidths?.[index], 100 / count, 1, 100));
  const total = source.reduce((sum, width) => sum + width, 0) || 1;
  return source.map((width) => Number(((width / total) * 100).toFixed(4)));
}

function tableRowId(value, fallback) {
  return sectionId(value, fallback);
}

function legacyRowValues(row) {
  if (Array.isArray(row)) return row;
  if (Array.isArray(row?.cells)) return row.cells.map((cell) => typeof cell === "object" ? cell?.value ?? cell?.text : cell);
  return null;
}

function cellValue(row, column, index) {
  const legacy = legacyRowValues(row);
  if (legacy) return legacy[index];
  if (row?.cells && typeof row.cells === "object") return row.cells[column.id];
  return "";
}

function normalizeTable(raw, id) {
  const rawRows = Array.isArray(raw.rows) ? raw.rows.slice(0, RESOLUTION_PDF_LIMITS.tableRows) : [];
  const inferredColumns = Math.max(1, Math.min(RESOLUTION_PDF_LIMITS.tableColumns, Array.isArray(raw.columns) ? raw.columns.length : Math.max(0, ...rawRows.map((row) => legacyRowValues(row)?.length || 0))));
  const widths = normalizedWidths((raw.columns || []).map((column) => column?.widthPercent ?? column?.width), inferredColumns);
  const columns = Array.from({ length: inferredColumns }, (_, index) => ({
    id: sectionId(raw.columns?.[index]?.id, `column_${index + 1}`),
    label: cleanText(raw.columns?.[index]?.label, 200),
    widthPercent: widths[index],
    alignment: choice(raw.columns?.[index]?.alignment, RESOLUTION_ALIGNMENTS, "left"),
  }));
  const sourceRows = rawRows.length ? rawRows : [{ id: "row_1", cells: {} }];
  const rows = sourceRows.map((row, rowIndex) => ({
    id: tableRowId(row?.id, `row_${rowIndex + 1}`),
    cells: Object.fromEntries(columns.map((column, columnIndex) => [column.id, cleanText(cellValue(row, column, columnIndex), 5000)])),
  }));
  return {
    id,
    type: "table",
    columns,
    rows,
    options: {
      hasHeaderRow: bool(raw.options?.hasHeaderRow, true),
      repeatHeader: bool(raw.options?.repeatHeader, true),
      showBorders: bool(raw.options?.showBorders, true),
    },
    style: {
      fontFamily: choice(raw.style?.fontFamily, RESOLUTION_FONTS, "Helvetica"),
      fontSize: number(raw.style?.fontSize, 9, 8, 20),
      boldHeader: bool(raw.style?.boldHeader, true),
      cellPadding: number(raw.style?.cellPadding, 4, 1, 12),
      spaceBefore: number(raw.style?.spaceBefore, 8, 0, 72),
      spaceAfter: number(raw.style?.spaceAfter, 8, 0, 72),
    },
  };
}

function normalizeResolutionPageTable(raw, id) {
  const rawRows = Array.isArray(raw.rows) ? raw.rows.slice(0, RESOLUTION_PAGE_LIMITS.tableRows) : [];
  const inferredColumns = Math.max(1, Math.min(RESOLUTION_PAGE_LIMITS.tableColumns, Array.isArray(raw.columns) ? raw.columns.length : Math.max(0, ...rawRows.map((row) => legacyRowValues(row)?.length || 0))));
  const widths = normalizedWidths((raw.columns || []).map((column) => column?.widthPercent ?? column?.width), inferredColumns);
  const columns = Array.from({ length: inferredColumns }, (_, index) => ({
    id: sectionId(raw.columns?.[index]?.id, `column_${index + 1}`),
    label: cleanText(raw.columns?.[index]?.label, 200),
    widthPercent: widths[index],
    alignment: choice(raw.columns?.[index]?.alignment, RESOLUTION_ALIGNMENTS, "left"),
  }));
  const sourceRows = rawRows.length ? rawRows : [{ id: "row_1", cells: {} }];
  const rows = sourceRows.map((row, rowIndex) => ({
    id: tableRowId(row?.id, `row_${rowIndex + 1}`),
    cells: Object.fromEntries(columns.map((column, columnIndex) => [column.id, cleanText(cellValue(row, column, columnIndex), RESOLUTION_PAGE_LIMITS.cellCharacters)])),
  }));
  return {
    id,
    type: "table",
    title: cleanText(raw.title, 200),
    columns,
    rows,
    options: {
      hasHeaderRow: bool(raw.options?.hasHeaderRow, true),
      repeatHeader: bool(raw.options?.repeatHeader, true),
      showBorders: bool(raw.options?.showBorders, true),
      compactRows: bool(raw.options?.compactRows, false),
    },
    style: {
      fontFamily: choice(raw.style?.fontFamily, RESOLUTION_FONTS, "Helvetica"),
      fontSize: number(raw.style?.fontSize, 9, 8, 20),
      headerFontFamily: choice(raw.style?.headerFontFamily, RESOLUTION_FONTS, raw.style?.fontFamily || "Helvetica"),
      headerFontSize: number(raw.style?.headerFontSize, 9, 8, 20),
      boldHeader: bool(raw.style?.boldHeader, true),
      alignment: choice(raw.style?.alignment, RESOLUTION_ALIGNMENTS, "left"),
      cellPadding: number(raw.style?.cellPadding, 4, 1, 12),
      spaceBefore: number(raw.style?.spaceBefore, 8, 0, 72),
      spaceAfter: number(raw.style?.spaceAfter, 8, 0, 72),
    },
  };
}

export function normalizeResolutionPageBlock(raw, fallbackId = createSectionId()) {
  if (!raw || typeof raw !== "object") return null;
  const type = choice(raw.type, ["paragraph", "table"], "");
  if (!type) return null;
  const id = sectionId(raw.id, fallbackId);
  if (type === "paragraph") {
    return {
      id,
      type,
      text: cleanText(raw.text, RESOLUTION_PAGE_LIMITS.paragraphCharacters),
      style: normalizeResolutionPageTextStyle(raw.style, { fontFamily: "Helvetica", fontSize: 10, alignment: "left", lineSpacing: 1.25, spaceBefore: 6, spaceAfter: 8 }),
    };
  }
  return normalizeResolutionPageTable(raw, id);
}

export function normalizeResolutionPageBlocks(raw) {
  const seen = new Set();
  return (Array.isArray(raw) ? raw : []).slice(0, RESOLUTION_PAGE_LIMITS.blocks).map((block, index) => normalizeResolutionPageBlock(block, `block_${index + 1}`)).filter(Boolean).map((block) => {
    let id = block.id;
    let suffix = 2;
    while (seen.has(id)) id = `${block.id}_${suffix++}`;
    seen.add(id);
    return { ...block, id };
  });
}

function normalizeResolutionPageDetails(raw = {}, defaults = {}) {
  return {
    subject: cleanText(raw.subject, 300) || cleanText(defaults.subject || defaults.title, 300),
    date: cleanText(raw.date, 80) || cleanText(defaults.date || defaults.meetingDate, 80),
    place: cleanText(raw.place || defaults.place || defaults.meetingLocation, 160),
    boardMembersPresent: cleanText(raw.boardMembersPresent, 80),
    totalBoardMembers: cleanText(raw.totalBoardMembers, 80),
  };
}

export function normalizeGeneratedPageOrder(raw) {
  const source = Array.isArray(raw) ? raw : DEFAULT_GENERATED_PAGE_ORDER;
  const seen = new Set();
  const order = source.filter((item) => GENERATED_PAGE_TYPES.includes(item) && !seen.has(item) && seen.add(item));
  DEFAULT_GENERATED_PAGE_ORDER.forEach((item) => { if (!seen.has(item)) order.push(item); });
  return order;
}

export function normalizeResolutionPageConfig(raw = {}, defaults = {}) {
  const source =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? raw
      : {};

  const legacyTemplate = !source.version || source.version < 2;

  const headingSource = {
    ...source.heading,
  };

  const detailsStyleSource = {
    ...source.detailsStyle,
  };

  const statementSource = {
    ...source.mainStatement,
  };

  /*
   * Migrate only the untouched version-1 template values.
   * Explicit Admin customizations remain preserved.
   */
  if (
    legacyTemplate &&
    (!source.heading?.spaceAfter || source.heading.spaceAfter === 18)
  ) {
    headingSource.spaceAfter = 30;
  }

  if (
    legacyTemplate &&
    (!source.detailsStyle?.lineSpacing ||
      source.detailsStyle.lineSpacing === 1.4)
  ) {
    detailsStyleSource.lineSpacing = 1.25;
  }

  if (
    legacyTemplate &&
    (!source.detailsStyle?.spaceAfter ||
      source.detailsStyle.spaceAfter === 18)
  ) {
    detailsStyleSource.spaceAfter = 32;
  }

  const existingStatementText = cleanText(
    source.mainStatement?.text,
    RESOLUTION_PAGE_LIMITS.paragraphCharacters,
  );

  const useNewDefaultStatement =
    !existingStatementText ||
    existingStatementText === LEGACY_RESOLUTION_STATEMENT;

  if (
    legacyTemplate &&
    (!source.mainStatement?.lineSpacing ||
      source.mainStatement.lineSpacing === 1.35)
  ) {
    statementSource.lineSpacing = 1.45;
  }

  if (
    legacyTemplate &&
    (!source.mainStatement?.spaceBefore ||
      source.mainStatement.spaceBefore === 4)
  ) {
    statementSource.spaceBefore = 0;
  }

  if (
    legacyTemplate &&
    (!source.mainStatement?.spaceAfter ||
      source.mainStatement.spaceAfter === 16)
  ) {
    statementSource.spaceAfter = 24;
  }

  return {
    enabled: source.enabled === true,
    version: 2,

    heading: {
      ...normalizeResolutionPageTextStyle(headingSource, {
        fontFamily: "Helvetica",
        fontSize: 16,
        bold: true,
        underline: true,
        alignment: "center",
        lineSpacing: 1.15,
        spaceBefore: 0,
        spaceAfter: 30,
      }),
      text:
        cleanText(source.heading?.text ?? source.headingText, 120) ||
        "RESOLUTION",
    },

    details: normalizeResolutionPageDetails(source.details, defaults),

    detailsStyle: normalizeResolutionPageTextStyle(
      detailsStyleSource,
      {
        fontFamily: "Helvetica",
        fontSize: 10,
        bold: true,
        alignment: "left",
        lineSpacing: 1.25,
        spaceBefore: 0,
        spaceAfter: 32,
      },
    ),

    mainStatement: {
      ...normalizeResolutionPageTextStyle(statementSource, {
        fontFamily: "Helvetica",
        fontSize: 12,
        bold: true,
        alignment: "left",
        lineSpacing: 1.45,
        spaceBefore: 0,
        spaceAfter: 24,
      }),
      text: useNewDefaultStatement
        ? createDefaultResolutionStatement(defaults)
        : existingStatementText,
    },

    blocks: normalizeResolutionPageBlocks(source.blocks),
  };
}

export function createDefaultResolutionPageConfig(resolution = {}) {
  return { ...normalizeResolutionPageConfig({}, { subject: resolution.title, date: resolution.meetingDate || resolution.date, place: resolution.meetingLocation }), enabled: true };
}

function normalizeVotesTable(raw, id) {
  const columns = Object.fromEntries(VOTES_TABLE_COLUMNS.map((key) => [key, bool(raw.columns?.[key], key !== "signature")]));
  if (!VOTES_TABLE_COLUMNS.some((key) => columns[key])) columns.name = true;
  return {
    id,
    type: "votesTable",
    title: cleanText(raw.title, 200) || "Voting Record",
    columns,
    options: {
      showTitle: bool(raw.options?.showTitle, true),
      repeatHeader: bool(raw.options?.repeatHeader, true),
      voterScope: choice(raw.options?.voterScope, ["submitted", "all"], "submitted"),
      showResultSummary: bool(raw.options?.showResultSummary),
    },
    style: {
      fontFamily: choice(raw.style?.fontFamily, RESOLUTION_FONTS, "Helvetica"),
      fontSize: number(raw.style?.fontSize, 9, 8, 20),
      headerFontSize: number(raw.style?.headerFontSize, 9, 8, 20),
      headerBold: bool(raw.style?.headerBold, true),
      cellPadding: number(raw.style?.cellPadding, 4, 1, 12),
      spaceBefore: number(raw.style?.spaceBefore, 10, 0, 72),
      spaceAfter: number(raw.style?.spaceAfter, 10, 0, 72),
    },
  };
}

export function normalizeResolutionSection(raw, fallbackId = createSectionId()) {
  if (!raw || typeof raw !== "object") return null;
  const type = choice(raw.type, RESOLUTION_SECTION_TYPES, "");
  if (!type) return null;
  const id = sectionId(raw.id, fallbackId);
  if (type === "heading") return { id, type, text: cleanText(raw.text), style: normalizeTextStyle(raw.style, true) };
  if (type === "paragraph") return { id, type, text: cleanText(raw.text), listStyle: choice(raw.listStyle, ["none", "bullet", "numbered"], "none"), style: normalizeTextStyle(raw.style) };
  if (type === "table") return normalizeTable(raw, id);
  if (type === "votesTable") return normalizeVotesTable(raw, id);
  return { id, type, mode: choice(raw.mode, ["small", "medium", "large", "pageBreak"], "medium") };
}

export function normalizeResolutionSections(raw) {
  const seen = new Set();
  return (Array.isArray(raw) ? raw : []).slice(0, RESOLUTION_PDF_LIMITS.sections).map((section, index) => normalizeResolutionSection(section, `section_${index + 1}`)).filter(Boolean).map((section) => {
    let id = section.id;
    let suffix = 2;
    while (seen.has(id)) id = `${section.id}_${suffix++}`;
    seen.add(id);
    return { ...section, id };
  });
}

function rawTextCharacterCount(sections) {
  return sections.reduce((total, section) => {
    let count = typeof section?.text === "string" ? section.text.length : 0;
    if (typeof section?.title === "string") count += section.title.length;
    if (Array.isArray(section?.rows)) count += section.rows.reduce((rowTotal, row) => {
      const values = legacyRowValues(row) || (row?.cells && typeof row.cells === "object" ? Object.values(row.cells) : []);
      return rowTotal + values.reduce((sum, cell) => sum + (typeof cell === "string" ? cell.length : 0), 0);
    }, 0);
    return total + count;
  }, 0);
}

function rawResolutionPageTextCount(config = {}) {
  const blocks = Array.isArray(config.blocks) ? config.blocks : [];
  return blocks.reduce((total, block) => {
    if (block?.type === "paragraph") return total + (typeof block.text === "string" ? block.text.length : 0);
    if (block?.type === "table") {
      return total + (typeof block.title === "string" ? block.title.length : 0) + (Array.isArray(block.rows) ? block.rows.reduce((rowTotal, row) => {
        const values = legacyRowValues(row) || (row?.cells && typeof row.cells === "object" ? Object.values(row.cells) : []);
        return rowTotal + values.reduce((sum, cell) => sum + (typeof cell === "string" ? cell.length : 0), 0);
      }, 0) : 0);
    }
    return total;
  }, 0);
}

function validateResolutionPageStyle(style, label, errors) {
  if (!RESOLUTION_FONTS.includes(style?.fontFamily)) errors.push(`${label} has an invalid font.`);
  if (!Number.isFinite(Number(style?.fontSize)) || Number(style.fontSize) < 8 || Number(style.fontSize) > 20) errors.push(`${label} font size must be between 8 and 20.`);
  if (!RESOLUTION_ALIGNMENTS.includes(style?.alignment)) errors.push(`${label} has an invalid alignment.`);
}

function validateResolutionPageConfig(raw = {}, errors) {
  const config = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  if (config.enabled !== true) return;
  validateResolutionPageStyle(config.heading, "Resolution Page heading", errors);
  validateResolutionPageStyle(config.detailsStyle, "Resolution Page details", errors);
  validateResolutionPageStyle(config.mainStatement, "Resolution Page main statement", errors);
  if (typeof config.heading?.text === "string" && config.heading.text.length > 120) errors.push("Resolution Page heading must be 120 characters or fewer.");
  if (typeof config.mainStatement?.text === "string" && config.mainStatement.text.length > RESOLUTION_PAGE_LIMITS.paragraphCharacters) errors.push(`Resolution Page main statement must be ${RESOLUTION_PAGE_LIMITS.paragraphCharacters.toLocaleString()} characters or fewer.`);
  if (Array.isArray(config.blocks) && config.blocks.length > RESOLUTION_PAGE_LIMITS.blocks) errors.push(`Resolution Page may contain at most ${RESOLUTION_PAGE_LIMITS.blocks} custom blocks.`);
  if (rawResolutionPageTextCount(config) > RESOLUTION_PAGE_LIMITS.blocks * RESOLUTION_PAGE_LIMITS.paragraphCharacters) errors.push("Resolution Page content is too large.");
  (Array.isArray(config.blocks) ? config.blocks : []).forEach((block, index) => {
    const label = `Resolution Page block ${index + 1}`;
    if (!["paragraph", "table"].includes(block?.type)) errors.push(`${label} has an unsupported type.`);
    if (block?.type === "paragraph") {
      if (typeof block.text === "string" && block.text.length > RESOLUTION_PAGE_LIMITS.paragraphCharacters) errors.push(`${label} text must be ${RESOLUTION_PAGE_LIMITS.paragraphCharacters.toLocaleString()} characters or fewer.`);
      validateResolutionPageStyle(block.style, label, errors);
    }
    if (block?.type === "table") {
      if (!Array.isArray(block.columns) || block.columns.length < 1 || block.columns.length > RESOLUTION_PAGE_LIMITS.tableColumns) errors.push(`${label} must have 1 to ${RESOLUTION_PAGE_LIMITS.tableColumns} columns.`);
      if (!Array.isArray(block.rows) || block.rows.length < 1 || block.rows.length > RESOLUTION_PAGE_LIMITS.tableRows) errors.push(`${label} must have 1 to ${RESOLUTION_PAGE_LIMITS.tableRows} rows.`);
      validateResolutionPageStyle(block.style, label, errors);
      if (block.style?.headerFontFamily && !RESOLUTION_FONTS.includes(block.style.headerFontFamily)) errors.push(`${label} has an invalid header font.`);
      if (block.style?.headerFontSize && (!Number.isFinite(Number(block.style.headerFontSize)) || Number(block.style.headerFontSize) < 8 || Number(block.style.headerFontSize) > 20)) errors.push(`${label} header font size must be between 8 and 20.`);
      (Array.isArray(block.rows) ? block.rows : []).forEach((row, rowIndex) => {
        const values = legacyRowValues(row) || (row?.cells && typeof row.cells === "object" ? Object.values(row.cells) : []);
        values.forEach((cell) => { if (typeof cell === "string" && cell.length > RESOLUTION_PAGE_LIMITS.cellCharacters) errors.push(`${label} row ${rowIndex + 1} has a cell over ${RESOLUTION_PAGE_LIMITS.cellCharacters.toLocaleString()} characters.`); });
      });
    }
  });
}

function validateGeneratedPageOrder(raw, errors) {
  if (raw == null) return;
  if (!Array.isArray(raw)) {
    errors.push("Generated page order must be a list.");
    return;
  }
  const seen = new Set();
  raw.forEach((item) => {
    if (!GENERATED_PAGE_TYPES.includes(item)) errors.push("Generated page order has an unsupported value.");
    if (seen.has(item)) errors.push("Generated page order cannot contain duplicates.");
    seen.add(item);
  });
}

export function validateResolutionPdfLayout(raw = {}) {
  const errors = [];
  const requestedMode = raw.pdfLayoutMode == null || raw.pdfLayoutMode === "" ? "standard" : cleanText(raw.pdfLayoutMode, 20).toLowerCase();
  const requestedSourceMode = raw.documentSourceMode == null || raw.documentSourceMode === "" ? null : cleanText(raw.documentSourceMode, 30);
  if (!PDF_LAYOUT_MODES.includes(requestedMode)) errors.push("Choose a valid PDF layout mode.");
  if (requestedSourceMode && !DOCUMENT_SOURCE_MODES.includes(requestedSourceMode)) errors.push("Choose a valid Resolution document source.");
  validateResolutionPageConfig(raw.resolutionPageConfig, errors);
  validateGeneratedPageOrder(raw.generatedPageOrder, errors);
  const source = Array.isArray(raw.pdfSections) ? raw.pdfSections : [];
  if (source.length > RESOLUTION_PDF_LIMITS.sections) errors.push(`A custom layout may contain at most ${RESOLUTION_PDF_LIMITS.sections} sections.`);
  if (rawTextCharacterCount(source) > RESOLUTION_PDF_LIMITS.textCharacters) errors.push(`Custom layout text may contain at most ${RESOLUTION_PDF_LIMITS.textCharacters.toLocaleString()} characters.`);
  const ids = new Set();
  source.forEach((section, index) => {
    if (!RESOLUTION_SECTION_TYPES.includes(section?.type)) errors.push(`Section ${index + 1} has an unsupported type.`);
    const id = sectionId(section?.id, "");
    if (!id || ids.has(id)) errors.push(`Section ${index + 1} must have a unique ID.`);
    ids.add(id);
    if (["heading", "paragraph"].includes(section?.type)) {
      if (!RESOLUTION_FONTS.includes(section?.style?.fontFamily)) errors.push(`Section ${index + 1} has an invalid font.`);
      if (!Number.isFinite(Number(section?.style?.fontSize)) || Number(section.style.fontSize) < 8 || Number(section.style.fontSize) > 20) errors.push(`Section ${index + 1} font size must be between 8 and 20.`);
      if (!RESOLUTION_ALIGNMENTS.includes(section?.style?.alignment)) errors.push(`Section ${index + 1} has an invalid alignment.`);
    }
    if (section?.type === "table") {
      if (!Array.isArray(section.columns) || section.columns.length < 1 || section.columns.length > RESOLUTION_PDF_LIMITS.tableColumns) errors.push(`Section ${index + 1} must have 1 to ${RESOLUTION_PDF_LIMITS.tableColumns} columns.`);
      if (!Array.isArray(section.rows) || section.rows.length < 1 || section.rows.length > RESOLUTION_PDF_LIMITS.tableRows) errors.push(`Section ${index + 1} must have 1 to ${RESOLUTION_PDF_LIMITS.tableRows} rows.`);
    }
    if (section?.type === "votesTable" && !VOTES_TABLE_COLUMNS.some((key) => section.columns?.[key] === true)) errors.push(`Section ${index + 1} must include at least one Votes Table column.`);
  });
  const pdfLayoutMode = normalizePdfLayoutMode(requestedMode);
  const pdfSections = normalizeResolutionSections(source);
  try { assertNoNestedArrays(pdfSections, "pdfSections"); }
  catch (error) { errors.push(error.message); }
  const documentSourceMode = normalizeDocumentSourceMode(requestedSourceMode, pdfLayoutMode);
  const uploadedVotesTableConfig = normalizeUploadedVotesTableConfig(raw.uploadedVotesTableConfig);
  const resolutionPageConfig = normalizeResolutionPageConfig(raw.resolutionPageConfig, raw);
  const generatedPageOrder = normalizeGeneratedPageOrder(raw.generatedPageOrder);
  try { assertNoNestedArrays(resolutionPageConfig, "resolutionPageConfig"); }
  catch (error) { errors.push(error.message); }
  return { ok: errors.length === 0, errors, payload: { pdfLayoutMode, pdfSections, documentSourceMode, uploadedVotesTableConfig, resolutionPageConfig, generatedPageOrder } };
}

export function assertNoNestedArrays(value, path = "value") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      if (Array.isArray(item)) throw new TypeError(`${path}[${index}] contains an array directly nested inside an array.`);
      assertNoNestedArrays(item, `${path}[${index}]`);
    });
    return true;
  }
  if (value && typeof value === "object") Object.entries(value).forEach(([key, item]) => assertNoNestedArrays(item, `${path}.${key}`));
  return true;
}

export function createResolutionSection(type, id = createSectionId()) {
  const base = { id, type };
  if (type === "heading") return normalizeResolutionSection({ ...base, text: "Heading", style: { fontFamily: "Helvetica", fontSize: 14, bold: true, alignment: "center" } });
  if (type === "paragraph") return normalizeResolutionSection({ ...base, text: "Paragraph text", listStyle: "none", style: { fontFamily: "Helvetica", fontSize: 10, alignment: "left" } });
  if (type === "table") return normalizeResolutionSection({ ...base, columns: [{ id: "column_1", label: "", widthPercent: 50 }, { id: "column_2", label: "", widthPercent: 50 }], rows: [{ id: "row_1", cells: { column_1: "Column 1", column_2: "Column 2" } }, { id: "row_2", cells: { column_1: "", column_2: "" } }], options: { hasHeaderRow: true, repeatHeader: true, showBorders: true }, style: {} });
  if (type === "votesTable") return normalizeResolutionSection({ ...base, title: "Voting Record", columns: { name: true, position: true, vote: true, timestamp: true, signature: false }, options: { showTitle: true, repeatHeader: true, voterScope: "submitted", showResultSummary: false }, style: {} });
  return normalizeResolutionSection({ ...base, mode: "medium" });
}

export function addResolutionSection(sections, type, id) {
  return [...normalizeResolutionSections(sections), createResolutionSection(type, id)];
}

export function updateResolutionSection(sections, id, changes) {
  return normalizeResolutionSections(sections).map((section) => section.id === id ? normalizeResolutionSection({ ...section, ...changes, id: section.id, type: section.type }, section.id) : section);
}

export function deleteResolutionSection(sections, id) {
  return normalizeResolutionSections(sections).filter((section) => section.id !== id);
}

export function duplicateResolutionSection(sections, id, newId = createSectionId()) {
  const normalized = normalizeResolutionSections(sections);
  const index = normalized.findIndex((section) => section.id === id);
  if (index < 0) return normalized;
  const copy = normalizeResolutionSection({ ...structuredClone(normalized[index]), id: newId }, newId);
  return [...normalized.slice(0, index + 1), copy, ...normalized.slice(index + 1)];
}

export function moveResolutionSection(sections, id, direction) {
  const normalized = normalizeResolutionSections(sections);
  const index = normalized.findIndex((section) => section.id === id);
  const target = direction === "up" ? index - 1 : direction === "down" ? index + 1 : index;
  if (index < 0 || target < 0 || target >= normalized.length) return normalized;
  [normalized[index], normalized[target]] = [normalized[target], normalized[index]];
  return normalized;
}

export function createResolutionPageBlock(type, id = createSectionId()) {
  if (type === "table") return normalizeResolutionPageBlock({ id, type, columns: [{ id: "column_1", label: "Column 1", widthPercent: 50 }, { id: "column_2", label: "Column 2", widthPercent: 50 }], rows: [{ id: "row_1", cells: { column_1: "Column 1", column_2: "Column 2" } }, { id: "row_2", cells: { column_1: "", column_2: "" } }], options: { hasHeaderRow: true, repeatHeader: true, showBorders: true }, style: {} }, id);
  return normalizeResolutionPageBlock({ id, type: "paragraph", text: "Paragraph text", style: { fontFamily: "Helvetica", fontSize: 10, alignment: "left" } }, id);
}

export function addResolutionPageBlock(blocks, type, id) {
  return [...normalizeResolutionPageBlocks(blocks), createResolutionPageBlock(type, id)];
}

export function updateResolutionPageBlock(blocks, id, changes) {
  return normalizeResolutionPageBlocks(blocks).map((block) => block.id === id ? normalizeResolutionPageBlock({ ...block, ...changes, id: block.id, type: block.type }, block.id) : block);
}

export function deleteResolutionPageBlock(blocks, id) {
  return normalizeResolutionPageBlocks(blocks).filter((block) => block.id !== id);
}

export function duplicateResolutionPageBlock(blocks, id, newId = createSectionId()) {
  const normalized = normalizeResolutionPageBlocks(blocks);
  const index = normalized.findIndex((block) => block.id === id);
  if (index < 0) return normalized;
  const copy = normalizeResolutionPageBlock({ ...structuredClone(normalized[index]), id: newId }, newId);
  return [...normalized.slice(0, index + 1), copy, ...normalized.slice(index + 1)];
}

export function moveResolutionPageBlock(blocks, id, direction) {
  const normalized = normalizeResolutionPageBlocks(blocks);
  const index = normalized.findIndex((block) => block.id === id);
  const target = direction === "up" ? index - 1 : direction === "down" ? index + 1 : index;
  if (index < 0 || target < 0 || target >= normalized.length) return normalized;
  [normalized[index], normalized[target]] = [normalized[target], normalized[index]];
  return normalized;
}

export function createDefaultResolutionSections() {
  return [
    createResolutionSection("heading"),
    normalizeResolutionSection({ id: createSectionId(), type: "table", columns: [{ id: "column_1", label: "", widthPercent: 35 }, { id: "column_2", label: "", widthPercent: 65 }], rows: [{ id: "row_1", cells: { column_1: "Subject", column_2: "" } }, { id: "row_2", cells: { column_1: "Date", column_2: "" } }, { id: "row_3", cells: { column_1: "Place", column_2: "" } }, { id: "row_4", cells: { column_1: "No. of Board Members", column_2: "" } }, { id: "row_5", cells: { column_1: "Total No. of Board Members", column_2: "" } }], options: { hasHeaderRow: false, repeatHeader: false, showBorders: true }, style: {} }),
    normalizeResolutionSection({ id: createSectionId(), type: "paragraph", text: "Enter the explanatory resolution text.", listStyle: "none", style: { fontFamily: "Helvetica", fontSize: 10, alignment: "left" } }),
    normalizeResolutionSection({ id: createSectionId(), type: "heading", text: "Resolution Details", style: { fontFamily: "Helvetica", fontSize: 12, bold: true, alignment: "left" } }),
    normalizeResolutionSection({ id: createSectionId(), type: "paragraph", text: "Add each item on a separate line.", listStyle: "bullet", style: { fontFamily: "Helvetica", fontSize: 10, alignment: "left" } }),
  ];
}

export function describeResolutionSection(section) {
  if (section.type === "table") return `${section.rows.length} rows × ${section.columns.length} columns`;
  if (section.type === "votesTable") return VOTES_TABLE_COLUMNS.filter((key) => section.columns[key]).join(", ");
  if (section.type === "spacer") return section.mode === "pageBreak" ? "Forced page break" : `${section.mode} spacer`;
  return section.text.slice(0, 100) || "Empty text";
}

export function describeResolutionPageBlock(block) {
  if (block.type === "table") return `${block.rows.length} rows x ${block.columns.length} columns`;
  return block.text.slice(0, 100) || "Empty paragraph";
}
