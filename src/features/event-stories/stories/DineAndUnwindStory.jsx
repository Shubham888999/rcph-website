import { useState } from "react";
import "../../../styles/components/event-dine-unwind.css";
import { officers } from "../clubOfficers";

const MEDIA = "/media/event-stories/dine-and-unwind-2026";

const specials = [
  { name: "Interact", text: "Everyone got together over dinner, with plenty of time to talk." },
  { name: "Bond", text: "Quality time with each other, outside regular club activities." },
  { name: "Unwind", text: "A relaxed and enjoyable atmosphere for everyone to connect." },
];

const conductedBy = officers("harshal", "shivani");

function Cloche({ open }) {
  return (
    <svg className={`du-cloche${open ? " is-open" : ""}`} viewBox="0 0 120 90" aria-hidden="true" focusable="false">
      <ellipse className="du-cloche__plate" cx="60" cy="78" rx="56" ry="9" />
      <g className="du-cloche__dome">
        <path d="M14 74a46 46 0 0 1 92 0Z" />
        <path className="du-cloche__shine" d="M30 56c4-12 14-20 26-22" />
        <circle cx="60" cy="24" r="5" />
      </g>
    </svg>
  );
}

function Specials() {
  const [open, setOpen] = useState(() => new Set());

  function lift(index) {
    setOpen((current) => new Set(current).add(index));
  }

  return (
    <ul className="du-specials">
      {specials.map((dish, index) => {
        const isOpen = open.has(index);
        return (
          <li key={dish.name}>
            <button type="button" onClick={() => lift(index)} aria-expanded={isOpen} disabled={isOpen} aria-label={isOpen ? dish.name : `Lift the lid on course ${index + 1}`}>
              <Cloche open={isOpen} />
              <span className="du-specials__course">Course {index + 1}</span>
              {isOpen ? (
                <span className="du-specials__dish">
                  <strong>{dish.name}</strong>
                  <span>{dish.text}</span>
                </span>
              ) : (
                <span className="du-specials__hint">Tap to lift the lid</span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default function DineAndUnwindStory() {
  return (
    <div className="du">
      <section className="du-hero" aria-labelledby="du-title">
        <div className="du-menu">
          <p className="du-menu__top">Club Service</p>
          <h1 id="du-title">Dine <span>&amp;</span> Unwind</h1>
          <p className="du-menu__rule" aria-hidden="true">✦</p>
          <p className="du-menu__when">13 September 2026 · 7:30 pm</p>
          <p className="du-menu__lede">
            We got together for a dinner where everyone could interact, bond and spend quality time together
            outside regular club activities.
          </p>
        </div>
      </section>

      <section className="du-photo" aria-label="Group selfie">
        <figure>
          <img
            src={`${MEDIA}/selfie.webp`}
            srcSet={`${MEDIA}/selfie-800.webp 800w, ${MEDIA}/selfie.webp 1600w`}
            sizes="(max-width: 48rem) 100vw, 44rem"
            width="1600"
            height="1200"
            loading="lazy"
            decoding="async"
            alt="A group selfie of smiling RCPH members outside after dinner at night"
          />
          <figcaption>Dine &amp; Unwind · 13 September 2026</figcaption>
        </figure>
      </section>

      <section className="du-tonight" aria-labelledby="du-tonight-title">
        <h2 id="du-tonight-title">Tonight&apos;s specials</h2>
        <p className="du-tonight__intro">Three courses, served one at a time.</p>
        <Specials />
      </section>

      <section className="du-credits" aria-label="Organisers">
        <p className="du-credits__label">Conducted by</p>
        <ul>
          {conductedBy.map((person) => (
            <li key={person.name}><strong>{person.name}</strong><span>{person.role}</span></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
