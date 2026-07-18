import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import homeGalleryItems from "./homeGalleryData";
import { copyReveal, galleryItemReveal, headingReveal, staggerContainer } from "./homeMotion";

export default function HomeGallery() {
  const reduceMotion = useReducedMotion();
  const [selectedAlbumIndex, setSelectedAlbumIndex] = useState(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const closeButtonRef = useRef(null);
  const touchStartX = useRef(null);
  const activeAlbum = selectedAlbumIndex === null ? null : homeGalleryItems[selectedAlbumIndex];
  const activePhotos = getAlbumPhotos(activeAlbum);
  const activePhoto = activePhotos[selectedPhotoIndex] || activePhotos[0];
  const activePhotosCount = activePhotos.length;
  const hasMultiplePhotos = activePhotosCount > 1;

  function openAlbum(index) {
    setSelectedAlbumIndex(index);
    setSelectedPhotoIndex(0);
  }

  const closeAlbum = useCallback(() => {
    setSelectedAlbumIndex(null);
    setSelectedPhotoIndex(0);
    touchStartX.current = null;
  }, []);

  const showPreviousPhoto = useCallback(() => {
    if (!hasMultiplePhotos) return;
    setSelectedPhotoIndex((current) => (current === 0 ? activePhotosCount - 1 : current - 1));
  }, [activePhotosCount, hasMultiplePhotos]);

  const showNextPhoto = useCallback(() => {
    if (!hasMultiplePhotos) return;
    setSelectedPhotoIndex((current) => (current + 1) % activePhotosCount);
  }, [activePhotosCount, hasMultiplePhotos]);

  function handleTouchStart(event) {
    touchStartX.current = event.changedTouches[0]?.clientX ?? null;
  }

  function handleTouchEnd(event) {
    if (touchStartX.current === null) return;
    const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
    const deltaX = endX - touchStartX.current;
    touchStartX.current = null;

    if (Math.abs(deltaX) < 42) return;
    if (deltaX > 0) showPreviousPhoto();
    else showNextPhoto();
  }

  useEffect(() => {
    if (selectedAlbumIndex === null) return undefined;

    closeButtonRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") closeAlbum();
      if (event.key === "ArrowLeft") showPreviousPhoto();
      if (event.key === "ArrowRight") showNextPhoto();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeAlbum, selectedAlbumIndex, showNextPhoto, showPreviousPhoto]);

  return (
    <section className="home-section home-gallery" aria-labelledby="home-gallery-title">
      <motion.div
        className="home-section__heading home-section__heading--split"
        variants={reduceMotion ? undefined : staggerContainer}
        initial={reduceMotion ? false : "hidden"}
        whileInView={reduceMotion ? undefined : "visible"}
        viewport={{ once: true, amount: 0.2 }}
      >
        <motion.div variants={reduceMotion ? undefined : headingReveal}>
          <p className="home-kicker">Life at RCPH</p>
          <h2 id="home-gallery-title">Gallery</h2>
        </motion.div>
        <motion.p variants={reduceMotion ? undefined : copyReveal}>
          A glimpse of our projects, fellowships, learning, and club milestones.
        </motion.p>
      </motion.div>

      <motion.div
        className="home-gallery__grid"
        variants={reduceMotion ? undefined : staggerContainer}
        initial={reduceMotion ? false : "hidden"}
        whileInView={reduceMotion ? undefined : "visible"}
        viewport={{ once: true, amount: 0.08 }}
      >
        {homeGalleryItems.map((item, index) => (
          <motion.button
            className="home-gallery__item"
            type="button"
            aria-label={`Open ${item.title} album`}
            variants={reduceMotion ? undefined : galleryItemReveal}
            custom={index}
            key={item.title}
            onClick={() => openAlbum(index)}
          >
            <img src={item.image} alt={item.alt} loading="lazy" decoding="async" />
            <span className="home-gallery__item-title">{item.title}</span>
          </motion.button>
        ))}
      </motion.div>

      {activeAlbum && activePhoto ? (
        <div
          className="home-gallery-modal"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeAlbum();
          }}
        >
          <div
            className="home-gallery-modal__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="home-gallery-modal-title"
          >
            <button
              ref={closeButtonRef}
              className="home-gallery-modal__close"
              type="button"
              aria-label="Close gallery album"
              onClick={closeAlbum}
            >
              <span aria-hidden="true">x</span>
            </button>

            <div className="home-gallery-modal__header">
              <p className="home-kicker">Album</p>
              <h3 id="home-gallery-modal-title">{activeAlbum.title}</h3>
              <span>
                {selectedPhotoIndex + 1} / {activePhotos.length}
              </span>
            </div>

            <div
              className="home-gallery-modal__stage"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <button
                className="home-gallery-modal__nav home-gallery-modal__nav--prev"
                type="button"
                aria-label="Show previous photo"
                disabled={!hasMultiplePhotos}
                onClick={showPreviousPhoto}
              >
                <span aria-hidden="true">{"<"}</span>
              </button>

              <img
                src={activePhoto.image}
                alt={activePhoto.alt}
                draggable="false"
              />

              <button
                className="home-gallery-modal__nav home-gallery-modal__nav--next"
                type="button"
                aria-label="Show next photo"
                disabled={!hasMultiplePhotos}
                onClick={showNextPhoto}
              >
                <span aria-hidden="true">{">"}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function getAlbumPhotos(album) {
  if (!album) return [];
  if (Array.isArray(album.photos) && album.photos.length > 0) return album.photos;
  return [{ image: album.image, alt: album.alt }];
}
