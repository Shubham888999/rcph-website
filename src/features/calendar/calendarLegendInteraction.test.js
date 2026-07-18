import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const legendSource = readFileSync(new URL("./CalendarLegend.jsx", import.meta.url), "utf8");
const calendarCss = readFileSync(new URL("../../styles/components/calendar.css", import.meta.url), "utf8");

test("calendar legend shortforms toggle an accessible mobile label bubble", () => {
  assert.match(legendSource, /useState\(""\)/);
  assert.match(legendSource, /toggleAvenue/);
  assert.match(legendSource, /type="button"/);
  assert.match(legendSource, /aria-expanded=\{isActive\}/);
  assert.match(legendSource, /aria-describedby=\{isActive \? bubbleId : undefined\}/);
  assert.match(legendSource, /calendar-legend__bubble/);
  assert.match(legendSource, /role="status"/);

  assert.match(calendarCss, /@media \(max-width: 699px\)[\s\S]*\.calendar-legend ul[\s\S]*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(calendarCss, /\.calendar-legend__label[\s\S]*display: none;/);
  assert.match(calendarCss, /\.calendar-legend__bubble[\s\S]*border-radius: 0\.75rem;/);
});
