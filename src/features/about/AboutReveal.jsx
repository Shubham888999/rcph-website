import { motion, useReducedMotion } from "framer-motion";

export default function AboutReveal({ children, className, labelledBy }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      className={className}
      aria-labelledby={labelledBy}
      initial={reduceMotion ? false : { opacity: 1, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.16 }}
      transition={{ duration: reduceMotion ? 0 : 0.5, ease: "easeOut" }}
    >
      {children}
    </motion.section>
  );
}
