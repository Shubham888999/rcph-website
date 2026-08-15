import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import installationPhotos, { getInstallationMediaType } from "./installationPhotos";

const filmEase = [0.22, 1, 0.36, 1];

const sectionReveal = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.56, ease: filmEase },
  },
};

const filmReveal = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.055, delayChildren: 0.08 } },
};

const frameReveal = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.44, ease: filmEase },
  },
};

export default function InstallationFilmGallery() {
  const reduceMotion = useReducedMotion();
  const sectionRef = useRef(null);
  const scrollerRef = useRef(null);
  const trackRef = useRef(null);
  const closeButtonRef = useRef(null);
  const viewerDialogRef = useRef(null);
  const previousFocusRef = useRef(null);
  const scrollRafRef = useRef(null);
  const playbackRafRef = useRef(null);
  const activeIndexRef = useRef(0);
  const galleryVisibleRef = useRef(false);
  const frameVideoVisibilityRef = useRef(new Map());
  const [activeIndex, setActiveIndex] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(true);
  const [mediaStatus, setMediaStatus] = useState({});
  const [viewerIndex, setViewerIndex] = useState(null);
  const viewerPhoto = viewerIndex === null ? null : installationPhotos[viewerIndex];

  const markMediaReady = useCallback((id) => {
    setMediaStatus((currentStatus) => {
      if (currentStatus[id] === "loaded") return currentStatus;
      return { ...currentStatus, [id]: "loaded" };
    });
  }, []);

  const markMediaMissing = useCallback((id) => {
    setMediaStatus((currentStatus) => {
      if (currentStatus[id] === "missing") return currentStatus;
      return { ...currentStatus, [id]: "missing" };
    });
  }, []);

  const updateScrollState = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const scrollerRect = scroller.getBoundingClientRect();
    const centerX = scrollerRect.left + scrollerRect.width / 2;
    const frames = Array.from(scroller.querySelectorAll(".home-film-gallery__frame"));
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    frames.forEach((frame, index) => {
      const frameRect = frame.getBoundingClientRect();
      const frameCenter = frameRect.left + frameRect.width / 2;
      const distance = Math.abs(centerX - frameCenter);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    if (closestIndex !== activeIndexRef.current) {
      activeIndexRef.current = closestIndex;
      setActiveIndex(closestIndex);
    }

    setCanScrollPrev(scroller.scrollLeft > 2);
    setCanScrollNext(scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 2);
  }, []);

  const scheduleScrollStateUpdate = useCallback(() => {
    if (scrollRafRef.current !== null) return;

    scrollRafRef.current = window.requestAnimationFrame(() => {
      scrollRafRef.current = null;
      updateScrollState();
    });
  }, [updateScrollState]);

  const syncFrameVideoPlayback = useCallback(() => {
    if (playbackRafRef.current !== null) return;

    playbackRafRef.current = window.requestAnimationFrame(() => {
      playbackRafRef.current = null;

      const scroller = scrollerRef.current;
      if (!scroller) return;

      const shouldPlay =
        !reduceMotion &&
        viewerIndex === null &&
        galleryVisibleRef.current &&
        document.visibilityState !== "hidden";

      const videos = Array.from(scroller.querySelectorAll(".home-film-gallery__video--frame"));

      videos.forEach((video) => {
        const isFrameVisible = frameVideoVisibilityRef.current.get(video) === true;

        if (shouldPlay && isFrameVisible) {
          playVideo(video);
        } else {
          pauseVideo(video);
        }
      });
    });
  }, [reduceMotion, viewerIndex]);

  const scrollFilm = useCallback(
    (direction) => {
      const scroller = scrollerRef.current;
      const firstFrame = scroller?.querySelector(".home-film-gallery__frame");
      if (!scroller || !firstFrame) return;

      const trackStyles = trackRef.current ? window.getComputedStyle(trackRef.current) : null;
      const gap = Number.parseFloat(trackStyles?.columnGap || trackStyles?.gap || "0") || 0;
      const step = firstFrame.getBoundingClientRect().width + gap;

      scroller.scrollBy({
        left: direction * step,
        behavior: reduceMotion ? "auto" : "smooth",
      });
    },
    [reduceMotion],
  );

  const openViewer = useCallback((index) => {
    previousFocusRef.current = document.activeElement;
    setViewerIndex(index);
  }, []);

  const closeViewer = useCallback(() => {
    setViewerIndex(null);
    window.requestAnimationFrame(() => {
      previousFocusRef.current?.focus?.();
      previousFocusRef.current = null;
    });
  }, []);

  const showPreviousViewerPhoto = useCallback(() => {
    setViewerIndex((currentIndex) => {
      if (currentIndex === null) return currentIndex;
      return currentIndex === 0 ? installationPhotos.length - 1 : currentIndex - 1;
    });
  }, []);

  const showNextViewerPhoto = useCallback(() => {
    setViewerIndex((currentIndex) => {
      if (currentIndex === null) return currentIndex;
      return (currentIndex + 1) % installationPhotos.length;
    });
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return undefined;

    updateScrollState();
    scroller.addEventListener("scroll", scheduleScrollStateUpdate, { passive: true });
    window.addEventListener("resize", scheduleScrollStateUpdate);

    return () => {
      scroller.removeEventListener("scroll", scheduleScrollStateUpdate);
      window.removeEventListener("resize", scheduleScrollStateUpdate);

      if (scrollRafRef.current !== null) {
        window.cancelAnimationFrame(scrollRafRef.current);
      }
    };
  }, [scheduleScrollStateUpdate, updateScrollState]);

  useEffect(() => {
    const section = sectionRef.current;
    const scroller = scrollerRef.current;
    if (!section || !scroller) return undefined;

    const frameVideoVisibility = frameVideoVisibilityRef.current;
    const videos = Array.from(scroller.querySelectorAll(".home-film-gallery__video--frame"));
    if (videos.length === 0) return undefined;

    function handleVisibilityChange() {
      syncFrameVideoPlayback();
    }

    if (reduceMotion || typeof IntersectionObserver !== "function") {
      galleryVisibleRef.current = !reduceMotion;
      videos.forEach((video) => {
        frameVideoVisibility.set(video, !reduceMotion);
        if (reduceMotion) pauseVideo(video);
      });
      document.addEventListener("visibilitychange", handleVisibilityChange);
      syncFrameVideoPlayback();

      return () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        videos.forEach(pauseVideo);
        frameVideoVisibility.clear();
      };
    }

    const galleryObserver = new IntersectionObserver(
      (entries) => {
        galleryVisibleRef.current = entries.some((entry) => entry.isIntersecting);
        syncFrameVideoPlayback();
      },
      { threshold: [0, 0.05] },
    );

    const videoObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          frameVideoVisibility.set(
            entry.target,
            entry.isIntersecting && entry.intersectionRatio >= 0.35,
          );
        });
        syncFrameVideoPlayback();
      },
      { root: scroller, threshold: [0, 0.35, 0.7] },
    );

    galleryObserver.observe(section);
    videos.forEach((video) => videoObserver.observe(video));
    document.addEventListener("visibilitychange", handleVisibilityChange);
    syncFrameVideoPlayback();

    return () => {
      galleryObserver.disconnect();
      videoObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      videos.forEach(pauseVideo);
      frameVideoVisibility.clear();

      if (playbackRafRef.current !== null) {
        window.cancelAnimationFrame(playbackRafRef.current);
        playbackRafRef.current = null;
      }
    };
  }, [mediaStatus, reduceMotion, syncFrameVideoPlayback]);

  useEffect(() => {
    if (viewerIndex === null) return undefined;

    closeButtonRef.current?.focus();

    function handleViewerKeyDown(event) {
      if (event.key === "Escape") {
        closeViewer();
        return;
      }

      if (event.key === "ArrowLeft") {
        showPreviousViewerPhoto();
        return;
      }

      if (event.key === "ArrowRight") {
        showNextViewerPhoto();
        return;
      }

      if (event.key !== "Tab" || !viewerDialogRef.current) return;

      const focusable = Array.from(
        viewerDialogRef.current.querySelectorAll(
          'button:not(:disabled), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      );

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

    window.addEventListener("keydown", handleViewerKeyDown);
    return () => window.removeEventListener("keydown", handleViewerKeyDown);
  }, [closeViewer, showNextViewerPhoto, showPreviousViewerPhoto, viewerIndex]);

  return (
    <motion.section
      ref={sectionRef}
      className="home-section home-film-gallery"
      aria-labelledby="home-film-gallery-title"
      variants={reduceMotion ? undefined : sectionReveal}
      initial={reduceMotion ? false : "hidden"}
      whileInView={reduceMotion ? undefined : "visible"}
      viewport={{ once: true, amount: 0.16 }}
    >
<div className="home-film-gallery__header">
  <p className="home-kicker">VOX // &rsquo;26</p>

  <h2 id="home-film-gallery-title">
    The Installation Cut
  </h2>

  <p className="home-film-gallery__subtitle">
    One night. One stage. A year set in motion.
  </p>
</div>

<div
  className="home-film-gallery__console"
  aria-label="VOX installation film controls"
>
  <div className="home-film-gallery__controls">
          <motion.button
            className="home-film-gallery__control"
            type="button"
            aria-label="Previous installation photos"
            disabled={!canScrollPrev}
            onClick={() => scrollFilm(-1)}
            whileTap={reduceMotion ? undefined : { scale: 0.96 }}
          >
            <span aria-hidden="true">&lt;</span>
          </motion.button>

          <p className="home-film-gallery__hint">
            DRAG / SWIPE TO ROLL
            <span aria-hidden="true" />
          </p>

          <motion.button
            className="home-film-gallery__control"
            type="button"
            aria-label="Next installation photos"
            disabled={!canScrollNext}
            onClick={() => scrollFilm(1)}
            whileTap={reduceMotion ? undefined : { scale: 0.96 }}
          >
            <span aria-hidden="true">&gt;</span>
          </motion.button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="home-film-gallery__viewport"
        aria-label="Scrollable VOX installation film roll"
        tabIndex="0"
      >
        <motion.div
          ref={trackRef}
          className="home-film-gallery__track"
          variants={reduceMotion ? undefined : filmReveal}
          initial={reduceMotion ? false : "hidden"}
          whileInView={reduceMotion ? undefined : "visible"}
          viewport={{ once: true, amount: 0.18 }}
        >
          {installationPhotos.map((photo, index) => (
            <FilmFrame
              key={photo.id}
              photo={photo}
              index={index}
              isActive={activeIndex === index}
              mediaStatus={mediaStatus[photo.id]}
              reduceMotion={reduceMotion}
              onMediaReady={markMediaReady}
              onMediaError={markMediaMissing}
              onOpen={openViewer}
            />
          ))}
        </motion.div>
      </div>

      <AnimatePresence>
        {viewerPhoto ? (
          <motion.div
            className="home-film-gallery__viewer"
            role="presentation"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
            onClick={(event) => {
              if (event.target === event.currentTarget) closeViewer();
            }}
          >
            <motion.div
              ref={viewerDialogRef}
              className="home-film-gallery__viewer-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="home-film-gallery-viewer-title"
              initial={reduceMotion ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: 18 }}
              transition={{ duration: reduceMotion ? 0 : 0.22, ease: filmEase }}
            >
              <div className="home-film-gallery__viewer-header">
                <div>
                  <p className="home-film-gallery__viewer-kicker">FRAME {viewerPhoto.frame}</p>
                  <h3 id="home-film-gallery-viewer-title">{viewerPhoto.caption}</h3>
                </div>

                <button
                  ref={closeButtonRef}
                  className="home-film-gallery__viewer-close"
                  type="button"
                  aria-label="Close installation media viewer"
                  onClick={closeViewer}
                >
                  <span aria-hidden="true">x</span>
                </button>
              </div>

              <div className="home-film-gallery__viewer-stage">
                <button
                  className="home-film-gallery__viewer-nav home-film-gallery__viewer-nav--prev"
                  type="button"
                  aria-label="Previous installation media"
                  onClick={showPreviousViewerPhoto}
                >
                  <span aria-hidden="true">&lt;</span>
                </button>

                <MediaVisual
                  key={viewerPhoto.id}
                  photo={viewerPhoto}
                  mediaStatus={mediaStatus[viewerPhoto.id]}
                  loading="eager"
                  mode="viewer"
                  reduceMotion={reduceMotion}
                  onMediaReady={markMediaReady}
                  onMediaError={markMediaMissing}
                />

                <button
                  className="home-film-gallery__viewer-nav home-film-gallery__viewer-nav--next"
                  type="button"
                  aria-label="Next installation media"
                  onClick={showNextViewerPhoto}
                >
                  <span aria-hidden="true">&gt;</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.section>
  );
}

function FilmFrame({
  photo,
  index,
  isActive,
  mediaStatus,
  reduceMotion,
  onMediaReady,
  onMediaError,
  onOpen,
}) {
  return (
    <motion.button
      className={`home-film-gallery__frame${isActive ? " home-film-gallery__frame--active" : ""}`}
      type="button"
      aria-label={`Open ${photo.caption} frame ${photo.frame}`}
      aria-current={isActive ? "true" : undefined}
      variants={reduceMotion ? undefined : frameReveal}
      whileHover={reduceMotion ? undefined : { y: -3, scale: 1.01 }}
      whileTap={reduceMotion ? undefined : { scale: 0.99 }}
      onClick={() => onOpen(index)}
    >
      <span className="home-film-gallery__frame-number">
        VOX26 <span aria-hidden="true">&middot;</span> {photo.frame}
      </span>

      <MediaVisual
        photo={photo}
        mediaStatus={mediaStatus}
        loading={index < 4 ? "eager" : "lazy"}
        mode="frame"
        reduceMotion={reduceMotion}
        onMediaReady={onMediaReady}
        onMediaError={onMediaError}
      />
    </motion.button>
  );
}

function MediaVisual({
  photo,
  mediaStatus,
  loading,
  mode,
  reduceMotion,
  onMediaReady,
  onMediaError,
}) {
  const videoRef = useRef(null);
  const mediaType = getInstallationMediaType(photo.src);
  const isLoaded = mediaStatus === "loaded";
  const isMissing = mediaStatus === "missing" || mediaType === "unknown";

  useEffect(() => {
    const video = videoRef.current;

    return () => {
      if (video) pauseVideo(video);
    };
  }, [photo.src]);

  return (
    <span className={`home-film-gallery__photo home-film-gallery__photo--${mode}`}>
      <span
        className={`home-film-gallery__placeholder${
          isLoaded ? " home-film-gallery__placeholder--hidden" : ""
        }`}
        aria-hidden="true"
      >
        <strong>VOX // &rsquo;26</strong>
        <span>FRAME {photo.frame}</span>
      </span>

      {!isMissing && mediaType === "image" ? (
        <img
          className={`home-film-gallery__image${
            isLoaded ? " home-film-gallery__image--loaded" : ""
          }`}
          src={photo.src}
          alt={photo.alt}
          loading={loading}
          decoding="async"
          draggable="false"
          onLoad={() => onMediaReady(photo.id)}
          onError={() => onMediaError(photo.id)}
        />
      ) : null}

      {!isMissing && mediaType === "video" ? (
<video
  ref={videoRef}
  className={`home-film-gallery__video home-film-gallery__video--${mode}${
    isLoaded ? " home-film-gallery__video--loaded" : ""
  }`}
  src={photo.src}
  aria-label={photo.alt || photo.caption}
  autoPlay={!reduceMotion}
  loop
  muted
  playsInline
  preload="metadata"
  onLoadedMetadata={() => onMediaReady(photo.id)}
  onLoadedData={() => onMediaReady(photo.id)}
  onCanPlay={() => onMediaReady(photo.id)}
  onPlaying={() => onMediaReady(photo.id)}
  onError={() => onMediaError(photo.id)}
/>
      ) : null}
    </span>
  );
}

function playVideo(video) {
  const playPromise = video.play();

  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {});
  }
}

function pauseVideo(video) {
  if (!video.paused) {
    video.pause();
  }
}
