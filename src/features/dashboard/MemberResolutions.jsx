import { useState } from "react";
import { formatRotaractorName } from "../../utils/memberName";
import { approvalMethodLabel, buildPreparedEmailLinks, buildPreparedReplySubject, canClaimHybridEmailSent, isHybridVoteChoiceLocked } from "../resolutions/resolutionModel";

function formatDateTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value));
}

function choiceLabel(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "Not submitted";
}

function emailStatusLabel(status) {
  if (status === "email_verified") return "Email verified - your vote is now counted";
  if (status === "email_rejected") return "Email confirmation rejected";
  if (status === "email_sent_claimed") return "Email sent - awaiting Admin verification";
  if (status === "email_pending") return "Vote selected";
  return "Vote not submitted";
}

function HybridEmailPanel({ resolution, busy, onClaimEmailSent }) {
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [gmailConfirming, setGmailConfirming] = useState(false);
  const [gmailOpened, setGmailOpened] = useState(false);
  if (resolution.approvalMethod !== "hybrid_email") return null;
  const hasReply = Boolean(resolution.preparedReplyText);
  const canClaim = canClaimHybridEmailSent(resolution.emailConfirmationStatus);
  const requiredSenderEmail = resolution.requiredSenderEmail || "";
  const missingRequiredSender = hasReply && !requiredSenderEmail;
  const links = buildPreparedEmailLinks({
    to: resolution.clubReplyToEmail,
    subject: buildPreparedReplySubject(resolution),
    body: resolution.preparedReplyText,
  });
  const longClientLink = hasReply && (links.mailto.length > 1800 || links.gmail.length > 1800);

  async function copyText() {
    try {
      await navigator.clipboard.writeText(resolution.preparedReplyText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  function confirmEmailSent() {
    setConfirming(false);
    onClaimEmailSent(resolution);
  }

  return <section className="dashboard-resolution-email" aria-label="Hybrid email confirmation">
    <div className={`dashboard-resolution-email__status is-${resolution.emailConfirmationStatus || "not_voted"}`}>
      <strong>{emailStatusLabel(resolution.emailConfirmationStatus)}</strong>
      {resolution.emailConfirmationStatus === "email_pending" ? <span>Confirmation email not yet marked as sent. You may change this choice until you mark the confirmation email as sent.</span> : null}
      {resolution.emailConfirmationStatus === "email_sent_claimed" ? <span>Your selected vote is locked while the email confirmation is being reviewed. It is not counted until an Admin verifies the email.</span> : null}
      {resolution.emailConfirmationStatus === "email_verified" ? <span>Your selected vote is locked and counted in the final result.</span> : null}
      {resolution.emailConfirmationStatus === "email_rejected" ? <span>{resolution.emailVerificationNote ? `Reason: ${resolution.emailVerificationNote}` : "Review the prepared email and send it again from your registered email address."}</span> : null}
    </div>
    {hasReply ? <div className="dashboard-resolution-email__reply">
      <div className={`dashboard-resolution-email__sender${missingRequiredSender ? " is-missing" : ""}`}>
        <span>Required sender</span>
        <strong>{requiredSenderEmail || "Registered email unavailable"}</strong>
        <small>{requiredSenderEmail ? "Use your registered email so Admin can verify your vote." : "Admin cannot verify this confirmation without your registered voter email. Contact an Admin before sending."}</small>
      </div>
      <textarea readOnly rows="9" value={resolution.preparedReplyText} aria-label="Prepared confirmation text" />
      {missingRequiredSender ? <p className="dashboard-resolution-email__hint">Email actions are paused because the required sender address is missing. Your vote is preserved; contact an Admin before sending confirmation.</p> : <>
        <div className="dashboard-resolution-email__actions">
          <a href={links.mailto}>Open default email app</a>
          <button type="button" onClick={() => setGmailConfirming(true)}>Open Gmail</button>
          <button type="button" onClick={copyText}>{copied ? "Copied" : "Copy confirmation text"}</button>
          {canClaim ? <button type="button" disabled={busy} onClick={() => setConfirming(true)}>{resolution.emailConfirmationStatus === "email_rejected" ? "I have resent the email" : "I have sent the email"}</button> : null}
        </div>
        <p className="dashboard-resolution-email__hint">Admin verification will reject the confirmation if it is sent from another email address.</p>
        {longClientLink ? <p className="dashboard-resolution-email__hint">If your email app opens without the full prepared text, use Copy confirmation text and paste the complete reply.</p> : null}
        <p className="dashboard-resolution-email__hint">Need another account? Switch accounts in Gmail, then return here and open the prepared email again.</p>
      </>}
      {!missingRequiredSender && gmailConfirming ? <div className="dashboard-resolution-email__confirm" role="alert">
        <strong>Open Gmail</strong>
        <p>This confirmation must be sent from:</p>
        <p><strong className="dashboard-resolution-email__sender-value">{requiredSenderEmail}</strong></p>
        <p>Gmail may open using another signed-in Google account. Check the sending account before sending.</p>
        <div><button type="button" onClick={() => setGmailConfirming(false)}>Go back</button><a href={links.gmail} target="_blank" rel="noreferrer" onClick={() => { setGmailConfirming(false); setGmailOpened(true); }}>Open Gmail</a></div>
      </div> : null}
      {!missingRequiredSender && gmailOpened ? <p className="dashboard-resolution-email__hint">Before sending, confirm that Gmail shows {requiredSenderEmail} as the sending account.</p> : null}
      {!missingRequiredSender && confirming ? <div className="dashboard-resolution-email__confirm" role="alert">
        <strong>Confirm email sent</strong>
        <p>Selected vote: {choiceLabel(resolution.currentVote)}</p>
        <p>Required sender:<br /><strong className="dashboard-resolution-email__sender-value">{requiredSenderEmail}</strong></p>
        <p>Confirm only if the message was sent from this registered email address. Your vote will be locked while Admin verification is pending.</p>
        <div><button type="button" onClick={() => setConfirming(false)}>Go back</button><button type="button" disabled={busy} onClick={confirmEmailSent}>Confirm email sent</button></div>
      </div> : null}
    </div> : <p className="dashboard-resolution-email__hint">Submit your vote to generate the prepared email reply.</p>}
  </section>;
}

export default function MemberResolutions({ resolutions, busyId, onVote, onClaimEmailSent, onRefresh }) {
  if (!resolutions.length) return null;
  return <section className="member-dashboard-section dashboard-resolutions" aria-labelledby="dashboard-resolutions-title">
    <div className="dashboard-section-heading"><div><p className="auth-access-kicker">Live BOD voting</p><h2 id="dashboard-resolutions-title">Resolutions awaiting your vote</h2></div><button type="button" onClick={onRefresh}>Refresh</button></div>
    <div className="dashboard-resolution-list">{resolutions.map((resolution) => {
      const busy = busyId === resolution.id;
      const hybridLocked = resolution.approvalMethod === "hybrid_email" && isHybridVoteChoiceLocked(resolution.emailConfirmationStatus);
      return <article className="dashboard-resolution-card" key={resolution.id} aria-busy={busy}>
        <header><span>{resolution.resolutionNumber}</span><strong>{resolution.approvalMethod === "hybrid_email" ? "Hybrid Email Confirmation" : "Voting open"}</strong></header>
        <h3>{resolution.title}</h3>
        <p className="dashboard-resolution-card__meeting">{resolution.meetingTitle} - {resolution.meetingDate}</p>
        <p className="dashboard-resolution-card__method">{approvalMethodLabel(resolution.approvalMethod)}{resolution.originalDocumentShortHash ? ` - Fingerprint ${resolution.originalDocumentShortHash}` : ""}</p>
        {resolution.body ? <div className="dashboard-resolution-card__body">{resolution.body}</div> : null}
        {resolution.proposedByName || resolution.secondedByName ? <dl>{resolution.proposedByName ? <div><dt>Proposed by</dt><dd>{formatRotaractorName(resolution.proposedByName, true)}{resolution.proposedByPosition ? ` - ${resolution.proposedByPosition}` : ""}</dd></div> : null}{resolution.secondedByName ? <div><dt>Seconded by</dt><dd>{formatRotaractorName(resolution.secondedByName, true)}{resolution.secondedByPosition ? ` - ${resolution.secondedByPosition}` : ""}</dd></div> : null}</dl> : null}
        <fieldset disabled={busy || hybridLocked}><legend>{hybridLocked ? "Selected vote locked" : "Cast or change your vote"}</legend><div className="dashboard-resolution-votes">{["approve", "reject", "abstain"].map((choice) => <button type="button" key={choice} className={resolution.currentVote === choice ? "is-selected" : ""} aria-pressed={resolution.currentVote === choice} onClick={() => onVote(resolution, choice)}>{choiceLabel(choice)}</button>)}</div></fieldset>
        <div className="dashboard-resolution-card__current" aria-live="polite"><strong>Your vote: {choiceLabel(resolution.currentVote)}</strong>{resolution.submittedAt ? <span>Submitted at: {formatDateTime(resolution.submittedAt)}</span> : null}<small>{hybridLocked ? "Your selected hybrid vote is locked. It is counted only after Admin verification." : resolution.approvalMethod === "hybrid_email" ? "You may change this choice until you mark the confirmation email as sent." : "You may change your vote while voting remains open."}</small></div>
        <HybridEmailPanel resolution={resolution} busy={busy} onClaimEmailSent={onClaimEmailSent} />
      </article>;
    })}</div>
  </section>;
}
