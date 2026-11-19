import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import useAccessibleDialog from "../../bod-tools/useAccessibleDialog";
import MensDayDoodles from "./MensDayDoodles";
import { headingReveal, staggerContainer, cardReveal } from "../homeMotion";
import { SECTION_ID, notes, notePreview, sectionDetails } from "./mensDayNotesData";
import "../../../styles/components/mens-day.css";

const READ_KEY = "rcph-mens-day-read";
const PHONE_QUERY = "(max-width: 40rem)";
const PAGE_SIZE = 4;
const CYCLE_MS = 5000;
const PAGE_COUNT = Math.ceil(notes.length / PAGE_SIZE);

function subscribePhone(callback) {
  const media = window.matchMedia(PHONE_QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function useIsPhone() {
  return useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE_QUERY).matches, () => false);
}

function loadRead() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(READ_KEY) || "[]");
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveRead(read) {
  try {
    window.localStorage.setItem(READ_KEY, JSON.stringify([...read]));
  } catch {
    // Reading still works when storage is blocked; the board just forgets.
  }
}

function NoteDialog({ index, onClose, onMove }) {
  const note = notes[index];
  const dialogRef = useAccessibleDialog({ open: true, onClose });
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    function handleArrow(event) {
      if (event.key === "ArrowRight") onMove(1);
      if (event.key === "ArrowLeft") onMove(-1);
    }
    document.addEventListener("keydown", handleArrow);
    return () => document.removeEventListener("keydown", handleArrow);
  }, [onMove]);

  // Rendered on <body> so the open note sits above the site header and later sections.
  return createPortal(
    <div className="mens-note-dialog" onClick={onClose}>
      <div
        ref={dialogRef}
        className="mens-note-dialog__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mens-note-dialog-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <motion.article
          key={note.id}
          className={`mens-note-sheet mens-paper--${note.paper}`}
          initial={reduceMotion ? false : { opacity: 0, rotateX: -70, y: -20 }}
          animate={reduceMotion ? undefined : { opacity: 1, rotateX: 0, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="mens-note-sheet__pin" aria-hidden="true" />
          <p className="mens-note-sheet__to" id="mens-note-dialog-title">For {note.name}</p>
          <div className="mens-note-sheet__body">
            {note.paragraphs.map((paragraph, i) => <p key={i}>{paragraph}</p>)}
          </div>
          <p className="mens-note-sheet__sign">From someone at Heritage</p>
        </motion.article>

        <div className="mens-note-dialog__controls">
          <button type="button" onClick={() => onMove(-1)} aria-label="Previous note">‹ Previous</button>
          <span aria-live="polite">{index + 1} of {notes.length}</span>
          <button type="button" onClick={() => onMove(1)} aria-label="Next note">Next ›</button>
        </div>
        <button type="button" className="mens-note-dialog__close" onClick={onClose} aria-label="Close note">×</button>
        <button type="button" className="mens-note-dialog__done" onClick={onClose}>Close note</button>
      </div>
    </div>,
    document.body,
  );
}

export default function MensDayNotesSection() {
  const reduceMotion = useReducedMotion();
  const [openIndex, setOpenIndex] = useState(null);
  const [read, setRead] = useState(loadRead);
  const isPhone = useIsPhone();
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(0);

  // Phones show four notes at a time and fade to the next four on their own,
  // until someone asks to see all of them.
  useEffect(() => {
    if (!isPhone || expanded || reduceMotion || openIndex !== null) return undefined;
    const timer = window.setInterval(() => setPage((current) => (current + 1) % PAGE_COUNT), CYCLE_MS);
    return () => window.clearInterval(timer);
  }, [isPhone, expanded, reduceMotion, openIndex]);

  const cycling = isPhone && !expanded;
  const visible = cycling ? notes.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE) : notes;

  const open = useCallback((index) => {
    setOpenIndex(index);
    setRead((current) => {
      if (current.has(notes[index].id)) return current;
      const next = new Set(current).add(notes[index].id);
      saveRead(next);
      return next;
    });
  }, []);

  const move = useCallback((step) => {
    setOpenIndex((current) => {
      if (current === null) return current;
      const next = (current + step + notes.length) % notes.length;
      setRead((existing) => {
        if (existing.has(notes[next].id)) return existing;
        const updated = new Set(existing).add(notes[next].id);
        saveRead(updated);
        return updated;
      });
      return next;
    });
  }, []);

  const close = useCallback(() => setOpenIndex(null), []);

  function openRandom() {
    const unread = notes.map((note, i) => (read.has(note.id) ? -1 : i)).filter((i) => i >= 0);
    const pool = unread.length ? unread : notes.map((_, i) => i);
    open(pool[Math.floor(Math.random() * pool.length)]);
  }

  return (
    <motion.section
      id={SECTION_ID}
      className="home-section mens-day"
      aria-labelledby="mens-day-title"
      variants={reduceMotion ? undefined : staggerContainer}
      initial={reduceMotion ? false : "hidden"}
      whileInView={reduceMotion ? undefined : "visible"}
      viewport={{ once: true, amount: 0.05 }}
    >
      <motion.header className="mens-day__header" variants={reduceMotion ? undefined : headingReveal}>
        <p className="home-kicker">{sectionDetails.eyebrow}</p>
        <h2 id="mens-day-title">{sectionDetails.title}</h2>
        <div className="mens-day__actions">
          <button type="button" className="mens-paper-button" onClick={openRandom}>Open a random note</button>
          <span className="mens-day__count">
            {notes.length} notes · {read.size ? `${read.size} read` : "tap one to unfold it"}
          </span>
        </div>
      </motion.header>

      <div
        className={`mens-board${cycling ? " is-collapsed" : ""}`}
      >
        {isPhone ? null : <MensDayDoodles />}
        <AnimatePresence mode="wait" initial={false}>
          <motion.ul
            key={cycling ? `page-${page}` : "all"}
            className="mens-board__notes"
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -12 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            {visible.map((note) => {
              const index = notes.indexOf(note);
              return (
                <motion.li
                  key={note.id}
                  variants={reduceMotion ? undefined : cardReveal}
                  style={{ "--tilt": `${note.tilt}deg` }}
                >
                  <button
                    type="button"
                    className={`mens-note mens-paper--${note.paper}${read.has(note.id) ? " is-read" : ""}`}
                    onClick={() => open(index)}
                    aria-label={`Open the note for ${note.name}`}
                  >
                    <span className="mens-note__pin" aria-hidden="true" />
                    <span className="mens-note__to">For {note.name}</span>
                    <span className="mens-note__preview">{notePreview(note)}</span>
                    <span className="mens-note__hint">{read.has(note.id) ? "Read again" : "Tap to unfold"}</span>
                  </button>
                </motion.li>
              );
            })}
          </motion.ul>
        </AnimatePresence>

        {cycling ? (
          <div className="mens-board__more">
            <div className="mens-board__pager">
              {Array.from({ length: PAGE_COUNT }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  className={i === page ? "is-active" : ""}
                  aria-label={`Show notes ${i * PAGE_SIZE + 1} to ${Math.min(notes.length, (i + 1) * PAGE_SIZE)}`}
                  aria-pressed={i === page}
                  onClick={() => setPage(i)}
                />
              ))}
            </div>
            <button type="button" className="mens-paper-button" onClick={() => setExpanded(true)}>
              Open more notes
            </button>
          </div>
        ) : null}
      </div>

      {openIndex !== null ? <NoteDialog index={openIndex} onClose={close} onMove={move} /> : null}
    </motion.section>
  );
}
