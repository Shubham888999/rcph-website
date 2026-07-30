import assert from "node:assert/strict";
import test from "node:test";
import {
  AVENUE_REPORTING_LOCK_HELP_TEXT,
  BOD_AVENUE_OPTIONS,
  BOD_EVENT_SOURCE,
  BOD_MEETING_AVENUE,
  BOD_REPORT_FINANCE_MAX_ROWS,
  buildAvenueDescriptionDraft,
  buildBodEventPayload,
  getEventDescriptionForAvenue,
  getBodEventAttachments,
  getBodEventPermissions,
  getLockedBodAvenues,
  getDriveFileId,
  getDriveThumbnailUrl,
  isValidDateOnly,
  lockedAvenueMessage,
  normalizeAvenueDescriptions,
  normalizeAvenueReportingLock,
  normalizeBodEvent,
  normalizeBodReportFinance,
  safeExternalUrl,
  validateAvenueDescriptionCoverage,
} from "./bodEventModel.js";

const base = { name: " Project One ", date: "2026-07-05", type: "clubEvent", avenue: ["CMD"] };

test("club event normalizes without exposing unknown fields", () => {
  const event = normalizeBodEvent("event-1", { ...base, secret: "no", collaborators: [{ name: " Club A " }] });
  assert.equal(event.name, "Project One");
  assert.equal(event.recordKind, "clubEvent");
  assert.deepEqual(event.collaborators, [{ name: "Club A" }]);
  assert.deepEqual(event.reportFinance, { hasFinance: false, entries: [] });
  assert.equal(Object.hasOwn(event, "secret"), false);
});

test("report-only finance normalizes valid entries and strips unknown nested fields", () => {
  const finance = normalizeBodReportFinance({
    hasFinance: true,
    entries: [
      { type: " expense ", amount: "1250.455", description: " Venue booking ", treasuryId: "hidden" },
      { type: "income", amount: 250, description: "Member contributions" },
      { type: "bad", amount: 1, description: "Nope" },
    ],
  });
  assert.deepEqual(finance, {
    hasFinance: true,
    entries: [
      { type: "expense", amount: 1250.46, description: "Venue booking" },
      { type: "income", amount: 250, description: "Member contributions" },
    ],
  });
  assert.equal(JSON.stringify(finance).includes("treasuryId"), false);
});

test("missing, disabled, or malformed report finance normalizes to the canonical empty shape", () => {
  assert.deepEqual(normalizeBodReportFinance(), { hasFinance: false, entries: [] });
  assert.deepEqual(normalizeBodReportFinance({ hasFinance: false, entries: [{ type: "expense", amount: 5, description: "Old" }] }), { hasFinance: false, entries: [] });
  assert.deepEqual(normalizeBodReportFinance({ hasFinance: true, entries: [{ type: "expense", amount: 0, description: "Bad" }] }), { hasFinance: false, entries: [] });
});

test("BOD event normalizer preserves MOM metadata on canonical records", () => {
  const event = normalizeBodEvent("event-1", {
    ...base,
    momDriveFileId: "mom-file-1",
    momFileName: "project-mom.pdf",
    momMimeType: "application/pdf",
    momUploadedByName: "Secretary",
    momUploadedAt: "2026-07-05T12:00:00.000Z",
    momPublicUrl: "https://drive.google.com/file/d/mom-file-1/view",
  });

  assert.equal(event.mom.momTargetType, "bod_event");
  assert.equal(event.mom.momTargetId, "event-1");
  assert.equal(event.mom.momFileName, "project-mom.pdf");
  assert.equal(Object.hasOwn(event.mom, "momPublicUrl"), false);
});

test("BOD event normalizer preserves linked reporting window IDs", () => {
  const event = normalizeBodEvent("event-1", {
    ...base,
    reportingWindowId: "window-1",
  });

  assert.equal(event.reportingWindowId, "window-1");
});

test("BOD meetings are editable while district events stay read-only", () => {
  const bodMeeting = normalizeBodEvent("meeting-1", {
    name: "BOD Meeting 1",
    date: "2026-07-10",
    type: "bodMeeting",
    avenue: ["BOD"],
    syncedMeetingId: "meeting-1",
  });
  const districtEvent = normalizeBodEvent("district-1", { ...base, type: "districtEvent" });

  assert.equal(bodMeeting.recordKind, "bodMeeting");
  assert.deepEqual(bodMeeting.avenues, ["BOD"]);
  assert.equal(bodMeeting.bodMeetingId, "meeting-1");
  assert.equal(bodMeeting.canEdit, true);
  assert.equal(bodMeeting.canArchive, true);
  assert.equal(districtEvent.recordKind, "districtEvent");
  assert.equal(districtEvent.canEdit, false);
  assert.equal(districtEvent.canArchive, false);
});

test("archived and deleted records are inactive", () => {
  assert.equal(normalizeBodEvent("a", { ...base, archived: true }).isActive, false);
  assert.equal(normalizeBodEvent("b", { ...base, status: "deleted" }).isActive, false);
});

test("arrays are cleaned, malformed values ignored, and avenues deduplicated", () => {
  const event = normalizeBodEvent("a", { ...base, avenue: [" cmd ", null, "CMD", 3], imageLinks: ["https://example.com/a.jpg", "javascript:bad"] });
  assert.deepEqual(event.avenues, ["CMD"]);
  assert.deepEqual(event.imageLinks, ["https://example.com/a.jpg"]);
});

test("canonical BOD events normalize avenue descriptions without exposing invalid keys", () => {
  const event = normalizeBodEvent("a", {
    ...base,
    avenues: ["pdd", "CMD", "bad"],
    description: "General public text",
    avenueDescriptions: { CMD: " Community report ", PDD: " Professional report ", ISD: "extra", bad: "ignored" },
  });
  assert.deepEqual(event.avenues, ["CMD", "PDD"]);
  assert.deepEqual(event.avenueDescriptions, { CMD: "Community report", PDD: "Professional report" });
  assert.equal(getEventDescriptionForAvenue(event, "CMD"), "Community report");
  assert.equal(getEventDescriptionForAvenue(event, "PDD"), "Professional report");
  assert.equal(getEventDescriptionForAvenue(event, "ISD"), "General public text");
});

test("old shared-description events build editable avenue drafts and report fallbacks", () => {
  const event = normalizeBodEvent("legacy", { ...base, description: "Shared legacy description", avenue: ["CMD", "PDD"] });
  assert.deepEqual(event.avenueDescriptions, {});
  assert.deepEqual(buildAvenueDescriptionDraft(event), { CMD: "Shared legacy description", PDD: "Shared legacy description" });
  assert.equal(getEventDescriptionForAvenue(event, "CMD"), "Shared legacy description");
});

test("avenue description validation rejects malformed, extra, invalid, and prototype keys", () => {
  assert.equal(validateAvenueDescriptionCoverage(["CMD"], ["bad"]).ok, false);
  assert.deepEqual(normalizeAvenueDescriptions({ CMD: "Ok", PDD: "Extra" }, ["CMD"]), { CMD: "Ok" });
  assert.deepEqual(validateAvenueDescriptionCoverage(["CMD"], { CMD: "Ok" }).errors, []);
  assert.match(validateAvenueDescriptionCoverage(["CMD"], { CMD: "Ok", PDD: "Extra" }).errors.join(" "), /unselected/i);
  assert.match(validateAvenueDescriptionCoverage(["CMD"], { CMD: "Ok", bad: "No" }).errors.join(" "), /invalid/i);
  assert.match(validateAvenueDescriptionCoverage(["CMD"], JSON.parse('{"CMD":"Ok","__proto__":"No"}')).errors.join(" "), /invalid/i);
  assert.match(validateAvenueDescriptionCoverage(["CMD", "PDD"], { CMD: "Ok" }).errors.join(" "), /every selected/i);
});

test("strict dates accept leap day and reject invalid dates and reversed ranges", () => {
  assert.equal(isValidDateOnly("2028-02-29"), true);
  assert.equal(isValidDateOnly("2027-02-29"), false);
  assert.equal(normalizeBodEvent("bad", { ...base, date: "2027-02-29" }), null);
  assert.equal(normalizeBodEvent("range", { ...base, endDate: "2026-07-01" }).endDate, "");
});

test("safe links accept only HTTP(S)", () => {
  assert.equal(safeExternalUrl("javascript:alert(1)"), "");
  assert.equal(safeExternalUrl("https://example.com/folder"), "https://example.com/folder");
});

test("Drive file helpers derive IDs and thumbnail URLs without changing stored links", () => {
  const viewUrl = "https://drive.google.com/file/d/image_ABC-123/view?usp=sharing";
  assert.equal(getDriveFileId(viewUrl), "image_ABC-123");
  assert.equal(getDriveFileId("https://drive.google.com/open?id=query_123"), "query_123");
  assert.equal(getDriveFileId("https://example.com/file/d/nope/view"), "");
  assert.equal(getDriveThumbnailUrl(viewUrl), "https://drive.google.com/thumbnail?id=image_ABC-123&sz=w1000");
});

test("event attachments merge, deduplicate, and preview only image-designated links", () => {
  const imageUrl = "https://drive.google.com/file/d/image123/view";
  const pdfUrl = "https://drive.google.com/file/d/pdf123/view";
  const attachments = getBodEventAttachments({
    previewLink: imageUrl,
    imageLinks: [imageUrl],
    driveLinks: [imageUrl, pdfUrl],
  });
  assert.equal(attachments.length, 2);
  assert.equal(attachments[0].thumbnailUrl, "https://drive.google.com/thumbnail?id=image123&sz=w1000");
  assert.equal(attachments[0].image, true);
  assert.equal(attachments[1].thumbnailUrl, "");
  assert.equal(attachments[1].image, false);
  assert.equal(attachments[1].url, pdfUrl);
});

test("permissions allow active club mutations and capability-gated sync only", () => {
  const event = normalizeBodEvent("a", base);
  const bod = { canAccessBodTools: true, canAccessAdminTools: false, canAccessPresidentControls: false };
  assert.deepEqual(getBodEventPermissions(event, bod, "unlocked"), { canEdit: true, canArchive: true, canSync: false });
  assert.equal(getBodEventPermissions(event, { ...bod, canAccessAdminTools: true }, "unlocked").canSync, true);
  assert.equal(getBodEventPermissions(event, bod, "locked").canEdit, false);
  assert.equal(getBodEventPermissions(event, { ...bod, canAccessPresidentControls: true }, "locked").canEdit, true);
  assert.equal(getBodEventPermissions(event, bod, "unknown").canEdit, false);
});

test("payload builder whitelists fields and forces production classification", () => {
  const { payload, errors } = buildBodEventPayload({
    name: "Test", conductedBy: "Member", startDate: "2026-07-05", endDate: "",
    time: "18:30", avenues: ["CMD", "CMD"], description: "Desc", rcphRole: "host",
    hostClub: " RCPH ", collaborators: [{ name: " " }, { name: "Partner" }],
    collaborationNotes: "Notes", driveFolder: "https://drive.google.com/drive/folders/abc",
    reportingWindowId: "window-1", type: "districtEvent", visibility: "internal", uiOnly: true,
  }, "event-1");
  assert.deepEqual(errors, {});
  assert.equal(payload.eventId, "event-1");
  assert.equal(payload.type, "clubEvent");
  assert.equal(payload.source, BOD_EVENT_SOURCE);
  assert.equal(payload.reportingWindowId, "window-1");
  assert.equal(payload.visibility, "public");
  assert.equal(payload.description, "Desc");
  assert.equal(payload.desc, "Desc");
  assert.deepEqual(payload.avenue, ["CMD"]);
  assert.deepEqual(payload.avenues, ["CMD"]);
  assert.deepEqual(payload.avenueDescriptions, { CMD: "Desc" });
  assert.deepEqual(payload.collaborators, [{ name: "Partner" }]);
  assert.deepEqual(payload.reportFinance, { hasFinance: false, entries: [] });
  assert.equal(Object.hasOwn(payload, "uiOnly"), false);
});

test("BOD meeting avenue builds an internal meeting payload without service report fields", () => {
  const { payload, errors } = buildBodEventPayload({
    name: "BOD Meeting 1",
    startDate: "2026-07-15",
    time: "",
    avenues: [BOD_MEETING_AVENUE],
    description: "Board planning",
    reportFinance: {
      hasFinance: true,
      entries: [{ type: "expense", amount: "100", description: "Ignored for meetings" }],
    },
    reportingWindowId: "window-bod",
  }, "meeting-1");

  assert.deepEqual(errors, {});
  assert.equal(BOD_AVENUE_OPTIONS.some((option) => option.code === "BOD" && option.label === "Board of Directors"), true);
  assert.equal(payload.eventId, "meeting-1");
  assert.equal(payload.type, "bodMeeting");
  assert.equal(payload.visibility, "internal");
  assert.equal(payload.source, BOD_EVENT_SOURCE);
  assert.equal(payload.date, "2026-07-15");
  assert.equal(payload.endDate, "2026-07-15");
  assert.deepEqual(payload.avenue, ["BOD"]);
  assert.deepEqual(payload.avenues, ["BOD"]);
  assert.equal(Object.hasOwn(payload, "avenueDescriptions"), false);
  assert.equal(Object.hasOwn(payload, "reportFinance"), false);
});

test("BOD meeting payload rejects mixed or unknown avenues", () => {
  const mixed = buildBodEventPayload({
    name: "BOD Meeting 1",
    startDate: "2026-07-15",
    avenues: ["BOD", "CMD"],
  });
  assert.equal(mixed.payload, null);
  assert.match(mixed.errors.avenues, /cannot be combined/i);

  const unknown = buildBodEventPayload({
    name: "Unknown Avenue",
    startDate: "2026-07-15",
    avenues: ["XYZ"],
  });
  assert.equal(unknown.payload, null);
  assert.match(unknown.errors.avenues, /Select at least one avenue/);
});

test("active avenue reporting locks normalize and block selected BOD event avenues", () => {
  const lock = normalizeAvenueReportingLock("avenueReporting_window-pdd", {
    type: "avenue_reporting",
    locked: true,
    status: "active",
    reason: "reporting_window_expired",
    avenue: "PDD",
    reportingWindowId: "window-pdd",
  });

  assert.equal(lock.avenue, "PDD");
  assert.equal(AVENUE_REPORTING_LOCK_HELP_TEXT, "Locked due to missed reporting window. Ask President/Admin to unlock.");
  assert.deepEqual(getLockedBodAvenues(["CMD", "PDD"], [lock]), ["PDD"]);
  assert.equal(lockedAvenueMessage(["PDD"]), "PDD is locked due to missed reporting window. Ask President or Admin to unlock.");

  const result = buildBodEventPayload({
    name: "Test",
    conductedBy: "Member",
    startDate: "2026-07-05",
    avenues: ["PDD"],
    description: "Desc",
    avenueDescriptions: { PDD: "Professional report" },
  }, "", { lockedAvenueReportingLocks: [lock] });

  assert.equal(result.payload, null);
  assert.equal(result.errors.avenues, "PDD is locked due to missed reporting window. Ask President or Admin to unlock.");
});

test("unlocked or unrelated avenue reporting locks do not block BOD event payloads", () => {
  const inactiveLock = normalizeAvenueReportingLock("avenueReporting_window-pdd", {
    type: "avenue_reporting",
    locked: false,
    status: "unlocked",
    avenue: "PDD",
  });
  const cmdLock = normalizeAvenueReportingLock("avenueReporting_window-cmd", {
    type: "avenue_reporting",
    locked: true,
    status: "active",
    reason: "reporting_window_expired",
    avenue: "CMD",
  });

  assert.equal(inactiveLock, null);
  const result = buildBodEventPayload({
    name: "Test",
    conductedBy: "Member",
    startDate: "2026-07-05",
    avenues: ["PDD"],
    description: "Desc",
    avenueDescriptions: { PDD: "Professional report" },
  }, "", { lockedAvenueReportingLocks: [cmdLock] });

  assert.deepEqual(result.errors, {});
  assert.equal(result.payload.avenues[0], "PDD");
});

test("payload builder persists valid report-only finance entries", () => {
  const { payload, errors } = buildBodEventPayload({
    name: "Test", conductedBy: "Member", startDate: "2026-07-05", endDate: "",
    time: "18:30", avenues: ["CMD"], description: "Desc", rcphRole: "host",
    reportFinance: {
      hasFinance: true,
      entries: [
        { type: "income", amount: "500", description: "Ticket collection", ignored: true },
        { type: "expense", amount: "250.456", description: "Refreshments" },
      ],
    },
  });
  assert.deepEqual(errors, {});
  assert.deepEqual(payload.reportFinance, {
    hasFinance: true,
    entries: [
      { type: "income", amount: 500, description: "Ticket collection" },
      { type: "expense", amount: 250.46, description: "Refreshments" },
    ],
  });
  assert.equal(JSON.stringify(payload.reportFinance).includes("ignored"), false);
});

test("unchecked report finance clears stale entries in the payload", () => {
  const { payload, errors } = buildBodEventPayload({
    name: "Test", conductedBy: "Member", startDate: "2026-07-05", avenues: ["CMD"], description: "Desc",
    reportFinance: {
      hasFinance: false,
      entries: [{ type: "expense", amount: "99", description: "Stale" }],
    },
  });
  assert.deepEqual(errors, {});
  assert.deepEqual(payload.reportFinance, { hasFinance: false, entries: [] });
});

test("payload builder rejects malformed report finance rows", () => {
  const validDraft = {
    name: "Test",
    conductedBy: "Member",
    startDate: "2026-07-05",
    avenues: ["CMD"],
    description: "Desc",
  };
  for (const reportFinance of [
    { hasFinance: true, entries: [{ type: "refund", amount: "1", description: "Invalid type" }] },
    { hasFinance: true, entries: [{ type: "expense", amount: "0", description: "Zero" }] },
    { hasFinance: true, entries: [{ type: "expense", amount: "-1", description: "Negative" }] },
    { hasFinance: true, entries: [{ type: "expense", amount: "1000000.01", description: "Too high" }] },
    { hasFinance: true, entries: [{ type: "expense", amount: "1", description: "" }] },
    { hasFinance: true, entries: [] },
    { hasFinance: true, entries: Array.from({ length: BOD_REPORT_FINANCE_MAX_ROWS + 1 }, () => ({ type: "expense", amount: "1", description: "Many" })) },
  ]) {
    const result = buildBodEventPayload({ ...validDraft, reportFinance });
    assert.equal(result.payload, null);
    assert.ok(result.errors.reportFinance);
  }
});

test("payload validation rejects bad ranges and keeps no raw record fields", () => {
  const result = buildBodEventPayload({ name: "Test", conductedBy: "Member", startDate: "2026-07-05", endDate: "2026-07-04", avenues: ["CMD"] });
  assert.equal(result.payload, null);
  assert.ok(result.errors.endDate);
});

test("payload builder requires a complete selected-avenue description map", () => {
  assert.deepEqual(buildBodEventPayload({
    name: "Test", conductedBy: "Member", startDate: "2026-07-05", avenues: ["CMD", "PDD"],
    description: "Public text",
    avenueDescriptions: { CMD: "Community report", PDD: "Professional report" },
  }).payload.avenueDescriptions, { CMD: "Community report", PDD: "Professional report" });

  for (const avenueDescriptions of [
    { CMD: "Community report" },
    { CMD: "Community report", PDD: "Professional report", ISD: "Extra" },
    { CMD: "Community report", BAD: "Nope" },
    [],
  ]) {
    const result = buildBodEventPayload({
      name: "Test", conductedBy: "Member", startDate: "2026-07-05", avenues: ["CMD", "PDD"],
      description: "Public text",
      avenueDescriptions,
    });
    assert.equal(result.payload, null);
    assert.ok(result.errors.avenueDescriptions);
  }
});

test(
  "empty conductor is preserved by event normalization",
  () => {
    const event = normalizeBodEvent(
      "event-empty-conductor",
      {
        ...base,
        conductedBy: "",
      },
    );

    assert.equal(
      event.conductedBy,
      "",
    );
  },
);

test(
  "BOD event payload allows an optional empty conductor",
  () => {
    const result =
      buildBodEventPayload({
        name: "General Body Meeting",
        conductedBy: "",
        startDate: "2026-07-20",
        endDate: "",
        time: "",
        avenues: ["GBM"],
        description:
          "Monthly general body meeting.",
        avenueDescriptions: {
          GBM:
            "Monthly general body meeting.",
        },
        rcphRole: "host",
        hostClub:
          "Rotaract Club of Pune Heritage",
        collaborators: [],
        collaborationNotes: "",
        driveFolder: "",
      });

    assert.deepEqual(
      result.errors,
      {},
    );

    assert.equal(
      result.payload.conductedBy,
      "",
    );
  },
);
