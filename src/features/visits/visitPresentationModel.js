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

function presenter(panel) {
  return { role: formatVisitDocumentRoleLabel(panel), names: holderNames(panel) };
}

// One slide per director deck, in the same order as the BOD documents section.
// Built from whatever is selected when Present is pressed, so it follows decks as they change.
// A co-role ("co-csd" for "csd") shares the director's slide: the director is named first,
// then the co-director, and the deck is the director's, or the co-director's when only
// they uploaded one. A co-role only gets a slide of its own when the director's folder
// is not selected.
function directorSlides(documentPanels) {
  const panels = Array.isArray(documentPanels) ? documentPanels : [];
  const byKey = new Map(panels.map((panel) => [panel.positionKey, panel]));
  const hasDeck = (panel) => Boolean(panel?.primaryPresentation?.previewUrl);
  const slide = (panel, people, file) => ({
    key: `director:${panel.positionKey}`,
    kind: "director",
    title: people[0].names.join(", "),
    role: people[0].role,
    presenters: people,
    file,
  });

  return groupVisibleDocumentPanelsByPerson(panels).flatMap((block) => block.panels.flatMap((panel) => {
    if (panel.positionKey.startsWith(CO_ROLE_PREFIX)) {
      const mainPanel = byKey.get(panel.positionKey.slice(CO_ROLE_PREFIX.length));
      if (holderNames(mainPanel).length) return [];
      return hasDeck(panel) ? [slide(panel, [presenter(panel)], panel.primaryPresentation)] : [];
    }

    const coPanel = byKey.get(`${CO_ROLE_PREFIX}${panel.positionKey}`);
    const hasCo = holderNames(coPanel).length > 0;
    const file = hasDeck(panel) ? panel.primaryPresentation : (hasCo && hasDeck(coPanel) ? coPanel.primaryPresentation : null);
    if (!file) return [];
    return [slide(panel, hasCo ? [presenter(panel), presenter(coPanel)] : [presenter(panel)], file)];
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
