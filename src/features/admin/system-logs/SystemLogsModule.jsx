import { useEffect, useMemo, useState } from "react";
import AdminModuleHeader from "../AdminModuleHeader";
import { AdminEmpty, AdminError, AdminLoading } from "../shared/AdminStates";
import { getSystemLogs } from "./systemLogsService";
import {
  SYSTEM_LOG_ACTIONS,
  SYSTEM_LOG_CATEGORIES,
  SYSTEM_LOG_STATUSES,
  formatSystemLogDate,
  labelize,
  summarizeSystemLogs,
} from "./systemLogsModel";

const DEFAULT_FILTERS = {
  category: "",
  action: "",
  status: "",
  dateFrom: "",
  dateTo: "",
  actor: "",
  search: "",
  limit: 80,
};

function SystemLogsSummary({ summary }) {
  const cards = [
    ["Today", summary.today],
    ["This week", summary.thisWeek],
    ["Failed", summary.failed],
    ["Active notices", summary.activeNotices],
  ];
  return <section className="admin-metric-grid system-logs-summary" aria-label="System logs summary">
    {cards.map(([label, value]) => <article className="admin-metric system-log-metric" key={label}><span>{label}</span><strong>{value}</strong></article>)}
  </section>;
}

function SystemLogsFilters({ draft, busy, onChange, onSubmit, onReset }) {
  return <form className="admin-panel system-logs-filters" onSubmit={onSubmit}>
    <label><span>Category</span><select value={draft.category} onChange={(event) => onChange({ category: event.target.value })}>
      <option value="">All</option>
      {SYSTEM_LOG_CATEGORIES.map((category) => <option key={category} value={category}>{labelize(category)}</option>)}
    </select></label>
    <label><span>Action</span><select value={draft.action} onChange={(event) => onChange({ action: event.target.value })}>
      <option value="">All</option>
      {SYSTEM_LOG_ACTIONS.map((action) => <option key={action} value={action}>{labelize(action)}</option>)}
    </select></label>
    <label><span>Status</span><select value={draft.status} onChange={(event) => onChange({ status: event.target.value })}>
      <option value="">All</option>
      {SYSTEM_LOG_STATUSES.map((status) => <option key={status} value={status}>{labelize(status)}</option>)}
    </select></label>
    <label><span>From</span><input type="date" value={draft.dateFrom} onChange={(event) => onChange({ dateFrom: event.target.value })} /></label>
    <label><span>To</span><input type="date" value={draft.dateTo} onChange={(event) => onChange({ dateTo: event.target.value })} /></label>
    <label><span>Actor</span><input value={draft.actor} onChange={(event) => onChange({ actor: event.target.value })} /></label>
    <label className="system-logs-filters__search"><span>Search</span><input value={draft.search} onChange={(event) => onChange({ search: event.target.value })} /></label>
    <label><span>Limit</span><select value={draft.limit} onChange={(event) => onChange({ limit: Number(event.target.value) })}>
      {[40, 80, 120, 200].map((limit) => <option key={limit} value={limit}>{limit}</option>)}
    </select></label>
    <div className="admin-actions system-logs-filters__actions">
      <button type="submit" disabled={busy}>{busy ? "Loading..." : "Apply"}</button>
      <button type="button" disabled={busy} onClick={onReset}>Reset</button>
    </div>
  </form>;
}

function StatusBadge({ status }) {
  return <span className={`system-log-badge system-log-badge--${status || "info"}`}>{labelize(status || "info")}</span>;
}

function SystemLogsTable({ logs }) {
  if (!logs.length) return <AdminEmpty message="No logs match the current filters." />;
  return <section className="admin-panel system-logs-feed">
    <div className="system-logs-section-heading"><h3>Feed</h3><span>{logs.length} rows</span></div>
    <div className="admin-table-wrap system-logs-table-wrap">
      <table>
        <thead><tr><th>Timestamp</th><th>Category</th><th>Action</th><th>Actor</th><th>Target</th><th>Status</th><th>Details</th></tr></thead>
        <tbody>{logs.map((log) => <tr key={log.id}>
          <td><time dateTime={log.createdAt}>{formatSystemLogDate(log.createdAt)}</time></td>
          <td>{labelize(log.category)}</td>
          <td>{labelize(log.action)} {log.reconstructed ? <span className="system-log-reconstructed">Reconstructed</span> : null}</td>
          <td><span>{log.actorName || log.actorUid || "System"}</span><small>{log.actorRole || log.actorUid}</small></td>
          <td><span>{log.targetLabel || log.targetId || log.targetType}</span><small>{log.targetType}{log.targetAudience ? ` - ${log.targetAudience}` : ""}</small></td>
          <td><StatusBadge status={log.status} /></td>
          <td><span>{log.details || log.source}</span><small>{log.source}</small></td>
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}

function VisibleForList({ people }) {
  if (!people.length) return <span className="system-logs-muted">Audience only</span>;
  return <ul className="system-logs-people">
    {people.slice(0, 12).map((person) => <li key={person.uid || person.name}><strong>{person.name}</strong><span>{[person.role, person.status].filter(Boolean).join(" - ")}</span></li>)}
    {people.length > 12 ? <li><strong>{people.length - 12} more</strong><span>Resolved recipients</span></li> : null}
  </ul>;
}

function ActiveDashboardNotices({ notices }) {
  return <section className="admin-panel system-logs-notices" aria-labelledby="active-dashboard-notices">
    <div className="system-logs-section-heading"><h3 id="active-dashboard-notices">Active dashboard notices</h3><span>{notices.length} active</span></div>
    {notices.length ? <div className="system-logs-notice-list">
      {notices.map((notice) => <article className="system-log-notice" key={notice.id}>
        <header><div><h4>{notice.title}</h4><p>{notice.derived ? "Derived" : "Persisted"} - {notice.source}</p></div><StatusBadge status="active" /></header>
        {notice.body ? <p className="system-log-notice__body">{notice.body}</p> : null}
        <dl>
          <div><dt>Audience</dt><dd>{notice.targetAudience || "Unresolved"}</dd></div>
          <div><dt>Window</dt><dd>{[notice.lockedAvenue || notice.avenueLabel, notice.reportingWindowId, notice.lockReason].filter(Boolean).join(" - ") || "Dashboard announcement"}</dd></div>
          <div><dt>Dates</dt><dd>{[notice.publishedAt ? `Published ${formatSystemLogDate(notice.publishedAt)}` : "", notice.expiresAt ? `Expires ${formatSystemLogDate(notice.expiresAt)}` : ""].filter(Boolean).join(" - ") || "Active until source changes"}</dd></div>
          {notice.deliverySummary.total ? <div><dt>Delivery</dt><dd>{notice.deliverySummary.read} read, {notice.deliverySummary.unread} unread, {notice.deliverySummary.dismissed} dismissed</dd></div> : null}
        </dl>
        <VisibleForList people={notice.visibleFor} />
      </article>)}
    </div> : <AdminEmpty message="No active dashboard notices are currently visible." />}
  </section>;
}

export default function SystemLogsModule({ uid, access }) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [draft, setDraft] = useState(DEFAULT_FILTERS);
  const [state, setState] = useState({ status: "loading", logs: [], activeNotices: [], summary: null, error: "" });

  useEffect(() => {
    if (!uid || access?.canAccessSystemLogs !== true) return undefined;
    let active = true;
    setState((current) => ({ ...current, status: "loading", error: "" }));
    getSystemLogs(uid, filters)
      .then((result) => {
        if (!active) return;
        setState({ status: "success", logs: result.logs, activeNotices: result.activeNotices, summary: result.summary, error: "" });
      })
      .catch((error) => {
        if (!active) return;
        setState({ status: "error", logs: [], activeNotices: [], summary: null, error: error?.message || "System logs could not be loaded." });
      });
    return () => { active = false; };
  }, [access?.canAccessSystemLogs, filters, uid]);

  const summary = useMemo(
    () => state.summary || summarizeSystemLogs(state.logs, state.activeNotices),
    [state.activeNotices, state.logs, state.summary],
  );

  if (access?.canAccessSystemLogs !== true) {
    return <AdminError message="You do not have access to this protected Admin module." />;
  }

  function updateDraft(patch) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function applyFilters(event) {
    event.preventDefault();
    setFilters(draft);
  }

  function resetFilters() {
    setDraft(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
  }

  return <>
    <AdminModuleHeader title="Logs" description="Private system activity for the active Club Website Director." />
    <SystemLogsSummary summary={summary} />
    <SystemLogsFilters draft={draft} busy={state.status === "loading"} onChange={updateDraft} onSubmit={applyFilters} onReset={resetFilters} />
    {state.status === "loading" ? <AdminLoading label="Loading system logs..." /> : null}
    {state.status === "error" ? <AdminError message={state.error} /> : null}
    {state.status === "success" ? <>
      <ActiveDashboardNotices notices={state.activeNotices} />
      <SystemLogsTable logs={state.logs} />
    </> : null}
  </>;
}
