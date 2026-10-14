import { useState } from "react";
import { PERMANENT_DELETE_CONFIRM_TEXT, isPermanentDeleteConfirmation } from "./archivedBodEventModel";
import useAccessibleDialog from "./useAccessibleDialog";

function dateLabel(event) {
  return event.endDate && event.endDate !== event.startDate ? `${event.startDate} - ${event.endDate}` : event.startDate;
}

export default function BodArchivedEventDialog({ event, mode = "restore", attendanceCount = null, busy, error, onClose, onConfirm }) {
  const dialogRef = useAccessibleDialog({ open: Boolean(event), onClose });
  const [confirmText, setConfirmText] = useState("");
  if (!event) return null;
  const remove = mode === "delete";
  const recordLabel = event.recordKind === "bodMeeting" ? "meeting" : "event";
  const confirmed = !remove || isPermanentDeleteConfirmation(confirmText);
  const attendanceLabel = Number.isInteger(attendanceCount) ? `its attendance marks (${attendanceCount} members)` : "its attendance marks";
  return (
    <div className="bod-dialog-backdrop" onMouseDown={(e) => { if (!busy && e.target === e.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="bod-dialog bod-dialog--compact" role="dialog" aria-modal="true" aria-labelledby="bod-archived-title" tabIndex="-1">
        <h2 id="bod-archived-title">{remove ? "Permanently delete" : "Restore"} {event.name}?</h2>
        <p className="bod-event-row__date">{dateLabel(event)}{event.time ? ` | ${event.time}` : ""}</p>
        {remove ? (
          <div className="bod-archived-delete-summary">
            <p><strong>Will delete:</strong> this {recordLabel}, {attendanceLabel}, and its pending reminders.</p>
            <p><strong>Will keep:</strong> Google Drive files, fines (they keep the event name), treasury entries, and every other event&apos;s attendance. A snapshot is saved to the audit log.</p>
            <label>
              Type {PERMANENT_DELETE_CONFIRM_TEXT} to confirm
              <input type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" spellCheck="false" disabled={busy} />
            </label>
          </div>
        ) : (
          <p>The {recordLabel} returns to the active BOD list with its previous status. Attendance history was kept while archived and is unchanged. Prospect progress may be recalculated.</p>
        )}
        {error ? <p className="bod-form-error" role="alert">{error}</p> : null}
        <div className="bod-dialog__actions">
          <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className={remove ? "bod-button--danger" : "bod-button--teal"} onClick={() => onConfirm(confirmText)} disabled={busy || !confirmed} aria-busy={busy}>
            {busy ? "Working…" : remove ? "Delete permanently" : `Restore ${recordLabel}`}
          </button>
        </div>
      </section>
    </div>
  );
}
