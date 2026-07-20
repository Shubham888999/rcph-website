import assert from "node:assert/strict";
import test from "node:test";
import {
  MOM_RECIPIENT_GROUP_OPTIONS,
  MOM_PDF_MAX_BYTES,
  buildMomEmailDefaults,
  buildMomRecipientPreview,
  canSendMomEmail,
  canUploadMom,
  canViewMom,
  getBodMomTarget,
  momDriveSubfolderName,
  momUploadError,
  normalizeMomEmailHistory,
  normalizeMomMetadata,
  momRecipientMatchesGroups,
  normalizeMomRecipientOptions,
  validateMomEmailDraft,
  validateMomPdfFile,
} from "./momModel.js";

test("MOM permissions allow upload for admin, president, and secretary only", () => {
  assert.equal(canUploadMom({ isApproved: true, storedRole: "admin" }), true);
  assert.equal(canUploadMom({ isApproved: true, storedRole: "president" }), true);
  assert.equal(canUploadMom({ isApproved: true, storedRole: "bod", positionKeys: ["secretary"] }), true);
  assert.equal(canUploadMom({ isApproved: true, storedRole: "bod", positionKeys: ["csd"] }), false);
  assert.equal(canUploadMom({ isApproved: true, storedRole: "gbm" }), false);
  assert.equal(canSendMomEmail({ isApproved: true, storedRole: "bod", positionKeys: ["secretary"] }), true);
  assert.equal(canSendMomEmail({ isApproved: true, storedRole: "bod", positionKeys: ["cmd"] }), false);
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

test("MOM email defaults and validation stay attachment-first", () => {
  const defaults = buildMomEmailDefaults({ title: "BOD Meeting 2", date: "2026-07-12" });
  assert.equal(defaults.subject, "MOM for BOD Meeting 2");
  assert.match(defaults.body, /Please find attached the Minutes of Meeting for "BOD Meeting 2", conducted on 2026-07-12\./);
  assert.deepEqual(defaults.recipientGroups, ["bod"]);
  assert.equal(validateMomEmailDraft(defaults), "");
  assert.deepEqual(MOM_RECIPIENT_GROUP_OPTIONS.map((item) => item.value), ["all", "bod", "gbm", "prospect", "president", "secretary", "saa", "admin"]);
  assert.equal(validateMomEmailDraft({ ...defaults, recipientGroups: [], targetUserIds: ["uid-one"] }), "");
  assert.match(validateMomEmailDraft({ ...defaults, recipientGroups: [], targetUserIds: [] }), /recipient group or specific member/);
  assert.match(validateMomEmailDraft({ ...defaults, recipientGroups: ["bad"] }), /valid recipient group/);
  assert.match(validateMomEmailDraft({ ...defaults, recipientGroups: [], targetUserIds: ["user@example.com"] }), /member list/);
  assert.equal(momUploadError({ code: "functions/failed-precondition", message: "Email sending is not configured for MOM." }), "Email sending is not configured for MOM.");
  assert.equal(momUploadError({ code: "functions/failed-precondition", message: "No eligible recipients found for President." }), "No eligible recipients found for President.");
});

test("MOM specific member recipient options normalize UID-backed users only", () => {
  const options = normalizeMomRecipientOptions([
    { uid: "uid-b", name: "Beta", email: "BETA@example.com", role: "gbm" },
    { uid: "uid-a", name: "Alpha", email: "alpha@example.com", role: "bod", positionKeys: ["Secretary"] },
    { uid: "raw@example.com", name: "Raw", email: "raw@example.com" },
    { uid: "uid-a", name: "Duplicate", email: "dupe@example.com" },
  ]);
  assert.deepEqual(options.map((item) => item.uid), ["uid-a", "uid-b"]);
  assert.deepEqual(options[0].positionKeys, ["secretary"]);
});

test("MOM recipient preview matches groups, specific members, and active BOD positions", () => {
  const options = normalizeMomRecipientOptions([
    { uid: "uid-bod", name: "Alpha BOD", email: "bod@example.com", role: "bod" },
    { uid: "uid-cmd", name: "Beta CMD", email: "cmd@example.com", role: "gbm", positionKeys: ["cmd"] },
    { uid: "uid-gbm", name: "Gamma GBM", email: "gbm@example.com", role: "gbm" },
    { uid: "uid-admin", name: "Delta Admin", email: "admin@example.com", role: "admin" },
  ]);

  assert.equal(momRecipientMatchesGroups(options[0], ["bod"]), true);
  assert.equal(momRecipientMatchesGroups(options[1], ["bod"]), true);
  assert.equal(momRecipientMatchesGroups(options[2], ["bod"]), false);

  assert.deepEqual(
    buildMomRecipientPreview(options, { recipientGroups: ["bod"], targetUserIds: [] }).map((recipient) => recipient.uid),
    ["uid-bod", "uid-cmd"],
  );

  assert.deepEqual(
    buildMomRecipientPreview(options, { recipientGroups: ["bod"], targetUserIds: ["uid-admin"] }).map((recipient) => recipient.uid),
    ["uid-bod", "uid-cmd", "uid-admin"],
  );
});

test("MOM email history summary normalizes safe display fields", () => {
  const history = normalizeMomEmailHistory({
    sentAt: "2026-07-13T12:00:00.000Z",
    recipientGroups: ["bod", "gbm", "bod"],
    recipientCount: 10,
    sentByName: "Secretary",
    status: "partial",
    emailSummary: { attempted: 10, sent: 9, failed: 1, skippedInvalidEmail: 1 },
  });
  assert.deepEqual(history.recipientGroups, ["bod", "gbm"]);
  assert.equal(history.emailSummary.sent, 9);
  assert.equal(history.sentByName, "Secretary");
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
    momEmail: null,
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
    momEmail: null,
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
    momEmail: null,
  });
});
