import { Link } from "react-router-dom";
import { formatEventDate } from "../../features/events/eventModel";
import { getAvenue } from "../../features/calendar/avenues.js";
import { storiesNewestFirst, storyPath } from "../../features/event-stories/eventStories";
import "../../styles/components/event-stories.css";

export default function EventStoriesPage() {
  const stories = storiesNewestFirst();
  return (
    <main className="event-stories-page">
      <header className="event-stories-hero">
        <p className="event-stories-kicker">RCPH event stories</p>
        <h1>The stories behind our events</h1>
        <p>Our biggest events, each with a page of its own. Open one to see the photos, the people and what it meant.</p>
      </header>
      <ul className="event-stories-grid">
        {stories.map((story) => (
          <li key={story.slug}>
            <Link className="event-stories-card" to={storyPath(story)}>
              <span
                className={`event-stories-card__art${story.card.font === "serif" ? " is-serif" : ""}`}
                style={{ background: story.card.background, color: story.card.color }}
              >
                {story.title}
              </span>
              <span className="event-stories-card__meta">
                <time dateTime={story.date}>{formatEventDate({ date: story.date })}</time>
                <span>{story.avenues.map((code) => getAvenue(code).label.replace(/ Avenue$/, "")).join(", ")}</span>
              </span>
              <span className="event-stories-card__summary">{story.summary}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
