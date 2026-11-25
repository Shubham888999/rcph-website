import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { collectedAmounts, mahadaanTotals } from "./mahadaanDrives";
import "../../../../styles/components/event-mahadaan.css";

const SACKS = {
  grains: { label: "Food grains", marathi: "धान्य", colour: "#d9b26f" },
  clothes: { label: "Clothes", marathi: "कपडे", colour: "#7aa6c2" },
  daily: { label: "Daily-use items", marathi: "दैनंदिन वस्तू", colour: "#b58ad1" },
  money: { label: "Money", marathi: "रोख रक्कम", colour: "#e7c04f" },
};

const TRUCK = "/media/event-stories/mahadaan-truck";
const DRIVE_OFF_MS = 1400;
const ARRIVE_MS = 1100;

function SackImage({ id, className = "" }) {
  return <img className={`md-sack-img ${className}`.trim()} src={`${TRUCK}/${id}.webp`} alt="" width="240" height="240" loading="lazy" decoding="async" />;
}

// Tap each donation to load it into the tempo. Once everything is in, the loaded tempo drives
// off to the right and a new empty one rolls in from the left.
function LoadTheTruck({ items, doneText, amounts }) {
  const reduceMotion = useReducedMotion();
  const [loaded, setLoaded] = useState([]);
  const [phase, setPhase] = useState("loading");
  const [trips, setTrips] = useState(0);
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  function later(fn, ms) {
    timers.current.push(window.setTimeout(fn, reduceMotion ? 0 : ms));
  }

  function load(id) {
    if (phase !== "loading" || loaded.includes(id)) return;
    const next = [...loaded, id];
    setLoaded(next);
    if (next.length === items.length) {
      later(() => setPhase("leaving"), 700);
      later(() => { setTrips((count) => count + 1); setPhase("sent"); }, 700 + DRIVE_OFF_MS);
    }
  }

  function sendAnother() {
    setLoaded([]);
    setPhase("arriving");
    later(() => setPhase("loading"), ARRIVE_MS);
  }

  const full = loaded.length === items.length;
  const truckGone = phase === "sent";

  return (
    <div className="md-load">
      <div className="md-road" aria-hidden="true">
        {truckGone ? null : (
          <div className={`md-tempo is-${phase}`} key={`tempo-${trips}-${phase === "arriving" ? "in" : "here"}`}>
            <img className="md-tempo__img" src={`${TRUCK}/${full ? "tempo-full" : "tempo-empty"}.webp`} alt="" width="900" height="485" />
            {full ? null : (
              <div className="md-tempo__bed">
                {loaded.map((id, index) => (
                  <span key={id} className="md-tempo__item" style={{ "--slot": index, "--count": items.length }}>
                    <SackImage id={id} />
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        <span className="md-road__line" />
      </div>

      <ul className="md-sacks">
        {items.map((id) => (
          <li key={id}>
            <button
              type="button"
              className={loaded.includes(id) ? "is-loaded" : ""}
              onClick={() => load(id)}
              disabled={phase !== "loading" || loaded.includes(id)}
              aria-label={`${loaded.includes(id) ? "Loaded" : "Load"} ${SACKS[id].label}${amounts[id] ? `, ${amounts[id]}` : ""}`}
            >
              <SackImage id={id} />
              <span className="md-sacks__label">{SACKS[id].label}</span>
              <span className="md-sacks__marathi" lang="mr">{SACKS[id].marathi}</span>
              {amounts[id] ? <span className="md-sacks__amount">{amounts[id]}</span> : null}
            </button>
          </li>
        ))}
      </ul>

      <div className="md-load__status" aria-live="polite">
        {truckGone ? (
          <>
            <p className="md-load__done">{doneText}</p>
            <button type="button" className="md-button md-button--ghost" onClick={sendAnother}>Send another tempo</button>
          </>
        ) : phase === "leaving" ? (
          <p>Loaded. On its way!</p>
        ) : phase === "arriving" ? (
          <p>A new tempo is pulling in…</p>
        ) : (
          <p>{loaded.length} of {items.length} loaded. Tap each donation to load it.</p>
        )}
      </div>
    </div>
  );
}

// Shared design for both Mahadaan 12.0 drives. `drive` holds that day's content.
function Collected({ title, amounts, className = "" }) {
  return (
    <div className={`md-collected ${className}`.trim()}>
      <p className="md-collected__title">{title}</p>
      <ul>
        <li><strong>{amounts.clothes}</strong><span>of clothes</span></li>
        <li><strong>{amounts.grains}</strong><span>of food grains</span></li>
        <li><strong>{amounts.money}</strong><span>in money</span></li>
      </ul>
    </div>
  );
}

export default function MahadaanStory({ drive, drives }) {
  const amounts = collectedAmounts(drive.collected);
  const totals = collectedAmounts(mahadaanTotals());

  return (
    <div className="md">
      <section className="md-hero" aria-labelledby="md-title">
        <nav className="md-switch" aria-label="Mahadaan 12.0 drives">
          {drives.map((item) => (
            <Link key={item.path} to={item.path} aria-current={item.number === drive.number ? "page" : undefined}>
              Drive {item.number} · {item.shortDate}
            </Link>
          ))}
        </nav>
        <p className="md-kicker">Community Service · Rotary Rotaract Relations</p>
        <h1 id="md-title">
          <span className="md-title__marathi" lang="mr">महादान</span>
          <span className="md-title__english">Mahadaan 12.0 · Drive {drive.number}</span>
        </h1>
        <p className="md-lede">{drive.lede}</p>
        <ul className="md-facts">
          {drive.facts.map((fact) => <li key={fact.label}><span>{fact.label}</span><strong>{fact.value}</strong></li>)}
        </ul>
        <Collected title={`What Drive ${drive.number} collected`} amounts={amounts} />
      </section>

      <section className="md-photos" aria-label="Photos from the drive">
        {drive.photos.map((photo) => (
          <figure key={photo.src} className={drive.photos.length === 1 ? "is-wide" : ""}>
            <img
              src={photo.src}
              srcSet={`${photo.small} 800w, ${photo.src} ${photo.width}w`}
              sizes={drive.photos.length === 1 ? "(max-width: 64rem) 100vw, 64rem" : "(max-width: 48rem) 100vw, 32rem"}
              width={photo.width}
              height={photo.height}
              loading="lazy"
              decoding="async"
              alt={photo.alt}
            />
            <figcaption>{photo.caption}</figcaption>
          </figure>
        ))}
      </section>

      <section className="md-give" aria-labelledby="md-give-title">
        <h2 id="md-give-title">Load the truck</h2>
        <p className="md-give__intro">This is what people gave. Load each sack to send it on its way.</p>
        <LoadTheTruck items={drive.donations} doneText={drive.doneText} amounts={amounts} />
        <Collected title="Mahadaan 12.0, both drives together" amounts={totals} className="md-collected--total" />
      </section>

      {drive.notes.length ? (
        <section className="md-notes" aria-label="About this drive">
          {drive.notes.map((note) => (
            <article key={note.title}>
              <h3>{note.title}</h3>
              <p>{note.text}</p>
            </article>
          ))}
        </section>
      ) : null}

      <section className="md-credits" aria-label="Organisers">
        <p className="md-credits__label">Organised by the <span className="md-nowrap">Rotary Club of Pune Heritage</span>, with the <span className="md-nowrap">Rotaract Club of Pune Heritage</span></p>
        <p className="md-credits__label md-credits__label--small">Conducted by</p>
        <ul>
          {drive.conductedBy.map((person) => (
            <li key={person.name}><strong>{person.name}</strong><span>{person.role}</span></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
