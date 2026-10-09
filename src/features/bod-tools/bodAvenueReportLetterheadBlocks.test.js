import assert from "node:assert/strict";
import test from "node:test";
import { buildBodAvenueReportModel, buildLetterheadExchangeReportBlocks } from "./bodAvenueReportModel.js";
import {
  BOD_AVENUE_REPORT_LAYOUT,
  buildBodAvenueReportPdfDocument,
  buildBodAvenueReportPdfPages,
} from "./bodAvenueReportPdf.js";

const MOCK_LETTERHEAD = Object.freeze({
  bytes: new Uint8Array([0x78, 0x9c, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01]),
  width: 1414,
  height: 2000,
  bitsPerComponent: 8,
  colorSpace: "DeviceRGB",
  colors: 3,
});

const decodePdf = (bytes) => new TextDecoder("latin1").decode(bytes);

function preparedImage(key, width = 1200, height = 900) {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, ...new TextEncoder().encode(`RCPH-IMAGE-${key}`)]);
  return { eventId: key, mimeType: "image/jpeg", width, height, sizeBytes: bytes.length, arrayBuffer: bytes.buffer };
}

function isdEvent() {
  return {
    id: "ISD",
    name: "Project ISD",
    startDate: "2026-07-09",
    recordKind: "clubEvent",
    isActive: true,
    archived: false,
    avenues: ["ISD"],
    rcphRole: "host",
    hostClub: "Rotaract Club of Pune Heritage",
    collaborators: [],
    collaboratorsKnown: true,
    description: "International service activity",
    avenueDescriptions: {},
  };
}

function letterheadExchange(id, overrides = {}) {
  return {
    id,
    exchangeDate: "2026-07-12",
    exchangeMonth: "2026-07",
    externalParticipants: [{ clubName: `Partner ${id}`, rotaractorName: `Rotaractor ${id}`, position: "President", rotaractDistrictId: "3131" }],
    rcphRepresentatives: [{ name: "Aarav Joshi" }],
    associatedEvent: null,
    other: "",
    imageCount: 0,
    reportImage: null,
    ...overrides,
  };
}

const PHOTO = Object.freeze({ imageId: "img-1", fileName: "photo.jpg", mimeType: "image/jpeg" });

function fixtureExchanges() {
  return [
    letterheadExchange("no-photos", { exchangeDate: "2026-07-20" }),
    letterheadExchange("with-photo", { exchangeDate: "2026-07-03", imageCount: 1, reportImage: PHOTO, associatedEvent: { name: "Fellowship Night" } }),
    letterheadExchange("unselected", { exchangeDate: "2026-07-10", imageCount: 3, reportImage: null }),
    letterheadExchange("two-clubs", {
      exchangeDate: "2026-07-15",
      imageCount: 1,
      reportImage: { ...PHOTO, imageId: "img-2" },
      externalParticipants: [
        { clubName: "Rotaract Club A", rotaractorName: "Person A", position: "", rotaractDistrictId: "" },
        { clubName: "Rotaract Club B", rotaractorName: "Person B", position: "Secretary", rotaractDistrictId: "3132" },
      ],
    }),
  ];
}

function model(exchanges = fixtureExchanges(), options = {}) {
  return buildBodAvenueReportModel({
    month: "2026-07",
    avenueCode: "ISD",
    selectedAvenueCodes: ["ISD"],
    events: [isdEvent()],
    selectedEventIds: ["ISD"],
    directorsByAvenue: { ISD: [{ name: "Director I", positionTitle: "International Service Director" }] },
    includeLetterheadExchanges: true,
    includeLetterheadExchangePhotos: options.includePhotos,
    letterheadExchanges: exchanges,
    generatedAt: "2026-07-31T12:00:00.000Z",
  });
}

const imagesFor = (...ids) => new Map(ids.map((id) => [`letterhead:${id}`, preparedImage(`letterhead:${id}`)]));

test("blocks are built per exchange in exchangeDate order with their own rows and report photo key", () => {
  const blocks = buildLetterheadExchangeReportBlocks(fixtureExchanges());
  assert.deepEqual(blocks.map((block) => block.exchangeId), ["with-photo", "unselected", "two-clubs", "no-photos"]);
  assert.equal(blocks[0].heading, "3 Jul 2026 · Partner with-photo · Event: Fellowship Night");
  assert.equal(blocks[2].heading, "15 Jul 2026 · Rotaract Club A, Rotaract Club B");
  assert.deepEqual(blocks.map((block) => block.rows.length), [1, 1, 2, 1]);
  assert.deepEqual(blocks.map((block) => block.reportImageKey), ["letterhead:with-photo", "", "letterhead:two-clubs", ""]);
  assert.deepEqual(buildLetterheadExchangeReportBlocks(fixtureExchanges(), { includePhotos: false }).map((block) => block.reportImageKey), ["", "", "", ""]);
});

test("each exchange renders as its own block: header, then its rows, then its photo", () => {
  const imagesByEventId = imagesFor("with-photo", "two-clubs");
  const text = buildBodAvenueReportPdfPages(model(), { imagesByEventId }).flat().join("\n");
  const at = (needle) => {
    const index = text.indexOf(needle);
    assert.ok(index > -1, `${needle} should be rendered`);
    return index;
  };
  const sectionIndex = at("LETTERHEAD EXCHANGES");
  const firstHeader = at("3 Jul 2026 \\225 Partner with-photo \\225 Event: Fellowship Night");
  const firstRow = at("Rotaractor with-photo");
  const firstPhoto = at("/Im1 Do");
  const secondHeader = at("10 Jul 2026 \\225 Partner unselected");
  const thirdHeader = at("15 Jul 2026 \\225 Rotaract Club A, Rotaract Club B");
  const thirdRows = [at("Person A"), at("Person B")];
  const thirdPhoto = at("/Im2 Do");
  const fourthHeader = at("20 Jul 2026 \\225 Partner no-photos");
  assert.ok(sectionIndex < firstHeader && firstHeader < firstRow && firstRow < firstPhoto && firstPhoto < secondHeader);
  assert.ok(secondHeader < thirdHeader && thirdHeader < thirdRows[0] && thirdRows[1] < thirdPhoto && thirdPhoto < fourthHeader);
  assert.ok(text.split("Position / RID").length - 1 >= 4, "every block has its own column header");

  const pdf = decodePdf(buildBodAvenueReportPdfDocument(model(), MOCK_LETTERHEAD, { imagesByEventId }));
  assert.equal(pdf.match(/\/Filter \/DCTDecode/g)?.length, 2);
  assert.match(pdf, /RCPH-IMAGE-letterhead:with-photo/);
});

test("photos are left out when exchange photos are not included or could not be prepared", () => {
  const withoutOption = buildBodAvenueReportPdfPages(model(undefined, { includePhotos: false }), { imagesByEventId: imagesFor("with-photo", "two-clubs") }).flat().join("\n");
  assert.doesNotMatch(withoutOption, /\/Im\d+ Do/);
  assert.match(withoutOption, /Partner with-photo/);

  const failedFetch = buildBodAvenueReportPdfPages(model(), { imagesByEventId: imagesFor("two-clubs") }).flat().join("\n");
  assert.match(failedFetch, /3 Jul 2026 \\225 Partner with-photo/);
  assert.equal(failedFetch.match(/\/Im\d+ Do/g)?.length, 1, "only the prepared photo is drawn");
});

test("a report photo is never split across pages and block headers stay with their rows", () => {
  const many = Array.from({ length: 9 }, (_, index) => letterheadExchange(`x${index + 1}`, {
    exchangeDate: `2026-07-${String(index + 1).padStart(2, "0")}`,
    imageCount: 1,
    reportImage: { ...PHOTO, imageId: `img-${index}` },
  }));
  const imagesByEventId = new Map(many.map((exchange) => [`letterhead:${exchange.id}`, preparedImage(`letterhead:${exchange.id}`)]));
  const pages = buildBodAvenueReportPdfPages(model(many), { imagesByEventId });
  const safe = BOD_AVENUE_REPORT_LAYOUT.safeArea;
  assert.ok(pages.length > 3);
  let photos = 0;
  pages.forEach((page) => {
    const text = page.join("\n");
    for (const match of text.matchAll(/([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm\n\/Im\d+ Do/g)) {
      const height = Number(match[2]);
      const y = Number(match[4]);
      photos += 1;
      assert.ok(y >= safe.bottom - 0.01, "photo bottom stays inside the safe area");
      assert.ok(y + height <= safe.top + 0.01, "photo top stays inside the safe area");
    }
    // A block header is never the last thing on a page.
    const lastHeader = text.lastIndexOf("\\225 Partner");
    if (lastHeader > -1) assert.ok(text.indexOf("Rotaractor x", lastHeader) > -1, "header is followed by its rows on the same page");
  });
  assert.equal(photos, many.length);
});

test("zero exchanges keep the approved empty-state message", () => {
  const text = buildBodAvenueReportPdfPages(model([])).flat().join("\n");
  assert.match(text, /LETTERHEAD EXCHANGES/);
  assert.match(text, /No Letterhead Exchanges were recorded for the selected reporting period\./);
});
