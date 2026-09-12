import assert from "node:assert/strict";
import test from "node:test";
import {
  BOD_UPLOAD_MAX_BYTES,
  BOD_UPLOAD_MAX_FILES,
  addBodUploadFiles,
  buildBodUploadTicketPayload,
  getBodUploadFinalizationFailureMessage,
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
  assert.deepEqual(payload, { eventId: "event-1", uploadGroupId: "group-1", fileName: "a.pdf", mimeType: "application/pdf", sizeBytes: 42 });
  assert.equal("base64" in payload, false);
  assert.throws(
    () => buildBodUploadTicketPayload({ fileName: "a.pdf", mimeType: "application/pdf", sizeBytes: 42 }, {}),
    /Save the event before uploading files/
  );
});

function verifiedResponse(overrides = {}) {
  return {
    ok: true,
    fileId: "f1",
    fileName: "a.png",
    fileUrl: "https://drive.google.com/file/d/f1/view",
    folderId: "d1",
    folderName: "Event",
    folderUrl: "https://drive.google.com/drive/folders/d1",
    uploadGroupId: "g1",
    attachmentFinalized: true,
    attachmentFinalizationCode: "verified",
    attachmentFinalization: {
      ok: true,
      unchanged: false,
      eventId: "event-1",
      uploadGroupId: "g1",
      driveFileId: "f1",
      attachmentPath: "bodEvents/event-1/attachments/f1",
    },
    attachment: {
      fileId: "f1",
      fileName: "a.png",
      fileUrl: "https://drive.google.com/file/d/f1/view",
      mimeType: "image/png",
      sizeBytes: 42,
      eventId: "event-1",
      uploadGroupId: "g1",
      attachmentPath: "bodEvents/event-1/attachments/f1",
      storageProvider: "googleDrive",
      source: "appsScriptFinalize",
      verified: true,
    },
    ...overrides,
  };
}

const expectedUpload = {
  eventId: "event-1",
  fileName: "a.png",
  mimeType: "image/png",
  sizeBytes: 42,
};

test("Apps Script response normalization requires complete Drive and verified attachment metadata", () => {
  const normalized = normalizeBodUploadResponse(verifiedResponse(), "g1", expectedUpload);
  assert.equal(normalized.fileId, "f1");
  assert.equal(normalized.attachmentFinalized, true);
  assert.equal(normalized.attachment.eventId, "event-1");
  assert.throws(() => normalizeBodUploadResponse({ ...verifiedResponse(), fileUrl: "https://evil.example/f" }, "g1", expectedUpload), /incomplete/i);
});

test("Drive success with attachmentFinalized false is a visible partial failure", () => {
  const normalized = normalizeBodUploadResponse(verifiedResponse({
    attachmentFinalized: false,
    attachmentFinalizationCode: "folder-name-mismatch",
    attachmentFinalizationWarning: "File uploaded, but report attachment verification could not be completed (folder-name-mismatch).",
    attachment: undefined,
    attachmentFinalization: undefined,
  }), "g1", expectedUpload);
  assert.equal(normalized.attachmentFinalized, false);
  assert.equal(normalized.attachment, null);
  assert.equal(normalized.attachmentFinalizationCode, "folder-name-mismatch");
  assert.match(normalized.attachmentFinalizationWarning, /could not be completed/);
  assert.match(getBodUploadFinalizationFailureMessage(normalized), /Drive upload succeeded/);
  assert.match(getBodUploadFinalizationFailureMessage(normalized), /folder-name-mismatch/);
});

test("missing or invalid finalization results never normalize as verified", () => {
  const missing = normalizeBodUploadResponse({
    ...verifiedResponse(),
    attachmentFinalized: undefined,
    attachmentFinalizationCode: undefined,
    attachment: undefined,
  }, "g1", expectedUpload);
  assert.equal(missing.attachmentFinalized, false);
  assert.equal(missing.attachmentFinalizationCode, "finalization-result-missing");

  const mismatched = normalizeBodUploadResponse({
    ...verifiedResponse(),
    attachment: { ...verifiedResponse().attachment, eventId: "event-2" },
  }, "g1", expectedUpload);
  assert.equal(mismatched.attachmentFinalized, false);
  assert.equal(mismatched.attachmentFinalizationCode, "finalization-response-invalid");
});

test("upload errors expose only approved user-safe messages", () => {
  assert.match(getSafeBodUploadError({ code: "functions/permission-denied", message: "raw server details" }), /permission/i);
  assert.equal(getSafeBodUploadError({ code: "functions/internal", message: "secret stack" }), "The file could not be uploaded. Please retry.");
});
