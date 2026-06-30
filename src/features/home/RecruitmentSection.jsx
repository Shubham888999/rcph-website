import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { copyReveal, headingReveal, lineReveal, staggerContainer } from "./homeMotion";

export default function RecruitmentSection() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      className="home-section home-recruitment"
      aria-labelledby="recruitment-title"
      variants={reduceMotion ? undefined : staggerContainer}
      initial={reduceMotion ? false : "hidden"}
      whileInView={reduceMotion ? undefined : "visible"}
      viewport={{ once: true, amount: 0.2 }}
    >
      <div className="home-recruitment__content">
        <motion.h2 variants={reduceMotion ? undefined : headingReveal} id="recruitment-title">
          Membership for RIY 2026 - 2027 is Open
        </motion.h2>

        <motion.div
          className="home-recruitment__divider"
          aria-hidden="true"
          variants={reduceMotion ? undefined : lineReveal}
        />

        <motion.p variants={reduceMotion ? undefined : copyReveal}>
          Rotaract Club of Pune Heritage is welcoming students and young
          professionals who want to be part of community service, leadership,
          professional development, fellowship, and meaningful collaborations
          in Pune.
        </motion.p>

        <motion.p variants={reduceMotion ? undefined : copyReveal}>
          If you want to join a youth-led service club, volunteer for impactful
          projects, build friendships, or explore leadership opportunities,
          this is the right time to connect with RCPH.
        </motion.p>

        <motion.div className="home-actions" variants={reduceMotion ? undefined : copyReveal}>
          <Link className="button button-primary" to="/join">
            Join RCPH
          </Link>

          <Link className="button button-secondary" to="/contact">
            Contact Us
          </Link>

          <Link className="button button-secondary" to="/faq">
            Read FAQ
          </Link>

          <Link className="button button-secondary" to="/projects">
            Explore Projects
          </Link>
        </motion.div>
      </div>
    </motion.section>
  );
}
