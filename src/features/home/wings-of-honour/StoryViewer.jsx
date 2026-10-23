import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const SWIPE_CLOSE_PX = 90;

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function describe(item) {
  if (item.type === "banner") {
    return { title: item.title, detail: item.meta.join(" · ") };
  }

  return { title: `Rotaract Club of ${item.club}`, detail: item.district };
}

function SpeakerIcon({ muted }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" />
      {muted ? (
        <>
          <path d="m16 9 5 6" />
          <path d="m21 9-5 6" />
        </>
      ) : (
        <>
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 5.5a9 9 0 0 1 0 13" />
        </>
      )}
    </svg>
  );
}

// React only applies `muted` on first render, so sound is set on the element directly.
// Playback starts with sound; if the browser refuses, it falls back to muted.
function StoryVideo({ item, soundOn, onAutoplayMuted, onProgress, onEnded }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !soundOn;
    video.play().catch(() => {
      video.muted = true;
      onAutoplayMuted();
      video.play().catch(() => {});
    });
    // Start playback once per story; later sound changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = !soundOn;
  }, [soundOn]);

  return (
    <video
      ref={videoRef}
      className="woh-viewer__media"
      src={item.video}
      poster={item.poster || undefined}
      aria-label={item.alt}
      playsInline
      preload="auto"
      onTimeUpdate={(event) => {
        const { currentTime, duration } = event.currentTarget;
        if (duration > 0) onProgress(currentTime / duration);
      }}
      onEnded={onEnded}
    />
  );
}

function StoryMedia({ item, soundOn, onAutoplayMuted, onProgress, onEnded }) {
  if (item.video) {
    return (
      <StoryVideo
        item={item}
        soundOn={soundOn}
        onAutoplayMuted={onAutoplayMuted}
        onProgress={onProgress}
        onEnded={onEnded}
      />
    );
  }

  if (item.poster) {
    return <img className="woh-viewer__media" src={item.poster} alt={item.alt} decoding="async" />;
  }

  return (
    <div className="woh-viewer__placeholder" role="img" aria-label={item.alt}>
      <span className="woh-viewer__placeholder-word">{item.type === "banner" ? item.title : item.club}</span>
      <span className="woh-viewer__placeholder-note">
        {item.type === "banner" ? "Event banner placeholder" : "Story video placeholder"}
      </span>
    </div>
  );
}

export default function StoryViewer({ items, index, timing, onIndexChange, onClose }) {
  const item = items[index];
  const { title, detail } = describe(item);
  const timedDuration = item.type === "banner" ? timing.bannerStoryMs : timing.placeholderStoryMs;
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const progressRef = useRef(null);
  const swipeRef = useRef({ startY: null, swiped: false });
  const [soundOn, setSoundOn] = useState(true);

  const showNext = useCallback(() => {
    if (index >= items.length - 1) onClose();
    else onIndexChange(index + 1);
  }, [index, items.length, onClose, onIndexChange]);

  const showPrevious = useCallback(() => {
    if (index > 0) onIndexChange(index - 1);
  }, [index, onIndexChange]);

  // Focus returns to the lead card through the section once the viewer closes.
  useEffect(() => {
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;

    root.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    return () => {
      root.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        showNext();
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showPrevious();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(dialogRef.current.querySelectorAll("button:not(:disabled), [href]"));
      if (focusable.length === 0) return;

      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, showNext, showPrevious]);

  function updateVideoProgress(fraction) {
    if (progressRef.current) progressRef.current.style.transform = `scaleX(${fraction})`;
  }

  function handlePointerDown(event) {
    swipeRef.current = { startY: event.clientY, swiped: false };
  }

  function handlePointerUp(event) {
    const { startY } = swipeRef.current;
    if (startY !== null && event.clientY - startY > SWIPE_CLOSE_PX) {
      swipeRef.current.swiped = true;
      onClose();
    }
    swipeRef.current.startY = null;
  }

  function handleTap(action) {
    if (swipeRef.current.swiped) return;
    action();
  }

  return createPortal(
    <div className="woh-viewer">
      <div
        ref={dialogRef}
        className={`woh-viewer__frame${item.type === "banner" ? " woh-viewer__frame--banner" : ""}`}
        style={{ "--woh-tone": item.tone }}
        role="dialog"
        aria-modal="true"
        aria-label="Wings of Honour stories"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <StoryMedia
          key={item.id}
          item={item}
          soundOn={soundOn}
          onAutoplayMuted={() => setSoundOn(false)}
          onProgress={updateVideoProgress}
          onEnded={showNext}
        />

        <div className="woh-viewer__bars" aria-hidden="true">
          {items.map((entry, barIndex) => {
            const isCurrent = barIndex === index;
            const isTimed = isCurrent && !item.video;

            return (
              <span
                key={`${entry.id}-${isCurrent ? index : "idle"}`}
                className={`woh-viewer__bar${barIndex < index ? " is-done" : ""}${isTimed ? " is-timed" : ""}`}
                style={isTimed ? { "--woh-duration": `${timedDuration}ms` } : undefined}
              >
                <span
                  ref={isCurrent ? progressRef : undefined}
                  className="woh-viewer__bar-fill"
                  onAnimationEnd={isTimed ? showNext : undefined}
                />
              </span>
            );
          })}
        </div>

        <div className="woh-viewer__top">
          <p className="woh-viewer__who">
            {title}
            <small>{detail}</small>
          </p>
          <div className="woh-viewer__buttons">
            {item.video ? (
              <button
                type="button"
                className="woh-viewer__button"
                aria-label={soundOn ? "Mute" : "Unmute"}
                onClick={() => setSoundOn((on) => !on)}
              >
                <SpeakerIcon muted={!soundOn} />
              </button>
            ) : null}
            <button ref={closeButtonRef} type="button" className="woh-viewer__button" aria-label="Close stories" onClick={onClose}>
              <CloseIcon />
            </button>
          </div>
        </div>

        <button type="button" className="woh-viewer__tap woh-viewer__tap--prev" aria-label="Previous story" onClick={() => handleTap(showPrevious)} />
        <button type="button" className="woh-viewer__tap woh-viewer__tap--next" aria-label="Next story" onClick={() => handleTap(showNext)} />
        <p className="woh-viewer__hint">Tap to continue. Swipe down or press Esc to close.</p>
      </div>
    </div>,
    document.body,
  );
}
