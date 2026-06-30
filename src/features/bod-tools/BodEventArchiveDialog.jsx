import useAccessibleDialog from "./useAccessibleDialog";

export default function BodEventArchiveDialog({ event, mode = "archive", busy, error, onClose, onConfirm }) {
  const dialogRef = useAccessibleDialog({ open: Boolean(event), onClose });
  if (!event) return null;
  const archive = mode === "archive";
  return (
    <div className="bod-dialog-backdrop" onMouseDown={(e) => { if (!busy && e.target === e.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="bod-dialog bod-dialog--compact" role="dialog" aria-modal="true" aria-labelledby="bod-confirm-title" tabIndex="-1">
        <h2 id="bod-confirm-title">{archive ? "Archive" : "Synchronize"} {event.name}?</h2>
        {archive ? (
          <p>The event will leave active BOD and public lists. Attendance history is preserved, this is a soft archive, and Prospect progress may be recalculated.</p>
        ) : (
          <p>This synchronizes the existing BOD record to the public event and attendance system. Missing attendance fields may be initialized and Prospect progress may be recalculated.</p>
        )}
        {error ? <p className="bod-form-error" role="alert">{error}</p> : null}
        <div className="bod-dialog__actions">
          <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className={archive ? "bod-button--danger" : "bod-button--teal"} onClick={onConfirm} disabled={busy} aria-busy={busy}>
            {busy ? "Working…" : archive ? "Archive event" : "Synchronize event"}
          </button>
        </div>
      </section>
    </div>
  );
}
