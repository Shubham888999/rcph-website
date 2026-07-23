import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";

const RSVP_URL = "https://forms.gle/gQ8JcgWHDHWvGakP7";
const VENUE_URL = "https://maps.app.goo.gl/iNXahK8kMDFVURij8?g_st=ac";
const THEME_REVEAL_URL = "https://www.instagram.com/reel/DbJIe5ltc5l/?igsh=d2VrMHh0dWZ6eGtx";
const THEME_REVEAL_EMBED_URL = "https://www.instagram.com/reel/DbJIe5ltc5l/embed";

export default function InstallationSection() {
  const sectionRef = useRef(null);
  const revealTimerRef = useRef(null);
  const [themeRevealState, setThemeRevealState] = useState("idle");
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
  const spotlightShift = useTransform(scrollYProgress, [0, 0.45, 0.8, 1], ["-90px", "0px", "10px", "18px"]);
  const spotlightScale = useTransform(scrollYProgress, [0, 0.54, 1], [0.82, 1.05, 0.94]);
  const leftSpotlightX = useTransform(scrollYProgress, [0, 0.52, 1], ["-8vw", "0vw", "3vw"]);
  const rightSpotlightX = useTransform(scrollYProgress, [0, 0.52, 1], ["8vw", "0vw", "-3vw"]);
  const fixtureOpacity = useTransform(scrollYProgress, [0, 0.15, 0.32, 0.56, 0.85, 1], [0, 0, 0.92, 1, 0.62, 0.16]);
  const fixtureDrop = useTransform(scrollYProgress, [0, 0.1, 0.45, 0.8, 1], ["-90px", "-90px", "0px", "10px", "18px"]);
  const fixtureRotate = useTransform(scrollYProgress, [0, 0.45, 0.8, 1], ["-8deg", "0deg", "1.5deg", "3deg"]);
  const revealStyle = reduceMotion
    ? {
      "--installation-darkness-opacity": 0.48,
      "--installation-left-spotlight-opacity": 0.42,
      "--installation-right-spotlight-opacity": 0.38,
      "--installation-glow-opacity": 0.64,
      "--installation-visual-glow-opacity": 0.32,
      "--installation-spotlight-shift": "0rem",
      "--installation-spotlight-scale": 1,
      "--installation-left-spotlight-x": "0vw",
      "--installation-right-spotlight-x": "0vw",
      "--installation-fixture-opacity": 0.16,
      "--installation-fixture-drop": "0rem",
      "--installation-fixture-rotate": "0deg",
    }
    : {
      "--installation-darkness-opacity": darknessOpacity,
      "--installation-left-spotlight-opacity": leftSpotlightOpacity,
      "--installation-right-spotlight-opacity": rightSpotlightOpacity,
      "--installation-glow-opacity": glowOpacity,
      "--installation-visual-glow-opacity": visualGlowOpacity,
      "--installation-spotlight-shift": spotlightShift,
      "--installation-spotlight-scale": spotlightScale,
      "--installation-left-spotlight-x": leftSpotlightX,
      "--installation-right-spotlight-x": rightSpotlightX,
      "--installation-fixture-opacity": fixtureOpacity,
      "--installation-fixture-drop": fixtureDrop,
      "--installation-fixture-rotate": fixtureRotate,
    };

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

  return (
    <motion.section
      ref={sectionRef}
      className="home-section home-installation"
      aria-labelledby="home-installation-title"
      style={revealStyle}
    >
      <div className="home-installation__atmosphere" aria-hidden="true">
        <span className="home-installation__spotlight home-installation__spotlight--left" />
        <span className="home-installation__spotlight home-installation__spotlight--right" />
      </div>
      <div className="installation-spotlight-fixtures" aria-hidden="true">
        <img
          className="installation-spotlight-fixture installation-spotlight-fixture--left"
          src="/images/vox-spotlight.png"
          alt=""
          aria-hidden="true"
        />
        <img
          className="installation-spotlight-fixture installation-spotlight-fixture--right"
          src="/images/vox-spotlight.png"
          alt=""
          aria-hidden="true"
        />
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

          <dl className="home-installation__details" aria-label="VOX 2026 event details">
            <div>
              <dt>Date</dt>
              <dd>9th August 2026</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>7:00 PM onwards</dd>
            </div>
            <div>
              <dt>Venue</dt>
              <dd>Cyrus Poonawalla Auditorium, BMCC Campus, Shivajinagar, Pune</dd>
            </div>
          </dl>

          <p className="home-installation__closing">See you at VOX // '26.</p>

          <nav className="home-installation__actions" aria-label="VOX event actions">
            <a
              className="home-installation__action-link home-installation__action-link--rsvp"
              href={RSVP_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="RSVP for RCPH's 12th Installation Ceremony"
            >
              RSVP Now
            </a>
            <span className="home-installation__action-separator" aria-hidden="true">/</span>
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
                  allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
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
              className={`home-installation__reveal-card${isThemeRevealSpinning ? " home-installation__reveal-card--spinning" : ""}`}
              onClick={handleInlineThemeRevealClick}
              aria-label="Watch the VOX 2026 theme reveal inside this section"
              aria-busy={isThemeRevealSpinning ? "true" : undefined}
              disabled={isThemeRevealSpinning}
            >
              <span className="home-installation__record" aria-hidden="true">
                <span />
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
