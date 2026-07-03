import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const panel = readFileSync(new URL("./AttendanceExportPanel.jsx", import.meta.url), "utf8");
const attendanceModules = readFileSync(new URL("../modules/AttendanceModules.jsx", import.meta.url), "utf8");

test("export UI provides required filters, persistent selection controls, and confirmation", () => {
  for (const copy of ["Search event", "Date from", "Date to", "Select all filtered", "Clear selection", "Download Excel"]) assert.match(panel, new RegExp(copy));
  assert.match(panel, /selectedIds/);
  assert.match(panel, /disabled=\{!selectedEvents\.length \|\| exporting\}/);
});

test("all canonical attendance panels use the shared exporter", () => {
  for (const panelKey of ["club", "bod", "district"]) assert.match(attendanceModules, new RegExp(`AttendanceExportPanel panelKey="${panelKey}"`));
});
