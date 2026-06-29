import assert from "node:assert/strict";
import test from "node:test";
import { getSafeLoginDestination } from "./loginRedirect.js";

for (const path of ["/access", "/dashboard", "/admin?tab=users", "/calendar#month"]) {
  test(`accepts safe internal destination ${path}`, () => {
    assert.equal(getSafeLoginDestination(path), path);
  });
}

for (const value of [
  "",
  "/login",
  "/login?next=/admin",
  "//evil.example",
  "https://evil.example",
  "javascript:alert(1)",
  "relative/path",
  "/\\evil.example",
  "/admin\\settings",
  "/%5C%5Cevil.example",
  "%not-valid",
  null,
]) {
  test(`rejects unsafe destination ${String(value)}`, () => {
    assert.equal(getSafeLoginDestination(value), "/access");
  });
}
