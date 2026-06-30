export default function BodEventMutationNotice({ notice, onDismiss }) {
  if (!notice?.message) return null;
  return (
    <div className={`bod-mutation-notice bod-mutation-notice--${notice.type || "info"}`} role={notice.type === "error" ? "alert" : "status"} aria-live="polite">
      <span>{notice.message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss notice">×</button>
    </div>
  );
}
