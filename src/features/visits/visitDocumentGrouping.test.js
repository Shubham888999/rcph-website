import assert from "node:assert/strict";
import test from "node:test";
import {
  countVisitDocumentFilters,
  filterVisitDocumentBlocks,
  formatVisitDocumentBlockFileCount,
  formatVisitDocumentRoleLabel,
  getVisitDocumentBlockAriaLabel,
  getVisitDocumentFileType,
  getVisitDocumentPanelFilterGroup,
  getVisitDocumentTileAriaLabel,
  groupDocumentPanelsByPerson,
  groupVisitDocumentBlocksBySection,
  normalizeVisitDashboardData,
  orderVisitDocumentPanelFiles,
  pickDefaultVisitDocumentFileKey,
  resolveVisitDocumentRoleCode,
} from "./visitDashboardModel.js";
import { MAX_VISIT_HOLDERS_PER_FOLDER, joinVisitHolderNames, normalizeVisitHolders } from "./visitHolderModel.js";
import { compareVisitFolderOrder, groupVisitFolders } from "../admin/visit/visitPresentationModel.js";

function holder(name) {
  return { personKey: `p-${name.toLowerCase().replace(/[^a-z]+/g, "-")}`, displayName: `Rtr. ${name}` };
}

function panel(positionKey, positionTitle, holders = [], fileCount = 1) {
  return { positionKey, positionTitle, folderLabel: positionTitle, fileCount, holders, files: [] };
}

const YASHALI = holder("Yashali Shirodkar");
const TANISHKA = holder("Tanishka Patekar");
const ANISH = holder("Anish Abhijit Joglekar");

// Dashboard order today is the backend catalog order (sortOrder).
const realWorldPanels = [
  panel("president", "President", [holder("President Person")]),
  panel("immediate-past-president", "Immediate Past President", [holder("Past President")]),
  panel("vice-president", "Vice President", [holder("Vice Person")]),
  panel("secretary", "Secretary", [holder("Secretary Person")]),
  panel("treasurer", "Treasurer", [holder("Treasurer Person")], 0),
  panel("club-advisor", "Club Advisor", [holder("Advisor Person")]),
  panel("csd", "Club Service Director", [holder("Harshal Nikam")]),
  panel("cmd", "Community Service Director", [TANISHKA], 2),
  panel("isd", "International Service Director", [holder("Aarya Godbole")]),
  panel("editor", "Editor", [], 1),
  panel("pro", "Public Relations Officer", [YASHALI]),
  panel("dei", "DEI Director", [TANISHKA], 0),
  panel("cwd", "Website Director", [], 0),
  panel("saa", "Sergeant-at-Arms", [holder("Saa Person")]),
  panel("pid", "Public Image Director", [ANISH], 3),
  panel("mdo", "Membership Development Officer", [ANISH], 1),
  panel("co-csd", "Co-Club Service Director", [holder("Shivani Kulkarni")]),
  panel("co-cmd", "Co-Community Service Director", [holder("Soumitra")]),
  panel("co-isd", "Co-International Service Director", [YASHALI], 2),
];

test("real-world roles group into one block per person, in the admin folders page order", () => {
  const blocks = groupDocumentPanelsByPerson(realWorldPanels);
  const summary = blocks.map((block) => [
    block.sectionLabel,
    block.title,
    block.panels.map((item) => item.positionKey).join("+"),
    block.roleCount,
    block.fileCount,
  ]);
  assert.deepEqual(summary, [
    ["Core Board", "Rtr. President Person", "president", 1, 1],
    ["Core Board", "Rtr. Past President", "immediate-past-president", 1, 1],
    ["Core Board", "Rtr. Vice Person", "vice-president", 1, 1],
    ["Core Board", "Rtr. Secretary Person", "secretary", 1, 1],
    ["Core Board", "Rtr. Treasurer Person", "treasurer", 1, 0],
    ["Core Board", "Rtr. Advisor Person", "club-advisor", 1, 1],
    ["Core Board", "Rtr. Saa Person", "saa", 1, 1],
    ["Avenue Directors", "Rtr. Harshal Nikam", "csd", 1, 1],
    ["Avenue Directors", "Rtr. Shivani Kulkarni", "co-csd", 1, 1],
    ["Avenue Directors", "Rtr. Tanishka Patekar", "cmd+dei", 2, 2],
    ["Avenue Directors", "Rtr. Soumitra", "co-cmd", 1, 1],
    ["Avenue Directors", "Rtr. Aarya Godbole", "isd", 1, 1],
    ["Avenue Directors", "Rtr. Yashali Shirodkar", "co-isd+pro", 2, 3],
    ["Directors and Officers", "Editor", "editor", 1, 1],
    ["Directors and Officers", "Rtr. Anish Abhijit Joglekar", "pid+mdo", 2, 4],
  ]);
  const positionKeys = blocks.flatMap((block) => block.panels.map((item) => item.positionKey));
  assert.equal(new Set(positionKeys).size, positionKeys.length, "no panel appears twice");
  assert.equal(positionKeys.includes("cwd"), false, "vacant empty folder is omitted");

  const sections = groupVisitDocumentBlocksBySection(blocks);
  assert.deepEqual(sections.map((section) => [section.label, section.blocks.length]), [
    ["Core Board", 7],
    ["Avenue Directors", 6],
    ["Directors and Officers", 2],
  ]);
});

test("block shape carries holder names, vacancy, and primary-first panel order", () => {
  const blocks = groupDocumentPanelsByPerson(realWorldPanels);
  const yashali = blocks.find((block) => block.title === "Rtr. Yashali Shirodkar");
  assert.deepEqual(Object.keys(yashali).sort(), [
    "blockKey", "fileCount", "holderNames", "panels", "roleCount", "sectionKey", "sectionLabel", "title", "vacant",
  ].sort());
  assert.equal(yashali.blockKey, `person:${YASHALI.personKey}`);
  assert.deepEqual(yashali.holderNames, ["Rtr. Yashali Shirodkar"]);
  assert.equal(yashali.vacant, false);
  assert.deepEqual(yashali.panels.map((item) => item.positionKey), ["co-isd", "pro"], "primary role follows the admin order");
  assert.equal(yashali.sectionKey, "avenues");
  assert.equal(yashali.sectionLabel, "Avenue Directors");

  const vacant = blocks.find((block) => block.vacant);
  assert.deepEqual(
    { blockKey: vacant.blockKey, title: vacant.title, holderNames: vacant.holderNames, fileCount: vacant.fileCount },
    { blockKey: "vacant:editor", title: "Editor", holderNames: [], fileCount: 1 },
  );
});

test("a shared position forms its own block; the holders' other roles stay in their own blocks", () => {
  const a = holder("Alpha One");
  const b = holder("Beta Two");
  const blocks = groupDocumentPanelsByPerson([
    panel("secretary", "Secretary", [a, b], 2),
    panel("csd", "Club Service Director", [a], 1),
    panel("pro", "Public Relations Officer", [b], 0),
  ]);
  assert.deepEqual(blocks.map((block) => [block.blockKey, block.title, block.holderNames, block.panels.map((item) => item.positionKey)]), [
    ["shared:secretary", "Rtr. Alpha One & Rtr. Beta Two", ["Rtr. Alpha One", "Rtr. Beta Two"], ["secretary"]],
    [`person:${a.personKey}`, "Rtr. Alpha One", ["Rtr. Alpha One"], ["csd"]],
    [`person:${b.personKey}`, "Rtr. Beta Two", ["Rtr. Beta Two"], ["pro"]],
  ]);
});

test("vacant folders show only when they hold files; empty input yields no blocks", () => {
  assert.deepEqual(groupDocumentPanelsByPerson([panel("cwd", "Website Director", [], 0)]), []);
  assert.deepEqual(groupDocumentPanelsByPerson([]), []);
  assert.deepEqual(groupDocumentPanelsByPerson(null), []);
  const [block] = groupDocumentPanelsByPerson([panel("cwd", "Website Director", [], 2)]);
  assert.equal(block.vacant, true);
  assert.equal(block.title, "Website Director");
});

test("ordering ignores input order: fixed sections, co-positions follow their main avenue director", () => {
  const solo = holder("Solo Person");
  const blocks = groupDocumentPanelsByPerson([
    panel("co-pro", "Co-Public Relations Officer", [holder("Co Person")]),
    panel("mdo", "Membership Development Officer", [holder("Late Person")]),
    panel("pid", "Public Image Director", [solo]),
    panel("co-isd", "Co-International Service Director", [holder("Co Isd")]),
    panel("csd", "Club Service Director", [solo]),
    panel("isd", "International Service Director", [holder("Main Isd")]),
    panel("secretary", "Secretary", [holder("Sec Person")]),
  ]);
  assert.deepEqual(blocks.map((block) => [block.title, block.panels.map((item) => item.positionKey).join("+"), block.sectionLabel]), [
    ["Rtr. Sec Person", "secretary", "Core Board"],
    ["Rtr. Solo Person", "csd+pid", "Avenue Directors"],
    ["Rtr. Main Isd", "isd", "Avenue Directors"],
    ["Rtr. Co Isd", "co-isd", "Avenue Directors"],
    ["Rtr. Late Person", "mdo", "Directors and Officers"],
    ["Rtr. Co Person", "co-pro", "Co-Positions"],
  ]);
  assert.deepEqual(groupVisitDocumentBlocksBySection(blocks).map((section) => section.label), [
    "Core Board", "Avenue Directors", "Directors and Officers", "Co-Positions",
  ]);
});

test("sections use the fixed group order even when blocks arrive out of order", () => {
  const sections = groupVisitDocumentBlocksBySection([
    { blockKey: "c", sectionKey: "co", sectionLabel: "Co-Positions" },
    { blockKey: "o", sectionKey: "officers", sectionLabel: "Directors and Officers" },
    { blockKey: "a", sectionKey: "avenues", sectionLabel: "Avenue Directors" },
    { blockKey: "k", sectionKey: "core", sectionLabel: "Core Board" },
  ]);
  assert.deepEqual(sections.map((section) => section.key), ["core", "avenues", "officers", "co"]);
});

test("dashboard and admin folders page share one folder order", () => {
  const folders = realWorldPanels.map((item) => ({ ...item, visitType: "dzrVisit" }));
  const adminOrder = groupVisitFolders(folders).flatMap((group) => group.folders.map((folder) => folder.positionKey));
  const sharedOrder = [...folders].sort(compareVisitFolderOrder).map((folder) => folder.positionKey);
  assert.deepEqual(sharedOrder, adminOrder);
  const dashboardOrder = groupDocumentPanelsByPerson(realWorldPanels.map((item) => ({ ...item, holders: [], fileCount: 1 })))
    .flatMap((block) => block.panels.map((item) => item.positionKey));
  assert.deepEqual(dashboardOrder, adminOrder, "with one block per folder the dashboard matches the admin page exactly");
});

test("file count and aria labels use correct singulars", () => {
  assert.equal(formatVisitDocumentBlockFileCount({ roleCount: 1, fileCount: 1 }), "1 file");
  assert.equal(formatVisitDocumentBlockFileCount({ roleCount: 2, fileCount: 0 }), "0 files");
  assert.equal(formatVisitDocumentBlockFileCount({ roleCount: 2, fileCount: 3 }), "3 files");
  const yashali = groupDocumentPanelsByPerson(realWorldPanels).find((block) => block.title === "Rtr. Yashali Shirodkar");
  assert.equal(
    getVisitDocumentBlockAriaLabel(yashali),
    "Rtr. Yashali Shirodkar — Co-International Service Director, Public Relations Officer — 3 files",
  );
  assert.equal(
    getVisitDocumentBlockAriaLabel({ title: "Rtr. Harshal Nikam", fileCount: 1, panels: [{ positionTitle: "Club Service Director" }] }),
    "Rtr. Harshal Nikam — Club Service Director — 1 file",
  );
  assert.equal(
    getVisitDocumentBlockAriaLabel({ title: "Editor", vacant: true, fileCount: 2, panels: [{ positionTitle: "Editor" }] }),
    "Vacant — Editor — 2 files",
  );
});

test("holders are validated: safe ids, trimmed names, max per folder, no duplicates", () => {
  const many = Array.from({ length: 9 }, (_, index) => ({ personKey: `k${index}`, displayName: `Rtr. P${index}` }));
  assert.equal(normalizeVisitHolders(many).length, MAX_VISIT_HOLDERS_PER_FOLDER);
  assert.deepEqual(normalizeVisitHolders([
    { personKey: "abc123", displayName: "  Rtr.   Spaced   Name " },
    { personKey: "abc123", displayName: "Duplicate" },
    { personKey: "bad/key", displayName: "Slash" },
    { personKey: "x".repeat(65), displayName: "Too long key" },
    { personKey: "nokey-name", displayName: "" },
    { personKey: "ok_key-1", displayName: "N".repeat(200) },
    null,
    "string",
    [],
  ]), [
    { personKey: "abc123", displayName: "Rtr. Spaced Name" },
    { personKey: "ok_key-1", displayName: "N".repeat(120) },
  ]);
  assert.deepEqual(normalizeVisitHolders(undefined), []);
  assert.equal(joinVisitHolderNames([{ displayName: "Rtr. A" }, { displayName: "Rtr. B" }]), "Rtr. A & Rtr. B");
});

test("normalized dashboard panels keep validated holders and drop extra fields", () => {
  const normalized = normalizeVisitDashboardData({
    visit: { visitType: "dzrVisit", visitName: "DZR Visit" },
    documentPanels: [{
      positionKey: "pro",
      positionTitle: "Public Relations Officer",
      files: [],
      holders: [{ personKey: "0123456789abcdef", displayName: "Rtr. Yashali Shirodkar", uid: "secret-uid" }],
    }],
  }, "dzrVisit");
  assert.deepEqual(normalized.documentPanels[0].holders, [
    { personKey: "0123456789abcdef", displayName: "Rtr. Yashali Shirodkar" },
  ]);
  assert.equal(JSON.stringify(normalized).includes("secret-uid"), false);
});

test("role chip code falls back to the avenue code instead of repeating the title", () => {
  assert.equal(resolveVisitDocumentRoleCode({ positionTitle: "Public Relations Officer", avenueCode: "PRO" }, "PRO"), "PRO");
  assert.equal(resolveVisitDocumentRoleCode({ positionTitle: "President", avenueCode: "PRES" }, "President"), "PRES");
  assert.equal(resolveVisitDocumentRoleCode({ positionTitle: "Editor", avenueCode: "EDITOR" }, "Editor"), "");
  assert.equal(resolveVisitDocumentRoleCode({ positionTitle: "Secretary" }, "Secretary"), "");
});

// Codes as the catalog resolves them today: the co- codes are irregular
// (Co-VP, CPRES, CSEC, CA, CR), so position keys decide the group.
const CATALOG_FILTER_CASES = [
  ["president", "President", "PRES", "core"],
  ["immediate-past-president", "Immediate Past President", "IPP", "core"],
  ["vice-president", "Vice President", "VP", "core"],
  ["secretary", "Secretary", "SEC", "core"],
  ["joint-secretary", "Joint Secretary", "JSEC", "core"],
  ["treasurer", "Treasurer", "TREAS", "core"],
  ["club-advisor", "Club Advisor", "ADV", "core"],
  ["saa", "Sergeant-at-Arms", "SAA", "core"],
  ["csd", "Club Service Director", "CSD", "avenue"],
  ["cmd", "Community Service Director", "CMD", "avenue"],
  ["isd", "International Service Director", "ISD", "avenue"],
  ["pdd", "Professional Development Director", "PDD", "avenue"],
  ["dei", "DEI Director", "DEI", "avenue"],
  ["pro", "Public Relations Officer", "PRO", "avenue"],
  ["rrro", "Rotary Rotaract Relations Officer", "RRRO", "avenue"],
  ["co-president", "Co-President", "CPRES", "co"],
  ["co-vice-president", "Co-Vice President", "CVP", "co"],
  ["co-secretary", "Co-Secretary", "CSEC", "co"],
  ["co-club-advisor", "Co-Club Advisor", "CADV", "co"],
  ["co-csd", "Co-Club Service Director", "CCSD", "co"],
  ["co-wr", "Co-Women's Representative", "CWR", "co"],
  ["editor", "Editor", "EDITOR", "support"],
  ["cwd", "Website Director", "CWD", "support"],
  ["sports-representative", "Sports Representative", "SPORTS", "support"],
  ["wrwc", "World Rotaract Week Chairperson", "WRWC", "support"],
  ["pid", "Public Image Director", "PID", "support"],
  ["mdo", "Membership Development Officer", "MDO", "support"],
];

test("document filter groups follow position keys for every catalog role", () => {
  for (const [positionKey, positionTitle, avenueCode, group] of CATALOG_FILTER_CASES) {
    assert.equal(getVisitDocumentPanelFilterGroup({ positionKey, positionTitle, avenueCode }), group, positionKey);
  }
});

test("document filter groups fall back to codes for unknown keys", () => {
  assert.equal(getVisitDocumentPanelFilterGroup({ positionKey: "custom-1", positionTitle: "Co Public Relations Lead" }), "co");
  assert.equal(getVisitDocumentPanelFilterGroup({ positionKey: "custom-2", positionTitle: "Avenue lead", avenueCode: "PDD" }), "avenue");
  assert.equal(getVisitDocumentPanelFilterGroup({ positionKey: "custom-3", positionTitle: "Treasurer", avenueCode: "TREAS" }), "core");
  assert.equal(getVisitDocumentPanelFilterGroup({ positionKey: "custom-4", positionTitle: "Photographer" }), "support");
  assert.equal(getVisitDocumentPanelFilterGroup({}), "support");
});

test("multi-role people appear in every matching filter and filtering keeps hierarchy order", () => {
  const blocks = groupDocumentPanelsByPerson(realWorldPanels);
  const counts = countVisitDocumentFilters(blocks);
  assert.equal(counts.all, blocks.length);
  const yashali = (key) => filterVisitDocumentBlocks(blocks, key).some((block) => block.title === "Rtr. Yashali Shirodkar");
  assert.equal(yashali("avenue"), true, "PRO role");
  assert.equal(yashali("co"), true, "Co-ISD role");
  assert.equal(yashali("core"), false);
  const anish = filterVisitDocumentBlocks(blocks, "support").find((block) => block.title === "Rtr. Anish Abhijit Joglekar");
  assert.ok(anish, "PID + MDO holder is a support role");
  for (const filter of ["core", "avenue", "co", "support"]) {
    const filtered = filterVisitDocumentBlocks(blocks, filter).map((block) => block.blockKey);
    assert.equal(counts[filter], filtered.length, filter);
    assert.deepEqual(filtered, blocks.map((block) => block.blockKey).filter((key) => filtered.includes(key)), `${filter} keeps order`);
  }
  assert.equal(filterVisitDocumentBlocks(blocks, "all").length, blocks.length);
  assert.equal(countVisitDocumentFilters([]).core, 0);
});

test("tile labels, role labels and file types read cleanly", () => {
  const yashali = groupDocumentPanelsByPerson(realWorldPanels).find((block) => block.title === "Rtr. Yashali Shirodkar");
  assert.equal(
    getVisitDocumentTileAriaLabel(yashali),
    "Rtr. Yashali Shirodkar, Co-International Service Director, Public Relations Officer, 3 files. Open documents.",
  );
  assert.equal(
    getVisitDocumentTileAriaLabel({ title: "Editor", vacant: true, fileCount: 1, panels: [{ positionTitle: "Editor" }] }),
    "Vacant, Editor, 1 file. Open documents.",
  );
  assert.equal(formatVisitDocumentRoleLabel({ positionKey: "pro", positionTitle: "Public Relations Officer", avenueCode: "PRO" }), "PRO · Public Relations Officer");
  assert.equal(formatVisitDocumentRoleLabel({ positionKey: "editor", positionTitle: "Editor", avenueCode: "EDITOR" }), "Editor");
  assert.equal(getVisitDocumentFileType({ mimeType: "application/pdf" }), "PDF");
  assert.equal(getVisitDocumentFileType({ mimeType: "application/vnd.google-apps.presentation" }), "PPTX");
  assert.equal(getVisitDocumentFileType({ fileName: "Budget.xlsx" }), "XLSX");
  assert.equal(getVisitDocumentFileType({ fileName: "minutes.docx" }), "DOCX");
  assert.equal(getVisitDocumentFileType({ mimeType: "image/jpeg" }), "IMG");
  assert.equal(getVisitDocumentFileType({ fileName: "notes.txt" }), "FILE");
});

test("viewer lists the main presentation first and picks it by default", () => {
  const file = (submissionId, extra = {}) => ({ submissionId, title: submissionId, ...extra });
  const report = file("report", { canPreview: true, previewUrl: "preview-report" });
  const deck = file("deck", { canPreview: true, previewUrl: "preview-deck" });
  const sheet = file("sheet");
  const mainPanel = { positionKey: "pro", files: [sheet, report, deck], primaryPresentation: deck };
  assert.deepEqual(orderVisitDocumentPanelFiles(mainPanel).map((item) => item.submissionId), ["deck", "sheet", "report"]);
  const otherPanel = { positionKey: "co-isd", files: [sheet, report] };
  assert.equal(pickDefaultVisitDocumentFileKey({ panels: [otherPanel, mainPanel] }), "pro:deck", "main presentation beats earlier files");
  assert.equal(pickDefaultVisitDocumentFileKey({ panels: [otherPanel] }), "co-isd:report", "then the first previewable file");
  assert.equal(pickDefaultVisitDocumentFileKey({ panels: [{ positionKey: "x", files: [sheet] }] }), "x:sheet", "then the first file");
  assert.equal(pickDefaultVisitDocumentFileKey({ panels: [{ positionKey: "x", files: [] }] }), "");
});
