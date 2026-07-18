import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canManageBodManagement } from "../../auth/accessModel.js";
import {
  BOD_PHOTO_ACCEPTED_MIME_TYPES,
  BOD_PHOTO_FILE_ACCEPT,
  BOD_PHOTO_MAX_BYTES,
  BOD_MANAGEMENT_BOARD_ID,
  LEADERSHIP_PROFILE_SECTION_KEY,
  activeProfilesForSection,
  activeClubBodProfiles,
applyBodProfileMutationResult,
applyBodSectionPublishResult,
applyBodSectionSaveResult,
  archivedProfilesForSection,
  archivedClubBodProfiles,
  buildArchiveBodProfilePayload,
  buildCreateBodPhotoUploadSessionPayload,
buildFinalizeBodPhotoUploadPayload,
buildPublishBodSectionPayload,
buildRemoveBodProfilePhotoPayload,
  buildReorderBodProfilesPayload,
  buildRestoreBodProfilePayload,
  buildSaveBodSectionPublicationPayload,
  buildUpsertBodProfilePayload,
  createDefaultBodManagementBoard,
  createDefaultBodProfileForm,
  formatBodPhotoSize,
  getBodDraftPreviewMembers,
  getBodPhotoBadge,
  getBodPhotoDimensionWarnings,
  getBodProfileCounts,
getBodProfileWarnings,
getBodPublicationMissingFields,
getBodSectionPublicationReview,
getProfileCountsForSection,
  hasReadyPhoto,
  initialBodPublicationSelections,
  isBodSectionSaveEnabled,
  isRevisionConflict,
  moveProfileOrder,
  moveBodProfileOrder,
  needsDraftConfirmation,
  normalizeAvenueLabels,
  normalizeBodManagementBoard,
  normalizeBodProfileForm,
  normalizeBodProfilePhoto,
  profileDraftIndicators,
  nextSortOrderForSection,
  validateBodPhotoFile,
  validateBodProfileForm,
} from "./bodManagementModel.js";

const navigation = readFileSync(new URL("../shared/adminNavigation.js", import.meta.url), "utf8");
const shell = readFileSync(new URL("../AdminShell.jsx", import.meta.url), "utf8");
const router = readFileSync(new URL("../../../app/router.jsx", import.meta.url), "utf8");
const adminPage = readFileSync(new URL("../../../pages/admin/AdminPage.jsx", import.meta.url), "utf8");
const moduleSource = readFileSync(new URL("./BodManagementModule.jsx", import.meta.url), "utf8");
const modelSource = readFileSync(new URL("./bodManagementModel.js", import.meta.url), "utf8");
const bodManagementSource = `${moduleSource}\n${modelSource}`;
const serviceSource = readFileSync(new URL("../shared/adminService.js", import.meta.url), "utf8");

function access(role, extra = {}) {
  return { isApproved: true, storedRole: role, ...extra };
}

test("BOD Management access is canonical Admin or President only", () => {
  assert.equal(canManageBodManagement(access("admin")), true);
  assert.equal(canManageBodManagement(access("president")), true);
  assert.equal(canManageBodManagement(access("bod", { hasSergeantAtArmsPosition: true, canAccessAdminTools: true })), false);
  assert.equal(canManageBodManagement(access("bod", { hasWebsiteDirectorPosition: true, hasPresidentAuthority: true, canAccessAdminTools: true })), false);
  assert.equal(canManageBodManagement(access("bod")), false);
  assert.equal(canManageBodManagement(access("gbm")), false);
  assert.equal(canManageBodManagement({ isApproved: false, storedRole: "admin" }), false);
});

test("BOD Management route and navigation use the narrow capability", () => {
  assert.match(navigation, /\["dzr-visit", "DZR Visit"\], \["bod-management", "BOD Management"\]/);
  assert.match(shell, /path !== "bod-management" \|\| canAccessBodManagement/);
  assert.match(router, /capability="bodManagement"[\s\S]*path: "\/admin\/bod-management"/);
  assert.match(adminPage, /segment === "bod-management" && !canAccessBodManagement/);
  assert.match(adminPage, /<BodManagementModule uid=\{uid\} access=\{access\} onNotice=\{setNotice\} \/>/);
});

test("uninitialized board defaults are Draft and first Save is enabled", () => {
  const board = createDefaultBodManagementBoard();
  const selections = initialBodPublicationSelections(board);
  assert.equal(board.initialized, false);
  assert.equal(board.boardId, BOD_MANAGEMENT_BOARD_ID);
  assert.equal(board.sections.clubBoard.publicationStatus, "draft");
  assert.equal(board.sections.leadershipBeyondClub.publicationStatus, "draft");
  assert.equal(isBodSectionSaveEnabled(board, selections, "clubBoard"), true);
});

test("save payload is Draft-only and carries expected revisions", () => {
  const board = normalizeBodManagementBoard({
    ok: true,
    initialized: true,
    boardId: BOD_MANAGEMENT_BOARD_ID,
    sections: {
      clubBoard: {
        publicationStatus: "public",
        draftRevision: 2,
        publishedRevision: 4,
        publishedAt: "2026-07-01T00:00:00.000Z",
      },
    },
  });
  const selections = { clubBoard: "draft" };
  assert.equal(isBodSectionSaveEnabled(board, selections, "clubBoard"), true);
  assert.equal(needsDraftConfirmation(board, selections, "clubBoard"), true);
  assert.deepEqual(buildSaveBodSectionPublicationPayload(board, "clubBoard"), {
    boardId: BOD_MANAGEMENT_BOARD_ID,
    sectionKey: "clubBoard",
    publicationStatus: "draft",
    expectedDraftRevision: 2,
    expectedPublishedRevision: 4,
  });
});

test("successful save updates local section status and keeps publishing out of scope", () => {
  const board = createDefaultBodManagementBoard();
  const updated = applyBodSectionSaveResult(board, {
    initialized: true,
    sectionKey: "clubBoard",
    section: {
      publicationStatus: "draft",
      draftRevision: 0,
      publishedRevision: 0,
      publishedAt: null,
    },
  });
  assert.equal(updated.initialized, true);
  assert.equal(updated.sections.clubBoard.publicationStatus, "draft");
  assert.match(bodManagementSource, /Add Profile/);
  assert.match(moduleSource, /Move Up/);
  assert.match(moduleSource, /Move Down/);
  assert.match(moduleSource, /saveBodSectionPublication/);
  assert.match(serviceSource, /upsertBodProfile/);
  assert.match(serviceSource, /archiveBodProfile/);
  assert.match(serviceSource, /restoreBodProfile/);
  assert.match(serviceSource, /reorderBodProfiles/);
  assert.match(serviceSource, /createBodPhotoUploadSession/);
  assert.match(serviceSource, /finalizeBodPhotoUpload/);
  assert.match(serviceSource, /removeBodProfilePhoto/);
  assert.match(serviceSource, /publishBodSection/);
assert.match(moduleSource, /adminCalls\.publishBodSection/);
});

test("publish payload requires an initialized board and carries both expected revisions", () => {
  assert.throws(
    () => buildPublishBodSectionPayload(createDefaultBodManagementBoard(), "clubBoard"),
    /Initialize BOD Management before publishing/,
  );

  const board = normalizeBodManagementBoard({
    initialized: true,
    boardId: BOD_MANAGEMENT_BOARD_ID,
    sections: {
      clubBoard: {
        publicationStatus: "draft",
        draftRevision: 4,
        publishedRevision: 2,
      },
      leadershipBeyondClub: {
        publicationStatus: "public",
        draftRevision: 7,
        publishedRevision: 5,
      },
    },
  });

  assert.deepEqual(
    buildPublishBodSectionPayload(board, "clubBoard"),
    {
      boardId: BOD_MANAGEMENT_BOARD_ID,
      sectionKey: "clubBoard",
      expectedDraftRevision: 4,
      expectedPublishedRevision: 2,
    },
  );
});

test("publish result updates only the published section locally", () => {
  const board = normalizeBodManagementBoard({
    initialized: true,
    sections: {
      clubBoard: {
        publicationStatus: "draft",
        draftRevision: 4,
        publishedRevision: 2,
      },
      leadershipBeyondClub: {
        publicationStatus: "public",
        draftRevision: 7,
        publishedRevision: 5,
        publishedAt: "2026-07-01T00:00:00.000Z",
      },
    },
  });

  const updated = applyBodSectionPublishResult(board, {
    sectionKey: "clubBoard",
    section: {
      publicationStatus: "public",
      draftRevision: 4,
      publishedRevision: 3,
      publishedAt: "2026-07-17T20:00:00.000Z",
    },
  });

  assert.equal(updated.initialized, true);
  assert.equal(updated.sections.clubBoard.publicationStatus, "public");
  assert.equal(updated.sections.clubBoard.draftRevision, 4);
  assert.equal(updated.sections.clubBoard.publishedRevision, 3);
  assert.equal(
    updated.sections.clubBoard.publishedAt,
    "2026-07-17T20:00:00.000Z",
  );

  assert.equal(
    updated.sections.leadershipBeyondClub.publishedRevision,
    5,
  );
  assert.equal(
    updated.sections.leadershipBeyondClub.publishedAt,
    "2026-07-01T00:00:00.000Z",
  );
});

test("publication review includes only active selected profiles and blocks incomplete profiles", () => {
  const readyPhoto = {
    status: "ready",
    mimeType: "image/jpeg",
    originalName: "profile.jpg",
    sizeBytes: 120000,
    version: 1,
  };

  const board = normalizeBodManagementBoard({
    initialized: true,
    profiles: {
      clubBoard: [
        {
          id: "club-ready",
          sectionKey: "clubBoard",
          name: "Ready Member",
          positionKey: "president",
          positionLabel: "President",
          summary: "Ready for publication.",
          displayPublicly: true,
          status: "active",
          sortOrder: 10,
          photo: readyPhoto,
        },
        {
          id: "club-missing-photo",
          sectionKey: "clubBoard",
          name: "Missing Photo",
          positionKey: "secretary",
          positionLabel: "Secretary",
          summary: "Profile content is complete.",
          displayPublicly: true,
          status: "active",
          sortOrder: 20,
          photo: null,
        },
        {
          id: "club-not-included",
          sectionKey: "clubBoard",
          name: "Not Included",
          positionKey: "treasurer",
          positionLabel: "Treasurer",
          summary: "Not selected for publishing.",
          displayPublicly: false,
          status: "active",
          sortOrder: 30,
          photo: readyPhoto,
        },
        {
          id: "club-archived",
          sectionKey: "clubBoard",
          name: "Archived Member",
          positionKey: "vice-president",
          positionLabel: "Vice President",
          summary: "Archived profile.",
          displayPublicly: true,
          status: "archived",
          sortOrder: 40,
          photo: readyPhoto,
        },
      ],
    },
  });

  assert.deepEqual(
    getBodPublicationMissingFields(
      board.profiles.clubBoard.find(
        (profile) => profile.id === "club-missing-photo",
      ),
    ),
    ["photo"],
  );

  const review = getBodSectionPublicationReview(board, "clubBoard");

  assert.equal(review.includedCount, 2);
  assert.equal(review.incompleteCount, 1);
  assert.equal(review.canPublish, false);
  assert.deepEqual(
    review.includedProfiles.map((profile) => profile.id),
    ["club-ready", "club-missing-photo"],
  );
  assert.deepEqual(review.incompleteProfiles, [
    {
      profileId: "club-missing-photo",
      name: "Missing Photo",
      missingFields: ["photo"],
    },
  ]);
});

test("publication review accepts complete Club and external leadership profiles", () => {
  const readyPhoto = {
    status: "ready",
    mimeType: "image/webp",
    originalName: "profile.webp",
    sizeBytes: 150000,
    version: 2,
  };

  const board = normalizeBodManagementBoard({
    initialized: true,
    profiles: {
      clubBoard: [
        {
          id: "club-complete",
          sectionKey: "clubBoard",
          name: "Club Member",
          positionKey: "president",
          positionLabel: "President",
          summary: "Club profile ready.",
          displayPublicly: true,
          status: "active",
          photo: readyPhoto,
        },
      ],
      leadershipBeyondClub: [
        {
          id: "external-complete",
          sectionKey: LEADERSHIP_PROFILE_SECTION_KEY,
          name: "District Leader",
          positionKey: "custom",
          positionLabel: "District Officer",
          leadershipLevel: "district",
          organizationName: "Rotaract District 3131",
          summary: "External leadership profile ready.",
          displayPublicly: true,
          status: "active",
          photo: readyPhoto,
        },
      ],
    },
  });

  const clubReview = getBodSectionPublicationReview(board, "clubBoard");
  const externalReview = getBodSectionPublicationReview(
    board,
    LEADERSHIP_PROFILE_SECTION_KEY,
  );

  assert.equal(clubReview.canPublish, true);
  assert.equal(clubReview.includedCount, 1);
  assert.equal(clubReview.incompleteCount, 0);

  assert.equal(externalReview.canPublish, true);
  assert.equal(externalReview.includedCount, 1);
  assert.equal(externalReview.incompleteCount, 0);
});

test("draft preview members are admin-only sanitized display selections", () => {
  const readyPhoto = {
    status: "ready",
    mimeType: "image/jpeg",
    originalName: "profile.jpg",
    sizeBytes: 120000,
    version: 3,
    driveFileId: "private-drive-id",
  };

  const board = normalizeBodManagementBoard({
    initialized: true,
    profiles: {
      clubBoard: [
        {
          id: "club-preview",
          sectionKey: "clubBoard",
          name: "Preview Member",
          positionKey: "president",
          positionLabel: "President",
          summary: "Visible in draft preview.",
          bio: "Draft biography.",
          avenueLabels: ["CSD"],
          instagramUsername: "preview.member",
          displayPublicly: true,
          status: "active",
          sortOrder: 10,
          photo: readyPhoto,
        },
        {
          id: "club-hidden",
          sectionKey: "clubBoard",
          name: "Hidden Member",
          positionKey: "secretary",
          positionLabel: "Secretary",
          summary: "Not selected.",
          displayPublicly: false,
          status: "active",
          sortOrder: 20,
          photo: readyPhoto,
        },
        {
          id: "club-archived",
          sectionKey: "clubBoard",
          name: "Archived Member",
          positionKey: "treasurer",
          positionLabel: "Treasurer",
          summary: "Archived.",
          displayPublicly: true,
          status: "archived",
          sortOrder: 30,
          photo: readyPhoto,
        },
      ],
      leadershipBeyondClub: [
        {
          id: "external-preview",
          sectionKey: LEADERSHIP_PROFILE_SECTION_KEY,
          name: "External Preview",
          positionKey: "custom",
          positionLabel: "District Secretary",
          leadershipLevel: "district",
          organizationName: "Rotaract District 3131",
          termLabel: "RIY 2026-27",
          summary: "External preview.",
          displayPublicly: true,
          status: "active",
          sortOrder: 10,
          photo: readyPhoto,
        },
      ],
    },
  });

  const clubMembers = getBodDraftPreviewMembers(board, "clubBoard");
  const externalMembers = getBodDraftPreviewMembers(board, LEADERSHIP_PROFILE_SECTION_KEY);

  assert.deepEqual(clubMembers.map((member) => member.profileId), ["club-preview"]);
  assert.equal(clubMembers[0].id, "club-preview");
  assert.equal(clubMembers[0].image, "");
  assert.equal(clubMembers[0].photoLabel, "Protected draft photo");
  assert.deepEqual(clubMembers[0].avenue, ["CSD"]);
  assert.equal("photo" in clubMembers[0], false);
  assert.equal("driveFileId" in clubMembers[0], false);
  assert.equal("photoUrl" in clubMembers[0], false);

  assert.deepEqual(externalMembers, [
    {
      id: "external-preview",
      profileId: "external-preview",
      name: "External Preview",
      role: "District Secretary",
      responsibility: "External preview.",
      bio: "",
      image: "",
      photoLabel: "Protected draft photo",
      instagram: "",
      handle: "",
      councilGroup: "District",
      context: "Rotaract District 3131 \u00b7 RIY 2026-27",
    },
  ]);
});

test("admin board normalization includes sorted Club BOD profiles and sanitized options", () => {
  const board = normalizeBodManagementBoard({
    ok: true,
    initialized: true,
    sections: {
      clubBoard: { publicationStatus: "draft", draftRevision: 3, publishedRevision: 0, publishedAt: null },
    },
    profiles: {
      clubBoard: [
        { id: "b", sectionKey: "clubBoard", name: "Beta", positionKey: "secretary", positionLabel: "Secretary", summary: "", bio: "", avenueLabels: [], instagramUsername: null, linkedBodMemberId: null, linkedUserUid: null, sortOrder: 20, displayPublicly: true, status: "active" },
        { id: "a", sectionKey: "clubBoard", name: "Alpha", positionKey: "president", positionLabel: "President", summary: "Leads", bio: "", avenueLabels: ["CSD"], instagramUsername: "@alpha", linkedBodMemberId: "member-1", linkedUserUid: "user-1", sortOrder: 10, displayPublicly: false, status: "active" },
        { id: "z", sectionKey: "clubBoard", name: "Old", positionKey: "custom", positionLabel: "Past", summary: "", bio: "", avenueLabels: [], instagramUsername: null, linkedBodMemberId: null, linkedUserUid: null, sortOrder: 1, displayPublicly: false, status: "archived" },
        { id: "x", sectionKey: "leadershipBeyondClub", name: "Nope" },
      ],
      leadershipBeyondClub: [{ id: "external" }],
    },
    options: {
      bodMemberLinks: [{ id: "member-1", name: "Roster", positionLabel: "President" }],
      userLinks: [{ uid: "user-1", name: "Portal", role: "bod" }],
    },
  });

  assert.deepEqual(activeClubBodProfiles(board).map((profile) => profile.id), ["a", "b"]);
  assert.deepEqual(archivedClubBodProfiles(board).map((profile) => profile.id), ["z"]);
  assert.deepEqual(board.profiles.leadershipBeyondClub, []);
  assert.equal(board.options.bodMemberLinks[0].name, "Roster");
  assert.equal(getBodProfileCounts(board).included, 1);
});

test("admin board normalization retains external leadership profiles and leadership levels", () => {
  const board = normalizeBodManagementBoard({
    ok: true,
    initialized: true,
    sections: {
      clubBoard: { publicationStatus: "draft", draftRevision: 3, publishedRevision: 0, publishedAt: null },
      leadershipBeyondClub: { publicationStatus: "draft", draftRevision: 8, publishedRevision: 0, publishedAt: null },
    },
    profiles: {
      clubBoard: [
        { id: "club-a", sectionKey: "clubBoard", name: "Club A", positionKey: "president", positionLabel: "President", summary: "Club", bio: "", avenueLabels: [], instagramUsername: null, linkedBodMemberId: "same", linkedUserUid: "same-user", sortOrder: 10, displayPublicly: false, status: "active" },
      ],
      leadershipBeyondClub: [
        { id: "ext-b", sectionKey: "leadershipBeyondClub", name: "External B", positionKey: "custom", positionLabel: "District Secretary", leadershipLevel: "district", organizationName: "Rotaract District 3131", termLabel: "RIY 2026-27", summary: "Beyond", bio: "", avenueLabels: [], instagramUsername: null, linkedBodMemberId: "same", linkedUserUid: "same-user", sortOrder: 20, displayPublicly: true, status: "active" },
        { id: "ext-a", sectionKey: "leadershipBeyondClub", name: "External A", positionKey: "custom", positionLabel: "Zone Lead", leadershipLevel: "zone", organizationName: "Zone 1", termLabel: "", summary: "", bio: "", avenueLabels: ["CSD"], instagramUsername: "@external", linkedBodMemberId: null, linkedUserUid: null, sortOrder: 10, displayPublicly: false, status: "active" },
        { id: "ext-z", sectionKey: "leadershipBeyondClub", name: "External Old", positionKey: "custom", positionLabel: "Past", leadershipLevel: "other", organizationName: "Past Body", termLabel: "2025", summary: "Old", bio: "", avenueLabels: [], instagramUsername: null, linkedBodMemberId: null, linkedUserUid: null, sortOrder: 1, displayPublicly: false, status: "archived" },
      ],
    },
    options: {
      leadershipLevels: [{ key: "district", label: "District" }, { key: "zone", label: "Zone" }],
    },
  });

  assert.deepEqual(activeProfilesForSection(board, LEADERSHIP_PROFILE_SECTION_KEY).map((profile) => profile.id), ["ext-a", "ext-b"]);
  assert.deepEqual(archivedProfilesForSection(board, LEADERSHIP_PROFILE_SECTION_KEY).map((profile) => profile.id), ["ext-z"]);
  assert.equal(board.profiles.leadershipBeyondClub[0].leadershipLevelLabel, "Zone");
  assert.equal(getProfileCountsForSection(board, LEADERSHIP_PROFILE_SECTION_KEY).included, 1);
  assert.equal(nextSortOrderForSection(board, LEADERSHIP_PROFILE_SECTION_KEY), 30);
  assert.deepEqual(board.options.leadershipLevels.map((level) => level.key), ["district", "zone", "rotary", "multiDistrict", "national", "international", "other"]);
});

test("profile form payload normalizes presets, Instagram, avenues, and draft revision", () => {
  const board = normalizeBodManagementBoard({
    initialized: true,
    sections: {
      clubBoard: { publicationStatus: "draft", draftRevision: 7, publishedRevision: 0, publishedAt: null },
    },
  });
  const form = {
    ...createDefaultBodProfileForm(board),
    name: " Rtr. Test ",
    positionKey: "president",
    positionLabel: "Spoofed",
    summary: " Leads ",
    avenueText: "CSD, csd, ISD",
    instagramUsername: "https://www.instagram.com/test.member/",
    displayPublicly: true,
  };
  const normalized = normalizeBodProfileForm(form, board.options);
  const payload = buildUpsertBodProfilePayload(board, form);

  assert.equal(normalized.positionLabel, "President");
  assert.deepEqual(normalized.avenueLabels, ["CSD", "ISD"]);
  assert.equal(normalized.instagramUsername, "test.member");
  assert.equal(payload.expectedDraftRevision, 7);
  assert.equal(payload.profile.positionLabel, "President");
  assert.equal(payload.profile.displayPublicly, true);
});

test("external leadership form payload canonicalizes custom role and uses external draft revision", () => {
  const board = normalizeBodManagementBoard({
    initialized: true,
    sections: {
      clubBoard: { publicationStatus: "draft", draftRevision: 7, publishedRevision: 0, publishedAt: null },
      leadershipBeyondClub: { publicationStatus: "draft", draftRevision: 11, publishedRevision: 0, publishedAt: null },
    },
  });
  const form = {
    ...createDefaultBodProfileForm(board, LEADERSHIP_PROFILE_SECTION_KEY),
    name: " External Leader ",
    positionKey: "president",
    positionLabel: " District Secretary ",
    leadershipLevel: "district",
    organizationName: " Rotaract District 3131 ",
    termLabel: " RIY 2026-27 ",
    summary: " Serves beyond club ",
    avenueText: "CSD, csd",
    instagramUsername: "@external.leader",
    displayPublicly: true,
  };
  const normalized = normalizeBodProfileForm(form, board.options);
  const payload = buildUpsertBodProfilePayload(board, form);

  assert.equal(normalized.sectionKey, LEADERSHIP_PROFILE_SECTION_KEY);
  assert.equal(normalized.positionKey, "custom");
  assert.equal(normalized.positionLabel, "District Secretary");
  assert.equal(payload.expectedDraftRevision, 11);
  assert.equal(payload.profile.sectionKey, LEADERSHIP_PROFILE_SECTION_KEY);
  assert.equal(payload.profile.positionKey, "custom");
  assert.equal(payload.profile.leadershipLevel, "district");
  assert.equal(payload.profile.organizationName, "Rotaract District 3131");
  assert.equal(payload.profile.termLabel, "RIY 2026-27");
  assert.equal(payload.profile.instagramUsername, "external.leader");
});

test("external leadership validation and completeness are section specific", () => {
  const board = createDefaultBodManagementBoard();
  const base = createDefaultBodProfileForm(board, LEADERSHIP_PROFILE_SECTION_KEY);
  const complete = {
    ...base,
    name: "Leader",
    positionLabel: "District Secretary",
    leadershipLevel: "district",
    organizationName: "Rotaract District 3131",
    summary: "Summary",
  };

  assert.equal(buildUpsertBodProfilePayload(board, base).profile.leadershipLevel, null);
  assert.deepEqual(profileDraftIndicators({ id: "ext", ...complete, status: "active" }).missingFields, []);
  assert.deepEqual(profileDraftIndicators({ id: "ext", ...base, status: "active" }).missingFields, ["name", "external role", "leadership level", "organization", "summary"]);
  assert.deepEqual(validateBodProfileForm({ ...complete, leadershipLevel: "galaxy" }, board.options).errors, ["Choose a valid leadership level."]);
  assert.deepEqual(validateBodProfileForm({ ...complete, organizationName: "O".repeat(141) }, board.options).errors, ["Organization name is too long."]);
  assert.deepEqual(validateBodProfileForm({ ...complete, termLabel: "T".repeat(61) }, board.options).errors, ["Term label is too long."]);
});

test("profile drafts can be incomplete but still show completeness indicators", () => {
  const board = createDefaultBodManagementBoard();
  const form = createDefaultBodProfileForm(board);
  const payload = buildUpsertBodProfilePayload(board, form);
  const indicators = profileDraftIndicators({ id: "draft", ...payload.profile, status: "active", hasPhoto: false });

  assert.equal(payload.profile.name, "");
  assert.deepEqual(indicators.missingFields, ["name", "position", "summary"]);
  assert.equal(indicators.label, "Needs profile content");
});

test("avenue label validation counts all unique labels without silently discarding the sixth", () => {
  const board = createDefaultBodManagementBoard();
  const base = createDefaultBodProfileForm(board);

  assert.deepEqual(normalizeAvenueLabels("One, Two\nThree, Four, Five"), ["One", "Two", "Three", "Four", "Five"]);
  assert.equal(validateBodProfileForm({ ...base, avenueText: "One, one, TWO, two, Three, Four, Five" }, board.options).ok, true);

  const six = normalizeAvenueLabels("One, Two, Three, Four, Five, Six");
  const validation = validateBodProfileForm({ ...base, avenueText: "One, Two, Three, Four, Five, Six" }, board.options);

  assert.deepEqual(six, ["One", "Two", "Three", "Four", "Five", "Six"]);
  assert.equal(validation.ok, false);
  assert.deepEqual(validation.errors, ["Use five avenue labels or fewer."]);
  assert.throws(
    () => buildUpsertBodProfilePayload(board, { ...base, avenueText: "One, Two, Three, Four, Five, Six" }),
    /Use five avenue labels or fewer\./
  );
});

test("revision conflict detection is limited to aborted function errors", () => {
  assert.equal(isRevisionConflict({ code: "aborted" }), true);
  assert.equal(isRevisionConflict({ code: "functions/aborted" }), true);
  assert.equal(isRevisionConflict({ code: "failed-precondition" }), false);
  assert.equal(isRevisionConflict({ code: "functions/failed-precondition" }), false);
  assert.equal(isRevisionConflict({ code: "invalid-argument" }), false);
});

test("avenue label validation rejects overlong labels without truncation", () => {
  const board = createDefaultBodManagementBoard();
  const base = createDefaultBodProfileForm(board);
  const sixty = "A".repeat(60);
  const sixtyOne = "B".repeat(61);

  assert.deepEqual(normalizeAvenueLabels(` ${sixty} `), [sixty]);
  assert.equal(validateBodProfileForm({ ...base, avenueText: sixty }, board.options).ok, true);

  const overlongLabels = normalizeAvenueLabels(sixtyOne);
  const validation = validateBodProfileForm({ ...base, avenueText: sixtyOne }, board.options);

  assert.deepEqual(overlongLabels, [sixtyOne]);
  assert.equal(overlongLabels[0].length, 61);
  assert.equal(validation.ok, false);
  assert.deepEqual(validation.errors, ["Each avenue label must be 60 characters or fewer."]);
  assert.throws(
    () => buildUpsertBodProfilePayload(board, { ...base, avenueText: sixtyOne }),
    /Each avenue label must be 60 characters or fewer\./
  );
});

test("avenue label validation deduplicates and enforces the five-label limit", () => {
  const board = createDefaultBodManagementBoard();
  const base = createDefaultBodProfileForm(board);

  assert.deepEqual(normalizeAvenueLabels(" One   Two, one two, THREE "), ["One Two", "THREE"]);
  assert.equal(validateBodProfileForm({ ...base, avenueText: "One, one, TWO, two" }, board.options).ok, true);
  assert.equal(validateBodProfileForm({ ...base, avenueText: "One, Two, Three, Four, Five" }, board.options).ok, true);

  const validation = validateBodProfileForm({ ...base, avenueText: "One, Two, Three, Four, Five, Six" }, board.options);
  assert.equal(validation.ok, false);
  assert.deepEqual(validation.errors, ["Use five avenue labels or fewer."]);
});

test("profile mutation result updates local Club draft revision and preserves profile buckets", () => {
  const board = normalizeBodManagementBoard({
    initialized: true,
    sections: {
      clubBoard: { publicationStatus: "draft", draftRevision: 1, publishedRevision: 0, publishedAt: null },
    },
  });
  const updated = applyBodProfileMutationResult(board, {
    draftRevision: 2,
    profile: {
      id: "p1",
      sectionKey: "clubBoard",
      name: "Member",
      positionKey: "custom",
      positionLabel: "Custom Role",
      summary: "Summary",
      bio: "",
      avenueLabels: [],
      instagramUsername: null,
      linkedBodMemberId: null,
      linkedUserUid: null,
      sortOrder: 10,
      displayPublicly: false,
      status: "active",
    },
  });

  assert.equal(updated.sections.clubBoard.draftRevision, 2);
  assert.deepEqual(updated.profiles.clubBoard.map((profile) => profile.id), ["p1"]);
  assert.deepEqual(updated.profiles.leadershipBeyondClub, []);
});

test("external mutation result updates only external draft revision and profile bucket", () => {
  const board = normalizeBodManagementBoard({
    initialized: true,
    sections: {
      clubBoard: { publicationStatus: "draft", draftRevision: 1, publishedRevision: 0, publishedAt: null },
      leadershipBeyondClub: { publicationStatus: "draft", draftRevision: 4, publishedRevision: 0, publishedAt: null },
    },
    profiles: {
      clubBoard: [
        { id: "club-a", sectionKey: "clubBoard", name: "Club A", positionKey: "president", positionLabel: "President", summary: "Club", bio: "", avenueLabels: [], instagramUsername: null, linkedBodMemberId: "same", linkedUserUid: "same-user", sortOrder: 10, displayPublicly: false, status: "active" },
      ],
    },
  });
  const updated = applyBodProfileMutationResult(board, {
    sectionKey: LEADERSHIP_PROFILE_SECTION_KEY,
    draftRevision: 5,
    profile: {
      id: "ext-a",
      sectionKey: LEADERSHIP_PROFILE_SECTION_KEY,
      name: "External",
      positionKey: "custom",
      positionLabel: "District Secretary",
      leadershipLevel: "district",
      organizationName: "Rotaract District 3131",
      termLabel: "2026-27",
      summary: "External summary",
      bio: "",
      avenueLabels: [],
      instagramUsername: null,
      linkedBodMemberId: "same",
      linkedUserUid: "same-user",
      sortOrder: 10,
      displayPublicly: true,
      status: "active",
    },
  });

  assert.equal(updated.sections.clubBoard.draftRevision, 1);
  assert.equal(updated.sections.leadershipBeyondClub.draftRevision, 5);
  assert.deepEqual(updated.profiles.clubBoard.map((profile) => profile.id), ["club-a"]);
  assert.deepEqual(updated.profiles.leadershipBeyondClub.map((profile) => profile.id), ["ext-a"]);
});

test("photo model validates MIME, size, labels, and Admin-safe metadata", () => {
  const readyPhoto = {
    status: "ready",
    mimeType: "image/png",
    originalName: " portrait.png ",
    sizeBytes: 2048,
    width: null,
    height: null,
    version: 2,
    uploadedAt: "2026-07-17T00:00:00.000Z",
    driveFileId: "private-drive-id",
    driveFolderId: "private-folder-id",
    uploadSessionId: "private-session",
    previousPhoto: { driveFileId: "old" },
  };
  const normalized = normalizeBodProfilePhoto(readyPhoto);

  assert.deepEqual(BOD_PHOTO_ACCEPTED_MIME_TYPES, ["image/jpeg", "image/png", "image/webp"]);
  assert.equal(BOD_PHOTO_FILE_ACCEPT, "image/jpeg,image/png,image/webp");
  assert.equal(formatBodPhotoSize(BOD_PHOTO_MAX_BYTES), "5 MB");
  assert.equal(validateBodPhotoFile({ name: "portrait.jpg", type: "image/jpeg", size: BOD_PHOTO_MAX_BYTES }), "");
  assert.match(validateBodPhotoFile({ name: "portrait.svg", type: "image/svg+xml", size: 100 }), /JPEG, PNG, or WebP/);
  assert.match(validateBodPhotoFile({ name: "portrait.jpg", type: "image/jpeg", size: BOD_PHOTO_MAX_BYTES + 1 }), /5 MB/);
  assert.deepEqual(normalized, {
    status: "ready",
    mimeType: "image/png",
    originalName: "portrait.png",
    sizeBytes: 2048,
    width: null,
    height: null,
    version: 2,
    uploadedAt: "2026-07-17T00:00:00.000Z",
  });
  assert.equal("driveFileId" in normalized, false);
  assert.equal("uploadSessionId" in normalized, false);
  assert.equal("previousPhoto" in normalized, false);
  assert.equal(hasReadyPhoto({ photo: readyPhoto }), true);
  assert.deepEqual(getBodPhotoBadge({ photo: readyPhoto }), { label: "Photo ready", className: "is-public" });
  assert.deepEqual(getBodPhotoBadge({ photo: { ...readyPhoto, status: "removed" } }), { label: "Photo removed", className: "is-draft" });
  assert.deepEqual(getBodPhotoBadge({}), { label: "Photo missing", className: "is-draft" });
});

test("photo payloads use selected section revisions and keep Club/external photos independent", () => {
  const board = normalizeBodManagementBoard({
    initialized: true,
    sections: {
      clubBoard: { publicationStatus: "draft", draftRevision: 3, publishedRevision: 0, publishedAt: null },
      leadershipBeyondClub: { publicationStatus: "draft", draftRevision: 8, publishedRevision: 0, publishedAt: null },
    },
    profiles: {
      clubBoard: [
        { id: "club-a", sectionKey: "clubBoard", name: "Club A", positionKey: "president", positionLabel: "President", summary: "Club", bio: "", avenueLabels: [], instagramUsername: null, linkedBodMemberId: null, linkedUserUid: null, sortOrder: 10, displayPublicly: false, status: "active" },
      ],
      leadershipBeyondClub: [
        { id: "ext-a", sectionKey: LEADERSHIP_PROFILE_SECTION_KEY, name: "External A", positionKey: "custom", positionLabel: "District Secretary", leadershipLevel: "district", organizationName: "District", termLabel: "", summary: "External", bio: "", avenueLabels: [], instagramUsername: null, linkedBodMemberId: null, linkedUserUid: null, sortOrder: 10, displayPublicly: true, status: "active" },
      ],
    },
  });
  const club = board.profiles.clubBoard[0];
  const external = board.profiles.leadershipBeyondClub[0];
  const file = { name: "portrait.webp", type: "image/webp", size: 4096 };

  assert.deepEqual(buildCreateBodPhotoUploadSessionPayload(board, club, file), {
    boardId: BOD_MANAGEMENT_BOARD_ID,
    profileId: "club-a",
    sectionKey: "clubBoard",
    fileName: "portrait.webp",
    mimeType: "image/webp",
    sizeBytes: 4096,
  });
  assert.deepEqual(buildFinalizeBodPhotoUploadPayload(board, external, "session-1"), {
    boardId: BOD_MANAGEMENT_BOARD_ID,
    profileId: "ext-a",
    sessionId: "session-1",
    expectedDraftRevision: 8,
  });
  assert.deepEqual(buildRemoveBodProfilePhotoPayload(board, "club-a"), {
    boardId: BOD_MANAGEMENT_BOARD_ID,
    profileId: "club-a",
    expectedDraftRevision: 3,
  });

  const updated = applyBodProfileMutationResult(board, {
    sectionKey: LEADERSHIP_PROFILE_SECTION_KEY,
    draftRevision: 9,
    profile: { ...external, photo: { status: "ready", mimeType: "image/webp", originalName: "external.webp", sizeBytes: 4096, width: null, height: null, version: 1, uploadedAt: "2026-07-17T00:00:00.000Z", driveFileId: "private" }, hasPhoto: true },
  });
  assert.equal(updated.sections.clubBoard.draftRevision, 3);
  assert.equal(updated.sections.leadershipBeyondClub.draftRevision, 9);
  assert.equal(updated.profiles.clubBoard[0].hasPhoto, false);
  assert.equal(updated.profiles.leadershipBeyondClub[0].hasPhoto, true);
  assert.equal("driveFileId" in updated.profiles.leadershipBeyondClub[0].photo, false);
});

test("photo guidance warnings are non-blocking client hints", () => {
  assert.deepEqual(getBodPhotoDimensionWarnings({ width: 800, height: 1000 }), []);
  assert.deepEqual(getBodPhotoDimensionWarnings({ width: 1200, height: 800 }), ["A 4:5 portrait crop is recommended.", "A photo around 800 x 1000 pixels or larger is recommended."]);
});

test("Phase 4 photo upload stays private and does not add public delivery or base64 transport", () => {
  const uploadStart = serviceSource.indexOf("export function uploadBodProfilePhoto");
  const uploadEnd = serviceSource.indexOf("function readFileAsBase64");
  assert.ok(uploadStart >= 0 && uploadEnd > uploadStart);
  const bodUploadSource = serviceSource.slice(uploadStart, uploadEnd);

  assert.match(bodUploadSource, /new XMLHttpRequest\(\)/);
  assert.match(bodUploadSource, /xhr\.upload\.onprogress/);
  assert.match(bodUploadSource, /FormData/);
  assert.doesNotMatch(bodUploadSource, /FileReader|readAsDataURL|readFileAsBase64|base64/i);
  assert.doesNotMatch(
    bodUploadSource,
    /BOD photo storage is not configured/
  );
  assert.doesNotMatch(
    `${serviceSource}\n${moduleSource}`,
    /downloadPublishedBodPhoto|getPublishedBodPhoto|photoUrl|photoPath|publicDrive/i,
  );
});

test("Phase 4 photo dialog guards duplicate starts and stale async updates", () => {
  assert.match(
    moduleSource,
    /key=\{`\$\{photoTarget\.sectionKey\}:\$\{photoTarget\.id\}`\}/
  );

  assert.match(
    moduleSource,
    /const uploadInFlightRef = useRef\(false\);/
  );

  assert.match(
    moduleSource,
    /const mountedRef = useRef\(false\);/
  );

  assert.match(
    moduleSource,
    /const operationGenerationRef = useRef\(0\);/
  );

  assert.match(
    moduleSource,
    /const imageLoadGenerationRef = useRef\(0\);/
  );

  assert.match(
    moduleSource,
    /state\.working\s*\|\|\s*uploadInFlightRef\.current/
  );

  assert.match(
    moduleSource,
    /uploadInFlightRef\.current = true;/
  );

  assert.match(
    moduleSource,
    /finally \{[\s\S]*uploadInFlightRef\.current = false;[\s\S]*\}/
  );

  assert.match(
    moduleSource,
    /function isCurrentOperation\(generation\) \{[\s\S]*mountedRef\.current[\s\S]*operationGenerationRef\.current === generation/
  );

  assert.match(
    moduleSource,
    /imageLoadGenerationRef\.current !== imageLoadGeneration/
  );

  assert.match(
    moduleSource,
    /function abortUpload\(\) \{[\s\S]*operationGenerationRef\.current \+= 1;[\s\S]*abortRef\.current\?\.abort\(\);/
  );

  assert.match(
    moduleSource,
    /onProgress: \(progress\) => \{[\s\S]*if \(!isCurrentOperation\(generation\)\) return;/
  );

  assert.match(
    moduleSource,
    /await finalizeUploaded\(sessionId, generation\);/
  );
});

test("BOD photo XHR rejects already-aborted signals before sending", () => {
  assert.match(
    serviceSource,
    /if \(signal\?\.aborted\) \{[\s\S]*return Promise\.reject\(new Error\("Photo upload was aborted\."\)\);[\s\S]*\}\s*return new Promise/
  );

  assert.match(
    serviceSource,
    /signal\?\.addEventListener\?\.\("abort", abort, \{ once: true \}\);[\s\S]*if \(signal\?\.aborted\) \{[\s\S]*abort\(\);[\s\S]*return;[\s\S]*\}[\s\S]*xhr\.open\("POST", session\.uploadEndpoint\);[\s\S]*xhr\.send\(form\);/
  );
});

test("profile archive, restore, and reorder payloads are Club BOD draft scoped", () => {
  const board = normalizeBodManagementBoard({
    initialized: true,
    sections: {
      clubBoard: { publicationStatus: "draft", draftRevision: 5, publishedRevision: 0, publishedAt: null },
    },
    profiles: {
      clubBoard: [
        { id: "a", sectionKey: "clubBoard", name: "A", positionKey: "custom", positionLabel: "A", summary: "A", bio: "", avenueLabels: [], instagramUsername: null, linkedBodMemberId: null, linkedUserUid: null, sortOrder: 10, displayPublicly: false, status: "active" },
        { id: "b", sectionKey: "clubBoard", name: "B", positionKey: "custom", positionLabel: "B", summary: "B", bio: "", avenueLabels: [], instagramUsername: null, linkedBodMemberId: null, linkedUserUid: null, sortOrder: 20, displayPublicly: false, status: "active" },
      ],
    },
  });

  assert.deepEqual(moveBodProfileOrder(board, "b", "up"), ["b", "a"]);
  assert.deepEqual(buildReorderBodProfilesPayload(board, ["b", "a"]), {
    boardId: BOD_MANAGEMENT_BOARD_ID,
    sectionKey: "clubBoard",
    orderedProfileIds: ["b", "a"],
    expectedDraftRevision: 5,
  });
  assert.deepEqual(buildArchiveBodProfilePayload(board, "a"), {
    boardId: BOD_MANAGEMENT_BOARD_ID,
    profileId: "a",
    expectedDraftRevision: 5,
  });
  assert.deepEqual(buildRestoreBodProfilePayload(board, "a"), buildArchiveBodProfilePayload(board, "a"));
});

test("external archive, restore, and reorder payloads are section scoped", () => {
  const board = normalizeBodManagementBoard({
    initialized: true,
    sections: {
      clubBoard: { publicationStatus: "draft", draftRevision: 5, publishedRevision: 0, publishedAt: null },
      leadershipBeyondClub: { publicationStatus: "draft", draftRevision: 9, publishedRevision: 0, publishedAt: null },
    },
    profiles: {
      clubBoard: [
        { id: "club-a", sectionKey: "clubBoard", name: "Club A", positionKey: "custom", positionLabel: "A", summary: "A", bio: "", avenueLabels: [], instagramUsername: null, linkedBodMemberId: null, linkedUserUid: null, sortOrder: 10, displayPublicly: false, status: "active" },
      ],
      leadershipBeyondClub: [
        { id: "ext-a", sectionKey: "leadershipBeyondClub", name: "A", positionKey: "custom", positionLabel: "External A", leadershipLevel: "district", organizationName: "Org", termLabel: "", summary: "A", bio: "", avenueLabels: [], instagramUsername: null, linkedBodMemberId: null, linkedUserUid: null, sortOrder: 10, displayPublicly: false, status: "active" },
        { id: "ext-b", sectionKey: "leadershipBeyondClub", name: "B", positionKey: "custom", positionLabel: "External B", leadershipLevel: "zone", organizationName: "Org", termLabel: "", summary: "B", bio: "", avenueLabels: [], instagramUsername: null, linkedBodMemberId: null, linkedUserUid: null, sortOrder: 20, displayPublicly: false, status: "active" },
      ],
    },
  });

  assert.deepEqual(moveProfileOrder(board, LEADERSHIP_PROFILE_SECTION_KEY, "ext-b", "up"), ["ext-b", "ext-a"]);
  assert.deepEqual(buildReorderBodProfilesPayload(board, LEADERSHIP_PROFILE_SECTION_KEY, ["ext-b", "ext-a"]), {
    boardId: BOD_MANAGEMENT_BOARD_ID,
    sectionKey: LEADERSHIP_PROFILE_SECTION_KEY,
    orderedProfileIds: ["ext-b", "ext-a"],
    expectedDraftRevision: 9,
  });
  assert.deepEqual(buildArchiveBodProfilePayload(board, "ext-a"), {
    boardId: BOD_MANAGEMENT_BOARD_ID,
    profileId: "ext-a",
    expectedDraftRevision: 9,
  });
  assert.deepEqual(buildRestoreBodProfilePayload(board, "ext-a"), buildArchiveBodProfilePayload(board, "ext-a"));
});

test("duplicate position and link warnings remain draft-only signals", () => {
  const profiles = [
    { id: "a", sectionKey: "clubBoard", name: "A", positionKey: "president", positionLabel: "President", summary: "", bio: "", avenueLabels: [], instagramUsername: null, linkedBodMemberId: "m1", linkedUserUid: "u1", sortOrder: 10, displayPublicly: false, status: "active" },
    { id: "b", sectionKey: "clubBoard", name: "B", positionKey: "president", positionLabel: "President", summary: "", bio: "", avenueLabels: [], instagramUsername: null, linkedBodMemberId: "m1", linkedUserUid: "u1", sortOrder: 20, displayPublicly: false, status: "active" },
  ].map((profile) => normalizeBodManagementBoard({ profiles: { clubBoard: [profile] } }).profiles.clubBoard[0]);

  assert.equal(getBodProfileWarnings(profiles[0], profiles).length, 3);
});

test("external warnings are scoped to external appointments and do not merge same linked person across sections", () => {
  const board = normalizeBodManagementBoard({
    profiles: {
      clubBoard: [
        { id: "club-a", sectionKey: "clubBoard", name: "Club A", positionKey: "president", positionLabel: "President", summary: "", bio: "", avenueLabels: [], instagramUsername: null, linkedBodMemberId: "same", linkedUserUid: "same-user", sortOrder: 10, displayPublicly: false, status: "active" },
      ],
      leadershipBeyondClub: [
        { id: "ext-a", sectionKey: "leadershipBeyondClub", name: "External A", positionKey: "custom", positionLabel: "District Secretary", leadershipLevel: "district", organizationName: "Rotaract District 3131", termLabel: "2026-27", summary: "", bio: "", avenueLabels: [], instagramUsername: null, linkedBodMemberId: "same", linkedUserUid: "same-user", sortOrder: 10, displayPublicly: false, status: "active" },
        { id: "ext-b", sectionKey: "leadershipBeyondClub", name: "External B", positionKey: "custom", positionLabel: "District Secretary", leadershipLevel: "district", organizationName: "Rotaract District 3131", termLabel: "2026-27", summary: "", bio: "", avenueLabels: [], instagramUsername: null, linkedBodMemberId: "same", linkedUserUid: "same-user", sortOrder: 20, displayPublicly: false, status: "active" },
      ],
    },
  });
  const external = activeProfilesForSection(board, LEADERSHIP_PROFILE_SECTION_KEY);
  const club = activeClubBodProfiles(board);

  assert.equal(getBodProfileWarnings(club[0], club).length, 0);
  assert.equal(getBodProfileWarnings(external[0], external).length, 4);
});

test("revision conflict handling clears stale mutation UI before refetching", () => {
  assert.match(
    moduleSource,
    /function handleConflict\(error\) \{[\s\S]*setEditor\(null\);[\s\S]*setArchiveTarget\(null\);[\s\S]*setConfirmSectionKey\(""\);[\s\S]*load\(true\);/
  );
  assert.match(
    moduleSource,
    /saveSection\(confirmSectionKey\)\.then\(\(saved\) => \{[\s\S]*if \(saved\) setConfirmSectionKey\(""\);/
  );
});

test("Phase 2 profile workspace exposes required UI and accessibility copy", () => {
  assert.match(moduleSource, /Manage draft Club BOD and external leadership profiles, along with their section publication status\./);
  assert.match(bodManagementSource, /Manage working profile drafts\. Changes do not affect the public page until a later Publish Changes workflow is used\./);
  assert.match(moduleSource, /useState\(BOD_PROFILE_SECTION_KEY\)/);
  assert.match(moduleSource, /role="group"/);
  assert.match(moduleSource, /aria-pressed=\{section\.key === config\.key\}/);
  assert.match(moduleSource, /onClick=\{\(\) => onSelectSection\(section\.key\)\}/);
  assert.doesNotMatch(moduleSource, /role="tab"/);
  assert.doesNotMatch(moduleSource, /role="tablist"/);
  assert.doesNotMatch(moduleSource, /aria-selected/);
  assert.doesNotMatch(moduleSource, /aria-controls/);
  assert.match(moduleSource, /Included in next publish/);
  assert.match(moduleSource, /Not included/);
  assert.match(moduleSource, /Photo missing/);
  assert.match(moduleSource, /Add Photo/);
  assert.match(moduleSource, /Replace Photo/);
  assert.match(moduleSource, /Remove Photo/);
  assert.match(moduleSource, /aria-label=\{`Edit \$\{profileName\}`\}/);
  assert.match(moduleSource, /aria-label=\{`Move \$\{profileName\} up`\}/);
  assert.match(moduleSource, /aria-label=\{`Move \$\{profileName\} down`\}/);
  assert.match(moduleSource, /aria-label=\{`Archive \$\{profileName\}`\}/);
  assert.match(moduleSource, /aria-label=\{`Restore \$\{profile\.name \|\| "unnamed profile"\}`\}/);
  assert.match(moduleSource, /Use username, @username, or a standard Instagram profile URL\./);
  assert.match(moduleSource, /This does not change the current public page\./);
  assert.match(moduleSource, /Save this profile before adding a photo\./);
});

test("Phase 3 external leadership workspace uses existing callables and section-specific UI", () => {
  assert.match(bodManagementSource, /Leadership Beyond Our Club/);
  assert.match(bodManagementSource, /Manage independent external leadership appointments\. These drafts do not change the public page until a later Publish Changes workflow is used\./);
  assert.match(bodManagementSource, /Add Leadership Profile/);
  assert.match(moduleSource, /Create Leadership Profile/);
  assert.match(moduleSource, /Edit Leadership Profile/);
  assert.match(moduleSource, /External role title/);
  assert.match(moduleSource, /Leadership level/);
  assert.match(moduleSource, /Organization name/);
  assert.match(moduleSource, /Term label/);
  assert.match(moduleSource, /Choose where this appointment sits outside the club\./);
  assert.match(moduleSource, /Optional\. Confirm that the term belongs to the current appointment before saving\./);
  assert.match(moduleSource, /adminCalls\.upsertBodProfile/);
  assert.match(moduleSource, /adminCalls\.archiveBodProfile/);
  assert.match(moduleSource, /adminCalls\.restoreBodProfile/);
  assert.match(moduleSource, /adminCalls\.reorderBodProfiles/);
  assert.doesNotMatch(serviceSource, /upsertExternalLeadershipProfile|archiveExternalLeadershipProfile|reorderExternalLeadershipProfiles/);
  assert.match(moduleSource, /type="file"/);
  assert.match(moduleSource, /accept=\{BOD_PHOTO_FILE_ACCEPT\}/);
  assert.match(moduleSource, /Review & Publish/);
assert.doesNotMatch(moduleSource, /Delete Profile/);
});
