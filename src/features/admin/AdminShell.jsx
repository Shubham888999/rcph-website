import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { canAccessDashboardPreview, canManageBodManagement } from "../auth/accessModel";
import {
  readAdminSidebarCollapsedPreference,
  writeAdminSidebarCollapsedPreference,
} from "./adminSidebarPreference";
import { ADMIN_NAV } from "./shared/adminNavigation";

const ADMIN_SIDEBAR_DESKTOP_QUERY = "(min-width: 901px)";
const ADMIN_SIDEBAR_NAV_ID = "admin-primary-navigation";

function readDesktopSidebarMatch() {
  try {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
    return window.matchMedia(ADMIN_SIDEBAR_DESKTOP_QUERY).matches;
  } catch {
    return true;
  }
}

export default function AdminShell({ access, displayName, onSignOut, children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const segment = location.pathname.replace(/^\/admin\/?/, "");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => readAdminSidebarCollapsedPreference());
  const [isDesktopSidebar, setIsDesktopSidebar] = useState(readDesktopSidebarMatch);
  const collapseButtonRef = useRef(null);
  const openButtonRef = useRef(null);
  const focusTargetRef = useRef("");
  const canAccessLockTools = access.canAccessLockTools === true || access.canAccessPresidentControls === true;
  const canAccessBodManagement = canManageBodManagement(access);
  const canPreviewDashboards = canAccessDashboardPreview(access);
  const navigation = access.canAccessAdminTools
    ? ADMIN_NAV.filter(([path]) => (
      (path !== "resolutions" || access.canAccessResolutionTools)
      && (path !== "locks" || canAccessLockTools)
      && (path !== "logs" || access.canAccessSystemLogs)
      && (path !== "dashboard-preview" || canPreviewDashboards)
      && (path !== "bod-management" || canAccessBodManagement)
    ))
    : ADMIN_NAV.filter(([path]) => (
      (path === "resolutions" && access.canAccessResolutionTools)
      || (path === "locks" && canAccessLockTools)
      || (path === "logs" && access.canAccessSystemLogs)
      || (path === "dashboard-preview" && canPreviewDashboards)
      || (path === "visit-submissions" && access.canAccessVisitSubmissions)
      || (path === "bod-management" && canAccessBodManagement)
    ));
  const roleLabel = access.hasWebsiteDirectorPosition && access.hasPresidentAuthority
    ? "Website Director"
    : access.hasSergeantAtArmsPosition
      ? "Sergeant-at-Arms"
      : `Approved ${access.storedRole}`;
  const effectiveSidebarCollapsed = isDesktopSidebar && sidebarCollapsed;

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    let mediaQuery;
    try {
      mediaQuery = window.matchMedia(ADMIN_SIDEBAR_DESKTOP_QUERY);
    } catch {
      return undefined;
    }

    function handleMediaChange(event) {
      setIsDesktopSidebar(event.matches);
    }

    setIsDesktopSidebar(mediaQuery.matches);
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleMediaChange);
      return () => mediaQuery.removeEventListener("change", handleMediaChange);
    }
    if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(handleMediaChange);
      return () => mediaQuery.removeListener(handleMediaChange);
    }
    return undefined;
  }, []);

  useEffect(() => {
    if (focusTargetRef.current === "open" && effectiveSidebarCollapsed) {
      openButtonRef.current?.focus();
      focusTargetRef.current = "";
    } else if (focusTargetRef.current === "collapse" && !effectiveSidebarCollapsed) {
      collapseButtonRef.current?.focus();
      focusTargetRef.current = "";
    }
  }, [effectiveSidebarCollapsed]);

  function collapseSidebar() {
    focusTargetRef.current = "open";
    setSidebarCollapsed(true);
    writeAdminSidebarCollapsedPreference(true);
  }

  function openSidebar() {
    focusTargetRef.current = "collapse";
    setSidebarCollapsed(false);
    writeAdminSidebarCollapsedPreference(false);
  }

  return (
    <div className={`admin-shell${effectiveSidebarCollapsed ? " is-sidebar-collapsed" : ""}`}>
      <aside
        className="admin-sidebar"
        aria-hidden={effectiveSidebarCollapsed ? "true" : undefined}
        inert={effectiveSidebarCollapsed ? true : undefined}
      >
        <div className="admin-sidebar__brand">
          <p className="admin-kicker">Rotaract Club of Pune Heritage</p>
          <h1>RCPH Admin</h1>
          <p>{displayName}</p>
          <p>{roleLabel}</p>
          <button
            ref={collapseButtonRef}
            type="button"
            className="admin-sidebar__collapse"
            aria-label="Collapse navigation"
            aria-expanded="true"
            aria-controls={ADMIN_SIDEBAR_NAV_ID}
            onClick={collapseSidebar}
          >
            <span aria-hidden="true">{"<"}</span>
          </button>
        </div>

        <nav id={ADMIN_SIDEBAR_NAV_ID} aria-label="Admin modules">
          {navigation.map(([path, label]) => (
            <NavLink key={path || "home"} end={!path} to={path ? `/admin/${path}` : "/admin"}>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar__links">
          <NavLink to="/access">Access Hub</NavLink>
          <NavLink to="/dashboard">Dashboard</NavLink>
          {access.canAccessBodTools ? <NavLink to="/bod-tools">BOD Tools</NavLink> : null}
          <NavLink to="/website-guide">Website Guide</NavLink>
          <NavLink to="/">Home</NavLink>
          <button type="button" onClick={onSignOut}>Sign out</button>
        </div>
      </aside>

      <div className="admin-main">
        {effectiveSidebarCollapsed ? (
          <button
            ref={openButtonRef}
            type="button"
            className="admin-sidebar-open-button"
            aria-label="Open navigation"
            aria-expanded="false"
            aria-controls={ADMIN_SIDEBAR_NAV_ID}
            onClick={openSidebar}
          >
            <span aria-hidden="true">|||</span>
            <span>Open navigation</span>
          </button>
        ) : null}

        <header className="admin-mobile-header">
          <strong>RCPH Admin</strong>
          <select
            aria-label="Admin module"
            value={segment}
            onChange={(event) => navigate(event.target.value ? `/admin/${event.target.value}` : "/admin")}
          >
            {navigation.map(([path, label]) => (
              <option key={path || "home"} value={path}>{label}</option>
            ))}
          </select>
        </header>
        {children}
      </div>
    </div>
  );
}
