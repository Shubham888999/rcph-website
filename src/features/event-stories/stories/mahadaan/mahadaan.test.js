import assert from "node:assert/strict";
import test from "node:test";
import { collectedAmounts, mahadaanDrives, mahadaanTotals } from "./mahadaanDrives.js";

test("each drive shows what it collected", () => {
  assert.deepEqual(collectedAmounts(mahadaanDrives[0].collected), { grains: "15 kg", clothes: "28 bags", money: "Rs. 2,600" });
  assert.deepEqual(collectedAmounts(mahadaanDrives[1].collected), { grains: "63 kg", clothes: "23 bags", money: "Rs. 7,202" });
});

test("both drives add up to the Mahadaan 12.0 total", () => {
  assert.deepEqual(mahadaanTotals(), { grainsKg: 78, clothesBags: 51, moneyRupees: 9802 });
  assert.equal(collectedAmounts(mahadaanTotals()).money, "Rs. 9,802");
});

test("both drives are credited to all three organisers", () => {
  for (const drive of mahadaanDrives) {
    assert.deepEqual(drive.conductedBy.map((person) => person.name), ["Rtr. Soumitra Lokur", "Rtr. Tanishka Patekar", "Rtr. Aneesh Ladkat"]);
  }
});
