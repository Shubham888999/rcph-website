import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeVisitDashboardData } from "./visitDashboardModel.js";
import { buildVisitPresentationSlides } from "./visitPresentationModel.js";
import { avenueStripLevel, buildAttendanceTrend, buildAvenueMonthStrip, buildRotaractMonths } from "./visitTrendsModel.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const pageSource = read("../../pages/visits/VisitDashboardPage.jsx");
const chartSource = read("./AttendanceTrendChart.jsx");
const presentationSource = read("../../pages/visits/VisitPresentation.jsx");
const presentationCss = read("../../styles/components/visit-presentation.css");

const TODAY = new Date(2026, 9, 23);

function column(eventId, date, avenueCode, attendanceRate) {
  return { eventId, title: `Event ${eventId}`, date, avenueCode, attendanceRate };
}

function sampleData() {
  return normalizeVisitDashboardData({
    visit: { visitName: "DZR Visit" },
    stats: {
      avenueEventCounts: [
        { avenueCode: "CSD", avenueName: "Club Service", count: 3 },
        { avenueCode: "ISD", avenueName: "International Service", count: 1 },
        { avenueCode: "PDD", avenueName: "Professional Development", count: 0 },
        { avenueCode: "GBM", avenueName: "GBM", count: 2 },
      ],
    },
    attendance: {
      club: {
        columns: [
          column("c3", "2026-09-14", "CSD", 60),
          column("c1", "2026-07-05", "CSD", 80),
          column("c2", "2026-07-20", "CSD", 40),
          column("i1", "2026-10-08", "ISD", 90),
          column("g1", "2026-08-02", "GBM", 70),
          column("old", "2026-05-02", "CSD", 10),
        ],
        rows: [],
      },
      bod: { columns: [column("b1", "2026-08-10", "", 100), column("b2", "", "", 50)], rows: [] },
    },
  });
}

test("the Rotaract year runs from July to the current month", () => {
  assert.deepEqual(buildRotaractMonths(TODAY).map((month) => month.key), ["2026-07", "2026-08", "2026-09", "2026-10"]);
  assert.deepEqual(buildRotaractMonths(new Date(2027, 0, 4)).map((month) => month.label), ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan"]);
  assert.deepEqual(buildRotaractMonths(new Date(2026, 6, 1)).map((month) => month.key), ["2026-07"]);
  assert.equal(buildRotaractMonths(new Date(2027, 5, 30)).length, 12);
});

test("the trend has one point per dated record this year, in date order, for club and BOD", () => {
  const trend = buildAttendanceTrend(sampleData().attendance, TODAY);
  const [club, bod] = trend.series;

  assert.equal(club.label, "Club");
  assert.deepEqual(club.points.map((point) => point.eventId), ["c1", "c2", "g1", "c3", "i1"], "GBMs count as club records; last year is left out");
  assert.deepEqual(bod.points.map((point) => [point.eventId, point.rate]), [["b1", 100]], "records without a date are skipped");
  assert.equal(club.points[0].dateLabel, "5 Jul");
  assert.ok(club.points.every((point, index, points) => point.x > 0 && point.x < 1 && (!index || point.x > points[index - 1].x)));
  assert.deepEqual(trend.months.map((month) => month.label), ["Jul", "Aug", "Sep", "Oct"]);
  assert.equal(trend.months[0].x, 0);
  assert.equal(trend.hasPoints, true);
  assert.equal(buildAttendanceTrend(normalizeVisitDashboardData({}).attendance, TODAY).hasPoints, false);
});

test("the avenue strip counts events per avenue per month, without GBMs or empty avenues", () => {
  const data = sampleData();
  const strip = buildAvenueMonthStrip(data.stats, data.attendance, TODAY);

  assert.deepEqual(strip.months.map((month) => month.label), ["Jul", "Aug", "Sep", "Oct"]);
  assert.deepEqual(strip.rows.map((row) => row.avenueCode), ["ISD", "CSD"], "the dashboard's avenue order");
  const csd = strip.rows.find((row) => row.avenueCode === "CSD");
  assert.deepEqual(csd.counts, [2, 0, 1, 0], "last year's CSD event is not in a month cell");
  assert.equal(csd.total, 4, "the total still matches the avenue's event list");
  assert.deepEqual(csd.levels, [4, 0, 2, 0]);
  assert.deepEqual(strip.totals, [2, 0, 1, 1]);
  assert.equal(strip.total, 5);
});

test("heat levels run from 0 for an empty month to 4 for the busiest", () => {
  assert.equal(avenueStripLevel(0, 5), 0);
  assert.equal(avenueStripLevel(1, 5), 1);
  assert.equal(avenueStripLevel(3, 5), 3);
  assert.equal(avenueStripLevel(5, 5), 4);
  assert.equal(avenueStripLevel(1, 1), 4);
});

test("presentation attendance slide carries the trend and the avenues slide carries the strip", () => {
  const slides = buildVisitPresentationSlides(sampleData(), TODAY);
  const attendance = slides.find((slide) => slide.kind === "attendance");
  const avenues = slides.find((slide) => slide.kind === "avenues");

  assert.equal(attendance.trend.series[0].points.length, 5);
  assert.deepEqual(avenues.strip.rows.map((row) => row.avenueCode), ["ISD", "CSD"]);
  assert.equal(slides.some((slide) => slide.kind === "avenues"), true);
  assert.equal(buildVisitPresentationSlides(normalizeVisitDashboardData({}), TODAY).some((slide) => slide.kind === "avenues"), false);
});

test("the trend sits at the top of Attendance Records, above the tabs and tables", () => {
  const records = pageSource.slice(pageSource.indexOf("function AttendanceRecords"));
  const chart = records.indexOf("<AttendanceTrendChart trend={trend} />");
  assert.ok(chart > records.indexOf("</summary>"), "inside the section, so it shows when opened");
  assert.ok(chart < records.indexOf('className="visit-dashboard-attendance-tabs"'));
  assert.match(pageSource, /<AvenueMonthStrip stats=\{stats\} attendance=\{visibleAttendance\} \/>/);
});

test("trend and strip animate in the presentation and respect reduced motion", () => {
  assert.match(presentationSource, /<AttendanceTrendChart trend=\{slide\.trend\} animated \/>/);
  assert.match(presentationSource, /style=\{\{ "--strip-col": index \}\}/);
  assert.match(chartSource, /role="img" aria-label=\{chartLabel\(trend\.series\)\}/);
  assert.match(presentationCss, /animation-delay: calc\(0\.25s \+ var\(--strip-col, 0\) \* 0\.14s\)/);
  const reduced = presentationCss.slice(presentationCss.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(reduced, /\.visit-present__cell/);
  assert.match(reduced, /\.visit-trend\.is-animated \.visit-trend__area/);
});
