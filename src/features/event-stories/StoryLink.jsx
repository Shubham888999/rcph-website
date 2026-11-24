import { Link } from "react-router-dom";
import { storyPath } from "./eventStories";

// The gold "Read the story" link shown on calendar pop-ups, event cards and project cards.
export default function StoryLink({ story, className = "", onClick }) {
  if (!story) return null;
  return (
    <Link
      className={`event-story-link ${className}`.trim()}
      to={storyPath(story)}
      onClick={onClick}
      aria-label={`Read the story of ${story.title}`}
    >
      Read the story <span aria-hidden="true">→</span>
    </Link>
  );
}
