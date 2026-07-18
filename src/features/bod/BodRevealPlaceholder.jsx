import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  BOD_REVEAL_PLACEHOLDER_TITLE,
  BOD_REVEAL_POSITIONS,
  BOD_REVEAL_POSITIONS_REGION_ID,
  createBodRevealPlaceholderState,
  getBodRevealPlaceholderLabel,
  getBodRevealPositionLabel,
  getBodRevealPositionText,
  getBodRevealPositionsRegionLabel,
  toggleBodRevealPlaceholder,
} from "./bodRevealPlaceholderModel";

export default function BodRevealPlaceholder({ showPositionLabels = false }) {
  const reduceMotion = useReducedMotion();
  const [reveal, setReveal] = useState(createBodRevealPlaceholderState);
  const { expanded } = reveal;

  return (
    <section
      id="club-leadership"
      className="bod-reveal-placeholder"
      aria-labelledby="bod-reveal-placeholder-title"
    >
      <div className={`bod-reveal-stage ${expanded ? "is-expanded" : ""}`}>
        <div className="bod-reveal-stage__center">
          <motion.article
            className={`bod-reveal-card ${expanded ? "is-expanded" : ""}`}
            initial={reduceMotion ? false : { opacity: 1, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: reduceMotion ? 0 : 0.45 }}
          >
            <div className="bod-reveal-card__portrait" aria-hidden="true">
              <span className="bod-reveal-card__question" aria-hidden="true">?</span>
            </div>

            <div className="bod-reveal-card__body">
              <div className="bod-reveal-card__summary">
                <h2 id="bod-reveal-placeholder-title">
                  {BOD_REVEAL_PLACEHOLDER_TITLE}
                </h2>

                <button
                  className="bod-reveal-card__toggle"
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={BOD_REVEAL_POSITIONS_REGION_ID}
                  aria-label={getBodRevealPlaceholderLabel(expanded)}
                  onClick={() => setReveal(toggleBodRevealPlaceholder)}
                >
                  <span className="bod-reveal-card__plus" aria-hidden="true">
                    <span />
                    <span />
                  </span>
                </button>
              </div>
            </div>
          </motion.article>
        </div>

        <ol
          id={BOD_REVEAL_POSITIONS_REGION_ID}
          className="bod-reveal-orbit"
          aria-label={getBodRevealPositionsRegionLabel(showPositionLabels)}
          hidden={!expanded}
        >
          {BOD_REVEAL_POSITIONS.map((position, index) => (
            <li
              key={`mystery-${index}`}
              className="bod-reveal-position"
              style={{
                "--position-index": index,
                "--position-angle": `${(index * 22.5) - 90}deg`,
                "--position-counter-angle": `${90 - (index * 22.5)}deg`,
                "--position-delay": `${index * 22}ms`,
              }}
            >
              <article
                className="bod-reveal-position__card"
                aria-label={getBodRevealPositionLabel(position, index, { showPositionLabels })}
              >
                <span className="bod-reveal-position__question" aria-hidden="true">
                  ?
                </span>
                {getBodRevealPositionText(position, { showPositionLabels }) ? <h3>{getBodRevealPositionText(position, { showPositionLabels })}</h3> : null}
              </article>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
