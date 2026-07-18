import { motion } from "framer-motion";
import BoardSparkles from "./BoardSparkles";
import { getBodAccentCategory, getBodMemberAvenue, getBodMemberId } from "./bodGridModel";
import { formatRotaractorName } from "../../utils/memberName";

export default function BodMemberCard({ member, active, onToggle, reduceMotion, buttonRef, index }) {
  const memberId = getBodMemberId(member);
  const avenue = getBodMemberAvenue(member);
  const accent = getBodAccentCategory(member.role);
  const detailId = `bod-member-details-${memberId}`;
  const displayName = formatRotaractorName(member.name, true);

  return (
    <motion.article
      className={`bod-member-card bod-member-card--${accent} ${active ? "is-active" : ""}`}
      initial={reduceMotion ? false : { opacity: 1, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: reduceMotion ? 0 : 0.45, delay: reduceMotion ? 0 : Math.min(index * 0.045, 0.32) }}
    >
      <button
        ref={buttonRef}
        className="bod-member-card__trigger"
        type="button"
        aria-expanded={active}
        aria-controls={detailId}
        aria-label={`${active ? "Close" : "Open"} profile for ${displayName}, ${member.role}`}
        onClick={() => onToggle(member)}
      >
        <span className="bod-member-card__portrait">
          {member.image ? (
            <img
              src={member.image}
              alt={`${displayName}, ${member.role} at Rotaract Club of Pune Heritage`}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span className="bod-member-card__photo-placeholder">
              {member.photoLabel || "Protected photo"}
            </span>
          )}
          <span className="bod-member-card__shade" aria-hidden="true" />
        </span>

        <span className="bod-member-card__closed-copy">
          <span className="bod-member-card__role">{member.role}</span>
          <span className="bod-member-card__name">{displayName}</span>
          {avenue ? <span className="bod-member-card__avenue">{avenue}</span> : null}
        </span>

        <span className="bod-member-card__toggle" aria-hidden="true">
          <span />
          <span />
        </span>
      </button>

      <BoardSparkles active={active} reduceMotion={reduceMotion} />
    </motion.article>
  );
}
