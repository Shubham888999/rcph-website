import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";

const RSVP_URL = "https://forms.gle/gQ8JcgWHDHWvGakP7";
const VENUE_URL = "https://maps.app.goo.gl/iNXahK8kMDFVURij8?g_st=ac";
const THEME_REVEAL_URL = "https://www.instagram.com/reel/DbJIe5ltc5l/?igsh=d2VrMHh0dWZ6eGtx";
const THEME_REVEAL_EMBED_URL = "https://www.instagram.com/reel/DbJIe5ltc5l/embed";
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
  const [themeRevealState, setThemeRevealState] = useState("idle");
  const [hasScrollRevealStarted, setHasScrollRevealStarted] = useState(false);
  const reduceMotion = useReducedMotion();
  const isThemeRevealSpinning = themeRevealState === "spinning";
  const isThemeRevealRevealed = themeRevealState === "revealed";
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

  function handleInlineThemeRevealClick() {
    if (isThemeRevealSpinning || isThemeRevealRevealed) return;

    if (reduceMotion) {
      setThemeRevealState("revealed");
      return;
    }

    window.clearTimeout(revealTimerRef.current);
    setThemeRevealState("spinning");
    revealTimerRef.current = window.setTimeout(() => {
      setThemeRevealState("revealed");
    }, 2000);
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

        <div className="home-installation__visual">
<section
  className="home-installation__countdown home-installation__countdown--stereo"
  aria-label="Countdown to VOX 2026 on 9th August 2026 at 7:00 PM IST"
>
  <div className="home-installation__stereo-shell">
    <div className="home-installation__stereo-top">
      <span className="home-installation__experience-kicker">COUNTDOWN TO VOX // '26</span>
    </div>

    <div className="home-installation__stereo-body">
      <div className="home-installation__stereo-speaker home-installation__stereo-speaker--left" aria-hidden="true">
        <span />
        <span />
      </div>

      <div className="home-installation__stereo-center">
        {countdownParts.isLive ? (
          <strong className="home-installation__countdown-live">VOX // '26 is live</strong>
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

      <div className="home-installation__stereo-speaker home-installation__stereo-speaker--right" aria-hidden="true">
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
          {isThemeRevealRevealed ? (
            <div className="home-installation__inline-reveal" aria-live="polite">
              <div className="home-installation__inline-header">
                <span>VOX // '26 Theme Reveal</span>
                <strong>Watch the reveal</strong>
              </div>
              <div className="home-installation__inline-frame-shell">
                <iframe
                  className="home-installation__inline-frame"
                  src={THEME_REVEAL_EMBED_URL}
                  title="VOX 2026 theme reveal Instagram Reel"
                  loading="lazy"
                  allow="clipboard-write; encrypted-media; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
              <a
                className="home-installation__inline-fallback"
                href={THEME_REVEAL_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="Open the VOX 2026 theme reveal on Instagram"
              >
                Open on Instagram
              </a>
            </div>
          ) : (
<button
  type="button"
  className={`home-installation__reveal-card home-installation__turntable${isThemeRevealSpinning ? " home-installation__reveal-card--spinning" : ""}`}
  onClick={handleInlineThemeRevealClick}
  aria-label="Watch the VOX 2026 theme reveal inside this section"
  aria-busy={isThemeRevealSpinning ? "true" : undefined}
  disabled={isThemeRevealSpinning}
>
  <span className="home-installation__turntable-panel" aria-hidden="true">
    <span className="home-installation__turntable-screw home-installation__turntable-screw--top-left" />
    <span className="home-installation__turntable-screw home-installation__turntable-screw--top-right" />
    <span className="home-installation__turntable-screw home-installation__turntable-screw--bottom-left" />
    <span className="home-installation__turntable-screw home-installation__turntable-screw--bottom-right" />
    <span className="home-installation__turntable-knob" />
  </span>

  <span className="home-installation__platter" aria-hidden="true">
    <span className="home-installation__record">
      <span />
    </span>
  </span>

  <span className="home-installation__tonearm" aria-hidden="true">
    <span className="home-installation__tonearm-head" />
  </span>



  <span className="home-installation__stage-pass">
    <span className="home-installation__reveal-status" role={isThemeRevealSpinning ? "status" : undefined}>
      {isThemeRevealSpinning ? "Spinning the record..." : "Spin the record"}
    </span>
    <strong>{isThemeRevealSpinning ? "Cueing the theme reveal" : "Watch the theme reveal"}</strong>
  </span>
</button>
          )}
        </div>
      </div>
    </motion.section>
  );
}
