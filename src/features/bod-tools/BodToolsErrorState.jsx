import { Link } from "react-router-dom";

export default function BodToolsErrorState({ onRetry, onSignOut }) {
  return <section className="bod-tools-error" role="alert"><h2>Could not load submissions</h2><p>The protected event list is temporarily unavailable.</p><div><button type="button" onClick={onRetry}>Retry</button><Link to="/access">Access Hub</Link><button type="button" onClick={onSignOut}>Sign out</button></div></section>;
}
