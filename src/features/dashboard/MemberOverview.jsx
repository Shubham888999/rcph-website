import AttendanceSummary from "./AttendanceSummary";
import DashboardMetricCard from "./DashboardMetricCard";
import EventParticipationSummary from "./EventParticipationSummary";

export default function MemberOverview({ data }) {
  const profile = data.profile;
  const stats = data.clubStats;
  return (
    <>
      <section className="dashboard-welcome">
        <p className="auth-access-kicker">Welcome</p>
        <h2>{profile.name || "RCPH Member"}</h2>
        <p>{profile.memberName ? (profile.memberPosition || profile.clubPosition || profile.role.toUpperCase()) : "Your profile is approved, but attendance may not be linked yet."}</p>
      </section>
      <AttendanceSummary attendance={data.myAttendance} districtAttendance={data.districtAttendance} />
      <section className="member-metric-grid" aria-label="Club statistics">
        <DashboardMetricCard label="Total Club Events" value={stats.totalEvents} />
        <DashboardMetricCard label="Most Active Avenue" value={stats.mostActiveAvenue || null} />
        {/*<DashboardMetricCard label="Club Average Attendance" value={stats.clubAverageAttendance === null ? null : stats.clubAverageAttendance + "%"} />*/}
        {/*<DashboardMetricCard label="My Attendance Rank" value={stats.myRank === null ? null : stats.myRank + " of " + (stats.rankedMemberCount ?? "?")} />*/}
        {data.clubRanking.enabled ? <DashboardMetricCard label="Club Ranking" value={data.clubRanking.value} detail={data.clubRanking.subtitle} /> : null}
      </section>
      <EventParticipationSummary recent={data.myAttendance.recent} districtRecent={data.districtAttendance.recent} upcoming={data.upcomingEvents} />
      <section className="member-dashboard-section">
        <h2>Events By Avenue</h2>
        {stats.eventsByAvenue.length ? <ul className="avenue-event-counts">{stats.eventsByAvenue.map((row) => <li key={row.avenue}><span>{row.avenue}</span><strong>{row.count}</strong></li>)}</ul> : <p className="dashboard-empty">No public club events are available.</p>}
      </section>
    </>
  );
}
