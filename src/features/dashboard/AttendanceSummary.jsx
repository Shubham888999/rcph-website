import { motion, useReducedMotion } from "framer-motion";
import { getAttendanceStory } from "./dashboardPresentationModel";

export default function AttendanceSummary({ attendance }) {
  const reduceMotion = useReducedMotion();
  const story = getAttendanceStory(attendance);
  const progress = story.percentage === null ? 0 : story.percentage / 100;

  return (
    <section className="dashboard-attendance-feature" aria-labelledby="attendance-feature-title">
      <div className="dashboard-attendance-feature__story">
        <p className="dashboard-eyebrow">Attendance story</p>
        <h2 id="attendance-feature-title">{story.title}</h2>
        <p>{story.detail}</p>
        <dl className="dashboard-attendance-breakdown">
          <div><dt>Present</dt><dd>{attendance.present ?? "Not available"}</dd></div>
          <div><dt>Absent</dt><dd>{attendance.absent ?? "Not available"}</dd></div>
          <div><dt>Counted events</dt><dd>{attendance.totalCounted ?? "Not available"}</dd></div>
        </dl>
      </div>

      {story.hasData ? (
        <div
          className="dashboard-attendance-meter"
          role="progressbar"
          aria-label="Club attendance percentage"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={story.percentage}
        >
          <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
            <circle className="dashboard-attendance-meter__track" cx="60" cy="60" r="50" pathLength="1" />
            <motion.circle
              className="dashboard-attendance-meter__value"
              cx="60"
              cy="60"
              r="50"
              pathLength="1"
              initial={reduceMotion ? { pathLength: progress } : { pathLength: 0 }}
              whileInView={{ pathLength: progress }}
              viewport={{ once: true, amount: 0.7 }}
              transition={{ duration: reduceMotion ? 0 : 0.8, ease: [0.22, 1, 0.36, 1] }}
            />
          </svg>
          <span><strong>{story.percentage}%</strong><small>club attendance</small></span>
        </div>
      ) : (
        <div className="dashboard-attendance-feature__empty" aria-label="No counted attendance events yet">
          <span aria-hidden="true">—</span>
          <strong>Tracking begins with your first counted event</strong>
        </div>
      )}

      {attendance.avenueBreakdown.length ? (
        <div className="dashboard-attendance-feature__avenues">
          <h3>Attendance by avenue</h3>
          <ul>
            {attendance.avenueBreakdown.map((row) => (
              <li key={row.avenue}>
                <span>{row.avenue}</span>
                <span>{row.present} of {row.totalCounted} present</span>
                <strong>{row.percentage}%</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
