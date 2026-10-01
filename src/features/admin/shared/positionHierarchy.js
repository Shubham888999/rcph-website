import { POSITION_CATALOG } from "./positionCatalog.js";

// Committee-approved display order for attendance screens, the member list and
// attendance exports. Co- positions follow their main position; BOD roles the
// committee did not list (RRRO, Sports, WRWC, WR) follow SAA.
export const POSITION_HIERARCHY = Object.freeze([
  "president", "co-president",
  "secretary", "joint-secretary", "co-secretary",
  "treasurer", "co-treasurer",
  "vice-president", "co-vice-president",
  "immediate-past-president",
  "club-advisor", "co-club-advisor",
  "pdd", "co-pdd",
  "csd", "co-csd",
  "isd", "co-isd",
  "cmd", "co-cmd",
  "dei", "co-dei",
  "pro", "co-pro",
  "pid", "co-pid",
  "mdo", "co-mdo",
  "editor", "co-editor",
  "cwd", "co-cwd",
  "saa", "co-saa",
  "rrro", "co-rrro",
  "sports-representative", "co-sports-representative",
  "wrwc", "co-wrwc",
  "wr", "co-wr",
]);

// Committee shorthand that the catalog does not already list as an alias.
const COMMITTEE_ALIASES = Object.freeze({
  president: ["P"],
  secretary: ["S"],
  treasurer: ["T"],
  "club-advisor": ["CA"],
});

const MEMBER_SORT_KEY = 1000;
const PROSPECT_SORT_KEY = 2000;

function normalizeToken(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

const RANK_BY_KEY = new Map(POSITION_HIERARCHY.map((key, index) => [key, index]));

const KEY_BY_TOKEN = (() => {
  const map = new Map();
  const add = (token, key) => {
    const normalized = normalizeToken(token);
    if (normalized && !map.has(normalized)) map.set(normalized, key);
  };
  POSITION_HIERARCHY.forEach((key) => add(key, key));
  Object.entries(COMMITTEE_ALIASES).forEach(([key, aliases]) => aliases.forEach((alias) => add(alias, key)));
  POSITION_CATALOG.forEach((entry) => entry.aliases.forEach((alias) => add(alias, entry.key)));
  return map;
})();

export function positionKeysFromText(value) {
  const textValue = String(value || "").trim();
  if (!textValue) return [];
  const whole = KEY_BY_TOKEN.get(normalizeToken(textValue));
  if (whole) return [whole];
  return [...new Set(textValue
    .split(/[|,/&+]/)
    .map((part) => KEY_BY_TOKEN.get(normalizeToken(part)))
    .filter(Boolean))];
}

export function resolvePositionKeys({ positionKeys = [], positionText = "" } = {}) {
  const known = (Array.isArray(positionKeys) ? positionKeys : [])
    .map((key) => String(key || "").trim().toLowerCase())
    .filter((key) => RANK_BY_KEY.has(key));
  if (known.length) return [...new Set(known)];
  return positionKeysFromText(positionText);
}

export function hierarchySortKey({ positionKeys = [], isProspect = false } = {}) {
  if (isProspect) return PROSPECT_SORT_KEY;
  const ranks = (Array.isArray(positionKeys) ? positionKeys : [])
    .map((key) => RANK_BY_KEY.get(key))
    .filter((rank) => Number.isInteger(rank));
  return ranks.length ? Math.min(...ranks) : MEMBER_SORT_KEY;
}

export function compareByHierarchy(a, b) {
  return ((a?.hierarchySortKey ?? MEMBER_SORT_KEY) - (b?.hierarchySortKey ?? MEMBER_SORT_KEY))
    || String(a?.name ?? "").localeCompare(String(b?.name ?? ""), undefined, { sensitivity: "base" })
    || String(a?.id ?? "").localeCompare(String(b?.id ?? ""));
}
