import { useEffect, useRef } from "react";
import { motion, useIsPresent } from "framer-motion";
import { formatRotaractorName } from "../../utils/memberName";
import { getInstagramProfile } from "./bodGridModel.js";
import { getBlueprintConnectorPosition } from "./bodBlueprintModel.js";

export default function BodBlueprintPanel({ member, detailId, reduceMotion, simpleMotion, group, navigation, onPrevious, onNext, onClose, onViewCover, columnIndex = 0, columnCount = 1 }) {
  const sectionRef = useRef(null);
  const present = useIsPresent();
  const instagram = getInstagramProfile(member);
  const name = formatRotaractorName(member.name, true);
  const instant = reduceMotion || simpleMotion;
  const stage = { hidden: { opacity: 0, y: instant ? 0 : 12 }, visible: { opacity: 1, y: 0, transition: { duration: instant ? 0 : 0.3 } } };
  useEffect(() => {
    if (!present) return undefined;
    const timer = setTimeout(() => sectionRef.current?.scrollIntoView({ behavior: instant ? "auto" : "smooth", block: "nearest" }), instant ? 0 : 450);
    return () => clearTimeout(timer);
  }, [present, instant]);

  return <motion.section ref={sectionRef} id={detailId} className="bod-member-details bod-blueprint-panel" aria-labelledby={`${detailId}-title`} style={{ "--bod-blueprint-port": getBlueprintConnectorPosition(columnIndex, columnCount), pointerEvents: present ? "auto" : "none" }} initial={reduceMotion ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: instant ? 0 : 0.3 }}>
    <motion.div className="bod-blueprint-panel__plan" initial={reduceMotion ? false : "hidden"} animate="visible" variants={{ hidden: {}, visible: { transition: { delayChildren: instant ? 0 : 0.2, staggerChildren: instant ? 0 : 0.12 } } }}>
      <span className="bod-blueprint-panel__port" aria-hidden="true" />
      <motion.div className="bod-blueprint-panel__identity bod-blueprint-stage" variants={stage}>
        <p className="bod-blueprint-label">01 / The person</p>
        <h3 id={`${detailId}-title`}>{name}</h3>
        <p className="bod-blueprint-panel__role">{member.role}</p>
        {group ? <p className="bod-blueprint-panel__context">{group}</p> : null}
        {member.context ? <p className="bod-blueprint-panel__context">{member.context}</p> : null}
        <div className="bod-blueprint-panel__links">{member.image ? <button type="button" onClick={() => onViewCover(member)}>View full cover ↗</button> : null}{instagram ? <a href={instagram.href} target="_blank" rel="noopener noreferrer">Instagram · {instagram.label} ↗</a> : null}</div>
      </motion.div>
      <motion.div className="bod-blueprint-panel__story bod-blueprint-stage" variants={stage}>
        <p className="bod-blueprint-label">02 / Their story</p>
        {member.responsibility ? <p className="bod-blueprint-panel__summary">{member.responsibility}</p> : null}
        {member.bio ? <p className="bod-blueprint-panel__bio">{member.bio}</p> : null}
      </motion.div>
      <motion.nav className="bod-blueprint-panel__navigation bod-blueprint-stage" variants={stage} aria-label={`Profile navigation for ${name}`}>
        <button type="button" onClick={onPrevious} disabled={!navigation.previous}>← Previous profile</button><span>{navigation.index + 1} / {navigation.count}</span><button type="button" onClick={onNext} disabled={!navigation.next}>Next profile →</button><button type="button" onClick={onClose} aria-label={`Close profile for ${name}`}>Close profile ×</button>
      </motion.nav>
    </motion.div>
  </motion.section>;
}
