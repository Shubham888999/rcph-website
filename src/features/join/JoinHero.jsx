import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";

export default function JoinHero() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="join-hero" aria-labelledby="join-page-title">
      <motion.div
        className="join-hero__content"
        initial={reduceMotion ? false : { opacity: 1, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.6, ease: "easeOut" }}
      >
        <h1 id="join-page-title">
          Join
          <span className="join-hero__club-name">
            Rotaract Club of Pune Heritage
          </span>
        </h1>
        <p>
          Rotaract Club of Pune Heritage welcomes students and young
          professionals who want to create impact, connect with people, and
          contribute to community service in Pune under RID 3131.
        </p>
        <div className="join-actions">
          <Link className="button button-primary" to="/login">
            Create Member Account
          </Link>
          <Link className="button button-secondary" to="/contact">
            Ask a Question
          </Link>
        </div>
      </motion.div>

    </section>
  );
}
