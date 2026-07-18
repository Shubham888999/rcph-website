const ACTIVE_ROLES = new Set(["prospect", "gbm", "bod", "admin", "president"]);

function cleanString(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function cleanPositionKeys(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((key) => cleanString(key)).filter(Boolean))];
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
  const candidateRole = cleanString(roleDocument?.role);
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
  const isMemberRole = ACTIVE_ROLES.has(storedRole);

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
    canAccessMemberDashboard: isApproved && isMemberRole,
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
    presidentControls: "canAccessPresidentControls",
  };
  const field = capabilityFields[capability];
  return Boolean(field && access?.isApproved && access[field] === true);
}

export function canManageBodManagement(access) {
  return Boolean(access?.isApproved === true && ["admin", "president"].includes(access.storedRole));
}
