import assert from "node:assert/strict";
import test from "node:test";
import {
  clampDashboardPercentage,
  formatDashboardMetric,
  getAttendanceStory,
  getProspectJourney,
  getProspectNextAction,
  getRoleLabel,
  sortAvenueActivity,
} from "./dashboardPresentationModel.js";

test("attendance messaging distinguishes zero events from verified progress", () => {
  assert.equal(getAttendanceStory({ totalCounted: 0, percentage: 0 }).hasData, false);
  assert.match(getAttendanceStory({ totalCounted: 5, present: 4, percentage: 80 }).title, /Strong attendance/);
});

test("dashboard percentages clamp safely and unavailable metrics remain honest", () => {
  assert.equal(clampDashboardPercentage(125), 100);
  assert.equal(clampDashboardPercentage(-2), 0);
  assert.equal(clampDashboardPercentage("80"), null);
  assert.equal(formatDashboardMetric(null), "Not available yet");
});

test("avenue activity is sorted by count then name without mutating input", () => {
  const input = [{ avenue: "PRO", count: 2 }, { avenue: "CMD", count: 4 }, { avenue: "CSD", count: 2 }];
  assert.deepEqual(sortAvenueActivity(input).map(({ avenue }) => avenue), ["CMD", "CSD", "PRO"]);
  assert.equal(input[0].avenue, "PRO");
});

test("role labels preserve member-facing identity", () => {
  assert.equal(getRoleLabel("bod"), "Board of Directors");
  assert.equal(getRoleLabel("unknown"), "RCPH Member");
});

test("prospect journey uses verified attendance, dues, and ready booleans", () => {
  const progress = { requiredConsecutiveAttendance: 3, attendanceProgressCount: 1, attendanceRequirementMet: false, duesDue: false, duesPaid: false, ready: false };
  const journey = getProspectJourney(progress);
  assert.equal(journey.find(({ key }) => key === "attendance").state, "current");
  assert.equal(journey.find(({ key }) => key === "dues").state, "upcoming");
});

test("prospect next action changes only from verified progress state", () => {
  const base = { nextStep: "Attend one more activity.", attendanceRequirementMet: false, duesDue: false, duesPaid: false, ready: false };
  assert.equal(getProspectNextAction(base).href, "/calendar");
  assert.equal(getProspectNextAction({ ...base, attendanceRequirementMet: true, duesDue: true }).href, "/contact");
  assert.equal(getProspectNextAction({ ...base, attendanceRequirementMet: true, duesPaid: true, ready: true }).href, "");
});
