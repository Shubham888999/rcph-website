import { formatEventDate } from "./eventModel";

export default function EventCard({ event }) {
  return (
    <article className="event-card-react">
      <div>
        <p className="event-card-react__avenue">
          {event.avenues.length > 0 ? event.avenues.join(", ") : "Other"}
        </p>
        <h3>{event.name}</h3>
        <p className="event-card-react__description">
          {event.description || "Public RCPH event by Rotaract Club of Pune Heritage."}
        </p>
      </div>
      <time dateTime={event.date}>{formatEventDate(event)}</time>
    </article>
  );
}
