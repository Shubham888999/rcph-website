import assert from "node:assert/strict";
import test from "node:test";
import {
  BOD_UPLOAD_MAX_BYTES,
  BOD_UPLOAD_MAX_FILES,
  addBodUploadFiles,
  buildBodUploadTicketPayload,
  getSafeBodUploadError,
  normalizeBodUploadResponse,
  validateBodUploadEndpoint,
  validateBodUploadFile,
} from "./bodUploadModel.js";

function file(name = "poster.png", type = "image/png", size = 1200, lastModified = 1) {
  return { name, type, size, lastModified };
}

test("upload validation accepts supported types through the 15 MB boundary", () => {
  for (const [name, type] of [["a.pdf", "application/pdf"], ["a.jpg", "image/jpeg"], ["a.jpeg", "image/jpeg"], ["a.png", "image/png"], ["a.webp", "image/webp"]]) {
    assert.equal(validateBodUploadFile(file(name, type, BOD_UPLOAD_MAX_BYTES)), "");
  }
});

test("empty, oversized, unsupported, and extension-mismatched files are rejected", () => {
  assert.match(validateBodUploadFile(file("empty.pdf", "application/pdf", 0)), /empty/i);
  assert.match(validateBodUploadFile(file("large.pdf", "application/pdf", BOD_UPLOAD_MAX_BYTES + 1)), /15 MB/i);
  assert.match(validateBodUploadFile(file("bad.exe", "application/octet-stream")), /not a supported/i);
  assert.match(validateBodUploadFile(file("bad.png", "image/jpeg")), /does not match/i);
});

test("selection rejects duplicates and caps the list at ten", () => {
  const first = addBodUploadFiles([], [file()]);
  assert.equal(first.items.length, 1);
  assert.match(addBodUploadFiles(first.items, [file()]).errors[0], /already selected/i);
  const many = Array.from({ length: BOD_UPLOAD_MAX_FILES + 2 }, (_, index) => file(`${index}.pdf`, "application/pdf", 10, index));
  const capped = addBodUploadFiles([], many);
  assert.equal(capped.items.length, BOD_UPLOAD_MAX_FILES);
  assert.match(capped.errors.at(-1), /up to 10/i);
});

test("Apps Script endpoint accepts only a production HTTPS exec URL", () => {
  assert.equal(validateBodUploadEndpoint("https://script.google.com/macros/s/deployment/exec"), "https://script.google.com/macros/s/deployment/exec");
  for (const value of ["", "http://script.google.com/macros/s/x/exec", "https://evil.example/macros/s/x/exec", "https://script.google.com/macros/s/x/dev"]) {
    assert.equal(validateBodUploadEndpoint(value), "");
  }
});

test("ticket payload is event-bound and includes no file bytes", () => {
  const payload = buildBodUploadTicketPayload({ fileName: "a.pdf", mimeType: "application/pdf", sizeBytes: 42 }, { eventId: "event-1", name: "Event", eventDate: "2026-07-02", uploadGroupId: "group-1" });
  assert.deepEqual(payload, { eventId: "event-1", eventName: "Event", eventDate: "2026-07-02", uploadGroupId: "group-1", fileName: "a.pdf", mimeType: "application/pdf", sizeBytes: 42 });
  assert.equal("base64" in payload, false);
});

test("Apps Script response normalization requires complete Drive metadata", () => {
  const normalized = normalizeBodUploadResponse({ ok: true, fileId: "f1", fileName: "a.pdf", fileUrl: "https://drive.google.com/file/d/f1/view", folderId: "d1", folderName: "Event", folderUrl: "https://drive.google.com/drive/folders/d1", uploadGroupId: "g1" });
  assert.equal(normalized.fileId, "f1");
  assert.throws(() => normalizeBodUploadResponse({ ok: true, fileId: "f1", fileName: "a.pdf", fileUrl: "https://evil.example/f", folderUrl: "https://drive.google.com/drive/folders/d1", uploadGroupId: "g1" }), /incomplete/i);
});

test("upload errors expose only approved user-safe messages", () => {
  assert.match(getSafeBodUploadError({ code: "functions/permission-denied", message: "raw server details" }), /permission/i);
  assert.equal(getSafeBodUploadError({ code: "functions/internal", message: "secret stack" }), "The file could not be uploaded. Please retry.");
});
