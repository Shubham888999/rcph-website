import { useState } from "react";
import AdminDialog from "../shared/AdminDialog";
import AdminModuleHeader from "../AdminModuleHeader";
import { LOCK_KEYS } from "../shared/adminModel";
import { setAdminLock } from "../shared/adminService";
import useAdminMutation from "../shared/useAdminMutation";

const LABELS = {
  attendance: "Club & District Attendance",
  bodAttendance: "BOD Attendance",
  bodEvents: "BOD Event Submissions",
  fines: "Fines",
  treasury: "Treasury",
};
export default function LocksModule({ locks, access, uid, onNotice }) {
  const [target, setTarget] = useState(null); const { busy, run } = useAdminMutation({ uid, module: "locks", onNotice });
  return <><AdminModuleHeader title="Operational Locks" /><div className="admin-card-grid">{LOCK_KEYS.map((key) => { const lock = locks[key]; return <article className="admin-record-card" key={key}><h3>{LABELS[key]}</h3><p>{lock.status === "error" ? "Unavailable — mutations fail closed" : lock.status === "loading" ? "Checking…" : lock.locked ? "Locked" : "Unlocked"}</p>{access.canAccessPresidentControls ? <button disabled={lock.status !== "success"} onClick={() => setTarget({ key, locked: !lock.locked })}>{lock.locked ? "Unlock" : "Lock"}</button> : <span>President access is required to manage administrative locks.</span>}</article>; })}</div>{target ? <AdminDialog title={`${target.locked ? "Lock" : "Unlock"} ${LABELS[target.key]}?`} busy={busy} onClose={() => setTarget(null)}><p>The server and Firestore rules remain authoritative. Locking disables production mutations for ordinary Admin users.</p><div className="admin-actions"><button onClick={() => setTarget(null)}>Cancel</button><button onClick={() => run("set-lock", () => setAdminLock(target.key, target.locked), `${LABELS[target.key]} ${target.locked ? "locked" : "unlocked"}.`).then((r) => { if (r !== null) setTarget(null); })}>Confirm</button></div></AdminDialog> : null}</>;
}
