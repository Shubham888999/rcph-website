import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
const firebaseConfig = readFileSync(new URL("../../firebase.json", import.meta.url), "utf8");

test("firebase config points at the local Firestore ruleset", () => {
  assert.match(firebaseConfig, /"firestore"\s*:\s*\{[\s\S]*"rules"\s*:\s*"firestore\.rules"/);
});

test("users cannot self-approve or directly edit lifecycle and role fields", () => {
  assert.match(rules, /match \/users\/\{uid\}/);
  assert.match(rules, /allow create, update, delete: if false;/);
  assert.match(rules, /isApproved != false/);
  assert.match(rules, /approvalStatus in \["pending", "rejected"\]/);
});

test("prospect and stale role assignment access is denied by direct Firestore rules", () => {
  assert.match(rules, /approvedRole\(request\.auth\.uid, \["gbm", "bod", "admin", "president"\]\)/);
  assert.match(rules, /accountType in \["prospect"\]/);
  assert.match(rules, /match \/positionAssignments\/\{assignmentId\}[\s\S]*allow read, write: if false;/);
  assert.match(rules, /match \/bodPositionAssignments\/\{assignmentId\}[\s\S]*allow read, write: if false;/);
  assert.match(rules, /match \/roleAssignments\/\{assignmentId\}[\s\S]*allow read, write: if false;/);
});

test("public events are explicitly visibility gated while internal collections stay protected", () => {
  assert.match(rules, /function publicEvent\(\)/);
  assert.match(rules, /resource\.data\.visibility == "public"/);
  assert.match(rules, /match \/treasury\/\{transactionId\}[\s\S]*allow read, write: if isAccountAdmin\(\);/);
  assert.match(rules, /match \/fines\/\{fineId\}[\s\S]*allow read: if isAccountAdmin\(\);/);
  assert.match(rules, /match \/\{document=\*\*\}[\s\S]*allow read, write: if false;/);
});
