import { motion, useReducedMotion } from "framer-motion";

export default function HomeHero() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="home-hero" aria-labelledby="home-hero-title">
      <div className="home-hero__media">
        <img
          className="home-hero__image"
          src="/images/group.webp"
          alt="Members of Rotaract Club of Pune Heritage gathered for a club group photograph"
          width="2048"
          height="1004"
          fetchPriority="high"
          decoding="sync"
        />
      </div>

      <div className="home-hero__overlay" aria-hidden="true" />

      <div className="home-hero__content">
        <div className="home-hero__title-stage">
          <motion.span
            className="home-hero__light"
            aria-hidden="true"
            initial={reduceMotion ? false : { opacity: 0.55, scaleX: 0.18 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: reduceMotion ? 0 : 0.68, ease: [0.22, 1, 0.36, 1] }}
          />
          <motion.h1
            id="home-hero-title"
            initial={reduceMotion ? false : { opacity: 1, filter: "blur(2px)", letterSpacing: "-0.065em" }}
            animate={{ opacity: 1, filter: "blur(0px)", letterSpacing: "-0.05em" }}
            transition={{ duration: reduceMotion ? 0 : 0.55, delay: reduceMotion ? 0 : 0.16 }}
          >
            Rotaract Club of Pune Heritage
          </motion.h1>
        </div>

        <motion.p
          className="home-kicker home-hero__kicker"
          initial={reduceMotion ? false : { opacity: 1, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.4, delay: reduceMotion ? 0 : 0.48 }}
        >
          RID 3131 <span aria-hidden="true">|</span> ZONE 4
        </motion.p>

<motion.p
  className="home-hero__motto"
  initial={reduceMotion ? false : { opacity: 1, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{
    duration: reduceMotion ? 0 : 0.4,
    delay: reduceMotion ? 0 : 0.66,
  }}
>
  <span className="home-hero__theme-name">Lakshya</span>
  <span className="home-hero__theme-tagline">
    Shaping Aim Through Experience.
  </span>
</motion.p>
      </div>
    </section>
  );
}
