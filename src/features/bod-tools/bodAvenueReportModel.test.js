import assert from "node:assert/strict";
import test from "node:test";
import {
  BOD_AVENUE_REPORT_DEFAULT_APPEARANCE,
  BOD_AVENUE_REPORT_LIMIT,
  buildBodAvenueReportModel,
  createBodAvenueSelection,
  filterBodAvenueReportEvents,
  filterBodAvenueReportMeetings,
  formatBodReportMonth,
  formatBodReportPeriod,
  getBodAvenueReportFilename,
  getBodAvenueReportMonthOptions,
  normalizeBodAvenueDirectors,
  normalizeBodReportAppearance,
  normalizeBodReportAvenueCodes,
  normalizeBodReportMonths,
  toggleBodAvenueEvent,
} from "./bodAvenueReportModel.js";

const event = (id, overrides = {}) => ({
  id,
  name: `Event ${id}`,
  startDate: "2026-07-01",
  endDate: "2026-07-01",
  recordKind: "clubEvent",
  isActive: true,
  archived: false,
  avenues: ["CMD"],
  rcphRole: "host",
  hostClub: "RCPH",
  collaborators: [],
  collaboratorsKnown: true,
  description: "Description",
  avenueDescriptions: {},
  ...overrides,
});

const meeting = (id, overrides = {}) => ({
  id,
  name: `Meeting ${id}`,
  date: "2026-07-12",
  recordKind: "bodMeeting",
  type: "bodMeeting",
  isActive: true,
  archived: false,
  description: "",
  desc: "Meeting description",
  ...overrides,
});

test("months and avenues normalize into deterministic canonical order", () => {
  assert.deepEqual(normalizeBodReportMonths(["2026-09", "bad", "2026-07", "2026-07"]), ["2026-07", "2026-09"]);
  assert.deepEqual(normalizeBodReportAvenueCodes(["PDD", "cmd", "NOPE", "CMD"]), ["CMD", "PDD"]);
});

test("multi-month and multi-avenue filtering deduplicates canonical events and preserves sorting", () => {
  const rows = filterBodAvenueReportEvents([
    event("aug-pdd", { startDate: "2026-08-01", avenues: ["PDD"] }),
    event("multi", { startDate: "2026-07-31", avenues: ["ISD", "CMD", "PDD"] }),
    event("multi", { startDate: "2026-07-31", avenues: ["CMD"] }),
    event("next", { startDate: "2026-09-01", avenues: ["CMD"] }),
    event("wrong", { startDate: "2026-07-01", avenues: ["ISD"] }),
  ], { selectedMonths: ["2026-08", "2026-07"], selectedAvenueCodes: ["PDD", "CMD"] });
  assert.deepEqual(rows.map((row) => row.id), ["multi", "aug-pdd"]);
});

test("reports exclude archived, deleted-like, malformed, BOD meeting, district, and no-avenue records", () => {
  const rows = filterBodAvenueReportEvents([
    event("good"),
    event("archived", { archived: true, isActive: false }),
    event("inactive", { isActive: false }),
    event("meeting", { recordKind: "bodMeeting" }),
    event("district", { recordKind: "districtEvent" }),
    event("malformed", { startDate: "July 2" }),
    event("none", { avenues: [] }),
  ], { month: "2026-07", avenueCode: "CMD" });
  assert.deepEqual(rows.map((row) => row.id), ["good"]);
  assert.deepEqual(filterBodAvenueReportEvents([event("x")], { month: "2026-13", avenueCode: "CMD" }), []);
});

test("BOD meeting filtering uses selected months and stays separate from avenue event filtering", () => {
  const rows = filterBodAvenueReportMeetings([
    meeting("aug", { date: "2026-08-03" }),
    meeting("july", { date: "2026-07-14" }),
    meeting("duplicate", { date: "2026-07-12" }),
    meeting("duplicate", { date: "2026-07-13" }),
    event("club", { startDate: "2026-07-04" }),
    meeting("archived", { archived: true }),
    meeting("inactive", { isActive: false }),
    meeting("malformed", { date: "July 14" }),
  ], { selectedMonths: ["2026-07", "2026-08"] });
  assert.deepEqual(rows.map((row) => row.id), ["duplicate", "july", "aug"]);
  assert.deepEqual(filterBodAvenueReportEvents([meeting("only")], { month: "2026-07", avenueCode: "CMD" }), []);
});

test("month options use reportable event data with a current-month fallback", () => {
  const options = getBodAvenueReportMonthOptions([
    event("aug", { startDate: "2026-08-03" }),
    meeting("sep", { date: "2026-09-03" }),
    event("bad", { startDate: "2026-09-03", archived: true, isActive: false }),
  ], "2026-07");
  assert.deepEqual(options, [
    { value: "2026-07", label: "July 2026" },
    { value: "2026-08", label: "August 2026" },
    { value: "2026-09", label: "September 2026" },
  ]);
});

test("director normalization validates the avenue and deduplicates name/title pairs", () => {
  const payload = { ok: true, avenueCode: "CMD", directors: [
    { name: " Member A ", positionTitle: "Community Service Director" },
    { name: "member a", positionTitle: "Community Service Director" },
    { name: "Member B", positionTitle: "Joint Community Service Director" },
  ] };
  assert.equal(normalizeBodAvenueDirectors(payload, "cmd").length, 2);
  assert.deepEqual(normalizeBodAvenueDirectors(payload, "ISD"), []);
  assert.deepEqual(normalizeBodAvenueDirectors({ ok: true, avenueCode: "CMD", directors: [] }, "CMD"), []);
});

test("selection starts with every match and supports deselect, select all, and clear", () => {
  const matches = [event("a"), event("b")];
  const selected = createBodAvenueSelection(matches);
  assert.deepEqual([...selected], ["a", "b"]);
  assert.deepEqual([...toggleBodAvenueEvent(selected, "a", false)], ["b"]);
  assert.deepEqual([...createBodAvenueSelection(matches)], ["a", "b"]);
  assert.equal(createBodAvenueSelection([]).size, 0);
});

test("single month and avenue remain compatible with the Phase 1 report shape", () => {
  const source = event("safe", { secret: "hidden", collaborators: [{ name: "Club A" }] });
  const report = buildBodAvenueReportModel({
    month: "2026-07",
    avenueCode: "CMD",
    events: [source, event("excluded")],
    selectedEventIds: ["safe"],
    directors: [{ name: "Director A", positionTitle: "Community Service Director", uid: "private" }],
    generatedAt: "2026-07-03T12:00:00.000Z",
  });
  assert.equal(report.monthLabel, "July 2026");
  assert.equal(report.periodLabel, "July 2026");
  assert.equal(report.avenueLabel, "Community Service Avenue");
  assert.equal(report.directorText, "Director A (Community Service Director)");
  assert.deepEqual(report.directorLines, ["Director A (Community Service Director)"]);
  assert.equal(report.eventCount, 1);
  assert.equal(report.groupCount, 1);
  assert.equal(report.isCombined, false);
  assert.equal(report.events[0].collaborators, "Club A");
  assert.equal(JSON.stringify(report).includes("hidden"), false);
  assert.equal(JSON.stringify(report).includes("private"), false);
  assert.equal(Object.hasOwn(report.events[0], "id"), false);
});

test("missing report finance defaults event, month, and grand totals to zero", () => {
  const report = buildBodAvenueReportModel({
    month: "2026-07",
    avenueCode: "CMD",
    events: [event("plain")],
    selectedEventIds: ["plain"],
  });
  assert.deepEqual(report.events[0].financeEntries, []);
  assert.equal(report.events[0].expenseTotal, 0);
  assert.equal(report.events[0].incomeTotal, 0);
  assert.equal(report.monthExpenseTotal, 0);
  assert.equal(report.monthIncomeTotal, 0);
  assert.deepEqual(report.monthTotals.map((month) => [month.month, month.monthExpenseTotal, month.monthIncomeTotal]), [["2026-07", 0, 0]]);
  assert.equal(report.grandExpenseTotal, 0);
  assert.equal(report.grandIncomeTotal, 0);
  assert.equal(report.groups[0].monthExpenseTotal, 0);
});

test("expense entries produce event expense totals", () => {
  const report = buildBodAvenueReportModel({
    month: "2026-07",
    avenueCode: "CMD",
    events: [event("expense", {
      reportFinance: {
        hasFinance: true,
        entries: [
          { type: "expense", amount: "100.255", description: "Venue" },
          { type: "expense", amount: 25, description: "Materials", ignored: true },
        ],
      },
    })],
    selectedEventIds: ["expense"],
  });
  assert.deepEqual(report.events[0].financeEntries, [
    { type: "expense", amount: 100.26, description: "Venue" },
    { type: "expense", amount: 25, description: "Materials" },
  ]);
  assert.equal(report.events[0].expenseTotal, 125.26);
  assert.equal(report.grandExpenseTotal, 125.26);
});

test("income entries stay separate and do not affect expense totals", () => {
  const report = buildBodAvenueReportModel({
    month: "2026-07",
    avenueCode: "CMD",
    events: [event("income", {
      reportFinance: {
        hasFinance: true,
        entries: [{ type: "income", amount: 500, description: "Ticket collection" }],
      },
    })],
    selectedEventIds: ["income"],
  });
  assert.equal(report.events[0].expenseTotal, 0);
  assert.equal(report.events[0].incomeTotal, 500);
  assert.equal(report.grandExpenseTotal, 0);
  assert.equal(report.grandIncomeTotal, 500);
});

test("mixed income and expense entries calculate separate event totals", () => {
  const report = buildBodAvenueReportModel({
    month: "2026-07",
    avenueCode: "CMD",
    events: [event("mixed", {
      reportFinance: {
        hasFinance: true,
        entries: [
          { type: "expense", amount: 100, description: "Hall" },
          { type: "income", amount: 240, description: "Registrations" },
          { type: "expense", amount: 50.5, description: "Snacks" },
        ],
      },
    })],
    selectedEventIds: ["mixed"],
  });
  assert.equal(report.events[0].expenseTotal, 150.5);
  assert.equal(report.events[0].incomeTotal, 240);
  assert.equal(report.monthTotals[0].monthExpenseTotal, 150.5);
  assert.equal(report.monthTotals[0].monthIncomeTotal, 240);
});

test("multi-month reports calculate per-month and grand finance totals from selected events", () => {
  const report = buildBodAvenueReportModel({
    selectedMonths: ["2026-08", "2026-07"],
    selectedAvenueCodes: ["CMD"],
    events: [
      event("july", { startDate: "2026-07-04", reportFinance: { hasFinance: true, entries: [{ type: "expense", amount: 10, description: "July expense" }] } }),
      event("august", { startDate: "2026-08-05", reportFinance: { hasFinance: true, entries: [{ type: "expense", amount: 25.5, description: "August expense" }, { type: "income", amount: 300, description: "August income" }] } }),
      event("unselected", { startDate: "2026-08-06", reportFinance: { hasFinance: true, entries: [{ type: "expense", amount: 999, description: "Not selected" }] } }),
    ],
    selectedEventIds: ["july", "august"],
  });
  assert.deepEqual(report.monthTotals.map((month) => [month.month, month.monthExpenseTotal, month.monthIncomeTotal]), [
    ["2026-07", 10, 0],
    ["2026-08", 25.5, 300],
  ]);
  assert.equal(report.monthExpenseTotal, 10);
  assert.equal(report.grandExpenseTotal, 35.5);
  assert.equal(report.grandIncomeTotal, 300);
  assert.deepEqual(report.groups.map((group) => [group.month, group.monthExpenseTotal]), [["2026-07", 10], ["2026-08", 25.5]]);
});

test("director lines keep one normalized director per display line", () => {
  const report = buildBodAvenueReportModel({
    month: "2026-07",
    avenueCode: "CMD",
    events: [event("directors")],
    selectedEventIds: ["directors"],
    directors: [
      { name: "Director B", positionTitle: "Joint Community Service Director" },
      { name: "Director A", positionTitle: "Community Service Director" },
    ],
  });
  assert.deepEqual(report.directorLines, [
    "Director A (Community Service Director)",
    "Director B (Joint Community Service Director)",
  ]);
  assert.equal(report.directorText, report.directorLines.join(", "));
});

test("combined reports group by avenue then month and count unique events once", () => {
  const report = buildBodAvenueReportModel({
    selectedMonths: ["2026-08", "2026-07"],
    selectedAvenueCodes: ["PDD", "CMD"],
    events: [
      event("multi", { startDate: "2026-07-02", avenues: ["CMD", "PDD"] }),
      event("cmd-aug", { startDate: "2026-08-01", avenues: ["CMD"] }),
      event("pdd-aug", { startDate: "2026-08-02", avenues: ["PDD"] }),
    ],
    selectedEventIds: ["multi", "cmd-aug", "pdd-aug"],
    directorsByAvenue: {
      CMD: [{ name: "Director C", positionTitle: "Community Service Director" }],
      PDD: [{ name: "Director P", positionTitle: "Professional Development Director" }],
    },
    generatedAt: "2026-07-03T12:00:00.000Z",
  });
  assert.equal(report.eventCount, 3);
  assert.equal(report.groupCount, 4);
  assert.equal(report.directorText, "Multiple avenue directors");
  assert.deepEqual(report.selectedAvenueCodes, ["CMD", "PDD"]);
  assert.deepEqual(report.groups.map((group) => `${group.avenueCode}:${group.month}`), ["CMD:2026-07", "CMD:2026-08", "PDD:2026-07", "PDD:2026-08"]);
  assert.deepEqual(report.groups.filter((group) => group.events.some((row) => row.name === "Event multi")).map((group) => group.avenueCode), ["CMD", "PDD"]);
  assert.equal(report.groups[0].directorText, "Director C (Community Service Director)");
  assert.deepEqual(report.avenueGroups.map((group) => `${group.avenueCode}:${group.months.map((month) => month.month).join("|")}`), ["CMD:2026-07|2026-08", "PDD:2026-07|2026-08"]);
  assert.deepEqual(report.avenueGroups[0].directorLines, ["Director C (Community Service Director)"]);
  assert.equal(report.avenueGroups[0].months[0].monthExpenseTotal, 0);
});

test("BOD meetings are excluded from reports unless explicitly included", () => {
  const report = buildBodAvenueReportModel({
    month: "2026-07",
    avenueCode: "CMD",
    events: [event("club"), meeting("bod", { date: "2026-07-10" })],
    selectedEventIds: ["club", "bod"],
  });
  assert.equal(report.eventCount, 1);
  assert.equal(report.bodMeetingCount, 0);
  assert.deepEqual(report.meetingGroups, []);

  const withMeetings = buildBodAvenueReportModel({
    month: "2026-07",
    avenueCode: "CMD",
    includeBodMeetings: true,
    events: [event("club"), meeting("bod", { date: "2026-07-10" })],
    selectedEventIds: ["club", "bod"],
  });
  assert.equal(withMeetings.eventCount, 2);
  assert.equal(withMeetings.bodMeetingCount, 1);
  assert.equal(withMeetings.avenueGroups.at(-1).avenueLabel, "BOD Meetings");
});

test("BOD meeting-only reports do not require a normal avenue", () => {
  const report = buildBodAvenueReportModel({
    selectedMonths: ["2026-07"],
    selectedAvenueCodes: [],
    includeBodMeetings: true,
    events: [meeting("only", { date: "2026-07-19", desc: "Budget review notes" })],
    selectedEventIds: ["only"],
    generatedAt: "2026-07-20T12:00:00.000Z",
  });
  assert.equal(report.title, "BOD Meetings Report");
  assert.equal(report.avenuesLabel, "BOD Meetings");
  assert.equal(report.directorText, "Not available");
  assert.equal(report.eventCount, 1);
  assert.equal(report.bodMeetingCount, 1);
  assert.equal(report.groupCount, 1);
  assert.equal(report.events[0].sectionType, "bodMeeting");
  assert.equal(report.events[0].date, "2026-07-19");
  assert.equal(report.events[0].description, "Budget review notes");
  assert.deepEqual(report.meetingGroups.map((group) => `${group.avenueLabel}:${group.month}`), ["BOD Meetings:2026-07"]);
  assert.deepEqual(report.avenueGroups.map((group) => group.avenueLabel), ["BOD Meetings"]);
});

test("BOD meetings add separate deterministic groups after normal avenue groups", () => {
  const report = buildBodAvenueReportModel({
    selectedMonths: ["2026-08", "2026-07"],
    selectedAvenueCodes: ["CMD"],
    includeBodMeetings: true,
    events: [
      event("july-club", { startDate: "2026-07-04", reportFinance: { hasFinance: true, entries: [{ type: "expense", amount: 10, description: "Club expense" }] } }),
      meeting("july-bod", { date: "2026-07-10" }),
      meeting("aug-bod", {
        date: "2026-08-02",
        reportFinance: { hasFinance: true, entries: [{ type: "expense", amount: 40, description: "Meeting expense" }, { type: "income", amount: 900, description: "Ignored income" }] },
      }),
    ],
    selectedEventIds: ["july-club", "july-bod", "aug-bod"],
  });
  assert.equal(report.title, "BOD Monthly Report");
  assert.equal(report.avenuesLabel, "Community Service Avenue + BOD Meetings");
  assert.equal(report.eventCount, 3);
  assert.equal(report.grandExpenseTotal, 50);
  assert.equal(report.grandIncomeTotal, 900);
  assert.deepEqual(report.monthTotals.map((month) => [month.month, month.monthExpenseTotal, month.monthIncomeTotal]), [
    ["2026-07", 10, 0],
    ["2026-08", 40, 900],
  ]);
  assert.deepEqual(report.groups.map((group) => `${group.avenueCode}:${group.month}`), ["CMD:2026-07"]);
  assert.deepEqual(report.meetingGroups.map((group) => `${group.avenueLabel}:${group.month}:${group.monthExpenseTotal}`), ["BOD Meetings:2026-07:0", "BOD Meetings:2026-08:40"]);
  assert.deepEqual(report.avenueGroups.map((group) => group.avenueLabel), ["Community Service Avenue", "BOD Meetings"]);
  assert.equal(report.avenueGroups[0].months[0].events.some((row) => row.name === "Meeting july-bod"), false);
});

test("multi-avenue canonical events use avenue-specific descriptions while counting once", () => {
  const report = buildBodAvenueReportModel({
    selectedMonths: ["2026-07"],
    selectedAvenueCodes: ["PDD", "CMD"],
    events: [
      event("multi", {
        avenues: ["CMD", "PDD"],
        description: "Public summary",
        avenueDescriptions: {
          CMD: "Community-specific report narrative",
          PDD: "Professional-specific report narrative",
        },
      }),
    ],
    selectedEventIds: ["multi"],
  });
  assert.equal(report.eventCount, 1);
  assert.equal(report.groupCount, 2);
  assert.equal(report.events[0].description, "Public summary");
  assert.equal(report.groups.find((group) => group.avenueCode === "CMD").events[0].description, "Community-specific report narrative");
  assert.equal(report.groups.find((group) => group.avenueCode === "PDD").events[0].description, "Professional-specific report narrative");
});

test("single-avenue reports also prefer the selected avenue description", () => {
  const report = buildBodAvenueReportModel({
    month: "2026-07",
    avenueCode: "CMD",
    events: [event("one", { description: "Public summary", avenueDescriptions: { CMD: "Community report text" } })],
    selectedEventIds: ["one"],
  });
  assert.equal(report.isCombined, false);
  assert.equal(report.events[0].description, "Community report text");
});

test("no active director is explicit in avenue group metadata", () => {
  const report = buildBodAvenueReportModel({
    selectedMonths: ["2026-07"],
    selectedAvenueCodes: ["CMD", "PDD"],
    events: [event("multi", { avenues: ["CMD", "PDD"] })],
    selectedEventIds: ["multi"],
    directorsByAvenue: { CMD: [{ name: "Director C", positionTitle: "Community Service Director" }], PDD: [] },
  });
  assert.equal(report.groups.find((group) => group.avenueCode === "PDD").directorText, "Not available");
});

test("period labels cover contiguous, cross-year, and non-contiguous selections", () => {
  assert.equal(formatBodReportMonth("2026-07"), "July 2026");
  assert.equal(formatBodReportPeriod(["2026-07", "2026-08", "2026-09"]), "July-September 2026");
  assert.equal(formatBodReportPeriod(["2026-11", "2026-12", "2027-01"]), "November 2026-January 2027");
  assert.equal(formatBodReportPeriod(["2026-07", "2026-09"]), "July 2026, September 2026");
});

test("appearance values are constrained and invalid values fall back safely", () => {
  assert.deepEqual(normalizeBodReportAppearance({ fontFamily: "times", bodySize: "large", density: "comfortable" }), { fontFamily: "times", bodySize: "large", density: "comfortable" });
  assert.deepEqual(normalizeBodReportAppearance({ fontFamily: "bad", bodySize: "tiny", density: "loose" }), BOD_AVENUE_REPORT_DEFAULT_APPEARANCE);
  const report = buildBodAvenueReportModel({ month: "2026-07", avenueCode: "CMD", events: [event("x")], selectedEventIds: ["x"], appearance: { fontFamily: "times", bodySize: "compact", density: "compact" } });
  assert.deepEqual(report.appearance, { fontFamily: "times", bodySize: "compact", density: "compact" });
});

test("report model handles unknown collaborators, invalid selections, empty selections, and limits", () => {
  const unknown = event("unknown", { collaborators: [], collaboratorsKnown: false });
  const report = buildBodAvenueReportModel({ month: "2026-07", avenueCode: "CMD", events: [unknown], selectedEventIds: ["unknown"] });
  assert.equal(report.directorText, "Not available");
  assert.equal(report.events[0].collaborators, "Not available");
  assert.throws(() => buildBodAvenueReportModel({ selectedMonths: [], avenueCode: "CMD", events: [unknown], selectedEventIds: ["unknown"] }), /month/i);
  assert.throws(() => buildBodAvenueReportModel({ month: "2026-07", selectedAvenueCodes: [], events: [unknown], selectedEventIds: ["unknown"] }), /avenue/i);
  assert.throws(() => buildBodAvenueReportModel({ month: "2026-07", avenueCode: "CMD", events: [unknown], selectedEventIds: [] }), /select/i);
  const many = Array.from({ length: BOD_AVENUE_REPORT_LIMIT + 1 }, (_, index) => event(`e-${index}`));
  assert.throws(() => buildBodAvenueReportModel({ month: "2026-07", avenueCode: "CMD", events: many, selectedEventIds: many.map((item) => item.id) }), /limited/i);
});

test("single and combined filenames are deterministic and filesystem-safe", () => {
  assert.equal(getBodAvenueReportFilename({ avenueLabel: "Community: Service / Avenue", monthLabel: "July 2026" }), "RCPH-Community-Service-Avenue-July-2026-Report.pdf");
  assert.equal(getBodAvenueReportFilename({ selectedMonths: ["2026-07", "2026-08"], selectedAvenueCodes: ["CMD", "PDD"] }), "RCPH-BOD-Avenue-Report-July-2026-to-August-2026-CMD-PDD.pdf");
  assert.equal(getBodAvenueReportFilename({ selectedMonths: ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05"], selectedAvenueCodes: ["ISD", "CMD", "CSD", "PDD", "PRO"] }), "RCPH-BOD-Avenue-Combined-Report-2026.pdf");
});
