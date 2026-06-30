import assert from "node:assert/strict";
import test from "node:test";
import { getRouteMetadata } from "./metadataModel.js";

test("public routes are indexable and canonical", () => {
  const metadata = getRouteMetadata("/calendar");
  assert.equal(metadata.robots, "index, follow");
  assert.equal(metadata.canonical, "https://rcph3131.org/calendar");
});

test("auth and protected routes are noindex", () => {
  for (const path of ["/login", "/access", "/dashboard", "/bod-tools", "/admin/visit-submissions"]) {
    assert.equal(getRouteMetadata(path).robots, "noindex, nofollow");
  }
});

test("unknown routes are noindex", () => {
  assert.equal(getRouteMetadata("/missing").title, "Page Not Found | RCPH");
  assert.equal(getRouteMetadata("/missing").isPublic, false);
});
