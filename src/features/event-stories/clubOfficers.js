import { getEventStory } from "./eventStories.js";

// This year's board (RIY 2026-27), as shown in Admin > Leadership directory.
// Change a title here and every event page updates. Someone with two roles gets one per line (\n).
export const clubOfficers = Object.freeze({
  harshal: { name: "Rtr. Harshal Nikam", role: "Club Service Director" },
  shivani: { name: "Rtr. Shivani Kulkarni", role: "Co-Club Service Director" },
  tanishka: { name: "Rtr. Tanishka Patekar", role: "Community Service Director\nDiversity, Equity & Inclusion Director" },
  soumitra: { name: "Rtr. Soumitra Lokur", role: "Co-Community Service Director" },
  aarya: { name: "Rtr. Aarya Godbole", role: "International Service Director" },
  yashali: { name: "Rtr. Yashali Shirodkar", role: "Public Relations Officer\nCo-International Service Director" },
  ira: { name: "Rtr. Ira Lad", role: "Professional Development Director" },
  aneesh: { name: "Rtr. Aneesh Ladkat", role: "Immediate Past President\nRotary Rotaract Relations Officer" },
});

// Directors and co-directors of each avenue, using the avenue codes from BOD Tools.
export const avenueTeams = Object.freeze({
  CSD: ["harshal", "shivani"],
  CMD: ["tanishka", "soumitra"],
  ISD: ["aarya", "yashali"],
  PDD: ["ira"],
  PRO: ["yashali"],
  DEI: ["tanishka"],
  RRRO: ["aneesh"],
});

export function officers(...keys) {
  return keys.map((key) => {
    const officer = clubOfficers[key];
    if (!officer) throw new Error(`Unknown club officer: ${key}`);
    return officer;
  });
}

// Everyone who conducted an event: the people BOD Tools names first, then every director and
// co-director of each of the event's avenues, each person listed once.
function leadsAvenue(code, leads) {
  return (avenueTeams[code] || []).some((key) => leads.includes(key));
}

export function organisersFor(avenues, leads = []) {
  // Avenues led by the named people come first, so each team stays together.
  const ordered = [...avenues].sort((a, b) => Number(leadsAvenue(b, leads)) - Number(leadsAvenue(a, leads)));
  const keys = [...leads, ...ordered.flatMap((code) => avenueTeams[code] || [])];
  return officers(...new Set(keys));
}

export function storyOrganisers(slug, leads = []) {
  const story = getEventStory(slug);
  if (!story) throw new Error(`Unknown event story: ${slug}`);
  return organisersFor(story.avenues, leads);
}
