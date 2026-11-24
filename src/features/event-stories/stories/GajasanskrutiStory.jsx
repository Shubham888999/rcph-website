import { useState } from "react";
import "../../../styles/components/event-gajasanskruti.css";

const MEDIA = "/media/event-stories/gajasanskruti-2026";

const stats = [
  { value: "148", label: "volunteers" },
  { value: "31", label: "Rotaract clubs" },
  { value: "2", label: "Rotary clubs" },
  { value: "90", label: "bags of garbage" },
];

const route = ["FC Road", "Karve Road", "Nadiapatra", "Deccan Gymkhana"];

const partners = [
  { role: "Hosted by", name: "Rotaract Club of Pune Mideast" },
  { role: "With", name: "Rotaract Club of Pune Heritage and 30+ Rotaract clubs, 8 of them from outside RID 3131" },
  { role: "Rotary clubs", name: "Rotary Club of Pune Mid-East and Rotary Club of Pune South" },
  { role: "Supported by", name: "Pune Municipal Corporation (PMC)" },
];

const conductedBy = [
  { name: "Rtr. Tanishka Patekar", role: "" },
  { name: "Rtr. Soumitra Lokur", role: "" },
];

// Litter on the street drawing: position in percent, kind and tilt.
const LITTER = [
  { x: 8, y: 62, kind: "bottle", tilt: -30 },
  { x: 19, y: 78, kind: "wrapper", tilt: 10 },
  { x: 28, y: 58, kind: "cup", tilt: 15 },
  { x: 37, y: 82, kind: "can", tilt: -60 },
  { x: 46, y: 64, kind: "wrapper", tilt: -20 },
  { x: 55, y: 79, kind: "bottle", tilt: 60 },
  { x: 63, y: 57, kind: "can", tilt: 20 },
  { x: 71, y: 74, kind: "cup", tilt: -40 },
  { x: 80, y: 61, kind: "wrapper", tilt: 35 },
  { x: 88, y: 80, kind: "bottle", tilt: -10 },
];

const LITTER_LABEL = { bottle: "plastic bottle", wrapper: "wrapper", cup: "paper cup", can: "can" };

function LitterIcon({ kind }) {
  if (kind === "bottle") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 2h4v3l1 2v13a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V7l1-2Z" fill="#8fd3f4" stroke="#2f6f8f" strokeWidth="1.4" /><path d="M9 11h6" stroke="#2f6f8f" strokeWidth="1.4" /></svg>;
  if (kind === "cup") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h12l-2 16H8Z" fill="#fff" stroke="#8a5a2b" strokeWidth="1.4" /><path d="M7 9h10" stroke="#e2553f" strokeWidth="2" /></svg>;
  if (kind === "can") return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="4" width="10" height="16" rx="2" fill="#e2553f" stroke="#7a1f1f" strokeWidth="1.4" /><path d="M7 8h10M7 16h10" stroke="#fff" strokeWidth="1.2" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8l4-3 4 2 4-2 4 3-2 9-4 2-4-2-4 2-4-2Z" fill="#ffd23f" stroke="#9a7b00" strokeWidth="1.4" /></svg>;
}

function CleanTheStreet() {
  const [picked, setPicked] = useState(() => new Set());
  const done = picked.size === LITTER.length;
  const fill = picked.size / LITTER.length;

  function pick(index) {
    setPicked((current) => new Set(current).add(index));
  }

  return (
    <div className="gs-game">
      <div className="gs-street">
        <div className="gs-street__footpath" aria-hidden="true" />
        <div className="gs-street__road" aria-hidden="true"><span /></div>
        {LITTER.map((item, index) => (
          <button
            key={index}
            type="button"
            className={`gs-litter${picked.has(index) ? " is-picked" : ""}`}
            style={{ left: `${item.x}%`, top: `${item.y}%`, "--tilt": `${item.tilt}deg` }}
            onClick={() => pick(index)}
            disabled={picked.has(index)}
            aria-label={`Pick up the ${LITTER_LABEL[item.kind]}`}
          >
            <LitterIcon kind={item.kind} />
          </button>
        ))}
      </div>

      <div className="gs-bag-row">
        <svg className="gs-bag" viewBox="0 0 60 70" aria-hidden="true" focusable="false">
          <defs>
            <clipPath id="gs-bag-shape"><path d="M14 16h32l8 46a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4Z" /></clipPath>
          </defs>
          <path d="M14 16h32l8 46a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4Z" fill="#d9f2e3" />
          <rect clipPath="url(#gs-bag-shape)" x="0" y={66 - 50 * fill} width="60" height={50 * fill} fill="#1f8a5b" className="gs-bag__fill" />
          <path d="M14 16h32l8 46a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4Z" fill="none" stroke="#14532d" strokeWidth="2.5" />
          <path d="M22 16c0-8 16-8 16 0" fill="none" stroke="#14532d" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <div className="gs-game__status" aria-live="polite">
          {done ? (
            <>
              <p className="gs-game__done">Street clean! On the day, 148 volunteers filled 90 bags like this one.</p>
              <button type="button" className="gs-button" onClick={() => setPicked(new Set())}>Litter it again</button>
            </>
          ) : (
            <p>{picked.size} of {LITTER.length} picked up. Tap the litter to bag it.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GajasanskrutiStory() {
  return (
    <div className="gs">
      <section className="gs-hero" aria-labelledby="gs-title">
        <p className="gs-kicker">International Service · Community Service · Rotary Rotaract Relations</p>
        <h1 id="gs-title">Gajasanskruti <span>10.0</span></h1>
        <p className="gs-lede">
          The flagship cleanliness drive of the Rotaract Club of Pune Mideast, with 30+ Rotaract clubs, 2 Rotary
          clubs and the PMC. Volunteers cleaned key city areas, promoting hygiene, civic pride and community
          responsibility.
        </p>
        <ul className="gs-stats">
          {stats.map((stat) => <li key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></li>)}
        </ul>
      </section>

      <section className="gs-route" aria-labelledby="gs-route-title">
        <h2 id="gs-route-title">The route</h2>
        <ol>
          {route.map((stop, index) => (
            <li key={stop}><span className="gs-route__pin" aria-hidden="true"><span>{index + 1}</span></span>{stop}</li>
          ))}
        </ol>
      </section>

      <section className="gs-photos" aria-label="Photos from the drive">
        <figure className="gs-photos__main">
          <img
            src={`${MEDIA}/volunteers.webp`}
            srcSet={`${MEDIA}/volunteers-800.webp 800w, ${MEDIA}/volunteers.webp 1030w`}
            sizes="(max-width: 64rem) 100vw, 64rem"
            width="1030"
            height="683"
            loading="lazy"
            decoding="async"
            alt="Volunteers from many Rotaract and Rotary clubs posing together on a Pune street in front of filled garbage bags"
          />
          <figcaption>All the volunteers, after the drive</figcaption>
        </figure>
        <figure>
          <img
            src={`${MEDIA}/rcph-team.webp`}
            srcSet={`${MEDIA}/rcph-team-800.webp 800w, ${MEDIA}/rcph-team.webp 1600w`}
            sizes="(max-width: 64rem) 100vw, 64rem"
            width="1600"
            height="900"
            loading="lazy"
            decoding="async"
            alt="The RCPH team standing together outside Cafe Goodluck in Pune"
          />
          <figcaption>Team RCPH at Cafe Goodluck</figcaption>
        </figure>
      </section>

      <section className="gs-play" aria-labelledby="gs-play-title">
        <h2 id="gs-play-title">Clean the street</h2>
        <p>Your turn. Pick up every bit of litter.</p>
        <CleanTheStreet />
      </section>

      <section className="gs-people" aria-labelledby="gs-people-title">
        <h2 id="gs-people-title">Who made it happen</h2>
        <ul className="gs-partners">
          {partners.map((partner) => <li key={partner.role}><span>{partner.role}</span><strong>{partner.name}</strong></li>)}
        </ul>
        <div className="gs-credits">
          <p className="gs-credits__label">Conducted by</p>
          <ul>
            {conductedBy.map((person) => (
              <li key={person.name}><strong>{person.name}</strong>{person.role ? <span>{person.role}</span> : null}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
