import assert from "node:assert/strict";
import test from "node:test";
import {
  TREASURY_UPLOAD_MAX_BYTES,
  buildTreasuryAppsScriptPayload,
  buildTreasuryUploadTicketPayload,
  getDriveThumbnailUrl,
  getSafeTreasuryUploadError,
  isTreasuryImageAttachment,
  normalizeTreasuryUploadResponse,
  selectTreasuryUploadFile,
  treasuryAttachmentFromRecord,
  validateTreasuryUploadEndpoint,
  validateTreasuryUploadFile,
} from "./treasuryUploadModel.js";

const file = (name = "receipt.png", type = "image/png", size = 1200) => ({ name, type, size });

test("Treasury validation accepts supported files through the 10 MB boundary", () => {
  for (const [name, type] of [["a.pdf", "application/pdf"], ["a.jpg", "image/jpeg"], ["a.jpeg", "image/jpeg"], ["a.png", "image/png"], ["a.webp", "image/webp"]]) {
    assert.equal(validateTreasuryUploadFile(file(name, type, TREASURY_UPLOAD_MAX_BYTES)), "");
  }
});

test("Treasury validation rejects empty, oversized, unsupported, and mismatched files", () => {
  assert.match(validateTreasuryUploadFile(file("a.pdf", "application/pdf", 0)), /empty/i);
  assert.match(validateTreasuryUploadFile(file("a.pdf", "application/pdf", TREASURY_UPLOAD_MAX_BYTES + 1)), /10 MB/i);
  assert.match(validateTreasuryUploadFile(file("a.exe", "application/octet-stream")), /not a supported/i);
  assert.match(validateTreasuryUploadFile(file("a.png", "image/jpeg")), /does not match/i);
});

test("Treasury selection is single-file and rejects a duplicate selection", () => {
  const selected = { ...file(), lastModified: 1 };
  const first = selectTreasuryUploadFile(null, selected);
  assert.equal(first.value.status, "ready");
  const duplicate = selectTreasuryUploadFile(first.value, selected);
  assert.match(duplicate.error, /already selected/i);
  const replacement = selectTreasuryUploadFile(first.value, { ...file("new.pdf", "application/pdf"), lastModified: 2 });
  assert.equal(replacement.value.file.name, "new.pdf");
  assert.equal(replacement.value.uploadedMetadata, null);
});

test("Treasury endpoint accepts only the production Apps Script exec URL", () => {
  assert.equal(validateTreasuryUploadEndpoint("https://script.google.com/macros/s/deployment/exec"), "https://script.google.com/macros/s/deployment/exec");
  for (const value of ["", "http://script.google.com/macros/s/x/exec", "https://evil.example/macros/s/x/exec", "https://script.google.com/macros/s/x/dev"]) assert.equal(validateTreasuryUploadEndpoint(value), "");
});

test("ticket and Apps Script payloads preserve the legacy transaction-bound contract", () => {
  const selected = file("proof.pdf", "application/pdf", 42);
  const transaction = { date: "2026-07-02", purpose: "Vendor payment", type: "expense", amount: 125.5 };
  const ticketPayload = buildTreasuryUploadTicketPayload(selected, transaction, "tx-1");
  assert.deepEqual(ticketPayload, { fileName: "proof.pdf", mimeType: "application/pdf", sizeBytes: 42, transactionId: "tx-1", transactionDate: "2026-07-02", transactionPurpose: "Vendor payment", transactionType: "expense", transactionAmount: 125.5 });
  assert.equal("base64" in ticketPayload, false);
  const appsPayload = buildTreasuryAppsScriptPayload(selected, { ...ticketPayload, ticket: "one-time" }, "YWJj");
  assert.deepEqual(appsPayload, { action: "uploadTreasuryBill", ticket: "one-time", transactionId: "tx-1", fileName: "proof.pdf", mimeType: "application/pdf", sizeBytes: 42, base64: "YWJj" });
});

test("response normalization preserves record association and attachment metadata", () => {
  const approved = { transactionId: "tx-1", fileName: "proof.pdf", mimeType: "application/pdf", sizeBytes: 42 };
  const result = normalizeTreasuryUploadResponse({ status: "success", transactionId: "tx-1", fileId: "f1", fileUrl: "https://drive.google.com/file/d/f1/view", folderUrl: "https://drive.google.com/drive/folders/d1" }, approved);
  assert.equal(result.billUrl, "https://drive.google.com/file/d/f1/view");
  assert.equal(result.billMimeType, "application/pdf");
  assert.throws(() => normalizeTreasuryUploadResponse({ ok: true, transactionId: "wrong", fileUrl: "https://drive.google.com/file/d/f1/view" }, approved), /mismatched/i);
});

test("details helpers render only known images as thumbnails", () => {
  assert.equal(getDriveThumbnailUrl("https://drive.google.com/file/d/abc_123/view"), "https://drive.google.com/thumbnail?id=abc_123&sz=w1000");
  assert.equal(isTreasuryImageAttachment({ fileName: "receipt.png", mimeType: "image/png" }), true);
  assert.equal(isTreasuryImageAttachment({ fileName: "bill.pdf", mimeType: "application/pdf" }), false);
  assert.equal(treasuryAttachmentFromRecord({ billUrl: "https://drive.google.com/file/d/f1/view", billFileName: "bill.pdf" }).fileName, "bill.pdf");
});

test("Treasury errors expose only approved user-safe messages", () => {
  assert.match(getSafeTreasuryUploadError({ code: "functions/permission-denied", message: "private detail" }), /permission/i);
  assert.equal(getSafeTreasuryUploadError({ code: "functions/internal", message: "secret stack" }), "The supporting file could not be uploaded. Please retry.");
});
