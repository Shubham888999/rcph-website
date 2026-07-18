import { useId, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import AttendanceMark from "../../components/status/AttendanceMark";
import { formatDashboardDate } from "./dashboardModel";

export function DashboardEmptyState({ title, children, href = "", linkText = "" }) {
  return (
    <div className="dashboard-empty-state">
      <strong>{title}</strong>
      <p>{children}</p>
      {href && linkText ? <Link to={href}>{linkText}</Link> : null}
    </div>
  );
}

export function EventList({ events, emptyTitle, emptyText, emptyHref = "", emptyLinkText = "", attendance = false, district = false }) {
  const reduceMotion = useReducedMotion();
  if (!events.length) {
    return <DashboardEmptyState title={emptyTitle} href={emptyHref} linkText={emptyLinkText}>{emptyText}</DashboardEmptyState>;
  }
  return (
    <motion.ul
      className={`dashboard-event-ledger${district ? " dashboard-event-ledger--district" : ""}`}
      initial={reduceMotion ? false : "hidden"}
      whileInView={reduceMotion ? undefined : "visible"}
      viewport={{ once: true, amount: 0.2 }}
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}
    >
      {events.map((event) => {
        const formattedDate = formatDashboardDate(event.date);
        return (
          <motion.li key={event.id} variants={reduceMotion ? undefined : rowReveal}>
            <time dateTime={event.date}>{formattedDate}</time>
            <div>
              <strong>{event.name}</strong>
              <span>{event.endDate ? `Through ${formatDashboardDate(event.endDate)}` : "Single-day event"}</span>
              <span>{event.avenues.length ? event.avenues.join(" · ") : district ? "District activity" : "Club event"}</span>
            </div>
            {attendance ? <AttendanceMark value={event.label} size="small" /> : null}
          </motion.li>
        );
      })}
    </motion.ul>
  );
}

export default function EventParticipationSummary({ recent, districtAttendance, upcoming }) {
  const districtRecent = districtAttendance.recent;
  const [recentOpen, setRecentOpen] = useState(false);
  const recentPanelId = useId();

  return (
    <section className="dashboard-activity" aria-labelledby="activity-title">
      <header className="dashboard-section-heading">
        <div><p className="dashboard-eyebrow">Recent and upcoming</p><h2 id="activity-title">Your club activity</h2></div>
      </header>
      <div className="dashboard-activity__primary">
<section className="dashboard-activity__recent" aria-labelledby="recent-attendance-title">
  <div className="dashboard-collapsible-heading">
    <h3 id="recent-attendance-title">Recent attendance</h3>
    <button
      type="button"
      aria-expanded={recentOpen}
      aria-controls={recentPanelId}
      onClick={() => setRecentOpen((current) => !current)}
    >
      {recentOpen ? "Hide" : "Show"}
    </button>
  </div>

  <div
    id={recentPanelId}
    className={recentOpen ? "dashboard-collapsible-panel is-open" : "dashboard-collapsible-panel"}
  >
    <EventList
      events={recent}
      attendance
      emptyTitle="No attendance records yet"
      emptyText="Your recent club-event attendance will appear after the next recorded event."
    />
  </div>
</section>
        <section aria-labelledby="upcoming-events-title">
          <h3 id="upcoming-events-title">Upcoming events</h3>
          <EventList
            events={upcoming}
            emptyTitle="No upcoming public events"
            emptyText="No public events are currently scheduled. Check the calendar for updates."
            emptyHref="/calendar"
            emptyLinkText="View calendar"
          />
        </section>
      </div>
      <section className="dashboard-district-ledger" aria-labelledby="district-attendance-title">
        <div>
          <p className="dashboard-eyebrow">Beyond the club</p>
          <h3 id="district-attendance-title">District participation</h3>
          {districtAttendance.totalCounted && districtAttendance.percentage !== null ? (
            <p className="dashboard-district-ledger__summary">
              {districtAttendance.present ?? 0} present across {districtAttendance.totalCounted} counted activities · {districtAttendance.percentage}%
            </p>
          ) : null}
        </div>
        <EventList
          events={districtRecent}
          attendance
          district
          emptyTitle="No district participation yet"
          emptyText="District participation has not been recorded for your profile."
        />
      </section>
    </section>
  );
}

const rowReveal = {
  hidden: { opacity: 1, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};
