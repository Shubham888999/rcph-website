import assert from "node:assert/strict";
import test from "node:test";

import {
  LETTERHEAD_IMAGE_MAX_BYTES,
  LETTERHEAD_IMAGE_MAX_FILES,
  LETTERHEAD_PARTICIPANT_LIMIT,
  addLetterheadImageFiles,
  addParticipantRow,
  buildClubSummary,
  buildCreateLetterheadExchangePayload,
  buildProtectedImageUrl,
  createLetterheadExchangeDraft,
  createParticipantRow,
  eventKey,
  formatLetterheadFileSize,
  normalizeCreateExchangeResponse,
  normalizeFinalizeImageResponse,
  normalizeFormOptionsResponse,
  normalizeImageAccessResponse,
  normalizeImageSessionResponse,
  normalizeLetterheadExchange,
  normalizeListExchangeResponse,
  normalizeReportLetterheadExchangeResponse,
  normalizeUploadHttpResponse,
  removeParticipantRow,
  toggleMemberSelection,
  validateLetterheadExchangeDraft,
  validateLetterheadImageFile,
} from "./letterheadExchangeModel.js";

function file(overrides = {}) {
  return {
    name: "letterhead.jpg",
    type: "image/jpeg",
    size: 1024,
    lastModified: 1,
    ...overrides,
  };
}

function eventOption(overrides = {}) {
  return {
    source: "events",
    id: "event-1",
    name: "Project Visit",
    label: "Project Visit - ISD - 20 Aug 2026",
    date: "2026-08-20",
    avenues: ["ISD"],
    ...overrides,
  };
}

function validDraft(overrides = {}) {
  return {
    ...createLetterheadExchangeDraft(),
    exchangeDate: "2026-08-21",
    externalParticipants: [
      {
        rowId: "p1",
        clubName: "Rotaract Club A",
        rotaractorName: "External One",
        position: "",
        rotaractDistrictId: "3131",
      },
    ],
    rcphMemberIds: ["m1"],
    ...overrides,
  };
}

function exchange(overrides = {}) {
  return {
    id: "exchange-1",
    exchangeDate: "2026-08-21",
    externalParticipants: [
      { clubName: "Rotaract Club A", rotaractorName: "External One", rotaractDistrictId: "3131" },
    ],
    rcphRepresentatives: [{ memberId: "m1", name: "RCPH One" }],
    associatedEvent: null,
    images: [],
    imageCount: 0,
    createdAt: "2026-08-21T12:00:00.000Z",
    createdByName: "Creator",
    ...overrides,
  };
}

test("initial participant row and participant add/remove rules are stable", () => {
  const draft = createLetterheadExchangeDraft();
  assert.equal(draft.externalParticipants.length, 1);
  assert.equal(draft.externalParticipants[0].clubName, "");

  const added = addParticipantRow(draft.externalParticipants);
  assert.equal(added.length, 2);
  assert.notEqual(added[0].rowId, added[1].rowId);

  assert.equal(removeParticipantRow(draft.externalParticipants, draft.externalParticipants[0].rowId).length, 1);

  const maxRows = Array.from({ length: LETTERHEAD_PARTICIPANT_LIMIT }, (_, index) =>
    createParticipantRow(`row-${index}`),
  );
  assert.equal(addParticipantRow(maxRows).length, LETTERHEAD_PARTICIPANT_LIMIT);
});

test("participant validation requires club and Rotaractor while keeping position and RID optional", () => {
  const missingClub = validateLetterheadExchangeDraft(validDraft({
    externalParticipants: [{ rowId: "p1", clubName: "", rotaractorName: "Person", position: "", rotaractDistrictId: "" }],
  }));
  assert.equal(Boolean(missingClub.participants?.[0]?.clubName), true);

  const missingRotaractor = validateLetterheadExchangeDraft(validDraft({
    externalParticipants: [{ rowId: "p1", clubName: "Club", rotaractorName: "", position: "", rotaractDistrictId: "" }],
  }));
  assert.equal(Boolean(missingRotaractor.participants?.[0]?.rotaractorName), true);

  const optionalFields = validateLetterheadExchangeDraft(validDraft({
    externalParticipants: [{ rowId: "p1", clubName: "Club", rotaractorName: "Person", position: "", rotaractDistrictId: "" }],
  }));
  assert.deepEqual(optionalFields, {});

  const districtTooLong = validateLetterheadExchangeDraft(validDraft({
    externalParticipants: [{ rowId: "p1", clubName: "Club", rotaractorName: "Person", position: "", rotaractDistrictId: "1".repeat(21) }],
  }));
  assert.equal(Boolean(districtTooLong.participants?.[0]?.rotaractDistrictId), true);
});

test("multiple people from same club and multiple clubs are represented correctly", () => {
  const sameClubPayload = buildCreateLetterheadExchangePayload(validDraft({
    externalParticipants: [
      { rowId: "p1", clubName: "Rotaract Club A", rotaractorName: "One", position: "President", rotaractDistrictId: "3131" },
      { rowId: "p2", clubName: "Rotaract Club A", rotaractorName: "Two", position: "Secretary", rotaractDistrictId: "3131" },
    ],
  }));
  assert.equal(sameClubPayload.payload.externalParticipants.length, 2);
  assert.equal(buildClubSummary(exchange({ externalParticipants: sameClubPayload.payload.externalParticipants })), "Rotaract Club A");

  const multipleClubs = exchange({
    externalParticipants: [
      { clubName: "Rotaract Club A", rotaractorName: "One" },
      { clubName: "Rotaract Club B", rotaractorName: "Two" },
      { clubName: "Rotaract Club C", rotaractorName: "Three" },
    ],
  });
  assert.equal(buildClubSummary(multipleClubs), "Rotaract Club A + 2 more");
});

test("duplicate RCPH member selections are prevented and normalized", () => {
  assert.deepEqual(toggleMemberSelection([], "m1", true), ["m1"]);
  assert.deepEqual(toggleMemberSelection(["m1"], "m1", true), ["m1"]);
  assert.deepEqual(toggleMemberSelection(["m1", "m2"], "m1", false), ["m2"]);

  const result = buildCreateLetterheadExchangePayload(validDraft({ rcphMemberIds: ["m1", "m1", "m2"] }));
  assert.deepEqual(result.payload.rcphMemberIds, ["m1", "m2"]);
});

test("event is optional and create payload sends only source/id when selected", () => {
  const event = eventOption();
  const noEvent = buildCreateLetterheadExchangePayload(validDraft({ associatedEventKey: "" }), [event]);
  assert.equal(noEvent.payload.associatedEvent, null);

  const withEvent = buildCreateLetterheadExchangePayload(validDraft({ associatedEventKey: eventKey(event) }), [event]);
  assert.deepEqual(withEvent.payload.associatedEvent, { source: "events", id: "event-1" });

  const badEvent = validateLetterheadExchangeDraft(validDraft({ associatedEventKey: "events::missing" }), [event]);
  assert.equal(Boolean(badEvent.associatedEventKey), true);
});

test("member requirement, date validation, and Other max are enforced for UX", () => {
  assert.equal(Boolean(validateLetterheadExchangeDraft(validDraft({ rcphMemberIds: [] })).rcphMemberIds), true);
  assert.equal(Boolean(validateLetterheadExchangeDraft(validDraft({ exchangeDate: "21-08-2026" })).exchangeDate), true);
  assert.equal(Boolean(validateLetterheadExchangeDraft(validDraft({ other: "x".repeat(2001) })).other), true);
});

test("image validation accepts JPG/JPEG/PNG/WebP and rejects unsafe selections", () => {
  for (const accepted of [
    file({ name: "scan.jpg", type: "image/jpeg" }),
    file({ name: "scan.jpeg", type: "image/jpeg" }),
    file({ name: "scan.png", type: "image/png" }),
    file({ name: "scan.webp", type: "image/webp" }),
  ]) {
    assert.equal(validateLetterheadImageFile(accepted), "");
  }

  for (const rejected of [
    file({ name: "scan.pdf", type: "application/pdf" }),
    file({ name: "scan.gif", type: "image/gif" }),
    file({ name: "scan.svg", type: "image/svg+xml" }),
    file({ name: "scan.heic", type: "image/heic" }),
    file({ name: "scan.jpg", type: "image/jpeg", size: 0 }),
    file({ name: "scan.jpg", type: "image/jpeg", size: LETTERHEAD_IMAGE_MAX_BYTES + 1 }),
    file({ name: "scan.png", type: "image/jpeg" }),
  ]) {
    assert.notEqual(validateLetterheadImageFile(rejected), "");
  }
});

test("image selection caps at 10, prevents duplicates, and formats readable sizes", () => {
  const files = Array.from({ length: LETTERHEAD_IMAGE_MAX_FILES + 1 }, (_, index) =>
    file({ name: `scan-${index}.jpg`, lastModified: index }),
  );
  const result = addLetterheadImageFiles([], files);
  assert.equal(result.items.length, LETTERHEAD_IMAGE_MAX_FILES);
  assert.equal(result.errors.length, 1);

  const duplicate = addLetterheadImageFiles([result.items[0]], [files[0]]);
  assert.match(duplicate.errors[0], /already selected/);

  assert.equal(formatLetterheadFileSize(512), "512 B");
  assert.equal(formatLetterheadFileSize(2048), "2.0 KB");
  assert.equal(formatLetterheadFileSize(2 * 1024 * 1024), "2.0 MB");
});

test("form options, create, list, and image response normalizers handle missing data safely", () => {
  const options = normalizeFormOptionsResponse({
    ok: true,
    members: [{ id: "b", name: "B Member" }, { id: "a", name: "A Member" }, { id: "", name: "Nope" }],
    events: [eventOption(), { source: "", id: "bad" }],
  });
  assert.deepEqual(options.members.map((member) => member.id), ["a", "b"]);
  assert.equal(options.events.length, 1);

  assert.equal(normalizeListExchangeResponse({ ok: true, exchanges: [exchange(), { id: "" }] }).exchanges.length, 1);
  assert.throws(() => normalizeCreateExchangeResponse({ ok: true, exchange: { id: "" } }), /incomplete/);
  assert.equal(normalizeCreateExchangeResponse({ ok: true, exchange: exchange() }).exchange.id, "exchange-1");
  assert.equal(normalizeLetterheadExchange(exchange({ driveFileId: "private" })).id, "exchange-1");
  const sanitized = normalizeLetterheadExchange(exchange({
    images: [{ imageId: "image-1", fileName: "scan.jpg", driveFileId: "private" }],
  }));
  assert.equal("driveFileId" in sanitized.images[0], false);

  const report = normalizeReportLetterheadExchangeResponse({
    ok: true,
    months: ["2026-08", "2026-08"],
    exchanges: [exchange({
      images: [{ imageId: "secret", fileName: "scan.jpg" }],
      driveFolderId: "folder",
      rcphRepresentatives: [{ memberId: "m1", name: "RCPH One", userId: "user-private" }],
      associatedEvent: { source: "events", id: "event-private", name: "Project", label: "Project - ISD" },
    })],
  });
  assert.deepEqual(report.months, ["2026-08"]);
  assert.equal(report.exchanges[0].rcphRepresentatives[0].name, "RCPH One");
  assert.equal(JSON.stringify(report).includes("driveFolderId"), false);
  assert.equal(JSON.stringify(report).includes("images"), false);
  assert.equal(JSON.stringify(report).includes("memberId"), false);
});

test("image session, upload, finalize, and protected access response contracts are explicit", () => {
  const session = normalizeImageSessionResponse({
    ok: true,
    exchangeId: "exchange-1",
    uploadEndpoint: "https://example.test/upload",
    sessions: [{ sessionId: "s1", proof: "proof", fileName: "scan.jpg", mimeType: "image/jpeg", sizeBytes: 10 }],
  }, 1);
  assert.equal(session.sessions[0].sessionId, "s1");
  assert.throws(() => normalizeImageSessionResponse({ ok: true, uploadEndpoint: "", sessions: [] }, 1), /authorization/);

  const uploaded = normalizeUploadHttpResponse({ ok: true, sessionId: "s1", uploaded: { fileName: "scan.jpg" } }, "fallback");
  assert.equal(uploaded.sessionId, "s1");
  assert.throws(() => normalizeUploadHttpResponse({ ok: false }, "s1"), /rejected/);

  const finalized = normalizeFinalizeImageResponse({
    ok: true,
    exchange: exchange({ images: [{ imageId: "s1", fileName: "scan.jpg" }], imageCount: 1 }),
    image: { imageId: "s1", fileName: "scan.jpg" },
  });
  assert.equal(finalized.image.imageId, "s1");

  const access = normalizeImageAccessResponse({
    ok: true,
    exchangeId: "exchange-1",
    image: { imageId: "s1", fileName: "scan.jpg" },
    accessId: "access-1",
    proof: "secret",
    downloadEndpoint: "https://example.test/downloadLetterheadExchangeImage",
  });
  assert.equal(buildProtectedImageUrl(access), "https://example.test/downloadLetterheadExchangeImage?accessId=access-1&proof=secret");
});
