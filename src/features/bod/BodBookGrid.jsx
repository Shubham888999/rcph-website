import { useCallback, useEffect, useRef, useState } from "react";
import { LayoutGroup, useInView, useReducedMotion } from "framer-motion";
import useBodColumnCount from "./useBodColumnCount.js";
import { getBodMemberAvenue } from "./bodGridModel.js";
import { getMagazineNavigation } from "./bodMagazineModel.js";
import { createBookState, finishBookClose, getBookIdentity, selectBook } from "./bodBookModel.js";
import BodBookItem from "./BodBookItem.jsx";
import BodCoverViewer from "./BodCoverViewer.jsx";

export default function BodBookGrid({ members, section = "club" }) {
  const gridRef = useRef(null);
  const activated = useInView(gridRef, { once: true, amount: "some" });
  const reduceMotion = useReducedMotion();
  const phone = useBodColumnCount() === 1;
  const [state, setState] = useState(createBookState);
  const [coverMember, setCoverMember] = useState(null);
  const getId = member => getBookIdentity(member, section);
  const navigation = getMagazineNavigation(members, state.openId, getId);
  const toggle = useCallback(member => setState(current => selectBook(current, getBookIdentity(member, section))), [section]);
  const finishClose = useCallback(id => setState(current => finishBookClose(current, id)), []);
  useEffect(() => {
    if (coverMember || (!state.openId && !state.closingId)) return undefined;
    function escape(event) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (state.openId) {
        const trigger = gridRef.current?.querySelector('[aria-expanded="true"]');
        setState(current => selectBook(current, current.openId));
        trigger?.focus({ preventScroll: true });
      } else setState(current => ({ ...current, queuedId: null }));
    }
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [coverMember, state.openId, state.closingId]);
  return <LayoutGroup id={`bod-books-${section}`}><div ref={gridRef} className={`bod-interactive-grid bod-book-grid bod-book-grid--${section}`}>
    {members.map((member, index) => {
      const id = getId(member);
      return <BodBookItem key={id} id={id} member={member} group={section === "club" ? getBodMemberAvenue(member) : member.councilGroup} index={index} count={members.length} activated={activated} open={state.openId === id} closing={state.closingId === id} reduceMotion={reduceMotion} phone={phone} onToggle={toggle} onClose={() => setState(current => selectBook(current, id))} onClosed={finishClose} onViewCover={setCoverMember} navigation={navigation} onPrevious={() => navigation.previous && toggle(navigation.previous)} onNext={() => navigation.next && toggle(navigation.next)} />;
    })}
  </div>{coverMember ? <BodCoverViewer theme="books" member={coverMember} onClose={() => setCoverMember(null)} /> : null}</LayoutGroup>;
}
