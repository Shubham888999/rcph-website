import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const firebaseConfig = readFileSync(new URL("../../firebase.json", import.meta.url), "utf8");

test("firebase config never deploys Firestore rules from the frontend folder", () => {
  assert.doesNotMatch(firebaseConfig, /"firestore"\s*:/);
});

test("the frontend keeps no Firestore rules copy; deployed rules live in the backend repo", () => {
  // Rules are deployed from the backend (main branch) firestore.rules and tested by
  // functions/lib/firestore-security-rules.test.js there.
  assert.equal(existsSync(new URL("../../firestore.rules", import.meta.url)), false);
});
