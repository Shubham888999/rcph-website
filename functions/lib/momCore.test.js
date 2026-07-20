const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildMomMetadata,
  dedupeMomRecipients,
  canUploadMomAccess,
  canViewMomAccess,
  isCanonicalBodMomTargetData,
  isPdfBuffer,
  momDriveSubfolderName,
  momRecipientMatchesGroups,
  normalizeMomAccess,
  normalizeMomEmailAddress,
  normalizeMomRecipientGroups,
  normalizeMomTargetUserIds,
  serializeMomMetadata,
  targetCollectionForType,
  validateMomFileDescriptor,
  validateMomTarget,
  validateMomEmailRequest,
} = require("./momCore");

test("MOM backend permissions allow upload only for admin, president, and secretary", () => {
  assert.equal(canUploadMomAccess({ isApproved: true, storedRole: "admin", positionKeys: [] }), true);
  assert.equal(canUploadMomAccess({ isApproved: true, storedRole: "president", positionKeys: [] }), true);
  assert.equal(canUploadMomAccess({ isApproved: true, storedRole: "bod", positionKeys: ["secretary"] }), true);
  assert.equal(canUploadMomAccess({ isApproved: true, storedRole: "bod", positionKeys: ["cmd"] }), false);
  assert.equal(canUploadMomAccess({ isApproved: false, storedRole: "admin", positionKeys: ["secretary"] }), false);
});

test("MOM backend permissions allow viewing for BOD and directors", () => {
  assert.equal(canViewMomAccess({ isApproved: true, storedRole: "bod", positionKeys: [] }), true);
  assert.equal(canViewMomAccess({ isApproved: true, storedRole: "gbm", positionKeys: ["cmd"] }), true);
  assert.equal(canViewMomAccess({ isApproved: true, storedRole: "gbm", positionKeys: [] }), false);
});

test("MOM access normalizes current user and role document shapes", () => {
  const access = normalizeMomAccess({
    uid: "u1",
    user: { name: " Asha ", status: "approved", active: true },
    role: { role: "bod", status: "approved", positionKeys: ["Co-Secretary"] },
  });
  assert.equal(access.isApproved, true);
  assert.equal(access.storedRole, "bod");
  assert.deepEqual(access.positionKeys, ["co-secretary"]);
  assert.equal(access.displayName, "Asha");
  assert.equal(canUploadMomAccess(access), true);
});

test("MOM target mapping uses canonical collections", () => {
  assert.equal(targetCollectionForType("club_event"), "events");
  assert.equal(targetCollectionForType("bod_meeting"), "bodMeetings");
  assert.equal(targetCollectionForType("district_event"), "districtEvents");
  assert.equal(targetCollectionForType("bod_event"), "bodEvents");
  assert.equal(validateMomTarget({ targetType: "bod_event", targetId: "abc_123" }).ok, true);
  assert.equal(validateMomTarget({ targetType: "bod_event", targetId: "bad/path" }).ok, false);
});

test("MOM Drive subfolder hints stay target-scoped", () => {
  assert.equal(momDriveSubfolderName("club_event"), "Club Events");
  assert.equal(momDriveSubfolderName("bod_meeting"), "BOD Meetings");
  assert.equal(momDriveSubfolderName("district_event"), "District Events");
  assert.equal(momDriveSubfolderName("bod_event"), "BOD Events");
});

test("MOM PDF validation rejects non-PDF files", () => {
  assert.equal(validateMomFileDescriptor({ fileName: "mom.pdf", mimeType: "application/pdf", sizeBytes: 10 }).ok, true);
  assert.equal(validateMomFileDescriptor({ fileName: "mom.png", mimeType: "image/png", sizeBytes: 10 }).ok, false);
  assert.equal(validateMomFileDescriptor({ fileName: "mom.pdf", mimeType: "application/pdf", sizeBytes: 11 * 1024 * 1024 }).code, "resource-exhausted");
  assert.equal(isPdfBuffer(Buffer.from("%PDF-1.7\nbody")), true);
  assert.equal(isPdfBuffer(Buffer.from("not a pdf")), false);
});

test("canonical BOD MOM targets reject synced copies", () => {
  assert.equal(isCanonicalBodMomTargetData({ recordKind: "clubEvent", isSynced: false, isActive: true }), true);
  assert.equal(isCanonicalBodMomTargetData({ recordKind: "bodMeeting" }), false);
  assert.equal(isCanonicalBodMomTargetData({ recordKind: "clubEvent", isSynced: true }), false);
});

test("MOM metadata replaces file while preserving original uploader", () => {
  const first = buildMomMetadata({
    target: { targetType: "club_event", targetId: "event1" },
    previous: {},
    upload: { driveFileId: "drive1", fileName: "first.pdf" },
    access: { uid: "u1", displayName: "First User" },
    now: "2026-07-01T00:00:00.000Z",
  });
  const replaced = buildMomMetadata({
    target: { targetType: "club_event", targetId: "event1" },
    previous: first,
    upload: { driveFileId: "drive2", fileName: "second.pdf" },
    access: { uid: "u2", displayName: "Second User" },
    now: "2026-07-02T00:00:00.000Z",
  });
  assert.equal(replaced.momDriveFileId, "drive2");
  assert.equal(replaced.momUploadedBy, "u1");
  assert.equal(replaced.momUploadedByName, "First User");
  assert.equal(replaced.momReplacedBy, "u2");
  assert.equal(serializeMomMetadata(replaced).momUpdatedAt, "2026-07-02T00:00:00.000Z");
});

test("MOM email recipient groups and payload validation are strict", () => {
  assert.deepEqual(normalizeMomRecipientGroups(["bod", "bad", "BOD", "gbm"]), ["bod", "gbm"]);
  assert.equal(validateMomEmailRequest({ recipientGroups: ["bod"], subject: "MOM", body: "Attached." }).ok, true);
  assert.equal(validateMomEmailRequest({ recipientGroups: ["bad"], subject: "MOM", body: "Attached." }).ok, false);
  assert.equal(validateMomEmailRequest({ recipientGroups: ["bod"], subject: "", body: "Attached." }).ok, false);
  assert.equal(validateMomEmailRequest({ recipientGroups: ["bod"], subject: "MOM", body: "" }).ok, false);
});

test("MOM email address validation reports skipped invalid recipients", () => {
  assert.deepEqual(normalizeMomEmailAddress(" MEMBER@Example.COM "), { ok: true, email: "member@example.com", code: "" });
  assert.equal(normalizeMomEmailAddress("").code, "missing_email");
  assert.equal(normalizeMomEmailAddress("not-email").code, "invalid_email");
});
test("MOM email recipient groups include role and active position metadata", () => {
  assert.equal(momRecipientMatchesGroups({ role: "president" }, ["president"]), true);
  assert.equal(momRecipientMatchesGroups({ role: "bod", positionKeys: ["president"] }, ["president"]), true);
  assert.equal(momRecipientMatchesGroups({ role: "bod", hasPresidentAuthority: true }, ["president"]), true);
  assert.equal(momRecipientMatchesGroups({ role: "bod", positionKeys: ["Secretary"] }, ["secretary"]), true);
  assert.equal(momRecipientMatchesGroups({ role: "bod", positionKeys: ["saa"] }, ["sergeant"]), true);
  assert.equal(momRecipientMatchesGroups({ role: "admin" }, ["admin"]), true);
  assert.equal(momRecipientMatchesGroups({ role: "gbm" }, ["gbm"]), true);
  assert.equal(momRecipientMatchesGroups({ role: "prospect" }, ["prospect"]), true);
  assert.equal(momRecipientMatchesGroups({ role: "bod" }, ["all"]), true);
  assert.equal(momRecipientMatchesGroups({ role: "bod", positionKeys: ["cmd"] }, ["president"]), false);
});

test("MOM email request accepts specific UIDs and rejects raw email IDs", () => {
  assert.deepEqual(normalizeMomRecipientGroups(["sergeant", "saa", "Secretary"]), ["saa", "secretary"]);
  assert.deepEqual(normalizeMomTargetUserIds(["uid-one", "uid-one", "uid-two"]).targetUserIds, ["uid-one", "uid-two"]);
  const byUid = validateMomEmailRequest({ targetUserIds: ["uid-one"], subject: "MOM", body: "Attached." });
  assert.equal(byUid.ok, true);
  assert.deepEqual(byUid.recipientGroups, []);
  assert.deepEqual(byUid.targetUserIds, ["uid-one"]);
  assert.equal(validateMomEmailRequest({ targetUserIds: ["member@example.com"], subject: "MOM", body: "Attached." }).ok, false);
  assert.equal(validateMomEmailRequest({ recipientGroups: [], targetUserIds: [], subject: "MOM", body: "Attached." }).ok, false);
});

test("MOM explicit and grouped recipients dedupe by UID and email", () => {
  const recipients = dedupeMomRecipients([
    { uid: "uid-b", email: "B@example.com", role: "gbm" },
    { uid: "uid-a", email: "a@example.com", role: "bod" },
    { uid: "uid-a", email: "other@example.com", role: "bod" },
    { uid: "uid-c", email: "a@example.com", role: "admin" },
    { uid: "bad", email: "not-email", role: "gbm" },
  ]);
  assert.deepEqual(recipients.map((recipient) => recipient.uid), ["uid-a", "uid-b"]);
  assert.deepEqual(recipients.map((recipient) => recipient.email), ["a@example.com", "b@example.com"]);
});