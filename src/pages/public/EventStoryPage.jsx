import { Suspense } from "react";
import { useParams } from "react-router-dom";
import RouteLoader from "../../components/feedback/RouteLoader";
import EventStoryFrame from "../../features/event-stories/EventStoryFrame";
import { getEventStory } from "../../features/event-stories/eventStories";
import { eventStoryComponents } from "../../features/event-stories/eventStoryLoaders";
import NotFoundPage from "./NotFoundPage";
import "../../styles/components/event-stories.css";

export default function EventStoryPage() {
  const { slug } = useParams();
  const story = getEventStory(slug);
  const Story = story ? eventStoryComponents[story.slug] : null;
  if (!story || !Story) return <NotFoundPage />;

  return (
    <EventStoryFrame story={story}>
      <Suspense fallback={<RouteLoader />}>
        <Story />
      </Suspense>
    </EventStoryFrame>
  );
}
