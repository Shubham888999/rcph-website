const TYPE_LABELS = { clubEvent: "Club Event", bodMeeting: "BOD Meeting", districtEvent: "District Event", unknown: "Unknown type" };

function dateLabel(event) {
  return event.endDate && event.endDate !== event.startDate ? `${event.startDate} - ${event.endDate}` : event.startDate;
}

export default function BodEventCard({ event, permissions, onDetails, onEdit, onArchive, onSync }) {
  return (
    <li className={`bod-event-row ${event.isActive ? "" : "bod-event-row--archived"}`}>
      <span className="bod-event-row__rail" aria-hidden="true" />
      <div className="bod-event-row__main">
        <div className="bod-event-row__topline">
          <div className="bod-event-row__title-group">
            <h3>{event.name}</h3>
            <p className="bod-event-row__date">{dateLabel(event)}{event.time ? ` | ${event.time}` : ""}</p>
          </div>
        </div>
        <p className="bod-event-row__description">{event.description || "No description supplied."}</p>
        <div className="bod-event-row__meta">
          {event.avenues.length ? <ul className="bod-chip-list" aria-label="Avenues">{event.avenues.map((avenue) => <li key={avenue}>{avenue}</li>)}</ul> : null}
          <span className="bod-event-row__host">
            Conducted by{" "}
            {event.conductedBy ||
              "Not recorded"}
          </span>
        </div>
      </div>
      <aside className="bod-event-row__side" aria-label="Event controls">
        <div className="bod-event-row__badges" aria-label="Event status">
          <span>{TYPE_LABELS[event.recordKind]}</span>
          <span>{event.isActive ? "Active" : "Archived"}</span>
          <span>{event.isSynced ? "Synced" : "Not synced"}</span>
        </div>
        <div className="bod-event-row__actions">
          <button type="button" onClick={() => onDetails(event)}>View details</button>
          {permissions.canEdit ? <button type="button" onClick={() => onEdit(event)}>Edit</button> : null}
          {permissions.canArchive ? <button type="button" className="bod-button--danger" onClick={() => onArchive(event)}>Archive</button> : null}
          {permissions.canSync ? <button type="button" className="bod-button--teal" onClick={() => onSync(event)}>Sync</button> : null}
        </div>
      </aside>
    </li>
  );
}
