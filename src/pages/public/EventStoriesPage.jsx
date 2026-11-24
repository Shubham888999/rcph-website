import StoryCard from "../../features/event-stories/StoryCard";
import { storiesNewestFirst } from "../../features/event-stories/eventStories";
import "../../styles/components/event-stories.css";

export default function EventStoriesPage() {
  return (
    <main className="event-stories-page">
      <header className="event-stories-hero">
        <p className="event-stories-kicker">RCPH event stories</p>
        <h1>The stories behind our events</h1>
        <p>Our biggest events, each with a page of its own. Open one to see the photos, the people and what it meant.</p>
      </header>
      <ul className="event-stories-grid">
        {storiesNewestFirst().map((story) => <li key={story.slug}><StoryCard story={story} /></li>)}
      </ul>
    </main>
  );
}
