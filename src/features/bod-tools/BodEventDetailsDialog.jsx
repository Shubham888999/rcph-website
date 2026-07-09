import useAccessibleDialog from "./useAccessibleDialog";
import { getBodEventAttachments, getEventDescriptionForAvenue } from "./bodEventModel";

const TYPE_LABELS = { clubEvent: "Club Event", bodMeeting: "BOD Meeting", districtEvent: "District Event", unknown: "Unknown type" };
const ROLE_LABELS = { host: "Host", cohost: "Co-host", collaborator: "Collaborator", participant: "Participant" };

export default function BodEventDetailsDialog({ event, onClose }) {
  const dialogRef = useAccessibleDialog({ open: Boolean(event), onClose });
  if (!event) return null;
  const attachments = getBodEventAttachments(event);
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
        <section><h3>Public / General Event Description</h3><p>{event.description || "No description supplied."}</p></section>
        {event.avenues.length ? (
          <section>
            <h3>Avenue report descriptions</h3>
            <dl className="bod-detail-list">
              {event.avenues.map((avenue) => <div key={avenue}><dt>{avenue}</dt><dd>{getEventDescriptionForAvenue(event, avenue)}</dd></div>)}
            </dl>
          </section>
        ) : null}
        {event.collaborationNotes ? <section><h3>Collaboration notes</h3><p>{event.collaborationNotes}</p></section> : null}
        {driveUrl ? <a href={driveUrl} target="_blank" rel="noopener noreferrer">Open Drive folder <span className="sr-only">(opens in a new tab)</span></a> : null}
        {attachments.length ? (
          <section className="bod-detail-files" aria-labelledby="bod-detail-files-title">
            <h3 id="bod-detail-files-title">Event files</h3>
            <ul>
              {attachments.map((attachment) => (
                <li key={attachment.url}>
                  {attachment.thumbnailUrl ? (
                    <img
                      src={attachment.thumbnailUrl}
                      alt={`${event.name} — ${attachment.label} preview`}
                      loading="lazy"
                      decoding="async"
                      onError={(imageEvent) => { imageEvent.currentTarget.hidden = true; }}
                    />
                  ) : <span className="bod-detail-files__type" aria-hidden="true">FILE</span>}
                  <div><strong>{attachment.label}</strong><span>{attachment.image ? "Image attachment" : "File attachment"}</span></div>
                  <a href={attachment.url} target="_blank" rel="noopener noreferrer">Open file <span className="sr-only">(opens in a new tab)</span></a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </section>
    </div>
  );
}
