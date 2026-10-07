import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGlanceStats,
  buildTreasuryLedger,
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

test("glance stats summarise members, events, club attendance and the treasury ledger", () => {
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
  assert.deepEqual([glance.attendance.label, glance.attendance.rate, glance.attendance.hasData], ["64%", 64, true]);
  assert.equal(glance.attendance.line, "average across 3 club events · 20 members");
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
  assert.equal(glance.attendance.label, "—");
  assert.equal(glance.attendance.hasData, false);
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
