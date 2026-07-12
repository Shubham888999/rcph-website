import { useCallback, useEffect, useRef, useState } from "react";
import {
  mergeDashboardProfile,
} from "./dashboardModel";
import {
  getDashboardData,
  getDashboardErrorDiagnostic,
  reloadDashboardData,
} from "./dashboardService";

const INITIAL = { status: "loading", data: null, error: null };

export default function useDashboardData({ uid, enabled }) {
  const [state, setState] = useState(INITIAL);
  const mountedRef = useRef(false);
  const versionRef = useRef(0);

  const resolve = useCallback((request, requestUid) => {
    const version = ++versionRef.current;
    request.then((data) => {
      if (!mountedRef.current || version !== versionRef.current || requestUid !== uid) return;
      setState({ status: "success", data, error: null });
    }).catch((error) => {
      if (!mountedRef.current || version !== versionRef.current || requestUid !== uid) return;
      if (import.meta.env.DEV) console.error("Dashboard load failed.", getDashboardErrorDiagnostic(error));
      setState({ status: "error", data: null, error });
    });
  }, [uid]);

  useEffect(() => {
    mountedRef.current = true;
    if (enabled && uid) resolve(getDashboardData(uid), uid);
    return () => {
      mountedRef.current = false;
      versionRef.current += 1;
    };
  }, [enabled, resolve, uid]);

  const reload = useCallback(() => {
    if (enabled && uid) {
      setState(INITIAL);
      resolve(reloadDashboardData(uid), uid);
    }
  }, [enabled, resolve, uid]);

  const updateAnnouncements = useCallback((updater) => {
    setState((current) => {
      if (current.status !== "success" || !current.data) return current;
      const next = typeof updater === "function" ? updater(current.data.announcements) : updater;
      return Array.isArray(next)
        ? { ...current, data: { ...current.data, announcements: next } }
        : current;
    });
  }, []);

  const updateOpenResolutions = useCallback((updater) => {
    setState((current) => {
      if (current.status !== "success" || !current.data) return current;
      const next = typeof updater === "function" ? updater(current.data.openResolutions) : updater;
      return Array.isArray(next)
        ? { ...current, data: { ...current.data, openResolutions: next } }
        : current;
    });
  }, []);

  const updateProfile = useCallback((profile) => {
    setState((current) => {
      if (current.status !== "success" || !current.data) return current;
      return { ...current, data: mergeDashboardProfile(current.data, profile) };
    });
  }, []);

  return { ...state, reload, updateAnnouncements, updateOpenResolutions, updateProfile };
}
