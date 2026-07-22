import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  BOD_SECRETARIAL_REPORT_TITLE,
  buildBodSecretarialReportModel,
} from "./bodSecretarialReportModel.js";

const source = readFileSync(new URL("./bodSecretarialReportModel.js", import.meta.url), "utf8");

const clubEvent = (id, overrides = {}) => ({
  id,
  name: `Event ${id}`,
  startDate: "2026-07-01",
  recordKind: "clubEvent",
  isActive: true,
  archived: false,
  avenues: ["CMD"],
  description: "Event description",
  avenueDescriptions: {},
  ...overrides,
});

const bodMeeting = (id, overrides = {}) => ({
  id,
  name: `BOD ${id}`,
  date: "2026-07-12",
  recordKind: "bodMeeting",
  type: "bodMeeting",
  isActive: true,
  archived: false,
  description: "BOD meeting notes",
  ...overrides,
});

function buildReport(options = {}) {
  return buildBodSecretarialReportModel({
    events: [],
    selectedMonths: ["2026-07"],
    clubScore: " 91 ",
    clubRank: " 3 ",
    metrics: { clubStrength: "42" },
    generatedAt: "2026-07-31T10:00:00.000Z",
    ...options,
  });
}

test("builds the RIY summary title and selected month heading", () => {
  const report = buildReport();
  assert.equal(BOD_SECRETARIAL_REPORT_TITLE, "Monthly Report RCPH RIY 26 - 27");
  assert.equal(report.title, "Monthly Report RCPH RIY 26 - 27");
  assert.equal(report.clubStrength, 42);
  assert.equal(report.clubScore, "91");
  assert.equal(report.clubRank, "3");
  assert.deepEqual(report.selectedMonths, ["2026-07"]);
  assert.equal(report.periodLabel, "July 2026");
  assert.equal(report.generatedAt, "2026-07-31T10:00:00.000Z");
  assert.equal(report.months[0].monthLabel, "July 2026");
  assert.equal(report.months[0].heading, "Monthly Report: July 2026");
  assert.deepEqual(report.months[0].meetings, []);
  assert.deepEqual(report.months[0].events, []);
});

test("classifies BOD meetings, GBM meetings, and normal projects with deterministic numbering", () => {
  const report = buildReport({
    events: [
      clubEvent("project-2", {
        startDate: "2026-07-03",
        avenues: undefined,
        avenue: "PDD",
        name: "Skill Workshop",
        description: "",
        desc: "Workshop report text",
      }),
      bodMeeting("bod-2", { date: "2026-07-10", description: "Board review" }),
      clubEvent("gbm-1", {
        startDate: "2026-07-07",
        avenues: ["GBM"],
        name: "Charge Handover Ceremony",
        description: "",
      }),
      clubEvent("project-1", {
        startDate: "2026-07-01",
        avenues: ["RRRO", "CMD"],
        name: "Blood Donation Camp",
        description: "Public project summary",
        avenueDescriptions: { CMD: "Community-specific project report" },
      }),
      bodMeeting("bod-1", { date: "2026-07-05", description: "Budget planning" }),
      clubEvent("gbm-2", {
        startDate: "2026-07-20",
        avenues: ["GBM"],
        name: "Monthly GBM",
        description: "",
        desc: "Monthly fellowship",
      }),
    ],
  });

  const july = report.months[0];
  assert.deepEqual(july.meetings.map((row) => [row.serial, row.type, row.dateLabel, row.description]), [
    [1, "BOD - 1", "05/07/26", "Budget planning"],
    [2, "GBM - 1", "07/07/26", "Charge Handover Ceremony"],
    [3, "BOD - 2", "10/07/26", "Board review"],
    [4, "GBM - 2", "20/07/26", "Monthly fellowship"],
  ]);
  assert.deepEqual(july.events.map((row) => [row.serial, row.avenueLabel, row.dateLabel, row.name, row.description]), [
    [1, "CMD + RRRO", "01/07/26", "Blood Donation Camp", "Community-specific project report"],
    [2, "PDD", "03/07/26", "Skill Workshop", "Workshop report text"],
  ]);
  assert.equal(report.overallProjects, 2);
  assert.equal(report.bodMeetingCount, 2);
  assert.equal(report.gbmMeetingCount, 2);
});

test("creates separate month sections for multiple selected months", () => {
  const report = buildReport({
    selectedMonths: ["2026-08", "2026-07"],
    events: [
      bodMeeting("july-bod", { date: "2026-07-09", description: "July board notes" }),
      clubEvent("aug-project", { startDate: "2026-08-02", avenues: ["PRO"], name: "PR Drive" }),
    ],
  });
  assert.deepEqual(report.months.map((month) => month.month), ["2026-07", "2026-08"]);
  assert.equal(report.periodLabel, "July-August 2026");
  assert.equal(report.months[0].heading, "Monthly Report: July 2026");
  assert.equal(report.months[0].meetings.length, 1);
  assert.equal(report.months[0].events.length, 0);
  assert.equal(report.months[1].heading, "Monthly Report: August 2026");
  assert.equal(report.months[1].meetings.length, 0);
  assert.equal(report.months[1].events.length, 1);
});

test("skips invalid, inactive, archived, and removed records safely", () => {
  const report = buildReport({
    events: [
      clubEvent("active"),
      clubEvent("inactive", { isActive: false }),
      clubEvent("archived", { archived: true }),
      clubEvent("removed-gbm", { removed: true, avenues: ["GBM"] }),
      bodMeeting("deleted-bod", { deleted: true }),
      clubEvent("bad-date", { startDate: "July 5" }),
      { id: "unknown", recordKind: "districtEvent", startDate: "2026-07-04", isActive: true },
    ],
  });
  assert.deepEqual(report.months[0].events.map((row) => row.name), ["Event active"]);
  assert.deepEqual(report.months[0].meetings, []);
  assert.equal(JSON.stringify(report).includes("districtEvent"), false);
});

test("validates required inputs and generated timestamp", () => {
  assert.throws(() => buildReport({ selectedMonths: ["2026-13"] }), /month/i);
  assert.throws(() => buildReport({ clubScore: " " }), /score/i);
  assert.throws(() => buildReport({ clubRank: "" }), /rank/i);
  assert.throws(() => buildReport({ generatedAt: "not-a-date" }), /timestamp/i);
  assert.equal(buildReport({ metrics: { clubStrength: "" } }).clubStrength, "Not available");
  assert.equal(buildReport({ metrics: { clubStrength: "not numeric" } }).clubStrength, "Not available");
});

test("model has no backend, PDF, or PPT dependencies", () => {
  assert.doesNotMatch(source, /firebase|httpsCallable|functions|backend/i);
  assert.doesNotMatch(source, /ppt|pptx|powerpoint/i);
  assert.doesNotMatch(source, /bodAvenueReportPdf|bodSecretarialReportPpt|package\.json/i);
});
