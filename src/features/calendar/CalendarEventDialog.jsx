import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useId, useRef } from "react";
import { formatEventDate } from "../events/eventModel";
import { getAvenue } from "./avenues.js";

const FOCUSABLE_SELECTOR = "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

export default function CalendarEventDialog({ selection, onClose }) {
  const reduceMotion = useReducedMotion();
  const dialogRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  const event = selection?.event;

  useEffect(() => {
    if (!selection) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = dialogRef.current;
    dialog?.querySelector("button")?.focus();

    function handleKeyDown(keyEvent) {
      if (keyEvent.key === "Escape") {
        keyEvent.preventDefault();
        onClose();
        return;
      }
      if (keyEvent.key !== "Tab" || !dialog) return;
      const focusable = [...dialog.querySelectorAll(FOCUSABLE_SELECTOR)];
      if (!focusable.length) {
        keyEvent.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (keyEvent.shiftKey && document.activeElement === first) {
        keyEvent.preventDefault();
        last.focus();
      } else if (!keyEvent.shiftKey && document.activeElement === last) {
        keyEvent.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      selection.trigger?.focus();
    };
  }, [onClose, selection]);

  if (!event) return null;
  const avenueNames = event.avenues.length
    ? event.avenues.map((code) => getAvenue(code).label).join(", ")
    : "No avenue listed";

  return (
    <motion.div
      className="calendar-dialog-backdrop"
      initial={reduceMotion ? false : { opacity: 1 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.18 }}
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.target === mouseEvent.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="calendar-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <button
          type="button"
          className="calendar-dialog__close"
          onClick={onClose}
          aria-label="Close event details"
        >
          ×
        </button>
        <p className="calendar-kicker">Event details</p>
        <h2 id={titleId}>{event.name}</h2>
        <p className="calendar-dialog__date"><strong>Date:</strong> {formatEventDate(event)}</p>
        <p className="calendar-dialog__avenues"><strong>Avenues:</strong> {avenueNames}</p>
        <p id={descriptionId} className="calendar-dialog__description">
          {event.description || "No description is currently available for this event."}
        </p>
      </div>
    </motion.div>
  );
}
