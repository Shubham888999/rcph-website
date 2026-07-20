const MEMBER_ROLES = new Set(["gbm", "bod", "admin", "president"]);
const NON_MEMBER_ROLES = new Set(["prospect", "pending", "rejected", "unauthenticated", "external", "districtofficial"]);
const ROTARACTOR_PREFIX_PATTERN = /^(?:rtr\.?\s*)+/i;

function cleanRole(value) {
  return String(value || "").trim().toLowerCase();
}

export function stripRotaractorPrefix(name) {
  return String(name || "")
    .trim()
    .replace(ROTARACTOR_PREFIX_PATTERN, "")
    .trim();
}
export function isRotaractorMemberContext(context) {
  if (context === true) return true;
  if (!context || context === false) return false;
  if (typeof context === "string") {
    const role = cleanRole(context);
    return MEMBER_ROLES.has(role);
  }
  const status = cleanRole(context.status);
  if (status === "pending" || status === "rejected" || context.active === false) return false;
  const memberType = cleanRole(context.memberType);
  if (memberType === "prospect") return false;
  const role = cleanRole(context.role || context.storedRole || context.requestedRole);
  if (NON_MEMBER_ROLES.has(role)) return false;
  if (MEMBER_ROLES.has(role)) return true;
  if (memberType === "member") return true;
  if (Array.isArray(context.positionKeys) && context.positionKeys.length > 0) return true;
  return false;
}

export function formatRotaractorName(name, roleOrMembershipContext) {
  const clean = stripRotaractorPrefix(name);
  if (!clean) return "";
  return isRotaractorMemberContext(roleOrMembershipContext) ? `Rtr. ${clean}` : clean;
}
