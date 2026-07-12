import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildGeneratedPagesPreviewPages,
  generateGeneratedPagesPreviewPdf,
  getGeneratedPagesPreviewAvailability,
  getGeneratedPagesPreviewFilename,
  presentGeneratedPagesPreviewPdf,
} from "./resolutionPreview.js";
import { createDefaultResolutionPageConfig, validateResolutionPdfLayout } from "./resolutionSectionsModel.js";

const LETTERHEAD = { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), width: 1138, height: 1600 };
const OFFICIAL_LETTERHEAD = { bytes: new Uint8Array([0xff, 0xd8, 0x11, 0x22, 0xff, 0xd9]), width: 1138, height: 1600 };
const decode = (value) => new TextDecoder("latin1").decode(value);

function resolutionPageConfig({ heading = "RESOLUTION", statement = "Preview statement.", enabled = true } = {}) {
  const config = createDefaultResolutionPageConfig({ title: "Preview title", meetingDate: "2026-07-02" });
  return {
    ...config,
    enabled,
    heading: { ...config.heading, text: heading },
    mainStatement: { ...config.mainStatement, text: statement },
  };
}

function baseDetails({ resolution = {}, votes = [], canonicalVoters = [] } = {}) {
  const eligibleVoters = resolution.eligibleVoters || [{ uid: "u1", name: "Real Member", position: "Secretary" }];
  return {
    resolution: {
      id: "preview",
      status: "draft",
      resolutionNumber: "R/PREVIEW",
      title: "Preview title",
      meetingTitle: "BOD Meeting",
      meetingDate: "2026-07-02",
      appendVoteTable: true,
      eligibleVoters,
      eligibleVoterCount: eligibleVoters.length,
      votesReceivedCount: votes.length,
      approveCount: votes.filter((vote) => vote.choice === "approve").length,
      rejectCount: votes.filter((vote) => vote.choice === "reject").length,
      abstainCount: votes.filter((vote) => vote.choice === "abstain").length,
      resolutionPageConfig: resolutionPageConfig(),
      uploadedVotesTableConfig: {
        columns: { name: true, position: true, vote: true, timestamp: true, signature: false },
        voterScope: "all",
        showTitle: true,
        repeatHeader: true,
        showResultSummary: false,
      },
      generatedPageOrder: ["resolution_page", "vote_table"],
      ...resolution,
    },
    votes,
    canonicalVoters,
    audit: [],
  };
}

function textItems(pages) {
  return pages.flat().filter((item) => item.kind === "text").map((item) => item.text);
}

test("Generated pages preview uses current unsaved Resolution Page config", () => {
  const pages = buildGeneratedPagesPreviewPages({
    ...baseDetails({
      resolution: {
        resolutionPageConfig: resolutionPageConfig({
          heading: "UNSAVED LIVE HEADING",
          statement: "Unsaved live statement for layout testing.",
        }),
      },
    }),
    previewMode: "resolution_page",
  });
  const text = textItems(pages);
  assert.ok(text.includes("UNSAVED LIVE HEADING"));
  assert.ok(text.includes("Unsaved live statement for layout testing."));
});

test("Generated pages preview can build Resolution Page-only and Voting Table-only PDFs", () => {
  const resolutionOnly = buildGeneratedPagesPreviewPages({ ...baseDetails(), previewMode: "resolution_page" });
  assert.deepEqual([...new Set(resolutionOnly.map((page) => page.generatedKind))], ["resolution_page"]);

  const votingOnly = buildGeneratedPagesPreviewPages({
    ...baseDetails({ resolution: { resolutionPageConfig: resolutionPageConfig({ enabled: false }) } }),
    previewMode: "vote_table",
  });
  assert.deepEqual([...new Set(votingOnly.map((page) => page.generatedKind))], ["vote_table"]);
  assert.ok(textItems(votingOnly).includes("VOTING RECORD"));
});

test("All-enabled generated pages preview respects generated page order", () => {
  const pages = buildGeneratedPagesPreviewPages({
    ...baseDetails({ resolution: { generatedPageOrder: ["vote_table", "resolution_page"] } }),
    previewMode: "all",
  });
  assert.deepEqual(pages.map((page) => page.generatedKind), ["vote_table", "resolution_page"]);
});

test("Generated pages preview marks every page official and suppresses page numbers", () => {
  const pages = buildGeneratedPagesPreviewPages({ ...baseDetails(), previewMode: "all" });
  assert.ok(pages.length >= 2);
  assert.ok(pages.every((page) => page.letterhead === "official"));
  assert.ok(pages.every((page) => page.pageNumber === false));
});

test("Generated pages preview reports disabled generated-page selections", () => {
  const input = baseDetails({
    resolution: {
      appendVoteTable: false,
      resolutionPageConfig: resolutionPageConfig({ enabled: false }),
    },
  });
  const availability = getGeneratedPagesPreviewAvailability(input);
  assert.equal(availability.enabled, false);
  assert.match(availability.message, /Enable the Resolution Page or Voting Table/);
  assert.throws(() => buildGeneratedPagesPreviewPages({ ...input, previewMode: "all" }), /Enable the requested/);
});

test("Voting Table preview uses temporary rows only when no eligible voters exist", () => {
  const input = baseDetails({
    resolution: {
      eligibleVoters: [],
      eligibleVoterCount: 0,
      resolutionPageConfig: resolutionPageConfig({ enabled: false }),
      uploadedVotesTableConfig: {
        columns: { name: true, position: true, vote: true, timestamp: false, signature: false },
        voterScope: "submitted",
        showTitle: true,
        repeatHeader: true,
        showResultSummary: false,
      },
    },
  });
  const pages = buildGeneratedPagesPreviewPages({ ...input, previewMode: "vote_table" });
  const text = textItems(pages);
  assert.ok(text.includes("Rtr. Preview Member 1"));
  assert.ok(text.includes("Did not vote"));
  assert.equal(input.resolution.eligibleVoters.length, 0);
  assert.doesNotMatch(JSON.stringify(validateResolutionPdfLayout(input.resolution).payload), /Preview Member/);
});

test("Voting Table preview uses existing selected voters when no votes have been submitted", () => {
  const input = baseDetails({
    resolution: {
      eligibleVoters: [
        { uid: "u1", name: "Real Member One", position: "Secretary" },
        { uid: "u2", name: "Real Member Two", position: "Treasurer" },
      ],
      uploadedVotesTableConfig: {
        columns: { name: true, position: true, vote: true, timestamp: false, signature: false },
        voterScope: "submitted",
        showTitle: true,
        repeatHeader: true,
        showResultSummary: false,
      },
    },
  });
  const text = textItems(buildGeneratedPagesPreviewPages({ ...input, previewMode: "vote_table" }));
  assert.ok(text.includes("Rtr. Real Member One"));
  assert.ok(text.includes("Rtr. Real Member Two"));
  assert.ok(!text.includes("Preview Member 1"));
  assert.ok(text.includes("Did not") && text.includes("vote"));
});

test("Voting Table preview preserves submitted-vote scope when real votes exist", () => {
  const input = baseDetails({
    resolution: {
      eligibleVoters: [
        { uid: "u1", name: "Voting Member", position: "Secretary" },
        { uid: "u2", name: "Pending Member", position: "Treasurer" },
      ],
      uploadedVotesTableConfig: {
        columns: { name: true, position: true, vote: true, timestamp: false, signature: false },
        voterScope: "submitted",
        showTitle: true,
        repeatHeader: true,
        showResultSummary: false,
      },
    },
    votes: [{ voterUid: "u1", voterName: "Voting Member", voterPosition: "Secretary", choice: "approve", submittedAt: "2026-07-02T10:00:00.000Z" }],
  });
  const text = textItems(buildGeneratedPagesPreviewPages({ ...input, previewMode: "vote_table" }));
  assert.ok(text.includes("Rtr. Voting Member"));
  assert.ok(text.includes("Approve"));
  assert.ok(!text.includes("Rtr. Pending Member"));
});

test("Finalized generated pages preview uses frozen generated snapshots", () => {
  const pages = buildGeneratedPagesPreviewPages({
    ...baseDetails({
      resolution: {
        status: "passed",
        resolutionPageConfig: resolutionPageConfig({ heading: "MUTABLE HEADING", statement: "Mutable statement." }),
        finalizedResolutionPageConfigSnapshot: resolutionPageConfig({ heading: "FROZEN HEADING", statement: "Frozen statement." }),
        generatedPageOrder: ["resolution_page", "vote_table"],
        finalizedGeneratedPageOrderSnapshot: ["vote_table", "resolution_page"],
      },
    }),
    previewMode: "all",
  });
  const text = textItems(pages);
  assert.deepEqual(pages.map((page) => page.generatedKind), ["vote_table", "resolution_page"]);
  assert.ok(text.includes("FROZEN HEADING"));
  assert.ok(!text.includes("MUTABLE HEADING"));
});

test("Generated pages preview filenames are preview-only and mode-specific", () => {
  assert.equal(getGeneratedPagesPreviewFilename("all"), "resolution-generated-pages-preview.pdf");
  assert.equal(getGeneratedPagesPreviewFilename("resolution_page"), "resolution-page-preview.pdf");
  assert.equal(getGeneratedPagesPreviewFilename("vote_table"), "resolution-voting-table-preview.pdf");
});

test("Generated pages preview PDF uses official letterhead and no visible draft label", async () => {
  let officialLoaded = false;
  const result = await generateGeneratedPagesPreviewPdf(
    { ...baseDetails(), previewMode: "resolution_page" },
    {
      loadLetterhead: async () => LETTERHEAD,
      loadOfficialLetterhead: async () => {
        officialLoaded = true;
        return OFFICIAL_LETTERHEAD;
      },
    },
  );
  const pdf = decode(result.pdf);
  assert.equal(officialLoaded, true);
  assert.match(pdf, /^%PDF-1\.4/);
  assert.equal((pdf.match(/\/Subtype \/Image/g) || []).length, 2);
  assert.match(pdf, /\/OfficialBG Do/);
  assert.doesNotMatch(pdf, /DRAFT PREVIEW|Page \d+ of \d+/);
});

test("Generated pages preview module does not import resolution write services", () => {
  const source = readFileSync(new URL("./resolutionPreview.js", import.meta.url), "utf8");
  [
    "createResolutionDraft",
    "updateResolutionDraft",
    "updateResolutionPdfLayout",
    "openResolutionVoting",
    "closeResolutionVoting",
    "retryResolutionPdfMerge",
    "finalizeResolutionPdfUpload",
  ].forEach((name) => assert.doesNotMatch(source, new RegExp(name)));
});

function fakeDocument(clicks) {
  return {
    body: { appendChild() {} },
    createElement() {
      return {
        style: {},
        click() { clicks.push("click"); },
        remove() { clicks.push("remove"); },
      };
    },
  };
}

test("Opening a generated pages preview creates and revokes a Blob URL", async () => {
  const calls = [];
  const result = await presentGeneratedPagesPreviewPdf(
    { ...baseDetails(), previewMode: "resolution_page" },
    {
      action: "open",
      loadLetterhead: async () => LETTERHEAD,
      loadOfficialLetterhead: async () => OFFICIAL_LETTERHEAD,
      urlApi: {
        createObjectURL(blob) {
          assert.equal(blob.type, "application/pdf");
          calls.push("create");
          return "blob:preview";
        },
        revokeObjectURL(url) { calls.push(`revoke:${url}`); },
      },
      windowRef: {
        open(url) { calls.push(`open:${url}`); return {}; },
        setTimeout(callback, delay) { calls.push(`timer:${delay}`); callback(); },
      },
      documentRef: fakeDocument(calls),
      revokeDelayMs: 5,
    },
  );
  assert.equal(result.opened, true);
  assert.equal(result.downloaded, false);
  assert.deepEqual(calls, ["create", "open:blob:preview", "timer:5", "revoke:blob:preview"]);
});

test("Popup-blocked generated pages preview falls back to download and revokes the URL", async () => {
  const calls = [];
  const result = await presentGeneratedPagesPreviewPdf(
    { ...baseDetails(), previewMode: "vote_table" },
    {
      action: "open",
      loadLetterhead: async () => LETTERHEAD,
      loadOfficialLetterhead: async () => OFFICIAL_LETTERHEAD,
      urlApi: {
        createObjectURL() { calls.push("create"); return "blob:blocked"; },
        revokeObjectURL(url) { calls.push(`revoke:${url}`); },
      },
      windowRef: {
        open() { calls.push("blocked"); return null; },
        setTimeout(callback, delay) { calls.push(`timer:${delay}`); callback(); },
      },
      documentRef: fakeDocument(calls),
      revokeDelayMs: 3,
    },
  );
  assert.equal(result.opened, false);
  assert.equal(result.downloaded, true);
  assert.equal(result.popupBlocked, true);
  assert.deepEqual(calls, ["create", "blocked", "click", "remove", "timer:3", "revoke:blob:blocked"]);
});
