// Current role holders attached to Club Visit folders by the backend
// (functions/lib/position-holders.js). personKey is an opaque hash, never a uid.

export const MAX_VISIT_HOLDERS_PER_FOLDER = 6;
const PERSON_KEY_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function text(value, max) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

export function normalizeVisitHolders(value) {
  if (!Array.isArray(value)) return [];
  const holders = [];
  const seen = new Set();
  for (const raw of value) {
    if (holders.length >= MAX_VISIT_HOLDERS_PER_FOLDER) break;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const personKey = typeof raw.personKey === "string" ? raw.personKey.trim() : "";
    const displayName = text(raw.displayName, 120);
    if (!PERSON_KEY_PATTERN.test(personKey) || !displayName || seen.has(personKey)) continue;
    seen.add(personKey);
    holders.push({ personKey, displayName });
  }
  return holders;
}

export function joinVisitHolderNames(holders) {
  return (Array.isArray(holders) ? holders : [])
    .map((holder) => holder?.displayName)
    .filter(Boolean)
    .join(" & ");
}
