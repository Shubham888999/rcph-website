import { motion, useReducedMotion } from "framer-motion";

export default function FaqHero() {
  const reduceMotion = useReducedMotion();
  return (
    <motion.section
      className="faq-hero"
      aria-labelledby="faq-page-title"
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
    >
      <motion.p className="faq-kicker" variants={reduceMotion ? undefined : reveal}>RCPH Guide &amp; Answers</motion.p>
      <motion.h1 id="faq-page-title" variants={reduceMotion ? undefined : reveal}>Frequently Asked Questions</motion.h1>
      <motion.div className="faq-hero__support" variants={reduceMotion ? undefined : reveal}>
        <p>Everything about joining, participating, events, membership, club identity, and getting in touch with RCPH.</p>
      </motion.div>
      <motion.span className="faq-hero__rule" aria-hidden="true" variants={reduceMotion ? undefined : lineReveal} />
    </motion.section>
  );
}

const reveal = {
  hidden: { opacity: 1, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.48, ease: [0.22, 1, 0.36, 1] } },
};

const lineReveal = {
  hidden: { scaleX: 0.12 },
  visible: { scaleX: 1, transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] } },
};
