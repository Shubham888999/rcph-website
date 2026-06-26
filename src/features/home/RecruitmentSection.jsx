import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";

const opportunities = [
  "Community service",
  "Leadership",
  "Professional development",
  "Fellowship",
  "Collaboration",
];

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
        <p className="home-kicker">Find your place at RCPH</p>
        <h2 id="recruitment-title">Membership for RIY 2026 - 2027 is Open</h2>
        <p>
          RCPH welcomes students and young professionals ready to serve their
          community, grow as leaders, build professional skills, form lasting
          friendships, and collaborate on meaningful projects across Pune.
        </p>

        <ul className="home-opportunity-list" aria-label="Membership opportunities">
          {opportunities.map((opportunity) => (
            <li key={opportunity}>{opportunity}</li>
          ))}
        </ul>

        <div className="home-actions">
          <Link className="button button-primary" to="/join">Join RCPH</Link>
          <Link className="button button-secondary" to="/contact">Contact Us</Link>
          <Link className="button button-secondary" to="/faq">Read FAQ</Link>
          <Link className="button button-secondary" to="/projects">Explore Projects</Link>
        </div>
      </div>
    </motion.section>
  );
}
