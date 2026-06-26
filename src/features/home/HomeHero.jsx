import { motion, useReducedMotion } from "framer-motion";

export default function HomeHero() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="home-hero" aria-labelledby="home-hero-title">
      <motion.div
        className="home-hero__content"
        initial={reduceMotion ? false : { opacity: 1, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.6, ease: "easeOut" }}
      >
        <p className="home-kicker">RID 3131 <span aria-hidden="true">|</span> ZONE 4</p>
        <h1 id="home-hero-title">Rotaract Club of Pune Heritage</h1>
        <p className="home-hero__motto">Create. Connect. Contribute.</p>
      </motion.div>

      <motion.div
        className="home-hero__mark"
        initial={reduceMotion ? false : { opacity: 1, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.5, delay: reduceMotion ? 0 : 0.15 }}
        aria-hidden="true"
      >
        <img src="/images/logo3.webp" alt="" />
      </motion.div>
    </section>
  );
}
