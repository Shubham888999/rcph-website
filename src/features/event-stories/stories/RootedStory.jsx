import { useState } from "react";
import "../../../styles/components/event-rooted.css";
import { officers } from "../clubOfficers";

const PHOTO = "/media/event-stories/rooted-2026/group-photo.webp";
const PHOTO_SMALL = "/media/event-stories/rooted-2026/group-photo-800.webp";

const stats = [
  { value: "60+", label: "participants" },
  { value: "6", label: "faculty members" },
  { value: "1", label: "expert speaker" },
];

// Each growth stage of the plant shows one part of the workshop.
const stages = [
  { name: "Seed", title: "Hands-on potting", text: "A hands-on potting session, guided by speaker Mr. Amarish Pingle." },
  { name: "Sprout", title: "Gardening myths, busted", text: "Common gardening myths, busted." },
  { name: "Leaves", title: "Indian plant varieties", text: "Participants learned about Indian plant varieties." },
  { name: "Bloom", title: "Caring for the planet", text: "Sustainable plant-care practices, alongside discussions on global warming and deforestation." },
];

const guests = [
  { role: "Speaker", name: "Mr. Amarish Pingle" },
  { role: "Graced by", name: "District PRO Janhvi Yeole" },
  { role: "With", name: "Six faculty members and the EcoRangers" },
  { role: "In collaboration with", name: "S.P. Junior College's Environment Department" },
];

const conductedBy = officers("ira");

// A pot with a plant drawn for the current stage (0 seed to 3 bloom).
function Plant({ stage }) {
  return (
    <svg className={`rooted-plant is-stage-${stage}`} viewBox="0 0 200 220" role="img" aria-label={`The plant at the ${stages[stage].name.toLowerCase()} stage`}>
      <path className="rooted-plant__pot" d="M46 146H154V160H146L136 212H64L54 160H46Z" />
      <path className="rooted-plant__pot-band" d="M54 160H146" />
      <path className="rooted-plant__soil" d="M50 147C66 133 134 133 150 147Z" />
      <g className="rooted-plant__growth">
        <ellipse className="rooted-plant__seed" cx="100" cy="137" rx="7" ry="5" />
        <path className="rooted-plant__stem" d="M100 140V70" />
        <path className="rooted-plant__leaf rooted-plant__leaf--1" d="M100 120C84 118 74 108 72 94 88 96 98 106 100 120Z" />
        <path className="rooted-plant__leaf rooted-plant__leaf--2" d="M100 112C116 110 126 100 128 86 112 88 102 98 100 112Z" />
        <path className="rooted-plant__leaf rooted-plant__leaf--3" d="M100 92C86 88 80 76 80 64 94 68 100 80 100 92Z" />
        <path className="rooted-plant__leaf rooted-plant__leaf--4" d="M100 86C114 82 120 70 120 58 106 62 100 74 100 86Z" />
        <g className="rooted-plant__flower">
          {[0, 72, 144, 216, 288].map((angle) => (
            <ellipse key={angle} cx="100" cy="46" rx="7" ry="13" transform={`rotate(${angle} 100 58)`} />
          ))}
          <circle className="rooted-plant__flower-centre" cx="100" cy="58" r="7" />
        </g>
      </g>
    </svg>
  );
}

function GrowPlant() {
  const [stage, setStage] = useState(0);
  const last = stage === stages.length - 1;
  const current = stages[stage];

  return (
    <div className="rooted-grow">
      <div className="rooted-grow__pot">
        <Plant stage={stage} />
        <button type="button" className="rooted-button" onClick={() => setStage(last ? 0 : stage + 1)}>
          {last ? "Plant another seed" : "Water the plant"}
        </button>
      </div>
      <div className="rooted-grow__card" aria-live="polite">
        <p className="rooted-grow__stage">Stage {stage + 1} of {stages.length} · {current.name}</p>
        <h3>{current.title}</h3>
        <p>{current.text}</p>
        <div className="rooted-grow__dots" role="group" aria-label="Jump to a stage">
          {stages.map((item, index) => (
            <button
              key={item.name}
              type="button"
              aria-label={`${item.name}: ${item.title}`}
              aria-pressed={index === stage}
              className={index <= stage ? "is-grown" : ""}
              onClick={() => setStage(index)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function RootedStory() {
  return (
    <div className="rooted">
      <section className="rooted-hero" aria-labelledby="rooted-title">
        <p className="rooted-kicker">Professional Development · Gardening workshop</p>
        <h1 id="rooted-title">
          ROOTED
          <svg className="rooted-roots" viewBox="0 0 600 90" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <path d="M60 0C62 30 40 46 30 80M60 30C76 44 84 58 82 84" />
            <path d="M175 0C170 28 186 50 176 86M174 40C160 52 150 64 152 82" />
            <path d="M300 0C304 26 290 52 300 88M302 34C318 46 330 60 326 80M296 50C282 58 276 70 278 84" />
            <path d="M425 0C420 30 436 48 428 84M426 36C410 48 404 62 406 80" />
            <path d="M540 0C544 32 560 48 568 82M542 40C528 54 524 66 528 84" />
          </svg>
        </h1>
        <p className="rooted-lede">
          An interactive gardening workshop with S.P. Junior College&apos;s Environment Department, built around
          practical learning and environmental awareness.
        </p>
        <ul className="rooted-stats">
          {stats.map((stat) => (
            <li key={stat.label}><strong>{stat.value}</strong><span>{stat.label}</span></li>
          ))}
        </ul>
      </section>

      <section className="rooted-photo" aria-label="Group photo">
        <figure>
          <div className="rooted-photo__packet">
            <span className="rooted-photo__label" aria-hidden="true">ROOTED · Seed packet no. 01</span>
            <img
              src={PHOTO}
              srcSet={`${PHOTO_SMALL} 800w, ${PHOTO} 1600w`}
              sizes="(max-width: 60rem) 100vw, 60rem"
              width="1600"
              height="1200"
              loading="lazy"
              decoding="async"
              alt="Workshop participants, faculty members and RCPH members holding potted saplings in a college hall, with a slide on plant maintenance on the screen behind them"
            />
          </div>
          <figcaption>ROOTED · 13 October 2026</figcaption>
        </figure>
      </section>

      <section className="rooted-learn" aria-labelledby="rooted-learn-title">
        <h2 id="rooted-learn-title">Grow your plant</h2>
        <p className="rooted-learn__intro">Water the plant to walk through the workshop, one stage at a time.</p>
        <GrowPlant />
      </section>

      <section className="rooted-people" aria-labelledby="rooted-people-title">
        <h2 id="rooted-people-title">Who joined us</h2>
        <ul className="rooted-guests">
          {guests.map((guest) => (
            <li key={guest.name}><span>{guest.role}</span><strong>{guest.name}</strong></li>
          ))}
        </ul>
        <div className="rooted-credits">
          <p className="rooted-credits__label">Conducted by</p>
          <ul>
            {conductedBy.map((person) => (
              <li key={person.name}><strong>{person.name}</strong><span>{person.role}</span></li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
