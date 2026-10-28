import { useEffect, useRef } from "react";
import { motion, useIsPresent } from "framer-motion";
import { formatRotaractorName } from "../../utils/memberName";
import { getInstagramProfile } from "./bodGridModel.js";

export default function BodMagazineSpread({ member, detailId, reduceMotion, group, navigation, onPrevious, onNext, onClose, onViewCover }) {
  const sectionRef = useRef(null);
  const present = useIsPresent();
  const instagram = getInstagramProfile(member);
  const name = formatRotaractorName(member.name, true);
  useEffect(() => {
    if (!present) return undefined;
    const timer = setTimeout(() => sectionRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" }), reduceMotion ? 0 : 400);
    return () => clearTimeout(timer);
  }, [present, reduceMotion]);
  return <motion.section ref={sectionRef} id={detailId} className="bod-member-details bod-magazine-spread" aria-labelledby={`${detailId}-title`} style={{ pointerEvents: present ? "auto" : "none" }} initial={reduceMotion ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.34, ease: [0.22, 1, 0.36, 1] }}>
    <motion.div className="bod-magazine-spread__pages" initial={reduceMotion ? false : { rotateX: -5, y: -10 }} animate={{ rotateX: 0, y: 0 }} transition={{ duration: reduceMotion ? 0 : 0.48, ease: "easeOut" }}>
      <div className="bod-magazine-spread__identity"><p className="bod-magazine-label">In conversation</p><h3 id={`${detailId}-title`}>{name}</h3><p className="bod-magazine-spread__role">{member.role}</p>{group ? <p className="bod-magazine-spread__group">{group}</p> : null}{member.context ? <p className="bod-magazine-spread__context">{member.context}</p> : null}<div className="bod-magazine-spread__links">{member.image ? <button type="button" onClick={() => onViewCover(member)}>View full cover ↗</button> : null}{instagram ? <a href={instagram.href} target="_blank" rel="noopener noreferrer">Instagram · {instagram.label} ↗</a> : null}</div></div>
      <div className="bod-magazine-spread__story">{member.responsibility ? <blockquote>{member.responsibility}</blockquote> : null}{member.bio ? <p>{member.bio}</p> : null}</div>
      <nav className="bod-magazine-spread__navigation" aria-label={`Profile navigation for ${name}`}><button type="button" onClick={onPrevious} disabled={!navigation.previous}>← Previous profile</button><span>{navigation.index + 1} / {navigation.count}</span><button type="button" onClick={onNext} disabled={!navigation.next}>Next profile →</button><button type="button" onClick={onClose} aria-label={`Close story for ${name}`}>Close story ×</button></nav>
    </motion.div>
  </motion.section>;
}
