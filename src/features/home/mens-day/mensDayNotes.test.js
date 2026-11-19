import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getRouteMetadata } from "../../../app/metadataModel.js";
import { SECTION_ID, featuredEventBadge, notePreview, notes, sectionDetails } from "./mensDayNotesData.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const sectionSource = read("./MensDayNotesSection.jsx");
const homePageSource = read("../../../pages/public/HomePage.jsx");
const layoutSource = read("../../../components/layout/PublicLayout.jsx");

test("twelve notes, one per person, with paper and tilt", () => {
  assert.equal(notes.length, 12);
  assert.equal(new Set(notes.map((note) => note.id)).size, 12);
  for (const note of notes) {
    assert.ok(note.name && note.paragraphs.length > 0, `${note.id} needs text`);
    assert.ok(note.paper && typeof note.tilt === "number");
  }
});

test("notes stay anonymous and keep the agreed edits", () => {
  const all = JSON.stringify(notes);
  assert.match(sectionSource, /From someone at Heritage/);
  assert.match(all, /a\*\* really needs/);
  assert.match(all, /d\*\*b in the head/);
  assert.match(all, /bounce back after a tough time/);
  assert.match(all, /birthday twin/);
  assert.doesNotMatch(all, /accident|hospital/i);
});

test("preview skips the greeting and trims long text", () => {
  const preview = notePreview(notes[0]);
  assert.ok(!preview.startsWith("Happy International"));
  assert.ok(preview.length <= 141);
});

test("home page and header point to the Men's Day section", () => {
  assert.equal(SECTION_ID, "mens-day");
  assert.equal(featuredEventBadge.label, "Men's Day");
  assert.equal(featuredEventBadge.to, "/#mens-day");
  assert.match(homePageSource, /<MensDayNotesSection \/>/);
  assert.match(layoutSource, /mens-day\/mensDayNotesData/);
  assert.match(sectionSource, /id=\{SECTION_ID\}/);
  assert.equal(sectionDetails.lede, undefined, "no intro line under the title");
});

test("phone cycles four notes every five seconds and can show all", () => {
  assert.match(sectionSource, /const PAGE_SIZE = 4;/);
  assert.match(sectionSource, /const CYCLE_MS = 5000;/);
  assert.match(sectionSource, /Open more notes/);
  assert.match(sectionSource, /Open a random note/);
});

test("note dialog is accessible and read state survives blocked storage", () => {
  assert.match(sectionSource, /role="dialog"/);
  assert.match(sectionSource, /aria-modal="true"/);
  assert.match(sectionSource, /useAccessibleDialog/);
  assert.match(sectionSource, /catch \{/);
});

test("Wings of Honour archive page is hidden from search engines", () => {
  const metadata = getRouteMetadata("/archive/wings-of-honour");
  assert.equal(metadata.robots, "noindex, nofollow");
  assert.equal(metadata.isPublic, false);
});

test("header badge scrolls again when clicked while already on #mens-day", () => {
  assert.match(layoutSource, /\[location\.hash, location\.pathname, location\.key\]/);
});
