import { Outlet } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import AuthStateScreen from "./AuthStateScreen";

export default function ApprovedRoute() {
  const { accountState } = useAuth();
  if (accountState === "access-loading" || accountState === "auth-loading") {
    return <AuthStateScreen state="loading" />;
  }
  if (accountState === "approved") return <Outlet />;
  return <AuthStateScreen state={accountState} />;
}
