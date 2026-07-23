import { openVoxThemeReveal } from "./VoxThemeRevealModal";

const RSVP_URL = "https://forms.gle/gQ8JcgWHDHWvGakP7";

export default function VoxAnnouncementBar() {
  function handleThemeRevealClick(event) {
    openVoxThemeReveal(event.currentTarget);
  }

  return (
    <aside className="vox-announcement" aria-label="VOX 2026 Installation announcement">
      <div className="vox-announcement__inner">
        <p className="vox-announcement__copy">
          <span className="vox-announcement__desktop">
            THE SECRET'S OUT <span aria-hidden="true">•</span>{" "}
            <strong>VOX // '26</strong> <span aria-hidden="true">•</span>{" "}
            RCPH'S 12TH INSTALLATION <span aria-hidden="true">•</span>{" "}
            <time dateTime="2026-08-09">09.08.26</time>
          </span>
          <span className="vox-announcement__mobile">
            <strong>VOX // '26</strong> <span aria-hidden="true">•</span>{" "}
            <time dateTime="2026-08-09">09.08.26</time>
          </span>
        </p>

        <nav className="vox-announcement__actions" aria-label="VOX announcement actions">
          <button
            type="button"
            className="vox-announcement__link vox-announcement__link--theme"
            onClick={handleThemeRevealClick}
            aria-label="Watch the VOX 2026 theme reveal on Instagram"
          >
            <span className="vox-announcement__action-full">Watch Theme Reveal</span>
            <span className="vox-announcement__action-short">Reveal</span>
          </button>
          <a
            className="vox-announcement__link vox-announcement__link--rsvp"
            href={RSVP_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="RSVP for RCPH's 12th Installation Ceremony"
          >
            <span className="vox-announcement__action-full">RSVP Now</span>
            <span className="vox-announcement__action-short">RSVP</span>
          </a>
        </nav>
      </div>
    </aside>
  );
}
