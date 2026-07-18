import { Link } from "react-router-dom";
import CalendarHero from "../../features/calendar/CalendarHero";
import CalendarLegend from "../../features/calendar/CalendarLegend";
import CalendarView from "../../features/calendar/CalendarView";
import useCalendarEvents from "../../features/calendar/useCalendarEvents";
import "../../styles/components/calendar.css";

export default function CalendarPage() {
  const { status, calendarEvents, reload } = useCalendarEvents();
  return (
    <main className="calendar-page">
      <CalendarHero />
      <section className="calendar-section" aria-labelledby="calendar-section-title">
        <div className="calendar-section__heading">
          <p className="calendar-kicker">Public schedule</p>
          <h2 id="calendar-section-title">Find an RCPH event</h2>
          <p>Use the controls to move between months or choose the list view. Changing views does not reload event data.</p>
        </div>
        <div className="calendar-layout">
          <CalendarLegend />
          <CalendarView events={calendarEvents} status={status} reload={reload} />
        </div>
      </section>
      <section className="calendar-cta" aria-labelledby="calendar-cta-title">
        <div>
          <p className="calendar-kicker">Lakshya · RIY 2026–27</p>
          <h2 id="calendar-cta-title">Take the next step</h2>
          <p>See what RCPH has been doing, become a member, or start a conversation with the club.</p>
        </div>
        <nav aria-label="Calendar next steps">
          <Link to="/events">Browse Events</Link>
          <Link to="/join">Join RCPH</Link>
          <Link to="/contact">Contact RCPH</Link>
        </nav>
      </section>
    </main>
  );
}
