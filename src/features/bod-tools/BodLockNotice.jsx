export default function BodLockNotice({ lock, canBypass }) {
  if (lock.status === "loading") return <div className="bod-lock-notice" role="status">Checking event-manager lock status… Changes remain disabled.</div>;
  if (lock.status === "error") return <div className="bod-lock-notice bod-lock-notice--danger" role="alert">Lock status is unavailable. Changes are disabled while submissions remain readable.</div>;
  if (!lock.locked) return <div className="bod-lock-notice bod-lock-notice--open" role="status">Event submissions are open.</div>;
  return (
    <div className="bod-lock-notice bod-lock-notice--danger" role="status">
      <strong>Event submissions are locked.</strong>{" "}
      {canBypass ? "Server-verified lock bypass is available; the callable remains authoritative." : "Create, edit, archive, and sync controls are disabled."}
      {lock.reason ? <span> {lock.reason}</span> : null}
    </div>
  );
}
