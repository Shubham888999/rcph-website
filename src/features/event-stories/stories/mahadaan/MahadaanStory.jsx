import { useState } from "react";
import { Link } from "react-router-dom";
import "../../../../styles/components/event-mahadaan.css";

const SACKS = {
  grains: { label: "Food grains", marathi: "धान्य", colour: "#d9b26f" },
  clothes: { label: "Clothes", marathi: "कपडे", colour: "#7aa6c2" },
  daily: { label: "Daily-use items", marathi: "दैनंदिन वस्तू", colour: "#b58ad1" },
  money: { label: "Money", marathi: "रोख रक्कम", colour: "#e7c04f" },
};

function Sack({ colour }) {
  return (
    <svg className="md-sack" viewBox="0 0 60 64" aria-hidden="true" focusable="false">
      <path d="M18 10h24l-4 8c10 6 16 18 16 30 0 8-6 12-24 12S6 56 6 48c0-12 6-24 16-30Z" fill={colour} />
      <path d="M18 10h24M22 18h16" stroke="#5a3b1c" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M14 40c8 3 24 3 32 0" stroke="rgba(90,59,28,0.35)" strokeWidth="2" fill="none" />
    </svg>
  );
}

// The truck fills up as people load each kind of donation into it.
function LoadTheTruck({ items, doneText }) {
  const [loaded, setLoaded] = useState([]);
  const done = loaded.length === items.length;

  function load(id) {
    setLoaded((current) => (current.includes(id) ? current : [...current, id]));
  }

  return (
    <div className="md-load">
      <div className="md-truck" aria-hidden="true">
        <div className="md-truck__bed">
          {loaded.map((id, index) => (
            <span key={id} className="md-truck__sack" style={{ "--slot": index }}>
              <Sack colour={SACKS[id].colour} />
            </span>
          ))}
        </div>
        <div className="md-truck__cab" />
        <span className="md-truck__wheel md-truck__wheel--1" />
        <span className="md-truck__wheel md-truck__wheel--2" />
        <span className="md-truck__wheel md-truck__wheel--3" />
      </div>

      <ul className="md-sacks">
        {items.map((id) => (
          <li key={id}>
            <button
              type="button"
              className={loaded.includes(id) ? "is-loaded" : ""}
              onClick={() => load(id)}
              disabled={loaded.includes(id)}
              aria-label={loaded.includes(id) ? `${SACKS[id].label} loaded` : `Load ${SACKS[id].label}`}
            >
              <Sack colour={SACKS[id].colour} />
              <span className="md-sacks__label">{SACKS[id].label}</span>
              <span className="md-sacks__marathi" lang="mr">{SACKS[id].marathi}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="md-load__status" aria-live="polite">
        {done ? (
          <>
            <p className="md-load__done">{doneText}</p>
            <button type="button" className="md-button md-button--ghost" onClick={() => setLoaded([])}>Unload and start again</button>
          </>
        ) : (
          <p>{loaded.length} of {items.length} loaded. Tap a sack to load it.</p>
        )}
      </div>
    </div>
  );
}

// Shared design for both Mahadaan 12.0 drives. `drive` holds that day's content.
export default function MahadaanStory({ drive, drives }) {
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
        <LoadTheTruck items={drive.donations} doneText={drive.doneText} />
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
        <p className="md-credits__label">Organised by the Rotary Club of Pune Heritage, with the Rotaract Club of Pune Heritage</p>
        <p className="md-credits__label md-credits__label--small">Conducted by</p>
        <ul>
          {drive.conductedBy.map((person) => (
            <li key={person.name}><strong>{person.name}</strong>{person.role ? <span>{person.role}</span> : null}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
