import test from "node:test";
import assert from "node:assert/strict";
import { ATTENDANCE_MARK_ASSETS, resolveAttendanceMark } from "./attendanceMarkModel.js";

test("present aliases resolve to the check image", () => {
  for (const value of ["P", "PRESENT", "PRESENTED", true]) {
    assert.deepEqual(resolveAttendanceMark(value), {
      kind: "present",
      label: "Present",
      imageSrc: ATTENDANCE_MARK_ASSETS.present,
    });
  }
});

test("absent aliases resolve to the cross image", () => {
  for (const value of ["A", "ABSENT", false]) {
    assert.deepEqual(resolveAttendanceMark(value), {
      kind: "absent",
      label: "Absent",
      imageSrc: ATTENDANCE_MARK_ASSETS.absent,
    });
  }
});

test("not-applicable aliases and missing values resolve to the NA image", () => {
  for (const value of ["NA", "N/A", "NOT APPLICABLE", "NOT_APPLICABLE", "", null, undefined]) {
    assert.deepEqual(resolveAttendanceMark(value), {
      kind: "na",
      label: "Not applicable",
      imageSrc: ATTENDANCE_MARK_ASSETS.na,
    });
  }
});

test("unknown values remain readable text and receive no image", () => {
  assert.deepEqual(resolveAttendanceMark("Excused"), {
    kind: "unknown",
    label: "Excused",
    imageSrc: null,
  });
});
