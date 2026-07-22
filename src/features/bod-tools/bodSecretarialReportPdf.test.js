import assert from "node:assert/strict";
import test from "node:test";
import { buildBodSecretarialReportModel } from "./bodSecretarialReportModel.js";
import {
  buildBodSecretarialReportPdfDocument,
  buildBodSecretarialReportPdfPages,
  getBodSecretarialReportFilename,
} from "./bodSecretarialReportPdf.js";

const clubEvent = (id, overrides = {}) => ({
  id,
  name: `Event ${id}`,
  startDate: "2026-07-08",
  recordKind: "clubEvent",
  isActive: true,
  archived: false,
  avenues: ["CMD"],
  description: "Event report description",
  avenueDescriptions: {},
  ...overrides,
});

const bodMeeting = (id, overrides = {}) => ({
  id,
  name: `BOD ${id}`,
  date: "2026-07-05",
  recordKind: "bodMeeting",
  type: "bodMeeting",
  isActive: true,
  archived: false,
  description: "Board meeting description",
  ...overrides,
});

function report(options = {}) {
  return buildBodSecretarialReportModel({
    selectedMonths: ["2026-07"],
    clubScore: "91",
    clubRank: "3",
    metrics: { clubStrength: 42 },
    generatedAt: "2026-07-31T10:00:00.000Z",
    events: [
      bodMeeting("july-bod"),
      clubEvent("july-gbm", { startDate: "2026-07-12", avenues: ["GBM"], name: "July GBM" }),
      clubEvent("july-project", { name: "Service Project" }),
    ],
    ...options,
  });
}

test("secretarial PDF contains the summary metrics page", () => {
  const pdf = buildBodSecretarialReportPdfDocument(report());
  for (const text of [
    "Monthly Report RCPH RIY 26 - 27",
    "Club Strength",
    "42",
    "Club Score",
    "91",
    "Club Rank",
    "Overall Projects",
    "No. of meetings",
    "BOD",
    "GBM",
  ]) assert.match(pdf, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("secretarial PDF contains month headings and meetings table headers", () => {
  const pdf = buildBodSecretarialReportPdfDocument(report());
  for (const text of ["Monthly Report: July 2026", "Sr. No.", "Type", "Date", "Description"]) {
    assert.match(pdf, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("secretarial PDF contains events table headers", () => {
  const pdf = buildBodSecretarialReportPdfDocument(report());
  for (const text of ["Sr. No.", "Avenue", "Date", "Name", "Description"]) {
    assert.match(pdf, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("multi-month reports create separate month pages", () => {
  const model = report({
    selectedMonths: ["2026-07", "2026-08"],
    events: [
      bodMeeting("july-bod"),
      clubEvent("august-project", { startDate: "2026-08-03", name: "August Project", avenues: ["PDD"] }),
    ],
  });
  const pages = buildBodSecretarialReportPdfPages(model);
  assert.equal(pages.length, 3);
  assert.match(pages[1].join("\n"), /Monthly Report: July 2026/);
  assert.match(pages[2].join("\n"), /Monthly Report: August 2026/);
});

test("long descriptions do not throw during PDF generation", () => {
  const model = report({
    events: [
      bodMeeting("long-bod", { description: "Long meeting detail ".repeat(1000) }),
      clubEvent("long-project", { description: "Long project detail ".repeat(1000) }),
    ],
  });
  assert.doesNotThrow(() => buildBodSecretarialReportPdfDocument(model));
  assert.match(buildBodSecretarialReportPdfDocument(model), /^%PDF-1\.4/);
});

test("secretarial PDF filename is period based and ends with pdf", () => {
  assert.equal(getBodSecretarialReportFilename(report()), "RCPH-Secretarial-Report-July-2026.pdf");
  assert.match(getBodSecretarialReportFilename(report()), /\.pdf$/);
});
