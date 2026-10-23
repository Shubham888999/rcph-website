import { POSITION_CATALOG } from "../admin/shared/positionCatalog.js";
import { formatVisitAttendanceName, formatVisitAttendanceRoleCode } from "./visitDashboardModel.js";

// The whole club for the presentation's "Club at a glance" slide, in board
// order: President, IPP, VP, Secretary and so on, then directors, co-roles, and
// GBMs last, alphabetically. Built from the club attendance register.

const GBM_ROLES = new Set(["", "member", "members", "gbm", "generalbodymember", "generalbody", "rotaractor"]);
const OTHER_ROLE_RANK = 900;
const GBM_RANK = 1000;

function lookupKey(value) {
  return String(value || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");
}

const CATALOG_BY_KEY = new Map(POSITION_CATALOG.map((position) => [position.key, position]));
const POSITION_BY_NAME = new Map();
POSITION_CATALOG.forEach((position) => {
  [position.key, position.displayTitle, position.avenueCode, ...position.aliases].forEach((name) => {
    const key = lookupKey(name);
    if (key && !POSITION_BY_NAME.has(key)) POSITION_BY_NAME.set(key, position);
  });
});

// Short code: the catalog code for the role, with "Co-" in front of a co-role's base code.
function positionCode(position) {
  const base = position.key.startsWith("co-") ? CATALOG_BY_KEY.get(position.key.slice(3)) : null;
  return base ? `Co-${base.avenueCode}` : position.avenueCode;
}

function rosterRole(roleOrPosition) {
  const parts = String(roleOrPosition || "").split(/\s*(?:,|;|\/)\s*/);
  if (parts.every((part) => GBM_ROLES.has(lookupKey(part)))) return { rank: GBM_RANK, role: "GBM" };
  const positions = parts.map((part) => POSITION_BY_NAME.get(lookupKey(part))).filter(Boolean);
  if (!positions.length) return { rank: OTHER_ROLE_RANK, role: formatVisitAttendanceRoleCode(roleOrPosition) };
  positions.sort((left, right) => left.sortOrder - right.sortOrder);
  return { rank: positions[0].sortOrder, role: [...new Set(positions.map(positionCode))].join(", ") };
}

export function buildVisitClubRoster(attendance) {
  const rows = Array.isArray(attendance?.club?.rows) ? attendance.club.rows : [];
  return rows
    .map((row) => {
      const { rank, role } = rosterRole(row.roleOrPosition);
      return { key: row.personId, name: formatVisitAttendanceName(row.name), role, rank };
    })
    .filter((member) => member.name)
    .sort((left, right) => left.rank - right.rank || left.name.localeCompare(right.name));
}
