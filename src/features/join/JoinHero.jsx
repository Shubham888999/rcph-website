import { motion, useReducedMotion } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { buildSignupHref, resolveAttribution } from "../auth/signupAttribution";

export default function JoinHero() {
  const reduceMotion = useReducedMotion();
  const attribution = resolveAttribution(useLocation());

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
          <Link className="button button-primary" to={buildSignupHref("prospect", attribution)}>
            Apply to join
          </Link>
          <Link className="button button-secondary" to={buildSignupHref("member", attribution)}>
            Already a member? Request access
          </Link>
          <Link className="button button-secondary" to="/contact">
            Ask a Question
          </Link>
        </div>
      </motion.div>

    </section>
  );
}
