import { motion, useReducedMotion } from "framer-motion";
import { getAvenue } from "../../calendar/avenues";
import { attendanceStreak, avenueBars } from "./dashboardUpgradeModel";

const RADIUS = 62;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Attendance ring, totals, streak and a bar per avenue, all from the member's attendance data.
export default function YearAtGlance({ attendance, district }) {
  const reduceMotion = useReducedMotion();
  const percent = attendance.percentage;
  const bars = avenueBars(attendance.avenueBreakdown);
  const streak = attendanceStreak(attendance.recent);
  const filled = percent === null ? 0 : (percent / 100) * CIRCUMFERENCE;

  return (
    <section className="dash-year" aria-labelledby="dash-year-title">
      <p className="dash-kicker" id="dash-year-title">Your year at a glance</p>
      <div className="dash-year__top">
        <svg className="dash-ring" viewBox="0 0 150 150" role="img" aria-label={percent === null ? "Attendance not available yet" : `${percent} percent attendance`}>
          <circle cx="75" cy="75" r={RADIUS} className="dash-ring__track" />
          <motion.circle
            cx="75"
            cy="75"
            r={RADIUS}
            className="dash-ring__value"
            transform="rotate(-90 75 75)"
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            initial={reduceMotion ? false : { strokeDashoffset: CIRCUMFERENCE }}
            animate={{ strokeDashoffset: CIRCUMFERENCE - filled }}
            transition={{ duration: reduceMotion ? 0 : 1.1, ease: [0.22, 1, 0.36, 1] }}
          />
          <text x="75" y="78" className="dash-ring__number">{percent === null ? "-" : `${percent}%`}</text>
          <text x="75" y="101" className="dash-ring__label">attendance</text>
        </svg>
        <div className="dash-year__totals">
          <dl>
            <div><dt>attended</dt><dd>{attendance.present ?? 0}</dd></div>
            <div><dt>counted</dt><dd>{attendance.totalCounted ?? 0}</dd></div>
            <div className="is-teal"><dt>district</dt><dd>{district.present ?? 0}</dd></div>
          </dl>
          {streak >= 2 ? <p className="dash-streak">{streak} in a row · keep it going</p> : null}
        </div>
      </div>
      {bars.length ? (
        <div className="dash-bars">
          <p className="dash-bars__label">By avenue</p>
          <ul>
            {bars.map((bar) => (
              <li key={bar.avenue}>
                <span className="dash-bars__code" title={getAvenue(bar.avenue).label}>{bar.avenue}</span>
                <span className="dash-bars__track" aria-hidden="true">
                  <motion.span
                    style={{ background: getAvenue(bar.avenue).color }}
                    initial={reduceMotion ? false : { width: 0 }}
                    animate={{ width: `${bar.percent}%` }}
                    transition={{ duration: reduceMotion ? 0 : 0.8, ease: [0.22, 1, 0.36, 1] }}
                  />
                </span>
                <span className="dash-bars__count">{bar.present}/{bar.total}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
