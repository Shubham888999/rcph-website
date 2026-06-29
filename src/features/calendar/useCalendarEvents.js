import { useMemo } from "react";
import usePublicEvents from "../events/usePublicEvents";
import { adaptEventsForCalendar } from "./calendarAdapter.js";

export default function useCalendarEvents() {
  const publicEvents = usePublicEvents();
  const calendarEvents = useMemo(() => adaptEventsForCalendar(publicEvents.events), [publicEvents.events]);
  return { ...publicEvents, calendarEvents };
}
