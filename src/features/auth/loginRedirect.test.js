import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getSafeLoginDestination } from "./loginRedirect.js";

const authenticatedRouteSource = readFileSync(new URL("./AuthenticatedRoute.jsx", import.meta.url), "utf8");
const loginPageSource = readFileSync(new URL("../../pages/auth/LoginPage.jsx", import.meta.url), "utf8");

for (const path of ["/access", "/dashboard", "/admin?tab=users", "/calendar#month", "/bod-tools?reportingWindowId=abc"]) {
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

test("unauthenticated protected routes preserve safe next destinations through login", () => {
  assert.match(authenticatedRouteSource, /location\.pathname\}\$\{location\.search\}\$\{location\.hash/);
  assert.match(authenticatedRouteSource, /\/login\?next=\$\{encodeURIComponent\(returnPath\)\}/);
  assert.match(authenticatedRouteSource, /state=\{\{ from: returnPath \}\}/);
  assert.match(loginPageSource, /new URLSearchParams\(location\.search\)\.get\("next"\)/);
  assert.match(loginPageSource, /getSafeLoginDestination\(location\.state\?\.from \|\| nextDestination\)/);
});
