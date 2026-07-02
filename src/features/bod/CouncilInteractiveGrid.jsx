import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import CouncilMemberCard from "./CouncilMemberCard";
import CouncilMemberDetails from "./CouncilMemberDetails";
import {
  cancelQueuedCouncilDisclosure,
  chunkCouncilMembers,
  createCouncilDisclosureState,
  finishCouncilDisclosureClose,
  getCouncilDetailRowIndex,
  getCouncilMemberId,
  toggleCouncilDisclosure,
} from "./councilGridModel";

export default function CouncilInteractiveGrid({ members }) {
  const reduceMotion = useReducedMotion();
  const [disclosure, setDisclosure] = useState(createCouncilDisclosureState);
  const triggerRefs = useRef(new Map());
  const { activeMemberId, closing } = disclosure;
  const rows = useMemo(() => chunkCouncilMembers(members), [members]);
  const activeRowIndex = useMemo(() => getCouncilDetailRowIndex(rows, activeMemberId), [activeMemberId, rows]);
  const activeMember = useMemo(() => members.find((member) => getCouncilMemberId(member) === activeMemberId) || null, [activeMemberId, members]);

  const toggleMember = useCallback((member) => {
    const memberId = getCouncilMemberId(member);
    setDisclosure((current) => toggleCouncilDisclosure(current, memberId));
  }, []);
  const finishClose = useCallback(() => setDisclosure(finishCouncilDisclosureClose), []);

  useEffect(() => {
    if (!activeMemberId && !closing) return undefined;
    function handleKeyDown(event) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (activeMemberId) {
        const trigger = triggerRefs.current.get(activeMemberId);
        setDisclosure((current) => toggleCouncilDisclosure(current, activeMemberId));
        window.requestAnimationFrame(() => trigger?.focus());
      } else {
        setDisclosure(cancelQueuedCouncilDisclosure);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeMemberId, closing]);

  return (
    <div className="bod-interactive-grid council-interactive-grid">
      {rows.map((row, rowIndex) => {
        const activeInRow = activeMember && activeRowIndex === rowIndex;
        return (
          <Fragment key={getCouncilMemberId(row[0])}>
            {row.map((member, memberIndex) => {
              const memberId = getCouncilMemberId(member);
              return (
                <CouncilMemberCard key={memberId} member={member} active={memberId === activeMemberId} onToggle={toggleMember} reduceMotion={reduceMotion} index={(rowIndex * 3) + memberIndex} buttonRef={(node) => {
                  if (node) triggerRefs.current.set(memberId, node);
                  else triggerRefs.current.delete(memberId);
                }} />
              );
            })}
            <AnimatePresence initial={false} onExitComplete={finishClose}>
              {activeInRow ? <CouncilMemberDetails key={activeMemberId} member={activeMember} reduceMotion={reduceMotion} /> : null}
            </AnimatePresence>
          </Fragment>
        );
      })}
    </div>
  );
}
