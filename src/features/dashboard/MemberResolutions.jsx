import { formatRotaractorName } from "../../utils/memberName";

function formatDateTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value));
}

function choiceLabel(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "Not submitted";
}

export default function MemberResolutions({ resolutions, busyId, onVote, onRefresh }) {
  if (!resolutions.length) return null;
  return <section className="member-dashboard-section dashboard-resolutions" aria-labelledby="dashboard-resolutions-title">
    <div className="dashboard-section-heading"><div><p className="auth-access-kicker">Live BOD voting</p><h2 id="dashboard-resolutions-title">Resolutions awaiting your vote</h2></div><button type="button" onClick={onRefresh}>Refresh</button></div>
    <div className="dashboard-resolution-list">{resolutions.map((resolution) => {
      const busy = busyId === resolution.id;
      return <article className="dashboard-resolution-card" key={resolution.id} aria-busy={busy}>
        <header><span>{resolution.resolutionNumber}</span><strong>Voting open</strong></header>
        <h3>{resolution.title}</h3>
        <p className="dashboard-resolution-card__meeting">{resolution.meetingTitle} · {resolution.meetingDate}</p>
        <div className="dashboard-resolution-card__body">{resolution.body}</div>
        <dl><div><dt>Proposed by</dt><dd>{formatRotaractorName(resolution.proposedByName, true)} · {resolution.proposedByPosition}</dd></div><div><dt>Seconded by</dt><dd>{formatRotaractorName(resolution.secondedByName, true)} · {resolution.secondedByPosition}</dd></div></dl>
        <fieldset disabled={busy}><legend>Cast or change your vote</legend><div className="dashboard-resolution-votes">{["approve", "reject", "abstain"].map((choice) => <button type="button" key={choice} className={resolution.currentVote === choice ? "is-selected" : ""} aria-pressed={resolution.currentVote === choice} onClick={() => onVote(resolution, choice)}>{choiceLabel(choice)}</button>)}</div></fieldset>
        <div className="dashboard-resolution-card__current" aria-live="polite"><strong>Your vote: {choiceLabel(resolution.currentVote)}</strong>{resolution.submittedAt ? <span>Submitted at: {formatDateTime(resolution.submittedAt)}</span> : null}<small>You may change your vote while voting remains open.</small></div>
      </article>;
    })}</div>
  </section>;
}
