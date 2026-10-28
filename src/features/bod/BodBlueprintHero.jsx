import { motion, useReducedMotion } from "framer-motion";

export default function BodBlueprintHero({ riyLabel = "RIY 2026–27" }) {
  const reduceMotion = useReducedMotion();
  return <section className="bod-hero-react bod-blueprint-hero" aria-labelledby="bod-page-title">
    <div className="bod-hero-react__content">
      <p className="bod-kicker">The Heritage Blueprint <span aria-hidden="true">/</span> {riyLabel}</p>
      <div className="bod-blueprint-hero__title"><h1 id="bod-page-title">Meet the Board</h1><motion.svg viewBox="0 0 180 80" aria-hidden="true" initial={reduceMotion ? false : "hidden"} whileInView="visible" viewport={{ once: true }}><motion.path d="M1 70H179M12 79V1M168 79V1M35 70V14H82V70M82 40H145V14H108V70M26 7H153" variants={{ hidden: { pathLength: 0 }, visible: { pathLength: 1, transition: { duration: 1.2 } } }} /><circle cx="108" cy="40" r="11" /></motion.svg></div>
      <p className="bod-hero-react__description">The people leading Rotaract Club of Pune Heritage through service, fellowship, growth, and meaningful impact.</p>
      <div className="bod-blueprint-hero__ruler" aria-hidden="true"><span>People</span><span>Purpose</span><span>Heritage</span></div>
    </div>
  </section>;
}
