import assert from "node:assert/strict";
import test from "node:test";
import { resolveReportImageOptions } from "./bodAvenueReportModel.js";

test("avenue report with event photos on prepares event images and follows the exchange photo option", () => {
  assert.deepEqual(
    resolveReportImageOptions({ includeEventPhotos: true, includeLetterheadPhotos: true, mode: "avenue" }),
    { prepareEventImages: true, prepareLetterheadImages: true },
  );
  assert.deepEqual(
    resolveReportImageOptions({ includeEventPhotos: true, includeLetterheadPhotos: false, mode: "avenue" }),
    { prepareEventImages: true, prepareLetterheadImages: false },
  );
});

test("avenue report with event photos off skips event images but keeps exchange photos independent", () => {
  assert.deepEqual(
    resolveReportImageOptions({ includeEventPhotos: false, includeLetterheadPhotos: true, mode: "avenue" }),
    { prepareEventImages: false, prepareLetterheadImages: true },
  );
  assert.deepEqual(
    resolveReportImageOptions({ includeEventPhotos: false, includeLetterheadPhotos: false, mode: "avenue" }),
    { prepareEventImages: false, prepareLetterheadImages: false },
  );
});

test("secretarial report follows the event photo option and never prepares exchange photos", () => {
  assert.deepEqual(
    resolveReportImageOptions({ includeEventPhotos: true, mode: "secretarial" }),
    { prepareEventImages: true, prepareLetterheadImages: false },
  );
  assert.deepEqual(
    resolveReportImageOptions({ includeEventPhotos: false, mode: "secretarial" }),
    { prepareEventImages: false, prepareLetterheadImages: false },
  );
  assert.deepEqual(
    resolveReportImageOptions({ includeEventPhotos: true, includeLetterheadPhotos: true, mode: "secretarial" }),
    { prepareEventImages: true, prepareLetterheadImages: false },
  );
});

test("event photos default to included and non-boolean values do not enable photos", () => {
  assert.deepEqual(resolveReportImageOptions(), { prepareEventImages: true, prepareLetterheadImages: false });
  assert.equal(resolveReportImageOptions({ includeEventPhotos: "false" }).prepareEventImages, false);
  assert.equal(resolveReportImageOptions({ includeLetterheadPhotos: "true" }).prepareLetterheadImages, false);
});
