import { motion, useReducedMotion } from "framer-motion";
import {
  cardReveal,
  headingReveal,
  imageSettle,
  staggerContainer,
} from "./homeMotion";
import { juneAwards, juneNominations } from "./monthlyHighlightData";

function AwardItem({ award, reduceMotion }) {
  return (
    <motion.li
      className={`home-highlight-awards__item home-highlight-awards__item--${award.category}`}
      variants={reduceMotion ? undefined : cardReveal}
    >
      <span className="home-highlight-awards__award-title">
        {award.title}
      </span>

      {award.category === "major" ? (
        <span className="home-highlight-awards__citation-result">
          <strong>Rank 1</strong>
          <span>138 Points</span>
        </span>
      ) : (
        <span className="home-highlight-awards__recipient">
          {award.detail}
        </span>
      )}
    </motion.li>
  );
}

export default function MonthlyHighlight() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      className="home-section home-highlight home-highlight-awards"
      aria-labelledby="monthly-highlight-title"
      variants={reduceMotion ? undefined : staggerContainer}
      initial={reduceMotion ? false : "hidden"}
      whileInView={reduceMotion ? undefined : "visible"}
      viewport={{ once: true, amount: 0.08 }}
    >
      <motion.header
        className="home-highlight-awards__header"
        variants={reduceMotion ? undefined : headingReveal}
      >
        <p className="home-kicker">
          Highlight of the Month · June 2026
        </p>

        <h2 id="monthly-highlight-title">Au Revoir</h2>

        <p className="home-highlight-awards__subtitle">
          District Awards  &amp; Recognitions
          <span>RIY 2025-26</span>
        </p>
      </motion.header>

      <div className="home-highlight-awards__composition">
  <motion.figure
    className="home-highlight-awards__media"
    variants={reduceMotion ? undefined : imageSettle}
  >
    <img
      src="/images/Awards26.webp"
      alt="Rotaract Club of Pune Heritage members at the RIY 2025–26 District Awards Night"
      width="1280"
      height="960"
      loading="lazy"
      decoding="async"
    />

    <span
      className="home-highlight-awards__overlay"
      aria-hidden="true"
    />

    <figcaption>
      <time dateTime="2026-06-28">28 June 2026</time>
      <span>District Awards Night</span>
    </figcaption>
  </motion.figure>

  <motion.div
    className="home-highlight-awards__content"
    variants={reduceMotion ? undefined : staggerContainer}
  >
    <motion.p
      className="home-highlight-awards__intro"
      variants={reduceMotion ? undefined : cardReveal}
    >
      The Rotaract Club of Pune Heritage proudly celebrates a year
      of excellence, impact, and recognition at the District Awards.
    </motion.p>

    <section
      className="home-highlight-awards__ledger"
      aria-labelledby="district-awards-title"
    >
      <motion.h3
        id="district-awards-title"
        variants={reduceMotion ? undefined : cardReveal}
      >
        District Awards &amp; Recognitions
      </motion.h3>

      <motion.ul
        variants={reduceMotion ? undefined : staggerContainer}
      >
        {juneAwards.map((award) => (
          <AwardItem
            key={award.id}
            award={award}
            reduceMotion={reduceMotion}
          />
        ))}
      </motion.ul>
    </section>
  </motion.div>
</div>

<motion.section
  className="home-highlight-awards__nominations"
  aria-labelledby="district-nominations-title"
  variants={reduceMotion ? undefined : cardReveal}
>
  <header className="home-highlight-awards__nominations-header">
    <p className="home-kicker">The year in nomination</p>

    <h3 id="district-nominations-title">
      District Award Nominations
    </h3>

    <p>
      Nine honours celebrating the people, service, leadership,
      and initiatives that shaped our year.
    </p>
  </header>

  <motion.ul
    variants={reduceMotion ? undefined : staggerContainer}
  >
    {juneNominations.map((nomination) => (
      <motion.li
        key={nomination.id}
        variants={reduceMotion ? undefined : cardReveal}
      >
        <span>{nomination.title}</span>
        <strong>{nomination.detail}</strong>
      </motion.li>
    ))}
  </motion.ul>
</motion.section>

<motion.p
  className="home-highlight-awards__closing"
  variants={reduceMotion ? undefined : cardReveal}
>
  These awards and nominations reflect the dedication, passion,
  and commitment of every member who contributed to making the
  year truly remarkable. Every recognition is a testament to the
  legacy built together and the spirit of excellence RCPH carries
  forward.
</motion.p>
    </motion.section>
  );
}