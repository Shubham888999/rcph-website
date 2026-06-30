import { formatDashboardDate } from "./dashboardModel";
import AttendanceMark from "../../components/status/AttendanceMark";

export function EventList({ events, emptyText, attendance = false }) {
  if (!events.length) return <p className="dashboard-empty">{emptyText}</p>;
  return (
    <ul className="dashboard-event-list">
      {events.map((event) => (
        <li key={event.id}>
          <div>
            <strong>{event.name}</strong>
            <span>{formatDashboardDate(event.date)}{event.endDate ? " - " + formatDashboardDate(event.endDate) : ""}</span>
            <span>{event.avenues.length ? event.avenues.join(", ") : "Other"}</span>
          </div>
          {attendance ? <AttendanceMark value={event.label} size="small" /> : null}
        </li>
      ))}
    </ul>
  );
}

export default function EventParticipationSummary({ recent, districtRecent, upcoming }) {
  return (
    <section className="dashboard-three-column" aria-label="Event participation">
      <article className="member-dashboard-section"><h2>Recent Attendance</h2><EventList events={recent} attendance emptyText="No attendance has been recorded yet." /></article>
      <article className="member-dashboard-section"><h2>District Attendance</h2><EventList events={districtRecent} attendance emptyText="No district attendance has been recorded yet." /></article>
      <article className="member-dashboard-section"><h2>Upcoming Events</h2><EventList events={upcoming} emptyText="No upcoming public events." /></article>
    </section>
  );
}
