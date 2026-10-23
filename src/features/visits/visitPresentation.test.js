import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeVisitDashboardData } from "./visitDashboardModel.js";
import { PRESENTATION_ROWS_PER_SLIDE, buildVisitPresentationSlides } from "./visitPresentationModel.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const pageSource = read("../../pages/visits/VisitDashboardPage.jsx");
const presentationSource = read("../../pages/visits/VisitPresentation.jsx");
const presentationCss = read("../../styles/components/visit-presentation.css");

function presentation(fileId) {
  return {
    submissionId: `s-${fileId}`,
    title: `${fileId}.pptx`,
    fileName: `${fileId}.pptx`,
    canPreview: true,
    previewUrl: `https://drive.google.com/file/d/${fileId}/preview`,
    driveFileId: fileId,
  };
}

function panel(positionKey, positionTitle, holder, primary) {
  const file = primary ? presentation(primary) : null;
  return {
    positionKey,
    positionTitle,
    holders: [{ personKey: holder.toLowerCase().replace(/\W+/g, "-"), displayName: holder }],
    fileCount: file ? 1 : 0,
    files: file ? [file] : [],
    primaryPresentation: file,
  };
}

function sampleData(overrides = {}) {
  return normalizeVisitDashboardData({
    visit: { visitType: "dzrVisit", visitName: "DZR Visit", officialDisplayNames: ["Rtr. Asha Kulkarni | District Zonal Representative"], dashboardVisible: true },
    stats: { totalMembers: 40, totalEvents: 12, avenueEventCounts: [] },
    documentPanels: [
      panel("president", "President", "Rtr. Nupura Danait", "deck-president"),
      panel("secretary", "Secretary", "Rtr. Soham Naik", null),
      panel("isd", "International Service Director", "Rtr. Aarya Godbole", "deck-isd"),
    ],
    fines: {
      rows: Array.from({ length: 14 }, (_, index) => ({ fineKey: `f${index}`, date: "2026-08-01", memberName: "Member", reason: "Late", amount: 50, status: "paid" })),
    },
    treasury: {
      rows: Array.from({ length: 23 }, (_, index) => ({ transactionId: `t${index}`, date: `2026-0${7 + (index % 3)}-1${index % 9}`, title: `Entry ${index}`, amount: 100, type: index % 2 ? "expense" : "income" })),
    },
    letterheadExchanges: [],
    collaborations: [{ eventId: "woh", name: "Wings of Honour", date: "2026-10-08", rcphRole: "host", partners: [{ name: "Rotaract Club of RVCE" }] }],
    ...overrides,
  });
}

test("slides run welcome, overview, collaborations, letterhead, directors, fines, treasury, thank you", () => {
  const kinds = buildVisitPresentationSlides(sampleData()).map((slide) => slide.kind);
  assert.equal(kinds[0], "welcome");
  assert.equal(kinds.at(-1), "thanks");
  assert.deepEqual([...new Set(kinds)], ["welcome", "glance", "attendance", "collaborations", "letterhead", "director", "fines", "treasury", "thanks"]);
});

test("there is one director slide per main presentation, so decks that come and go change the slides", () => {
  const slides = buildVisitPresentationSlides(sampleData()).filter((slide) => slide.kind === "director");
  assert.deepEqual(slides.map((slide) => slide.title), ["Rtr. Nupura Danait", "Rtr. Aarya Godbole"]);
  assert.ok(slides.every((slide) => slide.file.previewUrl.endsWith("/preview")));

  const withoutDecks = buildVisitPresentationSlides(sampleData({ documentPanels: [panel("president", "President", "Rtr. Nupura Danait", null)] }));
  assert.equal(withoutDecks.some((slide) => slide.kind === "director"), false);
});

test("fines and treasury show every row, split across slides", () => {
  const slides = buildVisitPresentationSlides(sampleData());
  const fines = slides.filter((slide) => slide.kind === "fines");
  const treasury = slides.filter((slide) => slide.kind === "treasury");

  assert.equal(fines.length, Math.ceil(14 / PRESENTATION_ROWS_PER_SLIDE));
  assert.equal(fines.flatMap((slide) => slide.rows).length, 14);
  assert.equal(treasury.flatMap((slide) => slide.rows).length, 23);
  assert.equal(treasury.length, Math.ceil(23 / PRESENTATION_ROWS_PER_SLIDE));
  assert.deepEqual(treasury.map((slide) => slide.isLastPage), [false, false, true]);
  assert.equal(treasury[0].title, "Treasury ledger (1 of 3)");
});

test("empty fines and treasury still get one slide each and optional sections are skipped", () => {
  const slides = buildVisitPresentationSlides(normalizeVisitDashboardData({ visit: { visitName: "DZR Visit" } }));
  const kinds = slides.map((slide) => slide.kind);
  assert.deepEqual(kinds, ["welcome", "glance", "attendance", "fines", "treasury", "thanks"]);
});

test("Present button opens a lazily loaded presentation built from the page data", () => {
  assert.match(pageSource, /const VisitPresentation = lazy\(\(\) => import\("\.\/VisitPresentation\.jsx"\)\)/);
  assert.match(pageSource, /className="visit-dashboard-present-button"/);
  assert.match(pageSource, /buildVisitPresentationSlides\(data\)/);
  const actions = pageSource.indexOf('className="visit-dashboard-masthead__actions"');
  assert.ok(pageSource.indexOf('className="visit-dashboard-present-button"') > actions, "button sits in the header actions");
});

test("presentation supports clickers, Esc, full screen and a slide list", () => {
  for (const key of ["PageDown", "PageUp", "ArrowRight", "ArrowLeft", "Escape", "Home", "End"]) {
    assert.match(presentationSource, new RegExp(`"${key}"`), key);
  }
  assert.match(presentationSource, /requestFullscreen/);
  assert.match(presentationSource, /aria-label="All slides"/);
  assert.match(presentationSource, /role="dialog"/);
  assert.match(presentationCss, /@media \(prefers-reduced-motion: reduce\)/);
});
