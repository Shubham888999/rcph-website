// Safe client mirror of functions/lib/positions.js and the legacy admin catalog.
// Canonical keys are submitted unchanged; server validation remains authoritative.
export const POSITION_GROUPS = Object.freeze([
  Object.freeze({ key: "executive", label: "Executive Positions" }),
  Object.freeze({ key: "avenue-directors", label: "Avenue Directors" }),
  Object.freeze({ key: "officers-representatives", label: "Officers and Representatives" }),
]);

export const POSITION_CATALOG = Object.freeze([
  ["president", "President", "PRES", "executive", 1, ["Club President"]],
  ["immediate-past-president", "Immediate Past President", "IPP", "executive", 2, ["IPP"]],
  ["vice-president", "Vice President", "VP", "executive", 3, ["Vice-President", "VP"]],
  ["secretary", "Secretary", "SEC", "executive", 4, ["Club Secretary"]],
  ["joint-secretary", "Joint Secretary", "JSEC", "executive", 5, ["Joint-Secretary"]],
  ["treasurer", "Treasurer", "TREAS", "executive", 6, ["Club Treasurer"]],
  ["csd", "Club Service Director", "CSD", "avenue-directors", 7, ["Club Service"]],
  ["cmd", "Community Service Director", "CMD", "avenue-directors", 8, ["Community Service"]],
  ["isd", "International Service Director", "ISD", "avenue-directors", 9, ["International Service"]],
  ["pdd", "Professional Development Director", "PDD", "avenue-directors", 10, ["Professional Development"]],
  ["rrro", "Rotary Rotaract Relations Officer", "RRRO", "officers-representatives", 11, ["Rotary-Rotaract Relations Officer"]],
  ["pro", "Public Relations Officer", "PRO", "officers-representatives", 12, ["Public Relations"]],
  ["dei", "DEI Director", "DEI", "officers-representatives", 13, ["Diversity Equity Inclusion Officer", "Diversity Equity and Inclusion Officer"]],
  ["editor", "Editor", "EDITOR", "officers-representatives", 14, ["Club Editor"]],
  ["cwd", "Website Director", "CWD", "officers-representatives", 15, ["Club Website Director", "Web Director"]],
  ["sports-representative", "Sports Representative", "SPORTS", "officers-representatives", 16, ["Club Sports Representative", "Sports Director"]],
  ["wrwc", "World Rotaract Week Chairperson", "WRWC", "officers-representatives", 17, ["World Rotaract Week Chair"]],
  ["wr", "Women's Representative", "WR", "officers-representatives", 18, ["Womens Representative", "Women Representative"]],
  ["saa", "Sergeant-at-Arms", "SAA", "officers-representatives", 19, ["Sergeant at Arms"]],
].map(([key, displayTitle, avenueCode, group, sortOrder, aliases]) => Object.freeze({
  key,
  displayTitle,
  avenueCode,
  group,
  sortOrder,
  aliases: Object.freeze([displayTitle, avenueCode, ...aliases]),
  active: true,
})));

export const WEBSITE_DIRECTOR_POSITION_KEY = "cwd";
