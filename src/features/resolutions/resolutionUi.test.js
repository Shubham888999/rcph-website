import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const adminNav = readFileSync(new URL("../admin/shared/adminNavigation.js", import.meta.url), "utf8");
const adminModule = readFileSync(new URL("../admin/resolutions/ResolutionsModule.jsx", import.meta.url), "utf8");
const dashboardCard = readFileSync(new URL("../dashboard/MemberResolutions.jsx", import.meta.url), "utf8");
const dashboardPage = readFileSync(new URL("../../pages/dashboard/DashboardPage.jsx", import.meta.url), "utf8");
const pdf = readFileSync(new URL("./resolutionPdf.js", import.meta.url), "utf8");

test("Resolutions is placed directly after Announcements in Admin navigation", () => {
  assert.match(adminNav, /\["announcements", "Announcements"\], \["resolutions", "Resolutions"\]/);
});

test("Admin resolution tool exposes lifecycle groups and permission-scoped actions", () => {
  for (const label of ["Open voting", "Drafts", "Completed", "Cancelled", "Download completed resolution PDF", "Audit history"]) assert.match(adminModule, new RegExp(label));
  assert.match(adminModule, /item\.status === "draft"/);
  assert.match(adminModule, /item\.status === "open"/);
});

test("dashboard voting is textual, optimistic, and rollback-capable", () => {
  for (const choice of ["approve", "reject", "abstain"]) assert.match(dashboardCard, new RegExp(`"${choice}"`));
  assert.match(dashboardCard, /Your vote:/);
  assert.match(dashboardCard, /You may change your vote while voting remains open/);
  assert.match(dashboardPage, /updateOpenResolutions\(previous\)/);
  assert.match(dashboardPage, /setInterval\(refreshOpenResolutions, 20000\)/);
});

test("placeholder PDF uses A4 wrapping and continuing vote rows", () => {
  assert.match(pdf, /MediaBox \[0 0 595 842\]/);
  assert.match(pdf, /wrapText/);
  assert.match(pdf, /paginate/);
  assert.match(pdf, /buildResolutionVoteRows/);
});
