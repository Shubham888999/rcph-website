import { Outlet, useLocation } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import { hasVisitDashboardAccess } from "./accessModel";
import AuthStateScreen from "./AuthStateScreen";

export default function VisitDashboardRoute() {
  const { access, accountState } = useAuth();
  const { pathname } = useLocation();

  if (accountState === "access-loading" || accountState === "auth-loading") {
    return <AuthStateScreen state="loading" />;
  }
  if (accountState !== "approved") return <AuthStateScreen state={accountState} />;
  if (!hasVisitDashboardAccess(access, pathname)) return <AuthStateScreen state="unauthorized" />;
  return <Outlet />;
}
