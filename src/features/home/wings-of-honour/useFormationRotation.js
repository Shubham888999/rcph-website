import { useCallback, useEffect, useRef, useState } from "react";

const TICK_MS = 200;

export function wrapIndex(index, count) {
  return ((index % count) + count) % count;
}

// Position of an item in the queue behind the lead: 0 is the lead, count - 1 has just left.
export function queuePosition(index, lead, count) {
  return wrapIndex(index - lead, count);
}

// Drives the looping formation: timed auto advance that pauses while the visitor is interacting,
// the section is off screen or the tab is hidden.
export default function useFormationRotation({ count, active, reduceMotion, timing }) {
  const [lead, setLead] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const leadRef = useRef(0);
  const blockersRef = useRef(new Set());
  const holdUntilRef = useRef(0);
  const nextAutoAtRef = useRef(0);

  const applyLead = useCallback(
    (index) => {
      const next = wrapIndex(index, count);
      leadRef.current = next;
      setLead(next);
    },
    [count],
  );

  const hold = useCallback(
    (ms = timing.holdAfterInteractionMs) => {
      holdUntilRef.current = Date.now() + ms;
      nextAutoAtRef.current = holdUntilRef.current;
    },
    [timing.holdAfterInteractionMs],
  );

  const goTo = useCallback(
    (index) => {
      applyLead(index);
      hold();
    },
    [applyLead, hold],
  );

  const step = useCallback((delta) => goTo(leadRef.current + delta), [goTo]);

  const setBlocker = useCallback((name, isBlocking) => {
    if (isBlocking) blockersRef.current.add(name);
    else blockersRef.current.delete(name);
  }, []);

  const toggleUserPaused = useCallback(() => {
    setUserPaused((paused) => !paused);
    nextAutoAtRef.current = Date.now() + 1200;
  }, []);

  useEffect(() => {
    if (!active || count < 2) return undefined;

    nextAutoAtRef.current = Math.max(nextAutoAtRef.current, Date.now() + timing.autoAdvanceMs);

    const intervalId = window.setInterval(() => {
      const now = Date.now();
      const blocked = blockersRef.current.size > 0 || document.visibilityState === "hidden";

      if (reduceMotion || userPaused || blocked) return;
      if (now < holdUntilRef.current || now < nextAutoAtRef.current) return;

      applyLead(leadRef.current + 1);
      nextAutoAtRef.current = now + timing.autoAdvanceMs;
    }, TICK_MS);

    return () => window.clearInterval(intervalId);
  }, [active, applyLead, count, reduceMotion, timing.autoAdvanceMs, userPaused]);

  return {
    lead,
    userPaused,
    goTo,
    step,
    hold,
    setBlocker,
    toggleUserPaused,
  };
}
