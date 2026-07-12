import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./AttendanceModules.jsx", import.meta.url), "utf8");

test("Club and District attendance use combined members plus approved users", () => {
  assert.match(source, /buildAttendanceParticipants/);
  assert.match(source, /members: data\.members,[\s\S]*users: data\.users,[\s\S]*attendance: data\.attendance/);
  assert.match(source, /members: data\.members,[\s\S]*users: data\.users,[\s\S]*attendance: data\.districtAttendance/);
});

test("BOD attendance remains limited to the director roster", () => {
  const bodModule = source.slice(source.indexOf("export function BodOperationsModule"), source.indexOf("export function DistrictModule"));
  assert.match(bodModule, /AttendanceGrid members=\{data\.bodMembers\}/);
  assert.doesNotMatch(bodModule, /buildAttendanceParticipants/);
});

test("prospect progress recalculation stays scoped to Club Attendance", () => {
  assert.match(source, /if \(collectionName !== "attendance"\) return/);
  assert.match(source, /adminCalls\.recalcProspect\(id\)/);
});

test("attendance rows show Prospect and GBM badges", () => {
  assert.match(source, /role === "prospect" \? "Prospect" : role === "gbm" \? "GBM" : ""/);
  assert.match(source, /attendance-member-role/);
});

test(
  "each event header renders a shared per-event attendance summary",
  () => {
    assert.match(
      source,
      /buildEventAttendanceSummary/,
    );

    assert.match(
      source,
      /const eventSummaries = useMemo/,
    );

    assert.match(
      source,
      /attendance-event-summary/,
    );

    assert.match(
      source,
      /summary\.presentCount/,
    );

    assert.match(
      source,
      /summary\.eligibleCount/,
    );

    assert.match(
      source,
      /summary\.percentage\.toFixed\(1\)/,
    );
  },
);