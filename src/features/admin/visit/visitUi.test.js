import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const moduleSource = readFileSync(new URL("./VisitSubmissionsModule.jsx", import.meta.url), "utf8");
const detailsSource = readFileSync(new URL("./VisitSubmissionFiles.jsx", import.meta.url), "utf8");
const routerSource = readFileSync(new URL("../../../app/router.jsx", import.meta.url), "utf8");

test("Club Visits upload exposes labelled sequential queue, retry, cancellation, and live status", () => {
  for (const copy of ["Choose supporting files", "Start sequential upload", "Retry failed uploads", "Cancel remaining uploads", "aria-live=\"polite\""]) assert.match(moduleSource, new RegExp(copy));
  assert.match(moduleSource, /completionProof/);
  assert.match(moduleSource, /Processing in Drive/);
});

test("details keep file links when thumbnails fail and preserve optional folder links", () => {
  assert.match(detailsSource, /onError=\{\(\) => setFailed\(true\)\}/);
  assert.match(detailsSource, />Open file</);
  assert.match(detailsSource, />Open Drive folder</);
  assert.match(detailsSource, /target="_blank" rel="noopener noreferrer"/);
});

test("BOD Club Visits direct URL has its own capability guard", () => {
  assert.match(routerSource, /capability="visitSubmissions"[\s\S]*path: "\/admin\/visit-submissions"/);
});
