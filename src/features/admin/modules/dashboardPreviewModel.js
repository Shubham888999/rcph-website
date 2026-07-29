export const DASHBOARD_PREVIEW_NOTICE = "Static preview for CWD review — no live data is shown.";

export const DASHBOARD_PREVIEW_ROLES = Object.freeze([
  { id: "prospect", label: "Prospect" },
  { id: "gbm", label: "GBM" },
  { id: "bod", label: "BOD" },
  { id: "admin", label: "Admin" },
]);

const upcomingEvents = Object.freeze([
  {
    id: "preview-rakhis-of-service",
    name: "Rakhis of Service",
    date: "2026-08-02",
    endDate: "",
    avenues: ["CSD"],
  },
  {
    id: "preview-gbm-august",
    name: "August General Body Meeting",
    date: "2026-08-09",
    endDate: "",
    avenues: ["GBM"],
  },
  {
    id: "preview-pdd-workshop",
    name: "Resume and Interview Lab",
    date: "2026-08-18",
    endDate: "",
    avenues: ["PDD"],
  },
]);

const recentClubAttendance = Object.freeze([
  {
    id: "preview-cmd-food-drive",
    name: "Community Food Drive",
    date: "2026-07-12",
    endDate: "",
    avenues: ["CMD"],
    label: "Present",
  },
  {
    id: "preview-gbm-july",
    name: "July General Body Meeting",
    date: "2026-07-06",
    endDate: "",
    avenues: ["GBM"],
    label: "Present",
  },
  {
    id: "preview-pro-campaign",
    name: "Heritage Social Media Sprint",
    date: "2026-06-28",
    endDate: "",
    avenues: ["PRO"],
    label: "Absent",
  },
]);

const recentDistrictAttendance = Object.freeze([
  {
    id: "preview-district-seminar",
    name: "District Membership Seminar",
    date: "2026-07-21",
    endDate: "",
    avenues: ["RRRO"],
    label: "Present",
  },
  {
    id: "preview-district-training",
    name: "Avenue Directors Training",
    date: "2026-06-30",
    endDate: "",
    avenues: ["PDD"],
    label: "NA",
  },
]);

const clubStats = Object.freeze({
  totalEvents: 18,
  totalPublicEvents: 14,
  mostActiveAvenue: "CMD",
  clubAverageAttendance: 76,
  myRank: 7,
  rankedMemberCount: 42,
  eventsByAvenue: Object.freeze([
    { avenue: "CMD", count: 5 },
    { avenue: "CSD", count: 4 },
    { avenue: "PDD", count: 3 },
    { avenue: "PRO", count: 3 },
    { avenue: "GBM", count: 3 },
  ]),
});

const clubRanking = Object.freeze({
  enabled: true,
  value: "Top 10 this quarter",
  subtitle: "Based on verified participation and reporting data.",
});

const baseAttendance = Object.freeze({
  totalCounted: 12,
  present: 10,
  absent: 2,
  na: 1,
  percentage: 83,
  avenueBreakdown: Object.freeze([
    { avenue: "CMD", present: 4, totalCounted: 4, percentage: 100 },
    { avenue: "GBM", present: 3, totalCounted: 4, percentage: 75 },
    { avenue: "PDD", present: 2, totalCounted: 3, percentage: 67 },
    { avenue: "PRO", present: 1, totalCounted: 1, percentage: 100 },
  ]),
  recent: recentClubAttendance,
});

const districtAttendance = Object.freeze({
  totalCounted: 2,
  present: 1,
  absent: 0,
  na: 1,
  percentage: 100,
  avenueBreakdown: Object.freeze([]),
  recent: recentDistrictAttendance,
});

const sharedAnnouncements = Object.freeze([
  {
    id: "preview-independence-service",
    title: "Independence week service plan",
    body: "Club members are requested to review the upcoming service calendar and mark availability with their avenue director.",
    priority: "important",
    publishedAt: "2026-07-27T10:00:00.000+05:30",
    expiresAt: "",
    read: false,
    dismissible: false,
  },
  {
    id: "preview-dashboard-note",
    title: "Dashboard data check",
    body: "Attendance, dues, and reporting cards shown here are static CWD preview examples.",
    priority: "normal",
    publishedAt: "2026-07-24T18:30:00.000+05:30",
    expiresAt: "",
    read: true,
    dismissible: false,
  },
]);

const roleProfiles = Object.freeze({
  prospect: Object.freeze({
    name: "Aarohi Kulkarni",
    email: "aarohi.kulkarni@example.com",
    role: "prospect",
    phone: "+91 98765 43010",
    rotaryId: "",
    previousRotaract: false,
    joinReason: "I want to contribute to community service projects while learning from the club team.",
    referred: true,
    referredBy: "Riya Mehta",
  }),
  gbm: Object.freeze({
    name: "Nikhil Shah",
    email: "nikhil.shah@example.com",
    role: "gbm",
    phone: "+91 98765 43011",
    rotaryId: "RID-GBM-2042",
    clubPosition: "General Body Member",
    positionKeys: [],
  }),
  bod: Object.freeze({
    name: "Riya Mehta",
    email: "riya.mehta@example.com",
    role: "bod",
    phone: "+91 98765 43012",
    rotaryId: "RID-BOD-1188",
    clubPosition: "Club Service Director",
    positionKeys: ["csd"],
  }),
  admin: Object.freeze({
    name: "Kabir Desai",
    email: "kabir.desai@example.com",
    role: "admin",
    phone: "+91 98765 43013",
    rotaryId: "RID-ADM-3131",
    clubPosition: "Club Administrator",
    positionKeys: [],
  }),
});

const prospectProgress = Object.freeze({
  criteriaVersion: 1,
  requiredConsecutiveAttendance: 3,
  currentConsecutiveAttendance: 2,
  maximumConsecutiveAttendance: 2,
  attendanceProgressCount: 2,
  attendanceRequirementMet: false,
  qualifyingEvents: Object.freeze([
    { id: "preview-prospect-gbm", name: "July General Body Meeting", date: "2026-07-06" },
    { id: "preview-prospect-drive", name: "Community Food Drive", date: "2026-07-12" },
  ]),
  attendanceRequirementMetAt: "",
  fourthEligibleActivityDate: "",
  duesDue: false,
  duesPaid: false,
  ready: false,
  whatsappJoined: false,
  completedCount: 1,
  totalCount: 3,
  percent: 42,
  status: "In Progress",
  nextStep: "Attend one more eligible club activity consecutively to complete the attendance requirement.",
});

const roleMeta = Object.freeze({
  prospect: Object.freeze({
    kicker: "Membership journey",
    title: "Prospect dashboard preview",
    summary: "Path, attendance, dues, qualifying activities, opportunities, and support are shown with mock progress.",
  }),
  gbm: Object.freeze({
    kicker: "Member dashboard",
    title: "GBM dashboard preview",
    summary: "Member announcements, attendance, event participation, upcoming events, and static actions are shown.",
  }),
  bod: Object.freeze({
    kicker: "Leadership dashboard",
    title: "BOD dashboard preview",
    summary: "BOD notices, reporting reminders, pending MOM and attendance items, and BOD Tools entry points are shown.",
  }),
  admin: Object.freeze({
    kicker: "Admin dashboard",
    title: "Admin dashboard preview",
    summary: "Admin notices, management tasks, action sections, and club pulse cards are shown without live operations.",
  }),
});

function memberDashboardFor(role) {
  return {
    mode: "member",
    profile: roleProfiles[role],
    clubRanking,
    announcements: sharedAnnouncements,
    openResolutions: [],
    upcomingEvents,
    myAttendance: {
      ...baseAttendance,
      present: role === "admin" ? 11 : role === "bod" ? 9 : baseAttendance.present,
      absent: role === "admin" ? 1 : role === "bod" ? 3 : baseAttendance.absent,
      percentage: role === "admin" ? 92 : role === "bod" ? 75 : baseAttendance.percentage,
    },
    districtAttendance,
    clubStats,
  };
}

const prospectDashboard = Object.freeze({
  mode: "prospect",
  profile: roleProfiles.prospect,
  clubRanking: { enabled: false, value: "", subtitle: "" },
  announcements: Object.freeze([
    {
      id: "preview-prospect-welcome",
      title: "Welcome to your RCPH prospect journey",
      body: "Your club team will keep your journey updated as attendance and dues milestones are verified.",
      priority: "important",
      publishedAt: "2026-07-28T10:00:00.000+05:30",
      expiresAt: "",
      read: false,
      dismissible: false,
    },
  ]),
  openResolutions: [],
  upcomingEvents,
  prospectProgress,
});

const previewData = Object.freeze({
  prospect: Object.freeze({
    role: "prospect",
    label: "Prospect",
    meta: roleMeta.prospect,
    dashboard: prospectDashboard,
  }),
  gbm: Object.freeze({
    role: "gbm",
    label: "GBM",
    meta: roleMeta.gbm,
    dashboard: memberDashboardFor("gbm"),
  }),
  bod: Object.freeze({
    role: "bod",
    label: "BOD",
    meta: roleMeta.bod,
    dashboard: memberDashboardFor("bod"),
  }),
  admin: Object.freeze({
    role: "admin",
    label: "Admin",
    meta: roleMeta.admin,
    dashboard: memberDashboardFor("admin"),
  }),
});

export function getDashboardPreviewData(roleId) {
  return previewData[roleId] || previewData.prospect;
}
