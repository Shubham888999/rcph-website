export default function LoginAccessPass({ children }) {
  return <section className="login-brand-panel login-access-pass" aria-labelledby="login-brand-title">
    <header className="login-access-pass__identity">{children}</header>
    <div className="login-access-pass__body">
      <div className="login-access-pass__edition"><p>Heritage / Account Access</p><div className="login-access-pass__stamp"><span>RIY</span><strong>2026-27</strong></div></div>
      <h1 id="login-brand-title"><span>Step into the</span><span>heart of</span><em>Heritage.</em></h1>
    </div>
  </section>;
}
