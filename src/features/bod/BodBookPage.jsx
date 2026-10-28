import { useEffect, useRef } from "react";
import { motion, useIsPresent } from "framer-motion";
import { formatRotaractorName } from "../../utils/memberName";
import { getInstagramProfile } from "./bodGridModel.js";

export default function BodBookPage({ member, id, group, reduceMotion, phone, navigation, onPrevious, onNext, onClose, onViewCover, triggerRef }) {
  const present = useIsPresent();
  const pageRef = useRef(null);
  const titleRef = useRef(null);
  const name = formatRotaractorName(member.name, true);
  const instagram = getInstagramProfile(member);
  useEffect(() => {
    if (!present) return undefined;
    const timer = setTimeout(() => {
      const page = pageRef.current;
      if (!page) return;
      const header = document.querySelector(".public-header") || document.querySelector("header");
      const inset = (header?.getBoundingClientRect().height || 76) + 24;
      const rect = page.getBoundingClientRect();
      if (rect.top < inset || rect.top > window.innerHeight - 160) {
        window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - inset), behavior: reduceMotion ? "instant" : "smooth" });
      }
    }, reduceMotion ? 0 : 420);
    return () => clearTimeout(timer);
  }, [present, reduceMotion]);
  function focusPage() {
    if (!present || document.querySelector('[role="dialog"]')) return;
    if (document.activeElement === document.body || document.activeElement === triggerRef.current) titleRef.current?.focus({ preventScroll: true });
  }
  return <motion.aside ref={pageRef} id={id} className="bod-book-page" aria-labelledby={`${id}-title`} initial={reduceMotion ? false : { rotateY: phone ? 0 : -105, opacity: phone ? 0 : 1 }} animate={{ rotateY: 0, opacity: 1 }} exit={{ rotateY: reduceMotion || phone ? 0 : -105, opacity: reduceMotion || phone ? 0 : 1 }} transition={{ duration: reduceMotion ? 0 : phone ? 0.25 : 0.7, delay: present && !reduceMotion && !phone ? 0.12 : 0, ease: [0.22, 1, 0.36, 1] }} onAnimationComplete={focusPage} style={{ pointerEvents: present ? "auto" : "none" }} inert={!present ? true : undefined}>
    <header className="bod-book-page__heading"><p className="bod-book-eyebrow">The person behind the cover</p><h3 ref={titleRef} tabIndex={-1} id={`${id}-title`}>{name}</h3><p className="bod-book-page__role">{member.role}</p>{group ? <p className="bod-book-page__context">{group}</p> : null}{member.context ? <p className="bod-book-page__context">{member.context}</p> : null}</header>
    <div className="bod-book-page__story" tabIndex={0} role="region" aria-label={`Story of ${name}`}>
      {member.responsibility ? <p className="bod-book-page__summary">{member.responsibility}</p> : null}
      {member.bio ? <p className="bod-book-page__bio">{member.bio}</p> : null}
      <div className="bod-book-page__links">{instagram ? <a href={instagram.href} target="_blank" rel="noopener noreferrer">Instagram · {instagram.label} ↗</a> : null}{member.image ? <button type="button" onClick={() => onViewCover(member)}>View full cover ↗</button> : null}</div>
    </div>
    <footer className="bod-book-page__footer"><nav aria-label={`Profile navigation for ${name}`}><button type="button" disabled={!navigation.previous} onClick={onPrevious} aria-label="Previous profile">←</button><span>{navigation.index + 1} / {navigation.count}</span><button type="button" disabled={!navigation.next} onClick={onNext} aria-label="Next profile">→</button></nav><button type="button" onClick={onClose} aria-label={`Close book for ${name}`}>Close book ×</button></footer>
  </motion.aside>;
}
