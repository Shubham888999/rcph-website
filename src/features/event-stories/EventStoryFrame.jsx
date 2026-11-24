import { useState } from "react";
import { Link } from "react-router-dom";
import { formatEventDate } from "../events/eventModel";
import { getAvenue } from "../calendar/avenues.js";
import { EVENT_STORIES_PATH, storiesNewestFirst, storyPath } from "./eventStories";
import { SITE_ORIGIN } from "../../app/metadataModel";

function ShareButtons({ story }) {
  const [copied, setCopied] = useState(false);
  const url = `${SITE_ORIGIN}${storyPath(story)}`;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${story.title}: ${url}`)}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="event-story-share">
      <a href={whatsapp} target="_blank" rel="noopener noreferrer">Share on WhatsApp</a>
      <button type="button" onClick={copyLink}>{copied ? "Link copied" : "Copy link"}</button>
    </div>
  );
}

function MoreStories({ current }) {
  const others = storiesNewestFirst().filter((story) => story.slug !== current.slug).slice(0, 3);
  if (!others.length) return null;
  return (
    <nav className="event-story-more" aria-labelledby="event-story-more-title">
      <h2 id="event-story-more-title">More event stories</h2>
      <ul>
        {others.map((story) => (
          <li key={story.slug}>
            <Link to={storyPath(story)} style={{ background: story.card.background, color: story.card.color }}>
              <span>{story.title}</span>
              <small>{formatEventDate({ date: story.date })}</small>
            </Link>
          </li>
        ))}
      </ul>
      <Link className="event-story-more__all" to={EVENT_STORIES_PATH}>See all event stories</Link>
    </nav>
  );
}

// The part every event page shares: back link, facts, share buttons and more stories.
// `children` is the event's own design.
export default function EventStoryFrame({ story, children }) {
  return (
    <main className="event-story-page">
      <header className="event-story-top">
        <Link className="event-story-back" to={EVENT_STORIES_PATH}>
          <span aria-hidden="true">←</span> All event stories
        </Link>
        <ul className="event-story-facts" aria-label="Event details">
          <li><time dateTime={story.date}>{formatEventDate({ date: story.date })}</time></li>
          {story.avenues.map((code) => <li key={code}>{getAvenue(code).label.replace(/ Avenue$/, "")}</li>)}
          {story.place ? <li>{story.place}</li> : null}
        </ul>
      </header>

      {/* home-page gives the event sections the same look they have on the home page */}
      <div className="event-story-body home-page">{children}</div>

      <footer className="event-story-footer">
        <ShareButtons story={story} />
        <MoreStories current={story} />
      </footer>
    </main>
  );
}
