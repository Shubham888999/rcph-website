import {
  buildLetterheadExchangeReportBlocks,
  formatBodReportMonth,
  normalizeBodReportMonths,
  normalizeLetterheadExchangeReportItems,
} from "../bodAvenueReportModel.js";

export const LETTERHEAD_EXPORT_TITLE = "Letterhead Exchange Report";

function text(value, max = 200) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
}

function lower(value) {
  return text(value).toLocaleLowerCase("en");
}

// Months that have exchanges, newest first, with how many exchanges each holds.
export function exchangeMonthOptions(exchanges = []) {
  const counts = new Map();
  (Array.isArray(exchanges) ? exchanges : []).forEach((exchange) => {
    const month = text(exchange?.exchangeMonth, 7);
    if (/^\d{4}-\d{2}$/.test(month)) counts.set(month, (counts.get(month) || 0) + 1);
  });
  return [...counts.keys()].sort().reverse().map((value) => ({ value, label: formatBodReportMonth(value), count: counts.get(value) }));
}

export function exchangeRepresentativeOptions(exchanges = []) {
  const names = new Map();
  (Array.isArray(exchanges) ? exchanges : []).forEach((exchange) => {
    (Array.isArray(exchange?.rcphRepresentatives) ? exchange.rcphRepresentatives : []).forEach((item) => {
      const name = text(item?.name, 120);
      if (name && !names.has(name.toLowerCase())) names.set(name.toLowerCase(), name);
    });
  });
  return [...names.values()].sort((left, right) => left.localeCompare(right));
}

// Club name search (any participating club) and one RCPH representative.
export function filterExportExchanges(exchanges = [], { clubQuery = "", representative = "" } = {}) {
  const query = lower(clubQuery);
  const rep = lower(representative);
  return (Array.isArray(exchanges) ? exchanges : []).filter((exchange) => {
    if (query && !(exchange?.externalParticipants || []).some((item) => lower(item?.clubName).includes(query))) return false;
    if (rep && !(exchange?.rcphRepresentatives || []).some((item) => lower(item?.name) === rep)) return false;
    return true;
  });
}

export function exportPeriodLabel(months) {
  const list = normalizeBodReportMonths(months);
  if (!list.length) return "";
  if (list.length === 1) return formatBodReportMonth(list[0]);
  return `${formatBodReportMonth(list[0])} to ${formatBodReportMonth(list.at(-1))}`;
}

export function summarizeExportExchanges(exchanges = []) {
  const items = Array.isArray(exchanges) ? exchanges : [];
  return {
    total: items.length,
    withReportPhoto: items.filter((item) => item?.reportImage).length,
    missingReportPhoto: items.filter((item) => Number(item?.imageCount) > 0 && !item?.reportImage).length,
  };
}

// The report model the Avenue report PDF builder draws, with only Letterhead Exchanges in it.
export function buildLetterheadExchangeExportReport({ exchanges, months, includePhotos = true, generatedAt = new Date() } = {}) {
  const selectedMonths = normalizeBodReportMonths(months);
  const items = normalizeLetterheadExchangeReportItems(exchanges);
  if (!items.length) throw new Error("There are no Letterhead Exchanges for these filters.");
  return {
    reportKind: "letterheadExchanges",
    title: LETTERHEAD_EXPORT_TITLE,
    selectedMonths,
    periodLabel: exportPeriodLabel(selectedMonths),
    includeLetterheadExchanges: true,
    includeLetterheadExchangePhotos: includePhotos === true,
    letterheadExchanges: items,
    letterheadExchangeBlocks: buildLetterheadExchangeReportBlocks(items, { includePhotos: includePhotos === true }),
    exchangeCount: items.length,
    generatedAt,
  };
}
