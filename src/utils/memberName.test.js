import assert from "node:assert/strict";
import test from "node:test";
import { formatRotaractorName, stripRotaractorPrefix } from "./memberName.js";

test("stripRotaractorPrefix removes repeated manual prefixes", () => {
  assert.equal(stripRotaractorPrefix("Rtr. Rtr. Shubham Deshpande"), "Shubham Deshpande");
});

test("formatRotaractorName prefixes actual members only once", () => {
  assert.equal(formatRotaractorName("Shubham Deshpande", { role: "gbm", status: "approved" }), "Rtr. Shubham Deshpande");
  assert.equal(formatRotaractorName("Rtr. Shubham Deshpande", { role: "bod", status: "approved" }), "Rtr. Shubham Deshpande");
  assert.equal(formatRotaractorName("Rtr. Rtr. Shubham Deshpande", { role: "admin", status: "approved" }), "Rtr. Shubham Deshpande");
  assert.equal(formatRotaractorName("RTR Shubham Deshpande", { role: "president", status: "approved" }), "Rtr. Shubham Deshpande");
});

test("formatRotaractorName leaves prospects and empty names unprefixed", () => {
  assert.equal(formatRotaractorName("Shubham Deshpande", { role: "prospect", status: "approved" }), "Shubham Deshpande");
  assert.equal(formatRotaractorName("", { role: "gbm", status: "approved" }), "");
});
test("stripRotaractorPrefix handles missing spaces after prefixes", () => {
  assert.equal(
    stripRotaractorPrefix("Rtr.Rtr. Shubham Deshpande"),
    "Shubham Deshpande",
  );
});

test("formatRotaractorName keeps prospects unprefixed even with position data", () => {
  assert.equal(
    formatRotaractorName("Saee Patil", {
      role: "prospect",
      status: "approved",
      positionKeys: ["some-position"],
    }),
    "Saee Patil",
  );
});