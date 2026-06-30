import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";

export default function RecruitmentSection() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      className="home-section home-recruitment"
      aria-labelledby="recruitment-title"
      initial={reduceMotion ? false : { opacity: 1, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: reduceMotion ? 0 : 0.5 }}
    >
      <div className="home-recruitment__content">
        <h2 id="recruitment-title">
          Membership for RIY 2026 - 2027 is Open
        </h2>

        <div className="home-recruitment__divider" aria-hidden="true" />

        <p>
          Rotaract Club of Pune Heritage is welcoming students and young
          professionals who want to be part of community service, leadership,
          professional development, fellowship, and meaningful collaborations
          in Pune.
        </p>

        <p>
          If you want to join a youth-led service club, volunteer for impactful
          projects, build friendships, or explore leadership opportunities,
          this is the right time to connect with RCPH.
        </p>

        <div className="home-actions">
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
        </div>
      </div>
    </motion.section>
  );
}