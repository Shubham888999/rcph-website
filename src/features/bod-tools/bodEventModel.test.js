import assert from "node:assert/strict";
import test from "node:test";
import {
  BOD_EVENT_SOURCE,
  buildBodEventPayload,
  getBodEventAttachments,
  getBodEventPermissions,
  getDriveFileId,
  getDriveThumbnailUrl,
  isValidDateOnly,
  normalizeBodEvent,
  safeExternalUrl,
} from "./bodEventModel.js";

const base = { name: " Project One ", date: "2026-07-05", type: "clubEvent", avenue: ["CMD"] };

test("club event normalizes without exposing unknown fields", () => {
  const event = normalizeBodEvent("event-1", { ...base, secret: "no", collaborators: [{ name: " Club A " }] });
  assert.equal(event.name, "Project One");
  assert.equal(event.recordKind, "clubEvent");
  assert.deepEqual(event.collaborators, [{ name: "Club A" }]);
  assert.equal(Object.hasOwn(event, "secret"), false);
});

test("BOD meetings and district events stay read-only", () => {
  for (const type of ["bodMeeting", "districtEvent"]) {
    const event = normalizeBodEvent(type, { ...base, type });
    assert.equal(event.recordKind, type);
    assert.equal(event.canEdit, false);
    assert.equal(event.canArchive, false);
  }
});

test("archived and deleted records are inactive", () => {
  assert.equal(normalizeBodEvent("a", { ...base, archived: true }).isActive, false);
  assert.equal(normalizeBodEvent("b", { ...base, status: "deleted" }).isActive, false);
});

test("arrays are cleaned, malformed values ignored, and avenues deduplicated", () => {
  const event = normalizeBodEvent("a", { ...base, avenue: [" cmd ", null, "CMD", 3], imageLinks: ["https://example.com/a.jpg", "javascript:bad"] });
  assert.deepEqual(event.avenues, ["CMD"]);
  assert.deepEqual(event.imageLinks, ["https://example.com/a.jpg"]);
});

test("strict dates accept leap day and reject invalid dates and reversed ranges", () => {
  assert.equal(isValidDateOnly("2028-02-29"), true);
  assert.equal(isValidDateOnly("2027-02-29"), false);
  assert.equal(normalizeBodEvent("bad", { ...base, date: "2027-02-29" }), null);
  assert.equal(normalizeBodEvent("range", { ...base, endDate: "2026-07-01" }).endDate, "");
});

test("safe links accept only HTTP(S)", () => {
  assert.equal(safeExternalUrl("javascript:alert(1)"), "");
  assert.equal(safeExternalUrl("https://example.com/folder"), "https://example.com/folder");
});

test("Drive file helpers derive IDs and thumbnail URLs without changing stored links", () => {
  const viewUrl = "https://drive.google.com/file/d/image_ABC-123/view?usp=sharing";
  assert.equal(getDriveFileId(viewUrl), "image_ABC-123");
  assert.equal(getDriveFileId("https://drive.google.com/open?id=query_123"), "query_123");
  assert.equal(getDriveFileId("https://example.com/file/d/nope/view"), "");
  assert.equal(getDriveThumbnailUrl(viewUrl), "https://drive.google.com/thumbnail?id=image_ABC-123&sz=w1000");
});

test("event attachments merge, deduplicate, and preview only image-designated links", () => {
  const imageUrl = "https://drive.google.com/file/d/image123/view";
  const pdfUrl = "https://drive.google.com/file/d/pdf123/view";
  const attachments = getBodEventAttachments({
    previewLink: imageUrl,
    imageLinks: [imageUrl],
    driveLinks: [imageUrl, pdfUrl],
  });
  assert.equal(attachments.length, 2);
  assert.equal(attachments[0].thumbnailUrl, "https://drive.google.com/thumbnail?id=image123&sz=w1000");
  assert.equal(attachments[0].image, true);
  assert.equal(attachments[1].thumbnailUrl, "");
  assert.equal(attachments[1].image, false);
  assert.equal(attachments[1].url, pdfUrl);
});

test("permissions allow active club mutations and capability-gated sync only", () => {
  const event = normalizeBodEvent("a", base);
  const bod = { canAccessBodTools: true, canAccessAdminTools: false, canAccessPresidentControls: false };
  assert.deepEqual(getBodEventPermissions(event, bod, "unlocked"), { canEdit: true, canArchive: true, canSync: false });
  assert.equal(getBodEventPermissions(event, { ...bod, canAccessAdminTools: true }, "unlocked").canSync, true);
  assert.equal(getBodEventPermissions(event, bod, "locked").canEdit, false);
  assert.equal(getBodEventPermissions(event, { ...bod, canAccessPresidentControls: true }, "locked").canEdit, true);
  assert.equal(getBodEventPermissions(event, bod, "unknown").canEdit, false);
});

test("payload builder whitelists fields and forces production classification", () => {
  const { payload, errors } = buildBodEventPayload({
    name: "Test", conductedBy: "Member", startDate: "2026-07-05", endDate: "",
    time: "18:30", avenues: ["CMD", "CMD"], description: "Desc", rcphRole: "host",
    hostClub: " RCPH ", collaborators: [{ name: " " }, { name: "Partner" }],
    collaborationNotes: "Notes", driveFolder: "https://drive.google.com/drive/folders/abc",
    type: "districtEvent", visibility: "internal", uiOnly: true,
  }, "event-1");
  assert.deepEqual(errors, {});
  assert.equal(payload.eventId, "event-1");
  assert.equal(payload.type, "clubEvent");
  assert.equal(payload.source, BOD_EVENT_SOURCE);
  assert.equal(payload.visibility, "public");
  assert.deepEqual(payload.collaborators, [{ name: "Partner" }]);
  assert.equal(Object.hasOwn(payload, "uiOnly"), false);
});

test("payload validation rejects bad ranges and keeps no raw record fields", () => {
  const result = buildBodEventPayload({ name: "Test", conductedBy: "Member", startDate: "2026-07-05", endDate: "2026-07-04", avenues: ["CMD"] });
  assert.equal(result.payload, null);
  assert.ok(result.errors.endDate);
});
