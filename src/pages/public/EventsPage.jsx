import EventAvenues from "../../features/events/EventAvenues";
import EventList from "../../features/events/EventList";
import EventStories from "../../features/events/EventStories";
import EventsCallToAction from "../../features/events/EventsCallToAction";
import EventsHero from "../../features/events/EventsHero";
import usePublicEvents from "../../features/events/usePublicEvents";
import "../../styles/components/events.css";

export default function EventsPage() {
  const { status, upcomingEvents, recentEvents, reload } = usePublicEvents();

  return (
    <main className="events-page-react">
      <EventsHero />
      <EventList
        id="upcoming-events-title"
        kicker="What’s ahead"
        title="Upcoming Events"
        description="Upcoming events from the public RCPH calendar."
        events={upcomingEvents}
        status={status}
        emptyMessage="No upcoming events are listed yet. Please check back soon or contact RCPH."
        reload={reload}
      />
      <EventList
        id="recent-events-title"
        kicker="Recently at RCPH"
        title="Recent Events"
        description="A quick look at activities recently added to the public RCPH calendar."
        events={recentEvents}
        status={status}
        emptyMessage="Recent public events will appear here after they are added to the RCPH calendar."
        reload={reload}
      />
      <EventStories />
      <EventAvenues />
      <EventsCallToAction />
    </main>
  );
}
