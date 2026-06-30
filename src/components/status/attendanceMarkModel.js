export const ATTENDANCE_MARK_ASSETS = Object.freeze({
  present: "/images/attendance/check.png",
  absent: "/images/attendance/cross.png",
  na: "/images/attendance/NA_Button.png",
});

const PRESENT_ALIASES = new Set(["P", "PRESENT", "PRESENTED"]);
const ABSENT_ALIASES = new Set(["A", "ABSENT"]);
const NA_ALIASES = new Set(["NA", "N/A", "NOT APPLICABLE", "NOT_APPLICABLE"]);

const MARKS = Object.freeze({
  present: Object.freeze({ kind: "present", label: "Present", imageSrc: ATTENDANCE_MARK_ASSETS.present }),
  absent: Object.freeze({ kind: "absent", label: "Absent", imageSrc: ATTENDANCE_MARK_ASSETS.absent }),
  na: Object.freeze({ kind: "na", label: "Not applicable", imageSrc: ATTENDANCE_MARK_ASSETS.na }),
});

export function resolveAttendanceMark(value) {
  if (value === true) return MARKS.present;
  if (value === false) return MARKS.absent;
  if (value === null || value === undefined) return MARKS.na;

  const text = typeof value === "string" ? value.trim() : String(value).trim();
  if (!text) return MARKS.na;

  const normalized = text.toUpperCase();
  if (PRESENT_ALIASES.has(normalized)) return MARKS.present;
  if (ABSENT_ALIASES.has(normalized)) return MARKS.absent;
  if (NA_ALIASES.has(normalized)) return MARKS.na;

  return { kind: "unknown", label: text, imageSrc: null };
}
