import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGlanceStats,
  buildTreasuryLedger,
  buildVisitAttendanceTree,
  finesHasNotes,
  formatVisitLedgerAmount,
  normalizeLetterheadExchanges,
  normalizeVisitDashboardData,
  parseOfficialDisplayName,
  summarizeLetterheadExchanges,
} from "./visitDashboardModel.js";

function txn(transactionId, date, type, amount, title = transactionId) {
  return { transactionId, date, type, amount, title, description: "" };
}

test("official display names split on the first pipe into name and role", () => {
  assert.deepEqual(parseOfficialDisplayName("Rtr. Asha Kulkarni | District Zonal Representative"), {
    name: "Rtr. Asha Kulkarni",
    role: "District Zonal Representative",
  });
  assert.deepEqual(parseOfficialDisplayName("PHF. DRR. Example"), { name: "PHF. DRR. Example", role: "" });
  assert.deepEqual(parseOfficialDisplayName("A | B | C"), { name: "A", role: "B | C" });
  assert.deepEqual(parseOfficialDisplayName(null), { name: "", role: "" });
});

test("official display lines keep the pipe and up to 160 characters through normalisation", () => {
  const long = `Rtr. ${"N".repeat(40)} | ${"Assistant District Zonal Representative ".repeat(2).trim()}`;
  assert.ok(long.length > 120 && long.length <= 160);
  const normalized = normalizeVisitDashboardData({
    visit: { visitType: "dzrVisit", officialDisplayNames: ["Rtr. Asha Kulkarni | District Zonal Representative", long] },
  }, "dzrVisit");
  assert.deepEqual(normalized.visit.officialDisplayNames, ["Rtr. Asha Kulkarni | District Zonal Representative", long]);
});

test("treasury ledger runs oldest first with a running balance, month groups and totals", () => {
  const ledger = buildTreasuryLedger([
    txn("t3", "2026-08-02", "expense", 500.5, "Banner"),
    txn("t1", "2026-07-10", "income", 1000, "Dues"),
    txn("t2", "2026-07-10", "expense", 0.1, "Bank fee"),
    txn("t4", "2026-08-02", "unknown", 99, "Unclassified"),
  ]);
  assert.deepEqual(ledger.groups.map((group) => [group.label, group.rows.map((row) => row.transactionId)]), [
    ["JUL 2026", ["t2", "t1"]],
    ["AUG 2026", ["t3", "t4"]],
  ]);
  assert.deepEqual(ledger.groups.flatMap((group) => group.rows.map((row) => [row.receipt, row.payment, row.balance])), [
    [null, 0.1, -0.1],
    [1000, null, 999.9],
    [null, 500.5, 499.4],
    [null, null, 499.4],
  ]);
  assert.deepEqual(ledger.totals, { receipts: 1000, payments: 500.6, closing: 499.4 });
  assert.equal(ledger.entryCount, 4);
  assert.deepEqual(buildTreasuryLedger([txn("s", "2026-09-26", "income", 1)]).groups[0].label, "SEP 2026");
  assert.deepEqual(buildTreasuryLedger(null), { groups: [], entryCount: 0, totals: { receipts: 0, payments: 0, closing: 0 } });
});

test("ledger amounts use Indian grouping and two decimals", () => {
  assert.equal(formatVisitLedgerAmount(98627.05), "98,627.05");
  assert.equal(formatVisitLedgerAmount(1234567), "12,34,567.00");
  assert.equal(formatVisitLedgerAmount(0), "0.00");
});

test("glance stats summarise members, events and the treasury ledger", () => {
  const data = normalizeVisitDashboardData({
    visit: { visitType: "dzrVisit" },
    stats: {
      totalMembers: 27,
      maleMembers: 12,
      femaleMembers: 15,
      otherGenderMembers: 0,
      maleFemaleRatio: "4:5",
      totalEvents: 9,
      avenueEventCounts: [
        { avenueCode: "CSD", avenueName: "Club Service", count: 4 },
        { avenueCode: "CMD", avenueName: "Community Service", count: 2 },
        { avenueCode: "GBM", avenueName: "General Body Meeting", count: 5 },
      ],
      treasuryNet: 123456,
    },
    attendance: {
      club: {
        summary: { totalEvents: 3, totalPeople: 20, averageAttendanceRate: 64 },
        columns: [{ eventId: "e1", title: "Event", date: "2026-07-01" }],
        rows: [],
      },
    },
    treasury: { rows: [txn("a", "2026-07-01", "income", 300), txn("b", "2026-07-02", "expense", 100)] },
  }, "dzrVisit");
  const glance = buildGlanceStats(data);
  assert.equal(glance.members.total, 27);
  assert.equal(glance.members.line, "12 male · 15 female · ratio 4:5");
  assert.deepEqual(glance.members.segments.map((segment) => segment.key), ["male", "female"], "no other segment when zero");
  assert.equal(glance.events.total, 9);
  assert.deepEqual(glance.events.bars.map((bar) => [bar.avenueCode, bar.count, bar.share]), [["CSD", 4, 100], ["CMD", 2, 50]]);
  assert.equal(glance.events.line, "across 2 avenues · most active: Club Service");
  assert.equal("attendance" in glance, false, "club attendance moved to the attendance tree");
  assert.equal(glance.treasury.net, 200, "net comes from the ledger so it equals the closing balance");
  assert.equal(glance.treasury.net, buildTreasuryLedger(data.treasury.rows).totals.closing);
  assert.equal(glance.treasury.negative, false);
  assert.equal(glance.treasury.line, "In ₹300 · Out ₹100 · 2 entries");
});

test("glance stats handle empty data and singulars", () => {
  const glance = buildGlanceStats(normalizeVisitDashboardData({
    stats: { otherGenderMembers: 1, maleMembers: 1 },
    treasury: { rows: [txn("a", "2026-07-01", "expense", 10)] },
  }, "dzrVisit"));
  assert.deepEqual(glance.members.segments.map((segment) => segment.key), ["male", "female", "other"]);
  assert.equal(glance.events.bars.length, 0);
  assert.equal(glance.treasury.negative, true);
  assert.match(glance.treasury.line, /1 entry$/);
});

test("letterhead exchanges normalise safely and summarise distinct clubs", () => {
  const rows = normalizeLetterheadExchanges([
    {
      exchangeId: "lhx-1",
      exchangeDate: "2026-08-14",
      externalParticipants: [{ clubName: "Rotaract Club of Pune", rotaractorName: "Asha", position: "President", rotaractDistrictId: "secret" }],
      rcphRepresentatives: ["Rtr. Yashali Shirodkar"],
      associatedEvent: { name: "Installation", date: "2026-08-14" },
      imageCount: 3,
      uid: "secret-uid",
    },
    { exchangeId: "lhx-2", exchangeDate: "2026-09-01", externalParticipants: [{ clubName: "ROTARACT CLUB OF PUNE", rotaractorName: "Dev" }], imageCount: -2 },
    { exchangeId: "bad/id", exchangeDate: "2026-09-01" },
    { exchangeId: "lhx-3", exchangeDate: "not-a-date" },
    { exchangeId: "lhx-1", exchangeDate: "2026-08-14" },
  ]);
  assert.deepEqual(rows.map((row) => row.exchangeId), ["lhx-2", "lhx-1"], "newest first, invalid and duplicate rows dropped");
  assert.deepEqual(rows[1].externalParticipants, [{ clubName: "Rotaract Club of Pune", rotaractorName: "Asha", position: "President" }]);
  assert.equal(rows[0].imageCount, 0);
  assert.equal(rows[0].associatedEvent, null);
  assert.equal(JSON.stringify(rows).includes("secret"), false);
  assert.deepEqual(summarizeLetterheadExchanges(rows), { count: 2, clubCount: 1 });
  assert.deepEqual(summarizeLetterheadExchanges(rows, { count: 140, clubCount: 9 }), { count: 140, clubCount: 9 });
});

test("letterhead section is absent for an old backend and empty-but-present for a new one", () => {
  assert.equal(normalizeVisitDashboardData({}, "dzrVisit").letterhead, null);
  assert.deepEqual(normalizeVisitDashboardData({ letterheadExchanges: [], letterheadExchangeSummary: { count: 0, clubCount: 0 } }, "dzrVisit").letterhead, {
    rows: [],
    summary: { count: 0, clubCount: 0 },
  });
});

test("fines notes column appears only when some note has text", () => {
  assert.equal(finesHasNotes([{ notes: "" }, { notes: "  " }, {}]), false);
  assert.equal(finesHasNotes([{ notes: "" }, { notes: "Arrived late" }]), true);
  assert.equal(finesHasNotes(undefined), false);
});

function attendanceView(columns, rows) {
  return {
    columns,
    rows: rows.map(([personId, cells]) => ({ personId, name: personId, cells })),
  };
}

test("attendance tree pools marks: GBM vs club events, late counts, excused and unknown ignored", () => {
  const data = normalizeVisitDashboardData({
    attendance: {
      club: attendanceView(
        [
          { eventId: "g1", title: "GBM 1", avenueCode: "GBM" },
          { eventId: "g2", title: "GBM 2", avenue: ["GBM"] },
          { eventId: "e1", title: "Blood drive", avenueCodes: ["CMD"] },
          { eventId: "e2", title: "Joint event", avenueCodes: ["CSD", "ISD"] },
        ],
        [
          ["a", { g1: "present", g2: "late", e1: "absent", e2: "present" }],
          ["b", { g1: "absent", g2: "excused", e1: "present", e2: "unknown" }],
          ["c", { g1: "late", e1: "excused" }],
        ],
      ),
      bod: attendanceView(
        [{ eventId: "b1", title: "BOD 1" }, { eventId: "b2", title: "BOD 2" }],
        [["x", { b1: "present", b2: "absent" }], ["y", { b1: "late", b2: "present" }]],
      ),
      district: attendanceView(
        [{ eventId: "d1", title: "District" }],
        [["a", { d1: "absent" }], ["b", { d1: "absent" }]],
      ),
    },
  }, "dzrVisit");
  const tree = buildVisitAttendanceTree(data.attendance);
  assert.deepEqual(tree.gbm, { attended: 3, eligible: 4, rate: 75, label: "75%" });
  assert.deepEqual(tree.events, { attended: 2, eligible: 3, rate: 67, label: "67%" });
  assert.deepEqual(tree.club, { attended: 5, eligible: 7, rate: 71, label: "71%" }, "pooled marks, not an average of 75 and 67");
  assert.deepEqual(tree.bod, { attended: 3, eligible: 4, rate: 75, label: "75%" });
  assert.deepEqual(tree.overall, { attended: 8, eligible: 11, rate: 73, label: "73%" }, "district marks are not included");
});

test("attendance tree club figure matches the pooled club summary rule", () => {
  const club = attendanceView(
    [{ eventId: "g1", title: "GBM", avenueCode: "GBM" }, { eventId: "e1", title: "Event", avenueCodes: ["PDD"] }],
    [["a", { g1: "present", e1: "absent" }], ["b", { g1: "present", e1: "late" }], ["c", { g1: "absent", e1: "absent" }]],
  );
  const data = normalizeVisitDashboardData({ attendance: { club } }, "dzrVisit");
  assert.equal(buildVisitAttendanceTree(data.attendance).club.rate, data.attendance.club.summary.averageAttendanceRate);
});

test("attendance tree shows a dash and null rate when nothing is eligible", () => {
  const empty = buildVisitAttendanceTree(normalizeVisitDashboardData(null, "dzrVisit").attendance);
  for (const key of ["overall", "club", "bod", "gbm", "events"]) {
    assert.deepEqual(empty[key], { attended: 0, eligible: 0, rate: null, label: "—" }, key);
  }
  const onlyExcused = buildVisitAttendanceTree(normalizeVisitDashboardData({
    attendance: { bod: attendanceView([{ eventId: "b1", title: "BOD" }], [["x", { b1: "excused" }]]) },
  }, "dzrVisit").attendance);
  assert.equal(onlyExcused.bod.label, "—");
  assert.equal(buildVisitAttendanceTree(undefined).overall.rate, null);
});
