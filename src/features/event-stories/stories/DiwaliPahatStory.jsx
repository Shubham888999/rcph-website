import { useState } from "react";
import "../../../styles/components/event-diwali-pahat.css";
import { storyOrganisers } from "../clubOfficers";

const MEDIA = "/media/event-stories/diwali-pahat-2026";
const DIYAS = 5;

const conductedBy = storyOrganisers("diwali-pahat-2026", ["harshal"]);

// Paper lanterns hanging across the sky: horizontal position, string length, colours.
const KANDILS = [
  { x: 8, drop: 4.5, body: "#e63946", trim: "#ffd166" },
  { x: 28, drop: 7, body: "#f4a259", trim: "#7b2cbf" },
  { x: 72, drop: 6, body: "#2a9d8f", trim: "#ffd166" },
  { x: 92, drop: 3.5, body: "#d6336c", trim: "#ffd166" },
];

function Kandil({ body, trim }) {
  return (
    <svg viewBox="0 0 60 100" aria-hidden="true" focusable="false">
      <path d="M30 0V14" stroke="#c9b8a0" strokeWidth="1.5" />
      <path d="M18 14h24l14 24-26 26L4 38Z" fill={body} />
      <path d="M4 38h52M18 14l12 50M42 14 30 64" stroke={trim} strokeWidth="2.2" fill="none" />
      <path d="M22 64v24M30 64v30M38 64v24" stroke={trim} strokeWidth="2" />
      <ellipse className="dp-kandil__glow" cx="30" cy="38" rx="24" ry="22" fill="#ffd166" />
    </svg>
  );
}

function Diya() {
  return (
    <svg viewBox="0 0 80 64" aria-hidden="true" focusable="false">
      <ellipse className="dp-diya__glow" cx="40" cy="22" rx="24" ry="22" />
      <path className="dp-diya__flame" d="M40 4C47 15 47 23 40 31 33 23 33 15 40 4Z" />
      <path d="M6 34H74C72 50 58 60 40 60 22 60 8 50 6 34Z" fill="#b5541c" />
      <path d="M6 34H74" stroke="#f3a35c" strokeWidth="3" strokeLinecap="round" />
      <path d="M20 44h.01M30 48h.01M40 49h.01M50 48h.01M60 44h.01" stroke="#ffd166" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export default function DiwaliPahatStory() {
  const [lit, setLit] = useState(0);
  const dawn = lit === DIYAS;

  return (
    <div className={`dp${lit >= 4 ? " is-light" : ""}${dawn ? " is-dawn" : ""}`} style={{ "--light": lit / DIYAS }}>
      <section className="dp-hero" aria-labelledby="dp-title">
        <div className="dp-kandils" aria-hidden="true">
          {KANDILS.map((kandil) => (
            <span key={kandil.x} className="dp-kandil" style={{ left: `${kandil.x}%`, "--drop": `${kandil.drop}rem` }}>
              <Kandil body={kandil.body} trim={kandil.trim} />
            </span>
          ))}
        </div>
        <p className="dp-kicker">Club Service · Morning of Padwa · 10 November 2026</p>
        <h1 id="dp-title">
          <span className="dp-title__marathi" lang="mr">दिवाळी पहाट</span>
          <span className="dp-title__english">Diwali Pahat</span>
        </h1>
        <p className="dp-lede">
          Before sunrise on Padwa, members gathered at Sarasbaug to celebrate the festive occasion together.
        </p>

        <div className="dp-diyas">
          <p className="dp-diyas__label" aria-live="polite">
            {dawn ? "Shubh Padwa! The morning is here." : `Light the diyas to bring in the morning · ${lit} of ${DIYAS}`}
          </p>
          <ul>
            {Array.from({ length: DIYAS }, (_, index) => (
              <li key={index}>
                <button
                  type="button"
                  className={`dp-diya${index < lit ? " is-lit" : ""}`}
                  onClick={() => setLit((current) => Math.max(current, index + 1))}
                  disabled={index < lit}
                  aria-label={index < lit ? `Diya ${index + 1} lit` : `Light diya ${index + 1}`}
                >
                  <Diya />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="dp-journey" aria-labelledby="dp-journey-title">
        <h2 id="dp-journey-title">The morning</h2>
        <ol>
          <li className="dp-postcard">
            <p className="dp-postcard__stamp">At dawn</p>
            <h3>Sarasbaug</h3>
            <p>Members gathered early on the morning of Padwa to celebrate the festive occasion together.</p>
          </li>
          <li className="dp-journey__path" aria-hidden="true" />
          <li className="dp-postcard dp-postcard--photo">
            <p className="dp-postcard__stamp">For breakfast</p>
            <h3>Bangalore Tiffin Room</h3>
            <p>After spending some time at Sarasbaug, everyone headed here for breakfast, a lovely start to the day.</p>
            <img
              src={`${MEDIA}/group-photo.webp`}
              srcSet={`${MEDIA}/group-photo-800.webp 800w, ${MEDIA}/group-photo.webp 1600w`}
              sizes="(max-width: 48rem) 100vw, 30rem"
              width="1600"
              height="1200"
              loading="lazy"
              decoding="async"
              alt="RCPH members in festive kurtas and traditional outfits outside Bangalore Tiffin Room in the morning sun"
            />
          </li>
        </ol>
      </section>

      <section className="dp-credits" aria-label="Organisers">
        <p className="dp-credits__label">Conducted by</p>
        <ul>
          {conductedBy.map((person) => <li key={person.name}><strong>{person.name}</strong><span>{person.role}</span></li>)}
        </ul>
      </section>
    </div>
  );
}
