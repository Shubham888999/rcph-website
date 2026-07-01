import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import DashboardMetricRail from "../dashboard/DashboardMetricRail";
import { DashboardEmptyState, EventList } from "../dashboard/EventParticipationSummary";
import { getProspectJourney, getProspectNextAction } from "../dashboard/dashboardPresentationModel";

export default function ProspectProgress({ data }) {
  const reduceMotion = useReducedMotion();
  const progress = data.prospectProgress;
  const journey = getProspectJourney(progress);
  const nextAction = getProspectNextAction(progress);
  const progressValue = progress.percent === null ? null : progress.percent;
  const metrics = [
    { key: "criteria", label: "Criteria completed", value: progress.completedCount, detail: progress.totalCount ? `of ${progress.totalCount}` : "Verified criteria" },
    { key: "attendance", label: "Attendance streak", value: progress.attendanceProgressCount, detail: progress.requiredConsecutiveAttendance ? `of ${progress.requiredConsecutiveAttendance} required` : "Requirement unavailable" },
    { key: "dues", label: "Dues status", value: progress.duesPaid ? "Paid" : progress.duesDue ? "Pending" : "Not yet due" },
  ];
  if (data.clubRanking.enabled) metrics.push({ key: "ranking", label: "Club ranking", value: data.clubRanking.value, detail: data.clubRanking.subtitle });

  return (
    <>
      <section className="prospect-progress-feature" aria-labelledby="prospect-progress-title">
        <div>
          <p className="dashboard-eyebrow">Path to membership</p>
          <h2 id="prospect-progress-title">{progress.status}</h2>
          <p>{progress.nextStep}</p>
        </div>
        {progressValue !== null ? (
          <div
            className="prospect-progress-feature__meter"
            role="progressbar"
            aria-label="Verified membership criteria progress"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={progressValue}
          >
            <strong>{progressValue}%</strong>
            <span aria-hidden="true"><motion.span initial={reduceMotion ? false : { width: 0 }} whileInView={{ width: `${progressValue}%` }} viewport={{ once: true }} /></span>
          </div>
        ) : (
          <p className="prospect-progress-feature__unavailable">Progress percentage is not currently available.</p>
        )}
      </section>

      <DashboardMetricRail items={metrics} label="Membership journey summary" />

      <section className="prospect-journey" aria-labelledby="prospect-journey-title">
        <header className="dashboard-section-heading">
          <div><p className="dashboard-eyebrow">Verified milestones</p><h2 id="prospect-journey-title">Your membership journey</h2></div>
        </header>
        <ol>
          {journey.map((step) => (
            <li key={step.key} className={`is-${step.state}`}>
              <span className="prospect-journey__marker" aria-hidden="true" />
              <div><strong>{step.title}</strong><span>{step.detail}</span></div>
              <small>{step.state === "complete" ? "Complete" : step.state === "current" ? "In progress" : "Upcoming"}</small>
            </li>
          ))}
        </ol>
      </section>

      {progress.qualifyingEvents.length ? (
        <section className="dashboard-qualifying-events" aria-labelledby="qualifying-events-title">
          <div><p className="dashboard-eyebrow">Verified activity</p><h2 id="qualifying-events-title">Qualifying activities</h2></div>
          <EventList
            events={progress.qualifyingEvents.map((event) => ({ ...event, avenues: [], endDate: "" }))}
            emptyTitle="No qualifying activities"
            emptyText="Qualifying activities will appear after attendance is verified."
          />
        </section>
      ) : null}

      <section className="prospect-next-action" aria-labelledby="prospect-next-action-title">
        <div>
          <p className="dashboard-eyebrow">Next best action</p>
          <h2 id="prospect-next-action-title">{nextAction.title}</h2>
          <p>{nextAction.detail}</p>
        </div>
        {nextAction.href ? <Link to={nextAction.href}>{nextAction.href === "/calendar" ? "View event calendar" : "Contact the club"}</Link> : <span>Club review pending</span>}
      </section>

      <section className="prospect-opportunities" aria-labelledby="prospect-opportunities-title">
        <header><p className="dashboard-eyebrow">Upcoming opportunities</p><h2 id="prospect-opportunities-title">Meet the club at its next event</h2></header>
        <EventList
          events={data.upcomingEvents}
          emptyTitle="No upcoming public events"
          emptyText="No public events are currently scheduled. Check the calendar for future updates."
          emptyHref="/calendar"
          emptyLinkText="View calendar"
        />
      </section>

      <section className="prospect-support" aria-labelledby="prospect-support-title">
        <div><p className="dashboard-eyebrow">Need support?</p><h2 id="prospect-support-title">Stay connected with RCPH</h2></div>
        {progress.hasWhatsAppLink ? null : (
          <DashboardEmptyState title="Contact the club team" href="/contact" linkText="Contact RCPH">
            No verified WhatsApp invitation is currently available. The club team can help with membership questions.
          </DashboardEmptyState>
        )}
      </section>
    </>
  );
}
