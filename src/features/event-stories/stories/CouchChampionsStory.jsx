import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import "../../../styles/components/event-couch-champions.css";

const PHOTO = "/media/event-stories/couch-champions-2026/game-night.webp";
const PHOTO_SMALL = "/media/event-stories/couch-champions-2026/game-night-800.webp";
const FLIP_BACK_MS = 850;

const conductedBy = [
  { name: "Rtr. Harshal Nikam", role: "Club Service Director" },
  { name: "Rtr. Shivani Kulkarni", role: "Co-Club Service Director" },
];

// Simple line icons for the memory game, drawn in a 24x24 box.
const ICONS = {
  controller: "M6 9h12a4 4 0 0 1 3.9 4.9l-.8 3.4a2.3 2.3 0 0 1-4 .8L15 16H9l-2.1 2.1a2.3 2.3 0 0 1-4-.8l-.8-3.4A4 4 0 0 1 6 9ZM7 12v3M5.5 13.5h3M15.5 12.5h.01M17.5 14.5h.01",
  couch: "M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3M2 13a2 2 0 0 1 4 0v2h12v-2a2 2 0 0 1 4 0v4H2v-4ZM4 17v2M20 17v2",
  trophy: "M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8M10 17h4",
  laptop: "M5 6h14v9H5zM3 18h18l-1.5-3h-15z",
  dice: "M5 5h14v14H5zM9 9h.01M15 9h.01M12 12h.01M9 15h.01M15 15h.01",
  headphones: "M4 15v-3a8 8 0 0 1 16 0v3M4 15h3v5H5a1 1 0 0 1-1-1v-4ZM20 15h-3v5h2a1 1 0 0 0 1-1v-4Z",
};

const PAIRS = [
  { id: "controller", label: "Controller" },
  { id: "couch", label: "Couch" },
  { id: "trophy", label: "Trophy" },
  { id: "laptop", label: "Laptop" },
  { id: "dice", label: "Dice" },
  { id: "headphones", label: "Headphones" },
];

function movesLabel(count) {
  return `${count} ${count === 1 ? "move" : "moves"}`;
}

function shuffledDeck() {
  const deck = PAIRS.flatMap((pair) => [
    { key: `${pair.id}-a`, ...pair },
    { key: `${pair.id}-b`, ...pair },
  ]);
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function Icon({ id }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={ICONS[id]} />
    </svg>
  );
}

function MemoryGame({ reduceMotion }) {
  const [deck, setDeck] = useState(shuffledDeck);
  const [open, setOpen] = useState([]);
  const [matched, setMatched] = useState(() => new Set());
  const [moves, setMoves] = useState(0);
  const timer = useRef(0);
  const won = matched.size === PAIRS.length;

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function flip(index) {
    if (open.length === 2 || open.includes(index) || matched.has(deck[index].id)) return;
    const next = [...open, index];
    setOpen(next);
    if (next.length < 2) return;
    setMoves((count) => count + 1);
    const [a, b] = next;
    if (deck[a].id === deck[b].id) {
      setMatched((current) => new Set(current).add(deck[a].id));
      setOpen([]);
      return;
    }
    timer.current = window.setTimeout(() => setOpen([]), reduceMotion ? 600 : FLIP_BACK_MS);
  }

  function restart() {
    window.clearTimeout(timer.current);
    setDeck(shuffledDeck());
    setOpen([]);
    setMatched(new Set());
    setMoves(0);
  }

  return (
    <div className="cc-game">
      <ul className="cc-game__grid" aria-label="Memory game tiles">
        {deck.map((card, index) => {
          const faceUp = open.includes(index) || matched.has(card.id);
          return (
            <li key={card.key}>
              <button
                type="button"
                className={`cc-tile${faceUp ? " is-up" : ""}${matched.has(card.id) ? " is-matched" : ""}`}
                onClick={() => flip(index)}
                aria-label={faceUp ? card.label : `Hidden tile ${index + 1}`}
                aria-pressed={faceUp}
                disabled={matched.has(card.id)}
              >
                <span className="cc-tile__inner">
                  <span className="cc-tile__back" aria-hidden="true">?</span>
                  <span className="cc-tile__front"><Icon id={card.id} /></span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="cc-game__status" aria-live="polite">
        {won ? (
          <p className="cc-game__win">You&apos;re a Couch Champion! <span>{movesLabel(moves)}</span></p>
        ) : (
          <p>{matched.size} of {PAIRS.length} pairs found · {movesLabel(moves)}</p>
        )}
        <button type="button" className="cc-button cc-button--ghost" onClick={restart}>
          {won ? "Play again" : "Shuffle"}
        </button>
      </div>
    </div>
  );
}

export default function CouchChampionsStory() {
  const reduceMotion = useReducedMotion();
  const gameRef = useRef(null);

  function pressStart() {
    gameRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    gameRef.current?.querySelector("button")?.focus({ preventScroll: true });
  }

  return (
    <div className="cc">
      <section className="cc-hero" aria-labelledby="cc-title">
        <div className="cc-screen">
          <p className="cc-kicker">Club Service · Online game night</p>
          <h1 id="cc-title">Couch Champions</h1>
          <p className="cc-lede">
            An online event where members came together to play various online games, with plenty of
            friendly competition and laughter.
          </p>
          <button type="button" className="cc-button cc-start" onClick={pressStart}>Press start</button>
        </div>
      </section>

      <section className="cc-photo" aria-label="Game night screenshot">
        <figure className="cc-laptop">
          <div className="cc-laptop__screen">
            <img
              src={PHOTO}
              srcSet={`${PHOTO_SMALL} 800w, ${PHOTO} 1600w`}
              sizes="(max-width: 64rem) 100vw, 64rem"
              width="1600"
              height="626"
              loading="lazy"
              decoding="async"
              alt="Screenshot of the online game night: a word game board on a shared screen, with members on video call tiles beside it"
            />
          </div>
          <div className="cc-laptop__base" aria-hidden="true" />
          <figcaption>Couch Champions · 24 October 2026</figcaption>
        </figure>
      </section>

      <section ref={gameRef} className="cc-play" aria-labelledby="cc-play-title">
        <h2 id="cc-play-title">Play a round</h2>
        <p>Match the pairs, game night style.</p>
        <MemoryGame reduceMotion={reduceMotion} />
      </section>

      <section className="cc-credits" aria-label="Organisers">
        <p className="cc-credits__label">Conducted by</p>
        <ul>
          {conductedBy.map((person) => (
            <li key={person.name}><strong>{person.name}</strong><span>{person.role}</span></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
