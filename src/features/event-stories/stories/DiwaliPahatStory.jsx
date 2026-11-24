import { useId, useState } from "react";
import "../../../styles/components/event-diwali-pahat.css";

const MEDIA = "/media/event-stories/diwali-pahat-2026";

const stops = [
  { time: "Early morning", place: "Sarasbaug", text: "Members gathered at Sarasbaug early on the morning of Padwa to celebrate the festive occasion together." },
  { time: "Breakfast", place: "Bangalore Tiffin Room", text: "After spending some time there, everyone headed to Bangalore Tiffin Room for breakfast, a lovely start to the day." },
];

const conductedBy = [
  { name: "Rtr. Harshal Nikam", role: "Club Service Director" },
  { name: "Rtr. Shivani Kulkarni", role: "Co-Club Service Director" },
];

function Rangoli() {
  const petals = Array.from({ length: 8 }, (_, i) => i * 45);
  return (
    <svg className="dp-rangoli" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      {petals.map((angle) => <ellipse key={`o${angle}`} cx="60" cy="24" rx="10" ry="20" fill="#e8731a" transform={`rotate(${angle} 60 60)`} />)}
      {petals.map((angle) => <ellipse key={`m${angle}`} cx="60" cy="34" rx="7" ry="14" fill="#d6336c" transform={`rotate(${angle + 22.5} 60 60)`} />)}
      <circle cx="60" cy="60" r="16" fill="#ffd166" />
      <circle cx="60" cy="60" r="8" fill="#2a9d8f" />
      {petals.map((angle) => <circle key={`d${angle}`} cx="60" cy="6" r="3" fill="#7b2cbf" transform={`rotate(${angle + 22.5} 60 60)`} />)}
    </svg>
  );
}

// Drag the sun up: the sky brightens and the morning moves from Sarasbaug to breakfast.
function MorningSlider() {
  const [value, setValue] = useState(15);
  const id = useId();
  const stop = value < 55 ? stops[0] : stops[1];
  const sunY = 82 - value * 0.62;

  return (
    <div className="dp-morning" style={{ "--progress": value / 100 }}>
      <div className="dp-morning__sky" aria-hidden="true">
        <span className="dp-morning__sun" style={{ top: `${sunY}%` }} />
        <span className="dp-morning__ground" />
      </div>
      <div className="dp-morning__panel">
        <label htmlFor={id} className="dp-morning__label">Drag the sun up</label>
        <input
          id={id}
          type="range"
          min="0"
          max="100"
          value={value}
          onChange={(event) => setValue(Number(event.target.value))}
          aria-valuetext={`${stop.time}, ${stop.place}`}
        />
        <div className="dp-morning__stop" aria-live="polite">
          <p className="dp-morning__time">{stop.time}</p>
          <h3>{stop.place}</h3>
          <p>{stop.text}</p>
        </div>
        <ol className="dp-morning__steps" aria-hidden="true">
          {stops.map((item) => <li key={item.place} className={item === stop ? "is-here" : ""}>{item.place}</li>)}
        </ol>
      </div>
    </div>
  );
}

export default function DiwaliPahatStory() {
  return (
    <div className="dp">
      <section className="dp-hero" aria-labelledby="dp-title">
        <span className="dp-hero__sun" aria-hidden="true" />
        <p className="dp-kicker">Club Service · Morning of Padwa</p>
        <h1 id="dp-title">Diwali Pahat</h1>
        <Rangoli />
        <p className="dp-lede">
          A festive Diwali morning: members gathered at Sarasbaug at dawn on Padwa, then headed out for breakfast
          together.
        </p>
      </section>

      <section className="dp-photo" aria-label="Group photo">
        <figure>
          <img
            src={`${MEDIA}/group-photo.webp`}
            srcSet={`${MEDIA}/group-photo-800.webp 800w, ${MEDIA}/group-photo.webp 1600w`}
            sizes="(max-width: 64rem) 100vw, 60rem"
            width="1600"
            height="1200"
            loading="lazy"
            decoding="async"
            alt="RCPH members in festive kurtas and traditional outfits outside Bangalore Tiffin Room in the morning sun"
          />
          <figcaption>Diwali Pahat · 10 November 2026</figcaption>
        </figure>
      </section>

      <section className="dp-section" aria-labelledby="dp-morning-title">
        <h2 id="dp-morning-title">Watch the morning unfold</h2>
        <MorningSlider />
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
