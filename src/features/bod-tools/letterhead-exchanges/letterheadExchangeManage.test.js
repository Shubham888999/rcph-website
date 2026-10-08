import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  LETTERHEAD_IMAGE_MAX_FILES,
  activeLetterheadImages,
  addLetterheadImageFiles,
  buildEditDraftFromExchange,
  buildLetterheadExchangeHeading,
  buildUpdateLetterheadExchangePayload,
  formatLastEditedLabel,
  isLetterheadReportPhotoEligible,
  letterheadExchangesMissingReportPhoto,
  letterheadPhotoBadge,
  letterheadReportImageKey,
  mergeEditEventOptions,
  mergeEditMemberOptions,
  normalizeLetterheadExchange,
  normalizeReportLetterheadExchangeResponse,
  normalizeUpdateExchangeResponse,
  remainingLetterheadImageSlots,
} from "./letterheadExchangeModel.js";
import { letterheadReportPhotoCandidates, prepareLetterheadReportImagesForPdf } from "./letterheadReportImagePreparation.js";

const dialog = readFileSync(new URL("./LetterheadExchangeManageDialog.jsx", import.meta.url), "utf8");
const history = readFileSync(new URL("./LetterheadExchangeHistory.jsx", import.meta.url), "utf8");
const form = readFileSync(new URL("./LetterheadExchangeForm.jsx", import.meta.url), "utf8");
const panel = readFileSync(new URL("./BodLetterheadExchangePanel.jsx", import.meta.url), "utf8");
const service = readFileSync(new URL("./letterheadExchangeService.js", import.meta.url), "utf8");
const reportPanel = readFileSync(new URL("../BodAvenueReportPanel.jsx", import.meta.url), "utf8");

function image(imageId, overrides = {}) {
  return { imageId, fileName: `${imageId}.jpg`, mimeType: "image/jpeg", sizeBytes: 1000, ...overrides };
}

function exchange(overrides = {}) {
  return {
    id: "exchange-1",
    exchangeDate: "2026-08-21",
    exchangeMonth: "2026-08",
    externalParticipants: [
      { clubName: "Rotaract Club A", rotaractorName: "External One", position: "President", rotaractDistrictId: "3131" },
    ],
    rcphRepresentatives: [{ memberId: "m1", name: "RCPH One", role: "bod", position: "ISD" }],
    rcphMemberIds: ["m1"],
    associatedEvent: null,
    other: "",
    images: [],
    imageCount: 0,
    reportImageId: "",
    ...overrides,
  };
}

test("active images exclude soft-removed images everywhere in the client model", () => {
  const raw = exchange({
    images: [image("a"), image("b", { removedAt: "2026-08-22T00:00:00.000Z" }), image("c")],
    imageCount: 3,
    reportImageId: "b",
    lastEditedAt: "2026-10-08T06:00:00.000Z",
    lastEditedByName: "Asha Kulkarni",
  });
  assert.deepEqual(activeLetterheadImages(raw).map((item) => item.imageId), ["a", "c"]);
  const normalized = normalizeLetterheadExchange(raw);
  assert.deepEqual(normalized.images.map((item) => item.imageId), ["a", "c"]);
  assert.equal(normalized.imageCount, 2);
  assert.equal(normalized.reportImageId, "", "a removed report photo is not shown as selected");
  assert.equal(normalized.lastEditedByName, "Asha Kulkarni");
  assert.equal(normalizeLetterheadExchange({ ...raw, reportImageId: "c" }).reportImageId, "c");
  assert.equal(remainingLetterheadImageSlots(raw), LETTERHEAD_IMAGE_MAX_FILES - 2);
});

test("photo badge text and tone", () => {
  assert.deepEqual(
    letterheadPhotoBadge(exchange()),
    { text: "No photos", tone: "muted", count: 0, hasReportPhoto: false },
  );
  assert.equal(letterheadPhotoBadge(exchange({ images: [image("a")], reportImageId: "a" })).text, "1 photo · Report photo ✓");
  assert.equal(letterheadPhotoBadge(exchange({ images: [image("a")], reportImageId: "a" })).tone, "ready");
  const missing = letterheadPhotoBadge(exchange({ images: [image("a"), image("b")] }));
  assert.equal(missing.text, "2 photos · No report photo");
  assert.equal(missing.tone, "warning");
  assert.equal(letterheadPhotoBadge(exchange({ images: [image("a", { removedAt: "x" })], reportImageId: "a" })).tone, "muted");
});

test("last edited label uses the Rtr. prefix and an IST d Mon yyyy date", () => {
  assert.equal(
    formatLastEditedLabel({ lastEditedByName: "Asha Kulkarni", lastEditedAt: "2026-10-08T06:00:00.000Z" }),
    "Last edited by Rtr. Asha Kulkarni on 8 Oct 2026",
  );
  assert.equal(
    formatLastEditedLabel({ lastEditedByName: "Rtr. Asha Kulkarni", lastEditedAt: "2026-10-07T19:00:00.000Z" }),
    "Last edited by Rtr. Asha Kulkarni on 8 Oct 2026",
  );
  assert.equal(formatLastEditedLabel({}), "");
});

test("report photo eligibility allows only active JPG, PNG, and WebP images", () => {
  assert.equal(isLetterheadReportPhotoEligible(image("a")), true);
  assert.equal(isLetterheadReportPhotoEligible(image("a", { mimeType: "image/webp" })), true);
  assert.equal(isLetterheadReportPhotoEligible(image("a", { mimeType: "application/pdf" })), false);
  assert.equal(isLetterheadReportPhotoEligible({ mimeType: "image/png" }), false);
});

test("edit draft is prefilled from the exchange and saves with the create validation", () => {
  const stored = exchange({
    externalParticipants: [
      { clubName: "Rotaract Club A", rotaractorName: "External One", position: "President", rotaractDistrictId: "3131" },
      { clubName: "Rotaract Club B", rotaractorName: "External Two", position: "", rotaractDistrictId: "" },
    ],
    associatedEvent: { source: "events", id: "event-1", name: "Project Visit", label: "Project Visit - ISD", date: "2026-08-20" },
    other: "Note",
  });
  const draft = buildEditDraftFromExchange(stored);
  assert.equal(draft.exchangeDate, "2026-08-21");
  assert.equal(draft.externalParticipants.length, 2);
  assert.notEqual(draft.externalParticipants[0].rowId, draft.externalParticipants[1].rowId);
  assert.deepEqual(draft.rcphMemberIds, ["m1"]);
  assert.equal(draft.associatedEventKey, "events::event-1");
  assert.equal(draft.uploadImages, false);

  const events = mergeEditEventOptions([], stored);
  assert.equal(events.length, 1, "a stored event is selectable even when no longer offered");
  const result = buildUpdateLetterheadExchangePayload("exchange-1", draft, events);
  assert.deepEqual(result.errors, {});
  assert.equal(result.payload.exchangeId, "exchange-1");
  assert.deepEqual(result.payload.associatedEvent, { source: "events", id: "event-1" });
  assert.equal(result.payload.externalParticipants[1].clubName, "Rotaract Club B");
  assert.equal(Object.hasOwn(result.payload, "images"), false);
  assert.equal(Object.hasOwn(result.payload, "reportImageId"), false);

  const invalid = buildUpdateLetterheadExchangePayload("exchange-1", { ...draft, exchangeDate: "2026-02-30", rcphMemberIds: [] }, events);
  assert.equal(invalid.payload, null);
  assert.ok(invalid.errors.exchangeDate);
  assert.ok(invalid.errors.rcphMemberIds);
  assert.equal(buildUpdateLetterheadExchangePayload("", draft, events).payload, null);
});

test("edit member options keep stored representatives that are no longer offered", () => {
  const options = mergeEditMemberOptions([{ id: "m2", name: "Zara" }], exchange({
    rcphRepresentatives: [{ memberId: "m1", name: "Former Member" }],
  }));
  assert.deepEqual(options.map((member) => member.id), ["m1", "m2"]);
  assert.equal(mergeEditMemberOptions([{ id: "m1", name: "RCPH One" }], exchange()).length, 1);
});

test("update and report responses normalize the new fields", () => {
  const updated = normalizeUpdateExchangeResponse({ ok: true, unchanged: false, exchange: exchange({ images: [image("a")], reportImageId: "a" }) });
  assert.equal(updated.exchange.reportImageId, "a");
  assert.throws(() => normalizeUpdateExchangeResponse({ ok: false }), /incomplete/);

  const report = normalizeReportLetterheadExchangeResponse({
    ok: true,
    months: ["2026-08"],
    exchanges: [
      exchange({ imageCount: 2, reportImage: { imageId: "a", fileName: "a.jpg", mimeType: "IMAGE/JPEG", driveFileId: "private" } }),
      exchange({ id: "exchange-2", imageCount: 1, reportImage: { imageId: "b", fileName: "b.pdf", mimeType: "application/pdf" } }),
    ],
  });
  assert.deepEqual(report.exchanges[0].reportImage, { imageId: "a", fileName: "a.jpg", mimeType: "image/jpeg" });
  assert.equal(report.exchanges[0].imageCount, 2);
  assert.equal(report.exchanges[1].reportImage, null);
  assert.equal(JSON.stringify(report).includes("private"), false);
});

test("block heading and missing report photo list are ordered by exchange date", () => {
  const twoClubs = exchange({
    id: "b",
    exchangeDate: "2026-07-05",
    externalParticipants: [
      { clubName: "Rotaract Club A", rotaractorName: "One" },
      { clubName: "rotaract club a", rotaractorName: "Two" },
      { clubName: "Rotaract Club B", rotaractorName: "Three" },
    ],
    associatedEvent: { name: "Fellowship Night" },
  });
  assert.equal(buildLetterheadExchangeHeading(twoClubs), "5 Jul 2026 · Rotaract Club A, Rotaract Club B · Event: Fellowship Night");
  const missing = letterheadExchangesMissingReportPhoto([
    exchange({ id: "late", exchangeDate: "2026-08-30", imageCount: 2, reportImage: null }),
    { ...twoClubs, imageCount: 3, reportImage: null },
    exchange({ id: "has-photo", imageCount: 1, reportImage: { imageId: "x" } }),
    exchange({ id: "no-photos", imageCount: 0, reportImage: null }),
  ]);
  assert.deepEqual(missing, [
    { exchangeId: "b", label: "5 Jul 2026 · Rotaract Club A, Rotaract Club B" },
    { exchangeId: "late", label: "30 Aug 2026 · Rotaract Club A" },
  ]);
  assert.equal(letterheadReportImageKey("exchange-1"), "letterhead:exchange-1");
  assert.equal(letterheadReportImageKey("bad/id"), "");
});

test("adding photos respects the remaining slots of an existing exchange", () => {
  const file = (name) => ({ name, type: "image/jpeg", size: 100, lastModified: 1 });
  const result = addLetterheadImageFiles([], [file("a.jpg"), file("b.jpg"), file("c.jpg")], 2);
  assert.equal(result.items.length, 2);
  assert.match(result.errors[0], /room for 2 more images/);
  assert.equal(addLetterheadImageFiles([], [file("a.jpg")], 0).items.length, 0);
  assert.equal(addLetterheadImageFiles([], Array.from({ length: 12 }, (_, i) => file(`${i}.jpg`))).items.length, LETTERHEAD_IMAGE_MAX_FILES);
});

test("report photo preparation fetches selected photos only and reports failures without throwing", async () => {
  const exchanges = [
    exchange({ id: "with-photo", reportImage: { imageId: "a", fileName: "a.jpg", mimeType: "image/jpeg" } }),
    exchange({ id: "broken", reportImage: { imageId: "b", fileName: "b.png", mimeType: "image/png" } }),
    exchange({ id: "without", reportImage: null }),
    exchange({ id: "with-photo", reportImage: { imageId: "a", fileName: "a.jpg", mimeType: "image/jpeg" } }),
  ];
  assert.deepEqual(letterheadReportPhotoCandidates(exchanges).map((item) => item.key), ["letterhead:with-photo", "letterhead:broken"]);
  const fetched = [];
  const result = await prepareLetterheadReportImagesForPdf({
    exchanges,
    fetchImageBytes: async (exchangeId, reportImage) => {
      fetched.push(`${exchangeId}:${reportImage.imageId}`);
      if (exchangeId === "broken") throw new Error("network");
      return { eventId: `letterhead:${exchangeId}`, mimeType: "image/jpeg", sizeBytes: 3, arrayBuffer: new ArrayBuffer(3) };
    },
    normalizeImage: async (bytes) => ({ ...bytes, width: 10, height: 10 }),
  });
  assert.deepEqual(fetched.sort(), ["broken:b", "with-photo:a"]);
  assert.deepEqual([...result.imagesByKey.keys()], ["letterhead:with-photo"]);
  assert.deepEqual(result.warnings.map((warning) => warning.exchangeId), ["broken"]);

  const aborted = new AbortController();
  aborted.abort();
  await assert.rejects(() => prepareLetterheadReportImagesForPdf({ exchanges, signal: aborted.signal }), { name: "AbortError" });
});

test("history cards show the photo badge, last edited line, and a Manage button", () => {
  assert.match(history, /letterheadPhotoBadge\(exchange\)/);
  assert.match(history, /className=\{`letterhead-photo-badge is-\$\{badge\.tone\}`\}/);
  assert.match(history, /formatLastEditedLabel\(exchange\)/);
  assert.match(history, /onClick=\{\(\) => onManage\(exchange\)\}/);
  assert.match(history, />\s*Manage\s*<\/button>/);
  assert.match(panel, /<LetterheadExchangeManageDialog/);
  assert.match(panel, /loadHistory\(\{ silent: true \}\)/);
});

test("Manage dialog is an accessible two-tab dialog reusing the form and uploader", () => {
  assert.match(dialog, /useAccessibleDialog\(\{ open: Boolean\(exchange\), onClose \}\)/);
  assert.match(dialog, /role="dialog" aria-modal="true"/);
  assert.match(dialog, /role="tablist"/);
  assert.match(dialog, /role="tab"/);
  assert.match(dialog, /role="tabpanel"/);
  assert.match(dialog, /<LetterheadExchangeForm\s+mode="edit"/);
  assert.match(dialog, /type="radio"/);
  assert.match(dialog, /Use as report photo/);
  assert.match(dialog, /Clear report photo/);
  assert.match(dialog, /Remove this photo from the exchange\? It stays in Drive\./);
  assert.match(dialog, /role="alertdialog"/);
  assert.match(dialog, /maxFiles=\{remaining\}/);
  assert.match(dialog, /uploadLetterheadExchangeImages\(exchange\.id, pending/);
  assert.match(form, /updateLetterheadExchange\(result\.payload\)/);
  assert.match(form, /\{!isEdit && draft\.uploadImages \? \(/);
  assert.match(form, /LetterheadReportPhotoChoice/);
  assert.match(form, /uploaded\.images\.length >= 2/);
});

test("service calls the new callables and fetches report photos through protected access", () => {
  for (const name of ["updateLetterheadExchange", "setLetterheadExchangeReportImage", "removeLetterheadExchangeImage"]) {
    assert.match(service, new RegExp(`callable\\("${name}"`));
  }
  assert.match(service, /export async function fetchLetterheadReportImageBytes/);
  assert.match(service, /buildProtectedImageUrl\(await getAccess\(exchangeId, reportImage\.imageId\)\)/);
  assert.doesNotMatch(service, /driveFileId|webViewLink|storageFileId/);
});

test("avenue report panel offers exchange photos, merges prepared photos, and lists missing report photos", () => {
  assert.match(reportPanel, /includeLetterheadExchangePhotos, setIncludeLetterheadExchangePhotos\] = useState\(true\)/);
  assert.match(reportPanel, /Include exchange photos/);
  assert.match(reportPanel, /showLetterheadOption && includeMonthlyLetterheadExchanges \? \(/);
  assert.match(reportPanel, /new Map\(\[\.\.\.preparedImages\.imagesByEventId, \.\.\.letterheadImages\.imagesByKey\]\)/);
  assert.match(reportPanel, /letterheadExchangesMissingReportPhoto/);
  assert.match(reportPanel, /have photos but no report photo/);
  assert.match(reportPanel, /could not be loaded/);
});
