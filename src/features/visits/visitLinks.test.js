import assert from "node:assert/strict";
import test from "node:test";
import { listVisitLinks, visitLinkDocument, visitLinkTarget } from "./visitLinks.js";
import { normalizeVisitDashboardData, orderVisitDocumentPanelFiles, pickDefaultVisitDocumentFileKey } from "./visitDashboardModel.js";
import { normalizeFolder } from "../admin/visit/visitModel.js";

const sheet = { linkId: "link-1234567890abcdef", title: "Inward register", url: "https://docs.google.com/spreadsheets/d/sheet12345/edit#gid=456", documentCategory: "inward-register" };

test("admin folder normalization keeps live links and server-granted controls, discarding unsafe entries", () => {
  const folder = normalizeFolder({ visitType: "dzrVisit", positionKey: "secretary", canManageLinks: true, documentLinks: [sheet, { ...sheet, linkId: "link-aaaaaaaaaaaaaaaa", url: "javascript:alert(1)" }] });
  assert.equal(folder.canManageLinks, true);
  assert.equal(folder.documentLinks.length, 1);
  assert.equal(folder.documentLinks[0].previewUrl, "https://docs.google.com/spreadsheets/d/sheet12345/preview?gid=456");
  assert.equal(normalizeFolder({ visitType: "dzrVisit", positionKey: "secretary" }).canManageLinks, false);
});

test("the dashboard derives iframe URLs again and retains live link originals while preserving main presentation order", () => {
  const original = visitLinkDocument(listVisitLinks({ documentLinks: [sheet] })[0]);
  const main = { submissionId: "deck-1", title: "Main deck", mimeType: "application/pdf", canOpen: true, canPreview: true, openUrl: "https://drive.google.com/file/d/deck12345/view", previewUrl: "https://drive.google.com/file/d/deck12345/preview" };
  const data = normalizeVisitDashboardData({ visit: { visitType: "dzrVisit" }, documentPanels: [{ positionKey: "secretary", primaryPresentation: main, files: [{ ...original, previewUrl: "https://evil.example/iframe" }, main] }] });
  const panel = data.documentPanels[0];
  const link = panel.files.find(file => file.sourceType === "link");
  assert.equal(link.openUrl, sheet.url);
  assert.equal(link.previewUrl, visitLinkTarget(sheet.url).previewUrl);
  assert.equal(orderVisitDocumentPanelFiles(panel)[0].submissionId, main.submissionId);
  assert.equal(pickDefaultVisitDocumentFileKey({ panels: [panel] }), "secretary:deck-1");
  const generic = visitLinkDocument({ ...sheet, ...visitLinkTarget("https://example.com/register") });
  const withGeneric = normalizeVisitDashboardData({ visit: { visitType: "dzrVisit" }, documentPanels: [{ positionKey: "secretary", files: [generic] }] });
  assert.equal(withGeneric.documentPanels[0].files[0].openUrl, "https://example.com/register");
  assert.equal(withGeneric.documentPanels[0].files[0].canPreview, false);
  const unsafe = normalizeVisitDashboardData({ visit: { visitType: "dzrVisit" }, documentPanels: [{ positionKey: "secretary", files: [{ ...original, openUrl: "javascript:alert(1)" }] }] });
  assert.equal(unsafe.documentPanels[0].files.length, 0);
});

test("Google and generic URLs allow only safe HTTPS targets", () => {
  const vectors = [sheet.url, "https://docs.google.com/document/d/doc12345/edit", "https://docs.google.com/spreadsheets/d/e/2PACX-12345/pubhtml?gid=1", "https://docs.google.com/presentation/d/slides12345/edit", "https://drive.google.com/file/d/file12345/view", "https://example.com", "https://docs.google.com.evil.example/spreadsheets/d/test12345/edit", "javascript:alert(1)", "https://user:password@example.com"];
  for (const url of vectors) {
    const target = visitLinkTarget(url);
    if (url.startsWith("javascript:") || url.includes("user:password")) assert.equal(target, null);
    else assert.ok(target.url.startsWith("https:"));
  }
});
