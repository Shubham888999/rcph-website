import { motion, useReducedMotion } from "framer-motion";

export default function ContactHero() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="contact-hero" aria-labelledby="contact-page-title">
      <motion.div
        className="contact-hero__content"
        initial={reduceMotion ? false : { opacity: 1, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.6, ease: "easeOut" }}
      >
        <p className="contact-kicker">Collaborate with RCPH</p>
        <h1 id="contact-page-title">Contact Rotaract Club of Pune Heritage</h1>
        <p>
          Want to collaborate, volunteer, invite RCPH for a session, or know
          more about joining the club? We would love to hear from NGOs,
          colleges, sponsors, Rotary and Rotaract clubs, students, and community
          partners.
        </p>
      </motion.div>

      <motion.div
        className="contact-hero__motif"
        initial={reduceMotion ? false : { opacity: 1, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.5 }}
        aria-hidden="true"
      >
        <span>Let’s</span>
        <strong>Connect</strong>
      </motion.div>
    </section>
  );
}
