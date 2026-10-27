import assert from "node:assert/strict";
import test from "node:test";
import { canEditVisitPrimaryPresentation, groupVisitSubmissionsByCategory, normalizeFolder, normalizeFolders, normalizeSubmission, normalizeVisit, validateVisitFile, VISIT_DOCUMENT_CATEGORIES, VISIT_TYPES, VISIT_UPLOAD_CATEGORY_CHOICES, visitBulkAction, visitBulkSelectable, visitBulkSummary, visitFolderCategories, visitFolderUsesCategories, visitTopLevelFolderCount, visitUploadChoices } from "./visitModel.js";
test("visit and folder models whitelist verified fields",()=>{const visit=normalizeVisit({visitType:"dzrVisit",displayTitle:" DZR ",secret:"x"});assert.equal(visit.displayTitle,"DZR");assert.equal(Object.hasOwn(visit,"secret"),false);const folder=normalizeFolder({visitType:"dzrVisit",positionKey:"cwd",maxActiveFiles:40,primaryPresentationSubmissionId:"selected-file"});assert.equal(folder.positionKey,"cwd");assert.equal(folder.primaryPresentationSubmissionId,"selected-file")});
test("submission ignores unsafe URL",()=>{const item=normalizeSubmission({submissionId:"s",fileName:"x",fileUrl:"javascript:x"});assert.equal(item.fileUrl,"")});
test("submission normalizes primary presentation controls",()=>{const item=normalizeSubmission({submissionId:"s",fileName:"deck.pptx",isPrimaryPresentation:true,canSetPrimaryPresentation:true});assert.equal(item.isPrimaryPresentation,true);assert.equal(item.canSetPrimaryPresentation,true)});
test("folder lists render every backend-authorized role folder once",()=>{const folders=normalizeFolders([{visitType:"clubAssembly",positionKey:"csd",positionTitle:"CSD"},{visitType:"clubAssembly",positionKey:"co-csd",positionTitle:"Co-CSD"},{visitType:"clubAssembly",positionKey:"co-csd",positionTitle:"Duplicate Co-CSD"},{visitType:"dzrVisit",positionKey:"csd",positionTitle:"Wrong Visit"}],"clubAssembly");assert.deepEqual(folders.map((folder)=>folder.positionKey),["csd","co-csd"])});
test("folder list normalization is visit-type agnostic",()=>{for(const visitType of VISIT_TYPES){const folders=normalizeFolders([{visitType,positionKey:"pdd",positionTitle:"PDD"},{visitType,positionKey:"co-pdd",positionTitle:"Co-PDD"}],visitType);assert.deepEqual(folders.map((folder)=>folder.positionKey),["pdd","co-pdd"])}});
test("file validation enforces MIME, extension, and folder size",()=>{const folder={maxFileSizeBytes:10};assert.ok(validateVisitFile({name:"x.html",type:"text/html",size:1},folder));assert.ok(validateVisitFile({name:"x.pdf",type:"application/pdf",size:11},folder));assert.equal(validateVisitFile({name:"x.pdf",type:"application/pdf",size:10},folder),"")});

test("submissions carry a safe document category and move permission", () => {
  assert.equal(normalizeSubmission({ submissionId: "s", documentCategory: "inward", canMove: true }).documentCategory, "inward");
  assert.equal(normalizeSubmission({ submissionId: "s", documentCategory: "outward" }).documentCategory, "outward");
  assert.equal(normalizeSubmission({ submissionId: "s", documentCategory: "Archive" }).documentCategory, "");
  assert.equal(normalizeSubmission({ submissionId: "s" }).documentCategory, "");
  assert.equal(normalizeSubmission({ submissionId: "s", canMove: true }).canMove, true);
  assert.equal(normalizeSubmission({ submissionId: "s", canMove: "yes" }).canMove, false);
});

test("folders expose whether they support document categories", () => {
  assert.equal(normalizeFolder({ visitType: "clubAssembly", positionKey: "secretary", supportsDocumentCategories: true }).supportsDocumentCategories, true);
  assert.equal(normalizeFolder({ visitType: "clubAssembly", positionKey: "editor" }).supportsDocumentCategories, false);
});

test("folder holders may edit the main presentation only when the backend flags their folder", () => {
  const holderFolder = normalizeFolder({ visitType: "dzrVisit", positionKey: "pid", canSetPrimaryPresentation: true });
  const lockedFolder = normalizeFolder({ visitType: "dzrVisit", positionKey: "pid", canSetPrimaryPresentation: false, locked: true });
  assert.equal(holderFolder.canSetPrimaryPresentation, true);
  assert.equal(normalizeFolder({ visitType: "dzrVisit", positionKey: "pid", canSetPrimaryPresentation: "yes" }).canSetPrimaryPresentation, false);
  assert.equal(canEditVisitPrimaryPresentation({ canManage: false }, holderFolder), true, "holder of an open folder");
  assert.equal(canEditVisitPrimaryPresentation({ canManage: false }, lockedFolder), false, "holder of a locked folder");
  assert.equal(canEditVisitPrimaryPresentation({ canManage: true }, lockedFolder), true, "manager always");
  assert.equal(canEditVisitPrimaryPresentation({}, null), false);
});

test("library groups render Inward file and register, Outward file and register, then Supporting files", () => {
  const groups = groupVisitSubmissionsByCategory([
    { submissionId: "a", documentCategory: "" },
    { submissionId: "b", documentCategory: "outward" },
    { submissionId: "c", documentCategory: "inward" },
    { submissionId: "d" },
    { submissionId: "e", documentCategory: "outward-register" },
  ]);
  assert.deepEqual(groups.map((group) => group.label), ["Inward file", "Inward register", "Outward file", "Outward register", "Supporting files"]);
  assert.deepEqual(groups.map((group) => group.items.map((item) => item.submissionId)), [["c"], [], ["b"], ["e"], ["a", "d"]]);
  assert.deepEqual(groups.map((group) => group.emptyNote), ["No inward documents yet.", "No inward register yet.", "No outward documents yet.", "No outward register yet.", "No supporting files yet."]);
  assert.deepEqual(groupVisitSubmissionsByCategory([]).map((group) => group.items.length), [0, 0, 0, 0, 0]);
});

test("move labels and upload choices use the agreed wording", () => {
  assert.deepEqual(VISIT_DOCUMENT_CATEGORIES.map((category) => category.moveLabel), ["Move to Inward file", "Move to Inward register", "Move to Outward file", "Move to Outward register", "Move to Supporting files"]);
  assert.deepEqual(VISIT_UPLOAD_CATEGORY_CHOICES.map((choice) => [choice.key, choice.label]), [["", "None"], ["inward", "Inward file"], ["inward-register", "Inward register"], ["outward", "Outward file"], ["outward-register", "Outward register"]]);
  assert.equal(normalizeSubmission({ submissionId: "s", documentCategory: "inward-register" }).documentCategory, "inward-register");
  assert.equal(normalizeSubmission({ submissionId: "s", documentCategory: "outward-register" }).documentCategory, "outward-register");
});

test("extra folders appear between the Secretary folders and Supporting files, for any position", () => {
  const editor = normalizeFolder({ visitType: "clubAssembly", positionKey: "editor", supportsCustomFolders: true, canManageCustomFolders: true, customFolders: [{ key: "custom-0a1b2c3d", name: "Event photos" }, { key: "bad", name: "x" }, { key: "custom-0a1b2c3e", name: " " }] });
  assert.deepEqual(editor.customFolders, [{ key: "custom-0a1b2c3d", name: "Event photos", parentKey: "" }]);
  assert.equal(editor.canManageCustomFolders, true);
  assert.deepEqual(visitFolderCategories(editor).map((category) => category.label), ["Event photos", "Supporting files"]);
  assert.equal(visitFolderUsesCategories(editor), true);
  assert.deepEqual(visitUploadChoices(editor), [{ key: "", label: "None" }, { key: "custom-0a1b2c3d", label: "Event photos" }]);

  const plain = normalizeFolder({ visitType: "clubAssembly", positionKey: "editor" });
  assert.equal(visitFolderUsesCategories(plain), false);
  assert.equal(visitUploadChoices(plain).length, 1);

  const secretary = normalizeFolder({ visitType: "clubAssembly", positionKey: "secretary", supportsDocumentCategories: true, customFolders: [{ key: "custom-0a1b2c3d", name: "Bank letters" }] });
  assert.deepEqual(visitFolderCategories(secretary).map((category) => category.label), ["Inward file", "Inward register", "Outward file", "Outward register", "Bank letters", "Supporting files"]);
  assert.equal(visitFolderCategories(secretary).find((category) => category.custom).moveLabel, "Move to Bank letters");
});

test("documents sit in their extra folder, and an unknown folder key falls back to Supporting files", () => {
  const folder = normalizeFolder({ visitType: "clubAssembly", positionKey: "editor", customFolders: [{ key: "custom-0a1b2c3d", name: "Event photos" }] });
  const groups = groupVisitSubmissionsByCategory([
    normalizeSubmission({ submissionId: "a", documentCategory: "custom-0a1b2c3d" }),
    normalizeSubmission({ submissionId: "b", documentCategory: "custom-zzzzzzzz" }),
    normalizeSubmission({ submissionId: "c" }),
  ], folder);
  assert.deepEqual(groups.map((group) => [group.label, group.items.map((item) => item.submissionId)]), [["Event photos", ["a"]], ["Supporting files", ["b", "c"]]]);
});

test("subfolders sit under their parent, including the Secretary folders, and read Parent > Child", () => {
  const folder = normalizeFolder({
    visitType: "clubAssembly", positionKey: "secretary", supportsDocumentCategories: true, supportsCustomFolders: true, canManageCustomFolders: true,
    customFolders: [
      { key: "custom-0a1b2c3d", name: "2026", parentKey: "outward" },
      { key: "custom-0a1b2c3e", name: "Bank letters", parentKey: "" },
      { key: "custom-0a1b2c3f", name: "April", parentKey: "custom-0a1b2c3e" },
      { key: "custom-0a1b2c40", name: "Lost", parentKey: "not-a-folder" },
    ],
  });
  const categories = visitFolderCategories(folder);
  assert.deepEqual(categories.map((category) => category.fullLabel || category.label), [
    "Inward file", "Inward register", "Outward file", "Outward file \u203A 2026", "Outward register", "Bank letters", "Bank letters \u203A April", "Lost", "Supporting files",
  ]);
  assert.equal(visitTopLevelFolderCount(folder), 2, "the one with an unknown parent counts as top level");
  const year = categories.find((category) => category.key === "custom-0a1b2c3d");
  assert.deepEqual([year.depth, year.parentKey, year.canHaveSubfolders, year.moveLabel], [1, "outward", false, "Move to Outward file \u203A 2026"]);
  assert.equal(categories.find((category) => category.key === "outward").subfolderCount, 1);
  assert.equal(categories.find((category) => category.key === "custom-0a1b2c3e").subfolderCount, 1);
  assert.deepEqual(visitUploadChoices(folder).map((choice) => choice.label).slice(0, 5), ["None", "Inward file", "Inward register", "Outward file", "Outward file \u203A 2026"]);
  const groups = groupVisitSubmissionsByCategory([normalizeSubmission({ submissionId: "a", documentCategory: "custom-0a1b2c3d" })], folder);
  assert.deepEqual(groups.find((group) => group.key === "custom-0a1b2c3d").items.map((item) => item.submissionId), ["a"]);
});

test("Secretary responses preserve independent category usage and the overall displayed capacity", () => {
  const folder = normalizeFolder({ visitType: "dzrVisit", positionKey: "secretary", maxActiveFiles: 40, totalMaxActiveFiles: 240, activeFileCount: 200, otherActiveFileCount: 0, otherReservedFileCount: 0, categoryLimits: { inward: 100, outward: 100, forged: 1000 }, categoryUsage: { inward: { activeFileCount: 100, reservedFileCount: 0 }, outward: { activeFileCount: 99, reservedFileCount: 1 } } });
  assert.deepEqual(folder.categoryLimits, { inward: 100, outward: 100 });
  assert.equal(folder.totalMaxActiveFiles, 240);
  assert.equal(folder.otherActiveFileCount, 0);
  assert.equal(folder.categoryUsage.outward.reservedFileCount, 1);
  assert.equal(normalizeFolder({ visitType: "dzrVisit", positionKey: "editor", activeFileCount: 5 }).otherActiveFileCount, 5);
});

test("Secretary capacity metadata includes root, registers and trusted custom folders", () => {
  const keys = ["", "inward", "outward", "inward-register", "outward-register", "custom-11111111", "custom-22222222"];
  const limits = Object.fromEntries(keys.map(key => [key, 100]));
  const usage = Object.fromEntries(keys.map(key => [key, { activeFileCount: 99, reservedFileCount: 1 }]));
  const folder = normalizeFolder({ visitType: "dzrVisit", positionKey: "secretary", perFolderFileLimit: 100, maxActiveFiles: 100, totalMaxActiveFiles: 700, customFolders: [{ key: "custom-11111111", name: "Reports" }, { key: "custom-22222222", name: "Signed", parentKey: "custom-11111111" }], categoryLimits: { ...limits, "custom-33333333": 100 }, categoryUsage: usage });
  assert.deepEqual(folder.categoryLimits, limits);
  assert.deepEqual(folder.categoryUsage, usage);
  assert.equal(folder.perFolderFileLimit, 100);
  assert.equal(folder.totalMaxActiveFiles, 700);
});

test("bulk selection: managers remove, the uploader withdraws, and files with neither have no checkbox", () => {
  const files = [
    normalizeSubmission({ submissionId: "m", canRemove: true, canReplace: true }),
    normalizeSubmission({ submissionId: "u", canWithdraw: true }),
    normalizeSubmission({ submissionId: "both", canRemove: true, canWithdraw: true }),
    normalizeSubmission({ submissionId: "none" }),
  ];
  assert.deepEqual(files.map((file) => visitBulkAction(file)), ["remove", "withdraw", "remove", ""]);
  assert.deepEqual(visitBulkSelectable(files).map((file) => file.submissionId), ["m", "u", "both"]);
  assert.deepEqual(visitBulkSelectable(null), []);
  assert.deepEqual(visitBulkSummary([{ action: "remove" }, { action: "remove" }]), { removing: 2, withdrawing: 0, verb: "Remove", total: 2 });
  assert.equal(visitBulkSummary([{ action: "withdraw" }]).verb, "Withdraw");
  assert.equal(visitBulkSummary([{ action: "remove" }, { action: "withdraw" }]).verb, "Remove or withdraw");
});
