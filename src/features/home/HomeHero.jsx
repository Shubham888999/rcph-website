import { motion, useReducedMotion } from "framer-motion";

export default function HomeHero() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="home-hero" aria-labelledby="home-hero-title">
      <motion.figure
        className="home-hero__photo"
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: reduceMotion ? 0 : 0.7,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <img
          className="home-hero__image"
          src="/images/vox26.jpeg"
          alt="Members of Rotaract Club of Pune Heritage gathered for a club group photograph"
          width="2048"
          height="1004"
          fetchPriority="high"
          decoding="async"
        />
      </motion.figure>

      <motion.div
        className="home-hero__editorial"
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: reduceMotion ? 0 : 0.62,
          delay: reduceMotion ? 0 : 0.16,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <div className="home-hero__eyebrow">
          <span>RIY 2026-27</span>
          <span className="home-hero__eyebrow-rule" aria-hidden="true" />
          <span>Rotaract District 3131</span>
        </div>

        <h1 id="home-hero-title">Rotaract Club of Pune Heritage</h1>

        <p className="home-hero__meta">
          <span>RID 3131</span>
          <span className="home-hero__meta-separator" aria-hidden="true">
            •
          </span>
          <span>Zone 4</span>
        </p>

        <div className="home-hero__theme">
          <span className="home-hero__theme-name">Lakshya</span>
          <span className="home-hero__theme-tagline">
            Shaping Aim Through Experience.
          </span>
        </div>
      </motion.div>
    </section>
  );
}