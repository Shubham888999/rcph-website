import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { getPositionLabels } from "./accessHubModel";
import { getRoleLabel } from "./dashboardPresentationModel";

export default function DashboardHeader({ profile, mode, access, onSignOut }) {
  const reduceMotion = useReducedMotion();
  const name = profile.name || profile.memberName || (mode === "prospect" ? "Prospect" : "RCPH Member");
  const canonicalPositions = getPositionLabels(profile.positionKeys);
  const legacyPosition = profile.memberPosition || profile.clubPosition;
  const positions = canonicalPositions.length ? canonicalPositions : legacyPosition ? [legacyPosition] : [];
  const identity = positions.length ? positions.join(" · ") : getRoleLabel(profile.role);

  return (
    <motion.header
      className={`dashboard-masthead dashboard-masthead--${mode}`}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
    >
      <div className="dashboard-masthead__identity">
        <motion.p className="dashboard-eyebrow" variants={reduceMotion ? undefined : mastheadItem}>
          Rotaract Club of Pune Heritage
        </motion.p>
        <motion.h1 variants={reduceMotion ? undefined : mastheadItem}>
          {mode === "prospect" ? `Welcome, ${name}` : `${name}’s Club Pulse`}
        </motion.h1>
        <motion.p className="dashboard-masthead__role" variants={reduceMotion ? undefined : mastheadItem}>{identity}</motion.p>
        <motion.p className="dashboard-masthead__context" variants={reduceMotion ? undefined : mastheadItem}>
          {mode === "prospect"
            ? "Your path to becoming an RCPH member—one verified step at a time."
            : "Your attendance, activity, and upcoming club events in one personal view."}
        </motion.p>
        {access?.hasWebsiteDirectorPosition && access?.hasPresidentAuthority ? (
          <motion.p className="dashboard-masthead__authority" variants={reduceMotion ? undefined : mastheadItem}>
            Server-verified Website Director authority is active. Your stored role remains unchanged.
          </motion.p>
        ) : null}
      </div>

      <motion.nav aria-label="Dashboard actions" variants={reduceMotion ? undefined : mastheadItem}>
        <Link to="/access">Access Hub</Link>
        <Link to="/">Public homepage</Link>
        <button type="button" onClick={onSignOut}>Sign out</button>
      </motion.nav>
      <motion.span className="dashboard-masthead__rule" aria-hidden="true" variants={reduceMotion ? undefined : ruleReveal} />
    </motion.header>
  );
}

const mastheadItem = {
  hidden: { opacity: 1, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.48, ease: [0.22, 1, 0.36, 1] } },
};

const ruleReveal = {
  hidden: { scaleX: 0.15 },
  visible: { scaleX: 1, transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] } },
};
