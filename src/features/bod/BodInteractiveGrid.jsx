import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import BodMemberCard from "./BodMemberCard";
import BodMemberDetails from "./BodMemberDetails";
import {
  cancelQueuedBodDisclosure,
  chunkBodMembers,
  createBodDisclosureState,
  finishBodDisclosureClose,
  getBodColumnCount,
  getBodDetailRowIndex,
  getBodMemberId,
  toggleBodDisclosure,
} from "./bodGridModel";

export default function BodInteractiveGrid({ members }) {
  const reduceMotion = useReducedMotion();
  const columnCount = getBodColumnCount();
  const [disclosure, setDisclosure] = useState(createBodDisclosureState);
  const triggerRefs = useRef(new Map());
  const { activeMemberId, closing } = disclosure;

  const rows = useMemo(() => chunkBodMembers(members, columnCount), [members, columnCount]);
  const activeRowIndex = useMemo(() => getBodDetailRowIndex(rows, activeMemberId), [activeMemberId, rows]);
  const activeMember = useMemo(
    () => members.find((member) => getBodMemberId(member) === activeMemberId) || null,
    [activeMemberId, members],
  );

  const toggleMember = useCallback((member) => {
    const memberId = getBodMemberId(member);
    setDisclosure((current) => toggleBodDisclosure(current, memberId));
  }, []);

  const finishClose = useCallback(() => {
    setDisclosure(finishBodDisclosureClose);
  }, []);

  useEffect(() => {
    if (!activeMemberId && !closing) return undefined;

    function handleKeyDown(event) {
      if (event.key !== "Escape") return;
      event.preventDefault();

      if (activeMemberId) {
        const trigger = triggerRefs.current.get(activeMemberId);
        setDisclosure((current) => toggleBodDisclosure(current, activeMemberId));
        window.requestAnimationFrame(() => trigger?.focus());
      } else {
        setDisclosure(cancelQueuedBodDisclosure);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeMemberId, closing]);

  return (
    <div className="bod-interactive-grid">
      {rows.map((row, rowIndex) => {
        const activeInRow = activeMember && activeRowIndex === rowIndex;

        return (
          <Fragment key={getBodMemberId(row[0])}>
            {row.map((member, memberIndex) => {
              const memberId = getBodMemberId(member);
              return (
                <BodMemberCard
                  key={memberId}
                  member={member}
                  active={memberId === activeMemberId}
                  onToggle={toggleMember}
                  reduceMotion={reduceMotion}
                  index={(rowIndex * columnCount) + memberIndex}
                  buttonRef={(node) => {
                    if (node) triggerRefs.current.set(memberId, node);
                    else triggerRefs.current.delete(memberId);
                  }}
                />
              );
            })}

            <AnimatePresence initial={false} onExitComplete={finishClose}>
              {activeInRow ? (
                <BodMemberDetails
                  key={activeMemberId}
                  member={activeMember}
                  reduceMotion={reduceMotion}
                />
              ) : null}
            </AnimatePresence>
          </Fragment>
        );
      })}
    </div>
  );
}
