import { useEffect, useRef } from "react";
import { motion, useInView, useIsPresent } from "framer-motion";
import { formatRotaractorName } from "../../utils/memberName";
import { getInstagramProfile } from "./bodGridModel.js";
import { getBlueprintConnectorPosition } from "./bodBlueprintModel.js";

export default function BodBlueprintPanel({ member, detailId, reduceMotion, simpleMotion, group, navigation, onPrevious, onNext, onClose, onViewCover, columnIndex = 0, columnCount = 1 }) {
  const sectionRef = useRef(null);
  const routeRef = useRef(null);
  const routeVisible = useInView(routeRef, { amount: 0.8, once: true });
  const present = useIsPresent();
  const instagram = getInstagramProfile(member);
  const name = formatRotaractorName(member.name, true);
  const instant = reduceMotion || simpleMotion;
  const ready = instant || routeVisible;
  const stage = {
    hidden: { opacity: 0, x: instant ? 0 : 24, clipPath: "inset(0 100% 0 0)" },
    visible: delay => ({ opacity: 1, x: 0, clipPath: "inset(0 0% 0 0)", transition: { duration: instant ? 0 : 0.38, delay: instant ? 0 : delay } }),
  };
  const routeStage = (axis, delay, duration) => ({
    hidden: { [axis]: 0 },
    visible: { [axis]: 1, transition: { duration: instant ? 0 : duration, delay: instant ? 0 : delay, ease: "linear" } },
  });
  useEffect(() => {
    if (!present) return undefined;
    const timer = setTimeout(() => {
      const section = sectionRef.current;
      if (!section) return;
      const header = document.querySelector(".public-header") || document.querySelector("header");
      const inset = (header?.getBoundingClientRect().height || 76) + (simpleMotion ? 96 : 160);
      window.scrollTo({ top: Math.max(0, window.scrollY + section.getBoundingClientRect().top - inset), behavior: instant ? "instant" : "smooth" });
    }, instant ? 0 : 80);
    return () => clearTimeout(timer);
  }, [present, instant, simpleMotion]);

  return <motion.section ref={sectionRef} id={detailId} className="bod-member-details bod-blueprint-panel" aria-labelledby={`${detailId}-title`} style={{ "--bod-blueprint-port": getBlueprintConnectorPosition(columnIndex, columnCount), pointerEvents: present ? "auto" : "none" }} initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: instant ? 0 : 0.18 }}>
    <motion.div initial={instant ? false : "hidden"} animate={ready ? "visible" : "hidden"}>
      <div ref={routeRef} className="bod-blueprint-route" aria-hidden="true">
        <span className="bod-blueprint-route__socket" />
        <motion.span className="bod-blueprint-route__drop" variants={routeStage("scaleY", 0.12, 0.25)} />
        <motion.span className="bod-blueprint-route__cross" variants={routeStage("scaleX", 0.37, 0.35)} />
        <motion.span className="bod-blueprint-route__entry" variants={routeStage("scaleY", 0.72, 0.22)} />
      </div>
      <div className="bod-blueprint-panel__plan">
      <motion.span className="bod-blueprint-panel__frame" aria-hidden="true" variants={{ hidden: { scaleX: 0 }, visible: { scaleX: 1, transition: { duration: instant ? 0 : 0.4, delay: instant ? 0 : 0.85 } } }} />
      <motion.div className="bod-blueprint-panel__identity bod-blueprint-stage" variants={stage} custom={0.95}>
        <p className="bod-blueprint-label">01 / The person</p>
        <h3 id={`${detailId}-title`}>{name}</h3>
        <p className="bod-blueprint-panel__role">{member.role}</p>
        {group ? <p className="bod-blueprint-panel__context">{group}</p> : null}
        {member.context ? <p className="bod-blueprint-panel__context">{member.context}</p> : null}
        <div className="bod-blueprint-panel__links">{member.image ? <button type="button" onClick={() => onViewCover(member)}>View full cover ↗</button> : null}{instagram ? <a href={instagram.href} target="_blank" rel="noopener noreferrer">Instagram · {instagram.label} ↗</a> : null}</div>
      </motion.div>
      <div className="bod-blueprint-panel__story">
        <motion.div className="bod-blueprint-stage" variants={stage} custom={1.15}>
        <p className="bod-blueprint-label">02 / Their story</p>
        {member.responsibility ? <p className="bod-blueprint-panel__summary">{member.responsibility}</p> : null}
        </motion.div>
        {member.bio ? <motion.p className="bod-blueprint-panel__bio bod-blueprint-stage" variants={stage} custom={1.35}>{member.bio}</motion.p> : null}
      </div>
      <motion.nav className="bod-blueprint-panel__navigation bod-blueprint-stage" variants={stage} custom={1.5} aria-label={`Profile navigation for ${name}`}>
        <button type="button" onClick={onPrevious} disabled={!navigation.previous}>← Previous profile</button><span>{navigation.index + 1} / {navigation.count}</span><button type="button" onClick={onNext} disabled={!navigation.next}>Next profile →</button><button type="button" onClick={onClose} aria-label={`Close profile for ${name}`}>Close profile ×</button>
      </motion.nav>
      </div>
    </motion.div>
  </motion.section>;
}
