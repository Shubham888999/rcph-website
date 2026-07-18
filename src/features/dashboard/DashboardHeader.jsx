import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { getPositionLabels } from "./accessHubModel";
import { getRoleLabel } from "./dashboardPresentationModel";
import { formatRotaractorName } from "../../utils/memberName";

export default function DashboardHeader({ profile, mode, access, onEditProfile, onSignOut }) {
  const reduceMotion = useReducedMotion();
  const name = formatRotaractorName(profile.name || profile.memberName || (mode === "prospect" ? "Prospect" : "RCPH Member"), mode === "prospect" ? { role: "prospect" } : profile);
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
  {mode === "prospect" ? (
    <>
      <span className="dashboard-masthead__welcome-line">Welcome,</span>
      <span className="dashboard-masthead__member-name">{name}</span>
    </>
  ) : (
    <>
      <span className="dashboard-masthead__member-name">{name}’s</span>
      <span className="dashboard-masthead__title-line">Club Pulse</span>
    </>
  )}
</motion.h1>
        <motion.p className="dashboard-masthead__role" variants={reduceMotion ? undefined : mastheadItem}>{identity}</motion.p>
        <motion.p className="dashboard-masthead__context" variants={reduceMotion ? undefined : mastheadItem}>
          {mode === "prospect"
            ? "Your path to becoming an RCPH member,one step at a time."
            : "Your attendance, activity, and upcoming club events in one personal view."}
        </motion.p>
        {access?.hasWebsiteDirectorPosition && access?.hasPresidentAuthority ? (
          <motion.p className="dashboard-masthead__authority" variants={reduceMotion ? undefined : mastheadItem}>
            Server-verified Website Director authority is active. Your stored role remains unchanged.
          </motion.p>
        ) : null}
      </div>

      <motion.nav aria-label="Dashboard actions" variants={reduceMotion ? undefined : mastheadItem}>
        <button type="button" onClick={onEditProfile}>Edit profile</button>
        <Link to="/access">Access Hub</Link>
        <Link to="/">Public homepage</Link>
        <Link to="/website-guide">Website Guide</Link>
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
