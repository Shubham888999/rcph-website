import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { attendanceStreak, avenueBars, countdownParts, dashboardNudge, firstName, greetingFor, nextEvent, normalizeDuesContact } from "./dashboardUpgradeModel.js";
import { normalizeDashboardResponse } from "../dashboardModel.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("greets by time of day and uses the first name", () => {
  assert.equal(greetingFor(new Date(2026, 10, 25, 9)), "Good morning");
  assert.equal(greetingFor(new Date(2026, 10, 25, 14)), "Good afternoon");
  assert.equal(greetingFor(new Date(2026, 10, 25, 20)), "Good evening");
  assert.equal(firstName("Rtr. Shubham Deshpande"), "Shubham");
});

test("finds the next event and counts down to it", () => {
  const now = new Date("2026-11-25T12:00:00+05:30");
  const events = [{ name: "Later", date: "2026-12-10" }, { name: "GBM", date: "2026-11-28" }, { name: "Past", date: "2026-11-20" }];
  assert.equal(nextEvent(events, now).name, "GBM");
  const parts = countdownParts(nextEvent(events, now), now);
  assert.deepEqual(parts, { days: 2, hours: 22, minutes: 0, seconds: 0 });
  assert.equal(nextEvent([], now), null);
});

test("streak counts back from the latest event and stops at an absence", () => {
  const recent = [
    { date: "2026-11-20", label: "Present" },
    { date: "2026-11-10", label: "Present" },
    { date: "2026-11-01", label: "NA" },
    { date: "2026-10-20", label: "Present" },
    { date: "2026-10-01", label: "Absent" },
  ];
  assert.equal(attendanceStreak(recent), 3);
  assert.match(dashboardNudge({ upcoming: [{ name: "GBM", date: "2026-11-28" }], recent, now: new Date("2026-11-25T12:00:00+05:30") }), /Next up: GBM in 3 days\. You've attended 3 events in a row\./);
});

test("avenue bars come from the attendance breakdown", () => {
  const bars = avenueBars([{ avenue: "CSD", present: 9, totalCounted: 10 }, { avenue: "PDD", present: 1, totalCounted: 3 }, { avenue: "ISD", present: 0, totalCounted: 0 }]);
  assert.deepEqual(bars.map((bar) => [bar.avenue, bar.percent]), [["CSD", 90], ["PDD", 33]]);
});

test("dues contact is only kept when it is complete", () => {
  const contact = normalizeDuesContact({ name: "Rtr. Anish Joglekar", role: "Membership Development Officer", phone: "+91 97651 82208" });
  assert.equal(contact.tel, "tel:+919765182208");
  assert.equal(contact.whatsapp, "https://wa.me/919765182208");
  assert.equal(normalizeDuesContact({ name: "X", phone: "call me" }), null);
  assert.equal(normalizeDuesContact(null), null);
});

test("the dues phone number is never written into website code", () => {
  for (const file of ["./dashboardUpgradeModel.js", "./RoadToMembership.jsx", "../../prospect/ProspectProgress.jsx", "../dashboardModel.js"]) {
    assert.doesNotMatch(read(file), /97651|82208/);
  }
});

test("prospect responses carry the dues contact through", () => {
  const data = normalizeDashboardResponse({
    ok: true,
    mode: "prospect",
    profile: { uid: "u1", role: "prospect", name: "Riya" },
    prospectProgress: { requiredConsecutiveAttendance: 3, attendanceRequirementMet: true, duesDue: true },
    duesContact: { name: "Rtr. Anish Joglekar", role: "Membership Development Officer", phone: "+91 97651 82208" },
  });
  assert.equal(data.duesContact.name, "Rtr. Anish Joglekar");
});
