import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import StoryCard from "../event-stories/StoryCard";
import { EVENT_STORIES_PATH, storiesNewestFirst } from "../event-stories/eventStories";
import "../../styles/components/event-stories.css";

const SHOWN_ON_EVENTS_PAGE = 3;

// The newest event pages, shown on the Events page with a link to the full gallery.
export default function EventStories() {
  const reduceMotion = useReducedMotion();
  const stories = storiesNewestFirst();
  if (!stories.length) return null;

  return (
    <motion.section
      className="events-section-react"
      aria-labelledby="event-stories-title"
      initial={reduceMotion ? false : { opacity: 1, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: reduceMotion ? 0 : 0.5 }}
    >
      <div className="events-section-react__heading">
        <p className="events-kicker">From the field</p>
        <h2 id="event-stories-title">Event Stories</h2>
      </div>
      <ul className="event-stories-grid">
        {stories.slice(0, SHOWN_ON_EVENTS_PAGE).map((story) => (
          <li key={story.slug}><StoryCard story={story} /></li>
        ))}
      </ul>
      {stories.length > SHOWN_ON_EVENTS_PAGE ? (
        <Link className="event-story-more__all event-stories-see-all" to={EVENT_STORIES_PATH}>See all event stories</Link>
      ) : null}
    </motion.section>
  );
}
