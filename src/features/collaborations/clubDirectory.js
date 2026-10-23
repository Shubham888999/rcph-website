// Where partner clubs are based, so collaborations can be placed on the map.
// Entries with kind "organization" (for example a Rotary district) are partners but not Rotaract clubs.
// Collaborator names are typed freely in BOD tools ("RC RVCE", "Rotaract Club of R.V.C.E. (RID 3191)"),
// so each club lists the name variants that should match it. To add a club, add an entry here;
// to add a city, add it to CITIES first.

export const CITIES = Object.freeze({
  pune: { city: "Pune", state: "Maharashtra", latitude: 18.5204, longitude: 73.8567, labelSide: "right" },
  mumbai: { city: "Mumbai", state: "Maharashtra", latitude: 19.076, longitude: 72.8777, labelSide: "left" },
  bengaluru: { city: "Bengaluru", state: "Karnataka", latitude: 12.9716, longitude: 77.5946, labelSide: "right" },
  curchorem: { city: "Curchorem", state: "Goa", latitude: 15.2636, longitude: 74.108, labelSide: "left" },
  bhubaneswar: { city: "Bhubaneswar", state: "Odisha", latitude: 20.2961, longitude: 85.8245, labelSide: "right" },
  coimbatore: { city: "Coimbatore", state: "Tamil Nadu", latitude: 11.0168, longitude: 76.9558, labelSide: "right" },
  belagavi: { city: "Belagavi", state: "Karnataka", latitude: 15.8497, longitude: 74.4977, labelSide: "right" },
});

// RCPH's home, the point every collaboration line starts from.
export const HOME_CITY_KEY = "pune";

export const CLUB_DIRECTORY = Object.freeze([
  { key: "rscoe", name: "RSCOE", district: "RID 3131", cityKey: "pune", aliases: ["rscoe", "rajarshi shahu college of engineering"] },
  { key: "pune-westside", name: "Pune Westside", district: "RID 3131", cityKey: "pune", aliases: ["pune westside", "pune west side"] },
  { key: "pune-shaniwarwada", name: "Pune Shaniwarwada", district: "RID 3131", cityKey: "pune", aliases: ["pune shaniwarwada", "shaniwarwada"] },
  { key: "pune-aurora", name: "Pune Aurora", district: "RID 3131", cityKey: "pune", aliases: ["pune aurora"] },
  { key: "sspu", name: "SSPU", district: "RID 3131", cityKey: "pune", aliases: ["sspu", "symbiosis skills and professional university"] },
  { key: "gsmcoe", name: "GSMCOE", district: "RID 3131", cityKey: "pune", aliases: ["gsmcoe", "genba sopanrao moze college of engineering"] },
  { key: "roar-nibm", name: "Roar NIBM", district: "RID 3131", cityKey: "pune", aliases: ["roar nibm", "nibm"] },
  { key: "pune-mideast", name: "Pune Mideast", district: "RID 3131", cityKey: "pune", aliases: ["pune mideast", "pune mdeast"] },
  { key: "pune-baner", name: "Pune Baner", district: "RID 3131", cityKey: "pune", aliases: ["pune baner"] },
  { key: "pune-nigdi", name: "Pune Nigdi", district: "RID 3131", cityKey: "pune", aliases: ["pune nigdi"] },
  { key: "pune-camp-pioneer", name: "Pune Camp Pioneer", district: "RID 3131", cityKey: "pune", aliases: ["pune camp pioneer", "camp pioneer"] },
  {
    key: "rotary-district-3131",
    name: "Rotary District 3131",
    kind: "organization",
    district: "RID 3131",
    cityKey: "pune",
    aliases: ["rotary district 3131", "rotary international district 3131"],
  },
  { key: "mumbai-downtown", name: "Mumbai DownTown", district: "RID 3141", cityKey: "mumbai", aliases: ["mumbai downtown", "mumbai down town"] },
  { key: "mumbai-juhu-youth", name: "Mumbai Juhu Youth", district: "RID 3141", cityKey: "mumbai", aliases: ["mumbai juhu youth", "juhu youth"] },
  { key: "mumbai-medico-marvels", name: "Mumbai Medico Marvels", district: "RID 3141", cityKey: "mumbai", aliases: ["mumbai medico marvels", "medico marvels"] },
  { key: "rvce", name: "RVCE", district: "RID 3191", cityKey: "bengaluru", aliases: ["rvce", "rv college of engineering"] },
  { key: "mount-carmel", name: "Mount Carmel", district: "RID 3191", cityKey: "bengaluru", aliases: ["mount carmel"] },
  { key: "curchorem-sanvordem", name: "Curchorem-Sanvordem", district: "RID 3170", cityKey: "curchorem", aliases: ["curchorem sanvordem", "curchorem"] },
  { key: "belgaum-yuva-darpan", name: "Belgaum Yuva Darpan", district: "RID 3170", cityKey: "belagavi", aliases: ["belgaum yuva darpan", "belagavi yuva darpan", "yuva darpan"] },
  { key: "bhubaneshwar-jaydev", name: "Bhubaneshwar Jaydev", district: "RID 3262", cityKey: "bhubaneswar", aliases: ["bhubaneshwar jaydev", "bhubaneswar jaydev"] },
  // Sponsored by the Rotary Club of Coimbatore Texcity.
  { key: "lead-india-ahead", name: "Lead India Ahead", district: "RID 3206", cityKey: "coimbatore", aliases: ["lead india ahead", "lia"] },
]);

// "Rotaract Club of R.V.C.E. (RID 3191)" -> "rvce"
export function normalizeClubName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\brid\s*\d{4}\b/g, " ")
    .replace(/[.'’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/^\s*(?:the\s+)?(?:rotaract\s+club\s+of|rotaract\s+club|rotaract|rac|rc)\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

const ALIAS_INDEX = CLUB_DIRECTORY.flatMap((club) => club.aliases.map((alias) => ({ alias: normalizeClubName(alias), club })))
  .sort((a, b) => b.alias.length - a.alias.length);

// Exact alias first, then the longest alias found as whole words inside the name.
export function findClub(name) {
  const normalized = normalizeClubName(name);
  if (!normalized) return null;

  const exact = ALIAS_INDEX.find((entry) => entry.alias === normalized);
  if (exact) return exact.club;

  const padded = ` ${normalized} `;
  const partial = ALIAS_INDEX.find((entry) => entry.alias.length >= 3 && padded.includes(` ${entry.alias} `));
  return partial ? partial.club : null;
}
