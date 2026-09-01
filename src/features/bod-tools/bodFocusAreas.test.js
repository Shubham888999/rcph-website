import assert from "node:assert/strict";
import test from "node:test";
import {
  BOD_FOCUS_AREA_CATEGORY_ASCEND,
  BOD_FOCUS_AREA_CATEGORY_OTHER,
  BOD_FOCUS_AREA_CATEGORY_ROTARY,
formatBodFocusAreasForReport,
groupBodFocusAreasForReport,
normalizeBodFocusAreas,
  validateAndNormalizeBodFocusAreas,
} from "./bodFocusAreas.js";

test("missing and disabled Focus Areas normalize to an empty array", () => {
  assert.deepEqual(normalizeBodFocusAreas(), []);
  assert.deepEqual(validateAndNormalizeBodFocusAreas([], { enabled: false }), { ok: true, focusAreas: [], error: "" });
  assert.deepEqual(validateAndNormalizeBodFocusAreas([
    { category: BOD_FOCUS_AREA_CATEGORY_ROTARY, value: "Environment" },
  ], { enabled: false }), { ok: true, focusAreas: [], error: "" });
});

test("Rotary Focus Area selections keep exact supported labels", () => {
  assert.deepEqual(normalizeBodFocusAreas([
    { category: BOD_FOCUS_AREA_CATEGORY_ROTARY, value: " Environment " },
  ]), [
    { category: BOD_FOCUS_AREA_CATEGORY_ROTARY, value: "Environment" },
  ]);
});

test("multiple Focus Areas across Rotary and Ascend groups are preserved in order", () => {
  const result = validateAndNormalizeBodFocusAreas([
    { category: BOD_FOCUS_AREA_CATEGORY_ROTARY, value: "Peacebuilding and conflict prevention" },
    { category: BOD_FOCUS_AREA_CATEGORY_ASCEND, value: "Harvesting Innovation" },
    { category: BOD_FOCUS_AREA_CATEGORY_ASCEND, value: "A.I Tech" },
  ], { enabled: true });

  assert.equal(result.ok, true);
  assert.deepEqual(result.focusAreas, [
    { category: BOD_FOCUS_AREA_CATEGORY_ROTARY, value: "Peacebuilding and conflict prevention" },
    { category: BOD_FOCUS_AREA_CATEGORY_ASCEND, value: "Harvesting Innovation" },
    { category: BOD_FOCUS_AREA_CATEGORY_ASCEND, value: "A.I Tech" },
  ]);
  assert.equal(formatBodFocusAreasForReport(result.focusAreas), "Peacebuilding and conflict prevention, Harvesting Innovation, A.I Tech");
});

test("report grouping separates Rotary and Other Focus Areas from Ascend Chapters", () => {
  const grouped = groupBodFocusAreasForReport([
    { category: BOD_FOCUS_AREA_CATEGORY_ROTARY, value: "Environment" },
    { category: BOD_FOCUS_AREA_CATEGORY_ASCEND, value: "Media" },
    { category: BOD_FOCUS_AREA_CATEGORY_ASCEND, value: "Finance" },
    { category: BOD_FOCUS_AREA_CATEGORY_OTHER, value: "District Grant Partnerships" },
  ]);

  assert.deepEqual(grouped, {
    focusAreas: ["Environment", "District Grant Partnerships"],
    chapters: ["Media", "Finance"],
    focusAreasText: "Environment, District Grant Partnerships",
    chaptersText: "Media, Finance",
  });
}); 

test("custom Other Focus Area stores the entered value instead of the literal option label", () => {
  const result = validateAndNormalizeBodFocusAreas([
    { category: BOD_FOCUS_AREA_CATEGORY_OTHER, value: "  District Grant Partnerships  " },
  ], { enabled: true });

  assert.deepEqual(result.focusAreas, [
    { category: BOD_FOCUS_AREA_CATEGORY_OTHER, value: "District Grant Partnerships" },
  ]);
  assert.equal(formatBodFocusAreasForReport(result.focusAreas), "District Grant Partnerships");
});

test("blank or literal Other custom Focus Areas are rejected", () => {
  assert.match(validateAndNormalizeBodFocusAreas([
    { category: BOD_FOCUS_AREA_CATEGORY_OTHER, value: " " },
  ], { enabled: true }).error, /required/i);
  assert.match(validateAndNormalizeBodFocusAreas([
    { category: BOD_FOCUS_AREA_CATEGORY_OTHER, value: "Other" },
  ], { enabled: true }).error, /instead of Other/i);
});

test("unsupported Focus Area categories and option labels are rejected", () => {
  assert.match(validateAndNormalizeBodFocusAreas([
    { category: "unknown", value: "Environment" },
  ], { enabled: true }).error, /unsupported category/i);
  assert.match(validateAndNormalizeBodFocusAreas([
    { category: BOD_FOCUS_AREA_CATEGORY_ROTARY, value: "Made up focus" },
  ], { enabled: true }).error, /unsupported option/i);
});

test("duplicate Focus Areas are deduplicated case-insensitively", () => {
  const result = validateAndNormalizeBodFocusAreas([
    { category: BOD_FOCUS_AREA_CATEGORY_OTHER, value: "District Grant Partnerships" },
    { category: BOD_FOCUS_AREA_CATEGORY_OTHER, value: " district grant partnerships " },
    { category: BOD_FOCUS_AREA_CATEGORY_ROTARY, value: "Environment" },
    { category: BOD_FOCUS_AREA_CATEGORY_ROTARY, value: "Environment" },
  ], { enabled: true });

  assert.deepEqual(result.focusAreas, [
    { category: BOD_FOCUS_AREA_CATEGORY_OTHER, value: "District Grant Partnerships" },
    { category: BOD_FOCUS_AREA_CATEGORY_ROTARY, value: "Environment" },
  ]);
});
