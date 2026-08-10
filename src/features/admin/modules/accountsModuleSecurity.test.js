import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./CoreModules.jsx", import.meta.url), "utf8");

test("Accounts and Roles exposes Prospect demotion with explicit confirmation", () => {
  assert.match(source, /ADMIN_ROLES/);
  assert.match(source, /role === "prospect"/);
  assert.match(source, /Type PROSPECT to confirm/);
  assert.match(source, /removes member, BOD, Admin, President, position, Club Visits, and module access/);
  assert.match(source, /editor\.demotionConfirm\.trim\(\) !== "PROSPECT"/);
});

test("Accounts and Roles waits for backend success before closing the editor", () => {
  assert.match(source, /const result = await run\("update-access"/);
  assert.match(source, /if \(result\) \{/);
  assert.doesNotMatch(source, /setEditor\(null\);[\s\S]*const result = await run\("update-access"/);
});
