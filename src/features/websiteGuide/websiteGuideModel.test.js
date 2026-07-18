import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getDefaultGuideRoleId,
  getFirstGuideFeatureId,
  getGuideEntry,
  getGuideFeatureOptions,
  getGuideRoleOptions,
  getInitialGuideSelection,
} from "./websiteGuideModel.js";

const pageSource = readFileSync(new URL("./WebsiteGuidePage.jsx", import.meta.url), "utf8");
const guideCss = readFileSync(new URL("../../styles/components/website-guide.css", import.meta.url), "utf8");
const routerSource = readFileSync(new URL("../../app/router.jsx", import.meta.url), "utf8");
const dashboardHeaderSource = readFileSync(new URL("../dashboard/DashboardHeader.jsx", import.meta.url), "utf8");
const adminShellSource = readFileSync(new URL("../admin/AdminShell.jsx", import.meta.url), "utf8");

test("role selector exposes the approved guide role options in order", () => {
  assert.deepEqual(getGuideRoleOptions().map((role) => role.label), [
    "Prospect",
    "GBM",
    "BOD",
    "President",
    "Secretary",
    "Sergeant-at-Arms",
    "Admin",
    "CWD / Website Director",
  ]);
});

test("feature selector options change based on the selected role", () => {
  assert.deepEqual(getGuideFeatureOptions("prospect").map((feature) => feature.label), [
    "Dashboard",
    "Edit Profile",
    "Prospect Progress",
    "Announcements",
    "Public Event Calendar",
  ]);
  assert.ok(getGuideFeatureOptions("admin").some((feature) => feature.label === "Treasury"));
  assert.equal(getGuideFeatureOptions("prospect").some((feature) => feature.label === "Treasury"), false);
  assert.equal(getFirstGuideFeatureId("secretary"), "mom-upload-view");
});

test("default guide role follows readily available trusted access data", () => {
  assert.equal(getDefaultGuideRoleId({ storedRole: "prospect" }), "prospect");
  assert.equal(getDefaultGuideRoleId({ storedRole: "bod", positionKeys: ["secretary"] }), "secretary");
  assert.equal(getDefaultGuideRoleId({ storedRole: "bod", hasSergeantAtArmsPosition: true }), "sergeant-at-arms");
  assert.equal(getDefaultGuideRoleId({ storedRole: "bod", hasWebsiteDirectorPosition: true }), "cwd");
  assert.deepEqual(getInitialGuideSelection({ storedRole: "unknown" }), { roleId: "gbm", featureId: "dashboard" });
});

test("guide entry rendering model contains the required instructional sections", () => {
  const entry = getGuideEntry("cwd", "website-guide");
  assert.equal(entry.title, "Website Guide");
  assert.match(entry.purpose, /static help center/i);
  assert.ok(entry.whoUses.length);
  assert.ok(entry.canDo.length);
  assert.ok(entry.steps.length);
  assert.ok(entry.notes.some((note) => /does not call Firestore or Firebase Functions/i.test(note)));
  assert.deepEqual(entry.preview.rows, ["Role dropdown", "Feature dropdown", "Guide content"]);
});

test("Admin and President Announcements guide defines the miniature announcement form preview", () => {
  const entry = getGuideEntry("admin", "announcements");
  assert.equal(entry.title, "Announcements");
  assert.equal(entry.preview.type, "announcementForm");
  assert.match(entry.purpose, /publish important updates to dashboards/i);
  assert.deepEqual(entry.canDo, [
    "Publish dashboard announcements.",
    "Select recipient groups.",
    "Choose specific recipients.",
    "Add optional image/PDF attachment.",
    "Add an optional action button/link.",
    "Set an expiry date/time.",
    "Optionally send the announcement by email too.",
  ]);
  assert.deepEqual(entry.steps, [
    "Enter a clear title.",
    "Write the message.",
    "Select priority.",
    "Add attachment or action link if needed.",
    "Choose recipient groups or specific recipients.",
    "Tick email option only when the announcement should also be emailed.",
    "Publish.",
  ]);
  assert.ok(entry.notes.some((note) => /Use email only for important announcements/.test(note)));
  assert.equal(getGuideEntry("president", "announcements").preview.type, "announcementForm");
});

test("Website Guide page renders selectors, guide sections, empty state, and static previews", () => {
  assert.match(pageSource, /id="website-guide-role"/);
  assert.match(pageSource, /id="website-guide-feature"/);
  assert.match(pageSource, /Choose a feature/);
  assert.match(pageSource, /Who uses this/);
  assert.match(pageSource, /What this page is for/);
  assert.match(pageSource, /What you can do/);
  assert.match(pageSource, /How to use/);
  assert.match(pageSource, /Important notes/);
  assert.match(pageSource, /PreviewRenderer/);
  assert.match(pageSource, /AnnouncementCardPreview/);
  assert.match(pageSource, /No live module data is loaded/);
});

test("Announcements guide preview renders as a static non-interactive mock UI", () => {
  const previewSource = pageSource.match(/function AnnouncementFormPreview\(\) \{[\s\S]*?\n\}\n\nfunction GuideEmptyState/)?.[0] || "";
  assert.match(previewSource, /Announcements/);
  assert.match(previewSource, /Publish dashboard announcements with optional email delivery\./);
  assert.match(previewSource, /Title/);
  assert.match(previewSource, /Priority/);
  assert.match(previewSource, /Normal/);
  assert.match(previewSource, /Message/);
  assert.match(previewSource, /Action text/);
  assert.match(previewSource, /HTTPS action URL/);
  assert.match(previewSource, /Expires at/);
  assert.match(previewSource, /Choose image or PDF/);
  assert.match(previewSource, /\["all", "prospect", "gbm", "bod", "admin", "president"\]/);
  assert.match(previewSource, /Specific recipients/);
  assert.match(previewSource, /Also send email to the same eligible recipients/);
  assert.match(previewSource, /Publish announcement/);
  assert.match(previewSource, /non-functional preview/);
  assert.doesNotMatch(previewSource, /<input|<select|<textarea|<button|onClick|onSubmit|onChange/);
  assert.match(guideCss, /\.website-guide-announcement-preview/);
  assert.match(guideCss, /\.website-guide-mock-field/);
});

test("Member announcement guide preview renders as a static dashboard announcement card", () => {
  const entry = getGuideEntry("gbm", "announcements");
  assert.equal(entry.title, "Announcements");
  assert.equal(entry.preview.type, "announcementCard");

  const previewSource = pageSource.match(/function AnnouncementCardPreview\(\) \{[\s\S]*?\n\}\n\nfunction GuideEmptyState/)?.[0] || "";
  assert.match(previewSource, /Dashboard notice/);
  assert.match(previewSource, /Profile update reminder/);
  assert.match(previewSource, /PDF \/ Image attachment/);
  assert.match(previewSource, /Mark as read/);
  assert.match(previewSource, /non-functional preview/);
  assert.doesNotMatch(previewSource, /<input|<select|<textarea|<button|onClick|onSubmit|onChange/);
  assert.match(guideCss, /\.website-guide-announcement-card-preview/);
});

test("Website Guide route and dashboard links are static frontend navigation only", () => {
  assert.match(routerSource, /path: "\/website-guide"/);
  assert.match(dashboardHeaderSource, /to="\/website-guide">Website Guide/);
  assert.match(adminShellSource, /to="\/website-guide">Website Guide/);
  assert.doesNotMatch(pageSource, /firebase|firestore|functions|httpsCallable|getDocs|setDoc|updateDoc|deleteDoc/i);
});
