import assert from "node:assert/strict";
import test from "node:test";
import {
  MOM_PDF_MAX_BYTES,
  canUploadMom,
  canViewMom,
  getBodMomTarget,
  momDriveSubfolderName,
  normalizeMomMetadata,
  validateMomPdfFile,
} from "./momModel.js";

test("MOM permissions allow upload for admin, president, and secretary only", () => {
  assert.equal(canUploadMom({ isApproved: true, storedRole: "admin" }), true);
  assert.equal(canUploadMom({ isApproved: true, storedRole: "president" }), true);
  assert.equal(canUploadMom({ isApproved: true, storedRole: "bod", positionKeys: ["secretary"] }), true);
  assert.equal(canUploadMom({ isApproved: true, storedRole: "bod", positionKeys: ["csd"] }), false);
  assert.equal(canUploadMom({ isApproved: true, storedRole: "gbm" }), false);
});

test("MOM permissions allow view for BOD/directors without upload access", () => {
  assert.equal(canViewMom({ isApproved: true, storedRole: "bod", canAccessBodTools: true }), true);
  assert.equal(canViewMom({ isApproved: true, storedRole: "gbm" }), false);
  assert.equal(canViewMom({ isApproved: false, storedRole: "admin" }), false);
});

test("MOM PDF validation accepts PDF only", () => {
  assert.equal(validateMomPdfFile({ name: "mom.pdf", type: "application/pdf", size: 1024 }), "");
  assert.equal(validateMomPdfFile({ name: "mom.pdf", type: "", size: MOM_PDF_MAX_BYTES }), "");
  assert.match(validateMomPdfFile({ name: "mom.txt", type: "application/pdf", size: 10 }), /PDF/);
  assert.match(validateMomPdfFile({ name: "mom.pdf", type: "text/plain", size: 10 }), /Only PDF/);
  assert.match(validateMomPdfFile({ name: "mom.pdf", type: "application/pdf", size: 0 }), /empty/);
  assert.match(validateMomPdfFile({ name: "mom.pdf", type: "application/pdf", size: MOM_PDF_MAX_BYTES + 1 }), /10 MB/);
});

test("MOM metadata normalization keeps Firestore fields only", () => {
  const metadata = normalizeMomMetadata({
    momDriveFileId: " file-1 ",
    momFileName: " meeting-mom.pdf ",
    momMimeType: "application/pdf",
    momUploadedBy: "uid-1",
    momUploadedByName: "Secretary",
    momUploadedAt: new Date("2026-07-10T10:00:00.000Z"),
    momUpdatedAt: "2026-07-11T11:00:00.000Z",
    momReplacedByName: "President",
    publicUrl: "https://drive.google.com/file/d/file-1/view",
  }, {
    momTargetType: "bod_meeting",
    momTargetId: "meeting-1",
  });

  assert.equal(metadata.momDriveFileId, "file-1");
  assert.equal(metadata.momFileName, "meeting-mom.pdf");
  assert.equal(metadata.momUploadedByName, "Secretary");
  assert.equal(metadata.momTargetType, "bod_meeting");
  assert.equal(metadata.momTargetId, "meeting-1");
  assert.equal(Object.hasOwn(metadata, "publicUrl"), false);
});

test("MOM Drive folder hints use the dedicated upload tree", () => {
  assert.equal(momDriveSubfolderName("club_event"), "Club Events");
  assert.equal(momDriveSubfolderName("bod_meeting"), "BOD Meetings");
  assert.equal(momDriveSubfolderName("district_event"), "District Events");
  assert.equal(momDriveSubfolderName("unknown"), "Other MOM");
});

test("BOD MOM target resolves synced copies to canonical records", () => {
  assert.deepEqual(getBodMomTarget({
    id: "bod-copy-1",
    recordKind: "clubEvent",
    isSynced: true,
    syncedEventId: "club-event-1",
    name: "Cheers to Chapters",
    startDate: "2026-07-10",
  }), {
    targetType: "club_event",
    targetId: "club-event-1",
    title: "Cheers to Chapters",
    date: "2026-07-10",
    mom: null,
  });

  assert.deepEqual(getBodMomTarget({
    id: "bod-meeting-copy",
    recordKind: "bodMeeting",
    syncedMeetingId: "meeting-2",
    name: "BOD Meeting 2",
    startDate: "2026-07-12",
  }), {
    targetType: "bod_meeting",
    targetId: "meeting-2",
    title: "BOD Meeting 2",
    date: "2026-07-12",
    mom: null,
  });

  assert.deepEqual(getBodMomTarget({
    id: "bod-own-1",
    recordKind: "clubEvent",
    isSynced: false,
    name: "Internal BOD event",
    startDate: "2026-07-15",
  }), {
    targetType: "bod_event",
    targetId: "bod-own-1",
    title: "Internal BOD event",
    date: "2026-07-15",
    mom: null,
  });
});
