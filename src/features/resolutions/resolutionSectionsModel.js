export const PDF_LAYOUT_MODES = Object.freeze(["standard", "custom"]);
export const RESOLUTION_SECTION_TYPES = Object.freeze(["heading", "paragraph", "table", "votesTable", "spacer"]);
export const RESOLUTION_PDF_LIMITS = Object.freeze({ sections: 100, textCharacters: 50000, tableRows: 200, tableColumns: 20 });
export const RESOLUTION_FONTS = Object.freeze(["Helvetica", "Times Roman", "Courier"]);
export const RESOLUTION_ALIGNMENTS = Object.freeze(["left", "center", "right"]);
export const VOTES_TABLE_COLUMNS = Object.freeze(["name", "position", "vote", "timestamp", "signature"]);

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

function normalizedWidths(rawWidths, count) {
  const source = Array.from({ length: count }, (_, index) => number(rawWidths?.[index], 100 / count, 1, 100));
  const total = source.reduce((sum, width) => sum + width, 0) || 1;
  return source.map((width) => Number(((width / total) * 100).toFixed(4)));
}

function normalizeTable(raw, id) {
  const rawRows = Array.isArray(raw.rows) ? raw.rows.slice(0, RESOLUTION_PDF_LIMITS.tableRows) : [];
  const inferredColumns = Math.max(1, Math.min(RESOLUTION_PDF_LIMITS.tableColumns, Array.isArray(raw.columns) ? raw.columns.length : Math.max(0, ...rawRows.map((row) => Array.isArray(row) ? row.length : 0))));
  const widths = normalizedWidths((raw.columns || []).map((column) => column?.width), inferredColumns);
  const columns = Array.from({ length: inferredColumns }, (_, index) => ({
    id: sectionId(raw.columns?.[index]?.id, `column_${index + 1}`),
    width: widths[index],
    alignment: choice(raw.columns?.[index]?.alignment, RESOLUTION_ALIGNMENTS, "left"),
  }));
  const rows = (rawRows.length ? rawRows : [Array(inferredColumns).fill("")]).map((row) => Array.from({ length: inferredColumns }, (_, index) => cleanText(row?.[index], 5000)));
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
    if (Array.isArray(section?.rows)) count += section.rows.flat().reduce((sum, cell) => sum + (typeof cell === "string" ? cell.length : 0), 0);
    return total + count;
  }, 0);
}

export function validateResolutionPdfLayout(raw = {}) {
  const errors = [];
  const requestedMode = raw.pdfLayoutMode == null || raw.pdfLayoutMode === "" ? "standard" : cleanText(raw.pdfLayoutMode, 20).toLowerCase();
  if (!PDF_LAYOUT_MODES.includes(requestedMode)) errors.push("Choose a valid PDF layout mode.");
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
  return { ok: errors.length === 0, errors, payload: { pdfLayoutMode, pdfSections } };
}

export function createResolutionSection(type, id = createSectionId()) {
  const base = { id, type };
  if (type === "heading") return normalizeResolutionSection({ ...base, text: "Heading", style: { fontFamily: "Helvetica", fontSize: 14, bold: true, alignment: "center" } });
  if (type === "paragraph") return normalizeResolutionSection({ ...base, text: "Paragraph text", listStyle: "none", style: { fontFamily: "Helvetica", fontSize: 10, alignment: "left" } });
  if (type === "table") return normalizeResolutionSection({ ...base, columns: [{ width: 50 }, { width: 50 }], rows: [["Column 1", "Column 2"], ["", ""]], options: { hasHeaderRow: true, repeatHeader: true, showBorders: true }, style: {} });
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

export function createDefaultResolutionSections() {
  return [
    createResolutionSection("heading"),
    normalizeResolutionSection({ id: createSectionId(), type: "table", columns: [{ width: 35 }, { width: 65 }], rows: [["Subject", ""], ["Date", ""], ["Place", ""], ["No. of Board Members", ""], ["Total No. of Board Members", ""]], options: { hasHeaderRow: false, repeatHeader: false, showBorders: true }, style: {} }),
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
