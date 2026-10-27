import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers";
import {
  addBulkVisitFiles,
  addVisitFiles,
  buildBulkUploadPairs,
  buildVisitUploadEndpoint,
  bulkVisitFolderAvailability,
  bulkVisitFolderStatus,
  formatVisitFileSize,
  getVisitThumbnailUrl,
  normalizeVisitUploadResponse,
  resolveVisitUploadEndpoint,
  runBulkUploadPairs,
  safeVisitUploadError,
  validateVisitUploadEndpoint,
  validateVisitUploadFile,
} from "./visitUploadModel.js";

const MB25 = 25 * 1024 * 1024;
const file = (name, type, size = 100) => ({ name, type, size });

test("Club Visit validation matches the backend MIME and extension contract", () => {
  const allowed = [
    ["report.pdf", "application/pdf"],
    ["letter.doc", "application/msword"],
    ["letter.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ["sheet.xls", "application/vnd.ms-excel"],
    ["sheet.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    ["slides.ppt", "application/vnd.ms-powerpoint"],
    ["slides.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
    ["notes.txt", "text/plain"],
    ["attendance.csv", "text/csv"],
    ["photo.jpeg", "image/jpeg"],
    ["photo.png", "image/png"],
    ["photo.webp", "image/webp"],
  ];
  allowed.forEach(([name, type]) => assert.equal(validateVisitUploadFile(file(name, type), MB25), ""));
  assert.match(validateVisitUploadFile(file("bad.html", "text/html"), MB25), /not supported/i);
  assert.match(validateVisitUploadFile(file("fake.pdf", "image/png"), MB25), /does not match/i);
});

test("empty, boundary, and oversized files are handled exactly", () => {
  assert.match(validateVisitUploadFile(file("empty.pdf", "application/pdf", 0), MB25), /empty/i);
  assert.equal(validateVisitUploadFile(file("limit.pdf", "application/pdf", MB25), MB25), "");
  assert.match(validateVisitUploadFile(file("large.pdf", "application/pdf", MB25 + 1), MB25), /exceeds/i);
});

test("selection deduplicates files and enforces the server-returned count limit", () => {
  const folder = { maxFilesPerSelection: 2, maxFileSizeBytes: MB25 };
  const first = file("one.pdf", "application/pdf");
  const result = addVisitFiles([], [first, first, file("two.png", "image/png"), file("three.pdf", "application/pdf")], folder, (() => { let i = 0; return () => `id-${++i}`; })());
  assert.equal(result.queue.length, 2);
  assert.equal(result.duplicateCount, 1);
  assert.equal(result.overflowCount, 1);
});

test("bulk selection allows duplicate visible names and enforces the session file limit", () => {
  const result = addBulkVisitFiles([], [
    file("Report.pdf", "application/pdf"),
    file("Report.pdf", "application/pdf"),
    file("Agenda.pdf", "application/pdf"),
  ], 2, MB25, (() => { let i = 0; return () => `bulk-${++i}`; })());
  assert.equal(result.queue.length, 2);
  assert.equal(result.overflowCount, 1);
  assert.deepEqual(result.queue.map((item) => item.file.name), ["Report.pdf", "Report.pdf"]);
});

test("bulk folder availability blocks locked, closed, disabled, oversized, and over-capacity folders", () => {
  const visit = { enabled: true, submissionOpen: true };
  const openFolder = { enabled: true, submissionOpen: true, locked: false, activeFileCount: 3, maxActiveFiles: 5, maxFilesPerSelection: 3, maxFileSizeBytes: MB25 };
  const files = [{ file: file("one.pdf", "application/pdf") }, { file: file("two.pdf", "application/pdf") }];
  assert.equal(bulkVisitFolderStatus(openFolder, visit), "open");
  assert.equal(bulkVisitFolderAvailability(openFolder, files, visit).selectable, true);
  assert.equal(bulkVisitFolderAvailability({ ...openFolder, locked: true }, files, visit).status, "locked");
  assert.equal(bulkVisitFolderAvailability({ ...openFolder, submissionOpen: false }, files, visit).selectable, false);
  assert.match(bulkVisitFolderAvailability({ ...openFolder, activeFileCount: 4 }, files, visit).message, /Only 1 more file/);
  assert.match(bulkVisitFolderAvailability({ ...openFolder, maxFilesPerSelection: 1 }, files, visit).message, /Only 1 file/);
  assert.match(bulkVisitFolderAvailability({ ...openFolder, maxFileSizeBytes: 10 }, files, visit).message, /exceeds/);
  assert.equal(bulkVisitFolderAvailability(openFolder, [], visit).selectable, false);
});

test("bulk upload pairs schedule every selected file into every selected folder", () => {
  const files = [
    { clientFileId: "f1", file: file("Agenda.pdf", "application/pdf") },
    { clientFileId: "f2", file: file("Constitution.pdf", "application/pdf") },
  ];
  const folders = [
    { visitType: "clubAssembly", positionKey: "president", positionTitle: "President", avenueCode: "PRE" },
    { visitType: "clubAssembly", positionKey: "secretary", positionTitle: "Secretary", avenueCode: "SEC" },
    { visitType: "clubAssembly", positionKey: "rrro", positionTitle: "RRRO", avenueCode: "RRRO" },
  ];
  const pairs = buildBulkUploadPairs(files, folders);
  assert.equal(pairs.length, 6);
  assert.deepEqual(pairs.map((pair) => pair.pairId), ["president:f1", "president:f2", "secretary:f1", "secretary:f2", "rrro:f1", "rrro:f2"]);
});

test("only the exact production endpoint and local emulator endpoints are accepted", () => {
  assert.equal(validateVisitUploadEndpoint("https://us-central1-rcph-admin.cloudfunctions.net/uploadVisitSubmissionFile"), "https://us-central1-rcph-admin.cloudfunctions.net/uploadVisitSubmissionFile");
  assert.equal(validateVisitUploadEndpoint("http://localhost:5001/rcph-admin/us-central1/uploadVisitSubmissionFile"), "http://localhost:5001/rcph-admin/us-central1/uploadVisitSubmissionFile");
  for (const value of ["", "https://evil.example/uploadVisitSubmissionFile", "http://us-central1-rcph-admin.cloudfunctions.net/uploadVisitSubmissionFile", "https://us-central1-rcph-admin.cloudfunctions.net/other"]) assert.equal(validateVisitUploadEndpoint(value), "");
});

test("Club Visit upload endpoint resolves from the configured Firebase project", () => {
  assert.equal(buildVisitUploadEndpoint("rcph-admin"), "https://us-central1-rcph-admin.cloudfunctions.net/uploadVisitSubmissionFile");
  assert.equal(resolveVisitUploadEndpoint({ VITE_FIREBASE_PROJECT_ID: "rcph-admin" }), "https://us-central1-rcph-admin.cloudfunctions.net/uploadVisitSubmissionFile");
  assert.equal(resolveVisitUploadEndpoint({ VITE_FIREBASE_PROJECT_ID: "rcph-admin-staging-2" }), "https://us-central1-rcph-admin-staging-2.cloudfunctions.net/uploadVisitSubmissionFile");
  assert.equal(resolveVisitUploadEndpoint({
    VITE_FIREBASE_PROJECT_ID: "rcph-admin-staging-2",
    VITE_VISIT_SUBMISSION_UPLOAD_ENDPOINT: "http://127.0.0.1:5001/rcph-admin-staging-2/us-central1/uploadVisitSubmissionFile",
  }), "http://127.0.0.1:5001/rcph-admin-staging-2/us-central1/uploadVisitSubmissionFile");
  assert.equal(resolveVisitUploadEndpoint({ VITE_FIREBASE_PROJECT_ID: "../bad" }), "");
});

test("trusted response normalization requires a completion proof", () => {
  assert.equal(normalizeVisitUploadResponse({ ok: true, completionProof: "proof", fileUrl: "https://drive.google.com/file/d/f1/view" }).completionProof, "proof");
  assert.throws(() => normalizeVisitUploadResponse({ ok: true }), /did not confirm/i);
});

test("image thumbnails use Drive IDs while PDFs remain attachment-only", () => {
  assert.equal(getVisitThumbnailUrl({ fileUrl: "https://drive.google.com/file/d/file_123/view", mimeType: "image/png" }), "https://drive.google.com/thumbnail?id=file_123&sz=w1000");
  assert.equal(getVisitThumbnailUrl({ fileUrl: "https://drive.google.com/file/d/file_123/view", mimeType: "application/pdf" }), "");
  assert.equal(getVisitThumbnailUrl({ fileUrl: "https://example.com/image.png", mimeType: "image/png" }), "");
});

test("size formatting and upload errors stay user-safe", () => {
  assert.equal(formatVisitFileSize(1048576), "1.0 MB");
  assert.match(safeVisitUploadError({ code: "functions/permission-denied", message: "secret internals" }), /not authorized/i);
  assert.doesNotMatch(safeVisitUploadError(new Error("secret internals")), /secret internals/);
});


test("two files across six positions upload sequentially per position with bounded parallelism", async () => {
  const folders = Array.from({ length: 6 }, (_, i) => ({ visitType: "dzrVisit", positionKey: `position-${i}`, documentCategory: `custom-${i}` }));
  const files = ["one", "two"].map(clientFileId => ({ clientFileId, file: file(`${clientFileId}.pdf`, "application/pdf") }));
  const pairs = buildBulkUploadPairs(files, folders);
  const activePositions = new Set();
  const completed = [];
  let maxActive = 0;
  await runBulkUploadPairs(pairs, 3, async pair => {
    assert.equal(activePositions.has(pair.positionKey), false, "same-position requests must not overlap");
    activePositions.add(pair.positionKey);
    maxActive = Math.max(maxActive, activePositions.size);
    await new Promise(resolve => setImmediate(resolve));
    completed.push(pair.pairId);
    activePositions.delete(pair.positionKey);
  });
  assert.equal(completed.length, 12);
  assert.equal(new Set(completed).size, 12);
  assert.equal(maxActive, 3, "different positions remain parallel");
  for (const folder of folders) {
    assert.deepEqual(completed.filter(id => id.startsWith(`${folder.positionKey}:`)), pairs.filter(pair => pair.positionKey === folder.positionKey).map(pair => pair.pairId));
  }
});

test("failed pairs can be retried alone without scheduling successful files again", async () => {
  const pairs = ["one", "two", "three"].map(clientFileId => ({ visitType: "dzrVisit", positionKey: "editor", clientFileId }));
  const attempts = [];
  const failed = [];
  await runBulkUploadPairs(pairs, 3, async pair => {
    attempts.push(pair.clientFileId);
    // processPair records a failed upload without rejecting the whole batch.
    if (pair.clientFileId === "two") failed.push(pair);
  });
  await runBulkUploadPairs(failed, 3, async pair => { attempts.push(pair.clientFileId); });
  assert.deepEqual(attempts, ["one", "two", "three", "two"]);
});
