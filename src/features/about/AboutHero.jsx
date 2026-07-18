import { motion, useReducedMotion } from "framer-motion";

export default function AboutHero() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="about-hero" aria-labelledby="about-page-title">
      <motion.div
        className="about-hero__copy"
        initial={reduceMotion ? false : { opacity: 1, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.6, ease: "easeOut" }}
      >
        <p className="about-kicker">Our story · Our identity · Our purpose</p>
        <h1 id="about-page-title">
          About
          <span className="about-hero__club-name">
            Rotaract Club of Pune Heritage
          </span>
        </h1>
        <p>
          A youth-led community in Pune where service, leadership, fellowship,
          and a proud connection to the city’s heritage come together.
        </p>
      </motion.div>
    </section>
  );
}
