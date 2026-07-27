import { Navigate, Outlet, useLocation } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import AuthStateScreen from "./AuthStateScreen";

export default function AuthenticatedRoute() {
  const { authLoading, isAuthenticated } = useAuth();
  const location = useLocation();
  const returnPath = `${location.pathname}${location.search}${location.hash}`;

  if (authLoading) return <AuthStateScreen state="loading" />;
  if (!isAuthenticated) {
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(returnPath)}`}
        replace
        state={{ from: returnPath }}
      />
    );
  }
  return <Outlet />;
}
