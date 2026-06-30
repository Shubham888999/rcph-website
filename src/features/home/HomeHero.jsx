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
          decoding="async"
        />
      </div>

      <div className="home-hero__overlay" aria-hidden="true" />

      <motion.div
  className="home-hero__content"
  initial={reduceMotion ? false : { opacity: 1, y: 14 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{
    duration: reduceMotion ? 0 : 0.6,
    ease: "easeOut",
  }}
>
  <h1 id="home-hero-title">Rotaract Club of Pune Heritage</h1>

  <p className="home-kicker home-hero__kicker">
    RID 3131 <span aria-hidden="true">|</span> ZONE 4
  </p>

  <p className="home-hero__motto">
    Create. Connect. Contribute.
  </p>
</motion.div>
    </section>
  );
}