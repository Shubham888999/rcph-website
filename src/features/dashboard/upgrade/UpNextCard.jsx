import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAvenue } from "../../calendar/avenues";
import { formatEventDate } from "../../events/eventModel";
import { countdownParts, nextEvent } from "./dashboardUpgradeModel";

function calendarLink(event) {
  const day = event.date.replaceAll("-", "");
  const end = (event.endDate || event.date).replaceAll("-", "");
  const next = new Date(`${end.slice(0, 4)}-${end.slice(4, 6)}-${end.slice(6, 8)}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const endExclusive = next.toISOString().slice(0, 10).replaceAll("-", "");
  const params = new URLSearchParams({ action: "TEMPLATE", text: `${event.name} | RCPH`, dates: `${day}/${endExclusive}`, details: event.description || "Rotaract Club of Pune Heritage" });
  return `https://calendar.google.com/calendar/render?${params}`;
}

// The member's next event with a live countdown.
export default function UpNextCard({ events }) {
  const [now, setNow] = useState(() => new Date());
  const event = nextEvent(events, now);

  useEffect(() => {
    if (!event) return undefined;
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, [event]);

  if (!event) {
    return (
      <section className="dash-up-next" aria-labelledby="dash-up-next-title">
        <p className="dash-kicker">Up next</p>
        <h2 id="dash-up-next-title">No upcoming events yet</h2>
        <p className="dash-muted">New club events will show up here.</p>
        <Link className="dash-button dash-button--ghost" to="/calendar">Open the calendar</Link>
      </section>
    );
  }

  const parts = countdownParts(event, now);
  const units = [
    ["days", parts.days],
    ["hours", parts.hours],
    ["mins", parts.minutes],
    ["secs", parts.seconds],
  ];

  return (
    <section className="dash-up-next" aria-labelledby="dash-up-next-title">
      <p className="dash-kicker">Up next</p>
      <div className="dash-up-next__event">
        <h2 id="dash-up-next-title">{event.name}</h2>
        <p className="dash-muted">{formatEventDate(event)}</p>
      </div>
      <ol className="dash-countdown" aria-label={`Starts in ${parts.days} days ${parts.hours} hours`}>
        {units.map(([label, value]) => (
          <li key={label}><strong>{String(value).padStart(2, "0")}</strong><span>{label}</span></li>
        ))}
      </ol>
      {event.avenues.length ? (
        <ul className="dash-chips">
          {event.avenues.map((code) => (
            <li key={code} style={{ "--chip": getAvenue(code).color }}>{code}</li>
          ))}
        </ul>
      ) : null}
      <div className="dash-actions">
        <a className="dash-button" href={calendarLink(event)} target="_blank" rel="noopener noreferrer">Add to calendar</a>
        <Link className="dash-button dash-button--ghost" to="/calendar">All upcoming events</Link>
      </div>
    </section>
  );
}
