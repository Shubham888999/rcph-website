import { useCallback, useEffect, useRef, useState } from "react";

export const VOX_THEME_REVEAL_URL = "https://www.instagram.com/reel/DbJIe5ltc5l/?igsh=d2VrMHh0dWZ6eGtx";
export const VOX_THEME_REVEAL_EMBED_URL = "https://www.instagram.com/reel/DbJIe5ltc5l/embed";
export const VOX_THEME_REVEAL_OPEN_EVENT = "vox-theme-reveal:open";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "iframe",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

function useIsNarrowViewport() {
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;

    const query = window.matchMedia("(max-width: 48rem)");
    const update = () => setIsNarrow(query.matches);
    update();

    if (query.addEventListener) {
      query.addEventListener("change", update);
      return () => query.removeEventListener("change", update);
    }

    query.addListener?.(update);
    return () => query.removeListener?.(update);
  }, []);

  return isNarrow;
}

export function openVoxThemeReveal(trigger) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(VOX_THEME_REVEAL_OPEN_EVENT, {
    detail: { trigger },
  }));
}

export default function VoxThemeRevealModal() {
  const [open, setOpen] = useState(false);
  const [themeRevealState, setThemeRevealState] = useState("idle");
  const dialogRef = useRef(null);
  const returnFocusRef = useRef(null);
  const revealTimerRef = useRef(null);
  const isNarrowViewport = useIsNarrowViewport();
  const isThemeRevealSpinning = themeRevealState === "spinning";
  const isThemeRevealRevealed = themeRevealState === "revealed";

  const closeModal = useCallback(() => {
    window.clearTimeout(revealTimerRef.current);
    setThemeRevealState("idle");
    setOpen(false);
  }, []);

  function handleRecordRevealClick() {
    if (isThemeRevealSpinning || isThemeRevealRevealed) return;

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduceMotion) {
      setThemeRevealState("revealed");
      return;
    }

    window.clearTimeout(revealTimerRef.current);
    setThemeRevealState("spinning");
    revealTimerRef.current = window.setTimeout(() => {
      setThemeRevealState("revealed");
    }, 2000);
  }

  useEffect(() => {
    function handleOpen(event) {
      returnFocusRef.current = event.detail?.trigger ?? document.activeElement;
      window.clearTimeout(revealTimerRef.current);
      setThemeRevealState("idle");
      setOpen(true);
    }

    window.addEventListener(VOX_THEME_REVEAL_OPEN_EVENT, handleOpen);
    return () => window.removeEventListener(VOX_THEME_REVEAL_OPEN_EVENT, handleOpen);
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = dialogRef.current;
    const focusable = () => [...(dialog?.querySelectorAll(FOCUSABLE_SELECTOR) ?? [])];
    focusable()[0]?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
        return;
      }

      if (event.key !== "Tab" || !dialog) return;
      const items = focusable();
      if (!items.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus?.();
    };
  }, [closeModal, open]);

  useEffect(() => {
    return () => window.clearTimeout(revealTimerRef.current);
  }, []);

  if (!open) return null;

  return (
    <div
      className="vox-theme-modal"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeModal();
      }}
    >
      <section
        ref={dialogRef}
        className="vox-theme-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vox-theme-modal-title"
        aria-describedby="vox-theme-modal-description"
        tabIndex={-1}
      >
        <button
          className="vox-theme-modal__close"
          type="button"
          aria-label="Close VOX theme reveal"
          onClick={closeModal}
        >
          <span aria-hidden="true">x</span>
        </button>

        <div className="vox-theme-modal__header">
          <p className="vox-theme-modal__kicker">Theme Reveal</p>
          <h2 id="vox-theme-modal-title">VOX // '26 Theme Reveal</h2>
          <p id="vox-theme-modal-description">
            Spin the record to cue RCPH's 12th Installation Ceremony theme reveal.
          </p>
        </div>

        {isThemeRevealRevealed ? (
          <div
            className={`vox-theme-modal__reveal${isNarrowViewport ? " vox-theme-modal__reveal--mobile-fallback" : ""}`}
            aria-live="polite"
          >
            <div className="vox-theme-modal__reveal-heading">
              <span>VOX // '26 Theme Reveal</span>
              <strong>Watch the reveal</strong>
            </div>
            {isNarrowViewport ? (
              <div className="vox-theme-modal__mobile-fallback">
                <span>VOX // '26 Theme Reveal</span>
                <p>Instagram controls playback on mobile embeds.</p>
                <p>Open the reel directly for the best experience.</p>
                <a
                  className="button button-primary vox-theme-modal__mobile-fallback-link"
                  href={VOX_THEME_REVEAL_URL}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Open the VOX 2026 theme reveal on Instagram"
                >
                  Open on Instagram
                </a>
              </div>
            ) : (
              <div className="vox-theme-modal__frame-shell">
                <iframe
                  className="vox-theme-modal__frame"
                  src={VOX_THEME_REVEAL_EMBED_URL}
                  title="VOX 2026 theme reveal Instagram Reel"
                  loading="lazy"
                  allow="clipboard-write; encrypted-media; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            className={`vox-theme-modal__record-card${isThemeRevealSpinning ? " vox-theme-modal__record-card--spinning" : ""}`}
            onClick={handleRecordRevealClick}
            aria-label="Spin the VOX 2026 record to reveal the Instagram Reel"
            aria-busy={isThemeRevealSpinning ? "true" : undefined}
            disabled={isThemeRevealSpinning}
          >
            <span className="vox-theme-modal__record" aria-hidden="true">
              <span />
            </span>
            <span className="vox-theme-modal__stage-pass">
              <span role={isThemeRevealSpinning ? "status" : undefined}>
                {isThemeRevealSpinning ? "Spinning the record..." : "Spin the record"}
              </span>
              <strong>{isThemeRevealSpinning ? "Cueing the theme reveal" : "Watch the reveal"}</strong>
            </span>
          </button>
        )}

        {(!isNarrowViewport || !isThemeRevealRevealed) ? (
          <div className="vox-theme-modal__actions">
            <a
              className="button button-primary vox-theme-modal__fallback"
              href={VOX_THEME_REVEAL_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="Open the VOX 2026 theme reveal on Instagram"
            >
              Open on Instagram
            </a>
          </div>
        ) : null}
      </section>
    </div>
  );
}
