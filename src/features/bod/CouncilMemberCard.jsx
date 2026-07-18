import { motion } from "framer-motion";
import BoardSparkles from "./BoardSparkles";
import { getCouncilMemberId, isCouncilMemberExpandable } from "./councilGridModel";
import { formatRotaractorName } from "../../utils/memberName";

export default function CouncilMemberCard({ member, active, onToggle, reduceMotion, buttonRef, index }) {
  const memberId = getCouncilMemberId(member);
  const expandable = isCouncilMemberExpandable(member);
  const detailId = `council-member-details-${memberId}`;
  const displayName = formatRotaractorName(member.name, true);
  const cardContents = (
    <>
      <span className="bod-member-card__portrait">
        {member.image ? (
          <img
            src={member.image}
            alt={`${displayName}, ${member.role}`}
            loading="lazy"
            decoding="async"
            onError={(event) => { event.currentTarget.hidden = true; }}
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
        {member.councilGroup ? <span className="bod-member-card__avenue council-member-card__group">{member.councilGroup}</span> : null}
      </span>
      {expandable ? <span className="bod-member-card__toggle" aria-hidden="true"><span /><span /></span> : null}
    </>
  );

  return (
    <motion.article
      className={`bod-member-card bod-member-card--specialist council-member-card ${active ? "is-active" : ""}`}
      initial={reduceMotion ? false : { opacity: 1, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: reduceMotion ? 0 : 0.45, delay: reduceMotion ? 0 : Math.min(index * 0.045, 0.32) }}
    >
      {expandable ? (
        <button ref={buttonRef} className="bod-member-card__trigger council-member-card__trigger" type="button" aria-expanded={active} aria-controls={detailId} aria-label={`${active ? "Close" : "Open"} profile for ${displayName}, ${member.role}`} onClick={() => onToggle(member)}>
          {cardContents}
        </button>
      ) : <div className="bod-member-card__trigger council-member-card__static">{cardContents}</div>}
      <BoardSparkles active={active} reduceMotion={reduceMotion} />
    </motion.article>
  );
}
