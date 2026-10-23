import { buildCollaborationGeography } from "../collaborations/collaborationGeography.js";
import {
  buildGlanceStats,
  buildTreasuryLedger,
  buildVisitAttendanceTree,
  formatVisitDocumentRoleLabel,
  groupVisibleDocumentPanelsByPerson,
  parseOfficialDisplayName,
} from "./visitDashboardModel.js";
import { buildAttendanceTrend, buildAvenueMonthStrip } from "./visitTrendsModel.js";

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

const CO_ROLE_PREFIX = "co-";

function holderNames(panel) {
  return (Array.isArray(panel?.holders) ? panel.holders : []).map((holder) => holder.displayName).filter(Boolean);
}

// One slide per main presentation, in the same order as the BOD documents section.
// Built from whatever is selected when Present is pressed, so it follows decks as they change.
// A co-role ("co-csd" for "csd") shares the director's deck: its holders are named on the
// director's slide, and it gets no slide of its own while the director has a deck.
function directorSlides(documentPanels) {
  const panels = Array.isArray(documentPanels) ? documentPanels : [];
  const byKey = new Map(panels.map((panel) => [panel.positionKey, panel]));
  const hasDeck = (panel) => Boolean(panel?.primaryPresentation?.previewUrl);

  return groupVisibleDocumentPanelsByPerson(panels).flatMap((block) => block.panels
    .filter((panel) => hasDeck(panel))
    .filter((panel) => !(panel.positionKey.startsWith(CO_ROLE_PREFIX) && hasDeck(byKey.get(panel.positionKey.slice(CO_ROLE_PREFIX.length)))))
    .map((panel) => {
      const coPanel = byKey.get(`${CO_ROLE_PREFIX}${panel.positionKey}`);
      const coNames = holderNames(coPanel);
      return {
        key: `director:${block.blockKey}:${panel.positionKey}`,
        kind: "director",
        title: block.title,
        role: formatVisitDocumentRoleLabel(panel),
        co: coNames.length ? { role: coPanel.positionTitle || formatVisitDocumentRoleLabel(coPanel), names: coNames } : null,
        file: panel.primaryPresentation,
      };
    }));
}

function treasuryPages(treasury) {
  const ledger = buildTreasuryLedger(treasury?.rows);
  const lines = ledger.groups.flatMap((group) => group.rows.map((row) => ({ ...row, monthLabel: group.label })));
  return { ledger, pages: chunk(lines, PRESENTATION_ROWS_PER_SLIDE) };
}

// Turns normalized visit dashboard data into presentation slides.
export function buildVisitPresentationSlides(data, today = new Date()) {
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
  slides.push({
    key: "attendance",
    kind: "attendance",
    title: "Attendance",
    tree: buildVisitAttendanceTree(attendance),
    trend: buildAttendanceTrend(attendance, today),
  });

  const strip = buildAvenueMonthStrip(stats, attendance, today);
  if (strip.rows.length) slides.push({ key: "avenues", kind: "avenues", title: "Avenue-wise events", strip });

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
