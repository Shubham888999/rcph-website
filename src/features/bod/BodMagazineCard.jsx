import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { formatRotaractorName } from "../../utils/memberName";
import { magazinePointerPosition } from "./bodMagazineModel.js";

export default function BodMagazineCard({ member, active, onToggle, onViewCover, reduceMotion, buttonRef, index, detailId, group, expandable = true }) {
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const springX = useSpring(pointerX, { stiffness: 180, damping: 28 });
  const springY = useSpring(pointerY, { stiffness: 180, damping: 28 });
  const rotateY = useTransform(springX, [-0.5, 0.5], [-3, 3]);
  const rotateX = useTransform(springY, [-0.5, 0.5], [3, -3]);
  const name = formatRotaractorName(member.name, true);
  function pointerMove(event) {
    if (reduceMotion || event.pointerType !== "mouse" || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const point = magazinePointerPosition(event, event.currentTarget);
    pointerX.set(point.x);
    pointerY.set(point.y);
  }
  const contents = <>
    <motion.span className="bod-magazine-cover" style={reduceMotion ? undefined : { rotateX, rotateY, transformPerspective: 1000 }}>
      {member.image ? <img src={member.image} alt={`${name}, ${member.role}`} loading={index < 4 ? "eager" : "lazy"} decoding="async" /> : <span className="bod-magazine-no-photo">{member.photoLabel || "Cover unavailable"}</span>}
      <span className="bod-magazine-cover__edge" aria-hidden="true" />
      <span className="bod-magazine-cover__fold" aria-hidden="true" />
    </motion.span>
    <span className="bod-magazine-caption">
      <span className="bod-magazine-caption__number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
      <span className="bod-magazine-caption__role">{member.role}</span>
      <span className="bod-magazine-caption__name">{name}</span>
      {group ? <span className="bod-magazine-caption__group">{group}</span> : null}
      {expandable ? <span className="bod-magazine-caption__read">{active ? "Close story" : "Read story"}<span aria-hidden="true">{active ? "−" : "↗"}</span></span> : null}
    </span>
  </>;
  return <motion.article className={`bod-member-card bod-magazine-card${active ? " is-active" : ""}`} initial={reduceMotion ? false : { opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.08 }} transition={{ duration: reduceMotion ? 0 : 0.48, delay: reduceMotion ? 0 : (index % 4) * 0.06 }} onPointerMove={pointerMove} onPointerLeave={() => { pointerX.set(0); pointerY.set(0); }}>
    {expandable ? <button ref={buttonRef} type="button" className="bod-magazine-card__profile" aria-expanded={active} aria-controls={detailId} aria-label={`${active ? "Close" : "Read"} story for ${name}, ${member.role}`} onClick={() => onToggle(member)}>{contents}</button> : <div className="bod-magazine-card__profile">{contents}</div>}
    {member.image ? <button type="button" className="bod-magazine-card__view" onClick={() => onViewCover(member)} aria-label={`View full-size cover for ${name}`}>View cover <span aria-hidden="true">↗</span></button> : null}
  </motion.article>;
}
