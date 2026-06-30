import useAccessibleDialog from "./useAccessibleDialog";

const TYPE_LABELS = { clubEvent: "Club Event", bodMeeting: "BOD Meeting", districtEvent: "District Event", unknown: "Unknown type" };
const ROLE_LABELS = { host: "Host", cohost: "Co-host", collaborator: "Collaborator", participant: "Participant" };

export default function BodEventDetailsDialog({ event, onClose }) {
  const dialogRef = useAccessibleDialog({ open: Boolean(event), onClose });
  if (!event) return null;
  const images = [...new Set([event.previewLink, ...event.imageLinks].filter(Boolean))];
  const driveUrl = event.driveFolder || (/^[a-zA-Z0-9_-]+$/.test(event.driveFolderId) ? `https://drive.google.com/drive/folders/${event.driveFolderId}` : "");
  const created = event.createdAt ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.createdAt)) : "Unavailable";
  return (
    <div className="bod-dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="bod-dialog" role="dialog" aria-modal="true" aria-labelledby="bod-details-title" tabIndex="-1">
        <button className="bod-dialog__close" type="button" onClick={onClose} aria-label="Close event details">×</button>
        <p className="bod-tools-kicker">{TYPE_LABELS[event.recordKind]}</p>
        <h2 id="bod-details-title">{event.name}</h2>
        <dl className="bod-detail-list">
          <div><dt>Status</dt><dd>{event.isActive ? "Active" : "Archived"}; {event.isSynced ? "synchronized" : "not synchronized"}</dd></div>
          <div><dt>Date</dt><dd>{event.startDate}{event.endDate && event.endDate !== event.startDate ? ` – ${event.endDate}` : ""}{event.time ? ` at ${event.time}` : ""}</dd></div>
          <div><dt>Conducted by</dt><dd>{event.conductedBy}</dd></div>
          <div><dt>Avenues</dt><dd>{event.avenues.join(", ") || "Unavailable"}</dd></div>
          <div><dt>RCPH role</dt><dd>{ROLE_LABELS[event.rcphRole]}</dd></div>
          <div><dt>Host club</dt><dd>{event.hostClub}</dd></div>
          <div><dt>Collaborators</dt><dd>{event.collaborators.map((item) => item.name).join(", ") || "None listed"}</dd></div>
          <div><dt>Created by</dt><dd>{event.createdByName}</dd></div>
          <div><dt>Created</dt><dd>{created}</dd></div>
        </dl>
        <section><h3>Description</h3><p>{event.description || "No description supplied."}</p></section>
        {event.collaborationNotes ? <section><h3>Collaboration notes</h3><p>{event.collaborationNotes}</p></section> : null}
        {driveUrl ? <a href={driveUrl} target="_blank" rel="noopener noreferrer">Open Drive folder <span className="sr-only">(opens in a new tab)</span></a> : null}
        {images.length ? <ul className="bod-detail-images" aria-label="Event images">{images.map((url) => <li key={url}><a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={`${event.name} supporting material`} loading="lazy" decoding="async" /></a></li>)}</ul> : null}
      </section>
    </div>
  );
}
