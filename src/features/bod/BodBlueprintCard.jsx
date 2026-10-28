import { motion } from "framer-motion";
import { formatRotaractorName } from "../../utils/memberName";

export default function BodBlueprintCard({ member, active, onToggle, onViewCover, reduceMotion, simpleMotion, buttonRef, index, detailId, group, expandable = true }) {
  const name = formatRotaractorName(member.name, true);
  const instant = reduceMotion || simpleMotion;
  const contents = <>
    <span className="bod-blueprint-card__register"><span>Profile / {String(index + 1).padStart(2, "0")}</span><span aria-hidden="true">RCPH ↗</span></span>
    <span className="bod-blueprint-card__artwork">
      {member.image ? <img src={member.image} alt={`${name}, ${member.role}`} loading={index < 4 ? "eager" : "lazy"} decoding="async" /> : <span className="bod-blueprint-card__no-photo">{member.photoLabel || "Photo unavailable"}</span>}
    </span>
    <span className="bod-blueprint-card__caption">
      <span className="bod-blueprint-card__role">{member.role}</span>
      <span className="bod-blueprint-card__name">{name}</span>
      {group ? <span className="bod-blueprint-card__group">{group}</span> : null}
      {expandable ? <span className="bod-blueprint-card__action">{active ? "Close profile" : "Explore profile"}<span aria-hidden="true">{active ? "−" : "+"}</span></span> : null}
    </span>
  </>;

  return <motion.article className={`bod-member-card bod-blueprint-card${active ? " is-active" : ""}`} initial={reduceMotion ? false : "hidden"} whileInView="visible" viewport={{ once: true, amount: 0.08 }} variants={{ hidden: { opacity: 0, y: instant ? 0 : 12 }, visible: { opacity: 1, y: 0, transition: { duration: instant ? 0.15 : 0.4, delay: instant ? 0 : (index % 4) * 0.05 } } }}>
    <span className="bod-blueprint-outline" aria-hidden="true">{["top", "right", "bottom", "left"].map((edge, edgeIndex) => {
      const scale = edge === "top" || edge === "bottom" ? "scaleX" : "scaleY";
      return <motion.span key={edge} className={`bod-blueprint-outline__edge bod-blueprint-outline__edge--${edge}`} variants={{ hidden: { [scale]: instant ? 1 : 0 }, visible: { [scale]: 1, transition: { duration: instant ? 0 : 0.24, delay: instant ? 0 : edgeIndex * 0.18 + (index % 4) * 0.05 } } }} />;
    })}</span>
    <span className="bod-blueprint-card__cross bod-blueprint-card__cross--start" aria-hidden="true" />
    <span className="bod-blueprint-card__cross bod-blueprint-card__cross--end" aria-hidden="true" />
    {expandable ? <button ref={buttonRef} type="button" className="bod-blueprint-card__profile" aria-expanded={active} aria-controls={detailId} aria-label={`${active ? "Close" : "Open"} profile for ${name}, ${member.role}`} onClick={() => onToggle(member)}>{contents}</button> : <div className="bod-blueprint-card__profile">{contents}</div>}
    {member.image ? <button type="button" className="bod-blueprint-card__view" onClick={() => onViewCover(member)} aria-label={`View full-size cover for ${name}`}>View cover ↗</button> : null}
    {active ? <motion.span className="bod-blueprint-card__connector" aria-hidden="true" initial={instant ? false : { scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: instant ? 0 : 0.25 }} /> : null}
  </motion.article>;
}
