import { useCallback, useEffect, useRef, useState } from "react";
import { getBodEventDiagnostic } from "./bodEventErrors";
import { fetchBodEvents, refreshBodEvents, subscribeBodEventLock } from "./bodEventService";

export default function useBodEvents({ uid, enabled }) {
  const [state, setState] = useState({ status: "loading", events: [], error: null });
  const [lock, setLock] = useState({ uid: "", status: "loading", locked: true, reason: "", updatedByName: "", updatedAt: "" });
  const versionRef = useRef(0);
  const mountedRef = useRef(false);

  const resolve = useCallback((request, requestUid) => {
    const version = ++versionRef.current;
    request.then((events) => {
      if (!mountedRef.current || version !== versionRef.current || requestUid !== uid) return;
      setState({ status: "success", events, error: null });
    }).catch((error) => {
      if (!mountedRef.current || version !== versionRef.current || requestUid !== uid) return;
      if (import.meta.env.DEV) console.error("BOD submissions load failed.", getBodEventDiagnostic(error, "read", requestUid));
      setState({ status: "error", events: [], error });
    });
  }, [uid]);

  useEffect(() => {
    mountedRef.current = true;
    if (enabled && uid) resolve(fetchBodEvents(uid), uid);
    return () => { mountedRef.current = false; versionRef.current += 1; };
  }, [enabled, resolve, uid]);

  useEffect(() => {
    if (!enabled || !uid) return undefined;
    const unsubscribe = subscribeBodEventLock((value) => {
      if (!mountedRef.current) return;
      setLock({ uid, status: "success", ...value });
    }, (error) => {
      if (import.meta.env.DEV) console.error("BOD lock subscription failed.", getBodEventDiagnostic(error, "lock-read", uid));
      if (mountedRef.current) setLock({ uid, status: "error", locked: true, reason: "", updatedByName: "", updatedAt: "" });
    });
    return unsubscribe;
  }, [enabled, uid]);

  const reload = useCallback(() => {
    if (!enabled || !uid) return;
    setState({ status: "loading", events: [], error: null });
    resolve(refreshBodEvents(uid), uid);
  }, [enabled, resolve, uid]);

  const currentLock = lock.uid === uid ? lock : { uid, status: "loading", locked: true, reason: "", updatedByName: "", updatedAt: "" };
  return { ...state, lock: currentLock, reload };
}
