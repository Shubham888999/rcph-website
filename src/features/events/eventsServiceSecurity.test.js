import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./eventsService.js", import.meta.url), "utf8");

test("public events query requests public visibility before rendering filters", () => {
  assert.match(source, /where\("visibility", "==", "public"\)/);
  assert.doesNotMatch(source, /permit public reads of all event documents/);
});
