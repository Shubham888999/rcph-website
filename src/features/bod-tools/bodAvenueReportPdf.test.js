import assert from "node:assert/strict";
import test from "node:test";
import { buildBodAvenueReportModel } from "./bodAvenueReportModel.js";
import { buildBodAvenueReportPdfDocument, buildBodAvenueReportPdfPages } from "./bodAvenueReportPdf.js";

const makeEvent = (id, description = "Short description") => ({
  id,
  name: `Project ${id}`,
  startDate: "2026-07-05",
  recordKind: "clubEvent",
  isActive: true,
  archived: false,
  avenues: ["CMD"],
  rcphRole: "host",
  hostClub: "Rotaract Club of Pune Heritage",
  collaborators: [{ name: "Partner Club" }],
  collaboratorsKnown: true,
  description,
});

function report(events, selectedEventIds = events.map((event) => event.id)) {
  return buildBodAvenueReportModel({
    month: "2026-07",
    avenueCode: "CMD",
    events,
    selectedEventIds,
    directors: [{ name: "Aarav Joshi", positionTitle: "Community Service Director" }],
    generatedAt: "2026-07-03T12:00:00.000Z",
  });
}

test("finalized report produces an A4 PDF with summary, table, and footer", () => {
  const pdf = buildBodAvenueReportPdfDocument(report([makeEvent("One")]));
  assert.match(pdf, /^%PDF-1\.4/);
  assert.match(pdf, /\/MediaBox \[0 0 595 842\]/);
  for (const text of ["MONTHLY BOD AVENUE REPORT", "Community Service Avenue", "Aarav Joshi", "Host / Collaborators / Description", "Project One", "Page 1 of 1"]) assert.match(pdf, new RegExp(text));
});

test("long descriptions paginate, repeat table headers, and retain every selected event", () => {
  const events = Array.from({ length: 14 }, (_, index) => makeEvent(`Event-${index + 1}`, "Long project detail ".repeat(55)));
  const pages = buildBodAvenueReportPdfPages(report(events));
  assert.ok(pages.length > 1);
  pages.forEach((page) => assert.ok(page.some((command) => command.includes("Host / Collaborators / Description"))));
  const pdf = buildBodAvenueReportPdfDocument(report(events));
  events.forEach((event) => assert.match(pdf, new RegExp(event.name)));
  assert.match(pdf, new RegExp(`Page ${pages.length} of ${pages.length}`));
});

test("unselected events never enter the PDF and supported punctuation is normalized safely", () => {
  const pdf = buildBodAvenueReportPdfDocument(report([
    makeEvent("Selected", "Pune’s community – José"),
    makeEvent("Excluded"),
  ], ["Selected"]));
  assert.match(pdf, /Project Selected/);
  assert.doesNotMatch(pdf, /Project Excluded/);
  assert.match(pdf, /Pune's community - Jose/);
});

test("empty or inconsistent report models cannot create PDFs", () => {
  assert.throws(() => buildBodAvenueReportPdfDocument({ eventCount: 0, events: [] }), /non-empty/i);
});
