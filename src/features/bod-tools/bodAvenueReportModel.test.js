import assert from "node:assert/strict";
import test from "node:test";
import {
  BOD_AVENUE_REPORT_LIMIT,
  buildBodAvenueReportModel,
  createBodAvenueSelection,
  filterBodAvenueReportEvents,
  formatBodReportMonth,
  getBodAvenueReportFilename,
  normalizeBodAvenueDirectors,
  toggleBodAvenueEvent,
} from "./bodAvenueReportModel.js";

const event = (id, overrides = {}) => ({
  id,
  name: `Event ${id}`,
  startDate: "2026-07-01",
  endDate: "2026-07-01",
  recordKind: "clubEvent",
  isActive: true,
  archived: false,
  avenues: ["CMD"],
  rcphRole: "host",
  hostClub: "RCPH",
  collaborators: [],
  collaboratorsKnown: true,
  description: "Description",
  ...overrides,
});

test("monthly filtering uses inclusive start dates, selected avenues, and stable deduplication", () => {
  const rows = filterBodAvenueReportEvents([
    event("first", { startDate: "2026-07-01", endDate: "2026-08-03" }),
    event("last", { startDate: "2026-07-31", avenues: ["ISD", "CMD"] }),
    event("last", { startDate: "2026-07-31" }),
    event("next", { startDate: "2026-08-01" }),
  ], { month: "2026-07", avenueCode: "cmd" });
  assert.deepEqual(rows.map((row) => row.id), ["first", "last"]);
});

test("reports exclude archived, deleted-like, malformed, BOD meeting, district, and no-avenue records", () => {
  const rows = filterBodAvenueReportEvents([
    event("good"),
    event("archived", { archived: true, isActive: false }),
    event("inactive", { isActive: false }),
    event("meeting", { recordKind: "bodMeeting" }),
    event("district", { recordKind: "districtEvent" }),
    event("malformed", { startDate: "July 2" }),
    event("none", { avenues: [] }),
  ], { month: "2026-07", avenueCode: "CMD" });
  assert.deepEqual(rows.map((row) => row.id), ["good"]);
  assert.deepEqual(filterBodAvenueReportEvents([event("x")], { month: "2026-13", avenueCode: "CMD" }), []);
});

test("director normalization validates the avenue and deduplicates name/title pairs", () => {
  const payload = { ok: true, avenueCode: "CMD", directors: [
    { name: " Member A ", positionTitle: "Community Service Director" },
    { name: "member a", positionTitle: "Community Service Director" },
    { name: "Member B", positionTitle: "Joint Community Service Director" },
  ] };
  assert.equal(normalizeBodAvenueDirectors(payload, "cmd").length, 2);
  assert.deepEqual(normalizeBodAvenueDirectors(payload, "ISD"), []);
  assert.deepEqual(normalizeBodAvenueDirectors({ ok: true, avenueCode: "CMD", directors: [] }, "CMD"), []);
});

test("selection starts with every match and supports deselect, select all, and clear", () => {
  const matches = [event("a"), event("b")];
  const selected = createBodAvenueSelection(matches);
  assert.deepEqual([...selected], ["a", "b"]);
  assert.deepEqual([...toggleBodAvenueEvent(selected, "a", false)], ["b"]);
  assert.deepEqual([...createBodAvenueSelection(matches)], ["a", "b"]);
  assert.equal(createBodAvenueSelection([]).size, 0);
});

test("report model contains only safe selected presentation fields", () => {
  const source = event("safe", { secret: "hidden", collaborators: [{ name: "Club A" }] });
  const report = buildBodAvenueReportModel({
    month: "2026-07",
    avenueCode: "CMD",
    events: [source, event("excluded")],
    selectedEventIds: ["safe"],
    directors: [{ name: "Director A", positionTitle: "Community Service Director", uid: "private" }],
    generatedAt: "2026-07-03T12:00:00.000Z",
  });
  assert.equal(report.monthLabel, "July 2026");
  assert.equal(report.avenueLabel, "Community Service Avenue");
  assert.equal(report.eventCount, 1);
  assert.equal(report.events[0].collaborators, "Club A");
  assert.equal(JSON.stringify(report).includes("hidden"), false);
  assert.equal(JSON.stringify(report).includes("private"), false);
  assert.equal(Object.hasOwn(report.events[0], "id"), false);
});

test("report model handles unknown collaborators, missing directors, invalid selections, and limits", () => {
  const unknown = event("unknown", { collaborators: [], collaboratorsKnown: false });
  const report = buildBodAvenueReportModel({ month: "2026-07", avenueCode: "CMD", events: [unknown], selectedEventIds: ["unknown"] });
  assert.equal(report.directorText, "Not available");
  assert.equal(report.events[0].collaborators, "Not available");
  assert.throws(() => buildBodAvenueReportModel({ month: "", avenueCode: "CMD", events: [unknown], selectedEventIds: ["unknown"] }), /month/i);
  assert.throws(() => buildBodAvenueReportModel({ month: "2026-07", avenueCode: "", events: [unknown], selectedEventIds: ["unknown"] }), /avenue/i);
  assert.throws(() => buildBodAvenueReportModel({ month: "2026-07", avenueCode: "CMD", events: [unknown], selectedEventIds: [] }), /select/i);
  const many = Array.from({ length: BOD_AVENUE_REPORT_LIMIT + 1 }, (_, index) => event(`e-${index}`));
  assert.throws(() => buildBodAvenueReportModel({ month: "2026-07", avenueCode: "CMD", events: many, selectedEventIds: many.map((item) => item.id) }), /limited/i);
});

test("month and filename formatting are deterministic and filesystem-safe", () => {
  assert.equal(formatBodReportMonth("2026-07"), "July 2026");
  assert.equal(getBodAvenueReportFilename({ avenueLabel: "Community: Service / Avenue", monthLabel: "July 2026" }), "RCPH-Community-Service-Avenue-July-2026-Report.pdf");
});
