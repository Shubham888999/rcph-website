import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import "../../../styles/components/event-concord.css";
import { officers } from "../clubOfficers";

const MEDIA = "/media/event-stories/concord-2026";
const RIPPLE_MS = 700;

// Peace from the individual level to the global level, in the words of the event reports.
const rings = [
  { name: "Me", text: "Understanding conflicts, considering different perspectives and communicating effectively." },
  { name: "Club", text: "Turning everyday conflicts into conversations and promoting understanding within our clubs." },
  { name: "Community", text: "Peaceful communities are built by listening, understanding differences and making sure no perspective is ignored." },
  { name: "World", text: "Why Rotary promotes peace through dialogue, inclusion, education and mutual understanding." },
];

const formats = [
  { name: "Discussions", text: "Exploring peace, from the individual level to the global level." },
  { name: "Situation Lab", text: "Working through real-life conflict situations and making responsible decisions." },
  { name: "Peace Roundtable", text: "Everyone at one table, sharing perspectives and finding peaceful solutions." },
];

const skills = ["Communication", "Critical thinking", "Decision-making", "Teamwork", "Conflict resolution"];

const collaborators = [
  "Rotaract Club of Pune Shaniwarwada",
  "Rotaract Club of Pune Baner",
  "Rotaract Club of Pune Nigdi",
  "Rotaract Club of Pune Camp Pioneer",
];

const conductedBy = officers("tanishka");

function OliveBranch() {
  return (
    <svg className="cd-olive" viewBox="0 0 160 60" aria-hidden="true" focusable="false">
      <path className="cd-olive__stem" d="M6 50C50 44 100 30 154 8" />
      {[[30, 46, -30], [52, 40, 30], [72, 35, -35], [92, 28, 25], [112, 22, -40], [132, 15, 20]].map(([x, y, r], index) => (
        <ellipse key={index} className="cd-olive__leaf" cx={x} cy={y - (index % 2 ? -8 : 8)} rx="11" ry="4.5" transform={`rotate(${r} ${x} ${y})`} />
      ))}
      <circle className="cd-olive__fruit" cx="84" cy="44" r="4" />
      <circle className="cd-olive__fruit" cx="122" cy="34" r="4" />
    </svg>
  );
}

function Ripple({ reduceMotion }) {
  const [level, setLevel] = useState(-1);
  const timers = useRef([]);
  const done = level === rings.length - 1;

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  function sendOutward() {
    timers.current.forEach(window.clearTimeout);
    if (reduceMotion) {
      setLevel(rings.length - 1);
      return;
    }
    setLevel(0);
    timers.current = rings.slice(1).map((_, index) => window.setTimeout(() => setLevel(index + 1), RIPPLE_MS * (index + 1)));
  }

  return (
    <div className="cd-ripple">
      <div className="cd-rings" aria-hidden="true">
        {[...rings].reverse().map((ring, reversedIndex) => {
          const index = rings.length - 1 - reversedIndex;
          return (
            <span key={ring.name} className={`cd-rings__ring cd-rings__ring--${index}${index <= level ? " is-lit" : ""}`}>
              <span className="cd-rings__label">{ring.name}</span>
            </span>
          );
        })}
      </div>

      <div className="cd-ripple__side">
        <ol className="cd-ripple__list">
          {rings.map((ring, index) => (
            <li key={ring.name} className={index <= level ? "is-lit" : ""}>
              <strong>{ring.name}</strong>
              <span>{index <= level ? ring.text : "…"}</span>
            </li>
          ))}
        </ol>
        <button type="button" className="cd-button" onClick={sendOutward} aria-live="polite">
          {done ? "Send it outward again" : "Send peace outward"}
        </button>
      </div>
    </div>
  );
}

export default function ConcordStory() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="cd">
      <section className="cd-hero" aria-labelledby="cd-title">
        <OliveBranch />
        <p className="cd-kicker">Community Service · Professional Development · Diversity, Equity &amp; Inclusion</p>
        <h1 id="cd-title">CONCORD <span>The Peace Roundtable</span></h1>
        <p className="cd-lede">
          An interactive initiative on peacebuilding and conflict prevention. Participants explored peace from an
          individual level to a global level, learning to understand conflicts, consider different perspectives,
          communicate effectively and find peaceful solutions.
        </p>
        <p className="cd-focus">Focus areas: Peacebuilding and conflict prevention · Hospitality</p>
      </section>

      <section className="cd-photo" aria-label="Group photo">
        <figure>
          <img
            src={`${MEDIA}/group-photo.webp`}
            srcSet={`${MEDIA}/group-photo-800.webp 800w, ${MEDIA}/group-photo.webp 1040w`}
            sizes="(max-width: 64rem) 100vw, 60rem"
            width="1040"
            height="780"
            loading="lazy"
            decoding="async"
            alt="Participants of CONCORD making peace signs together in a hall decorated with bells, beside the RCPH banner"
          />
          <figcaption>CONCORD · 6 September 2026</figcaption>
        </figure>
      </section>

      <section className="cd-section" aria-labelledby="cd-ripple-title">
        <h2 id="cd-ripple-title">From me to the world</h2>
        <p className="cd-section__intro">Peace starts small and travels outward.</p>
        <Ripple reduceMotion={reduceMotion} />
      </section>

      <section className="cd-section" aria-labelledby="cd-formats-title">
        <h2 id="cd-formats-title">Three ways in</h2>
        <ul className="cd-formats">
          {formats.map((format, index) => (
            <li key={format.name}>
              <span className="cd-formats__seat" aria-hidden="true">{index + 1}</span>
              <h3>{format.name}</h3>
              <p>{format.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="cd-section" aria-labelledby="cd-skills-title">
        <h2 id="cd-skills-title">Skills built</h2>
        <ul className="cd-skills">
          {skills.map((skill) => <li key={skill}>{skill}</li>)}
        </ul>
      </section>

      <section className="cd-section cd-people" aria-labelledby="cd-people-title">
        <h2 id="cd-people-title">Around the table</h2>
        <p className="cd-people__label">With</p>
        <ul className="cd-clubs">
          {collaborators.map((club) => <li key={club}>{club}</li>)}
        </ul>
        <p className="cd-people__label">Conducted by</p>
        <ul className="cd-credits">
          {conductedBy.map((person) => (
            <li key={person.name}><strong>{person.name}</strong><span>{person.role}</span></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
