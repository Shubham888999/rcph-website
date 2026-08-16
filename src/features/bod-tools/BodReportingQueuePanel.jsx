import {
  formatConductedDate,
  formatEventTime,
  formatReportingDeadline,
  reportingActionLabel,
  reportingStatusLabel,
  reportingStatusTone,
  runtimeStateLabel,
  shouldRenderBodReportingQueuePanel,
} from "./bodReportingQueueModel";

function assigneeFallback(group) {
  return group.responsibilityType === "secretary"
    ? "No active Secretary assigned"
    : "No active Director assigned";
}

function assigneeLabel(assignee) {
  return assignee.positionLabel || (assignee.assignmentType === "co" ? "Co-Director" : "Director");
}

function ReportingResponsibility({ group, status }) {
  const tone = reportingStatusTone(status);
  return (
    <li className={`bod-reporting-queue__avenue is-${tone}`}>
      <div className="bod-reporting-queue__avenue-status">
        <strong>{group.avenueLabel || group.avenue}</strong>
        <span>{reportingStatusLabel(status)}</span>
      </div>
      <div className="bod-reporting-queue__assignees">
        {group.assignees.length ? (
          group.assignees.map((assignee) => (
            <span key={`${group.avenue}-${assignee.uid}-${assignee.positionKey || assignee.positionLabel}`}>
              <b>{assigneeLabel(assignee)}:</b> {assignee.name}
            </span>
          ))
        ) : (
          <span className="bod-reporting-queue__assignee-missing">{assigneeFallback(group)}</span>
        )}
      </div>
    </li>
  );
}

function ReportingQueueItem({ item, openingId, onAddEvent, onContinueEvent }) {
  const actionLabel = reportingActionLabel(item.action);
  const runtimeLabel = runtimeStateLabel(item);
  const opening = openingId === item.reportingWindowId;
  const disabled = item.locked || Boolean(openingId);
  const conducted = [
    `Conducted: ${formatConductedDate(item.conductedDate)}`,
    formatEventTime(item.eventTime),
  ].filter(Boolean).join(" · ");
  const onAction = () => {
    if (disabled || !actionLabel) return;
    if (item.action === "continue_event") onContinueEvent(item);
    else onAddEvent(item);
  };

  return (
    <li className={`bod-reporting-queue__item ${item.locked ? "is-locked" : ""}`}>
      <div className="bod-reporting-queue__main">
        <div className="bod-reporting-queue__title-row">
          <h3>{item.eventName}</h3>
          {runtimeLabel ? <span className={`bod-reporting-queue__runtime ${item.locked ? "is-locked" : ""}`}>{runtimeLabel}</span> : null}
        </div>
        <p className="bod-reporting-queue__meta">{conducted}</p>
        <p className="bod-reporting-queue__deadline">Reporting deadline: {formatReportingDeadline(item.reportingDueAt)}</p>
        <ul className="bod-reporting-queue__avenues" aria-label={`Reporting status for ${item.eventName}`}>
          {item.responsibilities.map((group) => (
            <ReportingResponsibility
              key={`${item.reportingWindowId}-${group.avenue}`}
              group={group}
              status={item.coverage.avenueStatuses[group.avenue] || group.reportStatus}
            />
          ))}
        </ul>
      </div>
      <div className="bod-reporting-queue__actions">
        {actionLabel ? (
          <button
            type="button"
            className="bod-button--primary"
            disabled={disabled}
            aria-label={`${actionLabel} for ${item.eventName}`}
            aria-busy={opening}
            onClick={onAction}
          >
            {opening ? "Opening..." : actionLabel}
          </button>
        ) : null}
      </div>
    </li>
  );
}

export default function BodReportingQueuePanel({
  status = "idle",
  items = [],
  error = "",
  openingId = "",
  onRetry,
  onAddEvent,
  onContinueEvent,
}) {
  if (!shouldRenderBodReportingQueuePanel({ status, items })) return null;

  return (
    <section className="bod-reporting-queue" aria-labelledby="bod-reporting-queue-title">
      <header className="bod-reporting-queue__header">
        <div>
          <p className="bod-tools-kicker">Reporting workflow</p>
          <h2 id="bod-reporting-queue-title">Events to be reported</h2>
          <p>Complete the pending avenue reports before their reporting deadlines.</p>
        </div>
        {status === "loading" ? <span role="status" aria-live="polite">Updating...</span> : null}
      </header>
      {status === "error" ? (
        <div className="bod-reporting-queue__error" role="alert">
          <p>{error || "Events to be reported could not be loaded."}</p>
          <button type="button" onClick={onRetry}>Retry</button>
        </div>
      ) : null}
      {items.length ? (
        <ul className="bod-reporting-queue__list">
          {items.map((item) => (
            <ReportingQueueItem
              key={item.reportingWindowId}
              item={item}
              openingId={openingId}
              onAddEvent={onAddEvent}
              onContinueEvent={onContinueEvent}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
