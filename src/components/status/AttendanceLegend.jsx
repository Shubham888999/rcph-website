import AttendanceMark from "./AttendanceMark";

const entries = [
  { value: true, label: "Present", title: "Present" },
  { value: false, label: "Absent", title: "Absent" },
  { value: "NA", label: "NA · Granted absence", title: "Granted absence — excluded from attendance calculations" },
  { value: "NULL", label: "Null · Before membership", title: "Not a club member on this event date — excluded from attendance calculations" },
];

export default function AttendanceLegend() {
  return <ul className="attendance-legend" aria-label="Attendance legend">{entries.map(entry => <li key={String(entry.value)} title={entry.title}><AttendanceMark value={entry.value} size="small" ariaLabel={entry.title} /><span>{entry.label}</span></li>)}</ul>;
}
