import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_SIDEBAR_COLLAPSED_KEY,
  readAdminSidebarCollapsedPreference,
  writeAdminSidebarCollapsedPreference,
} from "./adminSidebarPreference.js";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    value(key) {
      return values.get(key);
    },
  };
}

test("Admin sidebar preference defaults expanded when no saved value exists", () => {
  assert.equal(readAdminSidebarCollapsedPreference(memoryStorage()), false);
  assert.equal(readAdminSidebarCollapsedPreference(null), false);
});

test("Admin sidebar preference saves and restores collapsed and expanded states", () => {
  const storage = memoryStorage();

  assert.equal(writeAdminSidebarCollapsedPreference(true, storage), true);
  assert.equal(storage.value(ADMIN_SIDEBAR_COLLAPSED_KEY), "true");
  assert.equal(readAdminSidebarCollapsedPreference(storage), true);

  assert.equal(writeAdminSidebarCollapsedPreference(false, storage), true);
  assert.equal(storage.value(ADMIN_SIDEBAR_COLLAPSED_KEY), "false");
  assert.equal(readAdminSidebarCollapsedPreference(storage), false);
});

test("Admin sidebar preference treats invalid storage values as expanded", () => {
  const storage = memoryStorage({ [ADMIN_SIDEBAR_COLLAPSED_KEY]: "collapsed" });

  assert.equal(readAdminSidebarCollapsedPreference(storage), false);
});

test("Admin sidebar preference tolerates unavailable or throwing localStorage", () => {
  const throwingStorage = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
  };

  assert.equal(readAdminSidebarCollapsedPreference(throwingStorage), false);
  assert.equal(writeAdminSidebarCollapsedPreference(true, throwingStorage), false);
});
