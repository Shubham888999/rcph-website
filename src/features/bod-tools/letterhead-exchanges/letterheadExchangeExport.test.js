import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getBodAvenueReportFilename } from "../bodAvenueReportModel.js";
import { buildBodAvenueReportPdfDocument, buildBodAvenueReportPdfPages } from "../bodAvenueReportPdf.js";
import {
  buildLetterheadExchangeExportReport,
  exchangeMonthOptions,
  exchangeRepresentativeOptions,
  exportPeriodLabel,
  filterExportExchanges,
  summarizeExportExchanges,
} from "./letterheadExchangeExportModel.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const panelSource = read("./LetterheadExchangeExportPanel.jsx");
const tabsSource = read("./BodLetterheadExchangePanel.jsx");
const LETTERHEAD = { bytes: new Uint8Array([0x78, 0x9c, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01]), width: 1, height: 1, colorSpace: "DeviceRGB", bitsPerComponent: 8, colors: 3 };
const decode = (bytes) => new TextDecoder("latin1").decode(bytes);

const exchange = (id, date, club, reps, extra = {}) => ({
  id,
  exchangeDate: date,
  exchangeMonth: date.slice(0, 7),
  externalParticipants: [{ clubName: club, rotaractorName: `Rtr. ${club}`, position: "President", rotaractDistrictId: "3030" }],
  rcphRepresentatives: reps.map((name) => ({ name })),
  associatedEvent: null,
  other: "",
  imageCount: 0,
  reportImage: null,
  ...extra,
});

const EXCHANGES = [
  exchange("e3", "2026-10-20", "Rotaract Club of Nashik", ["Aarya Godbole"], { imageCount: 2, reportImage: { imageId: "img1", fileName: "a.jpg", mimeType: "image/jpeg" } }),
  exchange("e1", "2026-09-02", "Rotaract Club of Kothrud", ["Soham Naik", "Aarya Godbole"], { imageCount: 1 }),
  exchange("e2", "2026-10-05", "Rotaract Club of Pune Metro", ["Soham Naik"]),
];

test("months are newest first with counts, and representatives are listed once", () => {
  assert.deepEqual(exchangeMonthOptions(EXCHANGES), [{ value: "2026-10", label: "October 2026", count: 2 }, { value: "2026-09", label: "September 2026", count: 1 }]);
  assert.deepEqual(exchangeRepresentativeOptions(EXCHANGES), ["Aarya Godbole", "Soham Naik"]);
});

test("club search and representative filters combine, ignoring case", () => {
  assert.deepEqual(filterExportExchanges(EXCHANGES, { clubQuery: "NASHIK" }).map((item) => item.id), ["e3"]);
  assert.deepEqual(filterExportExchanges(EXCHANGES, { representative: "soham naik" }).map((item) => item.id), ["e1", "e2"]);
  assert.deepEqual(filterExportExchanges(EXCHANGES, { clubQuery: "pune", representative: "Soham Naik" }).map((item) => item.id), ["e2"]);
  assert.equal(filterExportExchanges(EXCHANGES, {}).length, 3);
});

test("the summary counts report photos and photos with none chosen", () => {
  assert.deepEqual(summarizeExportExchanges(EXCHANGES), { total: 3, withReportPhoto: 1, missingReportPhoto: 1 });
});

test("the period reads as one month or a range", () => {
  assert.equal(exportPeriodLabel(["2026-10"]), "October 2026");
  assert.equal(exportPeriodLabel(["2026-10", "2026-08"]), "August 2026 to October 2026");
  assert.equal(exportPeriodLabel([]), "");
});

test("the report keeps date order, one block per exchange, and photos only when asked", () => {
  const withPhotos = buildLetterheadExchangeExportReport({ exchanges: EXCHANGES, months: ["2026-09", "2026-10"], includePhotos: true });
  assert.equal(withPhotos.title, "Letterhead Exchange Report");
  assert.equal(withPhotos.exchangeCount, 3);
  assert.deepEqual(withPhotos.letterheadExchangeBlocks.map((block) => block.exchangeId), ["e1", "e2", "e3"]);
  assert.equal(withPhotos.letterheadExchangeBlocks[2].reportImageKey, "letterhead:e3");
  const without = buildLetterheadExchangeExportReport({ exchanges: EXCHANGES, months: ["2026-10"], includePhotos: false });
  assert.ok(without.letterheadExchangeBlocks.every((block) => block.reportImageKey === ""));
  assert.throws(() => buildLetterheadExchangeExportReport({ exchanges: [], months: ["2026-10"] }), /no Letterhead Exchanges/);
});

test("the PDF has the title, period, every exchange and numbered pages, with no events needed", () => {
  const report = buildLetterheadExchangeExportReport({ exchanges: EXCHANGES, months: ["2026-09", "2026-10"], includePhotos: false, generatedAt: new Date("2026-10-26T10:00:00Z") });
  const pages = buildBodAvenueReportPdfPages(report);
  assert.ok(pages.length >= 1);
  const pdf = decode(buildBodAvenueReportPdfDocument(report, LETTERHEAD));
  assert.match(pdf, /\(Letterhead Exchange Report\)/);
  assert.match(pdf, /\(September 2026 to October 2026\)/);
  assert.match(pdf, /LETTERHEAD EXCHANGES/);
  ["Kothrud", "Metro", "Nashik"].forEach((club) => assert.match(pdf, new RegExp(club)));
  assert.match(pdf, /Page 1 of \d+/);
});

test("avenue reports still need events", () => {
  assert.throws(() => buildBodAvenueReportPdfPages({ events: [], eventCount: 0 }), /non-empty report model/);
});

test("the file is named for the period", () => {
  assert.equal(getBodAvenueReportFilename(buildLetterheadExchangeExportReport({ exchanges: EXCHANGES, months: ["2026-10"] })), "RCPH-Letterhead-Exchange-Report-October-2026.pdf");
  assert.equal(getBodAvenueReportFilename(buildLetterheadExchangeExportReport({ exchanges: EXCHANGES, months: ["2026-09", "2026-10"] })), "RCPH-Letterhead-Exchange-Report-September-2026-to-October-2026.pdf");
});

test("the Export report tab loads exchanges, offers the filters and downloads through the report builder", () => {
  assert.match(tabsSource, /aria-pressed=\{tab === "export"\} onClick=\{\(\) => setTab\("export"\)\}>Export report</);
  assert.match(tabsSource, /\{tab === "export" \? <LetterheadExchangeExportPanel \/> : null\}/);
  assert.match(panelSource, /listLetterheadExchanges\(\{ limit: 100 \}\)/);
  assert.match(panelSource, /getLetterheadExchangesForReport\(months\)/);
  assert.match(panelSource, /type="search"/);
  assert.match(panelSource, /Include photos/);
  assert.match(panelSource, /downloadBodAvenueReportPdf\(report, \{ imagesByEventId \}\)/);
  assert.match(panelSource, /disabled=\{!canDownload\}/);
});
