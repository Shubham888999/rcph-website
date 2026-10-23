import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CITIES, CLUB_DIRECTORY, findClub, normalizeClubName } from "./clubDirectory.js";
import { buildCollaborationGeography } from "./collaborationGeography.js";
import { INDIA_MAP_SIZE, projectToIndiaMap } from "./indiaMapProjection.js";
import { INDIA_OUTLINE_PATH, INDIA_STATE_PATHS } from "./indiaMapPaths.js";
import { normalizeVisitDashboardData } from "../visits/visitDashboardModel.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const mapSource = read("./CollaborationMap.jsx");
const projectionSource = read("./indiaMapProjection.js");
const pageSource = read("../../pages/visits/VisitDashboardPage.jsx");

const wingsOfHonour = {
  eventId: "woh",
  name: "Wings of Honour",
  date: "2026-10-08",
  rcphRole: "host",
  partners: [
    "Rotaract Club of RSCOE", "Rotaract Club of Pune Westside", "Rotaract Club of Pune Shaniwarwada",
    "Rotaract Club of Pune Aurora", "Rotaract Club of SSPU", "Rotaract Club of GSMCOE", "Rotaract Club of Roar NIBM",
    "Rotaract Club of Bhubaneshwar Jaydev (RID 3262)", "Rotaract Club of Lead India Ahead (RID 3206)",
    "Rotaract Club of Curchorem-Sanvordem (RID 3170)", "Rotaract Club of RVCE (RID 3191)",
    "Rotaract Club of Mount Carmel (Deemed to be University) (RID 3191)", "Rotaract Club of Mumbai DownTown (RID 3141)",
    "Rotaract Club of Mumbai Juhu Youth",
  ].map((name) => ({ name, relation: "collaborator" })),
};

test("club names normalise away prefixes, districts and punctuation", () => {
  assert.equal(normalizeClubName("Rotaract Club of R.V.C.E. (RID 3191)"), "rvce");
  assert.equal(normalizeClubName("RC Bhubaneshwar Jaydev"), "bhubaneshwar jaydev");
  assert.equal(normalizeClubName("RAC Curchorem-Sanvordem"), "curchorem sanvordem");
  assert.equal(normalizeClubName("Rotaract Club of Mount Carmel (Deemed to be University)"), "mount carmel");
});

test("free-text collaborator names find the right club", () => {
  const cases = {
    "Rotaract Club of RSCOE": "rscoe",
    "rac Mount Carmel": "mount-carmel",
    "RC Bhubaneswar Jaydev (RID 3262)": "bhubaneshwar-jaydev",
    "Rotaract Club of Rajarshi Shahu College of Engineering, Tathawade": "rscoe",
    "Rotaract Club of Mumbai DownTown": "mumbai-downtown",
    "Rotaract Club of Mumbai Juhu Youth": "mumbai-juhu-youth",
    "Rotaract club of LIA (Lead India Ahead)": "lead-india-ahead",
    "Rotaract Club of Pune Westside": "pune-westside",
    "Rotaract Club of Mumbai Medico Marvels": "mumbai-medico-marvels",
    "Rotaract Club of Pune Mdeast": "pune-mideast",
    "Rotaract Club of Pune-Baner": "pune-baner",
    "Rotaract Club of Pune Baner": "pune-baner",
    "Rotaract Club of Pune Nigdi": "pune-nigdi",
    "Rotaract Club of Pune Camp Pioneer": "pune-camp-pioneer",
    "Rotary district 3131": "rotary-district-3131",
    "Rotaract Club of Belgaum Yuva Darpan": "belgaum-yuva-darpan",
  };
  for (const [name, key] of Object.entries(cases)) {
    assert.equal(findClub(name)?.key, key, name);
  }
  assert.equal(findClub("Rotaract Club of Somewhere New"), null);
  assert.equal(findClub(""), null);
});

test("every directory club points at a known city", () => {
  for (const club of CLUB_DIRECTORY) {
    assert.ok(CITIES[club.cityKey], `${club.key} uses unknown city ${club.cityKey}`);
    assert.match(club.district, /^RID \d{4}$/);
  }
});

test("Wings of Honour groups into six cities and six districts", () => {
  const geography = buildCollaborationGeography([wingsOfHonour]);

  assert.deepEqual(geography.summary, { eventCount: 1, clubCount: 14, cityCount: 6, districtCount: 6 });
  assert.equal(geography.unplaced.length, 0);
  assert.equal(geography.cities[0].key, "pune", "the busiest city comes first");
  assert.equal(geography.cities[0].clubs.length, 7);
  assert.equal(geography.home.key, "pune");
});

test("unknown clubs stay listed as unplaced and repeat events do not duplicate", () => {
  const geography = buildCollaborationGeography([
    { eventId: "a", name: "A", date: "2026-08-01", rcphRole: "participant", partners: [{ name: "Rotaract Club of Nowhere", relation: "host" }, { name: "RC RVCE", relation: "collaborator" }] },
    { eventId: "b", name: "B", date: "2026-09-01", rcphRole: "host", partners: [{ name: "Rotaract Club of RVCE", relation: "collaborator" }] },
  ]);

  assert.deepEqual(geography.unplaced.map((club) => club.name), ["Rotaract Club of Nowhere"]);
  const bengaluru = geography.cities.find((city) => city.key === "bengaluru");
  assert.equal(bengaluru.clubs.length, 1);
  assert.deepEqual(bengaluru.clubs[0].events.map((event) => event.eventId), ["a", "b"]);
  assert.equal(geography.summary.clubCount, 2);
});

test("a Rotary district is a partner but not counted as a club or district, and spellings merge", () => {
  const geography = buildCollaborationGeography([
    { eventId: "c", name: "CONCORD", date: "2026-09-06", rcphRole: "host", partners: [
      { name: "Rotaract Club of Pune-Baner", relation: "collaborator" },
      { name: "Rotaract Club of Pune Baner", relation: "collaborator" },
      { name: "Rotary district 3131", relation: "collaborator" },
    ] },
  ]);

  const pune = geography.cities.find((city) => city.key === "pune");
  assert.equal(pune.clubCount, 1);
  assert.deepEqual(pune.clubs.map((club) => [club.name, club.kind]), [["Pune Baner", "club"], ["Rotary District 3131", "organization"]]);
  assert.equal(geography.summary.clubCount, 1);
  assert.equal(geography.summary.districtCount, 1);
});

test("map legend names Pune and partner clubs without extra wording", () => {
  assert.doesNotMatch(mapSource, /home of/);
  assert.doesNotMatch(mapSource, /larger means/);
  assert.match(mapSource, /Rotaract Club of \$\{club\.name\}/);
});

test("cities project inside the map", () => {
  for (const city of Object.values(CITIES)) {
    const { x, y } = projectToIndiaMap(city.latitude, city.longitude);
    assert.ok(x > 0 && x < INDIA_MAP_SIZE.width && y > 0 && y < INDIA_MAP_SIZE.height, city.city);
  }
});

test("map outlines include the official boundary and every state and union territory", () => {
  assert.ok(INDIA_OUTLINE_PATH.startsWith("M"));
  assert.equal(INDIA_STATE_PATHS.length, 36);
  const names = INDIA_STATE_PATHS.map((state) => state.name);
  for (const name of ["Ladakh", "Jammu & Kashmir", "Arunachal Pradesh", "Andaman & Nicobar", "Lakshadweep", "Maharashtra"]) {
    assert.ok(names.includes(name), name);
  }
  // Ladakh reaches the top of the map (37.08 N), as on the official map.
  const ladakh = INDIA_STATE_PATHS.find((state) => state.name === "Ladakh").d;
  const minY = Math.min(...[...ladakh.matchAll(/[ML][\d.]+,([\d.]+)/g)].map((match) => Number(match[1])));
  assert.ok(minY < 10, `Ladakh top at y=${minY}`);
});

test("outlines load lazily and the map credits its source", () => {
  assert.match(projectionSource, /import\("\.\/indiaMapPaths\.js"\)/);
  assert.doesNotMatch(mapSource, /from "\.\/indiaMapPaths/);
  assert.match(mapSource, /Map data: DataMeet/);
});

test("visit dashboard data keeps collaborations only when the backend sends them", () => {
  assert.equal(normalizeVisitDashboardData({}).collaborations, null);

  const data = normalizeVisitDashboardData({
    collaborations: [
      { eventId: "e1", name: "Wings of Honour", date: "2026-10-08", rcphRole: "host", avenueCodes: ["ISD"], partners: [{ name: "Rotaract Club of RSCOE", relation: "collaborator" }, { name: "rotaract club of rscoe" }] },
      { eventId: "bad", name: "No date", date: "", partners: [{ name: "X" }] },
      { eventId: "solo", name: "No partners", date: "2026-08-01", partners: [] },
      { eventId: "e2", name: "Joint GBM", date: "2026-11-01", rcphRole: "nonsense", partners: [{ name: "Rotaract Club of SSPU", relation: "host" }] },
    ],
  });

  assert.deepEqual(data.collaborations.rows.map((row) => row.eventId), ["e2", "e1"]);
  assert.equal(data.collaborations.rows[0].rcphRole, "host");
  assert.equal(data.collaborations.rows[1].partners.length, 1);
});

test("visit page shows Collaborations after letterhead exchanges, collapsed, with a nested list", () => {
  const letterhead = pageSource.indexOf("<LetterheadExchanges letterhead={letterhead} />");
  const collaborations = pageSource.indexOf("<Collaborations collaborations={collaborations} />");
  const fines = pageSource.indexOf("<FinesRecords fines={fines} />");
  assert.ok(letterhead !== -1 && collaborations > letterhead && fines > collaborations);
  assert.match(pageSource, /id="visit-dashboard-collaborations"/);
  assert.match(pageSource, /\{open \? \(\s*<CollaborationMap/);
  assert.match(pageSource, /<details className="visit-dashboard-collab-list">/);
  assert.doesNotMatch(pageSource, /<details className="visit-dashboard-collab-list" open/);
});
