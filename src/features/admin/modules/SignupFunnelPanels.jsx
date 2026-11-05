import { useEffect, useState } from "react";
import { adminCalls } from "../shared/adminService";
import {
  SIGNUP_FUNNEL_WINDOWS,
  buildTaggedJoinLink,
  canViewSignupFunnel,
  normalizeSignupFunnel,
} from "./signupFunnelModel";

function FunnelTable({ caption, firstColumn, rows }) {
  return (
    <div className="admin-table-wrap">
      <table>
        <caption>{caption}</caption>
        <thead><tr><th>{firstColumn}</th><th>Signups</th><th>Now approved</th><th>Reached GBM/member</th></tr></thead>
        <tbody>
          {rows.map((row) => <tr key={row.key}><td>{row.label || row.key}</td><td>{row.signups}</td><td>{row.approved}</td><td>{row.member}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

function SignupFunnelPanel() {
  const [days, setDays] = useState(SIGNUP_FUNNEL_WINDOWS[0]);
  const [result, setResult] = useState({ days: 0, funnel: null, failed: false });
  const loading = result.days !== days;

  useEffect(() => {
    let active = true;
    adminCalls.signupFunnel(days)
      .then((raw) => {
        if (active) setResult({ days, funnel: normalizeSignupFunnel(raw), failed: false });
      })
      .catch(() => {
        if (active) setResult({ days, funnel: null, failed: true });
      });
    return () => {
      active = false;
    };
  }, [days]);

  return (
    <section className="admin-panel" aria-labelledby="signup-funnel-title">
      <h3 id="signup-funnel-title">Signup funnel</h3>
      <div className="admin-actions" role="group" aria-label="Signup funnel window">
        {SIGNUP_FUNNEL_WINDOWS.map((option) => (
          <button key={option} type="button" aria-pressed={option === days} onClick={() => setDays(option)}>{option} days</button>
        ))}
      </div>
      {loading ? <p role="status">Loading signup funnel...</p> : null}
      {!loading && result.failed ? <p role="status">The signup funnel could not be loaded.</p> : null}
      {!loading && result.funnel ? (
        result.funnel.signups ? (
          <>
            <p>{result.funnel.signups} signups, {result.funnel.approved} now approved, {result.funnel.member} reached GBM/member.</p>
            <FunnelTable caption="Signups by source" firstColumn="Source" rows={result.funnel.bySource} />
            <FunnelTable caption="Signups by path" firstColumn="Path" rows={result.funnel.byPath} />
          </>
        ) : <p>No signups in this window.</p>
      ) : null}
    </section>
  );
}

function TaggedLinkBuilder() {
  const [name, setName] = useState("");
  const [copied, setCopied] = useState("");
  const link = buildTaggedJoinLink(name);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied("Link copied.");
    } catch {
      setCopied("Copy was blocked. Select the link and copy it manually.");
    }
  }

  return (
    <section className="admin-panel" aria-labelledby="tagged-link-title">
      <h3 id="tagged-link-title">Tagged link builder</h3>
      <div className="admin-form">
        <label>Source name<input type="text" value={name} maxLength="80" placeholder="Instagram bio" onChange={(event) => { setName(event.target.value); setCopied(""); }} /></label>
        {link ? <label>Tagged link<input type="text" readOnly value={link} onFocus={(event) => event.target.select()} /></label> : null}
        {link ? <div className="admin-actions"><button type="button" onClick={copyLink}>Copy</button></div> : null}
        {copied ? <p role="status">{copied}</p> : null}
      </div>
    </section>
  );
}

export default function SignupFunnelPanels({ access }) {
  if (!canViewSignupFunnel(access)) return null;
  return <><SignupFunnelPanel /><TaggedLinkBuilder /></>;
}
