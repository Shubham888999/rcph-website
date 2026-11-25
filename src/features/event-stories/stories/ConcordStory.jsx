import { useState } from "react";
import "../../../styles/components/event-concord.css";
import { storyOrganisers } from "../clubOfficers";

const MEDIA = "/media/event-stories/concord-2026";

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

const conductedBy = storyOrganisers("concord-2026", ["tanishka"]);

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

// Four seats around a round table. Passing the olive branch to a seat lets it share its view.
const SEATS = [
  { x: 50, y: 8 },
  { x: 92, y: 50 },
  { x: 50, y: 92 },
  { x: 8, y: 50 },
];

function OliveSprig() {
  return (
    <svg viewBox="0 0 60 40" aria-hidden="true" focusable="false">
      <path d="M4 34C20 30 36 20 56 6" fill="none" stroke="#5c4a2e" strokeWidth="3" strokeLinecap="round" />
      {[[16, 30, -30], [26, 22, 25], [36, 17, -35], [46, 11, 20]].map(([x, y, r]) => (
        <ellipse key={x} cx={x} cy={y} rx="7" ry="3" fill="#6f8f3a" transform={`rotate(${r} ${x} ${y})`} />
      ))}
    </svg>
  );
}

function TalkingPiece() {
  const [speaker, setSpeaker] = useState(0);
  const [heard, setHeard] = useState(() => new Set([0]));
  const everyone = heard.size === rings.length;

  function pass(index) {
    setSpeaker(index);
    setHeard((current) => new Set(current).add(index));
  }

  const seat = SEATS[speaker];
  return (
    <div className="cd-table-wrap">
      <div className="cd-table" role="group" aria-label="Round table: pass the olive branch to a seat">
        <span className="cd-table__top" aria-hidden="true" />
        <span className="cd-table__piece" style={{ left: `${50 + (seat.x - 50) * 0.42}%`, top: `${50 + (seat.y - 50) * 0.42}%` }} aria-hidden="true">
          <OliveSprig />
        </span>
        {rings.map((ring, index) => (
          <button
            key={ring.name}
            type="button"
            className={`cd-seat${index === speaker ? " is-speaking" : ""}${heard.has(index) ? " is-heard" : ""}`}
            style={{ left: `${SEATS[index].x}%`, top: `${SEATS[index].y}%` }}
            onClick={() => pass(index)}
            aria-pressed={index === speaker}
            aria-label={`Pass the olive branch to ${ring.name}`}
          >
            {ring.name}
          </button>
        ))}
      </div>

      <div className="cd-voice" aria-live="polite">
        <p className="cd-voice__who">{rings[speaker].name} has the floor</p>
        <p className="cd-voice__text">{rings[speaker].text}</p>
        <p className="cd-voice__hint">
          {everyone ? "Every voice at the table has been heard." : `Pass the olive branch to another seat · ${heard.size} of ${rings.length} heard`}
        </p>
      </div>
    </div>
  );
}

export default function ConcordStory() {
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

      <section className="cd-section" aria-labelledby="cd-table-title">
        <h2 id="cd-table-title">Pass the olive branch</h2>
        <p className="cd-section__intro">At the roundtable, whoever holds the olive branch speaks, and everyone else listens.</p>
        <TalkingPiece />
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
