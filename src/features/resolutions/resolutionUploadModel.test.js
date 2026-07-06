import assert from "node:assert/strict";
import test from "node:test";
import { RESOLUTION_PDF_MAX_BYTES, formatResolutionPdfSize, resolutionUploadError, validateResolutionPdfFile } from "./resolutionUploadModel.js";

test("Resolution PDF client validation accepts one safe PDF through 10 MB", () => {
  assert.equal(validateResolutionPdfFile({ name: "resolution.pdf", type: "application/pdf", size: 1024 }), "");
  assert.equal(validateResolutionPdfFile({ name: "resolution.pdf", type: "", size: RESOLUTION_PDF_MAX_BYTES }), "");
});

test("Resolution PDF client validation rejects extension, MIME, empty, and oversized files", () => {
  assert.match(validateResolutionPdfFile({ name: "resolution.txt", type: "application/pdf", size: 10 }), /\.pdf/);
  assert.match(validateResolutionPdfFile({ name: "resolution.pdf", type: "text/plain", size: 10 }), /Only PDF/);
  assert.match(validateResolutionPdfFile({ name: "resolution.pdf", type: "application/pdf", size: 0 }), /empty/);
  assert.match(validateResolutionPdfFile({ name: "resolution.pdf", type: "application/pdf", size: RESOLUTION_PDF_MAX_BYTES + 1 }), /10 MB/);
});

test("Resolution PDF errors and file sizes remain user-safe", () => {
  assert.equal(formatResolutionPdfSize(2 * 1024 * 1024), "2.0 MB");
  assert.match(resolutionUploadError({ code: "encrypted-pdf" }), /Password-protected/);
  assert.doesNotMatch(resolutionUploadError({ code: "malformed-pdf" }), /Storage|bucket|path/i);
});
