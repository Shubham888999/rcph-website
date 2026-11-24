import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { officers } from "../clubOfficers";
import "../../../styles/components/event-misal.css";

const MEDIA = "/media/event-stories/misal-brunch-2026";

// Added in this order to build the misal in the bowl.
const LAYERS = [
  { id: "usal", label: "Matki usal", marathi: "उसळ" },
  { id: "kat", label: "Kat (spicy rassa)", marathi: "कट" },
  { id: "farsan", label: "Farsan", marathi: "फरसाण" },
  { id: "onion", label: "Onion", marathi: "कांदा" },
  { id: "coriander", label: "Coriander", marathi: "कोथिंबीर" },
  { id: "lemon", label: "Lemon", marathi: "लिंबू" },
  { id: "pav", label: "Pav", marathi: "पाव" },
];

const moments = [
  { title: "Pune on a plate", text: "Celebrating the city's iconic culinary culture through its beloved Misal Pav, and its rich food traditions." },
  { title: "Interdistrict bonds", text: "Meaningful interactions with the delegates from RID 3191, Bangalore, over a shared meal." },
  { title: "Fellowship", text: "Warm hospitality, cultural exchange and memorable moments that made it a highlight of their visit." },
];

const conductedBy = officers("harshal", "shivani");

function Bowl({ added }) {
  const has = (id) => added.includes(id);
  return (
    <svg className="ms-bowl" viewBox="0 0 260 180" role="img" aria-label={`A misal bowl with ${added.length} of ${LAYERS.length} ingredients`}>
      <ellipse cx="120" cy="164" rx="96" ry="10" fill="rgba(0,0,0,0.18)" />
      <g className={`ms-layer${has("pav") ? " is-on" : ""}`}>
        <rect x="196" y="112" width="52" height="40" rx="16" fill="#e6a85c" />
        <rect x="200" y="104" width="44" height="18" rx="9" fill="#c9823a" />
      </g>
      <path d="M24 92h192c0 40-42 66-96 66S24 132 24 92Z" fill="#9a3b1b" />
      <ellipse cx="120" cy="92" rx="96" ry="22" fill="#5a1f0e" />
      <ellipse className={`ms-layer${has("usal") ? " is-on" : ""}`} cx="120" cy="94" rx="86" ry="17" fill="#8a5a2b" />
      <ellipse className={`ms-layer${has("kat") ? " is-on" : ""}`} cx="120" cy="92" rx="84" ry="16" fill="#d9381e" opacity="0.92" />
      <g className={`ms-layer${has("farsan") ? " is-on" : ""}`} fill="#f2b84b">
        {[[70, 86], [92, 80], [112, 88], [134, 80], [156, 86], [100, 96], [142, 94], [82, 94], [124, 98]].map(([x, y]) => <rect key={`${x}${y}`} x={x} y={y} width="14" height="4" rx="2" transform={`rotate(${(x * 7) % 50 - 25} ${x} ${y})`} />)}
      </g>
      <g className={`ms-layer${has("onion") ? " is-on" : ""}`} fill="#f4ecf7" stroke="#c48bd6" strokeWidth="1">
        {[[86, 84], [118, 82], [148, 90], [106, 92], [132, 88]].map(([x, y]) => <rect key={`o${x}`} x={x} y={y} width="6" height="5" rx="1" />)}
      </g>
      <g className={`ms-layer${has("coriander") ? " is-on" : ""}`} fill="#2f8a3a">
        {[[96, 82], [126, 86], [112, 78], [140, 82], [90, 92], [154, 92]].map(([x, y]) => <circle key={`c${x}`} cx={x} cy={y} r="3" />)}
      </g>
      <g className={`ms-layer${has("lemon") ? " is-on" : ""}`}>
        <path d="M168 76a16 16 0 0 1 22 18Z" fill="#f7e15a" stroke="#c9b100" strokeWidth="2" />
      </g>
    </svg>
  );
}

const LAYER_DELAY_MS = 350;

function BuildMisal() {
  const reduceMotion = useReducedMotion();
  const [added, setAdded] = useState([]);
  const timers = useRef([]);
  const done = added.length === LAYERS.length;
  const building = added.length > 0 && !done;

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  function makeMisal() {
    if (reduceMotion) {
      setAdded(LAYERS.map((layer) => layer.id));
      return;
    }
    timers.current = LAYERS.map((layer, index) => window.setTimeout(
      () => setAdded((current) => [...current, layer.id]),
      index * LAYER_DELAY_MS,
    ));
  }

  return (
    <div className="ms-build">
      <Bowl added={added} />
      <div className="ms-build__side" aria-live="polite">
        {done ? (
          <p className="ms-build__status is-done">One authentic Pune misal, ready. Welcome to Pune, RID 3191!</p>
        ) : (
          <button type="button" className="ms-button" onClick={makeMisal} disabled={building}>
            {building ? `Adding the ${LAYERS[added.length].label.toLowerCase()}…` : "Make the misal"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function MisalBrunchStory() {
  return (
    <div className="ms">
      <section className="ms-hero" aria-labelledby="ms-title">
        <p className="ms-kicker">International Service · Club Service · Samyati 4.0</p>
        <h1 id="ms-title">
          <span className="ms-title__marathi" lang="mr">मिसळ</span>
          <span className="ms-title__english">Misal Brunch</span>
        </h1>
        <p className="ms-tag">Welcome to Pune, RID 3191</p>
        <p className="ms-lede">
          The delegates from RID 3191, Bangalore, enjoyed a Misal Brunch during Samyati 4.0, celebrating Pune&apos;s
          iconic culinary culture through its beloved Misal Pav.
        </p>
      </section>

      <section className="ms-photo" aria-label="Group photo">
        <figure>
          <img
            src={`${MEDIA}/group-photo.webp`}
            srcSet={`${MEDIA}/group-photo-600.webp 600w, ${MEDIA}/group-photo.webp 1200w`}
            sizes="(max-width: 40rem) 100vw, 30rem"
            width="1200"
            height="1600"
            loading="lazy"
            decoding="async"
            alt="RCPH members and RID 3191 delegates standing together outside Pune Misal House"
          />
          <figcaption>Misal Brunch · 19 September 2026</figcaption>
        </figure>
        <ul className="ms-moments">
          {moments.map((moment) => <li key={moment.title}><h3>{moment.title}</h3><p>{moment.text}</p></li>)}
        </ul>
      </section>

      <section className="ms-section" aria-labelledby="ms-build-title">
        <h2 id="ms-build-title">Build your misal</h2>
        <p className="ms-section__intro">Usal, kat, farsan, onion, coriander, lemon and pav, the Pune way.</p>
        <BuildMisal />
      </section>

      <section className="ms-credits" aria-label="Organisers">
        <p className="ms-credits__label">Conducted by</p>
        <ul>
          {conductedBy.map((person) => <li key={person.name}><strong>{person.name}</strong><span>{person.role}</span></li>)}
        </ul>
      </section>
    </div>
  );
}
