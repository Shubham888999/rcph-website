import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeVisitDashboardData } from "./visitDashboardModel.js";
import { buildVisitPresentationSlides } from "./visitPresentationModel.js";
import { buildVisitClubRoster } from "./visitRosterModel.js";

const presentationSource = readFileSync(new URL("../../pages/visits/VisitPresentation.jsx", import.meta.url), "utf8");

function data(people) {
  return normalizeVisitDashboardData({
    visit: { visitName: "DZR Visit" },
    attendance: { club: { columns: [], rows: people.map(([name, roleOrPosition], index) => ({ personId: `p${index}`, name, roleOrPosition })) } },
  });
}

test("the club roster runs in board order, with GBMs last and alphabetical", () => {
  const roster = buildVisitClubRoster(data([
    ["Zara Member", "Member"],
    ["Shivani Kulkarni", "Co-Club Service Director"],
    ["Soham Naik", "Secretary"],
    ["Amit Member", ""],
    ["Harshal Nikam", "Club Service Director"],
    ["Nupura Danait", "President"],
    ["Omkar Kulkarni", "Joint Secretary"],
    ["Rtr. Mihika M", "GBM"],
  ]).attendance);

  assert.deepEqual(roster.map((member) => [member.name, member.role]), [
    ["Rtr. Nupura Danait", "PRES"],
    ["Rtr. Soham Naik", "SEC"],
    ["Rtr. Omkar Kulkarni", "JSEC"],
    ["Rtr. Harshal Nikam", "CSD"],
    ["Rtr. Shivani Kulkarni", "Co-CSD"],
    ["Rtr. Amit Member", "GBM"],
    ["Rtr. Mihika M", "GBM"],
    ["Rtr. Zara Member", "GBM"],
  ]);
});

test("people with two posts rank by the higher one and show both codes; unknown posts sit before GBMs", () => {
  const roster = buildVisitClubRoster(data([
    ["Gauri Sathe", "Editor, Secretary"],
    ["Yash Bhosale", "Avenue Chair"],
    ["Isha Gokhale", "Member"],
    ["Varad Apte", "co-treasurer"],
  ]).attendance);
  assert.deepEqual(roster.map((member) => [member.name, member.role]), [
    ["Rtr. Gauri Sathe", "SEC, EDITOR"],
    ["Rtr. Varad Apte", "Co-TREAS"],
    ["Rtr. Yash Bhosale", "Chair"],
    ["Rtr. Isha Gokhale", "GBM"],
  ]);
});

test("the glance slide carries the roster and the slide renders it as a grid sized to fit", () => {
  const glance = buildVisitPresentationSlides(data([["Nupura Danait", "President"]])).find((slide) => slide.kind === "glance");
  assert.deepEqual(glance.roster.map((member) => member.role), ["PRES"]);
  assert.deepEqual(buildVisitPresentationSlides(normalizeVisitDashboardData({})).find((slide) => slide.kind === "glance").roster, []);
  assert.match(presentationSource, /\{slide\.roster\.length \? <ClubRoster roster=\{slide\.roster\} \/> : null\}/);
  assert.match(presentationSource, /<h3>Our RCPH family<\/h3>/);
  assert.match(presentationSource, /"--roster-columns": columns, "--roster-rows": rows/);
});
