import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const adminNav = readFileSync(new URL("../admin/shared/adminNavigation.js", import.meta.url), "utf8");
const adminModule = readFileSync(new URL("../admin/resolutions/ResolutionsModule.jsx", import.meta.url), "utf8");
const dashboardCard = readFileSync(new URL("../dashboard/MemberResolutions.jsx", import.meta.url), "utf8");
const dashboardPage = readFileSync(new URL("../../pages/dashboard/DashboardPage.jsx", import.meta.url), "utf8");
const pdf = readFileSync(new URL("./resolutionPdf.js", import.meta.url), "utf8");
const bodPdf = readFileSync(new URL("../bod-tools/bodAvenueReportPdf.js", import.meta.url), "utf8");
const pdfBuilder = readFileSync(new URL("../admin/resolutions/ResolutionPdfBuilder.jsx", import.meta.url), "utf8");
const uploadPanel = readFileSync(new URL("../admin/resolutions/ResolutionPdfUploadPanel.jsx", import.meta.url), "utf8");

test("Resolutions is placed directly after Announcements in Admin navigation", () => {
  assert.match(adminNav, /\["announcements", "Announcements"\], \["resolutions", "Resolutions"\]/);
});

test("uploaded-PDF mode exposes private upload, preview, retry, and final download workflow", () => {
  for (const label of ["Upload Ready-Made PDF", "Standard Resolution Format", "Custom Section Layout"]) assert.match(pdfBuilder, new RegExp(label));
  for (const label of ["Choose PDF", "Open / Preview", "Replace", "Remove", "Appended Votes Table", "All eligible voters"]) assert.match(uploadPanel, new RegExp(label));
  assert.match(adminModule, /retryResolutionPdfMerge/);
  assert.match(adminModule, /downloadFinalizedResolutionPdf/);
});

test("Admin resolution tool exposes lifecycle groups and permission-scoped actions", () => {
  for (const label of ["Open voting", "Drafts", "Completed", "Cancelled", "Download completed resolution PDF", "Audit history"]) assert.match(adminModule, new RegExp(label));
  assert.match(adminModule, /item\.status === "draft"/);
  assert.match(adminModule, /item\.status === "open"/);
  for (const label of ["Edit PDF layout", "Custom Section Layout", "Download Preview PDF"]) assert.match(adminModule + readFileSync(new URL("../admin/resolutions/ResolutionPdfBuilder.jsx", import.meta.url), "utf8"), new RegExp(label));
  assert.match(adminModule, /updateResolutionPdfLayout/);
});

test("dashboard voting is textual, optimistic, and rollback-capable", () => {
  for (const choice of ["approve", "reject", "abstain"]) assert.match(dashboardCard, new RegExp(`"${choice}"`));
  assert.match(dashboardCard, /Your vote:/);
  assert.match(dashboardCard, /You may change your vote while voting remains open/);
  assert.match(dashboardPage, /updateOpenResolutions\(previous\)/);
  assert.match(dashboardPage, /setInterval\(refreshOpenResolutions, 20000\)/);
});

test("Resolution PDF uses A4 safe-area pagination and a shared letterhead XObject", () => {
  assert.match(pdf, /RESOLUTION_PDF_PAGE = Object\.freeze\(\{ width: 595, height: 842 \}\)/);
  assert.match(pdf, /RESOLUTION_CONTENT_BOUNDS = Object\.freeze\(\{ left: 54, right: 541, bottom: 260, top: 665 \}\)/);
  assert.match(pdf, /wrapText/);
  assert.match(pdf, /paginateBlocks/);
  assert.match(pdf, /buildResolutionVoteRows/);
  assert.match(pdf, /\/XObject << \/BG/);
});

test("Resolution letterhead integration remains isolated from the BOD Avenue renderer", () => {
  assert.doesNotMatch(bodPdf, /resolutionLetterhead|resolution_letterhead|RESOLUTION_CONTENT_BOUNDS/);
  assert.match(bodPdf, /BOD_AVENUE_REPORT_LETTERHEAD_URL/);
  assert.match(bodPdf, /parseBodAvenueReportLetterheadPng/);
  assert.match(bodPdf, /\/XObject << \/BG/);
});
