import { NavLink, Outlet } from "react-router-dom";

export default function PublicLayout() {
  return (
    <div className="site-shell">
      <header className="site-header">
        <NavLink className="brand" to="/" aria-label="RCPH home">
          <span className="brand-mark">R</span>
          <span>
            <strong>RCPH</strong>
            <small>React Migration</small>
          </span>
        </NavLink>

        <nav className="site-nav" aria-label="Primary navigation">
          <NavLink to="/">Home</NavLink>
          <NavLink to="/login">Login</NavLink>
        </nav>
      </header>

      <Outlet />

      <footer className="site-footer">
        <p>Rotaract Club of Pune Heritage</p>
        <span>React migration workspace</span>
      </footer>
    </div>
  );
}
