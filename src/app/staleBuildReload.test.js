import assert from "node:assert/strict";
import test from "node:test";
import { isStaleBuildError, reloadForNewVersion } from "./staleBuildReload.js";

function memoryStorage() {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

test("recognises the error a tab gets after a new deploy", () => {
  assert.ok(isStaleBuildError(new TypeError("Failed to fetch dynamically imported module: https://rcph3131.org/assets/BodPage-wstXOcqK.js")));
  assert.ok(isStaleBuildError(new Error("Importing a module script failed.")));
  assert.equal(isStaleBuildError(new Error("Cannot read properties of undefined")), false);
});

test("reloads once, then not again within 30 seconds", () => {
  const storage = memoryStorage();
  let reloads = 0;
  assert.equal(reloadForNewVersion(storage, 1_000, () => reloads++), true);
  assert.equal(reloadForNewVersion(storage, 5_000, () => reloads++), false);
  assert.equal(reloadForNewVersion(storage, 40_000, () => reloads++), true);
  assert.equal(reloads, 2);
});
