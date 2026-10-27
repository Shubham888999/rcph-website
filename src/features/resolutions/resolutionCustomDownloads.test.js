import assert from "node:assert/strict";
import test from "node:test";
import { getResolutionCustomDownload, prepareCustomResolutionSummary } from "./resolutionCustomDownloads.js";
import { buildResolutionPdfDocument, buildResolutionPdfPages } from "./resolutionPdf.js";
import { createResolutionPdfFixture } from "./resolutionPdfFixture.js";
import { createDefaultResolutionPageConfig } from "./resolutionSectionsModel.js";

const JPEG = { bytes: new Uint8Array([255, 216, 255, 217]), width: 1, height: 1 };
const decode = bytes => new TextDecoder("latin1").decode(bytes);
const resolution = (n, extra = {}) => ({ status: "passed", resolutionNumber: `RCPH/2026-27/RES/00${n}`, meetingDate: "2026-10-25", title: "Bank authorization", ...extra });

test("only completed Resolutions 1, 2 and 3 in RIY 2026-27 get the custom downloads", () => {
  assert.equal(getResolutionCustomDownload(resolution(1)).start, 15);
  assert.equal(getResolutionCustomDownload(resolution(2)).start, 5);
  assert.equal(getResolutionCustomDownload(resolution(3)).start, 5);
  assert.equal(getResolutionCustomDownload(resolution(1)).total, 18);
  assert.equal(getResolutionCustomDownload(resolution(2)).total, 8);
  assert.equal(getResolutionCustomDownload(resolution(3)).total, 8);
  assert.equal(getResolutionCustomDownload(resolution(3, { resolutionNumber: "3" })).start, 5);
  for (const input of [
    resolution(4), resolution(13), resolution(3, { status: "open" }),
    resolution(1, { resolutionNumber: "RCPH/2027-28/RES/001" }),
    resolution(1, { resolutionNumber: "1", meetingDate: "2027-07-01" }),
    resolution(1, { resolutionNumber: "1", meetingDate: "" }),
  ]) assert.equal(getResolutionCustomDownload(input), null);
});

test("custom summaries start with the frozen main Resolution Page without changing stored layout or votes", () => {
  const res = resolution(2);
  const frozen = createDefaultResolutionPageConfig(res);
  frozen.heading.text = "FROZEN RESOLUTION PAGE";
  const details = {
    resolution: { ...res, finalizedPdfLayoutMode: "custom", finalizedPdfSectionsSnapshot: [{ type: "paragraph", text: "Custom attachment" }], finalizedResolutionPageConfigSnapshot: frozen, finalizedGeneratedPageOrderSnapshot: ["vote_table", "resolution_page"], resolutionPageConfig: { ...frozen, heading: { ...frozen.heading, text: "LIVE HEADING" } }, appendVoteTable: false },
    votes: [], audit: [],
  };
  const before = structuredClone(details);
  const prepared = prepareCustomResolutionSummary(details);
  const pages = buildResolutionPdfPages(prepared.details);
  assert.equal(pages[0].generatedKind, "resolution_page");
  assert.ok(pages[0].some(line => line.text === "FROZEN RESOLUTION PAGE"));
  assert.ok(!pages.flat().some(line => line.text === "LIVE HEADING" || line.text === "Custom attachment"));
  assert.deepEqual(details, before);
  assert.throws(() => prepareCustomResolutionSummary({ resolution: resolution(4) }), /only/);
  assert.throws(() => prepareCustomResolutionSummary({ resolution: res }), /must be enabled/);
});

for (const [number, start, total] of [[1, 15, 18], [2, 5, 8], [3, 5, 8]]) {
  test(`Resolution ${number} custom labels run from ${start} of ${total} to ${total} of ${total}`, () => {
    const details = createResolutionPdfFixture(4);
    const profile = getResolutionCustomDownload(resolution(number));
    const pdf = decode(buildResolutionPdfDocument(details, JPEG, { pageNumbering: profile }));
    for (let page = start; page <= total; page++) assert.ok(pdf.includes(`(Page ${page} of ${total})`));
    assert.ok(!pdf.includes("(Page 1 of 4)"));
    const ordinary = decode(buildResolutionPdfDocument(details, JPEG));
    assert.ok(ordinary.includes("(Page 1 of 4)"));
    assert.ok(!ordinary.includes(`(Page ${start} of ${total})`));
  });
}

test("custom numbering rejects overflow and invalid ranges without dropping pages", () => {
  const details = createResolutionPdfFixture(4);
  const pages = buildResolutionPdfPages(details);
  for (const pageNumbering of [{ start: 16, total: 18 }, { start: 0, total: 18 }, { start: 5.5, total: 8 }]) {
    assert.throws(() => buildResolutionPdfDocument(details, JPEG, { pages, pageNumbering }), /cannot fit.*No pages were removed/);
    assert.equal(pages.length, 4);
  }
});
