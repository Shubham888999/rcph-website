import { getAvenue } from "../calendar/avenues";
import AttendanceSummary from "./AttendanceSummary";
import DashboardMetricRail from "./DashboardMetricRail";
import EventParticipationSummary from "./EventParticipationSummary";
import { sortAvenueActivity } from "./dashboardPresentationModel";

export default function MemberOverview({ data }) {
  const stats = data.clubStats;
  const avenueActivity = sortAvenueActivity(stats.eventsByAvenue);
  const maxAvenueCount = Math.max(...avenueActivity.map(({ count }) => count), 1);
  const metrics = [
    { key: "attended", label: "Events attended", value: data.myAttendance.present },
    { key: "missed", label: "Events missed", value: data.myAttendance.absent },
    { key: "club-events", label: "Club events", value: stats.totalEvents },
    { key: "active-avenue", label: "Most active avenue", value: stats.mostActiveAvenue || null },
  ];
  if (data.clubRanking.enabled) {
    metrics.push({ key: "club-ranking", label: "Club ranking", value: data.clubRanking.value, detail: data.clubRanking.subtitle });
  }

  return (
    <>
      <AttendanceSummary attendance={data.myAttendance} />
      <DashboardMetricRail items={metrics} label="Personal and club pulse" />
      <EventParticipationSummary
        recent={data.myAttendance.recent}
        districtAttendance={data.districtAttendance}
        upcoming={data.upcomingEvents}
      />
      <section className="dashboard-avenue-activity" aria-labelledby="avenue-activity-title">
        <header className="dashboard-section-heading">
          <div><p className="dashboard-eyebrow">Club pulse</p><h2 id="avenue-activity-title">Activity by avenue</h2></div>
        </header>
        {avenueActivity.length ? (
          <ul>
            {avenueActivity.map((row) => {
              const avenue = getAvenue(row.avenue);
              return (
                <li key={row.avenue} style={{ "--dashboard-avenue-color": avenue.color }}>
                  <div><span>{avenue.label}</span><strong>{row.count}</strong></div>
                  <span className="dashboard-avenue-activity__track" aria-hidden="true">
                    <span style={{ width: `${(row.count / maxAvenueCount) * 100}%` }} />
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="dashboard-empty-state dashboard-empty-state--compact">
            <strong>No avenue activity yet</strong>
            <p>Avenue activity will appear as club events are recorded.</p>
          </div>
        )}
      </section>
    </>
  );
}
