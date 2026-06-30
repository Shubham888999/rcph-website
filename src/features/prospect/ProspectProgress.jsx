import { EventList } from "../dashboard/EventParticipationSummary";
import DashboardMetricCard from "../dashboard/DashboardMetricCard";

export default function ProspectProgress({ data }) {
  const progress = data.prospectProgress;
  const required = progress.requiredConsecutiveAttendance;
  return (
    <>
      <section className="dashboard-welcome">
        <p className="auth-access-kicker">Prospect dashboard</p>
        <h2>{data.profile.name || "Prospect"} (Prospect)</h2>
        <p>Complete the verified membership criteria below to become an official RCPH member.</p>
      </section>
      {data.clubRanking.enabled ? (
        <section className="member-metric-grid" aria-label="Club ranking">
          <DashboardMetricCard label="Club Ranking" value={data.clubRanking.value} detail={data.clubRanking.subtitle} />
        </section>
      ) : null}
      <section className="member-dashboard-section prospect-progress">
        <div className="dashboard-section-heading"><div><p className="auth-access-kicker">Membership criteria</p><h2>Your onboarding progress</h2></div><strong>{progress.status}</strong></div>
        <progress max="100" value={progress.percent ?? 0} aria-label="Membership onboarding progress">{progress.percent ?? 0}%</progress>
        <p>{progress.nextStep}</p>
        <ul className="prospect-criteria-list">
          <li className={progress.attendanceRequirementMet ? "is-complete" : ""}><strong>Attend {required ?? 3} consecutive meetings/events</strong><span>Current streak: {progress.attendanceProgressCount ?? "Unknown"} / {required ?? "Unknown"}</span></li>
          <li className={progress.duesPaid ? "is-complete" : ""}><strong>Dues status</strong><span>{progress.duesPaid ? "Paid" : progress.duesDue ? "Pending" : "Not yet due"}</span></li>
        </ul>
        {progress.attendanceRequirementMet && progress.qualifyingEvents.length ? (
          <div><h3>Qualifying activities</h3><EventList events={progress.qualifyingEvents.map((event) => ({ ...event, avenues: [], endDate: "" }))} emptyText="" /></div>
        ) : null}
        <p className="dashboard-empty">For community updates, contact the club team. No verified WhatsApp invitation is currently available.</p>
      </section>
      <section className="member-dashboard-section"><h2>Upcoming Events</h2><EventList events={data.upcomingEvents} emptyText="No upcoming public events." /></section>
    </>
  );
}
