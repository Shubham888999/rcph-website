import { useEffect, useRef, useState } from "react";
import {
  carrotCountForWidth,
  carrotOpacity,
  carrotTransform,
  createCarrot,
  stepCarrot,
} from "../../features/visits/carrotFieldModel.js";

const CARROT_SRC = "/visit-theme/carrot.svg";
const RESIZE_DEBOUNCE_MS = 200;

function viewportBounds() {
  return { width: window.innerWidth, height: window.innerHeight };
}

function siteThemeMode() {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function prefersReducedMotion() {
  try {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  } catch {
    return false;
  }
}

function paintCarrot(element, carrot) {
  if (!element) return;
  element.style.transform = carrotTransform(carrot);
}

// DZR carrot theme only: decorative carrots drifting behind the page content.
// Positions are written straight to the elements; React only renders the list.
export default function CarrotField() {
  const [count, setCount] = useState(() => carrotCountForWidth(window.innerWidth));
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);
  const elementsRef = useRef([]);

  useEffect(() => {
    let timer = 0;
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setCount(carrotCountForWidth(window.innerWidth)), RESIZE_DEBOUNCE_MS);
    };
    window.addEventListener("resize", onResize);
    let query = null;
    const onMotionChange = (event) => setReducedMotion(event.matches);
    try {
      query = window.matchMedia?.("(prefers-reduced-motion: reduce)") || null;
      query?.addEventListener?.("change", onMotionChange);
    } catch {
      query = null;
    }
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
      query?.removeEventListener?.("change", onMotionChange);
    };
  }, []);

  useEffect(() => {
    const random = Math.random;
    let mode = siteThemeMode();
    let carrots = Array.from({ length: count }, () => createCarrot(viewportBounds(), random, mode));

    carrots.forEach((carrot, index) => {
      const element = elementsRef.current[index];
      if (!element) return;
      element.style.width = `${carrot.width}px`;
      element.style.height = `${carrot.height}px`;
      element.style.opacity = String(carrot.opacity);
      paintCarrot(element, carrot);
    });

    const themeObserver = new MutationObserver(() => {
      const nextMode = siteThemeMode();
      if (nextMode === mode) return;
      mode = nextMode;
      carrots.forEach((carrot, index) => {
        const element = elementsRef.current[index];
        if (element) element.style.opacity = String(carrotOpacity(mode, carrot.opacityT));
      });
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    if (reducedMotion) {
      return () => themeObserver.disconnect();
    }

    let frame = 0;
    let last = 0;
    const tick = (now) => {
      const dt = last ? (now - last) / 1000 : 0;
      last = now;
      const bounds = viewportBounds();
      carrots = carrots.map((carrot, index) => {
        const next = stepCarrot(carrot, dt, bounds, random);
        paintCarrot(elementsRef.current[index], next);
        return next;
      });
      frame = window.requestAnimationFrame(tick);
    };
    const start = () => {
      if (frame || document.hidden) return;
      last = 0;
      frame = window.requestAnimationFrame(tick);
    };
    const stop = () => {
      window.cancelAnimationFrame(frame);
      frame = 0;
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    document.addEventListener("visibilitychange", onVisibility);
    start();
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      themeObserver.disconnect();
    };
  }, [count, reducedMotion]);

  return (
    <div className="visit-dashboard-carrot-field" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <img
          className="visit-dashboard-carrot-field__carrot"
          key={index}
          ref={(element) => {
            elementsRef.current[index] = element;
          }}
          src={CARROT_SRC}
          alt=""
          aria-hidden="true"
          draggable="false"
        />
      ))}
    </div>
  );
}
