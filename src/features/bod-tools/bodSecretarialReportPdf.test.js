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
import {
  BOD_FOCUS_AREA_CATEGORY_ASCEND,
  BOD_FOCUS_AREA_CATEGORY_OTHER,
  BOD_FOCUS_AREA_CATEGORY_ROTARY,
} from "./bodFocusAreas.js";

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

const letterheadExchange = (id, overrides = {}) => ({
  id,
  exchangeDate: "2026-07-18",
  exchangeMonth: "2026-07",
  externalParticipants: [
    { clubName: "Rotaract Club A", rotaractorName: "External One", position: "President", rotaractDistrictId: "3131" },
  ],
  rcphRepresentatives: [{ name: "RCPH One" }],
  associatedEvent: null,
  other: "",
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

test("secretarial PDF conditionally renders optional Club Score and Club Rank rows", () => {
  const firstPage = (options) => buildBodSecretarialReportPdfPages(report(options), { frame: MOCK_FRAME })[0].join("\n");
  const both = firstPage({ clubScore: "91", clubRank: "3" });
  assert.match(both, /Club Score:/);
  assert.equal(both.includes("Club Rank \\(As of Now\\):"), true);

  const scoreOnly = firstPage({ clubScore: "91", clubRank: "" });
  assert.match(scoreOnly, /Club Score:/);
  assert.equal(scoreOnly.includes("Club Rank \\(As of Now\\):"), false);

  const rankOnly = firstPage({ clubScore: "", clubRank: "3" });
  assert.doesNotMatch(rankOnly, /Club Score:/);
  assert.equal(rankOnly.includes("Club Rank \\(As of Now\\):"), true);

  const neither = firstPage({ clubScore: "", clubRank: "" });
  assert.doesNotMatch(neither, /Club Score:/);
  assert.equal(neither.includes("Club Rank \\(As of Now\\):"), false);
  for (const output of [scoreOnly, rankOnly, neither]) {
    assert.doesNotMatch(output, /N\/A|undefined|null/);
  }
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

test("secretarial PDF renders Focus Areas and Ascend Chapters under event or meeting names", () => {
  const model = report({
    events: [
      bodMeeting("focus-bod", {
        description: "Board focus discussion",
        focusAreas: [
          { category: BOD_FOCUS_AREA_CATEGORY_ASCEND, value: "Finance" },
        ],
      }),
      clubEvent("focus-project", {
        name: "Tree Plantation",
        description: "Project focus description",
        hostClub: "Rotaract Club of Pune Heritage",
        collaborators: [{ name: "Partner Club" }],
        focusAreas: [
          { category: BOD_FOCUS_AREA_CATEGORY_ROTARY, value: "Environment" },
          { category: BOD_FOCUS_AREA_CATEGORY_ASCEND, value: "Media" },
        ],
      }),
    ],
  });

  const pdf = decodePdf(
    buildBodSecretarialReportPdfDocument(model, MOCK_LETTERHEAD, MOCK_FRAME),
  );

  for (const text of [
    "Focus Area:",
    "Environment",
    "Chapter:",
    "Finance",
    "Media",
    "Board focus discussion",
    "Project focus description",
    "Host:",
    "Rotaract Club of Pune Heritage",
    "Collaborators:",
    "Partner Club",
  ]) {
    assert.match(pdf, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.doesNotMatch(pdf, /\(Description:\) Tj ET/);

  for (const label of ["Focus Area:", "Chapter:", "Host:", "Collaborators:"]) {
    assert.match(
      pdf,
      new RegExp(`/F2 9 Tf [^\\n]*\\(${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\) Tj ET`),
    );
  }

  assert.ok(occurrences(pdf, /\(Chapter:\) Tj ET/g) >= 2);
});

test("secretarial PDF custom Other Focus Areas use custom report text only", () => {
  const model = report({
    events: [
      clubEvent("custom-focus", {
        focusAreas: [
          { category: BOD_FOCUS_AREA_CATEGORY_OTHER, value: "District Grant Partnerships" },
        ],
      }),
    ],
  });

  const pdf = decodePdf(
    buildBodSecretarialReportPdfDocument(model, MOCK_LETTERHEAD, MOCK_FRAME),
  );

  assert.match(pdf, /Focus Area:/);
  assert.match(pdf, /\(District\) Tj ET/);
  assert.match(pdf, /\(Grant\) Tj ET/);
  assert.match(pdf, /\(Partnership\) Tj ET/);
  assert.doesNotMatch(pdf, /\(Chapter:\) Tj ET/);
  assert.doesNotMatch(pdf, /\(Other\) Tj ET/);
});

test("secretarial PDF without Focus Areas omits classification and Description prefixes", () => {
  const pdf = decodePdf(
    buildBodSecretarialReportPdfDocument(report(), MOCK_LETTERHEAD, MOCK_FRAME),
  );

  assert.doesNotMatch(pdf, /\(Focus Area:\) Tj ET/);
  assert.doesNotMatch(pdf, /\(Chapter:\) Tj ET/);
  assert.doesNotMatch(pdf, /\(Description:\) Tj ET/);

  assert.match(pdf, /\/F2 9 Tf [^\n]*\(Host:\) Tj ET/);
  assert.match(pdf, /\/F2 9 Tf [^\n]*\(Collaborators:\) Tj ET/);
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

test("secretarial Letterhead section is absent unless explicitly included", () => {
  const pdf = decodePdf(buildBodSecretarialReportPdfDocument(report(), MOCK_LETTERHEAD, MOCK_FRAME));
  assert.doesNotMatch(pdf, /LETTERHEAD EXCHANGES/);
  assert.doesNotMatch(pdf, /No Letterhead Exchanges were recorded/);
});

test("secretarial Letterhead section renders last with zero-record message", () => {
  const model = report({ includeLetterheadExchanges: true, letterheadExchanges: [] });
  const pdf = decodePdf(buildBodSecretarialReportPdfDocument(model, MOCK_LETTERHEAD, MOCK_FRAME));
  assert.match(pdf, /LETTERHEAD EXCHANGES/);
  assert.match(pdf, /No Letterhead Exchanges were recorded for the selected reporting period\./);
  assert.ok(pdf.indexOf("2. Events") < pdf.indexOf("LETTERHEAD EXCHANGES"));
});

test("secretarial Letterhead table renders participants, representatives, RID, event, and remarks", () => {
  const model = report({
    includeLetterheadExchanges: true,
    letterheadExchanges: [
      letterheadExchange("exchange-1", {
        externalParticipants: [
          { clubName: "Rotaract Club A", rotaractorName: "External One", position: "President", rotaractDistrictId: "3131" },
          { clubName: "Rotaract Club A", rotaractorName: "External Two", position: "", rotaractDistrictId: "3131" },
          { clubName: "Rotaract Club B", rotaractorName: "External Three", position: "Secretary", rotaractDistrictId: "" },
          { clubName: "Rotaract Club C", rotaractorName: "External Four", position: "", rotaractDistrictId: "" },
        ],
        rcphRepresentatives: [{ name: "RCPH One" }, { name: "RCPH Two" }],
        associatedEvent: { label: "July GBM", date: "2026-07-12" },
        other: "Exchanged letterheads after fellowship",
      }),
      letterheadExchange("exchange-2", {
        exchangeDate: "2026-07-19",
        associatedEvent: null,
        other: "Remarks only",
      }),
    ],
  });
  const pdf = decodePdf(buildBodSecretarialReportPdfDocument(model, MOCK_LETTERHEAD, MOCK_FRAME));
  for (const text of [
    "Date",
    "Club",
    "Rotaractor",
    "Position / RID",
    "Associated Event / Remarks",
    "External One",
    "External Two",
    "External Four",
    "President",
    "RID: 3131",
    "Secretary",
    "RCPH One, RCPH Two",
    "July GBM",
    "Remarks only",
    "Not available",
  ]) assert.match(pdf, new RegExp(text));
  assert.match(pdf, /\(External\) Tj ET[\s\S]*\(Three\) Tj ET/);
  assert.match(pdf, /Remarks: Exchanged/);
  assert.match(pdf, /letterheads after/);
  assert.match(pdf, /fellowship/);
  assert.equal(pdf.includes("RCPH Representative\\(s\\)"), true);
  assert.ok(occurrences(pdf, /Rotaract Club/g) >= 5);
  assert.doesNotMatch(pdf, /undefined|null|RID:\s*\)/);
});

test("secretarial Letterhead table paginates long final sections with repeated headers", () => {
  const exchanges = Array.from({ length: 54 }, (_, index) => letterheadExchange(`exchange-${index + 1}`, {
    exchangeDate: `2026-07-${String((index % 20) + 1).padStart(2, "0")}`,
    externalParticipants: [{
      clubName: `Very Long Rotaract Club Name ${index + 1} For Cross District Fellowship`,
      rotaractorName: `External Participant With Long Name ${index + 1}`,
      position: index % 3 === 0 ? "President" : "",
      rotaractDistrictId: index % 3 === 1 ? "3131" : "",
    }],
    rcphRepresentatives: [{ name: "RCPH One" }, { name: "RCPH Two" }],
    associatedEvent: index % 2 ? null : { label: `Long Associated Event Name ${index + 1}` },
    other: "Long remarks ".repeat(12),
  }));
  const model = report({
    events: Array.from({ length: 14 }, (_, index) => clubEvent(`project-${index + 1}`, {
      startDate: `2026-07-${String((index % 20) + 1).padStart(2, "0")}`,
      description: "Existing Secretarial content ".repeat(20),
    })),
    includeLetterheadExchanges: true,
    letterheadExchanges: exchanges,
  });
  const pages = buildBodSecretarialReportPdfPages(model, { frame: MOCK_FRAME });
  const pdf = decodePdf(buildBodSecretarialReportPdfDocument(model, MOCK_LETTERHEAD, MOCK_FRAME));
  assert.ok(pages.length > 4);
  assert.ok(occurrences(pdf, /LETTERHEAD EXCHANGES/g) >= 1);
  assert.ok(occurrences(pdf, /RCPH Representative\\\(s\\\)/g) > 1);
  assert.match(pdf, /Page 1 of \d+/);
  assert.doesNotMatch(pdf, /undefined|null/);
});

test("long descriptions do not throw during PDF generation", () => {
  const model = report({
    events: [
      bodMeeting("long-bod", {
        description: "Long meeting detail ".repeat(1000),
        focusAreas: [{ category: BOD_FOCUS_AREA_CATEGORY_ASCEND, value: "Finance" }],
      }),
      clubEvent("long-project", {
        description: "Long project detail ".repeat(1000),
        focusAreas: [
          { category: BOD_FOCUS_AREA_CATEGORY_ROTARY, value: "Environment" },
          { category: BOD_FOCUS_AREA_CATEGORY_OTHER, value: "District Grant Partnerships" },
        ],
      }),
    ],
  });
  assert.doesNotThrow(() => buildBodSecretarialReportPdfDocument(model, MOCK_LETTERHEAD, MOCK_FRAME));
  assert.match(decodePdf(buildBodSecretarialReportPdfDocument(model, MOCK_LETTERHEAD, MOCK_FRAME)), /^%PDF-1\.4/);
});

test("secretarial PDF filename is period based and ends with pdf", () => {
  assert.equal(getBodSecretarialReportFilename(report()), "RCPH-Secretarial-Report-July-2026.pdf");
  assert.match(getBodSecretarialReportFilename(report()), /\.pdf$/);
});
