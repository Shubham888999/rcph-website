import assert from "node:assert/strict";
import test from "node:test";
import { buildCustomResolutionPdfPages, buildCustomVotesRows, getResolutionRenderLayout } from "./resolutionCustomPdf.js";
import { RESOLUTION_CONTENT_BOUNDS, buildResolutionPdfDocument, buildResolutionPdfPages } from "./resolutionPdf.js";
import { createCustomResolutionPdfFixtures } from "./resolutionPdfFixture.js";
import { createDefaultResolutionPageConfig, normalizeResolutionSection } from "./resolutionSectionsModel.js";

const LETTERHEAD = { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), width: 1138, height: 1600 };
const OFFICIAL_LETTERHEAD = { bytes: new Uint8Array([0xff, 0xd8, 0x11, 0x22, 0xff, 0xd9]), width: 1138, height: 1600 };
const decode = (value) => new TextDecoder("latin1").decode(value);

test("custom fixture set covers one page, two pages, long tables, votes variants, forced break, and standard control", () => {
  const fixtures = createCustomResolutionPdfFixtures();
  assert.equal(buildResolutionPdfPages(fixtures.onePageParagraph).length, 1);
  assert.equal(buildResolutionPdfPages(fixtures.twoPageParagraphs).length, 2);
  assert.ok(buildResolutionPdfPages(fixtures.multiPageTable).length > 2);
  assert.ok(buildResolutionPdfPages(fixtures.votesWithoutSignature).length > 1);
  assert.ok(buildResolutionPdfPages(fixtures.votesWithSignature).length > 1);
  assert.equal(buildResolutionPdfPages(fixtures.forcedPageBreak).length, 2);
  assert.ok(buildResolutionPdfPages(fixtures.standardControl).length >= 1);
});

test("finalized custom PDFs use the frozen snapshot while previews use mutable sections", () => {
  const fixtures = createCustomResolutionPdfFixtures();
  const details = structuredClone(fixtures.onePageParagraph);
  details.resolution.pdfSections[0].text = "Mutable text";
  assert.equal(getResolutionRenderLayout(details).sections[0].text, "A concise one-page custom resolution paragraph.");
  assert.equal(getResolutionRenderLayout(details, true).sections[0].text, "Mutable text");
  assert.equal(getResolutionRenderLayout(fixtures.standardControl).mode, "standard");
});

test("custom headings and paragraphs support alignment, variants, underline, lists, and safe wrapping", () => {
  const sections = [
    normalizeResolutionSection({ id: "left", type: "heading", text: "Left", style: { fontFamily: "Helvetica", fontSize: 12, bold: true, italic: true, underline: true, alignment: "left" } }),
    normalizeResolutionSection({ id: "center", type: "heading", text: "Centered", style: { fontFamily: "Times Roman", fontSize: 12, alignment: "center" } }),
    normalizeResolutionSection({ id: "right", type: "heading", text: "Right", style: { fontFamily: "Courier", fontSize: 12, alignment: "right" } }),
    normalizeResolutionSection({ id: "bullets", type: "paragraph", text: "First item\nSecond item", listStyle: "bullet", style: { fontFamily: "Helvetica", fontSize: 10, alignment: "left", lineSpacing: 1.4, spaceBefore: 4, spaceAfter: 6 } }),
    normalizeResolutionSection({ id: "numbers", type: "paragraph", text: "First\nSecond\n".repeat(120), listStyle: "numbered", style: { fontFamily: "Helvetica", fontSize: 10, alignment: "left" } }),
  ];
  const pages = buildCustomResolutionPdfPages({ resolution: {}, votes: [] }, sections);
  assert.ok(pages.length > 1);
  const text = pages.flat().filter((item) => item.kind === "text");
  assert.equal(text.find((item) => item.text === "Left").x, RESOLUTION_CONTENT_BOUNDS.left);
  assert.ok(text.find((item) => item.text === "Centered").x > RESOLUTION_CONTENT_BOUNDS.left);
  assert.ok(text.find((item) => item.text === "Right").x > text.find((item) => item.text === "Centered").x);
  assert.equal(text.find((item) => item.text === "Left").underline, true);
  assert.ok(text.some((item) => item.text.startsWith("1. ")));
  assert.ok(text.some((item) => item.text.includes("First item")));
  text.forEach((item) => { assert.ok(item.x >= RESOLUTION_CONTENT_BOUNDS.left); assert.ok(item.x + item.width <= RESOLUTION_CONTENT_BOUNDS.right + 1); assert.ok(item.y >= RESOLUTION_CONTENT_BOUNDS.bottom); assert.ok(item.y <= RESOLUTION_CONTENT_BOUNDS.top); });
});

test("custom tables wrap rows intact, normalize widths, repeat headers, and never cross the footer", () => {
  const fixture = createCustomResolutionPdfFixtures().multiPageTable;
  const pages = buildResolutionPdfPages(fixture);
  assert.ok(pages.length > 1);
  for (const page of pages) {
    const itemHeaders = page.filter((item) => item.kind === "text" && item.text === "Item");
    assert.equal(itemHeaders.length, 1);
    page.forEach((item) => {
      if (item.kind === "text") assert.ok(item.y >= RESOLUTION_CONTENT_BOUNDS.bottom);
      else assert.ok(Math.min(item.y1, item.y2) >= RESOLUTION_CONTENT_BOUNDS.bottom);
    });
  }
});

test("Votes Table derives safe authoritative rows for submitted and all-voter scopes", () => {
  const details = createCustomResolutionPdfFixtures().votesWithSignature;
  details.canonicalVoters = [{ uid: "older", name: "Canonical Name", position: "Canonical Position" }];
  details.resolution.eligibleVoters.push({ uid: "older", name: "", position: "" }, { uid: "missing", name: "Known Name", position: "" });
  const section = details.resolution.finalizedPdfSectionsSnapshot[0];
  let rows = buildCustomVotesRows(details, section);
  assert.equal(rows.at(-2).position, "Canonical Position");
  assert.equal(rows.at(-1).position, "Not available");
  assert.equal(rows.at(-1).vote, "Did not vote");
  assert.equal(rows.at(-1).timestamp, "—");
  assert.ok(rows.every((row) => row.signature === ""));
  const submitted = { ...section, options: { ...section.options, voterScope: "submitted" } };
  rows = buildCustomVotesRows(details, submitted);
  assert.equal(rows.length, details.votes.length);
  assert.ok(rows.every((row) => ["Approve", "Reject", "Abstain"].includes(row.vote)));
});

test("Votes Table supports selected columns, Signature space, repeated headers, summaries, and no private identifiers", () => {
  const fixture = createCustomResolutionPdfFixtures().votesWithSignature;
  fixture.votes[0].email = "private@example.test";
  const pages = buildResolutionPdfPages(fixture);
  assert.ok(pages.length > 1);
  pages.forEach((page) => assert.equal(page.filter((item) => item.kind === "text" && item.text === "Signature").length, 1));
  const pdf = decode(buildResolutionPdfDocument(fixture, LETTERHEAD));
  assert.match(pdf, /Voting Record/);
  assert.match(pdf, /Approve count:/);
  assert.doesNotMatch(pdf, /fixture-0|private@example\.test|_+\)/);
  assert.equal((pdf.match(/\/Subtype \/Image/g) || []).length, 1);
  assert.equal((pdf.match(/595 0 0 842 0 0 cm\n\/BG Do/g) || []).length, pages.length);
  assert.match(pdf, new RegExp(`Page ${pages.length} of ${pages.length}`));
});

test("Votes Table supports a Name-only layout with result summary disabled", () => {
  const fixture = createCustomResolutionPdfFixtures().votesWithoutSignature;
  const section = fixture.resolution.finalizedPdfSectionsSnapshot[0];
  section.columns = { name: true, position: false, vote: false, timestamp: false, signature: false };
  section.options.showResultSummary = false;
  fixture.resolution.pdfSections = structuredClone(fixture.resolution.finalizedPdfSectionsSnapshot);
  const text = buildResolutionPdfPages(fixture).flat().filter((item) => item.kind === "text").map((item) => item.text);
  assert.ok(text.includes("Name"));
  assert.ok(!text.includes("Position"));
  assert.ok(!text.includes("Vote"));
  assert.ok(!text.includes("Timestamp"));
  assert.ok(!text.some((value) => value.startsWith("Approve count:")));
});

test("generated Resolution Page and vote table use official letterhead without page numbers", () => {
  const details = {
    resolution: {
      status: "passed",
      result: "passed",
      resolutionNumber: "RCPH/RES/1",
      title: "Official page test",
      meetingTitle: "BOD Meeting",
      meetingDate: "2026-07-02",
      body: "",
      notes: "",
      appendVoteTable: true,
      eligibleVoters: [{ uid: "u1", name: "Member One", position: "Secretary" }],
      eligibleVoterCount: 1,
      votesReceivedCount: 1,
      approveCount: 1,
      rejectCount: 0,
      abstainCount: 0,
      uploadedVotesTableConfig: { columns: { name: true, position: true, vote: true, timestamp: false, signature: false }, voterScope: "all", showTitle: true, repeatHeader: true, showResultSummary: true },
      resolutionPageConfig: { ...createDefaultResolutionPageConfig({ title: "Official page test", meetingDate: "2026-07-02" }), blocks: [{ id: "p1", type: "paragraph", text: "Additional official paragraph.", style: { fontFamily: "Times Roman", fontSize: 11, alignment: "left" } }] },
      generatedPageOrder: ["vote_table", "resolution_page"],
    },
    votes: [{ voterUid: "u1", voterName: "Member One", voterPosition: "Secretary", choice: "approve", submittedAt: "2026-07-02T10:00:00.000Z" }],
  };
  const pages = buildResolutionPdfPages(details);
  const generated = pages.filter((page) => page.letterhead === "official");
  assert.deepEqual(generated.map((page) => page.generatedKind), ["vote_table", "resolution_page"]);
  assert.ok(generated.every((page) => page.pageNumber === false));
  assert.ok(generated[1].some((line) => line.text === "RESOLUTION"));
  const pdf = decode(buildResolutionPdfDocument(details, LETTERHEAD, { officialLetterhead: OFFICIAL_LETTERHEAD }));
  assert.equal((pdf.match(/\/Subtype \/Image/g) || []).length, 2);
  assert.match(pdf, /\/F6 \d+ 0 R/);
  assert.match(pdf, /\/F7 \d+ 0 R/);
  assert.equal((pdf.match(/595 0 0 842 0 0 cm\n\/OfficialBG Do/g) || []).length, generated.length);
  assert.equal((pdf.match(/Page \d+ of \d+/g) || []).length, pages.length - generated.length);
  assert.doesNotMatch(pdf, /Page 2 of 3/);
});

test("forced breaks create a full next page without an unnecessary blank final page", () => {
  const fixture = createCustomResolutionPdfFixtures().forcedPageBreak;
  const pages = buildResolutionPdfPages(fixture);
  assert.equal(pages.length, 2);
  assert.ok(pages[0].some((item) => item.text === "Before the forced break."));
  assert.ok(pages[1].some((item) => item.text === "After the forced break."));
  assert.ok(pages.every((page) => page.length));
});

test("a heading moves with room for at least two following normal lines", () => {
  const lead = normalizeResolutionSection({ id: "lead", type: "paragraph", text: "Fill this page with safely wrapped content. ".repeat(70), listStyle: "none", style: { fontFamily: "Helvetica", fontSize: 10, alignment: "left", lineSpacing: 1.25, spaceBefore: 0, spaceAfter: 0 } });
  const heading = normalizeResolutionSection({ id: "kept", type: "heading", text: "Kept heading", style: { fontFamily: "Helvetica", fontSize: 14, bold: true, alignment: "left", spaceBefore: 0, spaceAfter: 8 } });
  const following = normalizeResolutionSection({ id: "following", type: "paragraph", text: "First following line.\nSecond following line.", listStyle: "none", style: { fontFamily: "Helvetica", fontSize: 10, alignment: "left", lineSpacing: 1.25, spaceBefore: 0, spaceAfter: 0 } });
  const pages = buildCustomResolutionPdfPages({ resolution: {}, votes: [] }, [lead, heading, following]);
  const pageIndex = pages.findIndex((page) => page.some((item) => item.text === "Kept heading"));
  const headingPage = pages[pageIndex];
  assert.ok(headingPage.some((item) => item.text === "First following line."));
  assert.ok(headingPage.some((item) => item.text === "Second following line."));
});

test("an oversized indivisible table row is rejected before it can overlap the footer", () => {
  const section = normalizeResolutionSection({ id: "huge", type: "table", columns: [{ width: 100 }], rows: [["Header"], ["word ".repeat(10000)]], options: { hasHeaderRow: true, repeatHeader: true, showBorders: true }, style: { fontSize: 20, cellPadding: 12 } });
  assert.throws(() => buildCustomResolutionPdfPages({ resolution: {}, votes: [] }, [section]), /too tall|taller/i);
});
