import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";
import { buildResolutionPagePdfPages } from "./resolutionCustomPdf.js";
import { buildResolutionPdfDocument, loadPoppinsForPages } from "./resolutionPdf.js";
import { POPPINS_METRICS } from "./resolutionPoppinsMetrics.js";
import { poppinsTextWidth, poppinsVariantsUsed, winAnsiCode } from "./resolutionPoppins.js";
import {
  RESOLUTION_FONTS,
  fillResolutionMajority,
  normalizeResolutionPageConfig,
  resolutionMajorityPercent,
  splitResolutionStatement,
  updateResolutionPageBlock,
} from "./resolutionSectionsModel.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const builderSource = read("../admin/resolutions/ResolutionPdfBuilder.jsx");
const adminSource = read("../admin/resolutions/ResolutionsModule.jsx");
const LETTERHEAD = { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), width: 1, height: 1 };
const decode = (bytes) => new TextDecoder("latin1").decode(bytes);
const pageText = (pages) => pages.flat().filter((line) => line.kind === "text").map((line) => line.text).join(" ");

const STATEMENT = "This is to resolve that we, the Board Members, with a majority of _____, have passed the Resolution.\n\nWe also resolve:\n- to open the account\n• to appoint two signatories";

function closed(overrides = {}) {
  return { id: "r1", status: "passed", approvalMethod: "website", approveCount: 9, votesReceivedCount: 11, eligibleVoterCount: 17, ...overrides };
}

test("Poppins is offered as a font, and the four font files and their widths ship with the site", () => {
  assert.ok(RESOLUTION_FONTS.includes("Poppins"));
  const config = normalizeResolutionPageConfig({ enabled: true, mainStatement: { text: "x", fontFamily: "Poppins" } });
  assert.equal(config.mainStatement.fontFamily, "Poppins");
  for (const file of ["Regular", "Bold", "Italic", "BoldItalic"]) {
    assert.ok(statSync(new URL(`../../../public/fonts/poppins/Poppins-${file}.ttf`, import.meta.url)).size > 100000, file);
  }
  assert.match(read("../../../public/fonts/poppins/OFL.txt"), /SIL Open Font License/);
  Object.values(POPPINS_METRICS).forEach((metrics) => assert.equal(metrics.widths.length, 224));
  assert.equal(winAnsiCode("•"), 0x95);
  assert.ok(poppinsTextWidth("Resolution", 12, true) > poppinsTextWidth("Resolution", 12, false));
});

test("the editor keeps the main statement exactly as typed: spaces, new lines, bullets and an empty box", () => {
  const typed = "First line \n\n- point one\n• point two\n";
  const editing = normalizeResolutionPageConfig({ enabled: true, version: 2, mainStatement: { text: typed } }, { title: "Bank signatories" }, { editing: true });
  assert.equal(editing.mainStatement.text, typed);
  const emptied = normalizeResolutionPageConfig({ enabled: true, version: 2, mainStatement: { text: "" } }, { title: "Bank signatories" }, { editing: true });
  assert.equal(emptied.mainStatement.text, "", "clearing the box no longer brings the default back");
  const typedDetails = normalizeResolutionPageConfig({ details: { subject: "", boardMembersPresent: "12 " } }, { title: "Bank signatories" }, { editing: true });
  assert.equal(typedDetails.details.subject, "");
  assert.equal(typedDetails.details.boardMembersPresent, "12 ");
  // Saving still trims, and an empty statement falls back to the default.
  assert.equal(normalizeResolutionPageConfig({ version: 2, mainStatement: { text: typed } }).mainStatement.text, typed.trim());
  assert.match(normalizeResolutionPageConfig({ version: 2, mainStatement: { text: "" } }, { title: "Bank signatories" }).mainStatement.text, /majority of _____/);
  // Paragraph blocks keep typed text as well.
  const [block] = updateResolutionPageBlock([{ id: "b1", type: "paragraph", text: "x" }], "b1", { text: "Line \n" });
  assert.equal(block.text, "Line \n");
  assert.match(builderSource, /normalizeResolutionPageConfig\(\{ \.\.\.config, \.\.\.changes \}, resolution, EDITING_TEXT\)/);
  assert.match(builderSource, /className="resolution-page-builder__statement" rows="10"/);
});

test("lines starting with -, * or • become bullet points; other lines stay as paragraphs", () => {
  assert.deepEqual(splitResolutionStatement("Intro\n- one\n* two\n• three\nAfter"), [
    { bullet: false, text: "Intro" },
    { bullet: true, text: "one\ntwo\nthree" },
    { bullet: false, text: "After" },
  ]);
  assert.deepEqual(splitResolutionStatement("-not a bullet"), [{ bullet: false, text: "-not a bullet" }]);
});

test("the majority percentage is approvals out of the board members present", () => {
  assert.equal(resolutionMajorityPercent({ approveCount: 9, boardMembersPresent: "12" }), "75%");
  assert.equal(resolutionMajorityPercent({ approveCount: 8, boardMembersPresent: " 11 " }), "72.73%");
  assert.equal(resolutionMajorityPercent({ approveCount: 9, boardMembersPresent: "", votesReceivedCount: 11 }), "81.82%", "falls back to the members who voted");
  assert.equal(resolutionMajorityPercent({ approveCount: 9, boardMembersPresent: "twelve", votesReceivedCount: 0 }), "");
  assert.equal(fillResolutionMajority("with a majority of _____, have passed", closed(), { boardMembersPresent: "12" }), "with a majority of 75%, have passed");
  assert.equal(fillResolutionMajority("majority of ____%", closed(), { boardMembersPresent: "12" }), "majority of 75%");
  assert.equal(fillResolutionMajority("majority of _____", closed({ status: "open" }), { boardMembersPresent: "12" }), "majority of _____", "only after voting closes");
  assert.equal(fillResolutionMajority("majority of _____", closed({ approvalMethod: "record_only" }), {}), "majority of _____");
});

test("the final Resolution Page fills the percentage and prints bullet points; drafts keep the blank", () => {
  const config = { enabled: true, version: 2, details: { boardMembersPresent: "12", totalBoardMembers: "17" }, mainStatement: { text: STATEMENT } };
  const finalText = pageText(buildResolutionPagePdfPages({ resolution: closed() }, config));
  assert.match(finalText, /majority of 75%, have passed/);
  assert.match(finalText, /• to open the account/);
  assert.match(finalText, /• to appoint two signatories/);
  const draftText = pageText(buildResolutionPagePdfPages({ resolution: closed({ status: "draft" }) }, config));
  assert.match(draftText, /majority of _____/);
});

test("Poppins is embedded as a TrueType font only when used, and bullets are encoded", async () => {
  const config = { enabled: true, version: 2, mainStatement: { text: STATEMENT, fontFamily: "Poppins", bold: true }, heading: { text: "RESOLUTION", fontFamily: "Helvetica", bold: true } };
  const pages = buildResolutionPagePdfPages({ resolution: closed() }, config).map((page) => Object.assign(page, { letterhead: "default" }));
  assert.deepEqual(poppinsVariantsUsed(pages), ["bold"]);
  const details = { resolution: closed({ title: "Bank", resolutionNumber: "R/1", meetingTitle: "BOD 4", meetingDate: "2026-10-20", eligibleVoters: [], appendVoteTable: false }), votes: [], audit: [] };
  assert.throws(() => buildResolutionPdfDocument(details, LETTERHEAD, { pages }), /Poppins font is required/);
  const fontBytes = new Uint8Array([0, 1, 0, 0, 7, 7, 7]);
  const pdf = decode(buildResolutionPdfDocument(details, LETTERHEAD, { pages, poppinsFonts: { bold: fontBytes } }));
  assert.match(pdf, /\/Subtype \/TrueType \/BaseFont \/Poppins-Bold \/FirstChar 32 \/LastChar 255 \/Widths \[/);
  assert.match(pdf, /\/FontFile2 \d+ 0 R/);
  assert.match(pdf, /\/Length 7 \/Length1 7 >>/);
  assert.match(pdf, /\/P2 \d+ 0 R/);
  assert.match(pdf, /BT \/P2 12 Tf [\d.]+ [\d.]+ Td \(\\225 to open the account\) Tj ET/);
  assert.match(pdf, /\/BaseFont \/Helvetica-Bold \/Encoding \/WinAnsiEncoding/);
  assert.doesNotMatch(pdf, /Poppins-Regular|Poppins-Italic/);
  // Loading fetches only the styles in use.
  const requested = [];
  const fonts = await loadPoppinsForPages(pages, { loadPoppinsFonts: async (variants) => { requested.push(...variants); return { bold: fontBytes }; } });
  assert.deepEqual(requested, ["bold"]);
  assert.equal(fonts.bold, fontBytes);
  assert.deepEqual(await loadPoppinsForPages([[{ kind: "text", fontFamily: "Helvetica" }]], { loadPoppinsFonts: () => assert.fail("not needed") }), {});
});

test("the prepared email is signed by the current President with the RIY", () => {
  assert.match(adminSource, /function currentPresidentName\(roster\)/);
  assert.match(adminSource, /position\.trim\(\)\.toLowerCase\(\) === "president"/);
  assert.match(adminSource, /presidentName \? formatRotaractorName\(presidentName, true\) : "Rtr\. \[PRESIDENT NAME\]"/);
  assert.match(adminSource, /`President \| RIY \$\{resolutionRiyLabel\(meeting\?\.date\)\}`/);
  assert.match(adminSource, /const start = month >= 7 \? year : year - 1;\s*return `\$\{start\}-\$\{start \+ 1\}`;/);
});
