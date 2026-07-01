import assert from "node:assert/strict";
import test from "node:test";
import {
  juneAwards,
  juneNominations,
} from "./monthlyHighlightData.js";

test("June highlight includes every award and nomination with stable unique keys", () => {
  assert.equal(juneAwards.length, 10);
  assert.equal(juneNominations.length, 9);

  assert.equal(
    new Set(juneAwards.map(({ id }) => id)).size,
    juneAwards.length,
  );

  assert.equal(
    new Set(juneNominations.map(({ id }) => id)).size,
    juneNominations.length,
  );
});

test("Gold Citation remains the leading major award", () => {
  assert.deepEqual(juneAwards[0], {
    id: "gold-citation",
    title: "Gold Citation",
    detail: "Rank 1 with 138 Points",
    category: "major",
  });
});

test("all awards and nominations remain directly available without progressive disclosure", () => {
  assert.ok(
    juneAwards.some(
      ({ title, detail }) =>
        title === "Best Rotaractor" &&
        detail === "Rtr. Nupura Danait",
    ),
  );

  assert.ok(
    juneAwards.some(
      ({ title, detail }) =>
        title === "Special District Recognition" &&
        detail.includes("AURA Journey District Video"),
    ),
  );

  assert.ok(
    juneNominations.some(
      ({ title, detail }) =>
        title === "DEI Representative, Community" &&
        detail === "Rtr. Shivani Kulkarni",
    ),
  );

  assert.ok(
    juneNominations.some(
      ({ title, detail }) =>
        title === "Best Professional Development Initiative" &&
        detail === "Madhushala 4.0",
    ),
  );
});