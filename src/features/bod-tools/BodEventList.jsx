import BodEventCard from "./BodEventCard";
import { getBodEventPermissions } from "./bodEventModel";

export default function BodEventList({ events, access, lockState, onDetails, onEdit, onArchive, onSync, onReset }) {
  if (!events.length) return <section className="bod-empty-state"><h2>No submissions match these filters</h2><p>Try a broader status, type, month, or search.</p><button type="button" onClick={onReset}>Reset filters</button></section>;
  return <ul className="bod-event-list">{events.map((event) => <BodEventCard key={event.id} event={event} permissions={getBodEventPermissions(event, access, lockState)} onDetails={onDetails} onEdit={onEdit} onArchive={onArchive} onSync={onSync} />)}</ul>;
}
