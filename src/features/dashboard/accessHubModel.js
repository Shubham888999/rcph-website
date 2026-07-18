import { POSITION_CATALOG } from "../admin/shared/positionCatalog.js";

const POSITION_LABELS = Object.fromEntries(POSITION_CATALOG.map((position) => [position.key, position.displayTitle]));

export function getPositionLabels(keys) {
  if (!Array.isArray(keys)) return [];
  return keys.map((key) => POSITION_LABELS[key]).filter(Boolean);
}

const ROLE_LABELS = Object.freeze({
  prospect: "Prospect",
  gbm: "General Body Member",
  bod: "Board of Directors",
  admin: "Administrator",
  president: "President",
});

export function getAccessHubDestinations(access) {
  if (!access?.isApproved) return [];
  const destinations = [];
  if (access.canAccessProspectDashboard) {
    destinations.push({
      key: "prospect",
      category: "Membership journey",
      title: "My Prospect Journey",
      description: "Track your membership criteria, qualifying activities, and verified next steps.",
      href: "/dashboard",
      primary: true,
      fullWidth: true,
    });
  } else if (access.canAccessMemberDashboard) {
    destinations.push({
      key: "dashboard",
      category: "Personal dashboard",
      title: "My Member Dashboard",
      description: "View your attendance, upcoming events, announcements, and verified club statistics.",
      href: "/dashboard",
      primary: true,
      fullWidth: true,
    });
  }
  if (access.canAccessBodTools) {
    destinations.push({ key: "bod", category: "Leadership access", title: "BOD Tools", description: "Create and manage Club Events.", href: "/bod-tools", primary: false });
  }
  if (access.canAccessVisitSubmissions) {
    destinations.push({ key: "club-visits", category: "Club reporting", title: "Club Visits", description: "Upload and manage supporting files for Club Assembly, DZR Visit, and DRR Visit.", href: "/admin/visit-submissions", primary: false });
  }
  if (access.canAccessAdminTools) {
    destinations.push({ key: "admin", category: "Administration", title: "Admin Tools", description: "Manage Club Operations.", href: "/admin", primary: false });
  }
  if (access.canAccessResolutionTools) {
    destinations.push({ key: "resolutions", category: "BOD governance", title: "Resolutions", description: "Create, manage, and finalize meeting-linked BOD resolutions.", href: "/admin/resolutions", primary: false });
  }
  destinations.push({ key: "calendar", category: "Club calendar", title: "Public Event Calendar", description: "See upcoming RCPH activities and district opportunities.", href: "/calendar", primary: false });
  destinations.push({ key: "home", category: "Public website", title: "RCPH Homepage", description: "Return to the public club website.", href: "/", primary: false });
  destinations.push({ key: "website-guide", category: "Help Center", title: "Website Guide", description: "Learn how to use the club website features.", href: "/website-guide", primary: false });
  return destinations;
}

export function getAccessHubViewModel(access) {
  const destinations = getAccessHubDestinations(access);
  const capabilityLabels = [];
  if (access?.canAccessProspectDashboard) capabilityLabels.push("Prospect Journey");
  else if (access?.canAccessMemberDashboard) capabilityLabels.push("Member Dashboard");
  if (access?.canAccessBodTools) capabilityLabels.push("BOD Tools");
  if (access?.canAccessAdminTools) capabilityLabels.push("Admin Tools");
  if (access?.canAccessResolutionTools) capabilityLabels.push("Resolution Tools");
  if (access?.canAccessVisitSubmissions) capabilityLabels.push("Club Visits");
  if (access?.canAccessPresidentControls) capabilityLabels.push("President Controls");
  const positions = getPositionLabels(access?.positionKeys);
  return {
    role: ROLE_LABELS[access?.storedRole] || "RCPH Member",
    positions,
    positionSummary: positions.length ? positions.join(" · ") : "No approved club position",
    capabilityLabels,
    capabilitySummary: capabilityLabels.length ? capabilityLabels.join(" · ") : "No additional tools available",
    destinations,
    primary: destinations.find(({ primary }) => primary) || null,
    secondary: destinations.filter(({ primary }) => !primary),
    hasDelegatedWebsiteAuthority: Boolean(access?.hasWebsiteDirectorPosition && access?.hasPresidentAuthority),
    hasDelegatedSergeantAuthority:
  access?.hasSergeantAtArmsPosition === true,
  };
}

// Retained for callers migrating from the former equal-card layout.
export const getAccessHubCards = getAccessHubDestinations;

export function canRequestDashboard(uid, access) {
  return Boolean(uid && access?.isApproved && access.canAccessMemberDashboard);
}
