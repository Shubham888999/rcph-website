import assert from "node:assert/strict";
import test from "node:test";
import { buildVisitDocumentFolderTree, normalizeVisitDocumentFolderMetadata, visitDocumentFolderPath } from "./visitDocumentFolders.js";
import { normalizeVisitDashboardData, orderVisitDocumentPanelFiles } from "./visitDashboardModel.js";
import { visitFolderCategories } from "../admin/visit/visitModel.js";
import { listVisitLinks, visitLinkDocument } from "./visitLinks.js";

const extras = [{ key: "custom-11111111", name: "Resolutions", parentKey: "" }, { key: "custom-22222222", name: "Passed", parentKey: "custom-11111111" }, { key: "custom-33333333", name: "Empty", parentKey: "" }, { key: "custom-44444444", name: "2026", parentKey: "inward" }];
const file = (submissionId, documentCategory = "") => ({ submissionId, documentCategory, title: submissionId, fileName: `${submissionId}.pdf`, mimeType: "application/pdf", openUrl: `https://drive.google.com/file/d/drive-${submissionId}/view`, canPreview: true });
const flatten = nodes => nodes.flatMap(node => [node, ...flatten(node.children)]);

test("folder trees match Club Visits ordering and nesting, with separate direct and nested contents", () => {
  const panel = { positionKey: "secretary", customFolders: extras, files: [file("root"), file("resolution", extras[0].key), file("passed", extras[1].key), file("inward", "inward"), file("year", extras[3].key)] };
  const tree = buildVisitDocumentFolderTree(panel);
  assert.deepEqual(flatten(tree).map(node => node.key), visitFolderCategories({ supportsDocumentCategories: true, customFolders: extras }).map(folder => folder.key));
  const resolutions = tree.find(node => node.key === extras[0].key);
  assert.deepEqual(resolutions.files.map(item => item.submissionId), ["resolution"]);
  assert.equal(resolutions.fileCount, 2);
  assert.deepEqual(resolutions.children[0].files.map(item => item.submissionId), ["passed"]);
  assert.equal(tree.find(node => node.key === extras[2].key).fileCount, 0);
  assert.deepEqual(visitDocumentFolderPath(tree, "passed"), [extras[0].key, extras[1].key]);
  assert.deepEqual(visitDocumentFolderPath(tree, "root"), [""]);
  assert.deepEqual(flatten(tree).flatMap(node => node.files).map(item => item.submissionId).sort(), panel.files.map(item => item.submissionId).sort());
});

test("all visit types preserve categories and saved links through normalization and keep main presentation selection", () => {
  for (const visitType of ["clubAssembly", "dzrVisit", "drrVisit"]) {
    const link = visitLinkDocument(listVisitLinks({ documentLinks: [{ linkId: "link-1234567890abcdef", title: "Inward register", url: "https://docs.google.com/spreadsheets/d/sheet12345/edit", documentCategory: "inward-register" }] })[0]);
    const main = file("deck", extras[1].key);
    const panel = normalizeVisitDashboardData({ visit: { visitType }, documentPanels: [{ positionKey: "secretary", supportsDocumentCategories: true, customFolders: extras, files: [file("root"), main, link], primaryPresentation: main }] }).documentPanels[0];
    const tree = buildVisitDocumentFolderTree(panel, orderVisitDocumentPanelFiles(panel));
    assert.equal(panel.primaryPresentation.submissionId, "deck");
    assert.deepEqual(visitDocumentFolderPath(tree, "deck"), [extras[0].key, extras[1].key]);
    assert.equal(tree.find(node => node.key === "inward-register").files[0].sourceType, "link");
    assert.equal(tree.reduce((total, node) => total + node.fileCount, 0), 3);
  }
});

test("Secretary variants have built-in folders; other positions show their own custom folders without lost legacy files", () => {
  for (const positionKey of ["secretary", "joint-secretary", "co-secretary"]) assert.equal(buildVisitDocumentFolderTree({ positionKey, files: [] }).some(node => node.key === "inward"), true);
  for (const positionKey of ["president", "editor", "co-editor", "csd", "saa"]) {
    const tree = buildVisitDocumentFolderTree({ positionKey, customFolders: extras, files: [file("unknown", "custom-ffffffff"), file("old-inward", "inward")] });
    assert.equal(tree.some(node => node.key === "inward"), false);
    assert.deepEqual(tree.find(node => node.key === "").files.map(item => item.submissionId), ["unknown", "old-inward"]);
    assert.equal(flatten(tree).some(node => node.key === extras[3].key), false);
  }
});

test("renames and moved documents follow current metadata; corrupt nesting cannot create loops or duplicate nodes", () => {
  const panel = { positionKey: "editor", customFolders: [...extras, extras[0], { key: "custom-55555555", name: "Orphan", parentKey: "custom-ffffffff" }, { key: "custom-66666666", name: "Cycle", parentKey: "custom-66666666" }], files: [file("moving", extras[1].key)] };
  assert.equal(normalizeVisitDocumentFolderMetadata(panel).customFolders.length, 3);
  let tree = buildVisitDocumentFolderTree(panel);
  assert.deepEqual(visitDocumentFolderPath(tree, "moving"), [extras[0].key, extras[1].key]);
  const updated = { ...panel, customFolders: panel.customFolders.map(folder => folder.key === extras[0].key ? { ...folder, name: "Approved resolutions" } : folder), files: [file("moving", "")] };
  tree = buildVisitDocumentFolderTree(updated);
  assert.equal(tree[0].label, "Approved resolutions");
  assert.deepEqual(visitDocumentFolderPath(tree, "moving"), [""]);
  assert.equal(flatten(tree).flatMap(node => node.files).length, 1);
});
