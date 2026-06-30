import CalendarLegend from "../calendar/CalendarLegend";
import CalendarView from "../calendar/CalendarView";
import useCalendarEvents from "../calendar/useCalendarEvents";
import "../../styles/components/calendar.css";

export default function HomeCalendarEmbed() {
  const { status, calendarEvents, reload } = useCalendarEvents();

  return (
    <div className="calendar-page home-calendar-embed">
      <div className="home-calendar-layout">
        <CalendarLegend headingLevel="h3" />
        <CalendarView
          events={calendarEvents}
          status={status}
          reload={reload}
          preserveCalendarOnError
        />
      </div>
    </div>
  );
}
