import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ADMIN_NAV } from "../shared/adminNavigation.js";
import {
  DASHBOARD_PREVIEW_NOTICE,
  DASHBOARD_PREVIEW_ROLES,
  getDashboardPreviewData,
} from "./dashboardPreviewModel.js";

const moduleSource = readFileSync(new URL("./DashboardPreviewModule.jsx", import.meta.url), "utf8");
const modelSource = readFileSync(new URL("./dashboardPreviewModel.js", import.meta.url), "utf8");
const shellSource = readFileSync(new URL("../AdminShell.jsx", import.meta.url), "utf8");
const adminPageSource = readFileSync(new URL("../../../pages/admin/AdminPage.jsx", import.meta.url), "utf8");
const routerSource = readFileSync(new URL("../../../app/router.jsx", import.meta.url), "utf8");
const prospectProgressSource = readFileSync(new URL("../../prospect/ProspectProgress.jsx", import.meta.url), "utf8");
const prospectWhatsAppSource = readFileSync(new URL("../../prospect/ProspectWhatsAppGroup.jsx", import.meta.url), "utf8");

test("Admin navigation includes Dashboard Preview behind the CWD shell filter", () => {
  assert.ok(
    ADMIN_NAV.some(([path, label]) => path === "dashboard-preview" && label === "Dashboard Preview"),
  );
  assert.match(shellSource, /import \{ canAccessDashboardPreview, canManageBodManagement \}/);
  assert.match(shellSource, /const canPreviewDashboards = canAccessDashboardPreview\(access\)/);
  assert.match(shellSource, /path !== "dashboard-preview" \|\| canPreviewDashboards/);
});

test("Dashboard Preview direct segment is guarded and does not subscribe to Admin data", () => {
  assert.match(adminPageSource, /import DashboardPreviewModule/);
  assert.match(adminPageSource, /const canPreviewDashboards = canAccessDashboardPreview\(access\)/);
  assert.match(adminPageSource, /segment === "dashboard-preview" && !canPreviewDashboards/);
  assert.match(adminPageSource, /segment !== "dashboard-preview"/);
  assert.match(adminPageSource, /segment === "dashboard-preview"\) content = <DashboardPreviewModule \/>/);
});

test("Dashboard Preview covers Prospect, GBM, BOD, and Admin mock dashboards", () => {
  assert.deepEqual(
    DASHBOARD_PREVIEW_ROLES.map((role) => role.id),
    ["prospect", "gbm", "bod", "admin"],
  );
  assert.equal(DASHBOARD_PREVIEW_NOTICE, "Static preview for CWD review — no live data is shown.");

  for (const role of DASHBOARD_PREVIEW_ROLES) {
    const preview = getDashboardPreviewData(role.id);
    assert.equal(preview.role, role.id);
    assert.equal(preview.label, role.label);
    assert.ok(preview.dashboard.profile.name);
    assert.ok(Array.isArray(preview.dashboard.announcements));
  }

  assert.match(moduleSource, /<ProspectProgress data=\{dashboard\} \/>/);
  assert.match(moduleSource, /<MemberOverview data=\{dashboard\} \/>/);
  assert.match(moduleSource, /function BodPreviewExtras/);
  assert.match(moduleSource, /function AdminPreviewExtras/);
});

test("Preview reuses dashboard presentation components with static disabled actions", () => {
  assert.match(moduleSource, /import DashboardHeader/);
  assert.match(moduleSource, /import MemberAnnouncements/);
  assert.match(moduleSource, /import MemberOverview/);
  assert.match(moduleSource, /import ProspectProgress/);
  assert.match(moduleSource, /import DashboardMetricRail/);
  assert.match(moduleSource, /onEditProfile=\{noop\}/);
  assert.match(moduleSource, /onSignOut=\{noop\}/);
  assert.match(moduleSource, /uid=""/);
  assert.match(moduleSource, /<button type="button" disabled>Refresh<\/button>/);
  assert.match(moduleSource, /<fieldset disabled>/);
  assert.doesNotMatch(moduleSource, /MemberResolutions/);
});

test("Preview source and mock model do not call Admin, backend, or Firestore helpers", () => {
  const banned = /adminCalls|loadAdminCallable|callable\(|httpsCallable|onSnapshot|setDoc|updateDoc|addDoc|deleteDoc|writeBatch|fetch\(/;
  assert.doesNotMatch(moduleSource, banned);
  assert.doesNotMatch(modelSource, banned);
});

test("Prospect preview includes the manual WhatsApp group addition copy", () => {
  assert.match(prospectProgressSource, /ProspectWhatsAppGroup/);
  assert.match(
    prospectWhatsAppSource,
    /You will soon be added to the official RCPH Prospect WhatsApp group by the club team\./,
  );
});

test("Dashboard Preview does not add a public route", () => {
  assert.doesNotMatch(routerSource, /dashboard-preview/);
  assert.match(routerSource, /path: "\/admin\/\*"/);
});
