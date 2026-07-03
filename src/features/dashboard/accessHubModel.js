const POSITION_LABELS = {
  president: "President",
  "immediate-past-president": "Immediate Past President",
  "vice-president": "Vice President",
  secretary: "Secretary",
  "joint-secretary": "Joint Secretary",
  treasurer: "Treasurer",
  csd: "Club Service Director",
  cmd: "Community Service Director",
  isd: "International Service Director",
  pdd: "Professional Development Director",
  rrro: "Rotary Rotaract Relations Officer",
  pro: "Public Relations Officer",
  dei: "DEI Director",
  editor: "Editor",
  cwd: "Website Director",
  "sports-representative": "Sports Representative",
  wrwc: "World Rotaract Week Chairperson",
  wr: "Women's Representative",
  saa: "Sergeant-at-Arms",
};

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
    });
  } else if (access.canAccessMemberDashboard) {
    destinations.push({
      key: "dashboard",
      category: "Personal dashboard",
      title: "My Member Dashboard",
      description: "View your attendance, upcoming events, announcements, and verified club statistics.",
      href: "/dashboard",
      primary: true,
    });
  }
  if (access.canAccessBodTools) {
    destinations.push({ key: "bod", category: "Leadership access", title: "BOD Tools", description: "Create and manage club events through your approved BOD capability.", href: "/bod-tools", primary: false });
  }
  if (access.canAccessAdminTools) {
    destinations.push({ key: "admin", category: "Administration", title: "Admin Tools", description: "Manage protected club operations available to your account.", href: "/admin", primary: false });
  }
  if (access.canAccessResolutionTools) {
    destinations.push({ key: "resolutions", category: "BOD governance", title: "Resolutions", description: "Create, manage, and finalize meeting-linked BOD resolutions.", href: "/admin/resolutions", primary: false });
  }
  destinations.push({ key: "calendar", category: "Club calendar", title: "Public Event Calendar", description: "See upcoming RCPH activities and district opportunities.", href: "/calendar", primary: false });
  destinations.push({ key: "home", category: "Public website", title: "RCPH Homepage", description: "Return to the public club website.", href: "/", primary: false });
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
  if (access?.canAccessPresidentControls) capabilityLabels.push("President Controls");
  const positions = getPositionLabels(access?.positionKeys);
  return {
    role: ROLE_LABELS[access?.storedRole] || "RCPH Member",
    positions,
    positionSummary: positions.length ? positions.join(" · ") : "No approved club position",
    capabilityLabels,
    capabilitySummary: capabilityLabels.length ? capabilityLabels.join(" · ") : "No additional tools available",
    primary: destinations.find(({ primary }) => primary) || null,
    secondary: destinations.filter(({ primary }) => !primary),
    hasDelegatedWebsiteAuthority: Boolean(access?.hasWebsiteDirectorPosition && access?.hasPresidentAuthority),
  };
}

// Retained for callers migrating from the former equal-card layout.
export const getAccessHubCards = getAccessHubDestinations;

export function canRequestDashboard(uid, access) {
  return Boolean(uid && access?.isApproved && access.canAccessMemberDashboard);
}
