import { Navigate, Outlet, useLocation } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import AuthStateScreen from "./AuthStateScreen";

export default function AuthenticatedRoute() {
  const { authLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (authLoading) return <AuthStateScreen state="loading" />;
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
      />
    );
  }
  return <Outlet />;
}
