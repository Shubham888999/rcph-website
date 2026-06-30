import { motion, useReducedMotion } from "framer-motion";

export default function MonthlyHighlight() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      className="home-section"
      aria-labelledby="monthly-highlight-title"
      initial={reduceMotion ? false : { opacity: 1, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: reduceMotion ? 0 : 0.5 }}
    >
      <div className="home-section__heading">
        <p className="home-kicker">This month at RCPH</p>
        <h2 id="monthly-highlight-title">Highlight of the Month</h2>
      </div>

      <article className="home-highlight-card">
        <div className="home-highlight-card__image">
          <img
            src="/images/DC.webp"
            alt="18th Annual Rotaract District Conference AURION event artwork"
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className="home-highlight-card__copy">
          <p className="home-kicker">District conference</p>
          <h3>18th Annual Rotaract District Conference - AURION</h3>
        </div>
      </article>
    </motion.section>
  );
}
