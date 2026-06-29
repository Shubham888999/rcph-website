import assert from "node:assert/strict";
import test from "node:test";
import { addOneDay } from "./calendarAdapter.js";
import { getAvenue, getAvenueGradient } from "./avenues.js";

test("inclusive ends advance safely across month end", () => {
  assert.equal(addOneDay("2026-06-30"), "2026-07-01");
});
test("inclusive ends advance safely across year end", () => {
  assert.equal(addOneDay("2026-12-31"), "2027-01-01");
});
test("inclusive ends advance safely from leap day", () => {
  assert.equal(addOneDay("2028-02-29"), "2028-03-01");
});
test("multi-avenue gradients preserve order and equal bands", () => {
  assert.equal(
    getAvenueGradient(["CMD", "ISD"]),
    "linear-gradient(to right, #3498db 0%, #3498db 50%, #1abc9c 50%, #1abc9c 100%)",
  );
});
test("unknown avenues use the fallback color", () => {
  assert.equal(getAvenue("OTHER").color, "#666666");
});
