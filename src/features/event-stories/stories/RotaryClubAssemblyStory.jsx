import { useState } from "react";
import "../../../styles/components/event-rotary-assembly.css";

const MEDIA = "/media/event-stories/rotary-club-assembly-2026";

const agenda = [
  "Review of previously conducted events, their data and outcomes",
  "Membership growth",
  "The club's overall performance",
  "Upcoming initiatives and future planning",
  "Collaborative projects between the Rotary Club and the Rotaract Club",
];

const conductedBy = [{ name: "Rtr. Aneesh Ladkat", role: "" }];

function Agenda() {
  const [done, setDone] = useState(() => new Set());
  const complete = done.size === agenda.length;

  function toggle(index) {
    setDone((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <div className="ra-agenda">
      <ol>
        {agenda.map((item, index) => (
          <li key={item}>
            <label className={done.has(index) ? "is-done" : ""}>
              <input type="checkbox" checked={done.has(index)} onChange={() => toggle(index)} />
              <span className="ra-agenda__box" aria-hidden="true" />
              <span className="ra-agenda__number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <span className="ra-agenda__text">{item}</span>
            </label>
          </li>
        ))}
      </ol>
      <div className="ra-agenda__status" aria-live="polite">
        {complete ? (
          <div className="ra-agenda__roadmap">
            <strong>Roadmap set</strong>
            <span>A stronger Rotary–Rotaract relationship, better coordination, and a plan for upcoming joint events and activities.</span>
          </div>
        ) : (
          <p>{done.size} of {agenda.length} agenda items covered. Tick each one off.</p>
        )}
      </div>
    </div>
  );
}

export default function RotaryClubAssemblyStory() {
  return (
    <div className="ra">
      <section className="ra-hero" aria-labelledby="ra-title">
        <div className="ra-sheet">
          <p className="ra-sheet__org">Rotary Club of Pune Heritage · District 3131</p>
          <h1 id="ra-title">Rotary Club Assembly</h1>
          <p className="ra-sheet__date">25 October 2026</p>
          <p className="ra-sheet__lede">
            The President and Secretary of the Rotaract Club of Pune Heritage attended the Rotary Club Assembly to
            discuss the club&apos;s overall progress and development.
          </p>
        </div>
      </section>

      <section className="ra-photo" aria-label="Group photo">
        <figure>
          <img
            src={`${MEDIA}/assembly.webp`}
            srcSet={`${MEDIA}/assembly-800.webp 800w, ${MEDIA}/assembly.webp 1600w`}
            sizes="(max-width: 64rem) 100vw, 60rem"
            width="1600"
            height="1200"
            loading="lazy"
            decoding="async"
            alt="Members of the Rotary Club of Pune Heritage and RCPH together on stage at the Club Assembly"
          />
          <figcaption>Rotary Club Assembly · 25 October 2026</figcaption>
        </figure>
      </section>

      <section className="ra-section" aria-labelledby="ra-agenda-title">
        <h2 id="ra-agenda-title">Work through the agenda</h2>
        <Agenda />
      </section>

      <section className="ra-section ra-people" aria-labelledby="ra-people-title">
        <h2 id="ra-people-title">Who attended</h2>
        <p className="ra-people__line">The President and Secretary of the Rotaract Club of Pune Heritage, with the Rotary Club of Pune Heritage.</p>
        <p className="ra-people__label">Conducted by</p>
        <ul className="ra-credits">
          {conductedBy.map((person) => (
            <li key={person.name}><strong>{person.name}</strong>{person.role ? <span>{person.role}</span> : null}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
