import { buildCollaborationGeography } from "../collaborations/collaborationGeography.js";
import {
  buildGlanceStats,
  buildTreasuryLedger,
  buildVisitAttendanceTree,
  formatVisitDocumentRoleLabel,
  getVisitAttendanceEventsForAvenue,
  groupVisibleDocumentPanelsByPerson,
  parseOfficialDisplayName,
} from "./visitDashboardModel.js";

// Rows per slide for long tables, sized to stay readable on a projector.
export const PRESENTATION_ROWS_PER_SLIDE = 10;

function chunk(items, size) {
  const pages = [];
  for (let index = 0; index < items.length; index += size) pages.push(items.slice(index, index + size));
  return pages;
}

function pageTitle(title, pageIndex, pageCount) {
  return pageCount > 1 ? `${title} (${pageIndex + 1} of ${pageCount})` : title;
}

function avenueRows(stats, attendance) {
  const rows = (Array.isArray(stats?.avenueEventCounts) ? stats.avenueEventCounts : [])
    .filter((row) => row.avenueCode !== "GBM" && Number(row.count) > 0)
    .map((row) => ({
      avenueCode: row.avenueCode,
      avenueName: row.avenueName || row.avenueCode,
      eventCount: getVisitAttendanceEventsForAvenue(attendance, row).length,
    }))
    .filter((row) => row.eventCount > 0);
  const max = Math.max(1, ...rows.map((row) => row.eventCount));
  return rows.map((row) => ({ ...row, share: Math.round((row.eventCount / max) * 100) }));
}

// One slide per main presentation, in the same order as the BOD documents section.
// Built from whatever is selected when Present is pressed, so it follows decks as they change.
function directorSlides(documentPanels) {
  return groupVisibleDocumentPanelsByPerson(documentPanels).flatMap((block) => block.panels
    .filter((panel) => panel.primaryPresentation?.previewUrl)
    .map((panel) => ({
      key: `director:${block.blockKey}:${panel.positionKey}`,
      kind: "director",
      title: block.title,
      role: formatVisitDocumentRoleLabel(panel),
      file: panel.primaryPresentation,
    })));
}

function treasuryPages(treasury) {
  const ledger = buildTreasuryLedger(treasury?.rows);
  const lines = ledger.groups.flatMap((group) => group.rows.map((row) => ({ ...row, monthLabel: group.label })));
  return { ledger, pages: chunk(lines, PRESENTATION_ROWS_PER_SLIDE) };
}

// Turns normalized visit dashboard data into presentation slides.
export function buildVisitPresentationSlides(data) {
  const { visit, stats, documentPanels, attendance, fines, treasury, letterhead, collaborations } = data;
  const slides = [];

  slides.push({
    key: "welcome",
    kind: "welcome",
    title: "Rotaract Club of Pune Heritage",
    visitName: visit.visitName,
    officials: visit.officialDisplayNames.map(parseOfficialDisplayName),
  });

  slides.push({ key: "glance", kind: "glance", title: "Club at a glance", glance: buildGlanceStats({ stats, treasury }) });
  slides.push({ key: "attendance", kind: "attendance", title: "Attendance", tree: buildVisitAttendanceTree(attendance) });

  const avenues = avenueRows(stats, attendance);
  if (avenues.length) slides.push({ key: "avenues", kind: "avenues", title: "Avenue-wise events", rows: avenues });

  if (collaborations?.rows.length) {
    slides.push({
      key: "collaborations",
      kind: "collaborations",
      title: "Collaborations",
      geography: buildCollaborationGeography(collaborations.rows),
    });
  }

  if (letterhead) {
    slides.push({ key: "letterhead", kind: "letterhead", title: "Letterhead exchanges", rows: letterhead.rows, summary: letterhead.summary });
  }

  slides.push(...directorSlides(documentPanels));

  const finePages = chunk(fines.rows, PRESENTATION_ROWS_PER_SLIDE);
  if (finePages.length) {
    finePages.forEach((rows, index) => slides.push({
      key: `fines:${index}`,
      kind: "fines",
      title: pageTitle("Fines", index, finePages.length),
      rows,
      summary: fines.summary,
      isLastPage: index === finePages.length - 1,
    }));
  } else {
    slides.push({ key: "fines:0", kind: "fines", title: "Fines", rows: [], summary: fines.summary, isLastPage: true });
  }

  const { ledger, pages } = treasuryPages(treasury);
  if (pages.length) {
    pages.forEach((rows, index) => slides.push({
      key: `treasury:${index}`,
      kind: "treasury",
      title: pageTitle("Treasury ledger", index, pages.length),
      rows,
      totals: ledger.totals,
      isLastPage: index === pages.length - 1,
    }));
  } else {
    slides.push({ key: "treasury:0", kind: "treasury", title: "Treasury ledger", rows: [], totals: ledger.totals, isLastPage: true });
  }

  slides.push({ key: "thanks", kind: "thanks", title: "Thank you" });
  return slides;
}
