import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./router.jsx", import.meta.url), "utf8");

test("dashboard route uses personal dashboard capability for Prospect/member split", () => {
  assert.match(source, /<RoleRoute capability="personalDashboard" \/>/);
  assert.doesNotMatch(source, /<RoleRoute capability="memberDashboard" \/>/);
});
