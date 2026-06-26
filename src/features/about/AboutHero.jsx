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
        <h1 id="about-page-title">About Rotaract Club of Pune Heritage</h1>
        <p>
          A youth-led community in Pune where service, leadership, fellowship,
          and a proud connection to the city’s heritage come together.
        </p>
      </motion.div>

      <motion.div
        className="about-hero__emblem"
        initial={reduceMotion ? false : { opacity: 1, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.5 }}
      >
        <img
          src="/images/about/aboutuslogo.png"
          alt="Rotaract Club of Pune Heritage logo featuring the red Marathi Tilak Pagdi"
        />
      </motion.div>
    </section>
  );
}
