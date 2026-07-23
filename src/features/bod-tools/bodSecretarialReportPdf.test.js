import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildBodSecretarialReportModel } from "./bodSecretarialReportModel.js";
import {
  BOD_AVENUE_REPORT_LETTERHEAD_URL,
} from "./bodAvenueReportPdf.js";
import {
  BOD_SECRETARIAL_REPORT_LETTERHEAD_URL,
  BOD_SECRETARIAL_REPORT_FRAME_URL,
  buildBodSecretarialReportPdfDocument,
  buildBodSecretarialReportPdfPages,
  getBodSecretarialReportFilename,
} from "./bodSecretarialReportPdf.js";

const source = readFileSync(new URL("./bodSecretarialReportPdf.js", import.meta.url), "utf8");
const decodePdf = (bytes) => new TextDecoder("latin1").decode(bytes);
const occurrences = (value, pattern) => value.match(pattern)?.length || 0;

const MOCK_LETTERHEAD = Object.freeze({
  bytes: new Uint8Array([0x78, 0x9c, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01]),
  width: 1414,
  height: 2000,
  bitsPerComponent: 8,
  colorSpace: "DeviceRGB",
  colors: 3,
});

const MOCK_FRAME = Object.freeze({
  bytes: new Uint8Array([
    245, 244, 238, 245, 244, 238,
    128, 18, 48, 128, 18, 48,
  ]),
  width: 2,
  height: 2,
  bitsPerComponent: 8,
  colorSpace: "DeviceRGB",
  colors: 3,
  raw: true,
});

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
  const pdf = decodePdf(buildBodSecretarialReportPdfDocument(report(), MOCK_LETTERHEAD, MOCK_FRAME));
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

test("secretarial PDF uses the shared BOD Avenue Report letterhead asset and background XObject", () => {
  const pages = buildBodSecretarialReportPdfPages(report(), { frame: MOCK_FRAME });
  const pdf = decodePdf(buildBodSecretarialReportPdfDocument(report(), MOCK_LETTERHEAD, MOCK_FRAME));
  assert.equal(BOD_SECRETARIAL_REPORT_LETTERHEAD_URL, BOD_AVENUE_REPORT_LETTERHEAD_URL);
  assert.match(source, /BOD_AVENUE_REPORT_LETTERHEAD_URL/);
  assert.match(source, /getBodAvenueReportLetterheadPng/);
  assert.match(pdf, /^%PDF-1\.4/);
  assert.match(pdf, /\/MediaBox \[0 0 595 842\]/);
  assert.equal(occurrences(pdf, /\/Subtype \/Image/g), 2);
  assert.equal(occurrences(pdf, /\/XObject << \/BG 5 0 R \/FRAME 6 0 R >>/g), pages.length);
  assert.equal(occurrences(pdf, /\/BG Do/g), pages.length);
  assert.equal(occurrences(pdf, /\/FRAME Do/g), 1);
  assert.match(pdf, /595\.00 0 0 841\.58 0\.00 0\.21 cm/);
  assert.match(pdf, /Page 1 of 2/);
});

test("secretarial page one uses the uploaded frame image with stacked centered stat lines", () => {
  const pages = buildBodSecretarialReportPdfPages(report(), { frame: MOCK_FRAME });
  const firstPage = pages[0].join("\n");
  assert.equal(BOD_SECRETARIAL_REPORT_FRAME_URL, "/images/Report_Frame.png");
  assert.match(source, /Report_Frame\.png/);
  assert.match(firstPage, /\/FRAME Do/);
  for (const text of [
    "Monthly Report RCPH RIY 26 - 27",
    "Club Strength:",
    "42",
    "Club Score:",
    "91",
    "Club Rank \\(As of Now\\):",
    "3",
    "Overall Projects:",
    "1",
    "No. of meetings \\(BOD\\):",
    "No. of meetings \\(GBM\\):",
  ]) assert.equal(firstPage.includes(text), true, text);

  assert.match(source, /frameInset:\s*30/);
  assert.match(source, /frameStatSize:\s*14/);
  assert.match(source, /centerInlineText/);
  assert.doesNotMatch(firstPage, /Period:/);
  assert.doesNotMatch(firstPage, /Date|Director|Total events/);
  assert.doesNotMatch(firstPage, /\bre f\b| m .* l S/);
});

test("secretarial PDF contains month headings and meetings table headers", () => {
  const pdf = decodePdf(buildBodSecretarialReportPdfDocument(report(), MOCK_LETTERHEAD, MOCK_FRAME));
  for (const text of ["Monthly Report: July 2026", "Sr. No.", "Type", "Date", "Description"]) {
    assert.match(pdf, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("secretarial PDF contains events table headers", () => {
  const pdf = decodePdf(buildBodSecretarialReportPdfDocument(report(), MOCK_LETTERHEAD, MOCK_FRAME));
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
  const pages = buildBodSecretarialReportPdfPages(model, { frame: MOCK_FRAME });
  assert.equal(pages.length, 3);
  assert.match(pages[1].join("\n"), /Monthly Report: July 2026/);
  assert.match(pages[2].join("\n"), /Monthly Report: August 2026/);
});

test("overflowing month content continues on letterhead pages with repeated table headers", () => {
  const model = report({
    events: Array.from({ length: 28 }, (_, index) => clubEvent(`overflow-${index + 1}`, {
      startDate: `2026-07-${String((index % 20) + 1).padStart(2, "0")}`,
      name: `Overflow Project ${index + 1}`,
      description: "Overflow detail ".repeat(15),
    })),
  });
  const pages = buildBodSecretarialReportPdfPages(model, { frame: MOCK_FRAME });
  const pdf = decodePdf(buildBodSecretarialReportPdfDocument(model, MOCK_LETTERHEAD, MOCK_FRAME));
  assert.ok(pages.length > 2);
  assert.equal(occurrences(pdf, /\/BG Do/g), pages.length);
  assert.equal(occurrences(pdf, /\/FRAME Do/g), 1);
  assert.ok(pages.slice(1).every((page) => page.join("\n").includes("Description")));
});

test("long descriptions do not throw during PDF generation", () => {
  const model = report({
    events: [
      bodMeeting("long-bod", { description: "Long meeting detail ".repeat(1000) }),
      clubEvent("long-project", { description: "Long project detail ".repeat(1000) }),
    ],
  });
  assert.doesNotThrow(() => buildBodSecretarialReportPdfDocument(model, MOCK_LETTERHEAD, MOCK_FRAME));
  assert.match(decodePdf(buildBodSecretarialReportPdfDocument(model, MOCK_LETTERHEAD, MOCK_FRAME)), /^%PDF-1\.4/);
});

test("secretarial PDF filename is period based and ends with pdf", () => {
  assert.equal(getBodSecretarialReportFilename(report()), "RCPH-Secretarial-Report-July-2026.pdf");
  assert.match(getBodSecretarialReportFilename(report()), /\.pdf$/);
});
