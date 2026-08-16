import assert from "node:assert/strict";
import test from "node:test";
import {
  formatConductedDate,
  formatEventTime,
  formatReportingDeadline,
  normalizeBodReportingQueueResponse,
  reportingStatusLabel,
  reportingStatusTone,
  runtimeStateLabel,
  shouldRenderBodReportingQueuePanel,
} from "./bodReportingQueueModel.js";

test("reporting queue response normalization strips unknown and private fields while preserving order", () => {
  const items = normalizeBodReportingQueueResponse({
    ok: true,
    items: [
      {
        reportingWindowId: "window-a",
        eventName: "Alpha",
        reportingDueAt: "2026-08-12T18:29:00.000Z",
        avenues: ["ISD", "RRRO"],
        coverage: {
          requiredAvenues: ["ISD", "RRRO"],
          avenueStatuses: { ISD: "reported", RRRO: "missing_avenue" },
        },
        responsibilities: [
          {
            avenue: "ISD",
            assignees: [
              {
                uid: "director-1",
                name: "Rtr. ABC",
                email: "private@example.com",
                phone: "hidden",
                positionLabel: "International Service Director",
              },
              { uid: "co-1", name: "Rtr. XYZ", positionLabel: "Co-ISD" },
            ],
          },
        ],
        action: "continue_event",
        linkedBodEventId: "event-1",
        anchorDate: "2026-08-16",
        countdownStartAt: "2026-08-16T18:30:00.000Z",
        reportingAvailableAt: "2026-08-16T04:30:00.000Z",
        effectiveLocked: false,
        deadlinePassed: true,
        manualUnlockActive: true,
        lockSource: "manual_unlock",
        secret: "ignore",
      },
      {
        reportingWindowId: "window-b",
        eventName: "Beta",
        avenues: ["CMD"],
        coverage: { requiredAvenues: ["CMD"], avenueStatuses: { CMD: "missing_description" } },
        action: "add_event",
      },
    ],
  });

  assert.deepEqual(items.map((item) => item.reportingWindowId), ["window-a", "window-b"]);
  assert.equal(items[0].action, "continue_event");
  assert.equal(items[0].linkedBodEventId, "event-1");
  assert.equal(items[0].anchorDate, "2026-08-16");
  assert.equal(items[0].countdownStartAt, "2026-08-16T18:30:00.000Z");
  assert.equal(items[0].reportingAvailableAt, "2026-08-16T04:30:00.000Z");
  assert.equal(items[0].effectiveLocked, false);
  assert.equal(items[0].deadlinePassed, true);
  assert.equal(items[0].manualUnlockActive, true);
  assert.equal(items[0].lockSource, "manual_unlock");
  assert.equal(runtimeStateLabel(items[0]), "Unlocked by Admin");
  assert.equal(items[0].coverage.avenueStatuses.RRRO, "missing_avenue");
  assert.equal(Object.hasOwn(items[0], "secret"), false);
  assert.equal(Object.hasOwn(items[0].responsibilities[0].assignees[0], "email"), false);
  assert.equal(Object.hasOwn(items[0].responsibilities[0].assignees[0], "phone"), false);
});

test("reporting queue normalizes malformed responses and fills safe responsibility fallbacks", () => {
  assert.deepEqual(normalizeBodReportingQueueResponse(null), []);
  assert.deepEqual(normalizeBodReportingQueueResponse({ items: "bad" }), []);
  assert.deepEqual(normalizeBodReportingQueueResponse({ items: [{ reportingWindowId: "missing-name" }] }), []);

  const [item] = normalizeBodReportingQueueResponse({
    items: [{
      reportingWindowId: "window-gbm",
      eventName: "GBM",
      targetType: "club_event",
      avenues: ["GBM"],
      coverage: { requiredAvenues: ["GBM"], avenueStatuses: { GBM: "missing_avenue" } },
      responsibilities: [],
      action: "add_event",
    }],
  });

  assert.equal(item.responsibilities[0].responsibilityType, "secretary");
  assert.deepEqual(item.responsibilities[0].assignees, []);
});

test("reporting status labels and tones distinguish reported, missing avenue, and missing description", () => {
  assert.equal(reportingStatusLabel("reported"), "Reported");
  assert.equal(reportingStatusTone("reported"), "reported");
  assert.equal(reportingStatusLabel("missing_avenue"), "Event avenue not added");
  assert.equal(reportingStatusTone("missing_avenue"), "pending");
  assert.equal(reportingStatusLabel("missing_description"), "Report pending");
  assert.equal(reportingStatusTone("missing_description"), "pending");
});

test("reporting dates use IST deadline display and safe conducted-date formatting", () => {
  assert.match(formatReportingDeadline("2026-08-12T18:29:00.000Z"), /12 Aug 2026/);
  assert.match(formatReportingDeadline("2026-08-12T18:29:00.000Z"), /IST$/);
  assert.equal(formatConductedDate("2026-08-09"), "9 Aug 2026");
  assert.equal(formatEventTime("19:00"), "7:00 PM");
  assert.equal(formatReportingDeadline("bad"), "Deadline unavailable");
});

test("reporting queue panel render gate hides success-empty but allows errors", () => {
  assert.equal(shouldRenderBodReportingQueuePanel({ status: "success", items: [] }), false);
  assert.equal(shouldRenderBodReportingQueuePanel({ status: "idle", items: [] }), false);
  assert.equal(shouldRenderBodReportingQueuePanel({ status: "loading", items: [] }), false);
  assert.equal(shouldRenderBodReportingQueuePanel({ status: "error", items: [] }), true);
  assert.equal(shouldRenderBodReportingQueuePanel({ status: "success", items: [{ reportingWindowId: "w" }] }), true);
});
