import { useCallback, useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import "../../../styles/components/event-patakhas.css";

const PHOTO = "/media/event-stories/patakhas-assemble-2026/group-photo.webp";
const PHOTO_SMALL = "/media/event-stories/patakhas-assemble-2026/group-photo-800.webp";
const SPARK_COLOURS = ["#ffd166", "#ffb627", "#ff7b00", "#ff4d6d", "#fff3c4", "#f72585"];
const GARLAND_FLOWERS = 26;
const FAIRY_LIGHTS = 18;

// The fairy light wire: two sagging curves across the top of the sky.
const WIRE = [[0, 30], [250, 120], [500, 40], [750, 0], [1000, 30]];
const WIRE_PATH = "M0 30 Q 250 120 500 40 Q 750 0 1000 30";

function wirePoint(t) {
  const [p0, c, p1] = t < 0.5 ? WIRE.slice(0, 3) : WIRE.slice(2, 5);
  const u = t < 0.5 ? t * 2 : t * 2 - 1;
  const at = (k) => (1 - u) ** 2 * p0[k] + 2 * u * (1 - u) * c[k] + u ** 2 * p1[k];
  return [at(0), at(1)];
}

const evening = [
  { title: "Diwali, together", text: "Members came together to celebrate the festival with lots of fun and festive spirit." },
  { title: "Bollywood Trivia", text: "The evening included a Bollywood Trivia game." },
  { title: "Dinner", text: "Followed by a lovely dinner, making it an enjoyable celebration for everyone." },
];

// Moves every spark one frame, draws it, and returns the sparks still alive.
function stepSparks(canvas, sparks) {
  if (!canvas) return [];
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = "lighter";
  const alive = sparks.filter((spark) => spark.life > 0);
  for (const spark of alive) {
    spark.x += spark.vx;
    spark.y += spark.vy;
    spark.vy += 0.045;
    spark.vx *= 0.985;
    spark.life -= 1;
    ctx.globalAlpha = Math.max(0, spark.life / spark.maxLife);
    ctx.fillStyle = spark.colour;
    ctx.beginPath();
    ctx.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return alive;
}

// Sparkle bursts drawn on a canvas over the night sky. Each burst is a ring of sparks
// that fly out, fall a little and fade.
function usePatakhas(canvasRef, enabled) {
  const sparks = useRef([]);
  const frame = useRef(0);
  const loop = useRef(null);

  useEffect(() => {
    loop.current = () => {
      sparks.current = stepSparks(canvasRef.current, sparks.current);
      frame.current = sparks.current.length ? requestAnimationFrame(loop.current) : 0;
    };
  }, [canvasRef]);

  const burst = useCallback((x, y) => {
    if (!enabled) return;
    const ratio = window.devicePixelRatio || 1;
    const count = 70;
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.2;
      const speed = (1.4 + Math.random() * 3.2) * ratio;
      const maxLife = 50 + Math.random() * 35;
      sparks.current.push({
        x: x * ratio,
        y: y * ratio,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: (1 + Math.random() * 1.6) * ratio,
        colour: SPARK_COLOURS[i % SPARK_COLOURS.length],
        life: maxLife,
        maxLife,
      });
    }
    if (!frame.current && loop.current) frame.current = requestAnimationFrame(loop.current);
  }, [enabled]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * ratio;
      canvas.height = canvas.clientHeight * ratio;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [canvasRef]);

  return burst;
}

function Diya() {
  return (
    <svg className="patakhas-diya" viewBox="0 0 80 64" aria-hidden="true" focusable="false">
      <ellipse className="patakhas-diya__glow" cx="40" cy="20" rx="22" ry="20" />
      <path className="patakhas-diya__flame" d="M40 4C46 14 47 22 40 30 33 22 34 14 40 4Z" />
      <path className="patakhas-diya__flame-core" d="M40 14C43 19 43 23 40 27 37 23 37 19 40 14Z" />
      <path className="patakhas-diya__bowl" d="M6 34H74C72 50 58 60 40 60 22 60 8 50 6 34Z" />
      <path className="patakhas-diya__rim" d="M6 34H74" />
      <path className="patakhas-diya__dots" d="M20 44h.01M30 48h.01M40 49h.01M50 48h.01M60 44h.01" />
    </svg>
  );
}

export default function PatakhasAssembleStory() {
  const reduceMotion = useReducedMotion();
  const canvasRef = useRef(null);
  const heroRef = useRef(null);
  const burst = usePatakhas(canvasRef, !reduceMotion);

  // One burst on arrival, so people see the sky is interactive.
  useEffect(() => {
    if (reduceMotion) return undefined;
    const timer = window.setTimeout(() => {
      const hero = heroRef.current;
      if (hero) burst(hero.clientWidth * 0.78, hero.clientHeight * 0.32);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [burst, reduceMotion]);

  function handleSkyTap(event) {
    const box = heroRef.current.getBoundingClientRect();
    burst(event.clientX - box.left, event.clientY - box.top);
  }

  function handleSkyKey(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    const hero = heroRef.current;
    burst(hero.clientWidth * (0.2 + Math.random() * 0.6), hero.clientHeight * (0.2 + Math.random() * 0.3));
  }

  return (
    <div className="patakhas">
      <section
        ref={heroRef}
        className="patakhas-hero"
        aria-labelledby="patakhas-title"
        onPointerDown={reduceMotion ? undefined : handleSkyTap}
      >
        <canvas ref={canvasRef} className="patakhas-hero__sky" aria-hidden="true" />
        <div className="patakhas-garland" aria-hidden="true">
          {Array.from({ length: GARLAND_FLOWERS }, (_, i) => {
            const t = i / (GARLAND_FLOWERS - 1);
            const sag = Math.sin(t * Math.PI * 3) ** 2;
            return <span key={i} style={{ left: `${t * 100}%`, top: `${sag * 2.2}rem` }} className={i % 3 === 0 ? "is-yellow" : ""} />;
          })}
        </div>
        <svg className="patakhas-lights" viewBox="0 0 1000 120" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <path d={WIRE_PATH} />
          {Array.from({ length: FAIRY_LIGHTS }, (_, i) => {
            const [x, y] = wirePoint((i + 0.5) / FAIRY_LIGHTS);
            return <circle key={i} cx={x} cy={y} r="5" style={{ animationDelay: `${(i % 6) * 0.35}s` }} />;
          })}
        </svg>
        <div className="patakhas-hero__copy">
          <p className="patakhas-kicker">Club Service · Diwali party</p>
          <h1 id="patakhas-title">Patakhas Assemble</h1>
          <p className="patakhas-lede">
            Our Diwali party, where members came together to celebrate the festival with lots of fun and festive spirit.
          </p>
          {reduceMotion ? null : (
            <button type="button" className="patakhas-hint" onKeyDown={handleSkyKey} onClick={(event) => {
              const box = heroRef.current.getBoundingClientRect();
              burst(box.width * (0.25 + Math.random() * 0.5), box.height * (0.18 + Math.random() * 0.25));
              event.stopPropagation();
            }} onPointerDown={(event) => event.stopPropagation()}>
              Tap the sky to light a patakha
            </button>
          )}
        </div>
      </section>

      <section className="patakhas-photo" aria-label="Group photo">
        <figure>
          <img
            src={PHOTO}
            srcSet={`${PHOTO_SMALL} 800w, ${PHOTO} 1600w`}
            sizes="(max-width: 60rem) 100vw, 60rem"
            width="1600"
            height="1200"
            loading="lazy"
            decoding="async"
            alt="RCPH members in festive Indian outfits posing together in front of a red curtain decorated with marigold garlands and fairy lights"
          />
          <figcaption>Patakhas Assemble · 13 November 2026</figcaption>
        </figure>
      </section>

      <section className="patakhas-evening" aria-labelledby="patakhas-evening-title">
        <h2 id="patakhas-evening-title">The evening</h2>
        <ol>
          {evening.map((item) => (
            <li key={item.title} tabIndex={0}>
              <Diya />
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </li>
          ))}
        </ol>
        <p className="patakhas-credit">Conducted by <strong>Rtr. Harshal Nikam</strong></p>
      </section>
    </div>
  );
}
