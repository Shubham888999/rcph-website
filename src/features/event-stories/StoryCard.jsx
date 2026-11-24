import { Link } from "react-router-dom";
import { formatEventDate } from "../events/eventModel";
import { getAvenue } from "../calendar/avenues.js";
import { cardFontClass, storyPath } from "./eventStories";

// One event story as a card: a strip in the event's own colours, then date, avenues and summary.
export default function StoryCard({ story }) {
  return (
    <Link className="event-stories-card" to={storyPath(story)}>
      <span
        className={`event-stories-card__art ${cardFontClass(story)}`.trim()}
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
  );
}
