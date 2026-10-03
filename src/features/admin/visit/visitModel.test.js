import assert from "node:assert/strict";
import test from "node:test";
import { groupVisitSubmissionsByCategory, normalizeFolder, normalizeFolders, normalizeSubmission, normalizeVisit, validateVisitFile, VISIT_DOCUMENT_CATEGORIES, VISIT_TYPES, VISIT_UPLOAD_CATEGORY_CHOICES } from "./visitModel.js";
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

test("library groups render Inward, Outward, then Supporting files with their items", () => {
  const groups = groupVisitSubmissionsByCategory([
    { submissionId: "a", documentCategory: "" },
    { submissionId: "b", documentCategory: "outward" },
    { submissionId: "c", documentCategory: "inward" },
    { submissionId: "d" },
  ]);
  assert.deepEqual(groups.map((group) => group.label), ["Inward", "Outward", "Supporting files"]);
  assert.deepEqual(groups.map((group) => group.items.map((item) => item.submissionId)), [["c"], ["b"], ["a", "d"]]);
  assert.deepEqual(groups.map((group) => group.emptyNote), ["No inward documents yet.", "No outward documents yet.", "No supporting files yet."]);
  assert.deepEqual(groupVisitSubmissionsByCategory([]).map((group) => group.items.length), [0, 0, 0]);
});

test("move labels and upload choices use the agreed wording", () => {
  assert.deepEqual(VISIT_DOCUMENT_CATEGORIES.map((category) => category.moveLabel), ["Move to Inward", "Move to Outward", "Move to Supporting files"]);
  assert.deepEqual(VISIT_UPLOAD_CATEGORY_CHOICES.map((choice) => [choice.key, choice.label]), [["", "None"], ["inward", "Inward"], ["outward", "Outward"]]);
});
