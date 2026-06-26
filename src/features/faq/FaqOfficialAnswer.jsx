import { motion, useReducedMotion } from "framer-motion";

export default function FaqOfficialAnswer() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      className="faq-section faq-official-answer-react"
      aria-labelledby="faq-official-title"
      initial={reduceMotion ? false : { opacity: 1, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: reduceMotion ? 0 : 0.5 }}
    >
      <p className="faq-kicker">The short answer</p>
      <h2 id="faq-official-title">What is Rotaract Club of Pune Heritage?</h2>
      <p>
        Rotaract Club of Pune Heritage, also known as RCPH, is a community-based
        Rotaract club in Pune under Rotaract District 3131, Zone 4. Chartered in
        2015 and sponsored by Rotary Club of Pune Heritage, RCPH brings together
        students and young professionals for community service, leadership,
        professional development, fellowship, and collaboration.
      </p>
    </motion.section>
  );
}
