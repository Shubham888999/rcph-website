import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { ADMIN_NAV } from "./shared/adminNavigation";

export default function AdminShell({ access, displayName, onSignOut, children }) {
  const location = useLocation(); const navigate = useNavigate(); const segment = location.pathname.replace(/^\/admin\/?/, "");
  const canAccessLockTools = access.canAccessLockTools === true || access.canAccessPresidentControls === true;
  const navigation = access.canAccessAdminTools
    ? ADMIN_NAV.filter(([path]) => (path !== "resolutions" || access.canAccessResolutionTools) && (path !== "locks" || canAccessLockTools))
    : ADMIN_NAV.filter(([path]) => (
      (path === "resolutions" && access.canAccessResolutionTools)
      || (path === "locks" && canAccessLockTools)
      || (path === "visit-submissions" && access.canAccessVisitSubmissions)
    ));
  return <div className="admin-shell"><aside className="admin-sidebar"><div><p className="admin-kicker">Rotaract Club of Pune Heritage</p><h1>RCPH Admin</h1><p>{displayName}</p>
  <p>
  {access.hasWebsiteDirectorPosition && access.hasPresidentAuthority
    ? "Website Director"
    : access.hasSergeantAtArmsPosition
      ? "Sergeant-at-Arms"
      : `Approved ${access.storedRole}`}
</p>
  </div><nav aria-label="Admin modules">{navigation.map(([path, label]) => <NavLink key={path || "home"} end={!path} to={path ? `/admin/${path}` : "/admin"}>{label}</NavLink>)}</nav><div className="admin-sidebar__links"><NavLink to="/access">Access Hub</NavLink><NavLink to="/dashboard">Dashboard</NavLink>{access.canAccessBodTools ? <NavLink to="/bod-tools">BOD Tools</NavLink> : null}<NavLink to="/">Home</NavLink><button type="button" onClick={onSignOut}>Sign out</button></div></aside><div className="admin-main"><header className="admin-mobile-header"><strong>RCPH Admin</strong><select aria-label="Admin module" value={segment} onChange={(event) => navigate(event.target.value ? `/admin/${event.target.value}` : "/admin")}>{navigation.map(([path, label]) => <option key={path || "home"} value={path}>{label}</option>)}</select></header>{children}</div></div>;
}
