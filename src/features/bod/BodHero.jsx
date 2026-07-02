import { motion, useReducedMotion } from "framer-motion";
export default function BodHero() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="bod-hero-react" aria-labelledby="bod-page-title">
      <motion.div
        className="bod-hero-react__content"
        initial={reduceMotion ? false : { opacity: 1, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: reduceMotion ? 0 : 0.6,
          ease: "easeOut",
        }}
      >
        <div className="bod-hero-react__copy">
          <p className="bod-kicker">Leadership · RIY 2025–26</p>

          <h1 id="bod-page-title">Meet the Board</h1>

          <span className="bod-hero-react__rule" aria-hidden="true" />

          <p className="bod-hero-react__description">
            The people leading Rotaract Club of Pune Heritage through service,
            fellowship, growth, and meaningful impact.
          </p>



          <a className="bod-hero-react__explore" href="#club-leadership">
            Explore the board
            <span aria-hidden="true">↓</span>
          </a>
        </div>
      </motion.div>
    </section>
  );
}
