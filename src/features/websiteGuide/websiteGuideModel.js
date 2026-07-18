import { GUIDE_ROLES, WEBSITE_GUIDE_CONTENT } from "./websiteGuideContent.js";

const DEFAULT_GUIDE_ROLE_ID = "gbm";
const SECRETARY_KEYS = new Set(["secretary", "joint-secretary", "co-secretary"]);
const SERGEANT_KEYS = new Set(["saa", "co-saa", "sergeant-at-arms"]);
const CWD_KEYS = new Set(["cwd", "co-cwd"]);

function clean(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function cleanKeys(value) {
  return Array.isArray(value) ? value.map(clean).filter(Boolean) : [];
}

function hasAny(keys, allowed) {
  return keys.some((key) => allowed.has(key));
}

export function getGuideRoleOptions() {
  return GUIDE_ROLES;
}

export function isGuideRoleId(roleId) {
  return Object.hasOwn(WEBSITE_GUIDE_CONTENT, clean(roleId));
}

export function getGuideRoleLabel(roleId) {
  return GUIDE_ROLES.find((role) => role.id === roleId)?.label || "GBM";
}

export function getGuideFeatureOptions(roleId) {
  const features = WEBSITE_GUIDE_CONTENT[clean(roleId)] || [];
  return features.map((feature) => ({ id: feature.id, label: feature.title }));
}

export function getFirstGuideFeatureId(roleId) {
  return getGuideFeatureOptions(roleId)[0]?.id || "";
}

export function getGuideEntry(roleId, featureId) {
  const features = WEBSITE_GUIDE_CONTENT[clean(roleId)] || [];
  return features.find((feature) => feature.id === featureId) || null;
}

export function getDefaultGuideRoleId(access) {
  const role = clean(access?.storedRole || access?.role || access?.user?.role);
  const keys = cleanKeys(access?.positionKeys?.length ? access.positionKeys : access?.user?.positionKeys);
  if (role === "prospect") return "prospect";
  if (role === "president") return "president";
  if (role === "admin") return "admin";
  if (hasAny(keys, SECRETARY_KEYS)) return "secretary";
  if (access?.hasSergeantAtArmsPosition === true || hasAny(keys, SERGEANT_KEYS)) return "sergeant-at-arms";
  if (access?.hasWebsiteDirectorPosition === true || hasAny(keys, CWD_KEYS)) return "cwd";
  if (role === "bod") return "bod";
  if (role === "gbm") return "gbm";
  return DEFAULT_GUIDE_ROLE_ID;
}

export function getInitialGuideSelection(access) {
  const roleId = getDefaultGuideRoleId(access);
  return {
    roleId,
    featureId: getFirstGuideFeatureId(roleId),
  };
}
