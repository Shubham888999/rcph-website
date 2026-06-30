import assert from "node:assert/strict";
import test from "node:test";
import { normalizeProspectProgress } from "./prospectModel.js";

function progress(overrides = {}) {
  return {
    criteriaVersion: 2,
    requiredConsecutiveAttendance: 3,
    currentConsecutiveAttendance: 2,
    maximumConsecutiveAttendance: 2,
    attendanceProgressCount: 2,
    attendanceRequirementMet: false,
    duesDue: false,
    duesPaid: false,
    ready: false,
    completedCount: 0,
    totalCount: 2,
    percent: 67,
    qualifyingEvents: [],
    ...overrides,
  };
}

test("Prospect criteria status maps from verified booleans", () => assert.equal(normalizeProspectProgress(progress()).status, "In Progress"));
test("completion is not inferred from percentage alone", () => {
  const model = normalizeProspectProgress(progress({ percent: 100, ready: false, attendanceRequirementMet: false }));
  assert.equal(model.ready, false);
  assert.notEqual(model.status, "Ready for Induction");
});
test("dues state maps exactly", () => {
  assert.equal(normalizeProspectProgress(progress({ attendanceRequirementMet: true, duesDue: true })).status, "Dues Pending");
  assert.equal(normalizeProspectProgress(progress({ attendanceRequirementMet: true, duesPaid: true, ready: true })).status, "Ready for Induction");
});
test("missing WhatsApp link never produces a button URL", () => assert.equal(normalizeProspectProgress(progress()).hasWhatsAppLink, false));
test("next-step guidance follows incomplete criteria", () => assert.match(normalizeProspectProgress(progress()).nextStep, /Attend 3 eligible/i));
test("malformed qualifying events are ignored", () => {
  const model = normalizeProspectProgress(progress({ qualifyingEvents: [{ id: "a", name: "Valid", date: "2026-07-01" }, { id: "b", name: "", date: "bad" }] }));
  assert.equal(model.qualifyingEvents.length, 1);
});
