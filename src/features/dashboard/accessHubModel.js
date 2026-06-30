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

export function getAccessHubCards(access) {
  if (!access?.isApproved) return [];
  const cards = [];
  if (access.canAccessMemberDashboard) {
    cards.push({ key: "dashboard", title: access.storedRole === "prospect" ? "My Dashboard" : "My Member Dashboard", href: "/dashboard", available: true });
  }
  if (access.canAccessProspectDashboard) {
    cards.push({ key: "prospect", title: "Membership Progress", href: "/dashboard", available: true });
  }
  if (access.canAccessBodTools) {
    cards.push({ key: "bod", title: "BOD Tools", href: "/bod-tools", available: true });
  }
  if (access.canAccessAdminTools) {
    cards.push({ key: "admin", title: "Admin Tools", href: "/admin", available: true });
  }
  if (access.canAccessPresidentControls) {
    cards.push({ key: "president", title: "President Controls", href: null, available: false });
  }
  return cards;
}

export function canRequestDashboard(uid, access) {
  return Boolean(uid && access?.isApproved && access.canAccessMemberDashboard);
}
