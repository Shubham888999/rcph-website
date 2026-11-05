import { useEffect, useState } from "react";
import { getMyInviteLink } from "./dashboardService";
import { buildInviteWhatsAppUrl, formatReferredCount, normalizeInviteLink } from "./inviteModel";

export default function InviteFriendCard({ uid }) {
  const [state, setState] = useState({ status: "loading", invite: null });
  const [copied, setCopied] = useState("");

  useEffect(() => {
    let active = true;
    getMyInviteLink(uid)
      .then((result) => {
        if (!active) return;
        const invite = normalizeInviteLink(result);
        setState({ status: invite ? "ready" : "error", invite });
      })
      .catch(() => {
        if (active) setState({ status: "error", invite: null });
      });
    return () => {
      active = false;
    };
  }, [uid]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(state.invite.url);
      setCopied("Link copied.");
    } catch {
      setCopied("Copy was blocked. Select the link and copy it manually.");
    }
  }

  return (
    <section className="dashboard-invite" aria-labelledby="dashboard-invite-title">
      <header className="dashboard-section-heading">
        <div><p className="dashboard-eyebrow">Grow the club</p><h2 id="dashboard-invite-title">Invite a friend</h2></div>
      </header>
      {state.status === "loading" ? <p role="status">Loading your invite link...</p> : null}
      {state.status === "error" ? <p role="status">Your invite link could not be loaded. Please try again later.</p> : null}
      {state.invite ? (
        <>
          <label className="dashboard-invite__field" htmlFor="dashboard-invite-link">Your invite link</label>
          <input id="dashboard-invite-link" className="dashboard-invite__link" type="text" readOnly value={state.invite.url} onFocus={(event) => event.target.select()} />
          <div className="dashboard-invite__actions">
            <button type="button" onClick={copyLink}>Copy</button>
            <a href={buildInviteWhatsAppUrl(state.invite.url)} target="_blank" rel="noreferrer">Share on WhatsApp</a>
          </div>
          {copied ? <p role="status">{copied}</p> : null}
          <p className="dashboard-invite__count">{formatReferredCount(state.invite.referredCount)}</p>
        </>
      ) : null}
    </section>
  );
}
