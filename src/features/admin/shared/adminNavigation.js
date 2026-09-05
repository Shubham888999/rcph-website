export const ADMIN_NAV = [
  ["", "Command Center"], ["requests", "Accounts & Roles"], ["members", "Members"], ["attendance", "Club Attendance"], ["bod", "BOD Operations"], ["district", "District"], ["prospects", "Prospects"], ["announcements", "Announcements"], ["resolutions", "Resolutions"], ["reminders", "Reminders"], ["fines", "Fines"], ["treasury", "Treasury"], ["locks", "Locks"], ["logs", "Logs"], ["reports", "Reports"], ["dashboard-preview", "Dashboard Preview"], ["visit-submissions", "Club Visits"], ["visit-management", "Club Visit Management"], ["bod-management", "BOD Management"],
];

export function hasUnrestrictedAdminAccess(access) {
  const canCarryAdminAuthority = ["bod", "admin", "president"].includes(access?.storedRole);
  return Boolean(
    access?.isApproved === true
      && canCarryAdminAuthority
      && (
        ["admin", "president"].includes(access.storedRole)
        || access.hasPresidentAuthority === true
        || access.hasSergeantAtArmsPosition === true
      )
  );
}

export function getAdminNavigation() {
  return ADMIN_NAV;
}
