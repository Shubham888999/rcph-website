import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";

const RSVP_URL = "https://forms.gle/gQ8JcgWHDHWvGakP7";
const VENUE_URL = "https://maps.app.goo.gl/iNXahK8kMDFVURij8?g_st=ac";
const VOX_INSTALLATION_POSTS = [
  {
    id: "save-the-date",
    title: "Save the Date",
    shortTitle: "Save Date",
    label: "09.08.26",
    instagramUrl: "https://www.instagram.com/reel/DbBZLu5pdP4/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==",
    embedUrl: "https://www.instagram.com/reel/DbBZLu5pdP4/embed",
    accent: "amber",
  },
  {
    id: "theme-reveal",
    title: "Theme Reveal",
    shortTitle: "Theme",
    label: "Retro Rock",
    instagramUrl: "https://www.instagram.com/reel/DbJIe5ltc5l/?igsh=d2VrMHh0dWZ6eGtx",
    embedUrl: "https://www.instagram.com/reel/DbJIe5ltc5l/embed",
    accent: "pink",
    isLatest: true,
  },
];
const VOX_RECORD_SHELF_SLOT_COUNT = 4;
const DEFAULT_VOX_POST_ID =
  VOX_INSTALLATION_POSTS.find((post) => post.isLatest)?.id ??
  VOX_INSTALLATION_POSTS[0].id;

const RECORD_LOAD_DURATION_MS = 2000;
const VOX_EVENT_START_ISO = "2026-08-09T19:00:00+05:30";
const COUNTDOWN_UPDATE_INTERVAL_MS = 1000;
const SECONDS_PER_DAY = 86400;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_MINUTE = 60;

export function getVoxCountdownParts(now = new Date()) {
  const eventStart = new Date(VOX_EVENT_START_ISO);
  const remainingMilliseconds = eventStart.getTime() - now.getTime();

  if (remainingMilliseconds <= 0) {
    return {
      days: 0,
      hours: 0,
      isLive: true,
      minutes: 0,
      seconds: 0,
    };
  }

  const totalSeconds = Math.ceil(remainingMilliseconds / 1000);
  const days = Math.floor(totalSeconds / SECONDS_PER_DAY);
  const remainingDaySeconds = totalSeconds % SECONDS_PER_DAY;
  const hours = Math.floor(remainingDaySeconds / SECONDS_PER_HOUR);
  const remainingHourSeconds = remainingDaySeconds % SECONDS_PER_HOUR;
  const minutes = Math.floor(remainingHourSeconds / SECONDS_PER_MINUTE);
  const seconds = remainingHourSeconds % SECONDS_PER_MINUTE;

  return {
    days,
    hours,
    isLive: false,
    minutes,
    seconds,
  };
}

function formatCountdownPart(value) {
  return String(value).padStart(2, "0");
}

const AUTO_REVEAL_STYLE = {
  "--installation-darkness-opacity": 0.62,
  "--installation-left-spotlight-opacity": 0.72,
  "--installation-right-spotlight-opacity": 0.68,
  "--installation-glow-opacity": 0.7,
  "--installation-visual-glow-opacity": 0.38,
  "--installation-spotlight-shift": "0px",
  "--installation-spotlight-scale": 1.02,
  "--installation-left-spotlight-x": "0vw",
  "--installation-right-spotlight-x": "0vw",
};

const INACTIVE_REVEAL_STYLE = {
  "--installation-darkness-opacity": 0,
  "--installation-left-spotlight-opacity": 0,
  "--installation-right-spotlight-opacity": 0,
  "--installation-glow-opacity": 0,
  "--installation-visual-glow-opacity": 0,
  "--installation-spotlight-shift": "-90px",
  "--installation-spotlight-scale": 0.92,
  "--installation-left-spotlight-x": "-8vw",
  "--installation-right-spotlight-x": "8vw",
};

export default function InstallationSection({ autoRevealActive = false }) {
  const sectionRef = useRef(null);
const revealTimerRef = useRef(null);
const [countdownParts, setCountdownParts] = useState(() => getVoxCountdownParts());
const [selectedPostId, setSelectedPostId] = useState(DEFAULT_VOX_POST_ID);
const [pendingPostId, setPendingPostId] = useState(null);
const [playerState, setPlayerState] = useState("idle");
const [hasScrollRevealStarted, setHasScrollRevealStarted] = useState(false);
const reduceMotion = useReducedMotion();

const selectedPost =
  VOX_INSTALLATION_POSTS.find((post) => post.id === selectedPostId) ??
  VOX_INSTALLATION_POSTS[0];

const pendingPost =
  VOX_INSTALLATION_POSTS.find((post) => post.id === pendingPostId) ?? null;

const isRecordLoading = playerState === "loading";
const isPostRevealed = playerState === "revealed";
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 78%", "end 16%"],
  });

  const darknessOpacity = useTransform(scrollYProgress, [0, 0.24, 0.7, 1], [0, 0.72, 0.64, 0.06]);
  const leftSpotlightOpacity = useTransform(scrollYProgress, [0, 0.2, 0.52, 0.78, 1], [0, 0.18, 0.86, 0.58, 0]);
  const rightSpotlightOpacity = useTransform(scrollYProgress, [0, 0.24, 0.56, 0.78, 1], [0, 0.14, 0.8, 0.56, 0]);
  const glowOpacity = useTransform(scrollYProgress, [0, 0.28, 0.56, 0.82, 1], [0, 0.14, 0.86, 0.54, 0]);
  const visualGlowOpacity = useTransform(scrollYProgress, [0, 0.32, 0.58, 0.82, 1], [0, 0.12, 0.5, 0.34, 0]);
  const spotlightShift = useTransform(scrollYProgress, [0, 0.35, 0.72, 1], ["0px", "0px", "-18px", "-48px"]);
  const spotlightScale = useTransform(scrollYProgress, [0, 0.54, 1], [0.82, 1.05, 0.94]);
  const leftSpotlightX = useTransform(scrollYProgress, [0, 0.52, 1], ["-8vw", "0vw", "3vw"]);
  const rightSpotlightX = useTransform(scrollYProgress, [0, 0.52, 1], ["8vw", "0vw", "-3vw"]);
  const scrollRevealStyle = {
    "--installation-darkness-opacity": darknessOpacity,
    "--installation-left-spotlight-opacity": leftSpotlightOpacity,
    "--installation-right-spotlight-opacity": rightSpotlightOpacity,
    "--installation-glow-opacity": glowOpacity,
    "--installation-visual-glow-opacity": visualGlowOpacity,
    "--installation-spotlight-shift": spotlightShift,
    "--installation-spotlight-scale": spotlightScale,
    "--installation-left-spotlight-x": leftSpotlightX,
    "--installation-right-spotlight-x": rightSpotlightX,
  };
  const useAutoRevealLighting = autoRevealActive && !hasScrollRevealStarted;
  const revealStyle = reduceMotion
    ? autoRevealActive ? AUTO_REVEAL_STYLE : INACTIVE_REVEAL_STYLE
    : useAutoRevealLighting ? AUTO_REVEAL_STYLE : scrollRevealStyle;

function loadVoxPost(postId) {
  if (isRecordLoading) return;

  const nextPost = VOX_INSTALLATION_POSTS.find((post) => post.id === postId);
  if (!nextPost) return;

  window.clearTimeout(revealTimerRef.current);
  setPendingPostId(postId);

  if (reduceMotion) {
    setSelectedPostId(postId);
    setPendingPostId(null);
    setPlayerState("revealed");
    return;
  }

  setPlayerState("loading");

  revealTimerRef.current = window.setTimeout(() => {
    setSelectedPostId(postId);
    setPendingPostId(null);
    setPlayerState("revealed");
  }, RECORD_LOAD_DURATION_MS);
}

function handleActiveRecordClick() {
  loadVoxPost(selectedPostId);
}

  useEffect(() => {
    return () => window.clearTimeout(revealTimerRef.current);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const updateCountdown = () => setCountdownParts(getVoxCountdownParts());
    updateCountdown();

    const countdownTimer = window.setInterval(updateCountdown, COUNTDOWN_UPDATE_INTERVAL_MS);
    return () => window.clearInterval(countdownTimer);
  }, []);

  useEffect(() => {
    if (!autoRevealActive || hasScrollRevealStarted) return undefined;

    return scrollYProgress.on("change", (latestProgress) => {
      if (latestProgress > 0.03) {
        setHasScrollRevealStarted(true);
      }
    });
  }, [autoRevealActive, hasScrollRevealStarted, scrollYProgress]);

  return (
    <motion.section
      ref={sectionRef}
      className={`home-section home-installation${useAutoRevealLighting ? " home-installation--auto-revealed" : ""}`}
      aria-labelledby="home-installation-title"
      style={revealStyle}
    >
      <div className="home-installation__atmosphere" aria-hidden="true">
        <span className="home-installation__spotlight home-installation__spotlight--left" />
        <span className="home-installation__spotlight home-installation__spotlight--right" />
      </div>

      <div className="home-installation__layout">
        <div className="home-installation__copy">
          <p className="home-kicker home-installation__kicker">THE SECRET'S OUT</p>
          <p className="home-installation__event-name">RCPH's 12th Installation Ceremony</p>
          <p className="home-installation__welcome">Welcome to</p>
          <h2 id="home-installation-title">VOX // '26</h2>

          <p className="home-installation__intro">
            Join us as we usher in RIY 2026-27, celebrating and welcoming the
            leaders and Board who will set the rhythm for the year.
          </p>

          <div className="home-installation__details" role="group" aria-label="VOX 2026 event details">
            <div className="home-installation__detail-card home-installation__detail-card--date">
              <span className="home-installation__detail-label">Date</span>
              <strong className="home-installation__detail-main">9th August 2026</strong>
              <span className="home-installation__detail-note">Keep the date locked</span>
            </div>

            <div className="home-installation__detail-card home-installation__detail-card--time">
              <span className="home-installation__detail-label">Time</span>
              <strong className="home-installation__detail-main">7:00 PM onwards</strong>
              <span className="home-installation__detail-note">Doors open. The show begins.</span>

            </div>

            <a
              className="home-installation__detail-card home-installation__detail-card--venue"
              href={VENUE_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="View Cyrus Poonawalla Auditorium on Google Maps"
            >
              <span className="home-installation__detail-label">Venue</span>
              <strong className="home-installation__detail-main">Cyrus Poonawalla Auditorium</strong>
              <span className="home-installation__detail-note">BMCC Campus, Shivajinagar, Pune</span>
              <span className="home-installation__detail-map-cue" aria-hidden="true">View map</span>
            </a>
          </div>

          <p className="home-installation__closing">See you at VOX // '26.</p>

          <nav className="home-installation__actions" aria-label="VOX event actions">
            <a
              className="home-installation__ticket"
              href={RSVP_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="RSVP for RCPH's 12th Installation Ceremony"
            >
              <span className="home-installation__ticket-kicker">VOX // '26 Admit One</span>
              <strong className="home-installation__ticket-main">RSVP Now</strong>
              <span className="home-installation__ticket-meta">09.08.26</span>
            </a>
            <a
              className="home-installation__action-link home-installation__action-link--venue"
              href={VENUE_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="View Cyrus Poonawalla Auditorium on Google Maps"
            >
              View Venue
            </a>
          </nav>


        </div>

<div className="home-installation__visual" id="vox-theme-reveal">
  <section
    className="home-installation__countdown home-installation__countdown--stereo"
    aria-label="Countdown to VOX 2026 on 9th August 2026 at 7:00 PM IST"
  >
    <div className="home-installation__stereo-shell">
      <div className="home-installation__stereo-top">
        <span className="home-installation__experience-kicker">
          COUNTDOWN TO VOX // '26
        </span>
      </div>

      <div className="home-installation__stereo-body">
        <div
          className="home-installation__stereo-speaker home-installation__stereo-speaker--left"
          aria-hidden="true"
        >
          <span />
          <span />
        </div>

        <div className="home-installation__stereo-center">
          {countdownParts.isLive ? (
            <strong className="home-installation__countdown-live">
              VOX // '26 is live
            </strong>
          ) : (
            <div className="home-installation__countdown-grid">
              <span className="home-installation__countdown-unit">
                <strong>{formatCountdownPart(countdownParts.days)}</strong>
                <span>Days</span>
              </span>

              <span className="home-installation__countdown-unit">
                <strong>{formatCountdownPart(countdownParts.hours)}</strong>
                <span>Hours</span>
              </span>

              <span className="home-installation__countdown-unit">
                <strong>{formatCountdownPart(countdownParts.minutes)}</strong>
                <span>Minutes</span>
              </span>

              <span className="home-installation__countdown-unit">
                <strong>{formatCountdownPart(countdownParts.seconds)}</strong>
                <span>Seconds</span>
              </span>
            </div>
          )}
        </div>

        <div
          className="home-installation__stereo-speaker home-installation__stereo-speaker--right"
          aria-hidden="true"
        >
          <span />
          <span />
        </div>
      </div>

      <div className="home-installation__stereo-footer" aria-hidden="true">
        <span className="home-installation__stereo-accent-bar" />
        <span className="home-installation__stereo-accent-bar" />
        <span className="home-installation__stereo-accent-bar" />
      </div>
    </div>
  </section>

  <div className="home-installation__record-station">
 <div className="home-installation__player-column">
  <div
    className={`home-installation__reveal-card home-installation__turntable${
      isRecordLoading
        ? " home-installation__reveal-card--spinning"
        : ""
    }${
      isPostRevealed
        ? " home-installation__turntable--revealed"
        : ""
    }`}
    aria-live="polite"
    aria-busy={isRecordLoading ? "true" : undefined}
  >
    <span
      className="home-installation__turntable-panel"
      aria-hidden="true"
    >
      <span className="home-installation__turntable-screw home-installation__turntable-screw--top-left" />
      <span className="home-installation__turntable-screw home-installation__turntable-screw--top-right" />
      <span className="home-installation__turntable-screw home-installation__turntable-screw--bottom-left" />
      <span className="home-installation__turntable-screw home-installation__turntable-screw--bottom-right" />

      <span className="home-installation__turntable-controls">
        <span className="home-installation__turntable-control home-installation__turntable-control--power" />
        <span className="home-installation__turntable-control" />
        <span className="home-installation__turntable-control" />
      </span>
    </span>

    <div
      className={`home-installation__turntable-media${
        isPostRevealed
          ? " home-installation__turntable-media--revealed"
          : ""
      }`}
    >
      {isPostRevealed ? (
        <div className="home-installation__turntable-embed">
          <div className="home-installation__inline-header">
            <span>VOX // '26 Installation Record</span>
            <strong>{selectedPost.title}</strong>
          </div>

          <div className="home-installation__inline-frame-shell">
            <iframe
              key={selectedPost.id}
              className="home-installation__inline-frame"
              src={selectedPost.embedUrl}
              title={`VOX 2026 ${selectedPost.title} Instagram post`}
              loading="lazy"
              allow="clipboard-write; encrypted-media; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="home-installation__turntable-play"
          onClick={handleActiveRecordClick}
          aria-label={`Play the VOX 2026 ${selectedPost.title} installation record`}
          aria-busy={isRecordLoading ? "true" : undefined}
          disabled={isRecordLoading}
        >
          <span className="home-installation__platter" aria-hidden="true">
            <span
              className={`home-installation__record home-installation__record--${selectedPost.accent}`}
            >
              <span />
            </span>
          </span>
        </button>
      )}
    </div>

    <span className="home-installation__tonearm" aria-hidden="true">
      <span className="home-installation__tonearm-head" />
    </span>

    <div className="home-installation__stage-pass">
      <span
        className="home-installation__reveal-status"
        role={isRecordLoading ? "status" : undefined}
      >
        {isRecordLoading
          ? "Loading the record..."
          : selectedPost.title}
      </span>

      <strong>
        {isRecordLoading
          ? `Cueing ${pendingPost?.title ?? selectedPost.title}`
          : isPostRevealed
            ? selectedPost.title
            : "Spin the record"}
      </strong>

      {isPostRevealed ? (
        <a
          className="home-installation__inline-fallback"
          href={selectedPost.instagramUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open the VOX 2026 ${selectedPost.title} post on Instagram`}
        >
          Open on Instagram
        </a>
      ) : null}
    </div>
  </div>

  {pendingPost ? (
    <span
      className={`home-installation__travelling-disc home-installation__travelling-disc--${pendingPost.accent}`}
      aria-hidden="true"
    >
      <span />
    </span>
  ) : null}
</div>

    <aside
      className="home-installation__record-library"
      aria-labelledby="vox-record-library-title"
    >
      <div className="home-installation__record-library-header">
        <span>VOX // '26</span>
        <strong id="vox-record-library-title">
          Installation Records
        </strong>
      </div>

<div className="home-installation__record-shelf">
  {Array.from({ length: VOX_RECORD_SHELF_SLOT_COUNT }, (_, slotIndex) => {
    const post = VOX_INSTALLATION_POSTS[slotIndex];

    if (!post) {
      return (
        <div
          key={`empty-record-slot-${slotIndex}`}
          className="home-installation__record-compartment home-installation__record-compartment--empty"
          aria-hidden="true"
        >
          <span className="home-installation__empty-record-slot" />
        </div>
      );
    }

    const isSelected = post.id === selectedPostId;
    const isPending = post.id === pendingPostId;

    return (
      <div
        key={post.id}
        className="home-installation__record-compartment"
      >
        <button
          type="button"
          className={`home-installation__record-choice home-installation__record-choice--${post.accent}${
            isSelected
              ? " home-installation__record-choice--selected"
              : ""
          }${
            isPending
              ? " home-installation__record-choice--loading"
              : ""
          }`}
          onClick={() => loadVoxPost(post.id)}
          aria-label={`Load the ${post.title} installation record`}
          aria-pressed={isSelected}
          disabled={isRecordLoading}
        >
          <span
            className="home-installation__record-sleeve"
            aria-hidden="true"
          >
            <span className="home-installation__record-mini">
              <span className="home-installation__record-mini-label">
                <strong>{post.shortTitle}</strong>
                <small>{post.label}</small>
              </span>
            </span>
          </span>

          <span className="home-installation__record-choice-caption">
            {post.title}
          </span>
        </button>
      </div>
    );
  })}
</div>
    </aside>
  </div>
</div>
        </div>
    </motion.section>
  );
}
