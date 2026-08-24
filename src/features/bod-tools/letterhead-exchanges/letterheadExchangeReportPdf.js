import { normalizePdfText } from "../../pdf/simplePdf.js";

export const LETTERHEAD_EXCHANGE_SECTION_TITLE = "LETTERHEAD EXCHANGES";
export const LETTERHEAD_EXCHANGE_EMPTY_MESSAGE = "No Letterhead Exchanges were recorded for the selected reporting period.";

export const LETTERHEAD_EXCHANGE_TABLE_COLUMNS = Object.freeze([
  Object.freeze({ key: "date", label: "Date", width: 48 }),
  Object.freeze({ key: "club", label: "Club", width: 80 }),
  Object.freeze({ key: "rotaractor", label: "Rotaractor", width: 72 }),
  Object.freeze({ key: "positionRid", label: "Position / RID", width: 75 }),
  Object.freeze({ key: "representatives", label: "RCPH Representative(s)", width: 115 }),
  Object.freeze({ key: "remarks", label: "Associated Event / Remarks", width: 133 }),
]);

const CELL_SPECS = Object.freeze({
  date: Object.freeze({ max: 80, read: (row) => row?.dateLabel || row?.date }),
  club: Object.freeze({ max: 180, read: (row) => row?.clubName }),
  rotaractor: Object.freeze({ max: 160, read: (row) => row?.rotaractorName }),
  positionRid: Object.freeze({ max: 180, read: (row) => row?.positionRid }),
  representatives: Object.freeze({ max: 260, read: (row) => row?.rcphRepresentativesText }),
  remarks: Object.freeze({ max: 2200, read: (row) => row?.associatedEventRemarks }),
});

export function normalizeLetterheadExchangeCellText(value, max = 2200) {
  return normalizePdfText(String(value ?? ""))
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .join("\n")
    .slice(0, max);
}

export function buildLetterheadExchangeCellLines(row, options = {}) {
  const columns = options.columns || LETTERHEAD_EXCHANGE_TABLE_COLUMNS;
  const cellSpecs = options.cellSpecs && typeof options.cellSpecs === "object" ? options.cellSpecs : {};
  const padding = Number.isFinite(Number(options.padding)) ? Number(options.padding) : 0;
  const wrapText = options.wrapText;
  if (typeof wrapText !== "function") throw new TypeError("Letterhead Exchange PDF cell wrapping is required.");
  return Object.fromEntries(columns.map((column) => {
    const baseSpec = CELL_SPECS[column.key] || Object.freeze({ max: 2200, read: (source) => source?.[column.key] });
    const overrideSpec = cellSpecs[column.key] && typeof cellSpecs[column.key] === "object" ? cellSpecs[column.key] : {};
    const spec = { ...baseSpec, ...overrideSpec };
    const rawValue = typeof spec.read === "function" ? spec.read(row) : row?.[column.key];
    const formattedValue = typeof spec.format === "function" ? spec.format(rawValue, row, column) : rawValue;
    const value = normalizeLetterheadExchangeCellText(formattedValue, spec.max) || "Not available";
    const width = Math.max(1, column.width - padding * 2);
    const lines = wrapText(value, width, column);
    return [column.key, Array.isArray(lines) && lines.length ? lines : [" "]];
  }));
}
