import { CITIES, HOME_CITY_KEY, findClub } from "./clubDirectory.js";
import { projectToIndiaMap } from "./indiaMapProjection.js";

function placeCity(cityKey) {
  const city = CITIES[cityKey];
  return { key: cityKey, ...city, ...projectToIndiaMap(city.latitude, city.longitude) };
}

export function getHomeCity() {
  return placeCity(HOME_CITY_KEY);
}

// Groups collaboration events by partner city for the map.
// Input rows: { eventId, name, date, rcphRole, partners: [{ name }] }.
// Clubs not in the club directory are returned as `unplaced` so they still show in the list.
export function buildCollaborationGeography(collaborations) {
  const cities = new Map();
  const unplaced = new Map();
  const districts = new Set();
  const events = Array.isArray(collaborations) ? collaborations : [];

  events.forEach((row) => {
    const event = { eventId: row.eventId, name: row.name, date: row.date, rcphRole: row.rcphRole };

    row.partners.forEach((partner) => {
      const club = findClub(partner.name);

      if (!club) {
        const key = partner.name.toLowerCase();
        const entry = unplaced.get(key) || { name: partner.name, events: [] };
        entry.events.push(event);
        unplaced.set(key, entry);
        return;
      }

      if (club.kind !== "organization") districts.add(club.district);
      const city = cities.get(club.cityKey) || { ...placeCity(club.cityKey), clubs: new Map() };
      const clubEntry = city.clubs.get(club.key) || {
        key: club.key,
        name: club.name,
        kind: club.kind || "club",
        district: club.district,
        events: [],
      };
      if (!clubEntry.events.some((item) => item.eventId === event.eventId)) clubEntry.events.push(event);
      city.clubs.set(club.key, clubEntry);
      cities.set(club.cityKey, city);
    });
  });

  // Rotaract clubs first, then other partner organizations such as a Rotary district.
  const placedCities = [...cities.values()]
    .map((city) => {
      const clubs = [...city.clubs.values()].sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "club" ? -1 : 1));
      return { ...city, clubs, clubCount: clubs.filter((club) => club.kind === "club").length };
    })
    .sort((a, b) => b.clubCount - a.clubCount || a.city.localeCompare(b.city));
  const clubCount = placedCities.reduce((total, city) => total + city.clubCount, 0) + unplaced.size;

  return {
    home: getHomeCity(),
    cities: placedCities,
    unplaced: [...unplaced.values()],
    summary: {
      eventCount: events.length,
      clubCount,
      cityCount: placedCities.length,
      districtCount: districts.size,
    },
  };
}
