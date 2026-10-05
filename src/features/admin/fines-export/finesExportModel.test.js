import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFineRows,
  buildFinesExport,
  fineMonthKey,
  fineReasonLabel,
  finesInMonths,
  listFineMonths,
} from "./finesExportModel.js";

const fines = [
  { id: "f-1", memberId: "m-1", memberName: "Asha Member", reason: "late", eventName: "GBM", date: "2026-08-12", amount: 50 },
  { id: "f-2", memberId: "m-2", memberName: "Ravi Kumar", reason: "missing_badge", eventName: "Drive", date: "2026-08-02", amount: "20" },
  { id: "f-3", memberId: "m-1", memberName: "Asha Member", reason: "missing_badge", date: "2026-07-20", amount: 20 },
  { id: "f-4", memberId: "m-3", memberName: "", reason: "phone_in_meeting", eventName: "BOD", date: "2026-08-12", amount: 100 },
  { id: "f-bad", memberId: "m-2", memberName: "Ravi Kumar", reason: "late", date: "2026-13-01", amount: 30 },
  { id: "f-none", memberId: "m-2", memberName: "Ravi Kumar", reason: "late", amount: 30 },
];

test("reason labels map known reasons and title-case the rest", () => {
  assert.equal(fineReasonLabel("missing_badge"), "Missing badge");
  assert.equal(fineReasonLabel("late"), "Late to event/meeting");
  assert.equal(fineReasonLabel("phone_in_meeting"), "Phone In Meeting");
  assert.equal(fineReasonLabel("dress code"), "Dress Code");
  assert.equal(fineReasonLabel(undefined), "");
});

test("month key comes from fine.date and invalid dates are skipped", () => {
  assert.equal(fineMonthKey({ date: "2026-09-04" }), "2026-09");
  assert.equal(fineMonthKey({ date: "2026-13-01" }), "");
  assert.equal(fineMonthKey({}), "");
  assert.deepEqual(finesInMonths(fines, ["2026-08", "2026-13"]).map((fine) => fine.id), ["f-1", "f-2", "f-4"]);
  assert.deepEqual(listFineMonths(fines), [
    { key: "2026-08", label: "August 2026", shortLabel: "Aug 2026", fineCount: 3 },
    { key: "2026-07", label: "July 2026", shortLabel: "Jul 2026", fineCount: 1 },
  ]);
});

test("fine rows are shaped and sorted by date, then name", () => {
  const rows = buildFineRows(fines);
  assert.deepEqual(rows.map((row) => row.id), ["f-3", "f-2", "f-1", "f-4"]);
  assert.deepEqual(rows[1], { id: "f-2", date: "2026-08-02", name: "Rtr. Ravi Kumar", reason: "Missing badge", event: "Drive", amount: 20 });
  assert.equal(rows[0].event, "");
  assert.equal(rows[3].name, "Rtr. m-3");
});

test("one selected month has no all-months summary", () => {
  const report = buildFinesExport({ fines, monthKeys: ["2026-08"] });
  assert.deepEqual(report.info, { clubId: "213166", zone: "4" });
  assert.equal(report.months.length, 1);
  assert.deepEqual(report.months[0].rows.map((row) => row.id), ["f-2", "f-1", "f-4"]);
  assert.equal(report.months[0].total, 170);
  assert.equal(report.allMonths, null);
});

test("several months are ordered oldest first and an empty month still appears", () => {
  const report = buildFinesExport({ fines, monthKeys: ["2026-09", "2026-07", "2026-08", "bad"] });
  assert.deepEqual(report.months.map((month) => month.key), ["2026-07", "2026-08", "2026-09"]);
  assert.deepEqual(report.months[2], { key: "2026-09", label: "September 2026", shortLabel: "Sep 2026", rows: [], total: 0 });
  assert.equal(report.allMonths.rows.length, 4);
  assert.equal(report.allMonths.total, 190);
});

test("byMember totals sort by total, highest first, then name", () => {
  const extra = [...fines, { id: "f-5", memberId: "m-2", memberName: "Ravi Kumar", reason: "late", date: "2026-07-01", amount: 50 }];
  const { allMonths } = buildFinesExport({ fines: extra, monthKeys: ["2026-07", "2026-08"] });
  assert.deepEqual(allMonths.byMember, [
    { name: "Rtr. m-3", count: 1, total: 100 },
    { name: "Rtr. Asha Member", count: 2, total: 70 },
    { name: "Rtr. Ravi Kumar", count: 2, total: 70 },
  ]);
});
