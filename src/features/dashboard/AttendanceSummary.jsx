import DashboardMetricCard from "./DashboardMetricCard";

function value(value, suffix = "") {
  return value === null ? null : "" + value + suffix;
}

export default function AttendanceSummary({ attendance, districtAttendance }) {
  return (
    <>
      <section className="member-metric-grid" aria-label="Personal attendance summary">
        <DashboardMetricCard label="My Attendance" value={value(attendance.percentage, "%")} />
        <DashboardMetricCard label="Events Attended" value={attendance.present} />
        <DashboardMetricCard label="Events Missed" value={attendance.absent} />
      </section>
      <section className="member-dashboard-section">
        <div className="dashboard-section-heading"><h2>Attendance Progress</h2><span>{attendance.totalCounted ?? "Unknown"} counted events</span></div>
        <progress max="100" value={attendance.percentage ?? 0} aria-label="Attendance percentage">{attendance.percentage ?? 0}%</progress>
        <p>{attendance.present ?? "Unknown"} present, {attendance.absent ?? "Unknown"} absent.</p>
        {attendance.avenueBreakdown.length ? (
          <ul className="avenue-breakdown">
            {attendance.avenueBreakdown.map((row) => <li key={row.avenue}><strong>{row.avenue}</strong><span>{row.present}/{row.totalCounted} present</span><span>{row.percentage}%</span></li>)}
          </ul>
        ) : <p className="dashboard-empty">No avenue attendance has been recorded yet.</p>}
      </section>
    </>
  );
}
