import assert from "node:assert/strict";
import test from "node:test";
import {
  getDashboardErrorMessage,
  normalizeDashboardAnnouncements,
  normalizeDashboardResponse,
} from "./dashboardModel.js";

function memberResponse(overrides = {}) {
  return {
    ok: true,
    profile: { name: "Member", email: "m@example.com", role: "gbm", memberName: "Member" },
    myAttendance: { totalCounted: 3, present: 2, absent: 1, na: 1, percentage: 67, recent: [] },
    districtAttendance: { totalCounted: 1, present: 1, absent: 0, na: 0, percentage: 100, recent: [] },
    clubStats: { totalEvents: 4, totalPublicEvents: 5, mostActiveAvenue: "CMD", clubAverageAttendance: 75, myRank: 2, rankedMemberCount: 10, eventsByAvenue: [{ avenue: "CMD", count: 3 }] },
    upcomingEvents: [{ id: "e1", name: "Event", date: "2026-07-05", avenue: ["CMD"] }],
    announcements: [],
    ...overrides,
  };
}

test("valid member response normalizes verified fields", () => {
  const model = normalizeDashboardResponse(memberResponse());
  assert.equal(model.mode, "member");
  assert.equal(model.myAttendance.percentage, 67);
  assert.equal(model.upcomingEvents[0].name, "Event");
});
test("missing optional fields produce safe empty states", () => {
  const model = normalizeDashboardResponse({ ok: true, profile: { role: "gbm" } });
  assert.equal(model.myAttendance.totalCounted, null);
  assert.deepEqual(model.upcomingEvents, []);
});
test("invalid percentages are rejected", () => {
  const model = normalizeDashboardResponse(memberResponse({ myAttendance: { percentage: 140 } }));
  assert.equal(model.myAttendance.percentage, null);
});
test("negative counts are rejected", () => {
  const model = normalizeDashboardResponse(memberResponse({ clubStats: { totalEvents: -1 } }));
  assert.equal(model.clubStats.totalEvents, null);
});
test("malformed dates do not render as valid events", () => {
  const model = normalizeDashboardResponse(memberResponse({ upcomingEvents: [{ id: "x", name: "Bad", date: "2026-99-99" }] }));
  assert.deepEqual(model.upcomingEvents, []);
});
test("unknown response fields are ignored", () => {
  const model = normalizeDashboardResponse(memberResponse({ secretAdminData: { users: 100 } }));
  assert.equal("secretAdminData" in model, false);
});
test("raw server objects are not exposed", () => {
  const raw = memberResponse();
  const model = normalizeDashboardResponse(raw);
  assert.notEqual(model.profile, raw.profile);
  assert.equal("uid" in model.profile, false);
});
test("malformed top-level response fails closed", () => assert.throws(() => normalizeDashboardResponse({ ok: false })));
test("only supplied targeted announcements render", () => {
  const items = normalizeDashboardAnnouncements([{ id: "a", title: "Hello", body: "Member update", priority: "normal", publishedAt: "2026-06-01T00:00:00Z" }], Date.parse("2026-06-02"));
  assert.equal(items.length, 1);
});
test("expired and malformed announcements are excluded", () => {
  const items = normalizeDashboardAnnouncements([
    { id: "expired", title: "Old", body: "Old", expiresAt: "2026-01-01T00:00:00Z" },
    { id: "bad", title: "", body: "No title" },
  ], Date.parse("2026-06-01"));
  assert.deepEqual(items, []);
});
test("announcement ordering follows published time", () => {
  const items = normalizeDashboardAnnouncements([
    { id: "old", title: "Old", body: "Body", publishedAt: "2026-01-01T00:00:00Z" },
    { id: "new", title: "New", body: "Body", publishedAt: "2026-02-01T00:00:00Z" },
  ], Date.parse("2025-01-01"));
  assert.deepEqual(items.map((item) => item.id), ["new", "old"]);
});
test("raw callable error text is not part of normalized models", () => assert.throws(() => normalizeDashboardResponse({ message: "Firestore path" })));
test("dashboard errors never expose raw Function messages", () => {
  assert.doesNotMatch(getDashboardErrorMessage({ message: "secret Firestore path" }), /secret|Firestore path/i);
});
test("announcement normalization excludes targeting and delivery internals", () => {
  const [item] = normalizeDashboardAnnouncements([{
    id: "a",
    title: "Hello",
    body: "Body",
    targetUserIds: ["other-user"],
    delivery: { uid: "private" },
  }], 0);
  assert.equal("targetUserIds" in item, false);
  assert.equal("delivery" in item, false);
});
test("dashboard exposes only open eligible resolution payloads", () => {
  const model = normalizeDashboardResponse(memberResponse({ openResolutions: [{ id: "r1", status: "open", resolutionNumber: "R/1", title: "Vote now", currentVote: "approve" }, { id: "r2", status: "passed", resolutionNumber: "R/2", title: "Closed" }] }));
  assert.deepEqual(model.openResolutions.map((item) => item.id), ["r1"]);
  assert.equal(model.openResolutions[0].currentVote, "approve");
});
