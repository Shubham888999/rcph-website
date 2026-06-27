import { motion, useReducedMotion } from "framer-motion";

export default function BodHero() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="bod-hero-react" aria-labelledby="bod-page-title">
      <motion.div
        initial={reduceMotion ? false : { opacity: 1, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.6, ease: "easeOut" }}
      >
        <p className="bod-kicker">Leadership · RIY 2025–26</p>
        <h1 id="bod-page-title">Board of Directors 2025–2026</h1>
        <p>
          Meet the Board of Directors of Rotaract Club of Pune Heritage,
          RID 3131.
        </p>
      </motion.div>
    </section>
  );
}
