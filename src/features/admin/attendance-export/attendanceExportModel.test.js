import assert from "node:assert/strict";
import test from "node:test";
import {
  CLUB_EXPORT_INFO,
  attendanceExportMark,
  attendanceExportStatus,
  attendanceMonthKey,
  attendanceMonthLabel,
  attendanceMonthShort,
  buildMonthlyAttendanceExport,
  eventColumnLabel,
  eventsInMonths,
  listAttendanceMonths,
  positionShortLabel,
  createAttendanceExportReport,
  filterAttendanceEvents,
  parseAttendanceDate,
  selectFilteredAttendanceEvents,
  toggleAttendanceEventSelection,
} from "./attendanceExportModel.js";

const events = [
  { id: "e-1", name: "Club Assembly", date: "2026-01-10", endDate: "2026-01-10", avenue: ["GBM"], archived: false },
  { id: "e-2", name: "Service Project", date: "2026-02-20", avenue: ["CSD"], archived: false },
  { id: "e-3", name: "Archived Event", date: "2026-03-01", avenue: ["ISD"], archived: true },
];
const members = [
  { id: "m-1", name: "Member One", email: "hidden@example.com", role: "gbm", secret: "hidden", active: true },
  { id: "m-2", name: "Director Two", position: "Secretary", active: true },
];

test("attendance status preserves true, false, and canonical N/A semantics", () => {
  assert.equal(attendanceExportStatus(true), "Present");
  assert.equal(attendanceExportStatus(false), "Absent");
  assert.equal(attendanceExportStatus("NA"), "Not applicable");
  assert.equal(attendanceExportStatus(undefined), "Not applicable");
});

test("filters are inclusive and never expose archived events", () => {
  assert.deepEqual(filterAttendanceEvents(events, { search: "service", dateFrom: "2026-02-20", dateTo: "2026-02-20" }).map((event) => event.id), ["e-2"]);
  assert.deepEqual(filterAttendanceEvents(events, {}).map((event) => event.id), ["e-1", "e-2"]);
});

test("event selection persists across filter changes and clear operations", () => {
  let selected = toggleAttendanceEventSelection(new Set(), "e-1", true);
  selected = selectFilteredAttendanceEvents(selected, [events[1]]);
  assert.deepEqual([...selected].sort(), ["e-1", "e-2"]);
  selected = toggleAttendanceEventSelection(selected, "e-1", false);
  assert.deepEqual([...selected], ["e-2"]);
});

test("shared panel adapter exports only selected safe fields", () => {
  const report = createAttendanceExportReport("club", {
    members,
    events,
    attendance: { "m-1": { "e-1": true }, "m-2": { "e-1": false } },
    selectedEventIds: ["e-1", "e-1", "e-3"],
  });
  assert.equal(report.events.length, 1);
  assert.equal(report.rows.length, 2);
  assert.deepEqual(report.rows.map((row) => row.status), ["Present", "Absent"]);
  assert.equal(Object.hasOwn(report.members[0], "email"), false);
  assert.equal(Object.hasOwn(report.members[0], "secret"), false);
});

test("club export keeps prospect rows but excludes them from aggregate rows by default", () => {
  const report = createAttendanceExportReport("club", {
    members: [
      { id: "m-1", name: "Member One", role: "gbm", active: true },
      { id: "p-1", name: "Prospect One", role: "prospect", active: true },
    ],
    events: [events[0]],
    attendance: {
      "m-1": { "e-1": true },
      "p-1": { "e-1": false },
    },
    selectedEventIds: ["e-1"],
  });

  assert.equal(report.rows.length, 2);
  assert.equal(report.aggregateRows.length, 1);
  assert.deepEqual(report.aggregateRows.map((row) => row.memberName), ["Rtr. Member One"]);

  const included = createAttendanceExportReport("club", {
    members: [
      { id: "m-1", name: "Member One", role: "gbm", active: true },
      { id: "p-1", name: "Prospect One", role: "prospect", active: true },
    ],
    events: [events[0]],
    attendance: {
      "m-1": { "e-1": true },
      "p-1": { "e-1": false },
    },
    selectedEventIds: ["e-1"],
    includeProspectsInClubAttendance: true,
  });

  assert.equal(included.rows.length, 2);
  assert.equal(included.aggregateRows.length, 2);
});

test("non-club exports continue to count all rows", () => {
  const report = createAttendanceExportReport("district", {
    members: [
      { id: "m-1", name: "Member One", role: "gbm", active: true },
      { id: "p-1", name: "Prospect One", role: "prospect", active: true },
    ],
    events: [{ id: "x", name: "District Event", date: "2026-04-01", visibility: "internal" }],
    attendance: {},
    selectedEventIds: ["x"],
  });

  assert.equal(report.rows.length, 2);
  assert.equal(report.aggregateRows.length, 2);
});

test("export status checks participant attendance aliases", () => {
  const report = createAttendanceExportReport("club", {
    members: [
      { id: "uid-1", name: "Alias Member", role: "gbm", attendanceIds: ["member-doc-1", "uid-1"] },
    ],
    events: [events[0]],
    attendance: {
      "member-doc-1": { "e-1": true },
    },
    selectedEventIds: ["e-1"],
  });

  assert.equal(report.rows[0].status, "Present");
});

test("all real attendance panel adapters produce the same safe report shape", () => {
  for (const panelKey of ["club", "bod", "district"]) {
    const sourceEvent = panelKey === "bod"
      ? { id: "x", name: "BOD Meeting", date: "2026-04-01", kind: "bodMeeting" }
      : panelKey === "district"
        ? { id: "x", name: "District Event", date: "2026-04-01", visibility: "internal" }
        : { id: "x", name: "Club Event", date: "2026-04-01", avenue: ["GBM"] };
    const report = createAttendanceExportReport(panelKey, { members, events: [sourceEvent], attendance: {}, selectedEventIds: ["x"] });
    assert.equal(report.events.length, 1);
    assert.equal(report.rows.length, 2);
  }
});

test("date-only values remain local calendar dates", () => {
  const date = parseAttendanceDate("2026-01-01");
  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 0);
  assert.equal(date.getDate(), 1);
});

const monthEvents = [
  { id: "sep-2", name: "Service Drive", date: "2026-09-21", avenue: ["CSD"] },
  { id: "sep-1", name: "GBM", date: "2026-09-07", avenue: ["GBM"] },
  { id: "jul-1", name: "Installation", date: "2026-07-03", avenue: ["GBM"] },
  { id: "aug-1", name: "Fellowship", date: "2026-08-15", avenue: ["CSD"] },
  { id: "sep-x", name: "Archived Sep", date: "2026-09-10", archived: true },
  { id: "bad", name: "No Date", date: "" },
];

test("listAttendanceMonths returns newest month first with counts", () => {
  assert.deepEqual(listAttendanceMonths(monthEvents), [
    { key: "2026-09", label: "September 2026", shortLabel: "Sep 2026", eventCount: 2 },
    { key: "2026-08", label: "August 2026", shortLabel: "Aug 2026", eventCount: 1 },
    { key: "2026-07", label: "July 2026", shortLabel: "Jul 2026", eventCount: 1 },
  ]);
  assert.equal(attendanceMonthKey("2026-09-07"), "2026-09");
  assert.equal(attendanceMonthLabel("2026-09"), "September 2026");
  assert.equal(attendanceMonthShort("2026-09"), "Sep 2026");
});

test("eventsInMonths keeps non-archived events of the chosen months in date order", () => {
  assert.deepEqual(eventsInMonths(monthEvents, ["2026-09", "2026-07"]).map((event) => event.id), ["jul-1", "sep-1", "sep-2"]);
  assert.deepEqual(eventsInMonths(monthEvents, new Set(["2026-08"])).map((event) => event.id), ["aug-1"]);
  assert.equal(eventColumnLabel({ name: "GBM", date: "2026-09-07" }), "7 Sep 2026\nGBM");
});

test("attendance marks are P, A and N/A", () => {
  assert.equal(attendanceExportMark(true), "P");
  assert.equal(attendanceExportMark(false), "A");
  assert.equal(attendanceExportMark("NA"), "N/A");
  assert.equal(attendanceExportMark(undefined), "N/A");
});

test("position short labels follow the hierarchy and skip unknown keys", () => {
  assert.equal(positionShortLabel(["co-csd", "pdd"]), "PDD | Co-CSD");
  assert.equal(positionShortLabel(["immediate-past-president", "unknown"]), "IPP");
  assert.equal(positionShortLabel([]), "");
});

const clubMembers = [
  { id: "p-1", name: "Zara Prospect", role: "prospect", positionKeys: [], hierarchySortKey: 2000 },
  { id: "m-2", name: "Bea Member", role: "gbm", positionKeys: [], hierarchySortKey: 1000 },
  { id: "m-1", name: "Amy Member", role: "gbm", positionKeys: [], hierarchySortKey: 1000, attendanceIds: ["roster-amy"] },
  { id: "s-1", name: "Sam Secretary", role: "admin", positionKeys: ["secretary"], hierarchySortKey: 2 },
  { id: "pr-1", name: "Priya President", role: "president", positionKeys: ["president"], hierarchySortKey: 0 },
];
const clubAttendance = {
  "pr-1": { "sep-1": true, "sep-2": false },
  "s-1": { "sep-1": "NA" },
  "roster-amy": { "sep-1": true },
  "p-1": { "sep-1": true },
};
const bodSource = {
  members: [
    { id: "b-2", name: "Riya", role: "bod", positionKeys: ["saa"], hierarchySortKey: 32, position: "SAA" },
    { id: "b-1", name: "Prathamesh", role: "bod", positionKeys: ["co-csd", "pdd"], hierarchySortKey: 12 },
  ],
  events: [
    { id: "bm-2", name: "BOD Meeting 2", date: "2026-09-20" },
    { id: "bm-1", name: "BOD Meeting 1", date: "2026-09-05" },
    { id: "bm-x", name: "Archived BOD", date: "2026-09-06", archived: true },
    { id: "bm-aug", name: "BOD August", date: "2026-08-02" },
  ],
  attendance: { "b-1": { "bm-1": true, "bm-2": false } },
};

function monthlyReport(options = {}) {
  return buildMonthlyAttendanceExport({
    panelKey: "club",
    primary: { members: clubMembers, events: monthEvents, attendance: clubAttendance },
    bod: bodSource,
    monthKeys: ["2026-09"],
    selectedEventIds: ["sep-1", "sep-2"],
    ...options,
  });
}

test("monthly export keeps hierarchy order, drops prospects by default and resolves marks", () => {
  const report = monthlyReport();
  assert.equal(report.panelKey, "club");
  assert.deepEqual(report.info, CLUB_EXPORT_INFO);
  assert.equal(report.months.length, 1);
  const [section] = report.months[0].sections;
  assert.equal(report.months[0].sections.length, 1);
  assert.equal(section.headerLabel, "Name");
  assert.deepEqual(section.events.map((event) => event.label), ["7 Sep 2026\nGBM", "21 Sep 2026\nService Drive"]);
  assert.deepEqual(section.rows.map((row) => row.label), ["Rtr. Priya President", "Rtr. Sam Secretary", "Rtr. Amy Member", "Rtr. Bea Member"]);
  assert.deepEqual(section.rows.map((row) => row.marks), [["P", "A"], ["N/A", "N/A"], ["P", "N/A"], ["N/A", "N/A"]]);
});

test("prospects are included at the bottom when asked", () => {
  const rows = monthlyReport({ includeProspects: true }).months[0].sections[0].rows;
  assert.equal(rows.at(-1).label, "Zara Prospect");
  assert.deepEqual(rows.at(-1).marks, ["P", "N/A"]);
});

test("months are chronological and only months with selected events are exported", () => {
  const report = monthlyReport({ monthKeys: ["2026-09", "2026-07", "2026-08"], selectedEventIds: ["sep-1", "jul-1"] });
  assert.deepEqual(report.months.map((month) => month.key), ["2026-07", "2026-09"]);
  assert.deepEqual(report.months[1].sections[0].events.map((event) => event.id), ["sep-1"]);
});

test("BOD section appears only when included and lists all of the month's meetings", () => {
  const report = monthlyReport({ includeBod: true, selectedEventIds: ["sep-1"] });
  const bodSection = report.months[0].sections[1];
  assert.equal(bodSection.title, "BODs");
  assert.equal(bodSection.headerLabel, "Position | Name");
  assert.deepEqual(bodSection.events.map((event) => event.id), ["bm-1", "bm-2"]);
  assert.deepEqual(bodSection.rows.map((row) => row.label), ["PDD | Co-CSD – Rtr. Prathamesh", "SAA – Rtr. Riya"]);
  assert.deepEqual(bodSection.rows[0].marks, ["P", "A"]);
  assert.equal(monthlyReport({ includeBod: false }).months[0].sections.length, 1);
  assert.equal(monthlyReport({ includeBod: true, bod: null }).months[0].sections.length, 1);
});

test("BOD panel uses position labels for its primary rows", () => {
  const report = buildMonthlyAttendanceExport({
    panelKey: "bod",
    primary: bodSource,
    monthKeys: ["2026-09"],
    selectedEventIds: ["bm-1"],
  });
  assert.equal(report.months[0].sections[0].headerLabel, "Position | Name");
  assert.equal(report.months[0].sections[0].rows[0].label, "PDD | Co-CSD – Rtr. Prathamesh");
});
