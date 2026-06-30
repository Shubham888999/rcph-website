import dayGridPlugin from "@fullcalendar/daygrid";
import listPlugin from "@fullcalendar/list";
import FullCalendar from "@fullcalendar/react";
import { useCallback, useMemo, useRef, useState } from "react";
import CalendarEventDialog from "./CalendarEventDialog";

function CalendarSkeleton() {
  return (
    <div className="calendar-skeleton" role="status" aria-live="polite">
      <span>Loading the public event calendar…</span>
      <div aria-hidden="true" />
    </div>
  );
}

export default function CalendarView({ events, status, reload, preserveCalendarOnError = false }) {
  const [selection, setSelection] = useState(null);
  const keyboardHandlers = useRef(new Map());
  const initialView = useMemo(
    () => (typeof window !== "undefined" && window.matchMedia("(max-width: 699px)").matches
      ? "listMonth"
      : "dayGridMonth"),
    [],
  );

  const openEvent = useCallback((eventApi, trigger) => {
    setSelection({ event: eventApi.extendedProps.original, trigger });
  }, []);
  const closeDialog = useCallback(() => setSelection(null), []);

  const eventDidMount = useCallback((mountInfo) => {
    const element = mountInfo.el;
    const avenueNames = mountInfo.event.extendedProps.avenues
      .map((avenue) => avenue.label)
      .join(", ") || "No avenue listed";
    element.style.backgroundImage = mountInfo.event.extendedProps.avenueGradient;
    element.setAttribute("tabindex", "0");
    element.setAttribute("role", "button");
    element.setAttribute(
      "aria-label",
      `${mountInfo.event.title}. ${avenueNames}. Open event details.`,
    );

    const keyHandler = (keyEvent) => {
      if (keyEvent.key === "Enter" || keyEvent.key === " ") {
        keyEvent.preventDefault();
        openEvent(mountInfo.event, element);
      }
    };
    keyboardHandlers.current.set(element, keyHandler);
    element.addEventListener("keydown", keyHandler);
  }, [openEvent]);

  const eventWillUnmount = useCallback((mountInfo) => {
    const handler = keyboardHandlers.current.get(mountInfo.el);
    if (handler) mountInfo.el.removeEventListener("keydown", handler);
    keyboardHandlers.current.delete(mountInfo.el);
  }, []);

  return (
    <div className="calendar-view">
      {status === "loading" ? <CalendarSkeleton /> : null}
      {status === "error" ? (
        <div className="calendar-state calendar-state--error" role="alert">
          <h3>Events could not be loaded</h3>
          <p>Please try again. The rest of the calendar page remains available.</p>
          <button type="button" className="button button-primary" onClick={reload}>Retry</button>
        </div>
      ) : null}
      {status === "success" || (status === "error" && preserveCalendarOnError) ? (
        <>
          <FullCalendar
            plugins={[dayGridPlugin, listPlugin]}
            initialView={initialView}
            headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,listMonth" }}
            height="auto"
            firstDay={0}
            events={events}
            eventDisplay="block"
            dayMaxEvents
            eventClick={(clickInfo) => openEvent(clickInfo.event, clickInfo.el)}
            eventDidMount={eventDidMount}
            eventWillUnmount={eventWillUnmount}
          />
          {status === "success" && events.length === 0 ? (
            <p className="calendar-state calendar-state--empty">No public events are currently available.</p>
          ) : null}
        </>
      ) : null}
      <CalendarEventDialog selection={selection} onClose={closeDialog} />
    </div>
  );
}
