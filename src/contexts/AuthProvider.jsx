import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAccountState, normalizeTrustedAccess } from "../features/auth/accessModel";
import { getSafeAuthError } from "../features/auth/authErrors";
import {
  clearTrustedAccessCache,
  getTrustedAccess,
  observeAuthState,
  signOutUser,
} from "../features/auth/authService";
import { AuthContext } from "./auth-context";

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [access, setAccess] = useState(null);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessError, setAccessError] = useState("");
  const mountedRef = useRef(false);
  const currentUidRef = useRef("");
  const requestVersionRef = useRef(0);

  const resolveAccess = useCallback(async (uid, refresh = false) => {
    const requestVersion = ++requestVersionRef.current;
    setAccessLoading(true);
    setAccessError("");
    if (refresh) setAccess(null);

    try {
      const result = await getTrustedAccess({ uid, refresh });
      const normalized = normalizeTrustedAccess(result);
      if (
        !mountedRef.current
        || currentUidRef.current !== uid
        || requestVersionRef.current !== requestVersion
      ) return;
      setAccess(normalized);
    } catch (error) {
      if (
        !mountedRef.current
        || currentUidRef.current !== uid
        || requestVersionRef.current !== requestVersion
      ) return;
      if (import.meta.env.DEV) console.error("Trusted access resolution failed.", error);
      setAccess(null);
      setAccessError(getSafeAuthError(error));
    } finally {
      if (
        mountedRef.current
        && currentUidRef.current === uid
        && requestVersionRef.current === requestVersion
      ) {
        setAccessLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const unsubscribe = observeAuthState(
      (currentUser) => {
        const previousUid = currentUidRef.current;
        const nextUid = currentUser?.uid || "";
        if (previousUid && previousUid !== nextUid) clearTrustedAccessCache(previousUid);
        currentUidRef.current = nextUid;
        requestVersionRef.current += 1;
        setUser(currentUser);
        setAuthLoading(false);
        setAccess(null);
        setAccessError("");

        if (!currentUser) {
          setAccessLoading(false);
          clearTrustedAccessCache();
          return;
        }
        resolveAccess(currentUser.uid);
      },
      (error) => {
        if (import.meta.env.DEV) console.error("Firebase authentication state failed.", error);
        currentUidRef.current = "";
        requestVersionRef.current += 1;
        setUser(null);
        setAccess(null);
        setAccessLoading(false);
        setAccessError("");
        setAuthLoading(false);
      },
    );

    return () => {
      mountedRef.current = false;
      requestVersionRef.current += 1;
      unsubscribe();
    };
  }, [resolveAccess]);

  const refreshAccess = useCallback(async () => {
    const uid = currentUidRef.current;
    if (!uid) return;
    await resolveAccess(uid, true);
  }, [resolveAccess]);

  const signOut = useCallback(async () => {
    await signOutUser();
  }, []);

  const accountState = authLoading
    ? "auth-loading"
    : !user
      ? "signed-out"
      : accessLoading
        ? "access-loading"
        : accessError
          ? "access-error"
          : getAccountState(access);

  const value = useMemo(() => ({
    user,
    authLoading,
    access,
    accessLoading,
    accessError,
    accountState,
    isAuthenticated: Boolean(user),
    refreshAccess,
    signOut,
    loading: authLoading || accessLoading,
  }), [
    access,
    accessError,
    accessLoading,
    accountState,
    authLoading,
    refreshAccess,
    signOut,
    user,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
