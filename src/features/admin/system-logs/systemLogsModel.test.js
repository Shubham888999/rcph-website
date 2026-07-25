import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSystemLogQuery,
  normalizeActiveDashboardNotice,
  normalizeSystemLogEntry,
  normalizeSystemLogsResponse,
  summarizeSystemLogs,
} from "./systemLogsModel.js";

test("system log entries normalize safe feed fields and reconstructed badges", () => {
  const entry = normalizeSystemLogEntry({
    id: "log-1",
    createdAt: "2026-07-25T10:00:00.000Z",
    category: "announcement",
    action: "created",
    status: "active",
    actorName: "Shubham",
    targetLabel: "Board update",
    details: "12 dashboard recipients",
    reconstructed: true,
    rawSecret: "ignored",
  });

  assert.equal(entry.category, "announcement");
  assert.equal(entry.action, "created");
  assert.equal(entry.reconstructed, true);
  assert.equal(Object.hasOwn(entry, "rawSecret"), false);
});

test("active dashboard notices preserve announcement body and audience status", () => {
  const notice = normalizeActiveDashboardNotice({
    id: "announcement:a1",
    persisted: true,
    source: "announcements",
    title: "Notice",
    body: "Dashboard body",
    targetAudience: "Roles: bod",
    visibleFor: [{ uid: "u1", name: "Member One", role: "bod", status: "read", read: true }],
    deliverySummary: { total: 1, read: 1, unread: 0, dismissed: 0 },
  });

  assert.equal(notice.body, "Dashboard body");
  assert.equal(notice.targetAudience, "Roles: bod");
  assert.equal(notice.visibleFor[0].read, true);
  assert.equal(notice.deliverySummary.read, 1);
});

test("system logs response rejects malformed payloads and summarizes rows", () => {
  assert.throws(() => normalizeSystemLogsResponse({ ok: false }), /invalid/i);
  const response = normalizeSystemLogsResponse({
    ok: true,
    logs: [{ id: "log-1", createdAt: "2026-07-25T10:00:00.000Z", category: "email", action: "failed", status: "failed" }],
    activeNotices: [{ id: "derived:lock", title: "PDD reporting window locked", derived: true }],
    summary: { today: 1, thisWeek: 1, failed: 1, activeNotices: 1 },
  });

  assert.equal(response.logs.length, 1);
  assert.equal(response.activeNotices[0].derived, true);
  assert.equal(response.summary.failed, 1);
});

test("query builder whitelists filter fields and caps limit", () => {
  const query = buildSystemLogQuery({
    category: "email",
    action: "sent",
    status: "success",
    actor: "Shubham",
    search: "announcement",
    limit: 500,
    raw: "ignored",
  });

  assert.deepEqual(query, {
    limit: 200,
    category: "email",
    action: "sent",
    status: "success",
    actor: "Shubham",
    search: "announcement",
  });
});

test("summary counts today, week, failed, and active notices", () => {
  const now = Date.parse("2026-07-25T12:00:00.000Z");
  const summary = summarizeSystemLogs([
    { createdAt: "2026-07-25T10:00:00.000Z", status: "success" },
    { createdAt: "2026-07-23T10:00:00.000Z", status: "failed" },
  ], [{ id: "notice-1" }], now);

  assert.equal(summary.today, 1);
  assert.equal(summary.thisWeek, 2);
  assert.equal(summary.failed, 1);
  assert.equal(summary.activeNotices, 1);
});
