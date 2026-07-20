import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  VISIT_OPTIONS,
  buildFolderChecklistRows,
  buildVisitConfigPayload,
  createDefaultVisitConfig,
  createVisitDraft,
  normalizeFolderOption,
  normalizeFolderOptions,
  normalizeOfficialDisplayNames,
  normalizeSignupAvailability,
  normalizeVisitConfigs,
  toggleVisiblePositionKey,
  updateVisitDraftBoolean,
  updateVisitDraftOfficialNames,
} from "./clubVisitManagementModel.js";

const moduleSource = readFileSync(new URL("./ClubVisitManagementModule.jsx", import.meta.url), "utf8");
const serviceSource = readFileSync(new URL("./clubVisitManagementService.js", import.meta.url), "utf8");
const adminServiceSource = readFileSync(new URL("../shared/adminService.js", import.meta.url), "utf8");
const navigationSource = readFileSync(new URL("../shared/adminNavigation.js", import.meta.url), "utf8");
const adminPageSource = readFileSync(new URL("../../../pages/admin/AdminPage.jsx", import.meta.url), "utf8");
const visitUploadSource = readFileSync(new URL("../visit/VisitSubmissionsModule.jsx", import.meta.url), "utf8");
const oldDzrPath = new URL("../modules/DzrVisitModule.jsx", import.meta.url);

test("Club Visit Management exposes the three configured visit types", () => {
  assert.deepEqual(VISIT_OPTIONS, [
    { visitType: "clubAssembly", visitName: "Club Assembly" },
    { visitType: "dzrVisit", visitName: "DZR Visit" },
    { visitType: "drrVisit", visitName: "DRR Visit" },
  ]);
  assert.deepEqual(
    normalizeVisitConfigs([]).map((config) => [config.visitType, config.enabled, config.signupOpen, config.dashboardVisible]),
    [
      ["clubAssembly", false, false, false],
      ["dzrVisit", false, false, false],
      ["drrVisit", false, false, false],
    ],
  );
});

test("visit drafts normalize booleans and official display names", () => {
  const draft = createVisitDraft({
    visitType: "drrVisit",
    enabled: true,
    signupOpen: false,
    dashboardVisible: true,
    allowDistrictOfficials: true,
    officialDisplayNames: [" PHF. DRR. Dwijesh ", "", "phf. drr. dwijesh", "Rtr. Shreya"],
    visiblePositionKeys: ["president"],
  });
  assert.equal(draft.officialDisplayNamesText, "PHF. DRR. Dwijesh\nRtr. Shreya");
  assert.equal(updateVisitDraftBoolean(draft, "signupOpen", true).signupOpen, true);
  assert.equal(updateVisitDraftBoolean(draft, "unknown", true), draft);

  const textDraft = updateVisitDraftOfficialNames(draft, " One \n\nTwo\none ");
  assert.deepEqual(buildVisitConfigPayload(textDraft).officialDisplayNames, ["One", "Two"]);
  assert.deepEqual(normalizeOfficialDisplayNames(Array.from({ length: 14 }, (_, index) => `Official ${index + 1}`)).length, 12);
});

test("save payload carries only mutable dashboard config fields", () => {
  const draft = {
    ...createDefaultVisitConfig("clubAssembly"),
    enabled: true,
    signupOpen: true,
    dashboardVisible: true,
    allowDistrictOfficials: false,
    officialDisplayNamesText: "District One\nDistrict Two",
    visiblePositionKeys: ["secretary", "treasurer"],
    updatedBy: "not-sent",
    updatedAt: "not-sent",
  };
  assert.deepEqual(buildVisitConfigPayload(draft), {
    visitType: "clubAssembly",
    enabled: true,
    signupOpen: true,
    dashboardVisible: true,
    allowDistrictOfficials: false,
    officialDisplayNames: ["District One", "District Two"],
    visiblePositionKeys: ["secretary", "treasurer"],
  });
});

test("signup availability uses only public visit labels", () => {
  assert.deepEqual(normalizeSignupAvailability({
    available: true,
    visits: [
      { visitType: "dzrVisit", visitName: " DZR Visit ", hidden: "private" },
      { visitType: "unknown", visitName: "Nope" },
    ],
  }), {
    available: true,
    visits: [{ visitType: "dzrVisit", visitName: "DZR Visit" }],
  });
  assert.deepEqual(normalizeSignupAvailability({ available: true, visits: [] }), { available: false, visits: [] });
});

test("folder options are sanitized and omit private Drive or file fields", () => {
  const folder = normalizeFolderOption({
    folderId: "private-folder-id",
    driveFolderId: "private-drive-folder-id",
    folderUrl: "https://drive.google.com/private",
    fileUrl: "https://drive.google.com/file",
    visitType: "drrVisit",
    positionKey: "president",
    positionTitle: " President ",
    avenueCode: " Admin ",
    enabled: false,
    submissionOpen: true,
    locked: true,
    activeFileCount: 3,
  }, "drrVisit");
  assert.deepEqual(folder, {
    visitType: "drrVisit",
    positionKey: "president",
    positionTitle: "President",
    avenueCode: "Admin",
    enabled: false,
    submissionOpen: true,
    locked: true,
    activeFileCount: 3,
  });
  for (const privateField of ["folderId", "driveFolderId", "folderUrl", "fileUrl"]) {
    assert.equal(privateField in folder, false);
  }

  assert.deepEqual(
    normalizeFolderOptions([
      { visitType: "clubAssembly", positionKey: "secretary", positionTitle: "Secretary" },
      { visitType: "drrVisit", positionKey: "treasurer", positionTitle: "Treasurer" },
    ], "clubAssembly").map((item) => item.positionKey),
    ["secretary"],
  );
});

test("folder checklist preserves unavailable saved keys and allows removal", () => {
  const draft = {
    ...createDefaultVisitConfig("clubAssembly"),
    visiblePositionKeys: ["secretary", "legacy-key"],
  };
  const rows = buildFolderChecklistRows(draft, [
    { visitType: "clubAssembly", positionKey: "secretary", positionTitle: "Secretary", avenueCode: "Admin" },
    { visitType: "clubAssembly", positionKey: "treasurer", positionTitle: "Treasurer", avenueCode: "Finance" },
  ]);
  assert.deepEqual(rows.map((row) => [row.positionKey, row.checked, row.unavailable]), [
    ["secretary", true, false],
    ["treasurer", false, false],
    ["legacy-key", true, true],
  ]);

  const removed = toggleVisiblePositionKey(draft, "legacy-key", false);
  const added = toggleVisiblePositionKey(removed, "treasurer", true);
  assert.deepEqual(buildVisitConfigPayload(added).visiblePositionKeys, ["secretary", "treasurer"]);
});

test("Admin navigation and route replace the old DZR section", () => {
  assert.match(navigationSource, /\["visit-management", "Club Visit Management"\]/);
  assert.doesNotMatch(navigationSource, /\["dzr-visit", "DZR Visit"\]/);
  assert.match(adminPageSource, /ClubVisitManagementModule/);
  assert.match(adminPageSource, /segment === "visit-management"/);
  assert.doesNotMatch(adminPageSource, /DzrVisitModule/);
  assert.doesNotMatch(adminPageSource, /segment === "dzr-visit"/);
  assert.equal(existsSync(oldDzrPath), false);
});

test("service uses the Phase 1 visit dashboard callables", () => {
  for (const callableName of [
    "getVisitDashboardConfigs",
    "getVisitSignupAvailability",
    "updateVisitDashboardConfig",
    "getVisitDashboardFolderOptions",
  ]) {
    assert.match(adminServiceSource, new RegExp(`callable\\("${callableName}"`));
  }
  assert.match(serviceSource, /loadVisitDashboardConfigs/);
  assert.match(serviceSource, /loadVisitSignupAvailability/);
  assert.match(serviceSource, /loadVisitDashboardFolderOptions/);
  assert.match(serviceSource, /saveVisitDashboardConfig/);
});

test("module renders required controls, safety copy, and default-collapsed folder checklist", () => {
  for (const copy of [
    "Club Visit Management",
    "Enable visit",
    "Open District Official signup",
    "Show dashboard/access",
    "Allow District Officials to access this dashboard",
    "District Official signup will appear on the Create Account page while this setting is on.",
    "Approved District Officials, Admins, BODs, and President may see this visit in Available Areas based on access rules.",
    "Visible BOD folders",
    "Upload folders remain managed in Club Visits. This page only controls what appears on read-only visit dashboards.",
  ]) {
    assert.match(moduleSource, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(moduleSource, /<details className="visit-management__folders">/);
  assert.doesNotMatch(moduleSource, /<details[^>]*open/);
  assert.match(moduleSource, /checked=\{row\.checked\}/);
  assert.match(moduleSource, /value=\{row\.positionKey\}/);
  assert.match(moduleSource, /Unavailable - uncheck to remove/);
});

test("management UI stays out of full dashboard data and upload workflows", () => {
  assert.doesNotMatch(moduleSource, /data\.(members|attendance|treasury|fines|events|bodMembers|bodAttendance)/);
  assert.doesNotMatch(
    `${moduleSource}\n${serviceSource}`,
    /getVisitSubmissionDashboard|getVisitSubmissionFolder|createVisitSubmissionUploadSession|finalizeVisitSubmissionUpload|cancelVisitSubmissionUploadSession|withdrawVisitSubmission|removeVisitSubmission|replaceVisitSubmission|uploadVisitFile|drive\.google|fileUrl|folderUrl|driveFolderId|folderId/,
  );

  assert.match(visitUploadSource, /uploadVisitFile/);
  assert.match(adminServiceSource, /createVisitSubmissionUploadSession/);
  assert.match(adminServiceSource, /finalizeVisitSubmissionUpload/);
  assert.match(adminServiceSource, /removeVisitSubmission/);
});
