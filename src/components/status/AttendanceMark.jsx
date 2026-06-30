import { resolveAttendanceMark } from "./attendanceMarkModel";

const SIZES = new Set(["small", "medium", "large"]);

export default function AttendanceMark({ value, size = "medium", showLabel = false, className = "" }) {
  const mark = resolveAttendanceMark(value);
  const normalizedSize = SIZES.has(size) ? size : "medium";
  const classes = [
    "attendance-mark",
    `attendance-mark--${mark.kind}`,
    `attendance-mark--${normalizedSize}`,
    className,
  ].filter(Boolean).join(" ");

  return (
    <span className={classes} role="img" aria-label={mark.label} title={mark.label}>
      {mark.imageSrc ? <img src={mark.imageSrc} alt="" aria-hidden="true" /> : (
        <span className="attendance-mark__fallback">{mark.label}</span>
      )}
      {showLabel && mark.imageSrc ? <span className="attendance-mark__label">{mark.label}</span> : null}
    </span>
  );
}
