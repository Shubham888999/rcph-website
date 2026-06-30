function text(value, max = 180) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function count(value, minimum = 0) {
  return Number.isInteger(value) && value >= minimum ? value : null;
}

function dateOnly(value) {
  if (typeof value !== "string") return "";
  const parts = value.split("-");
  if (parts.length !== 3 || parts.some((part) => !part || Array.from(part).some((c) => c < "0" || c > "9"))) return "";
  const [year, month, day] = parts.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? value
    : "";
}

export function normalizeProspectProgress(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const required = count(raw.requiredConsecutiveAttendance, 1);
  const current = count(raw.currentConsecutiveAttendance);
  const progressCount = count(raw.attendanceProgressCount);
  const attendanceRequirementMet = raw.attendanceRequirementMet === true;
  const duesPaid = raw.duesPaid === true;
  const duesDue = raw.duesDue === true;
  const ready = raw.ready === true;
  const percent = Number.isInteger(raw.percent) && raw.percent >= 0 && raw.percent <= 100
    ? raw.percent
    : null;
  const qualifyingEvents = Array.isArray(raw.qualifyingEvents)
    ? raw.qualifyingEvents.map((event) => {
      const id = text(event?.id, 160);
      const name = text(event?.name, 180);
      const date = dateOnly(event?.date);
      return id && name && date ? { id, name, date } : null;
    }).filter(Boolean)
    : [];

  let status = "Getting Started";
  let nextStep = "Attend 3 eligible club meetings or events consecutively. Missing an eligible activity resets the active streak.";
  if (ready) {
    status = "Ready for Induction";
    nextStep = "All membership criteria are complete. Your induction is pending club approval.";
  } else if (attendanceRequirementMet) {
    status = "Dues Pending";
    nextStep = "Attendance requirement complete. Membership dues are now payable at your 4th eligible club activity.";
  } else if ((current || 0) > 0) {
    status = "In Progress";
  }

  return {
    criteriaVersion: count(raw.criteriaVersion, 1),
    requiredConsecutiveAttendance: required,
    currentConsecutiveAttendance: current,
    maximumConsecutiveAttendance: count(raw.maximumConsecutiveAttendance),
    attendanceProgressCount: progressCount,
    attendanceRequirementMet,
    qualifyingEvents,
    attendanceRequirementMetAt: dateOnly(raw.attendanceRequirementMetAt),
    fourthEligibleActivityDate: dateOnly(raw.fourthEligibleActivityDate),
    duesDue,
    duesPaid,
    ready,
    whatsappJoined: raw.whatsappJoined === true,
    completedCount: count(raw.completedCount),
    totalCount: count(raw.totalCount, 1),
    percent,
    status,
    nextStep,
    hasWhatsAppLink: false,
  };
}
