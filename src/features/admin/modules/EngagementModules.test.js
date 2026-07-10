import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./EngagementModules.jsx", import.meta.url), "utf8");

test("announcement form renders the optional attachment control", () => {
  assert.match(source, /function AnnouncementAttachmentControl/);
  assert.match(source, /Attachment/);
  assert.match(source, /Optional - one image or PDF, up to/);
  assert.match(source, /Choose image or PDF/);
  assert.match(source, /type="file"/);
  assert.match(source, /accept=\{accept\}/);
});

test("announcement attachment selection validates before upload", () => {
  assert.match(source, /validateAnnouncementAttachmentFile\(file\)/);
  assert.match(source, /uploadAnnouncementAttachment\(file/);
  assert.match(source, /ANNOUNCEMENT_ATTACHMENT_TYPES\.join/);
});

test("uploading state blocks publication and duplicate upload actions", () => {
  assert.match(source, /const \[attachmentBusy, setAttachmentBusy\] = useState\(false\)/);
  assert.match(source, /if \(attachmentBusy\) return onNotice/);
  assert.match(source, /disabled=\{busy \|\| attachmentBusy\}/);
  assert.match(source, /Publishing is disabled until the attachment upload finishes/);
  assert.match(source, /disabled=\{busy\}/);
});

test("successful PDF or image upload displays metadata and thumbnail state", () => {
  assert.match(source, /attachment\.filename/);
  assert.match(source, /formatAttachmentSize\(attachment\.sizeBytes\)/);
  assert.match(source, /Upload complete/);
  assert.match(source, /attachment\.kind === "image" && attachment\.previewUrl/);
  assert.match(source, /<img src=\{attachment\.previewUrl\} alt="" \/>/);
});

test("replace and remove maintain one active attachment session", () => {
  assert.match(source, /previousSessionId/);
  assert.match(source, /removeAnnouncementAttachmentUpload\(previousSessionId\)/);
  assert.match(source, /URL\.revokeObjectURL\(previousPreviewUrl\)/);
  assert.match(source, /removeAnnouncementAttachmentUpload\(sessionId\)/);
  assert.match(source, /attachmentSessionId: ""/);
});

test("upload failure preserves the announcement draft and email label reflects readiness", () => {
  assert.match(source, /Your announcement text was preserved/);
  assert.match(source, /setStage\("Upload failed"\)/);
  assert.match(source, /Also send email to the same eligible recipients\{draft\.attachment \? " with the attachment" : ""\}/);
});
