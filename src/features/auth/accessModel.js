const DISTRICT_OFFICIAL_ROLE = "districtOfficial";
const ACTIVE_ROLES = new Set(["prospect", "gbm", "bod", "admin", "president", DISTRICT_OFFICIAL_ROLE]);
const DASHBOARD_ROLES = new Set(["prospect", "gbm", "bod", "admin", "president"]);
export const VISIT_DASHBOARD_TYPES = Object.freeze(["clubAssembly", "dzrVisit", "drrVisit"]);
export const VISIT_DASHBOARD_PATHS = Object.freeze({
  clubAssembly: "/visits/club-assembly",
  dzrVisit: "/visits/dzr-visit",
  drrVisit: "/visits/drr-visit",
});
const VISIT_DASHBOARD_NAMES = Object.freeze({
  clubAssembly: "Club Assembly",
  dzrVisit: "DZR Visit",
  drrVisit: "DRR Visit",
});

function cleanString(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function cleanRole(value) {
  const role = cleanString(value);
  if (role.replace(/[\s_-]+/g, "") === "districtofficial") return DISTRICT_OFFICIAL_ROLE;
  return role;
}

function cleanPositionKeys(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((key) => cleanString(key)).filter(Boolean))];
}

function createEmptyVisitDashboardAccessMap() {
  return VISIT_DASHBOARD_TYPES.reduce((access, visitType) => {
    access[visitType] = false;
    return access;
  }, {});
}

function normalizeVisitDashboardAccess(value) {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return VISIT_DASHBOARD_TYPES.reduce((access, visitType) => {
    access[visitType] = raw[visitType] === true;
    return access;
  }, {});
}

function normalizeVisitDashboardEntries(value, visitDashboardAccess) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.flatMap((entry) => {
    const visitType = typeof entry?.visitType === "string" ? entry.visitType.trim() : "";
    if (!VISIT_DASHBOARD_TYPES.includes(visitType) || visitDashboardAccess[visitType] !== true || seen.has(visitType)) {
      return [];
    }
    seen.add(visitType);
    return [{
      visitType,
      visitName: VISIT_DASHBOARD_NAMES[visitType],
      path: VISIT_DASHBOARD_PATHS[visitType],
    }];
  });
}

export function getVisitTypeFromPath(path) {
  const normalized = typeof path === "string" ? path.trim().replace(/\/+$/, "") : "";
  return VISIT_DASHBOARD_TYPES.find((visitType) => VISIT_DASHBOARD_PATHS[visitType] === normalized) || "";
}

export function createDeniedAccess() {
  return {
    uid: "",
    user: null,
    storedRole: "",
    accountStatus: "",
    positionKeys: [],
    positionSource: null,
    isPresidentRole: false,
hasWebsiteDirectorPosition: false,
hasSergeantAtArmsPosition: false,
hasPresidentAuthority: false,
    isApproved: false,
    isPending: false,
    isRejected: false,
    isProfileMissing: true,
    isInactive: false,
    canAccessMemberDashboard: false,
    canAccessProspectDashboard: false,
    canAccessBodTools: false,
    canAccessAdminTools: false,
    canManageBodManagement: false,
    canAccessLockTools: false,
    canAccessResolutionTools: false,
    canAccessVisitSubmissions: false,
    canAccessVisitDashboards: false,
    visitDashboardAccess: createEmptyVisitDashboardAccessMap(),
    visitDashboardEntries: [],
    canAccessPresidentControls: false,
  };
}

export function normalizeTrustedAccess(payload) {
  if (!payload || typeof payload !== "object" || payload.ok !== true) {
    throw new TypeError("Trusted access response is invalid.");
  }
  const user = payload.user && typeof payload.user === "object" ? payload.user : null;
  const roleDocument = payload.role && typeof payload.role === "object" ? payload.role : null;
  const roleStatus = cleanString(roleDocument?.status);
  const userStatus = cleanString(user?.status);
  const candidateRole = cleanRole(roleDocument?.role);
  const storedRole = roleStatus === "approved" && ACTIVE_ROLES.has(candidateRole)
    ? candidateRole
    : "";
  const isRejected = roleStatus === "rejected" || userStatus === "rejected";
  const isPending = !isRejected && (roleStatus === "pending" || userStatus === "pending");
  const isProfileMissing = !isPending && !isRejected && (!user || !roleDocument);
  const isInactive = !isProfileMissing
    && !isPending
    && !isRejected
    && (user?.active === false || !storedRole);
  const userStatusAllowsAccess = !userStatus || userStatus === "approved";
  const isApproved = Boolean(user && storedRole && userStatusAllowsAccess && user.active !== false);
  const authority = payload.authority && typeof payload.authority === "object"
    ? payload.authority
    : {};
  // Copy server authority flags strictly; position names and keys never create authority locally.
  const isPresidentRole = authority.isPresidentRole === true;
const hasWebsiteDirectorPosition =
  authority.hasWebsiteDirectorPosition === true;

const hasSergeantAtArmsPosition =
  authority.hasSergeantAtArmsPosition === true;

const hasPresidentAuthority =
  authority.hasPresidentAuthority === true;
  const resolutionManager = payload.resolutionManager === true;
  const trustedLockTools = payload.canAccessLockTools === true
    || authority.canAccessLockTools === true;
  const trustedResolutionTools = payload.canAccessResolutionTools === true
    || authority.canAccessResolutionTools === true
    || resolutionManager;
  const hasDashboardRole = DASHBOARD_ROLES.has(storedRole);
  const visitDashboardAccess = normalizeVisitDashboardAccess(payload.visitDashboardAccess);
  const visitDashboardEntries = normalizeVisitDashboardEntries(payload.visitDashboardEntries, visitDashboardAccess);
  const trustedVisitDashboards = payload.canAccessVisitDashboards === true && visitDashboardEntries.length > 0;
  const allowedVisitDashboardAccess = isApproved && trustedVisitDashboards
    ? visitDashboardAccess
    : createEmptyVisitDashboardAccessMap();

  return {
    uid: typeof payload.uid === "string" ? payload.uid : "",
    user,
    storedRole,
    accountStatus: isApproved ? "approved"
      : isRejected ? "rejected"
        : isPending ? "pending"
          : isProfileMissing ? "profile-missing" : "inactive",
    positionKeys: cleanPositionKeys(payload.positionKeys),
    positionSource: typeof payload.positionSource === "string" ? payload.positionSource : null,
isPresidentRole,
hasWebsiteDirectorPosition,
hasSergeantAtArmsPosition,
hasPresidentAuthority,
    resolutionManager,
    isApproved,
    isPending,
    isRejected,
    isProfileMissing,
    isInactive,
    canAccessMemberDashboard: isApproved && hasDashboardRole,
    canAccessProspectDashboard: isApproved && storedRole === "prospect",
    canAccessBodTools: isApproved && ["bod", "admin", "president"].includes(storedRole),
canAccessAdminTools: isApproved
  && (
    ["admin", "president"].includes(storedRole)
    || hasPresidentAuthority
    || hasSergeantAtArmsPosition
  ),
    canManageBodManagement: isApproved && ["admin", "president"].includes(storedRole),
    canAccessLockTools: isApproved
      && (trustedLockTools || hasPresidentAuthority),
    canAccessResolutionTools: isApproved && trustedResolutionTools,
    canAccessVisitSubmissions: isApproved
      && (["admin", "president"].includes(storedRole)
        || (storedRole === "bod" && cleanPositionKeys(payload.positionKeys).length > 0)),
    canAccessVisitDashboards: isApproved && trustedVisitDashboards,
    visitDashboardAccess: allowedVisitDashboardAccess,
    visitDashboardEntries: isApproved && trustedVisitDashboards ? visitDashboardEntries : [],
    canAccessPresidentControls: isApproved
      && hasPresidentAuthority,
  };
}

export function getAccountState(access) {
  if (!access) return "access-error";
  if (access.isApproved) return "approved";
  if (access.isRejected) return "rejected";
  if (access.isPending) return "pending";
  if (access.isProfileMissing) return "profile-missing";
  return "inactive";
}

export function hasCapability(access, capability) {
  const capabilityFields = {
    memberDashboard: "canAccessMemberDashboard",
    prospectDashboard: "canAccessProspectDashboard",
    bodTools: "canAccessBodTools",
    adminTools: "canAccessAdminTools",
    bodManagement: "canManageBodManagement",
    resolutionTools: "canAccessResolutionTools",
    lockTools: "canAccessLockTools",
    visitSubmissions: "canAccessVisitSubmissions",
    visitDashboards: "canAccessVisitDashboards",
    presidentControls: "canAccessPresidentControls",
  };
  const field = capabilityFields[capability];
  return Boolean(field && access?.isApproved && access[field] === true);
}

export function hasVisitDashboardAccess(access, visitTypeOrPath) {
  const visitType = VISIT_DASHBOARD_TYPES.includes(visitTypeOrPath)
    ? visitTypeOrPath
    : getVisitTypeFromPath(visitTypeOrPath);
  if (!visitType) return false;
  return Boolean(
    access?.isApproved === true
      && access.canAccessVisitDashboards === true
      && access.visitDashboardAccess?.[visitType] === true
      && access.visitDashboardEntries?.some((entry) => entry.visitType === visitType && entry.path === VISIT_DASHBOARD_PATHS[visitType])
  );
}

export function getVisitDashboardEntry(access, visitTypeOrPath) {
  const visitType = VISIT_DASHBOARD_TYPES.includes(visitTypeOrPath)
    ? visitTypeOrPath
    : getVisitTypeFromPath(visitTypeOrPath);
  if (!hasVisitDashboardAccess(access, visitType)) return null;
  return access.visitDashboardEntries.find((entry) => entry.visitType === visitType) || null;
}

export function canManageBodManagement(access) {
  return Boolean(access?.isApproved === true && ["admin", "president"].includes(access.storedRole));
}
