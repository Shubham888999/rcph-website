import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  RESOLUTION_LETTERHEAD_JPEG_QUALITY,
  RESOLUTION_LETTERHEAD_URL,
  RESOLUTION_OFFICIAL_LETTERHEAD_URL,
  convertResolutionLetterheadBlobToJpeg,
  getResolutionOfficialLetterheadJpeg,
  loadResolutionLetterheadJpeg,
  loadResolutionOfficialLetterheadJpeg,
} from "./resolutionLetterhead.js";

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

test("Resolution letterhead uses the canonical public asset URL", () => {
  assert.equal(RESOLUTION_LETTERHEAD_URL, "/images/resolution_letterhead.png");
  const png = readFileSync(new URL("../../../public/images/resolution_letterhead.png", import.meta.url));
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(png.readUInt32BE(16), 1414);
  assert.equal(png.readUInt32BE(20), 2000);
});

test("official generated Resolution pages use the BOD Avenue Report A4 letterhead asset", () => {
  assert.equal(RESOLUTION_OFFICIAL_LETTERHEAD_URL, "/images/RCPH_BOD_Avenue_Report_Letterhead_A4.png");
  const png = readFileSync(new URL("../../../public/images/RCPH_BOD_Avenue_Report_Letterhead_A4.png", import.meta.url));
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(png.readUInt32BE(16), 1414);
  assert.equal(png.readUInt32BE(20), 2000);
});

test("browser conversion preserves source dimensions and requests high-quality JPEG", async () => {
  const calls = [];
  const image = { width: 1138, height: 1600, close: () => calls.push("close") };
  const context = {
    fillStyle: "",
    fillRect: (...args) => calls.push(["fill", ...args]),
    drawImage: (...args) => calls.push(["draw", ...args.slice(1)]),
  };
  const result = await convertResolutionLetterheadBlobToJpeg(new Blob(["png"]), {
    decodeImage: async () => image,
    createCanvas: (width, height) => ({ width, height, getContext: () => context }),
    encodeJpeg: async (_canvas, quality) => {
      calls.push(["quality", quality]);
      return new Blob([JPEG_BYTES], { type: "image/jpeg" });
    },
  });
  assert.equal(result.width, 1138);
  assert.equal(result.height, 1600);
  assert.deepEqual(result.bytes, JPEG_BYTES);
  assert.ok(calls.some((call) => Array.isArray(call) && call[0] === "draw" && call.slice(1).join(",") === "0,0,1138,1600"));
  assert.ok(calls.some((call) => Array.isArray(call) && call[0] === "quality" && call[1] === RESOLUTION_LETTERHEAD_JPEG_QUALITY));
});

test("asset loading passes only the public blob into the injectable converter", async () => {
  let requestedUrl = "";
  let requestedOptions = null;
  const expected = { bytes: JPEG_BYTES, width: 2, height: 3 };
  const result = await loadResolutionLetterheadJpeg({
    fetchImpl: async (url, options) => {
      requestedUrl = url;
      requestedOptions = options;
      return { ok: true, blob: async () => new Blob(["png"]) };
    },
    convertBlob: async () => expected,
    logger: { error() {} },
  });
  assert.equal(requestedUrl, RESOLUTION_LETTERHEAD_URL);
  assert.equal(requestedOptions.cache, "force-cache");
  assert.equal(result, expected);
});

test("official asset loading bypasses fetch cache and uses the same safe conversion path", async () => {
  let requestedUrl = "";
  let requestedOptions = null;
  const expected = { bytes: new Uint8Array([0xff, 0xd8, 1, 0xff, 0xd9]), width: 1138, height: 1600 };
  const result = await loadResolutionOfficialLetterheadJpeg({
    fetchImpl: async (url, options) => {
      requestedUrl = url;
      requestedOptions = options;
      return { ok: true, blob: async () => new Blob(["official"]) };
    },
    convertBlob: async (blob) => {
      assert.equal(await blob.text(), "official");
      return expected;
    },
    logger: { error() {} },
  });
  assert.equal(requestedUrl, RESOLUTION_OFFICIAL_LETTERHEAD_URL);
  assert.equal(requestedOptions.cache, "no-store");
  assert.equal(result, expected);
});

test("official generated-page letterhead is loaded fresh for each request", async () => {
  const originalFetch = globalThis.fetch;
  const originalCreateImageBitmap = globalThis.createImageBitmap;
  const originalDocument = globalThis.document;
  const calls = [];
  try {
    globalThis.fetch = async (url, options) => {
      calls.push({ url, cache: options?.cache });
      return { ok: true, blob: async () => new Blob([`official-${calls.length}`]) };
    };
    globalThis.createImageBitmap = async () => ({ width: 2, height: 3, close() {} });
    globalThis.document = {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({ fillRect() {}, drawImage() {} }),
        toBlob: (callback) => callback(new Blob([JPEG_BYTES], { type: "image/jpeg" })),
      }),
    };
    await getResolutionOfficialLetterheadJpeg();
    await getResolutionOfficialLetterheadJpeg();
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.createImageBitmap = originalCreateImageBitmap;
    globalThis.document = originalDocument;
  }
  assert.deepEqual(calls, [
    { url: RESOLUTION_OFFICIAL_LETTERHEAD_URL, cache: "no-store" },
    { url: RESOLUTION_OFFICIAL_LETTERHEAD_URL, cache: "no-store" },
  ]);
});

test("asset failures are logged without Resolution data and return safe user copy", async () => {
  const logs = [];
  await assert.rejects(loadResolutionLetterheadJpeg({
    fetchImpl: async () => ({ ok: false, status: 404 }),
    logger: { error: (...args) => logs.push(args) },
  }), /letterhead could not be loaded/i);
  assert.equal(logs.length, 1);
  assert.equal(JSON.stringify(logs).includes("resolutionNumber"), false);
  assert.equal(JSON.stringify(logs).includes(RESOLUTION_LETTERHEAD_URL), true);
});
