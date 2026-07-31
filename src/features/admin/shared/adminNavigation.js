export const ADMIN_NAV = [
  ["", "Command Center"], ["requests", "Accounts & Roles"], ["members", "Members"], ["attendance", "Club Attendance"], ["bod", "BOD Operations"], ["district", "District"], ["prospects", "Prospects"], ["announcements", "Announcements"], ["resolutions", "Resolutions"], ["reminders", "Reminders"], ["fines", "Fines"], ["treasury", "Treasury"], ["locks", "Locks"], ["logs", "Logs"], ["reports", "Reports"], ["dashboard-preview", "Dashboard Preview"], ["visit-submissions", "Club Visits"], ["visit-management", "Club Visit Management"], ["bod-management", "BOD Management"],
];

export const SERGEANT_ADMIN_NAV_PATHS = Object.freeze(["attendance", "bod", "district"]);
const SERGEANT_ADMIN_NAV_PATH_SET = new Set(SERGEANT_ADMIN_NAV_PATHS);

export function hasUnrestrictedAdminAccess(access) {
  return Boolean(
    access?.isApproved === true
      && (
        ["admin", "president"].includes(access.storedRole)
        || access.hasPresidentAuthority === true
      )
  );
}

export function isSergeantAdminDelegate(access) {
  return Boolean(
    access?.isApproved === true
      && access.hasSergeantAtArmsPosition === true
      && !hasUnrestrictedAdminAccess(access)
  );
}

export function getAdminNavigation(access) {
  if (isSergeantAdminDelegate(access)) {
    return ADMIN_NAV.filter(([path]) => SERGEANT_ADMIN_NAV_PATH_SET.has(path));
  }
  return ADMIN_NAV;
}

export function canAccessSergeantAdminSegment(access, segment) {
  if (!isSergeantAdminDelegate(access)) return true;
  return SERGEANT_ADMIN_NAV_PATH_SET.has(segment);
}
