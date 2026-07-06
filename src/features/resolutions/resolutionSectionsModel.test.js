import assert from "node:assert/strict";
import test from "node:test";
import {
  addResolutionSection,
  assertNoNestedArrays,
  createDefaultResolutionSections,
  deleteResolutionSection,
  duplicateResolutionSection,
  moveResolutionSection,
  normalizeDocumentSourceMode,
  normalizePdfLayoutMode,
  normalizeResolutionSection,
  normalizeResolutionSections,
  updateResolutionSection,
  validateResolutionPdfLayout,
} from "./resolutionSectionsModel.js";

test("old resolutions default to standard and invalid modes are rejected", () => {
  assert.equal(normalizePdfLayoutMode(undefined), "standard");
  assert.equal(validateResolutionPdfLayout({}).payload.pdfLayoutMode, "standard");
  assert.equal(validateResolutionPdfLayout({ pdfLayoutMode: "anything", pdfSections: [] }).ok, false);
  assert.equal(normalizeDocumentSourceMode(undefined, "custom"), "custom");
  assert.equal(validateResolutionPdfLayout({ documentSourceMode: "uploadedPdf" }).payload.documentSourceMode, "uploadedPdf");
});

test("uploaded Votes Table configuration is normalized and Firestore safe", () => {
  const payload = validateResolutionPdfLayout({ documentSourceMode: "uploadedPdf", uploadedVotesTableConfig: { columns: { name: false, signature: true }, voterScope: "all", showTitle: false, showResultSummary: false } }).payload;
  assert.equal(payload.uploadedVotesTableConfig.columns.signature, true);
  assert.equal(payload.uploadedVotesTableConfig.voterScope, "all");
  assert.equal(assertNoNestedArrays(payload.uploadedVotesTableConfig, "uploadedVotesTableConfig"), true);
});

test("builder add, edit, duplicate, move, and delete preserve unique stable IDs", () => {
  let sections = addResolutionSection([], "heading", "alpha");
  sections = addResolutionSection(sections, "paragraph", "beta");
  sections = updateResolutionSection(sections, "alpha", { text: "Updated" });
  sections = duplicateResolutionSection(sections, "alpha", "alpha_copy");
  assert.deepEqual(sections.map((section) => section.id), ["alpha", "alpha_copy", "beta"]);
  assert.equal(sections[0].text, "Updated");
  sections = moveResolutionSection(sections, "beta", "up");
  assert.deepEqual(sections.map((section) => section.id), ["alpha", "beta", "alpha_copy"]);
  sections = deleteResolutionSection(sections, "beta");
  assert.deepEqual(sections.map((section) => section.id), ["alpha", "alpha_copy"]);
  assert.equal(new Set(sections.map((section) => section.id)).size, sections.length);
});

test("normalization supports all text styles, list styles, and normalized table widths", () => {
  const heading = normalizeResolutionSection({ id: "h", type: "heading", text: "Heading", style: { fontFamily: "Times Roman", fontSize: 20, bold: true, italic: true, underline: true, alignment: "right" } });
  assert.deepEqual({ family: heading.style.fontFamily, size: heading.style.fontSize, alignment: heading.style.alignment, italic: heading.style.italic, underline: heading.style.underline }, { family: "Times Roman", size: 20, alignment: "right", italic: true, underline: true });
  const paragraph = normalizeResolutionSection({ id: "p", type: "paragraph", text: "One\nTwo", listStyle: "numbered", style: { fontFamily: "Courier", fontSize: 8, alignment: "center", lineSpacing: 1.5, spaceBefore: 4, spaceAfter: 7 } });
  assert.equal(paragraph.listStyle, "numbered");
  assert.equal(paragraph.style.lineSpacing, 1.5);
  const table = normalizeResolutionSection({ id: "t", type: "table", columns: [{ width: 2 }, { width: 1 }], rows: [["a", "b"]], options: {}, style: {} });
  assert.ok(Math.abs(table.columns.reduce((sum, column) => sum + column.widthPercent, 0) - 100) < 0.01);
  assert.deepEqual(table.rows, [{ id: "row_1", cells: { column_1: "a", column_2: "b" } }]);
});

test("legacy array rows normalize into Firestore-safe keyed row objects", () => {
  const table = normalizeResolutionSection({
    id: "legacy",
    type: "table",
    columns: [{ id: "expense", label: "Expense", width: 60 }, { id: "amount", label: "Amount", widthPercent: 40, alignment: "right" }],
    rows: [["Domain renewal", "₹3,000"], ["Technical support", "₹2,000"]],
    options: { hasHeaderRow: false },
    style: {},
  });
  assert.deepEqual(table.columns.map(({ id, label, widthPercent, alignment }) => ({ id, label, widthPercent, alignment })), [
    { id: "expense", label: "Expense", widthPercent: 60, alignment: "left" },
    { id: "amount", label: "Amount", widthPercent: 40, alignment: "right" },
  ]);
  assert.deepEqual(table.rows, [
    { id: "row_1", cells: { expense: "Domain renewal", amount: "₹3,000" } },
    { id: "row_2", cells: { expense: "Technical support", amount: "₹2,000" } },
  ]);
  assert.equal(assertNoNestedArrays([table], "pdfSections"), true);
  assert.doesNotThrow(() => JSON.stringify(table));
});

test("recursive nested-array validation reports the exact unsafe Firestore path", () => {
  const unsafe = [{ id: "heading" }, { id: "paragraph" }, { type: "table", rows: [["value 1", "value 2"]] }];
  assert.throws(() => assertNoNestedArrays(unsafe, "pdfSections"), /pdfSections\[2\]\.rows\[0\]/);
});

test("validation enforces section, table, typography, and Votes Table limits", () => {
  const invalid = validateResolutionPdfLayout({ pdfLayoutMode: "custom", pdfSections: [{ id: "x", type: "heading", text: "Bad", style: { fontFamily: "Comic Sans", fontSize: 40, alignment: "justify" } }, { id: "x", type: "votesTable", columns: {}, options: {}, style: {} }] });
  assert.equal(invalid.ok, false);
  assert.match(invalid.errors.join(" "), /unique ID|invalid font|font size|alignment|Votes Table column/i);
  const tooMany = Array.from({ length: 101 }, (_, index) => ({ id: `s${index}`, type: "spacer", mode: "small" }));
  assert.equal(validateResolutionPdfLayout({ pdfLayoutMode: "custom", pdfSections: tooMany }).ok, false);
  const invalidTable = { id: "table", type: "table", columns: [], rows: [], options: {}, style: {} };
  assert.equal(validateResolutionPdfLayout({ pdfLayoutMode: "custom", pdfSections: [invalidTable] }).ok, false);
});

test("duplicate IDs normalize uniquely and starter template is optional and valid", () => {
  assert.deepEqual(normalizeResolutionSections([{ id: "same", type: "spacer" }, { id: "same", type: "spacer" }]).map((section) => section.id), ["same", "same_2"]);
  const template = createDefaultResolutionSections();
  assert.deepEqual(template.map((section) => section.type), ["heading", "table", "paragraph", "heading", "paragraph"]);
  assert.equal(validateResolutionPdfLayout({ pdfLayoutMode: "custom", pdfSections: template }).ok, true);
  assert.equal(assertNoNestedArrays(template, "pdfSections"), true);
});
