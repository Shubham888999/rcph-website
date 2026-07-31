import { useCallback, useEffect, useRef, useState } from "react";
import { adminDiagnostic, safeAdminError } from "./adminErrors";
import { normalizeReminder } from "../reminders/reminderModel";
import { normalizeAdminUser, normalizeEvent, normalizeFine, normalizeMember, normalizeTreasury } from "./adminModel";
import { subscribeAdminCollection, subscribeAdminLock } from "./adminService";

export const ADMIN_COLLECTIONS = Object.freeze(["users", "members", "events", "attendance", "bodMembers", "bodMeetings", "bodAttendance", "districtEvents", "districtAttendance", "fines", "treasury", "reminders"]);
const OPTIONAL_COLLECTIONS = new Set(["reminders"]);
export const ADMIN_LOCK_KEYS = Object.freeze([
  "attendance",
  "bodAttendance",
  "bodEvents",
  "fines",
  "treasury",
]);
const ATTENDANCE_COLLECTIONS = new Set(["attendance", "bodAttendance", "districtAttendance"]);
const COLLECTION_SET = new Set(ADMIN_COLLECTIONS);
const LOCK_SET = new Set(ADMIN_LOCK_KEYS);

function normalizeRequestedKeys(keys, allowed, fallback) {
  const requested = Array.isArray(keys) ? keys : fallback;
  return [...new Set(requested)].filter((key) => allowed.has(key));
}

export function normalizeAdminCollectionKeys(keys = ADMIN_COLLECTIONS) {
  return normalizeRequestedKeys(keys, COLLECTION_SET, ADMIN_COLLECTIONS);
}

export function normalizeAdminLockKeys(keys = ADMIN_LOCK_KEYS) {
  return normalizeRequestedKeys(keys, LOCK_SET, ADMIN_LOCK_KEYS);
}

function initialData() {
  return Object.fromEntries(ADMIN_COLLECTIONS.map((key) => [key, ATTENDANCE_COLLECTIONS.has(key) ? {} : []]));
}

function initialLocks() {
  return Object.fromEntries(ADMIN_LOCK_KEYS.map((key) => [key, { status: "loading", locked: true }]));
}

function normalize(module, rows) {
  if (ATTENDANCE_COLLECTIONS.has(module)) return Object.fromEntries(rows.map((row) => [row.id, { ...row.data }]));
  const fn = module === "users" ? normalizeAdminUser : ["members", "bodMembers"].includes(module) ? normalizeMember : module === "events" ? (id, raw) => normalizeEvent(id, raw, "club") : module === "bodMeetings" ? (id, raw) => normalizeEvent(id, raw, "bodMeeting") : module === "districtEvents" ? (id, raw) => normalizeEvent(id, raw, "districtEvent") : module === "fines" ? normalizeFine : module === "reminders" ? normalizeReminder : normalizeTreasury;
  return rows.map((row) => fn(row.id, row.data)).filter(Boolean);
}

export default function useAdminData({ uid, enabled, collections, lockKeys }) {
  const requestedCollections = normalizeAdminCollectionKeys(collections);
  const requestedLocks = normalizeAdminLockKeys(lockKeys);
  const collectionKey = requestedCollections.join("|");
  const lockKey = requestedLocks.join("|");
  const [data, setData] = useState(initialData);
  const [loaded, setLoaded] = useState(new Set());
  const [errors, setErrors] = useState({});
  const [locks, setLocks] = useState(initialLocks);
  const generationRef = useRef(0);

  useEffect(() => {
    if (!enabled || !uid) return undefined;
    const generation = ++generationRef.current;
    const activeCollections = collectionKey ? collectionKey.split("|") : [];
    const activeLocks = lockKey ? lockKey.split("|") : [];
    const unsubscribers = activeCollections.map((module) => subscribeAdminCollection(uid, module, (rows) => {
      if (generationRef.current !== generation) return;
      setData((current) => ({ ...current, [module]: normalize(module, rows) }));
      setLoaded((current) => new Set(current).add(module));
      setErrors((current) => { const next = { ...current }; delete next[module]; return next; });
    }, (error) => {
      if (import.meta.env.DEV) console.error("Admin collection failed.", adminDiagnostic(error, "read", module, uid, "listener"));
      if (OPTIONAL_COLLECTIONS.has(module)) {
        setData((current) => ({ ...current, [module]: [] }));
        setLoaded((current) => new Set(current).add(module));
        setErrors((current) => { const next = { ...current }; delete next[module]; return next; });
        return;
      }
      setErrors((current) => ({ ...current, [module]: safeAdminError(error, `Could not load ${module}.`) }));
      setLoaded((current) => new Set(current).add(module));
    }));
    const lockUnsubs = activeLocks.map((key) => subscribeAdminLock(uid, key, (value) => {
      if (generationRef.current === generation) setLocks((current) => ({ ...current, [key]: { status: "success", locked: value.locked } }));
    }, (error) => {
      if (import.meta.env.DEV) console.error("Admin lock failed.", adminDiagnostic(error, "read-lock", key, uid, "listener"));
      if (generationRef.current === generation) setLocks((current) => ({ ...current, [key]: { status: "error", locked: true } }));
    }));
    return () => { generationRef.current += 1; [...unsubscribers, ...lockUnsubs].forEach((unsubscribe) => unsubscribe()); };
  }, [enabled, uid, collectionKey, lockKey]);

  const moduleState = useCallback((...modules) => {
    const error = modules.map((key) => errors[key]).find(Boolean) || "";
    const loading = modules.some((key) => !loaded.has(key));
    return { status: error ? "error" : loading ? "loading" : "success", error };
  }, [errors, loaded]);

  return { data, locks, moduleState };
}
