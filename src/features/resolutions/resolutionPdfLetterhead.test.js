import assert from "node:assert/strict";
import test from "node:test";
import {
  RESOLUTION_CONTENT_BOUNDS,
  RESOLUTION_PAGE_NUMBER_POSITION,
  buildResolutionPdfDocument,
  buildResolutionPdfPages,
} from "./resolutionPdf.js";
import { createResolutionPdfFixture } from "./resolutionPdfFixture.js";

const MOCK_LETTERHEAD = Object.freeze({ bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), width: 1138, height: 1600 });
const decodePdf = (bytes) => new TextDecoder("latin1").decode(bytes);
const occurrences = (value, pattern) => value.match(pattern)?.length || 0;

for (const count of [1, 2, 4]) {
  test(`${count}-page Resolution uses one shared full-page letterhead and dynamic numbering`, () => {
    const details = createResolutionPdfFixture(count);
    const pages = buildResolutionPdfPages(details);
    const pdf = decodePdf(buildResolutionPdfDocument(details, MOCK_LETTERHEAD));
    assert.equal(pages.length, count);
    assert.equal(occurrences(pdf, /\/Subtype \/Image/g), 1);
    assert.equal(occurrences(pdf, /\/XObject << \/BG 6 0 R >>/g), count);
    assert.equal(occurrences(pdf, /595 0 0 842 0 0 cm\n\/BG Do/g), count);
    for (let page = 1; page <= count; page += 1) assert.match(pdf, new RegExp(`Page ${page} of ${count}`));
  });
}

test("all Resolution content coordinates remain inside the declared central safe area", () => {
  const pages = buildResolutionPdfPages(createResolutionPdfFixture(4));
  for (const line of pages.flat()) {
    assert.ok(line.x >= RESOLUTION_CONTENT_BOUNDS.left);
    assert.ok(line.x < RESOLUTION_CONTENT_BOUNDS.right);
    assert.ok(line.y >= RESOLUTION_CONTENT_BOUNDS.bottom);
    assert.ok(line.y <= RESOLUTION_CONTENT_BOUNDS.top);
  }
  assert.deepEqual(RESOLUTION_CONTENT_BOUNDS, { left: 54, right: 541, bottom: 260, top: 665 });
  assert.deepEqual(RESOLUTION_PAGE_NUMBER_POSITION, { x: 505, y: 686 });
});

test("binary JPEG bytes survive assembly and xref points to byte-accurate objects", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0x00, 0x7f, 0x80, 0xfe, 0xff, 0xd9]);
  const bytes = buildResolutionPdfDocument(createResolutionPdfFixture(1), { ...MOCK_LETTERHEAD, bytes: jpeg });
  assert.notEqual(bytes.findIndex((value, index) => jpeg.every((byte, offset) => bytes[index + offset] === byte)), -1);
  const text = decodePdf(bytes);
  const startXref = Number(text.match(/startxref\n(\d+)/)?.[1]);
  assert.equal(text.slice(startXref, startXref + 4), "xref");
  for (const match of text.matchAll(/\n(\d{10}) 00000 n /g)) {
    const offset = Number(match[1]);
    assert.match(text.slice(offset, offset + 20), /^\d+ 0 obj\n/);
  }
});
