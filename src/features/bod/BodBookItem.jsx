import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { formatRotaractorName } from "../../utils/memberName";
import BodBookPage from "./BodBookPage.jsx";

export default function BodBookItem({ member, id, group, index, count, activated, open, closing, reduceMotion, phone, onToggle, onClose, onClosed, onViewCover, navigation, onPrevious, onNext }) {
  const itemRef = useRef(null);
  const triggerRef = useRef(null);
  const started = useRef(false);
  const controls = useAnimationControls();
  const [interactive, setInteractive] = useState(false);
  const expanded = open || closing;
  const name = formatRotaractorName(member.name, true);
  const pageId = `bod-book-page-${id}`;
  useEffect(() => {
    if (!activated) return undefined;
    let cancelled = false;
    const firstDeal = !started.current;
    started.current = true;
    const item = itemRef.current;
    async function deal() {
      if (firstDeal && item && !reduceMotion) {
        const stackY = 24 - item.offsetTop;
        controls.set({ x: (item.parentElement.clientWidth - item.offsetWidth) / 2 - item.offsetLeft, y: stackY + 50, rotate: ((index % 5) - 2) * (phone ? 1 : 3), scale: 0.9, opacity: 0 });
        await controls.start({ y: stackY, scale: 0.94, opacity: 1, transition: { duration: phone ? 0.15 : 0.28 } });
        if (cancelled) return;
      }
      await controls.start({ x: 0, y: 0, rotate: 0, scale: 1, opacity: 1, transition: { duration: reduceMotion ? 0 : phone ? 0.35 : 0.7, delay: firstDeal && !reduceMotion ? 0.14 + Math.min(index * (phone ? 0.025 : 0.065), phone ? 0.15 : 0.65) : 0, ease: [0.22, 1, 0.36, 1] } });
      if (!cancelled) setInteractive(true);
    }
    void deal();
    return () => { cancelled = true; };
  }, [activated, controls, index, phone, reduceMotion]);
  function close() {
    onClose();
    triggerRef.current?.focus({ preventScroll: true });
  }
  return <motion.div ref={itemRef} layout={reduceMotion ? false : "position"} className={`bod-book-item${expanded ? " is-expanded" : ""}${open ? " is-open" : ""}`} initial={{ opacity: 0 }} animate={controls} transition={{ layout: { duration: reduceMotion ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] } }} style={{ zIndex: expanded ? count + 5 : interactive ? 1 : count - index }} inert={!interactive ? true : undefined}>
    <div className="bod-book-cover">
      <button ref={triggerRef} type="button" className="bod-book-cover__trigger" aria-expanded={open} aria-controls={pageId} aria-label={`${open ? "Close" : "Open"} book for ${name}, ${member.role}`} onClick={() => onToggle(member)}>
        <span className="bod-book-cover__artwork">{member.image ? <img src={member.image} alt={`${name}, ${member.role}`} loading={index < 4 ? "eager" : "lazy"} decoding="async" /> : <span className="bod-book-cover__placeholder">{member.photoLabel || "Cover unavailable"}</span>}</span>
        <span className="bod-book-cover__caption"><span className="bod-book-cover__role">{member.role}</span><span className="bod-book-cover__name">{name}</span>{group ? <span className="bod-book-cover__group">{group}</span> : null}<span className="bod-book-cover__action">{open ? "Close book" : "Open story"}<span aria-hidden="true">{open ? "−" : "+"}</span></span></span>
      </button>
      {member.image ? <button type="button" className="bod-book-cover__view" onClick={() => onViewCover(member)} aria-label={`View full-size cover for ${name}`}>View cover ↗</button> : null}
      <span className="bod-book-cover__spine" aria-hidden="true" />
    </div>
    <AnimatePresence onExitComplete={() => onClosed(id)}>{open ? <BodBookPage key={id} member={member} id={pageId} group={group} reduceMotion={reduceMotion} phone={phone} navigation={navigation} onPrevious={onPrevious} onNext={onNext} onClose={close} onViewCover={onViewCover} triggerRef={triggerRef} /> : null}</AnimatePresence>
  </motion.div>;
}
