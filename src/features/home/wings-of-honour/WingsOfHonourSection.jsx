import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import CollaboratorRibbon from "./CollaboratorRibbon";
import StoryFormation from "./StoryFormation";
import StoryViewer from "./StoryViewer";
import useFormationRotation from "./useFormationRotation";
import {
  INSTAGRAM_HIGHLIGHT_URL,
  SECTION_ID,
  collaborators,
  eventDetails,
  formationItems,
  thankYous,
  timing,
} from "./wingsOfHonourData";
import "../../../styles/components/wings-of-honour.css";

const CONTRAIL_PATHS = [
  { d: "M -40 330 C 260 300, 560 210, 820 140 S 1140 40, 1260 18", stroke: "#ff9933" },
  { d: "M -40 337 C 260 307, 560 217, 820 147 S 1140 47, 1260 25", stroke: "#f1e8d8" },
  { d: "M -40 344 C 260 314, 560 224, 820 154 S 1140 54, 1260 32", stroke: "#2fa84f" },
];

// Cycles "thank you" through the campaign languages on its own, independent of the cards.
function ThankYouCycler({ running }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!running) return undefined;

    const intervalId = window.setInterval(() => {
      setIndex((current) => (current + 1) % thankYous.length);
    }, timing.thankYouMs);

    return () => window.clearInterval(intervalId);
  }, [running]);

  const thankYou = thankYous[index];

  return (
    <p className="woh__thanks">
      <span key={index} className="woh__thanks-word" lang={thankYou.lang} dir={thankYou.dir}>
        {thankYou.text}
      </span>
    </p>
  );
}

function Contrail({ state }) {
  return (
    <svg
      className={`woh__contrail${state ? ` is-${state}` : ""}`}
      viewBox="0 0 1200 360"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {CONTRAIL_PATHS.map((path) => (
        <path key={path.stroke} d={path.d} stroke={path.stroke} pathLength="1" />
      ))}
    </svg>
  );
}

export default function WingsOfHonourSection() {
  const reduceMotion = useReducedMotion();
  const sectionRef = useRef(null);
  const [inView, setInView] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const rotation = useFormationRotation({
    count: formationItems.length,
    active: inView,
    reduceMotion,
    timing,
  });
  const { goTo, setBlocker } = rotation;

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || typeof IntersectionObserver === "undefined") return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        if (entry.isIntersecting) setHasEntered(true);
      },
      { threshold: 0.2 },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setBlocker("viewer", viewerIndex !== null);
  }, [setBlocker, viewerIndex]);

  const contrailState = reduceMotion ? "static" : hasEntered ? "drawing" : "";

  function openViewer(index) {
    goTo(index);
    setViewerIndex(index);
  }

  function changeViewerIndex(index) {
    goTo(index);
    setViewerIndex(index);
  }

  function closeViewer() {
    setViewerIndex(null);
    setFocusRequest((request) => request + 1);
  }

  return (
    <section id={SECTION_ID} ref={sectionRef} className="woh" aria-labelledby="woh-title">
      <Contrail state={contrailState} />

      <div className="woh__inner">
        <div>
          <p className="woh__eyebrow">
            <span>{eventDetails.eyebrow[0]}</span>
            <span className="woh__eyebrow-separator" aria-hidden="true">
              |
            </span>
            <span>{eventDetails.eyebrow[1]}</span>
          </p>

          <h2 id="woh-title" className="woh__title">
            {eventDetails.title}
          </h2>

          <ThankYouCycler running={inView && !reduceMotion && viewerIndex === null} />

          <p className="woh__lede">{eventDetails.lede}</p>

          <ul className="woh__stats">
            {eventDetails.stats.map((stat) => (
              <li key={stat.label}>
                <strong>{stat.value}</strong> {stat.label}
              </li>
            ))}
          </ul>

          <dl className="woh__credits">
            {eventDetails.credits.map((credit) => (
              <div key={credit.role} className={credit.wide ? "woh__credit--wide" : undefined}>
                <dt>{credit.role}</dt>
                <dd>{credit.name}</dd>
              </div>
            ))}
          </dl>

          {INSTAGRAM_HIGHLIGHT_URL ? (
            <a className="woh__highlight-link" href={INSTAGRAM_HIGHLIGHT_URL} target="_blank" rel="noreferrer">
              {eventDetails.highlightLabel}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M7 17 17 7" />
                <path d="M8 7h9v9" />
              </svg>
            </a>
          ) : null}
        </div>

        <StoryFormation
          items={formationItems}
          rotation={rotation}
          focusRequest={focusRequest}
          onOpen={openViewer}
        />
      </div>

      <CollaboratorRibbon clubs={collaborators} />

      {viewerIndex !== null ? (
        <StoryViewer
          items={formationItems}
          index={viewerIndex}
          timing={timing}
          onIndexChange={changeViewerIndex}
          onClose={closeViewer}
        />
      ) : null}
    </section>
  );
}
