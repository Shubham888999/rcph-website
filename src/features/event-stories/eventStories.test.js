import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getRouteMetadata } from "../../app/metadataModel.js";
import {
  EVENT_STORIES_PATH,
  eventStories,
  findStoryForEvent,
  findStoryForProject,
  getEventStory,
  storiesNewestFirst,
  storyPath,
} from "./eventStories.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const loaders = read("./eventStoryLoaders.js");
const router = read("../../app/router.jsx");

test("every story has a unique slug, a valid date and a page component", () => {
  assert.equal(new Set(eventStories.map((story) => story.slug)).size, eventStories.length);
  for (const story of eventStories) {
    assert.match(story.slug, /^[a-z0-9-]+-\d{4}$/, `${story.slug} should end with its year`);
    assert.match(story.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(story.title && story.summary && story.seoTitle && story.seoDescription);
    assert.ok(story.card?.background && story.card?.color);
    assert.match(loaders, new RegExp(`"${story.slug}": lazy\\(`), `${story.slug} needs a component`);
  }
});

test("story pages are public, indexable and carry their own title", () => {
  for (const story of eventStories) {
    const metadata = getRouteMetadata(storyPath(story));
    assert.equal(metadata.robots, "index, follow");
    assert.equal(metadata.title, story.seoTitle);
    assert.equal(metadata.canonical, `https://rcph3131.org/events/${story.slug}`);
  }
  assert.equal(getRouteMetadata(EVENT_STORIES_PATH).robots, "index, follow");
  assert.equal(getRouteMetadata("/events/not-a-story-2026").robots, "noindex, nofollow");
});

test("Wings of Honour shares with its banner image", () => {
  const metadata = getRouteMetadata("/events/wings-of-honour-2026");
  assert.equal(metadata.image, "https://rcph3131.org/media/wings-of-honour/00-banner-card.webp");
  assert.equal(metadata.type, "article");
});

test("events from BOD Tools match their story by name and date only", () => {
  assert.equal(findStoryForEvent({ name: "Wings of Honour", date: "2026-10-08" })?.slug, "wings-of-honour-2026");
  assert.equal(findStoryForEvent({ name: "  wings OF honour ", date: "2026-10-08" })?.slug, "wings-of-honour-2026");
  assert.equal(findStoryForEvent({ name: "Wings of Honour", date: "2027-10-08" }), null);
  assert.equal(findStoryForEvent({ name: "Monthly GBM", date: "2026-10-08" }), null);
  assert.equal(findStoryForEvent(null), null);
  assert.equal(findStoryForProject({ title: "Omnivorous Potluck" }), null);
});

test("gallery sorts newest first and lookups handle unknown slugs", () => {
  const dates = storiesNewestFirst().map((story) => story.date);
  assert.deepEqual(dates, [...dates].sort().reverse());
  assert.equal(getEventStory("nope"), null);
});

test("router serves the gallery before the story route", () => {
  assert.ok(router.indexOf('path: "/events/stories"') < router.indexOf('path: "/events/:slug"'));
});

test("Events page shows the event stories section after upcoming events", () => {
  const eventsPage = read("../../pages/public/EventsPage.jsx");
  assert.match(eventsPage, /^import EventStories from/m);
  assert.ok(eventsPage.indexOf("<EventStories />") > eventsPage.indexOf('title="Upcoming Events"'));
  assert.ok(eventsPage.indexOf("<EventStories />") < eventsPage.indexOf('title="Recent Events"'));
  assert.doesNotMatch(read("../events/EventStories.jsx"), /Pages of Hope/);
});

test("every organiser on every story page has a title under their name", async () => {
  const { clubOfficers } = await import("./clubOfficers.js");
  for (const [key, officer] of Object.entries(clubOfficers)) {
    assert.match(officer.name, /^Rtr\. /, `${key} needs a full name`);
    assert.ok(officer.role.trim(), `${key} needs a title`);
  }
  const { readdirSync } = await import("node:fs");
  const files = readdirSync(new URL("./stories/", import.meta.url)).filter((file) => file.endsWith("Story.jsx"));
  for (const file of files) {
    const source = read(`./stories/${file}`);
    if (!/conductedBy/.test(source)) continue;
    assert.doesNotMatch(source, /role: ""/, `${file} has an organiser without a title`);
    assert.doesNotMatch(source, /person\.role \?/, `${file} hides missing titles`);
  }
  const { mahadaanDrives } = await import("./stories/mahadaan/mahadaanDrives.js");
  for (const drive of mahadaanDrives) for (const person of drive.conductedBy) assert.ok(person.role);
});
