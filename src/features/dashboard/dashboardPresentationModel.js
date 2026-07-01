const ROLE_LABELS = Object.freeze({
  prospect: "Prospect",
  gbm: "General Body Member",
  bod: "Board of Directors",
  admin: "Administrator",
  president: "President",
});

export function clampDashboardPercentage(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, value));
}

export function formatDashboardMetric(value, suffix = "") {
  if (value === null || value === undefined || value === "") return "Not available yet";
  return `${value}${suffix}`;
}

function eventsUntilEightyPercent(present, total) {
  if (!Number.isInteger(present) || !Number.isInteger(total) || present < 0 || total <= 0 || present > total) return null;
  let additional = 0;
  while (((present + additional) / (total + additional)) * 100 < 80 && additional < 1000) additional += 1;
  return additional;
}

export function getAttendanceStory(attendance) {
  const total = attendance?.totalCounted;
  const percentage = clampDashboardPercentage(attendance?.percentage);
  if (!Number.isInteger(total) || total <= 0 || percentage === null) {
    return {
      hasData: false,
      percentage: null,
      title: "Your attendance story starts here",
      detail: "Attendance tracking will begin after your first counted club event.",
    };
  }

  if (percentage >= 80) {
    return { hasData: true, percentage, title: "Strong attendance this year", detail: "Keep showing up and building the club with your team." };
  }

  const remaining = eventsUntilEightyPercent(attendance.present, total);
  return {
    hasData: true,
    percentage,
    title: percentage >= 60 ? "Your momentum is building" : "Every event is a chance to reconnect",
    detail: remaining && remaining > 0
      ? `${remaining} more consecutive ${remaining === 1 ? "attendance" : "attendances"} would bring you to 80%.`
      : "Your verified attendance will continue to update after each counted event.",
  };
}

export function sortAvenueActivity(rows) {
  if (!Array.isArray(rows)) return [];
  return [...rows].sort((a, b) => b.count - a.count || a.avenue.localeCompare(b.avenue));
}

export function getRoleLabel(role) {
  return ROLE_LABELS[role] || "RCPH Member";
}

export function getProspectJourney(progress) {
  if (!progress) return [];
  const attendanceStarted = (progress.attendanceProgressCount || progress.currentConsecutiveAttendance || 0) > 0;
  return [
    { key: "joined", title: "Joined as a Prospect", state: "complete", detail: "Your RCPH membership journey is active." },
    {
      key: "attendance",
      title: `Attend ${progress.requiredConsecutiveAttendance ?? "required"} eligible activities consecutively`,
      state: progress.attendanceRequirementMet ? "complete" : attendanceStarted ? "current" : "upcoming",
      detail: `${progress.attendanceProgressCount ?? 0} of ${progress.requiredConsecutiveAttendance ?? "the required"} recorded`,
    },
    {
      key: "dues",
      title: "Complete membership dues",
      state: progress.duesPaid ? "complete" : progress.duesDue ? "current" : "upcoming",
      detail: progress.duesPaid ? "Paid" : progress.duesDue ? "Payment is due" : "Available after the attendance requirement",
    },
    {
      key: "review",
      title: "Membership review",
      state: progress.ready ? "current" : "upcoming",
      detail: progress.ready ? "Criteria complete; club review is pending" : "Begins after all verified criteria are complete",
    },
  ];
}

export function getProspectNextAction(progress) {
  if (!progress) return { title: "Progress is unavailable", detail: "Retry the dashboard request to see your next step.", href: "" };
  if (progress.ready) return { title: "Await membership review", detail: progress.nextStep, href: "" };
  if (!progress.attendanceRequirementMet) return { title: "Build your attendance streak", detail: progress.nextStep, href: "/calendar" };
  if (progress.duesDue && !progress.duesPaid) return { title: "Complete your membership dues", detail: progress.nextStep, href: "/contact" };
  return { title: "Keep in touch with the club", detail: progress.nextStep, href: "/contact" };
}
