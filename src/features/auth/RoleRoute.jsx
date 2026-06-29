import { Outlet } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import { hasCapability } from "./accessModel";
import AuthStateScreen from "./AuthStateScreen";

export default function RoleRoute({ capability }) {
  const { access, accountState } = useAuth();
  // Route rendering fails closed; protected server operations must still enforce authority themselves.
  if (accountState === "access-loading" || accountState === "auth-loading") {
    return <AuthStateScreen state="loading" />;
  }
  if (accountState !== "approved") return <AuthStateScreen state={accountState} />;
  if (!hasCapability(access, capability)) return <AuthStateScreen state="unauthorized" />;
  return <Outlet />;
}
