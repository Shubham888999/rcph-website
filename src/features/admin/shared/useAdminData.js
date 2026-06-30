import { useCallback, useEffect, useRef, useState } from "react";
import { adminDiagnostic, safeAdminError } from "./adminErrors";
import { normalizeAdminUser, normalizeEvent, normalizeFine, normalizeMember, normalizeTreasury } from "./adminModel";
import { subscribeAdminCollection, subscribeAdminLock } from "./adminService";

const COLLECTIONS = ["users", "members", "events", "attendance", "bodMembers", "bodMeetings", "bodAttendance", "districtEvents", "districtAttendance", "fines", "treasury"];
const LOCKS = ["attendance", "bodAttendance", "fines", "treasury"];

function normalize(module, rows) {
  if (["attendance", "bodAttendance", "districtAttendance"].includes(module)) return Object.fromEntries(rows.map((row) => [row.id, { ...row.data }]));
  const fn = module === "users" ? normalizeAdminUser : ["members", "bodMembers"].includes(module) ? normalizeMember : module === "events" ? (id, raw) => normalizeEvent(id, raw, "club") : module === "bodMeetings" ? (id, raw) => normalizeEvent(id, raw, "bodMeeting") : module === "districtEvents" ? (id, raw) => normalizeEvent(id, raw, "districtEvent") : module === "fines" ? normalizeFine : normalizeTreasury;
  return rows.map((row) => fn(row.id, row.data)).filter(Boolean);
}

export default function useAdminData({ uid, enabled }) {
  const [data, setData] = useState(Object.fromEntries(COLLECTIONS.map((key) => [key, ["attendance", "bodAttendance", "districtAttendance"].includes(key) ? {} : []])));
  const [loaded, setLoaded] = useState(new Set());
  const [errors, setErrors] = useState({});
  const [locks, setLocks] = useState(Object.fromEntries(LOCKS.map((key) => [key, { status: "loading", locked: true }])));
  const generationRef = useRef(0);

  useEffect(() => {
    if (!enabled || !uid) return undefined;
    const generation = ++generationRef.current;
    const unsubscribers = COLLECTIONS.map((module) => subscribeAdminCollection(uid, module, (rows) => {
      if (generationRef.current !== generation) return;
      setData((current) => ({ ...current, [module]: normalize(module, rows) }));
      setLoaded((current) => new Set(current).add(module));
      setErrors((current) => { const next = { ...current }; delete next[module]; return next; });
    }, (error) => {
      if (import.meta.env.DEV) console.error("Admin collection failed.", adminDiagnostic(error, "read", module, uid, "listener"));
      setErrors((current) => ({ ...current, [module]: safeAdminError(error, `Could not load ${module}.`) }));
      setLoaded((current) => new Set(current).add(module));
    }));
    const lockUnsubs = LOCKS.map((key) => subscribeAdminLock(uid, key, (value) => {
      if (generationRef.current === generation) setLocks((current) => ({ ...current, [key]: { status: "success", locked: value.locked } }));
    }, (error) => {
      if (import.meta.env.DEV) console.error("Admin lock failed.", adminDiagnostic(error, "read-lock", key, uid, "listener"));
      if (generationRef.current === generation) setLocks((current) => ({ ...current, [key]: { status: "error", locked: true } }));
    }));
    return () => { generationRef.current += 1; [...unsubscribers, ...lockUnsubs].forEach((unsubscribe) => unsubscribe()); };
  }, [enabled, uid]);

  const moduleState = useCallback((...modules) => {
    const error = modules.map((key) => errors[key]).find(Boolean) || "";
    const loading = modules.some((key) => !loaded.has(key));
    return { status: error ? "error" : loading ? "loading" : "success", error };
  }, [errors, loaded]);

  return { data, locks, moduleState };
}
