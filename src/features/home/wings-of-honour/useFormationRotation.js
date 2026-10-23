import { useCallback, useEffect, useRef, useState } from "react";

const TICK_MS = 200;

export function wrapIndex(index, count) {
  return ((index % count) + count) % count;
}

// Position of an item in the queue behind the lead: 0 is the lead, count - 1 has just left.
export function queuePosition(index, lead, count) {
  return wrapIndex(index - lead, count);
}

// Drives the looping formation: timed auto advance, step-by-step travel to a chosen item,
// and pauses while the visitor is interacting, the section is off screen or the tab is hidden.
export default function useFormationRotation({ count, active, reduceMotion, timing }) {
  const [lead, setLead] = useState(0);
  const [target, setTarget] = useState(null);
  const [userPaused, setUserPaused] = useState(false);
  const leadRef = useRef(0);
  const targetRef = useRef(null);
  const blockersRef = useRef(new Set());
  const holdUntilRef = useRef(0);
  const nextAutoAtRef = useRef(0);
  const nextStepAtRef = useRef(0);

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

  const clearTarget = useCallback(() => {
    targetRef.current = null;
    setTarget(null);
  }, []);

  const goTo = useCallback(
    (index) => {
      clearTarget();
      applyLead(index);
      hold();
    },
    [applyLead, clearTarget, hold],
  );

  const step = useCallback((delta) => goTo(leadRef.current + delta), [goTo]);

  // Moves forward one item at a time until `index` leads, so the formation keeps rotating in order.
  const travelTo = useCallback(
    (index) => {
      if (reduceMotion) {
        goTo(index);
        return;
      }

      nextStepAtRef.current = 0;
      targetRef.current = wrapIndex(index, count);
      setTarget(targetRef.current);
    },
    [count, goTo, reduceMotion],
  );

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

      if (targetRef.current !== null) {
        if (blockersRef.current.has("viewer") || now < nextStepAtRef.current) return;

        if (leadRef.current === targetRef.current) {
          clearTarget();
          hold();
          return;
        }

        applyLead(leadRef.current + 1);
        nextStepAtRef.current = now + timing.stepMs;
        return;
      }

      if (reduceMotion || userPaused || blocked) return;
      if (now < holdUntilRef.current || now < nextAutoAtRef.current) return;

      applyLead(leadRef.current + 1);
      nextAutoAtRef.current = now + timing.autoAdvanceMs;
    }, TICK_MS);

    return () => window.clearInterval(intervalId);
  }, [active, applyLead, clearTarget, count, hold, reduceMotion, timing.autoAdvanceMs, timing.stepMs, userPaused]);

  return {
    lead,
    target,
    userPaused,
    goTo,
    step,
    travelTo,
    hold,
    setBlocker,
    toggleUserPaused,
  };
}
