import { motion, useReducedMotion } from "framer-motion";
import { copyRevealRight, headingReveal, imageSettle, staggerContainer } from "./homeMotion";

export default function MonthlyHighlight() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      className="home-section home-highlight"
      aria-labelledby="monthly-highlight-title"
      variants={reduceMotion ? undefined : staggerContainer}
      initial={reduceMotion ? false : "hidden"}
      whileInView={reduceMotion ? undefined : "visible"}
      viewport={{ once: true, amount: 0.2 }}
    >
      <motion.div className="home-section__heading" variants={reduceMotion ? undefined : headingReveal}>
        <p className="home-kicker">This month at RCPH</p>
        <h2 id="monthly-highlight-title">Highlight of the Month</h2>
      </motion.div>

      <motion.article className="home-highlight-card" variants={reduceMotion ? undefined : staggerContainer}>
        <motion.div className="home-highlight-card__image" variants={reduceMotion ? undefined : imageSettle}>
          <img
            src="/images/DC.webp"
            alt="18th Annual Rotaract District Conference AURION event artwork"
            loading="lazy"
            decoding="async"
          />
        </motion.div>
        <motion.div className="home-highlight-card__copy" variants={reduceMotion ? undefined : copyRevealRight}>
          <p className="home-kicker">District conference</p>
          <h3>18th Annual Rotaract District Conference - AURION</h3>
        </motion.div>
      </motion.article>
    </motion.section>
  );
}
