import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import CouncilMemberCard from "./CouncilMemberCard";
import CouncilMemberDetails from "./CouncilMemberDetails";
import useBodColumnCount from "./useBodColumnCount.js";
import BodCoverViewer from "./BodCoverViewer.jsx";
import { getMagazineNavigation } from "./bodMagazineModel.js";
import {
  cancelQueuedCouncilDisclosure,
  chunkCouncilMembers,
  createCouncilDisclosureState,
  finishCouncilDisclosureClose,
  getCouncilDetailRowIndex,
  getCouncilMemberId,
  isCouncilMemberExpandable,
  toggleCouncilDisclosure,
} from "./councilGridModel";

export default function CouncilInteractiveGrid({ members, editorial = false }) {
  const reduceMotion = useReducedMotion();
  const columnCount = useBodColumnCount();
  const [disclosure, setDisclosure] = useState(createCouncilDisclosureState);
  const [coverMember, setCoverMember] = useState(null);
  const triggerRefs = useRef(new Map());
  const { activeMemberId, closing } = disclosure;
  const rows = useMemo(() => chunkCouncilMembers(members, columnCount), [members, columnCount]);
  const activeRowIndex = useMemo(() => getCouncilDetailRowIndex(rows, activeMemberId), [activeMemberId, rows]);
  const activeMember = useMemo(() => members.find((member) => getCouncilMemberId(member) === activeMemberId) || null, [activeMemberId, members]);
  const navigation = getMagazineNavigation(members, activeMemberId, getCouncilMemberId, isCouncilMemberExpandable);

  const toggleMember = useCallback((member) => {
    const memberId = getCouncilMemberId(member);
    setDisclosure((current) => toggleCouncilDisclosure(current, memberId));
  }, []);
  const finishClose = useCallback(() => setDisclosure(finishCouncilDisclosureClose), []);
  const closeProfile = () => {
    if (!activeMember) return;
    const trigger = triggerRefs.current.get(activeMemberId);
    toggleMember(activeMember);
    window.requestAnimationFrame(() => trigger?.focus());
  };

  useEffect(() => {
    if (coverMember || (!activeMemberId && !closing)) return undefined;
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
  }, [activeMemberId, closing, coverMember]);

  return (
    <div className="bod-interactive-grid council-interactive-grid">
      {rows.map((row, rowIndex) => {
        const activeInRow = activeMember && activeRowIndex === rowIndex;
        return (
          <Fragment key={getCouncilMemberId(row[0])}>
            {row.map((member, memberIndex) => {
              const memberId = getCouncilMemberId(member);
              return (
                <CouncilMemberCard key={memberId} member={member} active={memberId === activeMemberId} onToggle={toggleMember} reduceMotion={reduceMotion} editorial={editorial} simpleMotion={columnCount === 1} onViewCover={setCoverMember} index={(rowIndex * columnCount) + memberIndex} buttonRef={(node) => {
                  if (node) triggerRefs.current.set(memberId, node);
                  else triggerRefs.current.delete(memberId);
                }} />
              );
            })}
            <AnimatePresence initial={false} onExitComplete={finishClose}>
              {activeInRow ? <CouncilMemberDetails key={activeMemberId} member={activeMember} reduceMotion={reduceMotion} editorial={editorial} simpleMotion={columnCount === 1} navigation={navigation} columnIndex={row.findIndex(member => getCouncilMemberId(member) === activeMemberId)} columnCount={columnCount} onPrevious={() => navigation.previous && toggleMember(navigation.previous)} onNext={() => navigation.next && toggleMember(navigation.next)} onClose={closeProfile} onViewCover={setCoverMember} /> : null}
            </AnimatePresence>
          </Fragment>
        );
      })}
      {editorial && coverMember ? <BodCoverViewer theme="blueprint" member={coverMember} onClose={() => setCoverMember(null)} /> : null}
    </div>
  );
}
