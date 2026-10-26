import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { unzipSync } from "fflate";
import { buildOutwardLettersPdf, buildOutwardLettersZip, OUTWARD_TEMPLATE_SIZE } from "./outwardLetterPdf.js";

const bytes = (path) => new Uint8Array(readFileSync(new URL(path, import.meta.url)));
const assets = {
  template: { bytes: bytes("../../../../public/letters/rcph-outward-letter.jpg"), ...OUTWARD_TEMPLATE_SIZE },
  fonts: { regular: bytes("../../../../public/fonts/poppins/Poppins-Regular.ttf"), bold: bytes("../../../../public/fonts/poppins/Poppins-Bold.ttf") },
};
const decode = (value) => new TextDecoder("latin1").decode(value);
const rows = [
  { clubName: "Nashik Central", rid: "3030", date: "2026-10-26" },
  { clubName: "Nashik Central", rid: "3031", date: "2026-10-27" },
];

test("the template is a JPEG at the size the positions were measured on", () => {
  assert.deepEqual([...assets.template.bytes.slice(0, 2)], [0xff, 0xd8]);
});

test("the combined PDF has one page per club, one shared template, and the date, club and RID", () => {
  const pdf = decode(buildOutwardLettersPdf(rows, assets));
  assert.match(pdf, /^%PDF-1\.4/);
  assert.match(pdf, /\/Count 2 >>/);
  assert.equal((pdf.match(/\/Subtype \/Image/g) || []).length, 1);
  assert.equal((pdf.match(/\/Type \/Page /g) || []).length, 2);
  assert.match(pdf, /\(26\/10\/2026\) Tj/);
  assert.match(pdf, /\(27\/10\/2026\) Tj/);
  assert.equal((pdf.match(/\(Nashik Central\) Tj/g) || []).length, 2);
  assert.match(pdf, /\(3030\) Tj/);
  assert.match(pdf, /\(3031\) Tj/);
});

test("brackets and slashes in a club name cannot break the PDF, and accents are simplified", () => {
  const pdf = decode(buildOutwardLettersPdf([{ clubName: "A (B) \\ Café", rid: "1", date: "2026-10-26" }], assets));
  assert.match(pdf, /\(A \\\(B\\\) \\\\ Cafe\) Tj/);
});

test("a very long name is shrunk to fit instead of running off the page", () => {
  const long = "Metropolitan Cultural Heritage Society Of Western India Region ".repeat(2).trim();
  const pdf = decode(buildOutwardLettersPdf([{ clubName: long, rid: "1", date: "2026-10-26" }], assets));
  const size = Number(pdf.match(/\/P2 ([\d.]+) Tf 0 g [\d.]+ [\d.]+ Td \(Metropolitan/)[1]);
  assert.ok(size < 11.8 && size >= 7, String(size));
  const extreme = decode(buildOutwardLettersPdf([{ clubName: "Metropolitan Cultural Heritage ".repeat(12).trim(), rid: "1", date: "2026-10-26" }], assets));
  assert.match(extreme, /\/P2 7 Tf 0 g [\d.]+ [\d.]+ Td \(Metropolitan[^)]*\.\.\.\) Tj/);
});

test("nothing is built without letters, the template or the fonts", () => {
  assert.throws(() => buildOutwardLettersPdf([], assets), /no letters/);
  assert.throws(() => buildOutwardLettersPdf(rows, { ...assets, template: {} }), /template is required/);
  assert.throws(() => buildOutwardLettersPdf(rows, { ...assets, fonts: {} }), /fonts are required/);
});

test("the ZIP holds one PDF per club with unique names", async () => {
  const files = unzipSync(await buildOutwardLettersZip(rows, assets));
  assert.deepEqual(Object.keys(files), ["RCPH-Letterhead-Nashik-Central.pdf", "RCPH-Letterhead-Nashik-Central-2.pdf"]);
  Object.values(files).forEach((file) => assert.match(decode(file), /\/Count 1 >>/));
});
