const TYPE_LABELS = { clubEvent: "Club Event", bodMeeting: "BOD Meeting", districtEvent: "District Event", unknown: "Unknown type" };

function dateLabel(event) {
  return event.endDate && event.endDate !== event.startDate ? `${event.startDate} – ${event.endDate}` : event.startDate;
}

export default function BodEventCard({ event, permissions, onDetails, onEdit, onArchive, onSync }) {
  return (
    <li className={`bod-event-card ${event.isActive ? "" : "bod-event-card--archived"}`}>
      <div className="bod-event-card__chips">
        <span>{TYPE_LABELS[event.recordKind]}</span>
        <span>{event.isActive ? "Active" : "Archived"}</span>
        <span>{event.isSynced ? "Synced" : "Not synced"}</span>
      </div>
      <h3>{event.name}</h3>
      <p className="bod-event-card__date">{dateLabel(event)}{event.time ? ` · ${event.time}` : ""}</p>
      <p>{event.description || "No description supplied."}</p>
      {event.avenues.length ? <ul className="bod-chip-list" aria-label="Avenues">{event.avenues.map((avenue) => <li key={avenue}>{avenue}</li>)}</ul> : null}
      <p className="bod-event-card__meta">
  Conducted by{" "}
  {event.conductedBy ||
    "Not recorded"}
</p>
      <div className="bod-event-card__actions">
        <button type="button" onClick={() => onDetails(event)}>View details</button>
        {permissions.canEdit ? <button type="button" onClick={() => onEdit(event)}>Edit</button> : null}
        {permissions.canArchive ? <button type="button" className="bod-button--danger" onClick={() => onArchive(event)}>Archive</button> : null}
        {permissions.canSync ? <button type="button" className="bod-button--teal" onClick={() => onSync(event)}>Sync</button> : null}
      </div>
    </li>
  );
}
