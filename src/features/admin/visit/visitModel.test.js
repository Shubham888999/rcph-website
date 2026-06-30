import assert from "node:assert/strict";
import test from "node:test";
import { normalizeFolder, normalizeSubmission, normalizeVisit, validateVisitFile } from "./visitModel.js";
test("visit and folder models whitelist verified fields",()=>{const visit=normalizeVisit({visitType:"dzrVisit",displayTitle:" DZR ",secret:"x"});assert.equal(visit.displayTitle,"DZR");assert.equal(Object.hasOwn(visit,"secret"),false);const folder=normalizeFolder({visitType:"dzrVisit",positionKey:"cwd",maxActiveFiles:40});assert.equal(folder.positionKey,"cwd")});
test("submission ignores unsafe URL",()=>{const item=normalizeSubmission({submissionId:"s",fileName:"x",fileUrl:"javascript:x"});assert.equal(item.fileUrl,"")});
test("file validation enforces MIME and folder size",()=>{const folder={maxFileSizeBytes:10};assert.ok(validateVisitFile({type:"text/html",size:1},folder));assert.ok(validateVisitFile({type:"application/pdf",size:11},folder));assert.equal(validateVisitFile({type:"application/pdf",size:10},folder),"")});
